import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {EventEmitter, once} from 'node:events';
import {readFileSync} from 'node:fs';
import {PassThrough, Writable} from 'node:stream';
import {setImmediate} from 'node:timers/promises';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const xmlPolicy = json('../examples/xml-provider-profile.json').policy;
const inlineProfile = json('../examples/xml-inline-lua-profile.json');
const request = (number = 1) => ({language: 'lua', content: 'Authored' + number + '="😀"',
  sourcePath: 'Fixture/Source😀' + number + '.lua', addonId: 'authored-launcher-fixture', conditions: [],
  luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile});

function receipts(returned = 1) {
  const calls = emptyGraphCalls();
  calls.analyzeLua = {invoked: 1, returned};
  return calls;
}
function expected(input) {
  return {result: {language: 'lua', result: analyzeLua(input.content, input.sourcePath, {
    addonId: input.addonId, conditions: input.conditions, profile: input.luaProfile,
    allowShebang: input.allowShebang, context: {kind: 'chunk'},
  })}, confirmedApiCalls: receipts()};
}
const frame = (input, fields = {}) => Buffer.from(JSON.stringify({
  id: input.id, ...expected(input), failure: null, ...fields,
}) + '\n');

function fakeLauncher(deliver, options = {}) {
  const launches = [], events = new EventEmitter();
  const client = createGraphAnalyzer({timeoutMs: 2000, ...options, spawnProcess(executable, args, spawnOptions) {
    const child = new EventEmitter();
    child.exitCode = child.signalCode = null;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const launch = {child, executable, args, options: spawnOptions, requests: [], signals: [], closed: false,
      acknowledge(code = 0) {
        if (this.closed) return;
        this.closed = true;
        child.exitCode = code;
        child.emit('close', code, child.signalCode);
      }};
    launches.push(launch);
    child.stdin = new Writable({write(chunk, _encoding, done) {
      const input = JSON.parse(chunk.toString());
      launch.requests.push(input);
      done();
      queueMicrotask(() => {
        deliver(launch, input);
        events.emit('request', launch, input);
      });
    }});
    child.kill = signal => {
      launch.signals.push(signal);
      child.signalCode = signal;
      return true;
    };
    return child;
  }});
  return {client, launches, events, async close() {
    const closing = client.close();
    for (const launch of launches) launch.acknowledge();
    await closing;
  }};
}

function withoutReceipts(code) {
  return error => {
    assert.equal(error.message, code);
    assert.equal(Object.hasOwn(error, 'confirmedApiCalls'), false);
    return true;
  };
}

test('corpus launcher handles 32 serial requests and requires close before rotation', async () => {
  const harness = fakeLauncher(({child}, input) => {
    const reply = frame(input);
    // Split a UTF-8 character across chunks. Decoding happens once the frame is complete.
    const split = reply.indexOf(Buffer.from('😀')) + 1;
    assert.ok(split > 0);
    child.stdout.write(reply.subarray(0, split));
    child.stdout.write(reply.subarray(split));
  });
  const {client, launches, events} = harness;
  try {
    for (let number = 1; number < 32; number++) {
      const input = request(number);
      assert.deepEqual(await client.analyze(input), expected(input));
    }
    assert.equal(launches.length, 1);
    const [first] = launches;
    assert.equal(first.executable, process.execPath);
    assert.equal(first.args[0], '--max-old-space-size=2048');
    assert.match(first.args[1], /selected-source-analysis-worker\.mjs$/u);
    assert.deepEqual(first.args.slice(2), ['--corpus-launcher']);
    assert.equal(first.options.shell, false);
    assert.equal(first.options.windowsHide, true);
    assert.equal(Object.hasOwn(first.options.env, 'NODE_OPTIONS'), false);

    const written = once(events, 'request');
    const last = client.analyze(request(32));
    let settled = false;
    last.then(() => { settled = true; }, () => { settled = true; });
    await written;
    await setImmediate();
    assert.equal(settled, false);
    assert.deepEqual(first.requests.map(input => input.id), Array.from({length: 32}, (_, index) => index + 1));
    await assert.rejects(client.analyze(request(33)), /graph-analysis-busy/u);
    assert.equal(launches.length, 1);
    assert.deepEqual(first.signals, []);
    first.acknowledge();
    assert.deepEqual(await last, expected(request(32)));

    assert.deepEqual(await client.analyze(request(33)), expected(request(33)));
    assert.equal(launches.length, 2);
    assert.deepEqual(launches[1].requests.map(input => input.id), [33]);
  } finally { await harness.close(); }
});

