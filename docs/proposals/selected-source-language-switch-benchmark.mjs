/** Authored timing comparison for the stock supervised parser port. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGraphAnalyzer } from '../../scripts/selected-source-analysis-client.mjs';

const json = file => JSON.parse(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'));
const rootApi = {lua: 'analyzeLua', toc: 'parseToc', xml: 'parseXml'};
const xmlPolicy = json('examples/xml-provider-profile.json').policy;
const inlineProfile = json('examples/xml-inline-lua-profile.json');
const make = (language, index, content) => ({
  language, sourcePath: 'Authored/Case' + index + '.' + language, content,
  addonId: 'authored-fixture', conditions: [], luaProfile: 'corpus',
  allowShebang: false, xmlPolicy, inlineProfile,
});
const [option, ...extraOptions] = process.argv.slice(2);
assert.ok((option === undefined || option === '--rotation') && extraOptions.length === 0,
  'Usage: node docs/proposals/selected-source-language-switch-benchmark.mjs [--rotation]');
const rotation = option === '--rotation';
const lua = Array.from({length: rotation ? 47 : 13},
  (_, i) => make('lua', i, '-- framed \u{1F642}\r\nGlobal' + i + ' = 1'));
const toc = Array.from({length: 3}, (_, i) => make('toc', i, '## Interface: 11509\r\nCore.lua\r\n'));
const xml = Array.from({length: 3}, (_, i) => make('xml', i, '<Ui><Include file="Core&amp;Helper.xml"/><Script>AuthoredValue=1</Script></Ui>'));
const grouped = [...lua, ...toc, ...xml];
const mixed = [...toc.flatMap((item, i) => [...lua.slice(i * 4, i * 4 + 4), item, xml[i]]), ...lua.slice(12)];
let expected;
for (const [mode, requests] of [['grouped', grouped], ['mixed', mixed], ['mixed', mixed], ['grouped', grouped]]) {
  const children = new Map();
  const started = {lua: 0, tocXml: 0, oneShot: 0};
  let reaped = 0;
  let peakLiveChildren = 0;
  let samePoolOverlap = 0;
  const cleanCloses = [];
  const startsToFirstBytes = [];
  const retireToClose = [];
  let activeRequest;
  let completed = 0;
  let luaRequests = 0;
  const timings = {lua: [], toc: [], xml: []};
  const rotationTimings = {first: [], last: [], afterRotation: []};
  const outputs = new Map();
  const client = createGraphAnalyzer({spawnProcess(executable, args, options) {
    const pool = args.includes('--corpus-launcher') ? 'lua' :
      args.includes('--xml-toc-launcher') ? 'tocXml' : 'oneShot';
    if ([...children.values()].includes(pool)) samePoolOverlap++;
    const launched = performance.now();
    const child = spawn(executable, args, options);
    let retiring;
    if (pool !== 'oneShot') {
      const end = child.stdin.end;
      child.stdin.end = function(...args) { retiring ??= performance.now(); return end.apply(this, args); };
    }
    child.stdout.once('data', () => {
      startsToFirstBytes.push({pool, ms: Math.round(performance.now() - launched)});
    });
    children.set(child, pool);
    peakLiveChildren = Math.max(peakLiveChildren, children.size);
    ++started[pool];
    child.once('close', (code, signal) => {
      cleanCloses.push(code === 0 && signal === null);
      if (retiring !== undefined) retireToClose.push(Math.round(performance.now() - retiring));
      children.delete(child);
      ++reaped;
    });
    return child;
  }});
  const began = performance.now();
  try {
    for (const request of requests) {
      const start = performance.now();
      activeRequest = request.language;
      const reply = await client.analyze(request);
      const elapsed = performance.now() - start;
      assert.equal(reply.result.language, request.language);
      assert.deepEqual(reply.confirmedApiCalls[rootApi[request.language]], {invoked: 1, returned: 1});
      completed++;
      timings[request.language].push(elapsed);
      if (request.language === 'lua') {
        luaRequests++;
        if (luaRequests === 1) rotationTimings.first.push(Math.round(elapsed));
        if (luaRequests === 32) rotationTimings.last.push(Math.round(elapsed));
        if (luaRequests === 33) rotationTimings.afterRotation.push(Math.round(elapsed));
      }
      outputs.set(request.sourcePath, JSON.stringify(reply));
    }
  } catch (error) {
    console.error(JSON.stringify({ mode, activeRequest, completed, failure: error.message }));
    throw error;
  } finally {
    await client.close();
  }
  const total = Math.round(performance.now() - began);
  assert.ok(peakLiveChildren <= 2);
  assert.equal(samePoolOverlap, 0);
  assert.equal(children.size, 0);
  assert.ok(cleanCloses.every(Boolean));
  assert.equal(reaped, started.lua + started.tocXml + started.oneShot);
  assert.deepEqual(started, {lua: 1 + Number(rotation), tocXml: 1, oneShot: 0});
  assert.equal(completed, requests.length);
  assert.equal(outputs.size, requests.length);
  assert.equal(luaRequests, lua.length);
  assert.equal(rotationTimings.first.length, 1);
  assert.equal(rotationTimings.last.length, Number(rotation));
  assert.equal(rotationTimings.afterRotation.length, Number(rotation));
  assert.equal(startsToFirstBytes.length, reaped);
  const ordered = [...outputs.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (expected) assert.deepEqual(ordered, expected);
  else expected = ordered;
  console.log(JSON.stringify({
    mode, total, started, reaped, peakLiveChildren, replyCount: outputs.size, startsToFirstBytes, retireToClose, rotationTimings,
    replyDigest: createHash('sha256').update(JSON.stringify(ordered)).digest('hex'),
    perLanguageMilliseconds: Object.fromEntries(Object.entries(timings)
      .map(([language, values]) => [language, Math.round(values.reduce((a, b) => a + b, 0))])),
  }));
}
