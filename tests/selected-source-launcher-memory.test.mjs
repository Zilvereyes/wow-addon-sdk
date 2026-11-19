import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Worker} from 'node:worker_threads';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';

const observer = new URL('./fixtures/observe-selected-source-launcher.mjs', import.meta.url).href;
const workerEntry = new URL('../scripts/selected-source-analysis-worker.mjs', import.meta.url);
const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const xmlPolicy = json('../examples/xml-provider-profile.json').policy;
const inlineProfile = json('../examples/xml-inline-lua-profile.json');
const threadMarker = 'graph-memory-thread:';
const launcherModes = new Map([['--corpus-launcher', 'lua'], ['--xml-toc-launcher', 'tocXml']]);
const measurements = {lua: {heap: 2048, stack: 8}, tocXml: {heap: 256, stack: 4}};
const wideCount = 420;
const depth = 256;
const luaCount = 1800;
const unitLimit = 4_194_304;
const normal = 'Answer=42';
const inheritedCondition = {providerId: 'fixture', name: 'AllowLoad', raw: '[AllowLoad era]', values: ['era'],
  source: {file: 'Fixture/Manifest.toc', range: {start: {line: 1, column: 0}, end: {line: 1, column: 15}}}};

function fixture(ordinal, language, content) {
  return {language, content, sourcePath: 'Fixture/Source🙂' + ordinal + '.' + language, addonId: 'fixture',
    conditions: language === 'lua' && ordinal === 7 ? [inheritedCondition] : [],
    luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile};
}

function paddedLua(units) {
  const prefix = '--🙂';
  const suffix = '\r\n' + normal;
  return prefix + 'a'.repeat(units - prefix.length - suffix.length) + suffix;
}

function authoredWorkload() {
  const luaCases = new Map([
    [3, Array.from({length: luaCount}, (_, name) => 'Global' + name + '=' + name).join('\n')],
    [5, 'Answer='],
    [7, 'Caption="🙂"; Answer=1; Answer=2'],
    [9, paddedLua(unitLimit - normal.length)],
    [11, paddedLua(unitLimit + 1)],
    [12, paddedLua(unitLimit - 1)],
  ]);
  const xmlCases = new Map([
    [2, '<Ui>' + '<Include file="Authored&amp;Target.xml"/>'.repeat(wideCount) + '</Ui>'],
    [4, '<Ui>' + '<Frame>'.repeat(depth - 1) + '</Frame>'.repeat(depth - 1) + '</Ui>'],
    [6, '<Ui><Frame name="Fixture"><Scripts><OnLoad>Answer=1</OnLoad></Scripts></Frame></Ui>'],
  ]);
  return Array.from({length: 33}, (_, index) => {
    const ordinal = index + 1;
    const xml = xmlCases.get(ordinal);
    const markup = xml !== undefined || ordinal % 2 !== 0 ? fixture(ordinal, 'xml', xml ?? '<Ui/>') :
      fixture(ordinal, 'toc', '## Interface: 11509\r\nCore.lua\r\n');
    return [fixture(ordinal, 'lua', luaCases.get(ordinal) ?? normal), markup];
  }).flat();
}

async function freshLuaReply(input) {
  const thread = new Worker(workerEntry, {workerData: input, execArgv: [],
    resourceLimits: {maxOldGenerationSizeMb: 2048, stackSizeMb: 8}});
  try {
    const {failure, ...reply} = await new Promise((resolve, reject) => {
      thread.once('message', resolve);
      thread.once('error', reject);
      thread.once('exit', code => reject(Error('Fresh parser exited before reply: ' + code)));
    });
    assert.equal(failure, null);
    return reply;
  } finally {await thread.terminate();}
}