test('late corpus response is not credited and an unreaped launcher prevents replacement', async () => {
  let clock = 0;
  const harness = fakeLauncher(({child}, input) => {
    if (input.id === 1) clock = 3;
    child.stdout.write(frame(input));
  }, {now: () => clock});
  const {client, launches} = harness;
  try {
    await assert.rejects(client.analyze(request(), 2), withoutReceipts('graph-analysis-timeout'));
    const [first] = launches;
    assert.deepEqual(first.signals, ['SIGKILL']);
    assert.equal(first.requests.length, 1);
    assert.equal(first.closed, false);
    await assert.rejects(client.analyze(request(), 1), withoutReceipts('graph-analysis-timeout'));
    assert.equal(launches.length, 1);
    assert.equal(first.requests.length, 1);
    first.acknowledge(null);
    assert.deepEqual(await client.analyze(request()), expected(request()));
    assert.equal(launches.length, 2);
    assert.equal(launches[1].requests.length, 1);
  } finally { await harness.close(); }
});

test('an idle launcher exit blocks new writes and replacement until direct close', async () => {
  const harness = fakeLauncher(({child}, input) => child.stdout.write(frame(input)));
  const {client, launches} = harness;
  try {
    assert.deepEqual(await client.analyze(request()), expected(request()));
    const [first] = launches;
    first.child.exitCode = 0;
    first.child.emit('exit', 0, null);

    const input = request(2);
    const next = assert.rejects(client.analyze(input), withoutReceipts('graph-analysis-exit'));
    let settled = false;
    next.then(() => { settled = true; }, () => { settled = true; });
    await setImmediate();
    assert.equal(settled, false);
    assert.equal(launches.length, 1);
    assert.equal(first.requests.length, 1);
    assert.equal(first.closed, false);

    first.acknowledge();
    await next;
    assert.equal(launches.length, 1);
    assert.deepEqual(await client.analyze(input), expected(input));
    assert.equal(launches.length, 2);
    assert.equal(launches[1].requests.length, 1);
  } finally { await harness.close(); }
});

for (const [label, act, code] of [
  ['malformed UTF-8', ({child}) => child.stdout.write(Buffer.from([0xff, 10])), 'graph-analysis-invariant'],
  ['a stale ID', ({child}, input) => child.stdout.write(frame(input, {id: input.id - 1})), 'graph-analysis-invariant'],
  ['an extra frame', ({child}, input) => child.stdout.write(Buffer.concat([frame(input), Buffer.from('{}\n')])), 'graph-analysis-invariant'],
  ['adjacent frames in separate chunks', ({child}, input) => {
    child.stdout.write(frame(input));
    child.stdout.write(Buffer.from('{}\n'));
  }, 'graph-analysis-invariant'],
  ['unexpected EOF after an interim frame', ({child}, input) => child.stdout.end(frame(input)), 'graph-analysis-exit'],
  ['EOF before a response', launch => launch.acknowledge(), 'graph-analysis-exit'],
]) {
  test('corpus launcher rejects ' + label + ' and permits recovery only with a new child', async () => {
    let failed = false;
    const harness = fakeLauncher((launch, input) => {
      if (!failed) { failed = true; act(launch, input); }
      else launch.child.stdout.write(frame(input));
    });
    const {client, launches} = harness;
    try {
      await assert.rejects(client.analyze(request()), withoutReceipts(code));
      assert.equal(launches.length, 1);
      const [first] = launches;
      assert.equal(first.requests.length, 1);
      if (!first.closed) {
        assert.deepEqual(first.signals, ['SIGKILL']);
        first.acknowledge(null);
      }
      assert.deepEqual(await client.analyze(request(2)), expected(request(2)));
      assert.equal(launches.length, 2);
    } finally { await harness.close(); }
  });
}

test('verified corpus failure retains its receipt after close and retires the launcher', async () => {
  const harness = fakeLauncher(({child}, input) => {
    const reply = input.id === 1 ? frame(input, {result: null, confirmedApiCalls: receipts(0), failure: 'backend'}) : frame(input);
    child.stdout.write(reply);
  });
  const {client, launches, events} = harness;
  try {
    const written = once(events, 'request');
    const failure = assert.rejects(client.analyze(request()), error => {
      assert.equal(error.message, 'graph-analysis-backend');
      assert.deepEqual(error.confirmedApiCalls, receipts(0));
      return true;
    });
    const [first] = await written;
    first.acknowledge();
    await failure;
    assert.deepEqual(await client.analyze(request(2)), expected(request(2)));
    assert.equal(launches.length, 2);
  } finally { await harness.close(); }
});

