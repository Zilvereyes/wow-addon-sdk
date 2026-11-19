import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setImmediate} from 'node:timers/promises';
import {test} from 'node:test';
import {createCorpusLuaThread,createXmlThread} from '../scripts/selected-source-lua-thread.mjs';

const requestLimit = 8;
const unitLimit = 4_194_304;
const input = (id, content = 'x') => ({id, content});
const reply = (code = null) => ({
  result: {language: 'lua', result: {diagnostics: code ? [{code}] : []}},
  confirmedApiCalls: {analyzeLua: {invoked: 1, returned: 1}},
  failure: null,
});

function harness(createThread = createCorpusLuaThread, defaultReply = reply) {
  const starts = [];
  const lifecycle = [];
  let faults = 0;
  const pool = createThread({
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
      worker.respond = (id, result = defaultReply()) => worker.emit('message', {id, reply: result});
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

const xmlUnitLimit = 1024 * 1024;
const xmlInput = (id, content = 'x') => ({language: 'xml', id, content});
const diagnostics = code => code ? [{code}] : [];
const xmlReply = ({syntaxCode, providerCode, inlineCode, failure = null} = {}) => ({
  result: failure ? null : {
    language: 'xml',
    syntax: {complete: !syntaxCode, diagnostics: diagnostics(syntaxCode)},
    provider: syntaxCode ? null : {diagnostics: diagnostics(providerCode)},
    inline: inlineCode ? [
      {status: 'missing-context', analysis: null, mapping: null},
      {status: 'analyzed', analysis: {diagnostics: diagnostics(inlineCode)}},
    ] : [],
  },
  confirmedApiCalls: {parseXml: {invoked: 1, returned: 1}},
  failure,
});
const xmlHarness = () => harness(createXmlThread, xmlReply);

const workerOwners = [
  ['', harness, input, reply],
  ['XML ', xmlHarness, xmlInput, xmlReply],
];

for (const [label, openOwner, makeInput, makeReply] of workerOwners) {
  test(`${label}reuses the Worker through request eight and waits for exit before the eighth reply or replacement`, async () => {
    const {pool, starts, lifecycle, faults} = openOwner();
    for (let id = 1; id < requestLimit; id++) {
      const request = makeInput(id);
      const work = pool.analyze(request);
      assert.deepEqual(starts[0].sent.at(-1), request);
      starts[0].respond(id);
      assert.deepEqual(await work, makeReply());
      assert.equal(starts.length, 1);
      assert.equal(starts[0].terminationRequests, 0);
    }

    const last = pool.analyze(makeInput(requestLimit));
    starts[0].respond(requestLimit);
    assert.equal(await unsettled(last), true);
    assert.equal(starts[0].terminationRequests, 1);
    await assert.rejects(pool.analyze(makeInput(requestLimit + 1)));
    assert.equal(starts.length, 1);
    starts[0].reap();
    assert.deepEqual(await last, makeReply());

    const next = pool.analyze(makeInput(requestLimit + 1));
    starts[1].respond(requestLimit + 1);
    assert.deepEqual(await next, makeReply());
    const close = pool.close();
    assert.equal(await unsettled(close), true);
    assert.equal(starts[1].terminationRequests, 1);
    starts[1].reap();
    await close;
    assert.deepEqual(lifecycle, [['start', 1], ['exit', 1], ['start', 2], ['exit', 2]]);
    assert.equal(faults(), 0);
  });
}

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

for (const [boundary, finalFile, nextFile] of [
  ['exact', 'x'.repeat(xmlUnitLimit - 2) + '🙂', null],
  ['overflow', 'x'.repeat(xmlUnitLimit - 1), '🙂'],
]) {
  test(`XML counts cumulative UTF-16 units at the ${boundary} boundary across legal individual files`, async () => {
    const {pool, starts, lifecycle} = xmlHarness();
    const oneMi = 'x'.repeat(xmlUnitLimit);
    for (const [index, content] of [oneMi, oneMi, oneMi, finalFile].entries()) {
      assert.ok(content.length <= xmlUnitLimit);
      const id = index + 1;
      const work = pool.analyze(xmlInput(id, content));
      assert.equal(starts.length, 1);
      starts[0].respond(id);
      if (boundary === 'exact' && id === 4) {
        assert.equal(await unsettled(work), true);
        assert.equal(starts[0].terminationRequests, 1);
        starts[0].reap();
      }
      assert.deepEqual(await work, xmlReply());
    }

    if (nextFile) {
      assert.equal(starts[0].terminationRequests, 0);
      const next = pool.analyze(xmlInput(5, nextFile));
      assert.equal(await unsettled(next), true);
      assert.equal(starts.length, 1);
      assert.equal(starts[0].terminationRequests, 1);
      assert.deepEqual(starts[0].sent.map(row => row.id), [1, 2, 3, 4]);
      starts[0].reap();
      await setImmediate();
      assert.deepEqual(starts[1].sent.map(row => row.id), [5]);
      starts[1].respond(5);
      assert.deepEqual(await next, xmlReply());
      const close = pool.close();
      starts[1].reap();
      await close;
      assert.deepEqual(lifecycle, [['start', 1], ['exit', 1], ['start', 2], ['exit', 2]]);
    } else {
      await pool.close();
      assert.deepEqual(lifecycle, [['start', 1], ['exit', 1]]);
    }
  });
}

test('ordinary XML and inline Lua syntax diagnostics retain the Worker', async () => {
  const {pool, starts, faults} = xmlHarness();
  for (const [index, outcome] of [
    xmlReply({syntaxCode: 'XML0002'}),
    xmlReply({inlineCode: 'LUA0002'}),
  ].entries()) {
    const id = index + 1;
    const work = pool.analyze(xmlInput(id));
    assert.equal(starts.length, 1);
    starts[0].respond(id, outcome);
    assert.deepEqual(await work, outcome);
    assert.equal(starts[0].terminationRequests, 0);
  }
  assert.equal(faults(), 0);
  const close = pool.close();
  assert.equal(await unsettled(close), true);
  starts[0].reap();
  await close;
});

for (const [code, outcome] of [
  ['XML0003', xmlReply({syntaxCode: 'XML0003'})],
  ['XML0005', xmlReply({syntaxCode: 'XML0005'})],
  ['XUI0003', xmlReply({providerCode: 'XUI0003'})],
  ['XUI0002', xmlReply({providerCode: 'XUI0002'})],
  ['inline LUA0003', xmlReply({inlineCode: 'LUA0003'})],
  ['inline LUA0005', xmlReply({inlineCode: 'LUA0005'})],
  ['whole resource failure', xmlReply({failure: 'resource'})],
  ['whole backend failure', xmlReply({failure: 'backend'})],
  ['whole invariant failure', xmlReply({failure: 'invariant'})],
]) {
  test(`${code} waits for XML Worker exit before reply credit`, async () => {
    const {pool, starts, lifecycle, faults} = xmlHarness();
    const work = pool.analyze(xmlInput(1));
    starts[0].respond(1, outcome);
    assert.equal(await unsettled(work), true);
    assert.equal(starts[0].terminationRequests, 1);
    await assert.rejects(pool.analyze(xmlInput(2)));
    assert.equal(starts.length, 1);
    starts[0].reap();
    assert.deepEqual(await work, outcome);
    assert.equal(faults(), 0);
    await pool.close();
    assert.deepEqual(lifecycle, [['start', 1], ['exit', 1]]);
  });
}

const faultCases = {
  stale: worker => worker.respond(0),
  malformed: worker => worker.emit('message', {id: 1}),
  adjacent: worker => {worker.respond(1); worker.respond(1);},
  error: worker => worker.emit('error', Error('authored Worker error')),
  exit: worker => worker.reap(),
};
for (const [label, openOwner, makeInput] of workerOwners) {
  for (const [fault, interfere] of Object.entries(faultCases)) {
    test(`a ${fault} ${label}Worker fault gives no reply credit and never starts a replacement`, async () => {
      const {pool, starts, faults} = openOwner();
      const work = pool.analyze(makeInput(1));
      const rejected = assert.rejects(work);
      interfere(starts[0]);
      if (fault !== 'exit') {
        await setImmediate();
        assert.equal(starts[0].terminationRequests, 1);
        await assert.rejects(pool.analyze(makeInput(2)));
        starts[0].reap();
      }
      await rejected;
      await assert.rejects(pool.analyze(makeInput(3)));
      assert.equal(starts.length, 1);
      assert.equal(faults(), 1);
      await pool.close();
    });
  }
}

for (const [label, openOwner, makeInput] of workerOwners) {
  test(`${label}idle duplicate prevents further work and shutdown still waits for confirmed exit`, async () => {
    const {pool, starts, faults} = openOwner();
    const work = pool.analyze(makeInput(1));
    starts[0].respond(1);
    await work;
    starts[0].respond(1);
    await assert.rejects(pool.analyze(makeInput(2)));
    const close = pool.close();
    assert.equal(await unsettled(close), true);
    assert.equal(faults(), 1);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].terminationRequests, 1);
    starts[0].reap();
    await close;
  });

  test(`${label}close during an active request suppresses credit and waits for confirmed exit`, async () => {
    const {pool, starts} = openOwner();
    const work = pool.analyze(makeInput(1));
    const rejected = assert.rejects(work);
    const close = pool.close();
    assert.equal(await unsettled(close), true);
    assert.equal(starts[0].terminationRequests, 1);
    starts[0].reap();
    await rejected;
    await close;
    await assert.rejects(pool.analyze(makeInput(2)));
    assert.equal(starts.length, 1);
  });
}
