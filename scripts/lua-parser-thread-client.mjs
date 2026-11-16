/** Internal transport; overrides are for isolated failure tests, never source data. */
import { Worker } from 'node:worker_threads';

export function createLuaParserThread({ maxOldGenerationSizeMb = 2048,
  workerPath = new URL('./lua-parser-thread.mjs', import.meta.url) } = {}) {
  if (!Number.isInteger(maxOldGenerationSizeMb) || maxOldGenerationSizeMb < 8 || maxOldGenerationSizeMb > 2048) {
    throw new RangeError('Invalid parser thread budget');
  }
  const worker = new Worker(workerPath, { execArgv: [],
    resourceLimits: { maxOldGenerationSizeMb, stackSizeMb: 8 } });
  let pending = null, closed = false, failed = false, sequence = 0;
  const done = new Promise(resolve => worker.once('exit', resolve));
  function fail() {
    failed = true;
    if (pending) { pending.reject(new Error('lua-parser-thread-failed')); pending = null; }
  }
  worker.on('error', fail);
  worker.on('exit', () => { if (!closed) fail(); });
  worker.on('message', response => {
    if (!pending || response?.id !== pending.id || response.result?.schemaVersion !== 1 ||
        typeof response.result.complete !== 'boolean' || !Array.isArray(response.result.declarations) ||
        !Array.isArray(response.result.diagnostics)) { fail(); void worker.terminate(); return; }
    const request = pending; pending = null; request.resolve(response.result);
  });
  return {
    analyze(request) {
      if (closed || failed) return Promise.reject(new Error('lua-parser-thread-failed'));
      if (pending) return Promise.reject(new Error('lua-parser-thread-busy'));
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        pending = { id, resolve, reject };
        try { worker.postMessage({ ...request, id }); }
        catch { fail(); void worker.terminate(); }
      });
    },
    async close() {
      closed = true; fail();
      await worker.terminate(); await done;
    },
  };
}
