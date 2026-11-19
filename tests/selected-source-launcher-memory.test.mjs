import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {Worker} from 'node:worker_threads';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';
import {snapshotGraphAnalysisRequest} from '../scripts/selected-source-analysis.mjs';

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
const xmlFileUnits = 1_048_576;
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

function paddedXml(units) {
  const prefix = '<Ui/><!--🙂';
  const suffix = '-->';
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
    [16, '<Ui>' + '<Frame>'.repeat(depth) + '</Frame>'.repeat(depth) + '</Ui>'],
    [18, '<Ui><broken></Ui>'],
    [22, '<Ui><Frame name="Fixture"><Scripts><OnLoad>Answer = ' + '{ key = '.repeat(260) + '1' + ' }'.repeat(260) +
      '</OnLoad></Scripts></Frame></Ui>'],
  ]);
  const manifestOrdinals = new Set([15, 20]);
  return Array.from({length: 33}, (_, index) => {
    const ordinal = index + 1;
    const xml = ordinal >= 9 && ordinal <= 12 ? paddedXml(xmlFileUnits) : xmlCases.get(ordinal) ?? '<Ui/>';
    const markup = manifestOrdinals.has(ordinal) ? fixture(ordinal, 'toc', '## Interface: 11509\r\nCore.lua\r\n') :
      fixture(ordinal, 'xml', xml);
    return [fixture(ordinal, 'lua', luaCases.get(ordinal) ?? normal), markup];
  }).flat();
}

