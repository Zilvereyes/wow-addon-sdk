/** Supervised private graph parser port; a corpus Lua launcher owns one parser thread at a time. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {snapshotGraphAnalysisRequest, verifyGraphAnalysisReply, exact} from './selected-source-analysis.mjs';

const worker = fileURLToPath(new URL('./selected-source-analysis-worker.mjs', import.meta.url));
const corpusRequestLimit = 32;

function decodeReply(chunks, bytes, id, request) {
  const buffer = Buffer.concat(chunks, bytes);
  if (buffer.at(-1) !== 10 || buffer.subarray(0, -1).includes(10)) throw Error();
  const reply = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(buffer.subarray(0, -1)));
  exact(reply, ['id', 'result', 'confirmedApiCalls', 'failure']);
  if (reply.id !== id) throw Error();
  const {id: _id, ...body} = reply;
  return verifyGraphAnalysisReply(body, request);
}

function replyError(checked) {
  const error = Error('graph-analysis-' + checked.failure);
  error.confirmedApiCalls = checked.confirmedApiCalls;
  return error;
}

export function createGraphAnalyzer({spawnProcess = spawn, now = () => performance.now(),
  timeoutMs = 60000, maxOutputBytes = 128 * 1024 * 1024} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 128 * 1024 * 1024) throw Error('graph-analysis-limits');
  let closed = false, busy = false, sequence = 0, launcher = null;
  const children = new Set();
  async function waitFor(states, deadline, code) {
    let timer;
    try {
      await Promise.race([Promise.all(states.map(state => state.done)), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(code)), Math.max(0, deadline - now()));
      })]);
      if (now() >= deadline) throw Error(code);
    } finally { clearTimeout(timer); }
  }
  function start(language, corpus) {
    const env = {...process.env}; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT; delete env.NODE_V8_COVERAGE;
    const flags = corpus ? ['--max-old-space-size=2048'] : language === 'lua' ?
      ['--max-old-space-size=128', '--stack_size=1024'] : ['--max-old-space-size=256'];
    const args = [...flags, worker];
    if (corpus) args.push('--corpus-launcher');
    let child;
    try {child = spawnProcess(process.execPath, args, {stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true, env});}
    catch {throw Error('graph-analysis-start');}
    const state = {child, done: null, fail: null}; children.add(state);
    state.done = new Promise(resolve => child.once('close', () => {children.delete(state); resolve();}));
    return state;
  }
  function startLauncher() {
    const state = start('lua', true);
    const {child} = state;
    state.requests = 0; state.pending = null; state.stdoutEnded = false; state.exited = false;
    let ending = false, signalled = false;
    state.retire = terminate => {
      if (launcher === state) launcher = null;
      if (!children.has(state)) return;
      if (terminate) {
        if (signalled) return;
        signalled = true;
        if (child.exitCode === null && child.signalCode === null) {
          try {child.kill('SIGKILL');} catch { /* The child remains owned until close. */ }
        }
      } else if (!ending && !signalled) {
        ending = true;
        try {child.stdin.end(error => {if (error && children.has(state)) state.fail('graph-analysis-write');});}
        catch {state.fail('graph-analysis-write');}
      }
    };
    state.fail = code => {
      state.pending?.fail(code);
      state.retire(true);
    };
    child.stderr.resume();
    child.on('error', () => state.fail('graph-analysis-start'));
    child.stdin.on('error', () => state.fail('graph-analysis-write'));
    child.stdout.on('error', () => state.fail('graph-analysis-exit'));
    child.stderr.on('error', () => state.fail('graph-analysis-exit'));
    child.stdout.on('end', () => {
      state.stdoutEnded = true;
      if (state.pending) {
        if (!state.pending.hasFrame) state.fail('graph-analysis-exit');
      } else if (!ending) state.retire(true);
    });
    child.stdout.on('data', chunk => {
      if (state.pending) state.pending.receive(chunk);
      else state.retire(true);
    });
    child.once('exit', () => {
      state.exited = true;
      // Pipes can outlive the process exit. Ownership ends only on close.
      if (launcher === state) launcher = null;
    });
    child.once('close', code => {
      if (launcher === state) launcher = null;
      state.pending?.close(code);
    });
    launcher = state;
    return state;
  }
  function submitCorpus(state, request, id, payload, deadline, outputCap) {
    return new Promise((resolve, reject) => {
      let bytes = 0, frameTurn, checked, closedCode;
      const chunks = [];
      const last = ++state.requests === corpusRequestLimit;
      const timer = setTimeout(() => state.fail('graph-analysis-timeout'), Math.max(0, deadline - now()));

      function finish(error, outcome) {
        state.pending = null;
        clearTimeout(timer); clearImmediate(frameTurn);
        chunks.length = 0;
        if (error) reject(error);
        else resolve({result: outcome.result, confirmedApiCalls: outcome.confirmedApiCalls});
      }
      function complete() {
        if (now() >= deadline) {state.fail('graph-analysis-timeout'); return;}
        if (checked.failure !== null) finish(replyError(checked));
        else finish(null, checked);
      }
      function verify() {
        if (now() >= deadline) {state.fail('graph-analysis-timeout'); return;}
        try {checked = decodeReply(chunks, bytes, id, request);}
        catch {state.fail('graph-analysis-invariant'); return;}
        chunks.length = 0;
        if (now() >= deadline) {state.fail('graph-analysis-timeout'); return;}
        const retiring = last || checked.failure !== null;
        if ((state.stdoutEnded || state.exited || closedCode !== undefined) && !retiring) {
          state.fail('graph-analysis-exit'); return;
        }
        if (!retiring || closedCode === 0) complete();
        else if (launcher === state) launcher = null;
      }
      const pending = {
        hasFrame: false,
        fail(code) {finish(Error(code));},
        receive(chunk) {
          if (now() >= deadline) {state.fail('graph-analysis-timeout'); return;}
          bytes += chunk.length;
          if (bytes > outputCap || chunks.length >= 8192) {state.fail('graph-analysis-output-limit'); return;}
          const newline = chunk.indexOf(10);
          if (pending.hasFrame || (newline !== -1 && newline !== chunk.length - 1)) {
            state.fail('graph-analysis-invariant'); return;
          }
          chunks.push(chunk);
          if (newline !== -1) {
            pending.hasFrame = true;
            // Reject adjacent data before completing a frame; later idle data retires the launcher.
            frameTurn = setImmediate(verify);
          }
        },
        close(code) {
          if (now() >= deadline) {state.fail('graph-analysis-timeout'); return;}
          if (code !== 0 || !pending.hasFrame) {state.fail('graph-analysis-exit'); return;}
          closedCode = code;
          if (checked) complete();
        },
      };
      state.pending = pending;
      if (now() >= deadline) {state.fail('graph-analysis-timeout'); return;}
      try {
        state.child.stdin.write(payload, error => {
          if (error && state.pending === pending) state.fail('graph-analysis-write');
        });
      } catch {state.fail('graph-analysis-write');}
    });
  }
  return {
    async analyze(input, remainingMilliseconds = 15 * 60 * 1000) {
      if (closed) throw Error('graph-analysis-closed');
      if (busy) throw Error('graph-analysis-busy');
      if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) throw Error('graph-analysis-timeout');
      busy = true;
      const began = now();
      try {
        const request = snapshotGraphAnalysisRequest(input);
        const corpus = request.language === 'lua' && request.luaProfile === 'corpus';
        const deadline = began + Math.min(remainingMilliseconds, timeoutMs, corpus ? 60000 : 10000);
        const outputCap = Math.min(maxOutputBytes, (corpus ? 128 : 32) * 1024 * 1024);
        const id = ++sequence, payload = JSON.stringify({id, ...request}) + '\n';
        if (!corpus) launcher?.retire(false);
        while (true) {
          const retiring = [...children].filter(state => state !== launcher);
          if (!retiring.length) break;
          try {await waitFor(retiring, deadline, 'graph-analysis-timeout');}
          catch (error) {
            for (const state of retiring) state.fail?.('graph-analysis-timeout');
            throw error;
          }
        }
        if (closed) throw Error('graph-analysis-closed');
        if (now() >= deadline) throw Error('graph-analysis-timeout');
        if (corpus) return await submitCorpus(launcher ?? startLauncher(), request, id, payload, deadline, outputCap);
        const state = start(request.language, false), {child} = state;
        return await new Promise((resolve, reject) => {
          let settled = false, timer, bytes = 0; const chunks = [];
          const fail = code => {
            if (!settled) { settled = true; clearTimeout(timer); reject(Error(code)); }
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
          };
          state.fail = fail;
          timer = setTimeout(() => fail('graph-analysis-timeout'), Math.max(0, deadline - now()));
          child.stderr.resume();
          child.on('error', () => fail('graph-analysis-start'));
          child.stdin.on('error', () => fail('graph-analysis-write'));
          child.stdout.on('data', chunk => {
            if (settled) return;
            if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
            bytes += chunk.length;
            if (bytes > outputCap || chunks.length >= 8192) { fail('graph-analysis-output-limit'); return; }
            chunks.push(chunk);
          });
          child.once('close', code => {
            if (settled) return;
            if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
            if (code !== 0) { fail('graph-analysis-exit'); return; }
            try {
              const checked = decodeReply(chunks, bytes, id, request);
              if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
              settled = true; clearTimeout(timer);
              if (checked.failure !== null) reject(replyError(checked));
              else resolve({result: checked.result, confirmedApiCalls: checked.confirmedApiCalls});
            } catch { fail('graph-analysis-invariant'); }
          });
          if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
          try { child.stdin.end(payload, issue => { if (issue) fail('graph-analysis-write'); }); }
          catch { fail('graph-analysis-write'); }
        });
      } finally { busy = false; }
    },
    async close() {
      closed = true;
      const states = [...children];
      for (const state of states) {
        if (state === launcher && !state.pending) state.retire(false);
        else state.fail?.('graph-analysis-closed');
      }
      try {await waitFor(states, now() + Math.min(timeoutMs, 10000), 'graph-analysis-reap');}
      catch (error) {
        for (const state of states) state.fail?.('graph-analysis-closed');
        throw error;
      }
    },
  };
}
