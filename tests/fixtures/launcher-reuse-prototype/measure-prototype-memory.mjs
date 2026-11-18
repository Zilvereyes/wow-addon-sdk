/** Scratch-only per-process memory and Worker lifecycle observation. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const write = (file, content) => writeFileSync(new URL(file, import.meta.url), content, {flag: 'wx'});
function replace(source, anchor, value) {
  assert.equal(source.split(anchor).length, 2, 'Exactly one instrumentation anchor required');
  return source.replace(anchor, value);
}
const instrumentation = `
import {writeSync} from 'node:fs';
import {getHeapStatistics} from 'node:v8';
import {threadId, resourceLimits as runtimeLimits} from 'node:worker_threads';
function trace(phase, requestId, parserThread = threadId) {
  writeSync(2, JSON.stringify({phase, requestId, parserThread, stamp: Date.now(),
    rssKiB: Math.round(process.memoryUsage.rss() / 1024),
    peakKiB: process.resourceUsage().maxRSS,
    v8HeapMiB: getHeapStatistics().heap_size_limit / (1024 * 1024),
    stackMiB: runtimeLimits.stackSizeMb ?? null}) + '\\n');
}
`;
async function instrument(client, worker) {
  const observedClient = 'memory-' + client;
  const observedWorker = 'memory-' + worker;
  let workerSource = read('./scripts/' + worker);
  workerSource = replace(workerSource, "import {createInterface} from 'node:readline';",
    "import {createInterface} from 'node:readline';" + instrumentation);
  workerSource = replace(workerSource, 'if (!isMainThread) parentPort.postMessage(await analyze(workerData));',
    'if (!isMainThread) {\n  trace(\'worker-start\', workerData.id);\n  const reply = await analyze(workerData);\n  trace(\'worker-parsed\', workerData.id);\n  parentPort.postMessage(reply);\n}');
  workerSource = replace(workerSource, 'let reply;\n      if (',
    'let reply;\n      trace(\'request\', request.id);\n      if (');
  workerSource = replace(workerSource, "thread.once('message', resolve); thread.once('error', reject);",
    "thread.once('message', resolve); thread.once('error', reject);");
  workerSource = replace(workerSource, '        try {\n          reply = await new Promise(',
    '        const parserThread = thread.threadId;\n        try {\n          reply = await new Promise(');
  workerSource = replace(workerSource, '} finally { await thread.terminate(); }',
    '} finally { await thread.terminate(); trace(\'worker-joined\', request.id, parserThread); }');
  workerSource = replace(workerSource, '      process.stdout.write(',
    '      trace(\'frame\', request.id);\n      process.stdout.write(');
  write('./scripts/' + observedWorker, workerSource);
  write('./scripts/' + observedClient, replace(read('./scripts/' + client), worker, observedWorker));
  return (await import('./scripts/' + observedClient)).createGraphAnalyzer;
}

const xmlPolicy = JSON.parse(read('./examples/xml-provider-profile.json')).policy;
const inlineProfile = JSON.parse(read('./examples/xml-inline-lua-profile.json'));
const sources = [
  ['lua', '-- prime Lua\nFirstGlobal = 1'],
  ['xml', '<Ui>' + '<Include file="Authored&amp;Target.xml"/>'.repeat(900) + '</Ui>'],
  ['toc', '## Interface: 11509\r\nCore.lua\r\n'],
  ['xml', '<Ui>' + '<Frame>'.repeat(255) + '</Frame>'.repeat(255) + '</Ui>'],
  ['lua', Array.from({length: 1800}, (_, i) => 'AuthoredVar' + i + ' = ' + i).join('\n')],
  ['xml', '<Ui>' + '<Frame>'.repeat(256) + '</Frame>'.repeat(256) + '</Ui>'],
];
const requests = sources.map(([language, content], i) => ({language, content,
  sourcePath: 'Authored/Case' + i + '.' + language, addonId: 'authored-fixture', conditions: [],
  luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile,
}));
const modes = [
  ['stock', 'selected-source-analysis-client.mjs', 'selected-source-analysis-worker.mjs'],
  ['candidate', 'prototype-analysis-client.mjs', 'prototype-analysis-worker.mjs'],
];
let reference;
for (const [name, client, worker] of modes) {
  const make = await instrument(client, worker);
  const records = [];
  const port = make({spawnProcess(executable, args, options) {
    const child = spawn(executable, args, options);
    const record = {pool: args.at(-1).startsWith('--') ? args.at(-1) : 'one-shot', buffer: '', close: null};
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', data => { record.buffer += data; });
    child.once('close', (code, signal) => { record.close = {code, signal, stamp: Date.now()}; });
    records.push(record);
    return child;
  }});
  const replies = [];
  let failure;
  try {
    for (const input of requests) replies.push(await port.analyze(input));
  } catch (error) { failure = error; }
  finally { await port.close(); }
  if (failure) { console.log(JSON.stringify({mode: name, replies: replies.length, failure: failure.message})); throw failure; }
  assert.equal(replies[1].result.provider.references.length, 900);
  assert.equal(replies[3].result.syntax.complete, true);
  assert.equal(replies[3].result.syntax.elements.length, 256);
  assert.equal(replies[5].result.syntax.complete, false);
  assert.ok(replies[5].result.syntax.diagnostics.some(row => row.code === 'XML0003'));
  if (reference) assert.deepEqual(replies, reference);
  else reference = replies;
  const lifecycle = [], processes = [];
  const snapshots = [];
  for (const [index, record] of records.entries()) {
    assert.equal(record.close?.code, 0);
    assert.equal(record.close?.signal, null);
    const events = record.buffer.trim().split('\n').map(row => JSON.parse(row));
    const ids = new Set();
    for (const event of events.filter(row => row.phase === 'worker-start')) {
      assert.ok(!ids.has(event.parserThread));
      ids.add(event.parserThread);
      const stages = events.filter(row => row.requestId === event.requestId).map(row => row.phase);
      assert.deepEqual(stages, ['request','worker-start','worker-parsed','worker-joined','frame']);
      lifecycle.push({pool: record.pool, v8HeapMiB: event.v8HeapMiB, stackMiB: event.stackMiB});
    }
    processes.push({pool: record.pool, measuredPeakKiB: Math.max(...events.map(event => event.peakKiB))});
    events.forEach(event => snapshots.push({index, stamp: event.stamp, rssKiB: event.rssKiB}));
    snapshots.push({index, stamp: record.close.stamp, rssKiB: 0});
  }
  assert.equal(lifecycle.length, name === 'stock' ? 2 : 6);
  const recent = new Map();
  let sampledCombinedKiB = 0;
  for (const sample of snapshots.sort((a, b) => a.stamp - b.stamp)) {
    recent.set(sample.index,sample.rssKiB);
    sampledCombinedKiB = Math.max(sampledCombinedKiB,[...recent.values()].reduce((a,b) => a+b,0));
  }
  console.log(JSON.stringify({mode: name, replies: replies.length, largestReplyBytes: Buffer.byteLength(JSON.stringify(replies[1])),
    lifecycle, processes, sampledCombinedKiB}));
}
