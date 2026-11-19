import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {PassThrough, Writable} from 'node:stream';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {parseToc} from '@wow-addon/toc-parser';
import {analyzeXml} from '@wow-addon/xml-analysis';
import {parseXml} from '@wow-addon/xml-parser';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis-receipts.mjs';

const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const xmlPolicy = json('../examples/xml-provider-profile.json').policy;
const inlineProfile = json('../examples/xml-inline-lua-profile.json');
const testTimeout = {timeout: 6000};

function request(language, number = 1, luaProfile = 'corpus') {
  const content = {
    lua: 'Authored' + number + ' = "😀"',
    toc: '## Interface: 11509\r\nSource' + number + '.lua\r\n',
    xml: '<Ui>\r\n<!--😀' + number + '-->\r\n</Ui>',
  }[language];
  return {language, content, sourcePath: 'Fixture/Source' + number + '.' + language,
    addonId: 'authored-split-launchers', conditions: [], luaProfile, allowShebang: false,
    xmlPolicy, inlineProfile};
}

function expected(input) {
  const {language, content, sourcePath, addonId, conditions, luaProfile, allowShebang} = input;
  const confirmedApiCalls = emptyGraphCalls();
  const mark = name => { confirmedApiCalls[name] = {invoked: 1, returned: 1}; };
  let result;
  if (language === 'lua') {
    mark('analyzeLua');
    result = {language, result: analyzeLua(content, sourcePath, {
      addonId, conditions, profile: luaProfile, allowShebang, context: {kind: 'chunk'},
    })};
  } else if (language === 'toc') {
    mark('parseToc');
    result = {language, parsed: parseToc(content, sourcePath)};
  } else {
    mark('parseXml');
    mark('analyzeXml');
    result = {language, syntax: parseXml(content, sourcePath, {namespaceAware: true}),
      provider: analyzeXml(content, sourcePath, {addonId, conditions, policy: input.xmlPolicy}), inline: []};
  }
  return {result, confirmedApiCalls};
}

function frame(input, reply = {...expected(input), failure: null}) {
  return Buffer.from(JSON.stringify({id: input.id, ...reply}) + '\n');
}

function makeHarness({deliver = (launch, input) => launch.child.stdout.write(frame(input)), ...options} = {}) {
  const launches = [];
  const client = createGraphAnalyzer({timeoutMs: 2000, ...options, spawnProcess(executable, args) {
    assert.equal(executable, process.execPath);
    const child = new EventEmitter();
    child.exitCode = child.signalCode = null;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const launch = {child, args, requests: [], signals: [], closed: false,
      acknowledge(code = child.signalCode === null ? 0 : null) {
        if (this.closed) return;
        this.closed = true;
        child.exitCode = code;
        child.emit('close', code, child.signalCode);
      },
    };
    child.stdin = new Writable({write(chunk, _encoding, done) {
      const input = JSON.parse(chunk.toString('utf8'));
      launch.requests.push(input);
      done();
      queueMicrotask(() => deliver(launch, input));
    }});
    child.kill = signal => {
      launch.signals.push(signal);
      child.signalCode = signal;
      return true;
    };
    launches.push(launch);
    return child;
  }});
  return {client, launches, async cleanup() {
    // Assertions exercise intentional shutdown failures before fallback cleanup.
    const closing = client.close().catch(() => {});
    for (const launch of launches) launch.acknowledge();
    await closing;
  }};
}

function withoutReceipts(code) {
  return error => {
    assert.equal(error.message, 'graph-analysis-' + code);
    assert.equal(Object.hasOwn(error, 'confirmedApiCalls'), false);
    return true;
  };
}

async function stillPending(promise) {
  const settled = await Promise.race([promise.then(() => true, () => true), setImmediate(false)]);
  assert.equal(settled, false);
}

async function primePair({client, launches}) {
  for (const language of ['lua', 'toc']) {
    const input = request(language);
    assert.deepEqual(await client.analyze(input), expected(input));
  }
  assert.equal(launches.length, 2);
  const [lua, tocXml] = launches;
  assert.equal(lua.args[0], '--max-old-space-size=2048');
  assert.equal(lua.args.at(-1), '--corpus-launcher');
  assert.equal(tocXml.args[0], '--max-old-space-size=256');
  assert.equal(tocXml.args.at(-1), '--xml-toc-launcher');
  assert.equal(lua.closed || tocXml.closed, false);
  return {lua, tocXml};
}

