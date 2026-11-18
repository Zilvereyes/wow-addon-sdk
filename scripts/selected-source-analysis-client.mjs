/** Supervised private graph parser port; one child owns one bounded request. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {snapshotGraphAnalysisRequest, verifyGraphAnalysisReply, exact} from './selected-source-analysis.mjs';

const worker = fileURLToPath(new URL('./selected-source-analysis-worker.mjs', import.meta.url));
export function createGraphAnalyzer({spawnProcess = spawn, now = () => performance.now(),
  timeoutMs = 60000, maxOutputBytes = 128 * 1024 * 1024} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 128 * 1024 * 1024) throw Error('graph-analysis-limits');
  let closed = false, busy = false, sequence = 0;
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
        await waitFor([...children], deadline, 'graph-analysis-timeout');
        if (closed) throw Error('graph-analysis-closed');
        if (now() >= deadline) throw Error('graph-analysis-timeout');
        const env = {...process.env}; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT; delete env.NODE_V8_COVERAGE;
        const flags = corpus ? ['--max-old-space-size=2048'] : request.language === 'lua' ?
          ['--max-old-space-size=128', '--stack_size=1024'] : ['--max-old-space-size=256'];
        let child;
        try { child = spawnProcess(process.execPath, [...flags, worker], {stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true, env}); }
        catch { throw Error('graph-analysis-start'); }
        const state = {child, done: null, fail: null}; children.add(state);
        state.done = new Promise(resolve => child.once('close', () => { children.delete(state); resolve(); }));
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
              const buffer = Buffer.concat(chunks, bytes);
              if (buffer.at(-1) !== 10 || buffer.subarray(0, -1).includes(10)) throw Error();
              const reply = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(buffer.subarray(0, -1)));
              exact(reply, ['id', 'result', 'confirmedApiCalls', 'failure']);
              if (reply.id !== id) throw Error();
              const {id: _id, ...body} = reply;
              const checked = verifyGraphAnalysisReply(body, request);
              if (now() >= deadline) { fail('graph-analysis-timeout'); return; }
              settled = true; clearTimeout(timer);
              if (checked.failure !== null) {
                const error = Error(`graph-analysis-${checked.failure}`); error.confirmedApiCalls = checked.confirmedApiCalls; reject(error);
              } else resolve({result: checked.result, confirmedApiCalls: checked.confirmedApiCalls});
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
      for (const state of states) state.fail?.('graph-analysis-closed');
      await waitFor(states, now() + Math.min(timeoutMs, 10000), 'graph-analysis-reap');
    },
  };
}
