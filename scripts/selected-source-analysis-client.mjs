/** Supervised private graph parser port with separate fixed launcher classes. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {snapshotGraphAnalysisRequest, verifyGraphAnalysisReply, exact} from './selected-source-analysis.mjs';

const worker = fileURLToPath(new URL('./selected-source-analysis-worker.mjs', import.meta.url));
const launcherRequestLimit = 32;
const reapLimit = 10000;

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
  cleanupDeadline = () => Infinity, timeoutMs = 60000, maxOutputBytes = 128 * 1024 * 1024} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 128 * 1024 * 1024) throw Error('graph-analysis-limits');
  let closed = false, busy = false, sequence = 0;
  let retireBy = null, idleFault = null;
  const launchers = new Map();
  const children = new Set();
  function retirementDeadline() {
    retireBy = Math.min(retireBy ?? Infinity, now() + Math.min(timeoutMs, reapLimit), cleanupDeadline());
    return retireBy;
  }
  function forget(state) {
    if (launchers.get(state.mode) === state) launchers.delete(state.mode);
  }
  function markRetiring(state) {
    forget(state);
    if (!children.has(state)) return false;
    state.retiring = true;
    retirementDeadline();
    return true;
  }
  function signal(state) {
    if (!markRetiring(state) || state.signalled) return;
    state.signalled = true;
    const {child} = state;
    if (child.exitCode === null && child.signalCode === null) {
      try {child.kill('SIGKILL');} catch { /* Ownership ends on close. */ }
    }
  }
  function reportIdleFault() {
    if (idleFault === null) return;
    const code = idleFault;
    idleFault = null;
    throw Error(code);
  }
  function retireLaunchers() {
    const retained = [...children].filter(state => state.mode !== null);
    for (const state of retained) markRetiring(state);
    for (const state of retained) signal(state);
  }
  async function waitFor(states, deadline, code) {
    let timer;
    try {
      await Promise.race([Promise.all(states.map(state => state.done)), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(code)), Math.max(0, deadline - now()));
      })]);
      if (now() >= deadline) throw Error(code);
    } finally { clearTimeout(timer); }
  }
  function start(language, mode) {
    const env = {...process.env}; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT; delete env.NODE_V8_COVERAGE;
    const flags = mode === 'corpus-lua' ? ['--max-old-space-size=2048'] : language === 'lua' ?
      ['--max-old-space-size=128', '--stack_size=1024'] : ['--max-old-space-size=256'];
    const args = [...flags, worker];
    if (mode !== null) args.push(mode === 'corpus-lua' ? '--corpus-launcher' : '--xml-toc-launcher');
    let child;
    try {child = spawnProcess(process.execPath, args, {stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true, env});}
    catch {throw Error('graph-analysis-start');}
    const state = {child, mode, done: null, fail: null, pending: null, onClose: null, retiring: false, signalled: false};
    children.add(state);
    state.done = new Promise(resolve => child.once('close', code => {
      children.delete(state);
      try {state.onClose?.(code);}
      finally {
        if (![...children].some(child => child.retiring)) retireBy = null;
        resolve();
      }
    }));
    return state;
  }
  function startLauncher(language, mode) {
    let state;
    try {state = start(language, mode);}
    catch (error) {retireLaunchers(); throw error;}
    const {child} = state;
    state.requests = 0; state.stdoutEnded = false; state.exited = false;
    let ending = false;
    state.retire = () => {
      if (!markRetiring(state) || ending || state.signalled) return;
      ending = true;
      try {child.stdin.end(error => {if (error && children.has(state)) state.fail('graph-analysis-write');});}
      catch {state.fail('graph-analysis-write');}
    };
    state.fail = code => {
      if (state.signalled) return;
      const pending = state.pending ?? [...children].find(peer => peer.pending)?.pending;
      if (pending) pending.fail(code);
      else idleFault ??= code;
      retireLaunchers();
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
      } else if (!ending) state.fail('graph-analysis-exit');
    });
    child.stdout.on('data', chunk => {
      if (state.pending) state.pending.receive(chunk);
      else state.fail('graph-analysis-invariant');
    });
    child.once('exit', () => {
      state.exited = true;
      // Pipes can outlive the process exit. Ownership ends only on close.
      forget(state);
      if (!state.pending && !ending) state.fail('graph-analysis-exit');
    });
    state.onClose = code => {
      forget(state);
      if (state.pending) state.pending.close(code);
      else if (!ending || code !== 0) state.fail('graph-analysis-exit');
    };
    launchers.set(mode, state);
    return state;
  }
  function submitLauncher(state, request, id, payload, deadline, outputCap) {
    return new Promise((resolve, reject) => {
      let bytes = 0, frameTurn, checked, closedCode, timer;
      let expires = deadline, timeout = 'graph-analysis-timeout';
      const chunks = [];
      const last = ++state.requests === launcherRequestLimit;
      function armTimer() {
        clearTimeout(timer);
        timer = setTimeout(() => state.fail(timeout), Math.max(0, expires - now()));
      }
      function expired() {
        if (now() < expires) return false;
        state.fail(timeout);
        return true;
      }

      function finish(error, outcome) {
        state.pending = null;
        clearTimeout(timer); clearImmediate(frameTurn);
        chunks.length = 0;
        if (error) reject(error);
        else resolve({result: outcome.result, confirmedApiCalls: outcome.confirmedApiCalls});
      }
      function complete() {
        if (expired()) return;
        if (checked.failure !== null) {
          finish(replyError(checked));
          retireLaunchers();
        }
        else finish(null, checked);
      }
      function verify() {
        if (expired()) return;
        try {checked = decodeReply(chunks, bytes, id, request);}
        catch {state.fail('graph-analysis-invariant'); return;}
        chunks.length = 0;
        if (expired()) return;
        const retiring = last || checked.failure !== null;
        if ((state.stdoutEnded || state.exited || closedCode !== undefined) && !retiring) {
          state.fail('graph-analysis-exit'); return;
        }
        if (!retiring || closedCode === 0) complete();
        else if (markRetiring(state) && retireBy < expires) {
          expires = retireBy; timeout = 'graph-analysis-reap';
          if (!expired()) armTimer();
        }
      }
      const pending = {
        hasFrame: false,
        fail(code) {finish(Error(code));},
        receive(chunk) {
          if (expired()) return;
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
          if (expired()) return;
          if (code !== 0 || !pending.hasFrame) {state.fail('graph-analysis-exit'); return;}
          closedCode = code;
          if (checked) complete();
        },
      };
      state.pending = pending;
      if (expired()) return;
      armTimer();
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
        const mode = corpus ? 'corpus-lua' : request.language === 'lua' ? null : 'toc-xml';
        if (mode === null) {
          const retained = [...launchers.values()];
          for (const state of retained) markRetiring(state);
          for (const state of retained) state.retire();
        }
        while (true) {
          const retiring = [...children].filter(state => state.retiring);
          if (!retiring.length) break;
          const reap = retirementDeadline();
          const code = reap < deadline ? 'graph-analysis-reap' : 'graph-analysis-timeout';
          try {await waitFor(retiring, Math.min(reap, deadline), code);}
          catch (error) {
            for (const state of retiring) signal(state);
            throw error;
          }
        }
        if (closed) throw Error('graph-analysis-closed');
        reportIdleFault();
        if (now() >= deadline) throw Error('graph-analysis-timeout');
        const id = ++sequence, payload = JSON.stringify({id, ...request}) + '\n';
        if (now() >= deadline) throw Error('graph-analysis-timeout');
        if (mode !== null) return await submitLauncher(launchers.get(mode) ?? startLauncher(request.language, mode),
          request, id, payload, deadline, outputCap);
        const state = start(request.language, null), {child} = state;
        return await new Promise((resolve, reject) => {
          let settled = false, timer, bytes = 0; const chunks = [];
          const fail = code => {
            if (!settled) { settled = true; clearTimeout(timer); reject(Error(code)); }
            signal(state);
          };
          state.fail = fail;
          timer = setTimeout(() => fail('graph-analysis-timeout'), Math.max(0, deadline - now()));
          child.stderr.resume();
          child.on('error', () => fail('graph-analysis-start'));
          child.stdin.on('error', () => fail('graph-analysis-write'));
          child.stdout.on('error', () => fail('graph-analysis-exit'));
          child.stderr.on('error', () => fail('graph-analysis-exit'));
          child.stdout.on('data', chunk => {
            if (settled) return;
            if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
            bytes += chunk.length;
            if (bytes > outputCap || chunks.length >= 8192) { fail('graph-analysis-output-limit'); return; }
            chunks.push(chunk);
          });
          state.onClose = code => {
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
          };
          if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
          try { child.stdin.end(payload, issue => { if (issue) fail('graph-analysis-write'); }); }
          catch { fail('graph-analysis-write'); }
        });
      } finally { busy = false; }
    },
    async close() {
      closed = true;
      const states = [...children];
      if (states.length > 0) {
        const deadline = retirementDeadline();
        for (const state of states) markRetiring(state);
        for (const state of states) {
          if (state.pending) {
            state.pending.fail('graph-analysis-closed');
            signal(state);
          } else if (state.mode === null) state.fail?.('graph-analysis-closed');
          else state.retire();
        }
        try {await waitFor(states, deadline, 'graph-analysis-reap');}
        catch (error) {
          for (const state of states) signal(state);
          throw error;
        }
      }
      reportIdleFault();
    },
  };
}