test('split launchers share one ID sequence and rotate independently at 32 requests', testTimeout, async () => {
  const harness = makeHarness();
  const {client, launches} = harness;
  try {
    const {lua, tocXml} = await primePair(harness);
    const mixed = number => request(number % 2 === 0 ? 'xml' : 'toc', number);
    for (let number = 2; number <= 31; number++) {
      for (const input of [request('lua', number), mixed(number)]) {
        assert.deepEqual(await client.analyze(input), expected(input));
      }
    }
    assert.equal(launches.length, 2);
    assert.equal(lua.requests.length, 31);
    assert.equal(tocXml.requests.length, 31);

    const lastLua = request('lua', 32);
    const rotatingLua = client.analyze(lastLua);
    await stillPending(rotatingLua);
    assert.equal(lua.requests.length, 32);
    await assert.rejects(client.analyze(mixed(32)), withoutReceipts('busy'));
    assert.equal(tocXml.requests.length, 31);
    assert.equal(launches.length, 2);
    lua.acknowledge();
    assert.deepEqual(await rotatingLua, expected(lastLua));
    assert.equal(tocXml.closed, false);

    const nextLua = request('lua', 33);
    assert.deepEqual(await client.analyze(nextLua), expected(nextLua));
    assert.equal(launches.length, 3);
    const nextLuaChild = launches[2];
    assert.deepEqual(nextLuaChild.requests.map(input => input.id), [64]);

    const lastMixed = mixed(32);
    const rotatingMixed = client.analyze(lastMixed);
    await stillPending(rotatingMixed);
    assert.equal(tocXml.requests.length, 32);
    await assert.rejects(client.analyze(request('lua', 34)), withoutReceipts('busy'));
    assert.equal(nextLuaChild.requests.length, 1);
    tocXml.acknowledge();
    assert.deepEqual(await rotatingMixed, expected(lastMixed));
    assert.equal(nextLuaChild.closed, false);

    const nextMixed = mixed(33);
    assert.deepEqual(await client.analyze(nextMixed), expected(nextMixed));
    assert.equal(launches.length, 4);
    assert.deepEqual(launches[3].requests.map(input => input.id), [66]);
    const ids = launches.flatMap(launch => launch.requests.map(input => input.id)).sort((a, b) => a - b);
    assert.deepEqual(ids, Array.from({length: 66}, (_, index) => index + 1));
    assert.deepEqual(launches.flatMap(launch => launch.signals), []);
  } finally { await harness.cleanup(); }
});

test('bounded Lua waits for direct close of both retained launchers', testTimeout, async () => {
  const harness = makeHarness({deliver(launch, input) {
    launch.child.stdout.write(frame(input));
    if (input.luaProfile === 'bounded') launch.acknowledge();
  }});
  const {client, launches} = harness;
  try {
    const {lua, tocXml} = await primePair(harness);
    const input = request('lua', 2, 'bounded');
    const result = client.analyze(input);
    await stillPending(result);
    assert.equal(launches.length, 2);
    lua.acknowledge();
    tocXml.child.exitCode = 0;
    tocXml.child.emit('exit', 0, null);
    await stillPending(result);
    assert.equal(launches.length, 2);
    tocXml.acknowledge();
    assert.deepEqual(await result, expected(input));
    assert.equal(launches.length, 3);
    assert.deepEqual(launches[2].args.slice(0, 2), ['--max-old-space-size=128', '--stack_size=1024']);
    assert.match(launches[2].args.at(-1), /selected-source-analysis-worker\.mjs$/u);
    assert.deepEqual(launches[2].requests.map(row => row.id), [3]);
  } finally { await harness.cleanup(); }
});

for (const reportOn of ['analyze', 'close']) {
  test('unsolicited idle output remains reportable at ' + reportOn + ' after both launches close', testTimeout, async () => {
    const harness = makeHarness();
    const {client, launches} = harness;
    try {
      const {lua, tocXml} = await primePair(harness);
      const input = request('xml', 2);
      const finalReply = await client.analyze(input);
      const valid = expected(input);
      assert.deepEqual(finalReply, valid);

      tocXml.child.stdout.write(Buffer.from('unsolicited\n'));
      await setImmediate();
      assert.deepEqual(lua.signals, ['SIGKILL']);
      assert.deepEqual(tocXml.signals, ['SIGKILL']);
      lua.acknowledge();
      tocXml.acknowledge();
      if (reportOn === 'analyze') {
        await assert.rejects(client.analyze(request('lua', 2)), withoutReceipts('invariant'));
        assert.equal(launches.length, 2);
        const retry = request('lua', 3);
        assert.deepEqual(await client.analyze(retry), expected(retry));
        assert.equal(launches.length, 3);
        assert.equal(launches[2].requests.length, 1);
      } else {
        await assert.rejects(client.close(), withoutReceipts('invariant'));
        assert.equal(launches.length, 2);
      }
      assert.deepEqual(finalReply, valid);
    } finally { await harness.cleanup(); }
  });
}

