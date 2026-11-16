/** Bounded persistent child for read-only corpus tooling, outside the SDK. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Options are an internal testing seam; the corpus CLI supplies no worker path,
// deadline or heap overrides from source data or profiles.
export function createLuaWorker({ profile = 'bounded', timeoutMs = profile === 'corpus' ? 60000 : 10000,
  maxOutputBytes = (profile === 'corpus' ? 128 : 32) * 1024 * 1024,
  spawnProcess = spawn,
  workerPath = fileURLToPath(new URL(profile === 'corpus' ? './lua-corpus-worker.mjs' : './lua-analysis-worker.mjs', import.meta.url)) } = {}) {
  if (!['bounded', 'corpus'].includes(profile) ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > (profile === 'corpus' ? 60000 : 10000) ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0 || maxOutputBytes > (profile === 'corpus' ? 128 : 32) * 1024 * 1024) {
    throw new RangeError('Invalid Lua worker limits');
  }
  let active = null, closed = false, sequence = 0, restarting = false;
  const children = new Set();
  const error = code => new Error(code);
  function invalidate(state, code) {
    if (active === state) active = null;
    const pending = state.pending;
    state.pending = null;
    if (pending) { clearTimeout(pending.timer); pending.reject(error(code)); }
    if (state.child.exitCode === null && state.child.signalCode === null) state.child.kill('SIGKILL');
  }
  function start() {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_V8_COVERAGE;
    const flags = profile === 'corpus' ? ['--max-old-space-size=2048'] : ['--max-old-space-size=128', '--stack_size=1024'];
    const child = spawnProcess(process.execPath, [...flags, workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true, env,
    });
    const state = { child, pending: null, buffer: '', bytes: 0, done: null };
    children.add(state);
    state.done = new Promise(resolve => child.once('close', () => { children.delete(state); resolve(); }));
    child.stderr.resume();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (active !== state) return;
      state.bytes += Buffer.byteLength(chunk);
      if (state.bytes > maxOutputBytes) { invalidate(state, 'lua-worker-output-limit'); return; }
      state.buffer += chunk;
      const end = state.buffer.indexOf('\n');
      if (end < 0) return;
      if (!state.pending || end !== state.buffer.length - 1) { invalidate(state, 'lua-worker-protocol'); return; }
      let response;
      try { response = JSON.parse(state.buffer.slice(0, end)); }
      catch { invalidate(state, 'lua-worker-protocol'); return; }
      if (response?.id !== state.pending.id || response.result?.schemaVersion !== 1 ||
          typeof response.result.complete !== 'boolean' || !Array.isArray(response.result.declarations) ||
          !Array.isArray(response.result.diagnostics)) { invalidate(state, 'lua-worker-protocol'); return; }
      const pending = state.pending;
      state.pending = null; state.buffer = ''; state.bytes = 0;
      clearTimeout(pending.timer);
      pending.resolve(response.result);
    });
    child.on('error', () => invalidate(state, 'lua-worker-start'));
    child.stdin.on('error', () => invalidate(state, 'lua-worker-write'));
    child.on('exit', () => invalidate(state, 'lua-worker-exit'));
    return state;
  }
  return {
    analyze: function analyze(request) {
      if (closed) return Promise.reject(error('lua-worker-closed'));
      if (restarting || active?.pending) return Promise.reject(error('lua-worker-busy'));
      if (profile === 'corpus' && !active && children.size) {
        // A kill request is not a close/reap acknowledgement. Do not overlap
        // large parser isolates while a failed child is still retiring.
        restarting = true;
        return Promise.all([...children].map(state => state.done)).then(() => {
          restarting = false;
          return analyze(request);
        });
      }
      try { active ??= start(); }
      catch { return Promise.reject(error('lua-worker-start')); }
      const state = active;
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => invalidate(state, 'lua-worker-timeout'), timeoutMs);
        state.pending = { id, timer, resolve, reject };
        try {
          state.child.stdin.write(JSON.stringify({ ...request, id }) + '\n', issue => {
            if (issue) invalidate(state, 'lua-worker-write');
          });
        } catch { invalidate(state, 'lua-worker-write'); }
      });
    },
    async close() {
      closed = true;
      const states = [...children];
      for (const state of states) invalidate(state, 'lua-worker-closed');
      await Promise.all(states.map(state => state.done));
    },
  };
}
