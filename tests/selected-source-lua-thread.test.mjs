import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setImmediate} from 'node:timers/promises';
import {test} from 'node:test';
import {createCorpusLuaThread} from '../scripts/selected-source-lua-thread.mjs';

const requestLimit = 8;
const unitLimit = 4_194_304;
const input = (id, content = 'x') => ({id, content});
const reply = (code = null) => ({
  result: {language: 'lua', result: {diagnostics: code ? [{code}] : []}},
  confirmedApiCalls: {analyzeLua: {invoked: 1, returned: 1}},
  failure: null,
});

function harness() {
  const starts = [];
  const lifecycle = [];
  let faults = 0;
  const pool = createCorpusLuaThread({
    spawnThread() {
      const worker = new EventEmitter();
      worker.threadId = starts.length + 1;
      worker.sent = [];
      worker.terminationRequests = 0;
      worker.postMessage = value => worker.sent.push(value);
      worker.terminate = () => {
        worker.terminationRequests++;
        // An already-resolved termination request leaves the exit event independently observable.
        return Promise.resolve(1);
      };
      worker.respond = (id, result = reply()) => worker.emit('message', {id, reply: result});
      worker.reap = () => {
        lifecycle.push(['exit', worker.threadId]);
        worker.emit('exit', 1);
      };
      lifecycle.push(['start', worker.threadId]);
      starts.push(worker);
      return worker;
    },
    onFault: () => faults++,
  });
  return {pool, starts, lifecycle, faults: () => faults};
}

async function unsettled(promise) {
  const settled = promise.then(() => false, () => false);
  return Promise.race([settled, setImmediate(true)]);
}

test('reuses the Worker through request eight and waits for exit before the eighth reply or replacement', async () => {
  const {pool, starts, lifecycle, faults} = harness();
  for (let id = 1; id < requestLimit; id++) {
    const request = input(id);
    const work = pool.analyze(request);
    assert.deepEqual(starts[0].sent.at(-1), request);
    starts[0].respond(id);
    assert.deepEqual(await work, reply());
    assert.equal(starts.length, 1);
    assert.equal(starts[0].terminationRequests, 0);
  }

  const last = pool.analyze(input(requestLimit));
  starts[0].respond(requestLimit);
  assert.equal(await unsettled(last), true);
  assert.equal(starts[0].terminationRequests, 1);
  await assert.rejects(pool.analyze(input(requestLimit + 1)));
  assert.equal(starts.length, 1);
  starts[0].reap();
  assert.deepEqual(await last, reply());

  const next = pool.analyze(input(requestLimit + 1));
  starts[1].respond(requestLimit + 1);
  assert.deepEqual(await next, reply());
  const close = pool.close();
  assert.equal(await unsettled(close), true);
  assert.equal(starts[1].terminationRequests, 1);
  starts[1].reap();
  await close;
  assert.deepEqual(lifecycle, [['start', 1], ['exit', 1], ['start', 2], ['exit', 2]]);
  assert.equal(faults(), 0);
});

test('measures UTF-16 units and retires after a reply reaching the cumulative cap exactly', async () => {
  const {pool, starts} = harness();
  const first = pool.analyze(input(1, 'a'.repeat(unitLimit - 2)));
  starts[0].respond(1);
  await first;
  const boundary = pool.analyze(input(2, '🙂'));
  assert.equal(starts.length, 1);
  starts[0].respond(2);
  assert.equal(await unsettled(boundary), true);
  assert.equal(starts[0].terminationRequests, 1);
  starts[0].reap();
  assert.deepEqual(await boundary, reply());
  await pool.close();
});

test('cumulative overflow waits for exit before sending on a replacement Worker', async () => {
  const {pool, starts, lifecycle} = harness();
  const first = pool.analyze(input(1, 'a'.repeat(unitLimit - 1)));
  starts[0].respond(1);
  await first;
  const next = pool.analyze(input(2, '🙂'));
  assert.equal(await unsettled(next), true);
  assert.equal(starts.length, 1);
  assert.equal(starts[0].terminationRequests, 1);
  assert.deepEqual(starts[0].sent.map(row => row.id), [1]);
  starts[0].reap();
  await setImmediate();
  assert.equal(starts.length, 2);
  starts[1].respond(2);
  assert.deepEqual(await next, reply());
  const close = pool.close();
  starts[1].reap();
  await close;
  assert.deepEqual(lifecycle, [['start', 1], ['exit', 1], ['start', 2], ['exit', 2]]);
});

