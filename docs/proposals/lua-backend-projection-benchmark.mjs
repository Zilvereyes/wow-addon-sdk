/** Compare parser projections on fixed authored Lua in a built checkout. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dist = new URL('../../packages/lua-analysis/dist/', import.meta.url);
const syntax = readFileSync(new URL('syntax.js', dist), 'utf8');
const entry = readFileSync(new URL('index.js', dist), 'utf8');
const backend = import.meta.resolve('luaparse');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');

function replaceOnce(source, anchor, replacement) {
  assert.equal(source.split(anchor).length, 2);
  return source.replace(anchor, replacement);
}

const projections = syntax.match(/scope: (?:true|false), ranges: true, locations: (?:true|false)/gu);
assert.equal(projections?.length, 1, 'expected one backend options expression in the build');
const [projection] = projections;
const analyzers = [];
for (const [name, scopes, locations] of [
  ['stock', true, true], ['withoutScopes', false, true], ['withoutLocations', true, false], ['offsetsOnly', false, false],
]) {
  const variant = replaceOnce(syntax, projection, `scope: ${scopes}, ranges: true, locations: ${locations}`);
  const importedSyntax = moduleUrl(replaceOnce(variant, "'luaparse'", JSON.stringify(backend)));
  const importedEntry = moduleUrl(replaceOnce(entry, "'./syntax.js'", JSON.stringify(importedSyntax)));
  analyzers.push({ name, analyze: (await import(importedEntry)).analyzeLua });
}

const defaults = { addonId: 'authored-lua-controls', profile: 'corpus' };
const condition = { providerId: '@wow-addon/toc-metadata-adapter', name: 'Authored', values: ['😀'], raw: '[Authored 😀]',
  source: { file: 'Authored/Base.toc', range: { start: { line: 0, column: 0 }, end: { line: 0, column: 13 } } } };
const inputs = [
  ['repeatedStatements', Array.from({ length: 10_000 }, (_, i) => `Shared = Shared + ${i % 10}`).join('\r\n')],
  ['nestedLocals', Array.from({ length: 750 }, (_, i) => `do local t = {answer=${i}}; for i = 1, 3 do Summary = t.answer + i end end`).join('\n')],
  ...[900, 4500].map(count => ['distinct' + count, Array.from({ length: count }, (_, i) => `Global${i} = ${i}`).join('\n')]),
];
const examples = [
  'local InScope=1\nfunction Public(arg) local function nested() return _G end; return arg end',
  'Box._G = 2; Box:getfenv(); Public={load=3,[require]=4}; LocalCopy=Box._G',
  'local getfenv=getfenv; local _G=Box._G; do local load=1; X = load end; Public=getfenv',
  'for _G = _G, 3 do Value=_G end; for require in require() do Other=require end',
  'local function load() return load end; function Holder:Call(load) return self._G or load end',
  'repeat local getfenv = 1; Result = getfenv until getfenv > 0',
  'if Enabled then local x=1; Value=x elseif _G then Value=2 else Value=3 end',
  'while Flag do break; end; Produce [[multi\nline]] (Arg)',
  "Produce 'multi\\\nline' (Arg)",
  'function Public(...) return ... end; local x={}; x[0]=1',
  'use("😀"); Out=1; Out=2', 'local broken =\r\n $', 'Broken = [[open', 'local = 7',
  '#!/usr/bin/lua\nGlobal=42', '\uFEFF-- 😀\r\nResult=42', 'return ...', 'load=1',
];

let matchedCases = 0;
function compare(content, file, options) {
  const expected = analyzers[0].analyze(content, file, options);
  for (const mode of analyzers.slice(1)) assert.deepEqual(mode.analyze(content, file, options), expected, mode.name + ' ' + file);
  matchedCases++;
  return expected;
}
for (const options of [defaults, { ...defaults, profile: 'bounded' }, { ...defaults, conditions: [condition], allowShebang: true },
  { ...defaults, context: { kind: 'function-body', parameters: ['require', 'require'], variadic: false } }]) {
  for (const [index, content] of examples.entries()) compare(content, `Authored/😀-${index}.lua`, options);
}

const repeats = 7;
const median = samples => Math.round(samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)] * 10) / 10;
const measurements = [];
for (const [name, content] of inputs) {
  const file = 'Authored/' + name + '.lua';
  assert.equal(compare(content, file, defaults).complete, true);
  const results = Object.fromEntries(analyzers.map(({ name: mode }) => [mode, []]));
  for (let round = 0; round < repeats; round++) {
    for (let index = 0; index < analyzers.length; index++) {
      const mode = analyzers[(round + index) % analyzers.length];
      const cpu = process.cpuUsage(), start = performance.now();
      const output = mode.analyze(content, file, defaults);
      const wall = performance.now() - start, used = process.cpuUsage(cpu);
      assert.equal(output.complete, true);
      results[mode.name].push({ wall, cpu: (used.user + used.system) / 1000 });
    }
  }
  measurements.push({ input: name, units: content.length, modes: Object.fromEntries(Object.entries(results).map(([mode, rows]) =>
    [mode, { wallMs: median(rows.map(row => row.wall)), cpuMs: median(rows.map(row => row.cpu)) }])) });
}
console.log(JSON.stringify({ node: process.versions.node, matchedCases, repeats, measurements }));