test('faulted launcher ownership survives an exit event until the sibling closes', testTimeout, async () => {
  const harness = makeHarness();
  const {client, launches} = harness;
  try {
    const {lua, tocXml} = await primePair(harness);
    lua.child.stdout.write(Buffer.from('unsolicited\n'));
    await setImmediate();
    assert.deepEqual(lua.signals, ['SIGKILL']);
    assert.deepEqual(tocXml.signals, ['SIGKILL']);
    lua.acknowledge();
    tocXml.child.emit('exit', null, 'SIGKILL');

    const reported = assert.rejects(client.analyze(request('lua', 2)), withoutReceipts('invariant'));
    // The fault can be reported immediately or after close. Neither permits a replacement.
    await assert.rejects(client.analyze(request('lua', 3), 3), /graph-analysis-(busy|timeout|reap)/u);
    assert.equal(launches.length, 2);
    assert.equal(tocXml.closed, false);
    assert.deepEqual(launches.map(launch => launch.requests.length), [1, 1]);

    tocXml.acknowledge();
    await reported;
    const next = request('lua', 4);
    assert.deepEqual(await client.analyze(next), expected(next));
    assert.equal(launches.length, 3);
    assert.equal(launches[2].requests.length, 1);
  } finally { await harness.cleanup(); }
});

test('a correlated failure receipt requires a clean close and retires the peer', testTimeout, async () => {
  const receipt = emptyGraphCalls();
  receipt.parseToc = {invoked: 1, returned: 0};
  const harness = makeHarness({deliver(launch, input) {
    if (input.id === 3) {
      launch.child.stdout.write(frame(input, {result: null, failure: 'backend', confirmedApiCalls: receipt}));
    } else launch.child.stdout.write(frame(input));
  }});
  const {client, launches} = harness;
  try {
    const {lua, tocXml} = await primePair(harness);
    const failure = assert.rejects(client.analyze(request('toc', 2)), error => {
      assert.equal(error.message, 'graph-analysis-backend');
      assert.deepEqual(error.confirmedApiCalls, receipt);
      return true;
    });
    await stillPending(failure);
    assert.equal(launches.length, 2);
    assert.deepEqual(tocXml.signals, []);
    tocXml.acknowledge();
    await failure;
    assert.deepEqual(lua.signals, ['SIGKILL']);
    lua.acknowledge();

    const next = request('xml', 2);
    assert.deepEqual(await client.analyze(next), expected(next));
    assert.equal(launches.length, 3);
    assert.deepEqual(launches[2].requests.map(row => row.id), [4]);
  } finally { await harness.cleanup(); }
});

test('a failed launcher close withholds its correlated failure receipt', testTimeout, async () => {
  const receipt = emptyGraphCalls();
  receipt.parseToc = {invoked: 1, returned: 0};
  const harness = makeHarness({deliver(launch, input) {
    if (input.id === 3) {
      launch.child.stdout.write(frame(input, {result: null, failure: 'backend', confirmedApiCalls: receipt}));
    } else launch.child.stdout.write(frame(input));
  }});
  try {
    const {lua, tocXml} = await primePair(harness);
    const failed = assert.rejects(harness.client.analyze(request('toc', 2)), withoutReceipts('exit'));
    await stillPending(failed);
    tocXml.acknowledge(2);
    lua.acknowledge();
    await failed;
    assert.equal(harness.launches.length, 2);
  } finally { await harness.cleanup(); }
});

for (const {hostAllowance, lastAck} of [
  {hostAllowance: Infinity, lastAck: 9999},
  {hostAllowance: Infinity, lastAck: 10000},
  {hostAllowance: 400, lastAck: 399},
  {hostAllowance: 400, lastAck: 400},
]) {
  test('split shutdown shares the ' + Math.min(hostAllowance, 10000) + ' ms deadline at ' + lastAck,
    testTimeout, async () => {
      const started = 100;
      let now = started;
      const harness = makeHarness({now: () => now, timeoutMs: 60000, cleanupDeadline: () => started + hostAllowance});
      const {client, launches} = harness;
      try {
        const {lua, tocXml} = await primePair(harness);
        const closing = client.close();
        const outcome = lastAck < Math.min(hostAllowance, 10000) ? closing :
          assert.rejects(closing, withoutReceipts('reap'));
        now = started + Math.floor(lastAck / 2);
        tocXml.acknowledge();
        lua.child.exitCode = 0;
        lua.child.emit('exit', 0, null);
        await stillPending(outcome);
        assert.equal(launches.length, 2);
        now = started + lastAck;
        lua.acknowledge();
        await outcome;
        assert.equal(launches.length, 2);
      } finally { await harness.cleanup(); }
    });
}

test('terminal close cannot renew an idle-fault retirement deadline', testTimeout, async () => {
  let now = 0;
  const harness = makeHarness({now: () => now, timeoutMs: 60000});
  try {
    const {lua, tocXml} = await primePair(harness);
    lua.child.stdout.write(Buffer.from('unsolicited\n'));
    await setImmediate();
    assert.deepEqual(lua.signals, ['SIGKILL']);
    assert.deepEqual(tocXml.signals, ['SIGKILL']);
    now = 9000;
    const closing = assert.rejects(harness.client.close(), withoutReceipts('reap'));
    lua.acknowledge();
    await stillPending(closing);
    now = 10000;
    tocXml.acknowledge();
    await closing;
  } finally { await harness.cleanup(); }
});
