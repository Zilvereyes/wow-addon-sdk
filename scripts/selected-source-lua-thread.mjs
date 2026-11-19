/** Sequential Worker ownership for the corpus Lua launcher. */
const requestLimit = 8;
const unitLimit = 4_194_304;

export function createCorpusLuaThread({spawnThread, onFault}) {
  let current;
  let fault;
  let closed = false;
  let busy = false;

  function fail(message) {
    if (fault || closed) return;
    fault = Error(message);
    current?.pending?.reject(fault);
    onFault();
  }

  function start() {
    const worker = spawnThread();
    const state = {worker, requests: 0, units: 0, pending: null, exited: false, retirement: null};
    current = state;
    state.done = new Promise(resolve => worker.once('exit', () => {
      state.exited = true;
      if (!state.retirement) fail('Corpus Lua Worker exited unexpectedly.');
      resolve();
    }));
    worker.on('error', () => fail('Corpus Lua Worker failed.'));
    worker.on('message', message => {
      const pending = state.pending;
      if (!pending || pending.received || message === null || typeof message !== 'object' ||
          Object.keys(message).length !== 2 || !Object.hasOwn(message, 'id') ||
          !Object.hasOwn(message, 'reply') || message.id !== pending.id) {
        fail('Unexpected corpus Lua Worker response.');
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
    state.retirement ??= Promise.resolve().then(async () => {
      if (!state.exited) await state.worker.terminate();
      await state.done;
      if (current === state) current = undefined;
    });
    await state.retirement;
  }

  return {
    async analyze(request) {
      if (fault || closed || busy) throw fault ?? Error('Corpus Lua Worker is unavailable.');
      busy = true;
      try {
        const units = request.content.length;
        if (current && current.units + units > unitLimit) await retire();
        if (fault || closed) throw fault ?? Error('Corpus Lua Worker is closed.');
        const state = current ?? start();
        state.requests++;
        state.units += units;
        const reply = await new Promise((resolve, reject) => {
          state.pending = {id: request.id, resolve, reject};
          state.worker.postMessage(request);
        });
        // The parent still validates the complete reply against its request.
        if (state.requests === requestLimit || state.units >= unitLimit || reply.failure !== null ||
            reply.result.result.diagnostics.some(row => row.code === 'LUA0003' || row.code === 'LUA0005')) await retire(state);
        if (fault || closed) throw fault ?? Error('Corpus Lua Worker is closed.');
        return reply;
      } catch (error) {
        fail('Corpus Lua Worker transport failed.');
        await retire();
        throw error;
      } finally { busy = false; }
    },
    async close() {
      closed = true;
      current?.pending?.reject(Error('Corpus Lua Worker is closed.'));
      await retire();
    },
  };
}
