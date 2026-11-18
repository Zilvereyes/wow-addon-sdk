import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {prepareExperiment} from './prepare.mjs';

const maximumUnits = 4_194_304;
const expectedCalls = {invoked: 1, returned: 1};
const graphFixture = file => JSON.parse(readFileSync(new URL('../../../examples/' + file, import.meta.url), 'utf8'));
const xmlPolicy = graphFixture('xml-provider-profile.json').policy;
const inlineProfile = graphFixture('xml-inline-lua-profile.json');
const conditionText = '[AllowLoadGameType AuthoredUnknown]';
const condition = {
  providerId: '@wow-addon/toc-metadata-adapter', name: 'AllowLoadGameType', raw: conditionText, values: ['AuthoredUnknown'],
  source: {file: 'Authored/Manifest.toc', range: {start: {line: 0, column: 0}, end: {line: 0, column: conditionText.length}}},
};

function fixture(group, number, content, {codes = [], conditions = [], allowShebang = false} = {}) {
  return {codes, request: {language: 'lua', content, sourcePath: 'Authored/Å😀-' + group + '-' + number + '.lua',
    addonId: 'authored-worker-reuse', conditions, luaProfile: 'corpus', allowShebang, xmlPolicy, inlineProfile}};
}

function sizedComment(units) {
  const prefix = '--[[😀';
  const suffix = ']]\r\nGlobal = 1\r\nGlobal = 2';
  const source = prefix + 'x'.repeat(units - prefix.length - suffix.length) + suffix;
  assert.equal(source.length, units);
  assert.equal(Buffer.byteLength(source), units + 2);
  return source;
}

function fixturesForBoundaries() {
  const queue = [];
  const add = (source, options) => queue.push(fixture('boundary', queue.length + 1, source, options));
  add('\uFEFF-- 😀\r\nResult = 1; Result = 2');
  add('Conditional = 1; Conditional = 2', {conditions: [condition]});
  add('if then', {codes: ['LUA0002']});
  add('local broken = $', {codes: ['LUA0002']});
  add('local require = function() end; require(); Recovered = 1');
  add('Unconditional = 1');
  add('local owned = 1; Seventh = owned');
  add('Eighth = 1');
  const ninth = 'Ninth = 1';
  add(ninth);
  add(sizedComment(maximumUnits - ninth.length));
  add(sizedComment(maximumUnits / 2));
  add(sizedComment(maximumUnits / 2 + 1));
  add(sizedComment(maximumUnits + 1));
  add('AfterLarge = 1');
  add('Data = ' + '{key='.repeat(1_100) + '1' + '}'.repeat(1_100), {codes: ['LUA0003']});
  add('AfterDepth = 1');
  add('#!authored\r\nAccepted = 1', {allowShebang: true});
  add('#!authored\r\nRejected = 1', {codes: ['LUA0002']});
  add('AfterShebang = 1');
  while (queue.length < 33) add('Next = ' + queue.length);
  return queue;
}

function fixturesForTiming() {
  const declarations = count => Array.from({length: count}, (_, i) => 'do local item=' + i + '; Summary=item end').join('\r\n');
  const sources = ['local token = 1; Tiny = token', declarations(220), declarations(1_100), sizedComment(615_025)];
  const rotation = [1, 0, 1, 2, 1, 0, 1, 3];
  const sequence = [...rotation, ...rotation, ...rotation, 1];
  return sequence.map((type, index) => fixture('timing', index + 1, sources[type]));
}

function recognizeEvents(stderr) {
  return stderr.split(/\r?\n/u).flatMap(line => {
    if (!line.trim()) return [];
    const opening = line.indexOf('{');
    if (opening < 0) return [];
    let event;
    try { event = JSON.parse(line.slice(opening)); }
    catch { return []; }
    return ['worker-start', 'worker-sample', 'worker-exit'].includes(event?.type) ? [event] : [];
  });
}

function collectWorkerEvidence(children, queue, mode) {
  const groups = [];
  const sampleIds = [];
  const heapLimits = new Set();
  for (const child of children) {
    assert.deepEqual(child.close, {code: 0, signal: null}, mode + ' launcher clean close');
    const all = new Map();
    let live = null;
    for (const event of recognizeEvents(child.stderr)) {
      const {threadId} = event;
      assert.ok(Number.isSafeInteger(threadId) && threadId > 0);
      if (event.type === 'worker-start') {
        assert.equal(live, null, mode + ' started a Worker before the previous exit');
        assert.ok(!all.has(threadId), mode + ' duplicated a thread identity');
        const group = {ids: [], units: 0, rssPeak: 0, heapPeak: 0, closed: false};
        all.set(threadId, group);
        groups.push(group);
        live = threadId;
      } else if (event.type === 'worker-sample') {
        const group = all.get(threadId);
        assert.ok(group, mode + ' sampled an unknown Worker');
        assert.equal(live, threadId, mode + ' sampled a Worker that exited');
        assert.ok(Number.isSafeInteger(event.id) && event.id > 0 && event.id <= queue.length);
        const units = queue[event.id - 1].request.content.length;
        if (event.units !== undefined) assert.equal(event.units, units);
        sampleIds.push(event.id);
        group.ids.push(event.id);
        group.units += units;
        for (const name of ['rss', 'heapUsed']) assert.ok(Number.isFinite(event[name]) && event[name] > 0, mode + ' ' + name + ' measurement');
        assert.ok(Number.isSafeInteger(event.limit) && event.limit > 0, mode + ' effective heap limit');
        heapLimits.add(event.limit);
        group.rssPeak = Math.max(group.rssPeak, event.rss);
        group.heapPeak = Math.max(group.heapPeak, event.heapUsed);
      } else {
        assert.equal(live, threadId, mode + ' acknowledged a Worker other than the live Worker');
        all.get(threadId).closed = true;
        live = null;
      }
    }
    assert.equal(live, null, mode + ' launcher closed before Worker exit');
  }
  assert.deepEqual(sampleIds, queue.map((_, i) => i + 1), mode + ' trace correlation');
  for (const group of groups) {
    assert.ok(group.closed && group.ids.length >= 1);
    if (mode === 'stock') assert.equal(group.ids.length, 1);
    else {
      assert.ok(group.ids.length <= 8, mode + ' request budget');
      if (group.units > maximumUnits) {
        assert.equal(group.ids.length, 1, mode + ' dedicated overweight request');
        assert.ok(queue[group.ids[0] - 1].request.content.length > maximumUnits);
      }
    }
  }
  return {
    launchers: children.length, workerStarts: groups.length, workerExits: groups.filter(group => group.closed).length,
    heapLimits: [...heapLimits].sort((a, b) => a - b),
    groups: groups.map(({closed, ...group}) => group),
  };
}

