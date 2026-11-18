/** Compare two isolated parser supervisors on an identical, authored workload. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createGraphAnalyzer as stock } from './scripts/selected-source-analysis-client.mjs';
import { createGraphAnalyzer as candidate } from './scripts/prototype-analysis-client.mjs';

const load = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const xmlPolicy = load('./examples/xml-provider-profile.json').policy;
const inlineProfile = load('./examples/xml-inline-lua-profile.json');
const unknown = {
  providerId: '@wow-addon/toc-metadata-adapter', name: 'AuthoredUnknown', raw: '[AllowLoadGameType AuthoredUnknown]',
  values: ['AuthoredUnknown'],
  source: { file: 'Authored/Manifest.toc', range: { start: { line: 0, column: 0 }, end: { line: 0, column: 35 } } },
};

const request = (language, index, content, conditions = []) => ({
  language, sourcePath: 'Authored/Case' + index + '.' + language, content, addonId: 'authored-fixture',
  conditions, luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile,
});

const lua = Array.from({length: 33}, (_, index) => request('lua', index,
  index === 0 ? '-- authored 🙂\r\nlocal broken ='
    : index === 3 ? '-- authored 🙂\r\n' + Array.from({length: 768}, (_, i) => 'AuthoredWide' + i + ' = ' + i).join('\r\n')
    : '-- authored 🙂\r\nAuthoredGlobal' + index + ' = ' + index,
  index === 1 ? [unknown] : []));
const xmlToc = Array.from({length: 33}, (_, index) => {
  if (index === 1) return request('xml', index,
    '<Ui>\r\n<!--🙂--><Include file="Core&amp;Helper.xml"/><Include file="Core&amp;Helper.xml"/>' +
    '<Script>AuthoredInline = 1</Script><Frame name="AuthoredFrame"><Scripts>' +
    '<OnLoad>AuthoredHandler = self</OnLoad></Scripts></Frame>\r\n</Ui>', [unknown]);
  if (index === 2) return request('xml', index, '<Ui>' + '<Frame>'.repeat(254) + '</Frame>'.repeat(254) + '</Ui>');
  if (index === 3) return request('xml', index, '<Ui><Frame></Ui>');
  if (index === 5) return request('xml', index, '<Ui>' +
    '<Include file="Authored&amp;Target.xml"/>'.repeat(240) + '<Script>AuthoredInline = 1</Script>'.repeat(32) + '</Ui>');
  if (index % 2 === 0) return request('toc', index,
    '## Interface: 11509\r\n## Title: 🙂 Authored\r\n## SavedVariables: Authored, Authored\r\nCore.lua\r\nCore.lua\r\n');
  return request('xml', index, '<Ui><Include file="Core.lua"/></Ui>');
});
// Three switches while both candidate launchers are live. Both candidate pools
// then cross request 32 without relying on a test-only limit or a shortened cap.
const workload = [...lua.slice(0, 3).flatMap((item, index) => [item, xmlToc[index]]),
  ...lua.slice(3), ...xmlToc.slice(3)];
const [option, ...extra] = process.argv.slice(2);
assert.ok((option === undefined || option === '--ab' || option === '--ba') && extra.length === 0,
  'Usage: node measure-prototype.mjs [--ab|--ba]');
const series = option === '--ab' ? ['stock','candidate'] : option === '--ba' ? ['candidate','stock'] :
  ['stock','candidate','candidate','stock'];

function verifyFixtureReply(input, reply) {
  const {result, confirmedApiCalls: calls} = reply;
  assert.equal(result.language, input.language);
  const root = {toc: 'parseToc', lua: 'analyzeLua', xml: 'parseXml'}[input.language];
  assert.deepEqual(calls[root], {invoked: 1, returned: 1});
  if (input === lua[0]) assert.ok(result.result.diagnostics.some(row => row.code === 'LUA0002'));
  if (input === lua[1]) assert.equal(result.result.declarations.length, 1);
  if (input === xmlToc[0]) assert.equal(result.parsed.metadata.fileEntries.length, 2);
  if (input === xmlToc[1]) {
    assert.equal(result.provider.references.length, 2);
    assert.deepEqual(result.provider.references.map(row => row.target.value), ['Core&Helper.xml','Core&Helper.xml']);
    const range = result.provider.references[0].target.source.range;
    const line = input.content.split('\r\n')[range.start.line];
    assert.equal(line.slice(range.start.column,range.end.column), 'Core&amp;Helper.xml');
    assert.deepEqual(calls.analyzeLua, {invoked: 2, returned: 2});
  }
  if (input === xmlToc[2]) {
    assert.equal(result.syntax.complete, true);
    assert.equal(result.syntax.elements.length, 255);
  }
  if (input === xmlToc[3]) {
    assert.equal(result.syntax.complete, false);
    assert.equal(result.provider, null);
    assert.deepEqual(calls.analyzeXml, {invoked: 0, returned: 0});
  }
  if (input === xmlToc[5]) {
    assert.equal(result.provider.references.length, 240);
    assert.deepEqual(calls.analyzeLua, {invoked: 32, returned: 32});
  }
}

let reference;
let failures = 0;
for (const model of series) {
  const known = model === 'stock';
  const started = {lua: 0, xmlToc: 0, oneShot: 0};
  const reaped = {lua: 0, xmlToc: 0, oneShot: 0};
  const children = new Map(), firstBytes = [], closeMs = [];
  const replyMs = {lua: [], xml: [], toc: []}, rotation = {lua: {}, xmlToc: {}};
  const poolCalls = {lua: 0, xmlToc: 0};
  const results = [];
  let maxLiveChildren = 0, nonzeroExits = 0, current, largestSerializedReplyBytes = 0;
  const analyzer = (known ? stock : candidate)({spawnProcess(executable, args, options) {
    const pool = args.includes('--corpus-launcher') ? 'lua'
      : args.includes('--xml-toc-launcher') ? 'xmlToc' : 'oneShot';
    assert.ok(![...children.values()].includes(pool), 'Pool replacement attempted before close');
    assert.ok(children.size < (known ? 1 : 2), 'Process ceiling exceeded');
    const launch = performance.now();
    const child = spawn(executable, args, options);
    children.set(child, pool);
    started[pool]++;
    maxLiveChildren = Math.max(maxLiveChildren, children.size);
    child.stdout.once('data', () => firstBytes.push({pool, ms: Math.round(performance.now() - launch)}));
    let endRequested;
    const end = child.stdin.end;
    child.stdin.end = function (...args) {
      endRequested ??= performance.now();
      return end.apply(this, args);
    };
    child.once('close', (code, signal) => {
      children.delete(child);
      ++reaped[pool];
      if (code !== 0 || signal !== null) nonzeroExits++;
      if (endRequested !== undefined) closeMs.push({pool, ms: Math.round(performance.now() - endRequested)});
    });
    return child;
  }});
  const start = performance.now();
  let failure;
  try {
    for (const input of workload) {
      current = input.sourcePath;
      const pool = input.language === 'lua' ? 'lua' : 'xmlToc';
      const call = ++poolCalls[pool];
      const sent = performance.now();
      const reply = await analyzer.analyze(input);
      const elapsed = Math.round(performance.now() - sent);
      verifyFixtureReply(input, reply);
      replyMs[input.language].push(elapsed);
      if ([1, 32, 33].includes(call)) rotation[pool][call] = elapsed;
      if (!known && call === 32) {
        assert.equal(reaped[pool], 1, 'Reply at rotation arrived before confirmed process close');
        assert.equal(started[pool], 1);
      }
      if (!known && call === 33) assert.equal(started[pool], 2, 'First call after rotation must start a second process');
      const serialized = JSON.stringify(reply);
      largestSerializedReplyBytes = Math.max(largestSerializedReplyBytes, Buffer.byteLength(serialized));
      results.push(serialized);
    }
  } catch (error) {
    failure = error;
  } finally {
    await analyzer.close();
  }
  const elapsedMs = Math.round(performance.now() - start);
  if (failure) {
    console.log(JSON.stringify({model, fixture: current, replies: results.length, error: failure.message,
      elapsedMs, started, reaped, maxLiveChildren, firstBytes}));
    assert.equal(children.size, 0);
    if (failure.message !== 'graph-analysis-timeout') throw failure;
    failures++;
    continue;
  }
  assert.equal(results.length, 66);
  assert.equal(maxLiveChildren, known ? 1 : 2);
  assert.deepEqual(started, known ? {lua: 4, xmlToc: 0, oneShot: 33} : {lua: 2, xmlToc: 2, oneShot: 0});
  assert.deepEqual(reaped, started);
  assert.equal(children.size, 0);
  assert.equal(nonzeroExits, 0);
  assert.equal(firstBytes.length, started.lua + started.xmlToc + started.oneShot);
  if (reference) {
    results.forEach((reply,i) => assert.equal(reply, reference[i], 'Reply/receipt differs at ' + workload[i].sourcePath));
  } else reference = results;
  const summaries = Object.fromEntries(Object.entries(replyMs).map(([language, values]) =>
    [language, {count: values.length, totalMs: values.reduce((sum, n) => sum + n, 0), maxMs: Math.max(...values)}]));
  console.log(JSON.stringify({
    model, platform: process.platform, node: process.versions.node, replies: results.length, elapsedMs,
    started, reaped, maxLiveChildren, rotation, firstBytes, closeMs, summaries, largestSerializedReplyBytes,
    replyDigest: createHash('sha256').update(JSON.stringify(results)).digest('hex'),
  }));
}
if (failures) process.exitCode = 1;
