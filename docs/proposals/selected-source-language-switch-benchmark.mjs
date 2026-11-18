/** Authored timing comparison for the stock supervised parser port. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGraphAnalyzer } from '../../scripts/selected-source-analysis-client.mjs';

const json = file => JSON.parse(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'));
const xmlPolicy = json('examples/xml-provider-profile.json').policy;
const inlineProfile = json('examples/xml-inline-lua-profile.json');
const make = (language, index, content) => ({
  language, sourcePath: 'Authored/Case' + index + '.' + language, content,
  addonId: 'authored-fixture', conditions: [], luaProfile: 'corpus',
  allowShebang: false, xmlPolicy, inlineProfile,
});
const lua = Array.from({length: 13}, (_, i) => make('lua', i, '-- framed \u{1F642}\r\nGlobal' + i + ' = 1'));
const toc = Array.from({length: 3}, (_, i) => make('toc', i, '## Interface: 11509\r\nCore.lua\r\n'));
const xml = Array.from({length: 3}, (_, i) => make('xml', i, '<Ui><Include file="Core&amp;Helper.xml"/><Script>AuthoredValue=1</Script></Ui>'));
const grouped = [...lua, ...toc, ...xml];
const mixed = [...toc.flatMap((item, i) => [...lua.slice(i * 4, i * 4 + 4), item, xml[i]]), lua[12]];
let expected;
for (const [mode, requests] of [['grouped', grouped], ['mixed', mixed], ['mixed', mixed], ['grouped', grouped]]) {
  const children = new Set();
  const started = {launchers: 0, oneShot: 0};
  let reaped = 0;
  let overlap = 0;
  const cleanCloses = [];
  const startsToFirstBytes = [];
  const retireToClose = [];
  let activeRequest;
  let completed = 0;
  const timings = {lua: [], toc: [], xml: []};
  const outputs = new Map();
  const client = createGraphAnalyzer({spawnProcess(executable, args, options) {
    if (children.size) overlap++;
    const launched = performance.now();
    const child = spawn(executable, args, options);
    const launcher = args.includes('--corpus-launcher');
    let retiring;
    if (launcher) {
      const end = child.stdin.end;
      child.stdin.end = function(...args) { retiring ??= performance.now(); return end.apply(this, args); };
    }
    child.stdout.once('data', () => {
      startsToFirstBytes.push({ launcher, ms: Math.round(performance.now() - launched) });
    });
    children.add(child);
    ++started[launcher ? 'launchers' : 'oneShot'];
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
      completed++;
      timings[request.language].push(performance.now() - start);
      outputs.set(request.sourcePath, JSON.stringify(reply));
    }
  } catch (error) {
    console.error(JSON.stringify({ mode, activeRequest, completed, failure: error.message }));
    throw error;
  } finally {
    await client.close();
  }
  const total = Math.round(performance.now() - began);
  assert.equal(overlap, 0);
  assert.equal(children.size, 0);
  assert.ok(cleanCloses.every(Boolean));
  assert.equal(reaped, started.launchers + started.oneShot);
  assert.equal(started.launchers, mode === 'mixed' ? 4 : 1);
  assert.equal(started.oneShot, 6);
  assert.equal(outputs.size, 19);
  const ordered = [...outputs.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (expected) assert.deepEqual(ordered, expected);
  else expected = ordered;
  console.log(JSON.stringify({
    mode, total, started, reaped, replyCount: outputs.size, startsToFirstBytes, retireToClose,
    replyDigest: createHash('sha256').update(JSON.stringify(ordered)).digest('hex'),
    perLanguageMilliseconds: Object.fromEntries(Object.entries(timings)
      .map(([language, values]) => [language, Math.round(values.reduce((a, b) => a + b, 0))])),
  }));
}
