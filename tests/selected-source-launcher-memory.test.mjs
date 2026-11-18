import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';

const observer = new URL('./fixtures/observe-selected-source-launcher.mjs', import.meta.url).href;
const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const xmlPolicy = json('../examples/xml-provider-profile.json').policy;
const inlineProfile = json('../examples/xml-inline-lua-profile.json');
const threadMarker = 'graph-memory-thread:';
const launcherModes = new Map([['--corpus-launcher', 'lua'], ['--xml-toc-launcher', 'tocXml']]);
const measurements = {lua: {heap: 2048, stack: 8}, tocXml: {heap: 256, stack: 4}};
const wideCount = 420;
const depth = 256;
const luaCount = 1800;

function fixture(ordinal, language, content) {
  return {language, content, sourcePath: 'Fixture/Source' + ordinal + '.' + language, addonId: 'fixture',
    conditions: [], luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile};
}

test('real split launchers join each parser thread, rotate both classes and record paired memory samples', {timeout: 120000}, async t => {
  const records = [], samples = new Map();
  const luaCase = 5, wideCase = 4, deepCase = 8;
  const representative = new Set([luaCase, wideCase, deepCase]);
  const workload = Array.from({length: 33}, (_, index) => {
    const ordinal = index + 1;
    const lua = ordinal === 3 ? Array.from({length: luaCount}, (_, name) => 'Global' + name + '=' + name).join('\n') : 'Answer=42';
    if (ordinal === 2) {
      return [fixture(ordinal, 'lua', lua), fixture(ordinal, 'xml', '<Ui>' +
        '<Include file="Authored&amp;Target.xml"/>'.repeat(wideCount) + '</Ui>')];
    }
    if (ordinal === 4) {
      return [fixture(ordinal, 'lua', lua), fixture(ordinal, 'xml', '<Ui>' +
        '<Frame>'.repeat(depth - 1) + '</Frame>'.repeat(depth - 1) + '</Ui>')];
    }
    const markup = ordinal % 2 === 0 ? fixture(ordinal, 'toc', '## Interface: 11509\r\nCore.lua\r\n') : fixture(ordinal, 'xml', '<Ui/>');
    return [fixture(ordinal, 'lua', lua), markup];
  }).flat();

  function samplePair(id, stage) {
    const active = records.filter(record => !record.close && record.child.connected);
    if (active.length !== 2) return;
    const sample = samples.size + 1;
    const round = {id, stage, expected: active, readings: new Map(), failed: false};
    samples.set(sample, round);
    for (const record of active) {
      record.child.send({sample}, error => {if (error) round.failed = true;});
    }
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
      if (message.kind === 'sample') samples.get(message.sample)?.readings.set(record, message);
      else {
        record.events.push(message);
        if (message.kind === 'start' && representative.has(message.id)) samplePair(message.id, 'worker-start');
      }
    });
    child.once('close', (code, signal) => {record.close = {code, signal};});
    return child;
  }});

  try {
    for (const [index, input] of workload.entries()) {
      const id = index + 1;
      const {result, confirmedApiCalls} = await client.analyze(input);
      assert.equal(result.language, input.language);
      if (input.language === 'lua') {
        assert.equal(result.result.complete, true);
        assert.equal(result.result.declarations.length, id === luaCase ? luaCount : 1);
        assert.equal(confirmedApiCalls.analyzeLua.returned, 1);
      } else if (input.language === 'xml') {
        assert.equal(result.syntax.complete, true);
        assert.equal(confirmedApiCalls.parseXml.returned, 1);
        assert.equal(confirmedApiCalls.analyzeXml.returned, 1);
        if (id === wideCase) assert.equal(result.provider.references.length, wideCount);
        if (id === deepCase) assert.equal(result.syntax.elements.length, depth);
      } else {
        assert.equal(result.parsed.metadata.fileEntries[0].path, 'Core.lua');
        assert.equal(confirmedApiCalls.parseToc.returned, 1);
      }
      if (representative.has(id)) samplePair(id, 'reply');
      if (id === 63 || id === 64) assert.deepEqual(records[id - 63].close, {code: 0, signal: null});
    }
  } finally { await client.close(); }

  assert.equal(peakLive, 2);
  assert.deepEqual(records.map(record => record.mode), ['lua', 'tocXml', 'lua', 'tocXml']);
  const byMode = Object.fromEntries(Object.keys(measurements).map(mode => [mode, {
    starts: 0, acknowledgedCloses: 0, workers: 0, peakRssKiB: 0,
    effectiveHeapMinBytes: Infinity, effectiveHeapMaxBytes: 0, stackMiB: measurements[mode].stack,
  }]));
  const childPeaks = [];
  for (const [index, record] of records.entries()) {
    assert.deepEqual(record.close, {code: 0, signal: null});
    const count = index < 2 ? 32 : 1;
    const rows = record.stderr.split(/\r?\n/u).filter(line => line.startsWith(threadMarker))
      .map(line => JSON.parse(line.slice(threadMarker.length)));
    assert.equal(rows.length, count);
    assert.equal(record.events.length, 3 * count);
    const observed = byMode[record.mode];
    const ids = new Set();
    let peakRssKiB = 0;
    observed.starts++;
    observed.acknowledgedCloses++;
    observed.workers += count;
    for (let offset = 0; offset < count; offset++) {
      const id = 1 + index % 2 + 2 * (index < 2 ? offset : 32);
      const [start, exit, frame] = record.events.slice(3 * offset, 3 * offset + 3);
      const row = rows[offset];
      assert.deepEqual([start.kind, exit.kind, frame.kind], ['start', 'exit', 'frame']);
      assert.deepEqual([start.id, exit.id, frame.id, row.id], [id, id, id, id]);
      assert.deepEqual([start.active, exit.active, frame.active], [1, 0, 0]);
      assert.deepEqual(start.execArgv, []);
      assert.equal(start.threadId, exit.threadId);
      assert.equal(start.threadId, row.threadId);
      assert.ok(Number.isSafeInteger(row.threadId) && row.threadId > 0 && !ids.has(row.threadId));
      ids.add(row.threadId);
      assert.equal(row.maxOldGenerationSizeMb, measurements[record.mode].heap);
      assert.equal(row.stackSizeMb, observed.stackMiB);
      assert.ok(Number.isSafeInteger(row.heapLimitBytes) && row.heapLimitBytes > 0);
      observed.effectiveHeapMinBytes = Math.min(observed.effectiveHeapMinBytes, row.heapLimitBytes);
      observed.effectiveHeapMaxBytes = Math.max(observed.effectiveHeapMaxBytes, row.heapLimitBytes);
      for (const event of [start, exit, frame]) {
        assert.ok(Number.isSafeInteger(event.rssKiB) && event.rssKiB > 0);
        peakRssKiB = Math.max(peakRssKiB, event.peakRssKiB, event.rssKiB);
      }
    }
    observed.peakRssKiB = Math.max(observed.peakRssKiB, peakRssKiB);
    childPeaks.push({mode: record.mode, workers: count, peakRssKiB});
  }
  assert.ok(byMode.lua.effectiveHeapMinBytes > byMode.tocXml.effectiveHeapMaxBytes);

  let sampledAggregateRssKiB = 0, maximumPairSkewMilliseconds = 0, activePairs = 0;
  const paired = [...samples.values()].filter(round => !round.failed && round.expected.every(record => round.readings.has(record)));
  for (const id of representative) {
    for (const stage of ['worker-start', 'reply']) assert.ok(paired.some(round => round.id === id && round.stage === stage));
  }
  for (const round of paired) {
    const [first, second] = round.expected.map(record => round.readings.get(record));
    assert.ok(first.rssKiB > 0 && second.rssKiB > 0);
    sampledAggregateRssKiB = Math.max(sampledAggregateRssKiB, first.rssKiB + second.rssKiB);
    maximumPairSkewMilliseconds = Math.max(maximumPairSkewMilliseconds, Math.abs(first.measuredAtMs - second.measuredAtMs));
    if (first.active || second.active) activePairs++;
  }
  t.diagnostic('selected-source-launcher-memory ' + JSON.stringify({
    node: process.versions.node, platform: process.platform, peakLive, requests: workload.length, byMode,
    childPeaks, pairedSamples: paired.length, activePairs, sampledAggregateRssKiB, maximumPairSkewMilliseconds,
  }));
});