async function run(create, queue, mode) {
  const children = [];
  const results = [];
  const times = [];
  const analyzer = create({spawnProcess(executable, args, options) {
    assert.ok(children.every(child => child.close !== undefined), mode + ' replaced a live launcher');
    const child = spawn(executable, args, options);
    const row = {stderr: '', close: undefined};
    children.push(row);
    child.stderr.setEncoding('utf8').on('data', chunk => { row.stderr += chunk; });
    child.once('close', (code, signal) => { row.close = {code, signal}; });
    return child;
  }});
  try {
    for (const {request, codes} of queue) {
      const start = performance.now();
      const reply = await analyzer.analyze(request);
      times.push(performance.now() - start);
      assert.deepEqual(reply.confirmedApiCalls.analyzeLua, expectedCalls, request.sourcePath);
      assert.equal(reply.result.language, 'lua');
      assert.deepEqual(reply.result.result.diagnostics.map(row => row.code), codes, request.sourcePath);
      results.push(reply);
    }
  } finally { await analyzer.close(); }
  assert.equal(children.length, Math.ceil(queue.length / 32));
  return {results, times, evidence: collectWorkerEvidence(children, queue, mode)};
}

function summarizeTiming({times, evidence}) {
  const warm = times.slice(1);
  const sorted = [...warm].sort((a, b) => a - b);
  const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
  const round = value => Math.round(value * 100) / 100;
  return {
    replies: times.length, warmCalls: warm.length, warmMedianMs: round(median),
    warmP90Ms: round(sorted[Math.ceil(sorted.length * 0.9) - 1]),
    warmTotalMs: round(warm.reduce((sum, value) => sum + value, 0)), firstMs: round(times[0]),
    ...evidence,
  };
}

const options = process.argv.slice(2);
assert.ok(options.length < 2 && options.every(option => ['--boundaries-only', '--timing-only'].includes(option)),
  'Usage: node measure.mjs [--boundaries-only|--timing-only]');
const {createStock, createCandidate, cleanup} = await prepareExperiment();
const evidence = {node: process.versions.node, platform: process.platform, boundaries: null, timing: []};
try {
  if (!options.includes('--timing-only')) {
    const queue = fixturesForBoundaries();
    const stock = await run(createStock, queue, 'stock');
    const candidate = await run(createCandidate, queue, 'candidate');
    assert.deepEqual(candidate.results, stock.results);
    assert.deepEqual(candidate.evidence.heapLimits, stock.evidence.heapLimits);
    assert.deepEqual(candidate.evidence.groups.map(group => group.ids), [
      [1, 2, 3, 4, 5, 6, 7, 8], [9, 10], [11], [12], [13], [14, 15],
      [16, 17, 18, 19, 20, 21, 22, 23], [24, 25, 26, 27, 28, 29, 30, 31], [32], [33],
    ]);
    assert.equal(candidate.evidence.groups[1].units, maximumUnits);
    assert.equal(candidate.evidence.groups[4].units, maximumUnits + 1);
    const spans = candidate.results[0].result.result.declarations.map(row => row.source.range);
    assert.deepEqual(spans, [
      {start: {line: 1, column: 0}, end: {line: 1, column: 6}},
      {start: {line: 1, column: 12}, end: {line: 1, column: 18}},
    ]);
    assert.deepEqual(candidate.results[1].result.result.declarations.map(row => row.conditions), [[condition], [condition]]);
    evidence.boundaries = {comparedReplies: queue.length, stock: stock.evidence, candidate: candidate.evidence};
  }
  if (!options.includes('--boundaries-only')) {
    const queue = fixturesForTiming();
    let baseline;
    for (const order of [['stock', 'candidate'], ['candidate', 'stock']]) {
      const pair = {order};
      for (const mode of order) {
        const observed = await run(mode === 'stock' ? createStock : createCandidate, queue, mode);
        if (baseline === undefined) baseline = observed.results;
        else assert.deepEqual(observed.results, baseline);
        assert.equal(observed.evidence.workerStarts, mode === 'stock' ? 25 : 4);
        pair[mode] = summarizeTiming(observed);
      }
      assert.deepEqual(pair.candidate.heapLimits, pair.stock.heapLimits);
      pair.warmMedianImprovementPercent = Math.round(10_000 * (1 - pair.candidate.warmMedianMs / pair.stock.warmMedianMs)) / 100;
      pair.meetsWarmMedianTarget = pair.warmMedianImprovementPercent >= 25;
      evidence.timing.push(pair);
    }
  }
} finally { await cleanup(); }
console.log(JSON.stringify(evidence));