test('an input above the reuse cap receives a dedicated Worker and waits for its exit', async () => {
  const {pool, starts, lifecycle} = harness();
  const warm = pool.analyze(input(1));
  starts[0].respond(1);
  await warm;
  const large = pool.analyze(input(2, 'a'.repeat(unitLimit + 1)));
  assert.equal(await unsettled(large), true);
  assert.equal(starts.length, 1);
  assert.equal(starts[0].terminationRequests, 1);
  starts[0].reap();
  await setImmediate();
  assert.deepEqual(starts[1].sent.map(row => row.id), [2]);

  starts[1].respond(2);
  assert.equal(await unsettled(large), true);
  assert.equal(starts[1].terminationRequests, 1);
  starts[1].reap();
  assert.deepEqual(await large, reply());

  const next = pool.analyze(input(3));
  starts[2].respond(3);
  await next;
  const close = pool.close();
  starts[2].reap();
  await close;
  assert.deepEqual(lifecycle, [
    ['start', 1], ['exit', 1], ['start', 2], ['exit', 2], ['start', 3], ['exit', 3],
  ]);
});

for (const resourceCode of ['LUA0003', 'LUA0005']) {
  test(`ordinary syntax diagnostics keep the Worker and ${resourceCode} retires it before credit`, async () => {
    const {pool, starts} = harness();
    const syntax = pool.analyze(input(1));
    starts[0].respond(1, reply('LUA0002'));
    assert.deepEqual(await syntax, reply('LUA0002'));
    assert.equal(starts[0].terminationRequests, 0);

    const resource = pool.analyze(input(2));
    starts[0].respond(2, reply(resourceCode));
    assert.equal(await unsettled(resource), true);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].terminationRequests, 1);
    starts[0].reap();
    assert.deepEqual(await resource, reply(resourceCode));
    await pool.close();
  });
}

for (const [fault, interfere] of Object.entries({
  stale: worker => worker.respond(0),
  malformed: worker => worker.emit('message', {id: 1}),
  adjacent: worker => {worker.respond(1); worker.respond(1);},
  error: worker => worker.emit('error', Error('authored Worker error')),
  exit: worker => worker.reap(),
})) {
  test(`a ${fault} Worker fault gives no reply credit and never starts a replacement`, async () => {
    const {pool, starts, faults} = harness();
    const work = pool.analyze(input(1));
    const rejected = assert.rejects(work);
    interfere(starts[0]);
    if (fault !== 'exit') {
      await setImmediate();
      assert.equal(starts[0].terminationRequests, 1);
      await assert.rejects(pool.analyze(input(2)));
      starts[0].reap();
    }
    await rejected;
    await assert.rejects(pool.analyze(input(3)));
    assert.equal(starts.length, 1);
    assert.equal(faults(), 1);
    await pool.close();
  });
}

test('an idle duplicate prevents further work and shutdown still waits for confirmed exit', async () => {
  const {pool, starts, faults} = harness();
  const work = pool.analyze(input(1));
  starts[0].respond(1);
  await work;
  starts[0].respond(1);
  await assert.rejects(pool.analyze(input(2)));
  const close = pool.close();
  assert.equal(await unsettled(close), true);
  assert.equal(faults(), 1);
  assert.equal(starts.length, 1);
  assert.equal(starts[0].terminationRequests, 1);
  starts[0].reap();
  await close;
});

test('close during an active request suppresses credit and waits for confirmed exit', async () => {
  const {pool, starts} = harness();
  const work = pool.analyze(input(1));
  const rejected = assert.rejects(work);
  const close = pool.close();
  assert.equal(await unsettled(close), true);
  assert.equal(starts[0].terminationRequests, 1);
  starts[0].reap();
  await rejected;
  await close;
  await assert.rejects(pool.analyze(input(2)));
  assert.equal(starts.length, 1);
});