test('corpus response cap resets per request and idle output retires the launcher', async () => {
  const maxOutputBytes = frame({...request(), id: 1}).length;
  const harness = fakeLauncher(({child}, input) => {
    child.stdout.write(input.id === 3 ? Buffer.alloc(maxOutputBytes + 1, 120) : frame(input));
  }, {maxOutputBytes});
  const {client, launches} = harness;
  try {
    const input = request();
    assert.deepEqual(await client.analyze(input), expected(input));
    assert.deepEqual(await client.analyze(input), expected(input));
    assert.equal(launches.length, 1);
    await assert.rejects(client.analyze(input), withoutReceipts('graph-analysis-output-limit'));
    const [first] = launches;
    assert.deepEqual(first.signals, ['SIGKILL']);
    first.acknowledge(null);

    assert.deepEqual(await client.analyze(input), expected(input));
    assert.equal(launches.length, 2);
    const second = launches[1];
    second.child.stdout.write(Buffer.from('unsolicited'));
    assert.deepEqual(second.signals, ['SIGKILL']);
    await assert.rejects(client.analyze(input, 1), withoutReceipts('graph-analysis-timeout'));
    assert.equal(launches.length, 2);
    second.acknowledge(null);
    await assert.rejects(client.analyze(input), withoutReceipts('graph-analysis-invariant'));
    assert.equal(launches.length, 2);
    assert.deepEqual(await client.analyze(input), expected(input));
    assert.equal(launches.length, 3);
  } finally { await harness.close(); }
});

const threadEventMarker = 'graph-thread-event:';
const threadObserver = 'data:text/javascript;base64,' + Buffer.from(String.raw`
import { createRequire, syncBuiltinESMExports } from 'node:module';
const threads = createRequire(process.argv[1])('node:worker_threads');
const emit = row => process.stderr.write('graph-thread-event:' + JSON.stringify(row) + '\n');
const assertCorpusWorkerData = value => { if (value !== null) throw Error('Expected a reusable corpus Lua Worker.'); };
threads.Worker = class ObservedWorker extends threads.Worker {
  constructor(entry, options) {
    super(entry, options);
    assertCorpusWorkerData(options.workerData);
    const threadId = this.threadId;
    const { maxOldGenerationSizeMb, stackSizeMb } = this.resourceLimits;
    emit(['create', threadId, maxOldGenerationSizeMb, stackSizeMb]);
    this.once('exit', () => emit(['exit', threadId]));
  }
  postMessage(request, ...args) {
    emit(['dispatch', request.id, this.threadId]);
    return super.postMessage(request, ...args);
  }
};
syncBuiltinESMExports();
const write = process.stdout.write;
process.stdout.write = function(frame, ...args) {
  emit(['reply', JSON.parse(frame).id]);
  return write.call(this, frame, ...args);
};
`).toString('base64');

test('real corpus process reuses bounded parser threads and rotates after 32 files', async () => {
  const children = [], closed = new Set(), eventText = new Map();
  const client = createGraphAnalyzer({spawnProcess(executable, args, options) {
    assert.ok(children.every(child => closed.has(child)));
    const child = spawn(executable, ['--import', threadObserver, ...args], options);
    eventText.set(child, '');
    child.stderr.setEncoding('utf8').on('data', chunk => eventText.set(child, eventText.get(child) + chunk));
    child.once('close', () => closed.add(child));
    children.push(child);
    return child;
  }});
  try {
    for (let number = 1; number <= 33; number++) {
      const input = number === 2 ? {...request(2), content: 'if then'} : request(number);
      assert.deepEqual(await client.analyze(input), expected(input));
      if (number === 32) {
        assert.equal(children.length, 1);
        assert.equal(closed.size, 1);
      }
    }
    assert.equal(children.length, 2);
    const bounded = {...request(34), luaProfile: 'bounded'};
    assert.deepEqual(await client.analyze(bounded), expected(bounded));
    assert.equal(children.length, 3);
  } finally { await client.close(); }
  assert.equal(closed.size, children.length);
  const parseEvents = child => eventText.get(child).split(/\r?\n/u)
    .filter(line => line.startsWith(threadEventMarker))
    .map(line => JSON.parse(line.slice(threadEventMarker.length)));
  for (const [index, firstId, count] of [[0, 1, 32], [1, 33, 1]]) {
    const events = parseEvents(children[index]);
    const threadIds = new Set();
    let threadId;
    for (let offset = 0; offset < count; offset++) {
      const id = firstId + offset;
      if (offset % 8 === 0) {
        const created = events.shift();
        threadId = created[1];
        assert.ok(Number.isSafeInteger(threadId) && threadId > 0 && !threadIds.has(threadId));
        threadIds.add(threadId);
        assert.deepEqual(created, ['create', threadId, 2048, 8]);
      }
      assert.deepEqual(events.shift(), ['dispatch', id, threadId]);
      if (offset % 8 === 7) assert.deepEqual(events.shift(), ['exit', threadId]);
      assert.deepEqual(events.shift(), ['reply', id]);
    }
    if (count % 8 !== 0) assert.deepEqual(events.shift(), ['exit', threadId]);
    assert.deepEqual(events, []);
  }
  assert.deepEqual(parseEvents(children[2]), [['reply', 34]]);
});
