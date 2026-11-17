/** Bounded persistent child for read-only corpus tooling, outside the SDK. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Options are an internal testing seam; the corpus CLI supplies no worker path,
// deadline or heap overrides from source data or profiles.
export function createXmlWorker({ timeoutMs = 10000, maxOutputBytes = 32 * 1024 * 1024,
  spawnProcess = spawn,
  workerPath = fileURLToPath(new URL('./xml-analysis-worker.mjs', import.meta.url)) } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10000 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0 || maxOutputBytes > 32 * 1024 * 1024) {
    throw new RangeError('Invalid XML worker limits');
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
    const flags = ['--max-old-space-size=256'];
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
      if (state.bytes > maxOutputBytes) { invalidate(state, 'xml-worker-output-limit'); return; }
      state.buffer += chunk;
      const end = state.buffer.indexOf('\n');
      if (end < 0) return;
      if (!state.pending || end !== state.buffer.length - 1) { invalidate(state, 'xml-worker-protocol'); return; }
      let response;
      try { response = JSON.parse(state.buffer.slice(0, end)); }
      catch { invalidate(state, 'xml-worker-protocol'); return; }
      if (response?.id !== state.pending.id || response.result?.schemaVersion !== 1 ||
          typeof response.result.complete !== 'boolean' || !Array.isArray(response.result.elements) || !Array.isArray(response.result.text) ||
          !Array.isArray(response.result.diagnostics)) { invalidate(state, 'xml-worker-protocol'); return; }
      const expectedKeys = state.pending.inlineRequested ? ['id', 'result', 'provider', 'inlineLua'] :
        state.pending.providerRequested ? ['id', 'result', 'provider'] : ['id', 'result'];
      if (Object.keys(response).length !== expectedKeys.length || expectedKeys.some(key => !Object.hasOwn(response, key))) {
        invalidate(state, 'xml-worker-protocol'); return;
      }
      if (state.pending.providerRequested) {
        const provider = response.provider;
        if (!provider || typeof provider !== 'object' || Array.isArray(provider) ||
            Object.keys(provider).length !== 2 || !Object.hasOwn(provider, 'attempted') || !Object.hasOwn(provider, 'result') ||
            typeof provider.attempted !== 'boolean' || provider.attempted !== response.result.complete ||
            (!provider.attempted && provider.result !== null) ||
            (provider.result !== null && (typeof provider.result !== 'object' || Array.isArray(provider.result)))) {
          invalidate(state, 'xml-worker-protocol'); return;
        }
      }
      if (state.pending.inlineRequested) {
        const inline = response.inlineLua;
        if (!inline || typeof inline !== 'object' || Array.isArray(inline) ||
            Object.keys(inline).length !== 3 || !['schemaVersion', 'status', 'bodies'].every(key => Object.hasOwn(inline, key)) ||
            inline.schemaVersion !== 1 || !['completed', 'rejected-before-inline', 'provider-blocked', 'resource', 'backend', 'invariant'].includes(inline.status) ||
            !Array.isArray(inline.bodies)) { invalidate(state, 'xml-worker-protocol'); return; }
      }
      const pending = state.pending;
      state.pending = null; state.buffer = ''; state.bytes = 0;
      clearTimeout(pending.timer);
      pending.resolve(pending.inlineRequested ? { syntax: response.result, provider: response.provider, inlineLua: response.inlineLua } :
        pending.providerRequested ? { syntax: response.result, provider: response.provider } : response.result);
    });
    child.on('error', () => invalidate(state, 'xml-worker-start'));
    child.stdin.on('error', () => invalidate(state, 'xml-worker-write'));
    child.on('exit', () => invalidate(state, 'xml-worker-exit'));
    return state;
  }
  return {
    analyze: function analyze(request) {
      if (closed) return Promise.reject(error('xml-worker-closed'));
      if (request !== null && typeof request === 'object' && Object.hasOwn(request, 'inlineOptions') && !Object.hasOwn(request, 'providerOptions')) {
        return Promise.reject(error('xml-worker-protocol'));
      }
      if (restarting || active?.pending) return Promise.reject(error('xml-worker-busy'));
      if (!active && children.size) {
        // A kill request is not a close/reap acknowledgement. Do not overlap
        // large parser isolates while a failed child is still retiring.
        restarting = true;
        return Promise.all([...children].map(state => state.done)).then(() => {
          restarting = false;
          return analyze(request);
        });
      }
      try { active ??= start(); }
      catch { return Promise.reject(error('xml-worker-start')); }
      const state = active;
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => invalidate(state, 'xml-worker-timeout'), timeoutMs);
        state.pending = { id, timer, resolve, reject, providerRequested: Object.hasOwn(request, 'providerOptions'),
          inlineRequested: Object.hasOwn(request, 'inlineOptions') };
        try {
          state.child.stdin.write(JSON.stringify({ ...request, id }) + '\n', issue => {
            if (issue) invalidate(state, 'xml-worker-write');
          });
        } catch { invalidate(state, 'xml-worker-write'); }
      });
    },
    async close() {
      closed = true;
      const states = [...children];
      for (const state of states) invalidate(state, 'xml-worker-closed');
      await Promise.all(states.map(state => state.done));
    },
  };
}