test('real launchers reuse bounded corpus Lua Workers, rotate and observe paired memory', {timeout: 120000}, async t => {
  const records = [], samples = new Map();
  const representative = new Set([4, 5, 8]);
  const compareFresh = new Set([1, 3, 5, 7, 8, 9, 10, 11, 12, 13, 33]);
  const fresh = [];
  const workload = authoredWorkload();

  function samplePair(id, stage) {
    const active = records.filter(record => !record.close && record.child.connected);
    if (active.length !== 2) return;
    const sample = samples.size + 1;
    const round = {id, stage, expected: active, readings: new Map()};
    const done = new Promise(resolve => {
      const timer = setTimeout(() => round.finish(null), 5000);
      round.finish = result => {clearTimeout(timer); resolve(result);};
    });
    round.done = done;
    samples.set(sample, round);
    for (const record of active) record.child.send({sample}, error => {if (error) round.finish(null);});
    return done;
  }

  let peakLive = 0;
  const client = createGraphAnalyzer({spawnProcess(executable, args, options) {
    const mode = launcherModes.get(args.at(-1));
    assert.ok(mode);
    assert.equal(args[0], '--max-old-space-size=' + measurements[mode].heap);
    const child = spawn(executable, ['--import', observer, ...args], {...options, stdio: [...options.stdio, 'ipc']});
    const record = {mode, child, events: [], stderr: '', close: null};
    records.push(record);
    peakLive = Math.max(peakLive, records.filter(entry => entry.close === null).length);
    child.stderr.setEncoding('utf8').on('data', data => {record.stderr += data;});
    child.on('message', message => {
      if (message.kind === 'sample') {
        const round = samples.get(message.sample);
        if (!round) return;
        round.readings.set(record, message);
        if (round.expected.every(peer => round.readings.has(peer))) round.finish(round);
      } else {
        record.events.push(message);
        if ((message.kind === 'start' || message.kind === 'dispatch') && representative.has(message.id)) {
          samplePair(message.id, 'worker-start');
        }
      }
    });
    child.once('close', (code, signal) => {record.close = {code, signal};});
    return child;
  }});

  try {
    for (const [index, input] of workload.entries()) {
      const id = index + 1;
      const ordinal = Math.floor(index / 2) + 1;
      const reply = await client.analyze(input);
      const {result, confirmedApiCalls} = reply;
      assert.equal(result.language, input.language);
      if (input.language === 'lua') {
        assert.equal(result.result.complete, ordinal !== 5);
        assert.equal(confirmedApiCalls.analyzeLua.returned, 1);
        if (ordinal === 5) assert.ok(result.result.diagnostics.length > 0);
        else assert.equal(result.result.declarations.length, ordinal === 3 ? luaCount : ordinal === 7 ? 3 : 1);
        if (compareFresh.has(ordinal)) fresh.push({input, reply});
      } else if (input.language === 'xml') {
        assert.equal(result.syntax.complete, true);
        assert.equal(confirmedApiCalls.parseXml.returned, 1);
        assert.equal(confirmedApiCalls.analyzeXml.returned, 1);
        if (ordinal === 2) assert.equal(result.provider.references.length, wideCount);
        if (ordinal === 4) assert.equal(result.syntax.elements.length, depth);
        if (ordinal === 6) {
          assert.equal(result.inline.length, 1);
          assert.equal(confirmedApiCalls.analyzeLua.returned, 1);
          assert.equal(confirmedApiCalls.mapXmlValueRanges.returned, 1);
        }
      } else {
        assert.equal(result.parsed.metadata.fileEntries[0].path, 'Core.lua');
        assert.equal(confirmedApiCalls.parseToc.returned, 1);
      }
      if (representative.has(id)) assert.ok(await samplePair(id, 'reply'));
      if (id === 63 || id === 64) assert.deepEqual(records[id - 63].close, {code: 0, signal: null});
    }
  } finally { await client.close(); }

  assert.equal(fresh.length, compareFresh.size);
  for (const {input, reply} of fresh) assert.deepEqual(reply, await freshLuaReply(input));

  assert.equal(peakLive, 2);
  assert.deepEqual(records.map(record => record.mode), ['lua', 'tocXml', 'lua', 'tocXml']);
  const groups = [
    [[1, 2, 3, 4, 5, 6, 7, 8], [9, 10], [11], [12], [13, 14, 15, 16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25, 26, 27, 28], [29, 30, 31, 32]],
    Array.from({length: 32}, (_, index) => [index + 1]),
    [[33]],
    [[33]],
  ];
  const byMode = Object.fromEntries(Object.keys(measurements).map(mode => [mode, {
    starts: 0, acknowledgedCloses: 0, workers: 0, peakRssKiB: 0,
    effectiveHeapMinBytes: Infinity, effectiveHeapMaxBytes: 0, stackMiB: measurements[mode].stack,
  }]));
  for (const [index, record] of records.entries()) {
    assert.deepEqual(record.close, {code: 0, signal: null});
    const pooled = record.mode === 'lua';
    const observed = byMode[record.mode];
    const {events} = record;
    const starts = events.filter(event => event.kind === 'start');
    const exits = events.filter(event => event.kind === 'exit');
    const frames = events.filter(event => event.kind === 'frame');
    const dispatches = events.filter(event => event.kind === 'dispatch');
    const rows = record.stderr.split(/\r?\n/u).filter(line => line.startsWith(threadMarker))
      .map(line => JSON.parse(line.slice(threadMarker.length)));
    assert.equal(starts.length, groups[index].length);
    assert.equal(exits.length, starts.length);
    assert.equal(rows.length, starts.length);
    assert.equal(dispatches.length, pooled ? groups[index].flat().length : 0);
    assert.deepEqual(frames.map(frame => frame.id), groups[index].flat()
      .map(ordinal => 2 * ordinal - Number(pooled)));
    assert.ok(frames.every(frame => frame.executing === 0));
    assert.ok(events.every(event => event.live <= 1 && event.executing <= 1));
    assert.equal(new Set(starts.map(start => start.threadId)).size, starts.length);

    observed.starts++;
    observed.acknowledgedCloses++;
    observed.workers += starts.length;
    for (const [offset, start] of starts.entries()) {
      const exit = exits[offset];
      const row = rows[offset];
      const ids = groups[index][offset].map(ordinal => 2 * ordinal - Number(pooled));
      const lastId = ids.at(-1);
      assert.equal(start.threadId, exit.threadId);
      assert.equal(start.threadId, row.threadId);
      assert.equal(exit.id, lastId);
      assert.deepEqual(start.execArgv, []);
      assert.equal(start.live, 1);
      assert.equal(exit.live, 0);
      if (offset + 1 < starts.length) assert.ok(events.indexOf(exit) < events.indexOf(starts[offset + 1]));
      if (pooled) {
        assert.deepEqual(dispatches.filter(event => event.threadId === start.threadId).map(event => event.id), ids);
        for (const id of ids.slice(0, -1)) assert.equal(frames.find(frame => frame.id === id).live, 1);
      } else assert.deepEqual([start.id], ids);
      const finalFrame = frames.find(frame => frame.id === lastId);
      const parkedAfterGroup = pooled && (index === 2 || groups[index][offset][0] === 12);
      if (parkedAfterGroup) assert.ok(events.indexOf(finalFrame) < events.indexOf(exit));
      else assert.ok(events.indexOf(exit) < events.indexOf(finalFrame));
      assert.equal(finalFrame.live, Number(parkedAfterGroup));
      assert.equal(row.maxOldGenerationSizeMb, measurements[record.mode].heap);
      assert.equal(row.stackSizeMb, observed.stackMiB);
      assert.ok(Number.isSafeInteger(row.heapLimitBytes) && row.heapLimitBytes > 0);
      observed.effectiveHeapMinBytes = Math.min(observed.effectiveHeapMinBytes, row.heapLimitBytes);
      observed.effectiveHeapMaxBytes = Math.max(observed.effectiveHeapMaxBytes, row.heapLimitBytes);
    }
    for (const event of events) {
      assert.ok(Number.isSafeInteger(event.rssKiB) && event.rssKiB > 0);
      observed.peakRssKiB = Math.max(observed.peakRssKiB, event.peakRssKiB, event.rssKiB);
    }
  }
  assert.ok(byMode.lua.effectiveHeapMinBytes > byMode.tocXml.effectiveHeapMaxBytes);

  let sampledAggregateRssKiB = 0, maximumPairSkewMilliseconds = 0, pairedLiveWorkers = 0, parkedLuaPairs = 0;
  const paired = (await Promise.all([...samples.values()].map(round => round.done))).filter(Boolean);
  for (const id of representative) {
    for (const stage of ['worker-start', 'reply']) assert.ok(paired.some(round => round.id === id && round.stage === stage));
  }
  for (const round of paired) {
    const [lua, tocXml] = ['lua', 'tocXml'].map(mode =>
      round.readings.get(round.expected.find(record => record.mode === mode)));
    assert.ok(lua.rssKiB > 0 && tocXml.rssKiB > 0);
    assert.ok(lua.live <= 1 && tocXml.live <= 1);
    if (round.stage === 'reply') assert.deepEqual([lua.live, lua.executing, tocXml.live, tocXml.executing], [1, 0, 0, 0]);
    sampledAggregateRssKiB = Math.max(sampledAggregateRssKiB, lua.rssKiB + tocXml.rssKiB);
    maximumPairSkewMilliseconds = Math.max(maximumPairSkewMilliseconds, Math.abs(lua.measuredAtMs - tocXml.measuredAtMs));
    if (lua.live && tocXml.live) pairedLiveWorkers++;
    if (lua.live && !lua.executing) parkedLuaPairs++;
  }
  t.diagnostic('selected-source-launcher-memory ' + JSON.stringify({
    node: process.versions.node, platform: process.platform, peakLive, requests: workload.length,
    freshLuaComparisons: fresh.length, byMode, pairedSamples: paired.length, pairedLiveWorkers,
    parkedLuaPairs, sampledAggregateRssKiB, maximumPairSkewMilliseconds,
  }));
});
