import assert from 'node:assert/strict';
import {EventEmitter, once} from 'node:events';
import {readFileSync} from 'node:fs';
import {PassThrough, Writable} from 'node:stream';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {parseToc} from '@wow-addon/toc-parser';
import {createGraphAnalyzer} from './scripts/prototype-analysis-client.mjs';
import {emptyGraphCalls} from './scripts/selected-source-analysis-receipts.mjs';

const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const xmlPolicy = json('./examples/xml-provider-profile.json').policy;
const inlineProfile = json('./examples/xml-inline-lua-profile.json');
const request = (language, luaProfile = 'corpus') => ({
  language,
  content: language === 'lua' ? 'AuthoredGlobal = "😀"' : '## Interface: 11509\r\nLibrary.lua\r\n',
  sourcePath: 'Authored/Parser.' + language,
  addonId: 'authored-prototype-fault',
  conditions: [],
  luaProfile,
  allowShebang: false,
  xmlPolicy,
  inlineProfile,
});

function expected(input) {
  const {language, content, sourcePath, addonId, conditions, luaProfile, allowShebang} = input;
  const confirmedApiCalls = emptyGraphCalls();
  let result;
  if (language === 'lua') {
    result = {language, result: analyzeLua(content, sourcePath, {
      addonId, conditions, profile: luaProfile, allowShebang, context: {kind: 'chunk'},
    })};
    confirmedApiCalls.analyzeLua = {invoked: 1, returned: 1};
  } else {
    assert.equal(language, 'toc');
    result = {language, parsed: parseToc(content, sourcePath)};
    confirmedApiCalls.parseToc = {invoked: 1, returned: 1};
  }
  return {result, confirmedApiCalls};
}

function frame(input, overrides = {}) {
  return Buffer.from(JSON.stringify({id: input.id, ...expected(input), failure: null, ...overrides}) + '\n');
}

function withoutReceipt(code) {
  return error => {
    assert.equal(error.message, 'graph-analysis-' + code);
    assert.equal(Object.hasOwn(error, 'confirmedApiCalls'), false);
    return true;
  };
}

function harness(deliver = (state, input) => state.child.stdout.write(frame(input)), options = {}) {
  const launches = [], events = new EventEmitter();
  const client = createGraphAnalyzer({...options, spawnProcess(executable, args, spawnOptions) {
    const child = new EventEmitter();
    child.exitCode = child.signalCode = null;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const state = {child, executable, args, spawnOptions, requests: [], signals: [], closed: false,
      acknowledge(code = 0) {
        if (this.closed) return;
        this.closed = true;
        child.exitCode = code;
        child.emit('close', code, child.signalCode);
      }};
    child.stdin = new Writable({write(chunk, _encoding, done) {
      const input = JSON.parse(chunk.toString('utf8'));
      state.requests.push(input);
      done();
      queueMicrotask(() => {
        deliver(state, input);
        events.emit('request', state, input);
      });
    }});
    child.kill = signal => {
      state.signals.push(signal);
      child.signalCode = signal;
      return true;
    };
    launches.push(state);
    return child;
  }});
  return {client, launches, events, async cleanup() {
    const closing = client.close();
    for (const launch of launches) launch.acknowledge();
    await closing;
  }};
}

async function admitBoth({client, launches}) {
  const lua = request('lua'), toc = request('toc');
  assert.deepEqual(await client.analyze(lua), expected(lua));
  assert.deepEqual(await client.analyze(toc), expected(toc));
  assert.equal(launches.length, 2);
  const [luaChild, tocChild] = launches;
  assert.deepEqual(luaChild.args.slice(2), ['--corpus-launcher']);
  assert.deepEqual(tocChild.args.slice(2), ['--xml-toc-launcher']);
  assert.equal(luaChild.args[0], '--max-old-space-size=2048');
  assert.equal(tocChild.args[0], '--max-old-space-size=256');
  assert.deepEqual(luaChild.requests.map(row => row.id), [1]);
  assert.deepEqual(tocChild.requests.map(row => row.id), [2]);
  assert.equal(luaChild.closed || tocChild.closed, false);
  return {lua, toc, luaChild, tocChild};
}

const cap = 8192;
for (const [scenario, code] of [
  ['stale ID', 'invariant'],
  ['trailing bytes before a frame is credited', 'invariant'],
  ['oversized frame', 'output-limit'],
  ['frame at its deadline', 'timeout'],
]) {
  test('split candidate retires both children after ' + scenario, {timeout: 6000}, async () => {
    let now = 0;
    const run = harness((state, input) => {
      if (input.id !== 3) state.child.stdout.write(frame(input));
      else if (scenario === 'stale ID') state.child.stdout.write(frame(input, {id: 2}));
      else if (scenario === 'trailing bytes before a frame is credited') {
        state.child.stdout.write(frame(input));
        state.child.stdout.write(Buffer.from('{}\n'));
      } else if (code === 'output-limit') state.child.stdout.write(Buffer.alloc(cap + 1, 120));
      else {
        now = 1000;
        state.child.stdout.write(frame(input));
      }
    }, {now: () => now, maxOutputBytes: cap});
    const {client, launches, events} = run;
    try {
      const {lua, toc, luaChild, tocChild} = await admitBoth(run);
      const written = once(events, 'request');
      const failure = assert.rejects(client.analyze(toc, 1000), withoutReceipt(code));
      assert.equal((await written)[0], tocChild);
      await setImmediate();
      assert.deepEqual(luaChild.signals, ['SIGKILL']);
      assert.deepEqual(tocChild.signals, ['SIGKILL']);
      luaChild.acknowledge(null);
      tocChild.acknowledge(null);
      await failure;
      assert.deepEqual(await client.analyze(lua), expected(lua));
      assert.equal(launches.length, 3);
      assert.deepEqual(launches[2].requests.map(row => row.id), [4]);
    } finally { await run.cleanup(); }
  });
}

