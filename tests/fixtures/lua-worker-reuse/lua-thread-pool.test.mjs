import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setImmediate} from 'node:timers/promises';
import {test} from 'node:test';
import {createLuaThreadPool, requestLimit, unitLimit} from './lua-thread-pool.mjs';

const reply = (code = null) => ({
  result: {language: 'lua', result: {diagnostics: code ? [{code}] : []}},
  confirmedApiCalls: {}, failure: null,
});
const input = (id, units = 1) => ({id, content: 'x'.repeat(units)});

function harness() {
  const starts = [], events = [];
  let failures = 0;
  const pool = createLuaThreadPool({
    spawnThread() {
      const worker = new EventEmitter();
      worker.threadId = starts.length + 1;
      worker.sent = [];
      worker.postMessage = value => worker.sent.push(value);
      worker.terminate = () => {
        worker.terminating = true;
        return Promise.resolve(1); // An acknowledged request alone must not count as exit.
      };
      worker.respond = (id, result = reply()) => worker.emit('message', {id, reply: result});
      worker.reap = () => worker.emit('exit', 1);
      starts.push(worker);
      return worker;
    },
    observe: (event, id) => events.push([event, id]),
    onFault: () => failures++,
  });
  return {pool, starts, events, failed: () => failures};
}

test('confirmed exit is required before the eighth reply or any replacement', async () => {
  const {pool, starts, events} = harness();
  for (let i = 1; i < requestLimit; i++) {
    const prior = pool.analyze(input(i));
    starts[0].respond(i);
    assert.deepEqual(await prior, reply());
  }
  const final = pool.analyze(input(requestLimit));
  starts[0].respond(requestLimit);
  await setImmediate();
  assert.equal(starts[0].terminating, true);
  const winner = await Promise.race([final.then(() => 'credited'), setImmediate('still owned')]);
  assert.equal(winner, 'still owned');
  await assert.rejects(pool.analyze(input(requestLimit + 1)), /unavailable/);
  assert.equal(starts.length, 1);
  starts[0].reap();
  assert.deepEqual(await final, reply());
  const next = pool.analyze(input(requestLimit + 1));
  starts[1].respond(requestLimit + 1);
  await next;
  const closing = pool.close();
  starts[1].reap();
  await closing;
  assert.deepEqual(events, [['worker-start', 1], ['worker-exit', 1], ['worker-start', 2], ['worker-exit', 2]]);
});

test('cumulative overflow waits for the prior Worker before sending the new request', async () => {
  const {pool, starts} = harness();
  const first = pool.analyze(input(1, unitLimit - 1));
  starts[0].respond(1);
  await first;
  const next = pool.analyze(input(2, 2));
  assert.equal(starts.length, 1);
  assert.equal(starts[0].terminating, true);
  assert.deepEqual(starts[0].sent.map(row => row.id), [1]);
  starts[0].reap();
  await setImmediate();
  assert.equal(starts.length, 2);
  starts[1].respond(2);
  await next;
  const closing = pool.close();
  starts[1].reap();
  await closing;
});

test('ordinary Lua diagnostic keeps the Worker and resource diagnostic retires it before credit', async () => {
  const {pool, starts} = harness();
  const syntax = pool.analyze(input(1));
  starts[0].respond(1, reply('LUA0002'));
  assert.deepEqual(await syntax, reply('LUA0002'));
  const resource = pool.analyze(input(2));
  starts[0].respond(2, reply('LUA0003'));
  await setImmediate();
  assert.equal(starts[0].terminating, true);
  starts[0].reap();
  assert.deepEqual(await resource, reply('LUA0003'));
  await pool.close();
});

for (const [fault, interfere] of Object.entries({
  staleId: worker => worker.respond(0),
  malformed: worker => worker.emit('message', {id: 1}),
  adjacent: worker => {worker.respond(1); worker.respond(1);},
  error: worker => worker.emit('error', Error('authored worker fault')),
  exit: worker => worker.reap(),
})) {
  test(`fault ${fault} cannot credit a result or start another Worker`, async () => {
    const {pool, starts, failed} = harness();
    const work = pool.analyze(input(1));
    const rejected = assert.rejects(work, /Experimental|experimental/);
    interfere(starts[0]);
    if (fault !== 'exit') {
      await setImmediate();
      assert.equal(starts[0].terminating, true);
      starts[0].reap();
    }
    await rejected;
    await assert.rejects(pool.analyze(input(2)));
    assert.equal(starts.length, 1);
    assert.equal(failed(), 1);
    await pool.close();
  });
}

test('an idle duplicate poisons the owner and shutdown waits for actual exit', async () => {
  const {pool, starts, failed} = harness();
  const result = pool.analyze(input(1));
  starts[0].respond(1);
  await result;
  starts[0].respond(1);
  await assert.rejects(pool.analyze(input(2)));
  const closing = pool.close();
  assert.equal(failed(), 1);
  assert.equal(await Promise.race([closing.then(() => 'closed'), setImmediate('still owned')]), 'still owned');
  starts[0].reap();
  await closing;
});