async function freshReply(input) {
  const {heap, stack} = measurements[input.language === 'lua' ? 'lua' : 'tocXml'];
  const thread = new Worker(workerEntry, {workerData: snapshotGraphAnalysisRequest(input), execArgv: [],
    resourceLimits: {maxOldGenerationSizeMb: heap, stackSizeMb: stack}});
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

test('real launchers reuse bounded Lua and XML Workers, isolate TOC and observe paired memory', {timeout: 120000}, async t => {
  const records = [], samples = new Map();
  const representative = new Map([
    [4, [1, 1]], [5, [1, 1]], [8, [1, 1]], [12, [1, 1]],
    [16, [0, 0]], [24, [1, 0]], [30, [1, 0]], [32, [1, 0]],
  ]);
  const compareFresh = {
    lua: new Set([1, 3, 5, 7, 8, 9, 10, 11, 12, 13, 33]),
    xml: new Set([2, 4, 6, 8, 12, 13, 14, 16, 17, 18, 19, 22, 23, 30, 32, 33]),
    toc: new Set([15, 20]),
  };
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
      } else if (input.language === 'xml') {
        const syntaxCode = ordinal === 16 ? 'XML0003' : ordinal === 18 ? 'XML0002' : null;
        assert.equal(result.syntax.complete, syntaxCode === null);
        assert.equal(confirmedApiCalls.parseXml.returned, 1);
        assert.equal(confirmedApiCalls.analyzeXml.returned, Number(syntaxCode === null));
        if (syntaxCode !== null) assert.deepEqual(result.syntax.diagnostics.map(row => row.code), [syntaxCode]);
        if (ordinal === 2) assert.equal(result.provider.references.length, wideCount);
        if (ordinal === 4) assert.equal(result.syntax.elements.length, depth);
        if (ordinal === 6 || ordinal === 22) {
          assert.equal(result.inline.length, 1);
          assert.equal(confirmedApiCalls.analyzeLua.returned, 1);
          assert.equal(confirmedApiCalls.mapXmlValueRanges.returned, 1);
          assert.deepEqual(result.inline[0].analysis.diagnostics.map(row => row.code), ordinal === 22 ? ['LUA0003'] : []);
        }
      } else {
        assert.equal(result.parsed.metadata.fileEntries[0].path, 'Core.lua');
        assert.equal(confirmedApiCalls.parseToc.returned, 1);
      }
      if (compareFresh[input.language].has(ordinal)) fresh.push({input, reply});
      if (representative.has(id)) assert.ok(await samplePair(id, 'reply'));
      if (id >= 63) assert.equal(records[0].close, null);
      if (id === 64) assert.deepEqual(records[1].close, {code: 0, signal: null});
    }
  } finally { await client.close(); }

  const freshComparisons = Object.fromEntries(Object.entries(compareFresh).map(([language, ordinals]) => [language, ordinals.size]));
  assert.equal(fresh.length, Object.values(freshComparisons).reduce((sum, count) => sum + count, 0));
  for (const {input, reply} of fresh) assert.deepEqual(reply, await freshReply(input), input.sourcePath);

  assert.equal(peakLive, 2);
  assert.deepEqual(records.map(record => record.mode), ['lua', 'tocXml', 'tocXml']);
  const group = (language, first, last = first, parked = false) => ({language, parked,
    ids: Array.from({length: last - first + 1}, (_, index) => 2 * (first + index) - Number(language === 'lua'))});
  // XML retires for file count, exact cumulative units, TOC, resource verdicts and launcher rotation.
  const groups = [
    [group('lua', 1, 8), group('lua', 9, 10), group('lua', 11), group('lua', 12, 12, true),
      group('lua', 13, 20), group('lua', 21, 28), group('lua', 29, 33, true)],
    [group('xml', 1, 8), group('xml', 9, 12), group('xml', 13, 14, true), group('toc', 15), group('xml', 16),
      group('xml', 17, 19, true), group('toc', 20), group('xml', 21, 22), group('xml', 23, 30), group('xml', 31, 32)],
    [group('xml', 33, 33, true)],
  ];
  const byMode = Object.fromEntries(Object.keys(measurements).map(mode => [mode, {
    starts: 0, acknowledgedCloses: 0, workers: 0, peakRssKiB: 0,
    effectiveHeapMinBytes: Infinity, effectiveHeapMaxBytes: 0, stackMiB: measurements[mode].stack,
  }]));
  for (const [index, record] of records.entries()) {
    assert.deepEqual(record.close, {code: 0, signal: null});
    const expectedGroups = groups[index];
    const observed = byMode[record.mode];
    const {events} = record;
    const starts = events.filter(event => event.kind === 'start');
    const exits = events.filter(event => event.kind === 'exit');
    const frames = events.filter(event => event.kind === 'frame');
    const dispatches = events.filter(event => event.kind === 'dispatch');
    const rows = record.stderr.split(/\r?\n/u).filter(line => line.startsWith(threadMarker))
      .map(line => JSON.parse(line.slice(threadMarker.length)));
    assert.equal(starts.length, expectedGroups.length);
    assert.equal(exits.length, starts.length);
    assert.equal(rows.length, starts.length);
    assert.deepEqual(dispatches.map(event => event.id), expectedGroups.filter(group => group.language !== 'toc').flatMap(group => group.ids));
    assert.deepEqual(frames.map(frame => frame.id), expectedGroups.flatMap(group => group.ids));
    assert.ok(frames.every(frame => frame.executing === 0));
    assert.ok(events.every(event => event.live <= 1 && event.executing <= 1));
    assert.equal(new Set(starts.map(start => start.threadId)).size, starts.length);

    observed.starts++;
    observed.acknowledgedCloses++;
    observed.workers += starts.length;
    for (const [offset, start] of starts.entries()) {
      const exit = exits[offset];
      const row = rows[offset];
      const {language, parked, ids} = expectedGroups[offset];
      const lastId = ids.at(-1);
      assert.equal(start.threadId, exit.threadId);
      assert.equal(start.threadId, row.threadId);
      assert.equal(exit.id, lastId);
      assert.deepEqual(start.execArgv, []);
      assert.equal(start.live, 1);
      assert.equal(exit.live, 0);
      if (offset + 1 < starts.length) assert.ok(events.indexOf(exit) < events.indexOf(starts[offset + 1]));
      if (language !== 'toc') {
        assert.equal(start.executing, 0);
        assert.deepEqual(dispatches.filter(event => event.threadId === start.threadId).map(event => event.id), ids);
        for (const id of ids.slice(0, -1)) assert.equal(frames.find(frame => frame.id === id).live, 1);
      } else {
        assert.equal(start.executing, 1);
        assert.deepEqual([start.id], ids);
      }
      const finalFrame = frames.find(frame => frame.id === lastId);
      if (parked) assert.ok(events.indexOf(finalFrame) < events.indexOf(exit));
      else assert.ok(events.indexOf(exit) < events.indexOf(finalFrame));
      assert.equal(finalFrame.live, Number(parked));
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

  let sampledAggregateRssKiB = 0, maximumPairSkewMilliseconds = 0, pairedLiveWorkers = 0;
  let parkedLuaPairs = 0, parkedXmlPairs = 0, maximumPairedLiveWorkers = 0, maximumPairedExecutingWorkers = 0;
  const paired = (await Promise.all([...samples.values()].map(round => round.done))).filter(Boolean);
  for (const id of representative.keys()) {
    for (const stage of ['worker-start', 'reply']) assert.ok(paired.some(round => round.id === id && round.stage === stage));
  }
  for (const round of paired) {
    const [lua, tocXml] = ['lua', 'tocXml'].map(mode =>
      round.readings.get(round.expected.find(record => record.mode === mode)));
    assert.ok(lua.rssKiB > 0 && tocXml.rssKiB > 0);
    maximumPairedLiveWorkers = Math.max(maximumPairedLiveWorkers, lua.live + tocXml.live);
    maximumPairedExecutingWorkers = Math.max(maximumPairedExecutingWorkers, lua.executing + tocXml.executing);
    if (round.stage === 'reply') {
      assert.equal(lua.executing + tocXml.executing, 0);
      assert.deepEqual([lua.live, tocXml.live], representative.get(round.id));
    }
    sampledAggregateRssKiB = Math.max(sampledAggregateRssKiB, lua.rssKiB + tocXml.rssKiB);
    maximumPairSkewMilliseconds = Math.max(maximumPairSkewMilliseconds, Math.abs(lua.measuredAtMs - tocXml.measuredAtMs));
    if (lua.live && tocXml.live) pairedLiveWorkers++;
    if (lua.live && !lua.executing) parkedLuaPairs++;
    if (tocXml.live && !tocXml.executing) parkedXmlPairs++;
  }
  assert.equal(maximumPairedLiveWorkers, 2);
  assert.ok(maximumPairedExecutingWorkers <= 1);
  assert.ok(parkedLuaPairs > 0 && parkedXmlPairs > 0);
  t.diagnostic('selected-source-launcher-memory ' + JSON.stringify({
    node: process.versions.node, platform: process.platform, peakLive, requests: workload.length,
    freshComparisons, byMode, pairedSamples: paired.length, pairedLiveWorkers, parkedLuaPairs, parkedXmlPairs,
    maximumPairedLiveWorkers, maximumPairedExecutingWorkers, sampledAggregateRssKiB, maximumPairSkewMilliseconds,
  }));
});