test('idle peer output invalidates the pending reply and both closes precede recovery', {timeout: 6000}, async () => {
  const run = harness((state, input) => {
    if (input.id !== 3) state.child.stdout.write(frame(input));
  });
  const {client, launches, events} = run;
  try {
    const {lua, toc, luaChild, tocChild} = await admitBoth(run);
    const written = once(events, 'request');
    const failed = assert.rejects(client.analyze(toc), withoutReceipt('invariant'));
    const [activeChild, input] = await written;
    assert.equal(activeChild, tocChild);
    await assert.rejects(client.analyze(lua), withoutReceipt('busy'));
    luaChild.child.stdout.write(Buffer.from('unsolicited\n'));
    tocChild.child.stdout.write(frame(input));
    assert.deepEqual(luaChild.signals, ['SIGKILL']);
    assert.deepEqual(tocChild.signals, ['SIGKILL']);
    luaChild.acknowledge(null);
    await failed;

    // The remaining handle owns its slot even after the active call rejected.
    await assert.rejects(client.analyze(lua, 12), withoutReceipt('timeout'));
    assert.equal(launches.length, 2);
    assert.deepEqual(tocChild.requests.map(row => row.id), [2, 3]);
    assert.equal(tocChild.closed, false);
    tocChild.acknowledge(null);

    assert.deepEqual(await client.analyze(lua), expected(lua));
    assert.equal(launches.length, 3);
    assert.equal(launches[2].requests.length, 1);
    assert.ok(launches[2].requests[0].id > input.id);
  } finally { await run.cleanup(); }
});

test('bounded Lua starts alone after both retained children close', {timeout: 6000}, async () => {
  const run = harness((state, input) => {
    state.child.stdout.write(frame(input));
    if (input.luaProfile === 'bounded') state.acknowledge();
  });
  try {
    const {luaChild, tocChild} = await admitBoth(run);
    const bounded = request('lua', 'bounded');
    const result = run.client.analyze(bounded);
    result.catch(() => {});
    await setImmediate();
    assert.equal(run.launches.length, 2);
    luaChild.acknowledge();
    await setImmediate();
    assert.equal(run.launches.length, 2);
    tocChild.acknowledge();
    assert.deepEqual(await result, expected(bounded));
    assert.equal(run.launches.length, 3);
    const child = run.launches[2];
    assert.deepEqual(child.args.slice(0, 2), ['--max-old-space-size=128', '--stack_size=1024']);
    assert.equal(child.args.includes('--corpus-launcher'), false);
    assert.equal(child.args.includes('--xml-toc-launcher'), false);
    assert.deepEqual(child.requests.map(row => row.id), [3]);
    assert.equal(child.closed, true);
  } finally { await run.cleanup(); }
});

for (const elapsed of [9999, 10000]) {
  test('both closes share one monotonic reap deadline at ' + elapsed + ' ms', {timeout: 6000}, async () => {
    let now = 0;
    const run = harness(undefined, {now: () => now});
    try {
      const {luaChild, tocChild} = await admitBoth(run);
      const closing = run.client.close();
      const outcome = elapsed === 9999 ? closing : assert.rejects(closing, withoutReceipt('reap'));
      now = 6000;
      tocChild.acknowledge();
      await setImmediate();
      now = elapsed;
      luaChild.acknowledge();
      await outcome;
      assert.equal(run.launches.length, 2);
    } finally { await run.cleanup(); }
  });
}

test('a graceful close with a nonzero exit rejects the shutdown', {timeout: 6000}, async () => {
  const run = harness();
  try {
    const {luaChild, tocChild} = await admitBoth(run);
    const rejected = assert.rejects(run.client.close(), withoutReceipt('exit'));
    tocChild.acknowledge(2);
    assert.deepEqual(luaChild.signals, ['SIGKILL']);
    luaChild.acknowledge(null);
    await rejected;
  } finally { await run.cleanup(); }
});

test('shutdown cannot renew the shared reap window after a transport fault', {timeout: 6000}, async () => {
  let now = 0;
  const run = harness(undefined, {now: () => now});
  try {
    const {luaChild, tocChild} = await admitBoth(run);
    luaChild.child.stdout.write(Buffer.from('late\n'));
    assert.deepEqual(luaChild.signals, ['SIGKILL']);
    assert.deepEqual(tocChild.signals, ['SIGKILL']);
    now = 9000;
    const rejected = assert.rejects(run.client.close(), withoutReceipt('reap'));
    luaChild.acknowledge(null);
    await setImmediate();
    now = 10000;
    tocChild.acknowledge(null);
    await rejected;
  } finally { await run.cleanup(); }
});
