/** Experiment-only sequential Worker owner. The graph supervisor owns the real deadline. */
export const requestLimit = 8;
export const unitLimit = 4_194_304;

export function createLuaThreadPool({spawnThread, observe, onFault}) {
  let current, fault, closed = false, busy = false;

  function fail(message) {
    if (!fault) {
      fault = Error(message);
      current?.pending?.reject(fault);
      onFault?.();
    }
  }

  function start() {
    const worker = spawnThread();
    const state = {worker, threadId: worker.threadId, requests: 0, units: 0, pending: null,
      retiring: false, exited: false, done: null, retirement: null};
    current = state;
    observe('worker-start', state.threadId);
    state.done = new Promise(resolve => worker.once('exit', () => {
      state.exited = true;
      observe('worker-exit', state.threadId);
      if (!state.retiring) fail('Experimental Lua Worker exited unexpectedly.');
      resolve();
    }));
    worker.on('error', () => fail('Experimental Lua Worker failed.'));
    worker.on('message', message => {
      const pending = state.pending;
      if (!pending || pending.received || message === null || typeof message !== 'object' ||
          Object.keys(message).length !== 2 || !Object.hasOwn(message, 'id') ||
          !Object.hasOwn(message, 'reply') || message.id !== pending.id) {
        fail('Unexpected experimental Lua Worker frame.');
        return;
      }
      pending.received = true;
      setImmediate(() => {
        if (state.pending !== pending || fault || closed) return;
        state.pending = null;
        pending.resolve(message.reply);
      });
    });
    return state;
  }

  async function retire(state = current) {
    if (!state) return;
    if (!state.retirement) {
      state.retiring = true;
      state.retirement = (async () => {
        if (!state.exited) await state.worker.terminate();
        await state.done;
        if (current === state) current = undefined;
      })();
    }
    await state.retirement;
  }

  return {
    async analyze(request) {
      if (closed || fault || busy) throw fault ?? Error('Experimental Lua Worker is unavailable.');
      busy = true;
      try {
        const units = request.content.length;
        if (current && current.units + units > unitLimit) await retire();
        if (fault || closed) throw fault ?? Error('Experimental Lua Worker is closed.');
        const state = current ?? start();
        state.requests++;
        state.units += units;
        const reply = await new Promise((resolve, reject) => {
          state.pending = {id: request.id, resolve, reject};
          state.worker.postMessage(request);
        });
        if (state.requests >= requestLimit || state.units >= unitLimit || reply.failure !== null ||
            reply.result.result.diagnostics.some(row => row.code === 'LUA0003' || row.code === 'LUA0005')) await retire(state);
        if (fault || closed) throw fault ?? Error('Experimental Lua Worker is closed.');
        return reply;
      } catch (error) {
        fail('Experimental Lua Worker transport failed.');
        await retire();
        throw error;
      } finally {busy = false;}
    },
    async close() {
      closed = true;
      current?.pending?.reject(Error('Experimental Lua Worker is closed.'));
      await retire();
    },
  };
}
