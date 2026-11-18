import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { verifyTypeScriptContract } from './test-node.mjs';
import { parseToc } from '@wow-addon/toc-parser';
import { WoWClient } from '@wow-addon/addon-metadata';
import { resolveGlobalRegistry, toGlobalDeclarations } from '@wow-addon/toc-metadata-adapter';

let analysis;
try { analysis = await import('@wow-addon/lua-analysis'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
function analyze(content, options = { addonId: 'installation/Å' }, path = 'Fixture.lua') {
  assert.equal(typeof analysis?.analyzeLua, 'function', 'approved Lua analysis export is absent');
  return analysis.analyzeLua(content, path, options);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const names = result => result.declarations.map(d => d.name);
const codes = result => result.diagnostics.map(d => d.code);
const condition = () => ({ providerId: '@wow-addon/toc-metadata-adapter', name: 'AllowLoadGameType',
  values: ['vanilla'], raw: '[AllowLoadGameType vanilla]',
  source: { file: 'Header.toc', range: { start: { line: 0, column: 2 }, end: { line: 0, column: 29 } } } });

test('three approved Lua exports have readonly contracts without exposing a backend AST', () => {
  verifyTypeScriptContract('tests/contracts/lua-analysis.ts');
});

const catalog = JSON.parse(fs.readFileSync('tests/fixtures/lua-xml-syntax.json', 'utf8'));
assert.equal(catalog.lua.length, 24);
for (const vector of catalog.lua) {
  test(`real SDK Lua syntax: ${vector.id}`, () => {
    const result = analyze(vector.source);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.complete, vector.syntax === 'valid');
    assert.deepEqual(codes(result), vector.syntax === 'valid' ? [] : ['LUA0002']);
    if (vector.syntax === 'invalid') assert.deepEqual(result.declarations, []);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    for (const span of vector.spans ?? []) {
      const declaration = result.declarations.find(d => d.name === span.raw);
      assert.ok(declaration);
      assert.equal(vector.source.slice(...span.offsets), declaration.name);
      assert.deepEqual(declaration.source.range, {
        start: { line: span.start[0], column: span.start[1] },
        end: { line: span.end[0], column: span.end[1] },
      });
    }
  });
}

test('direct assignments/functions retain occurrences, exact identities and first lexical order', () => {
  const result = analyze('DB, Other = {}, nil; DB = 2; function Public() end', { addonId: ' __proto__ ' }, 'Å\\Fixture.lua');
  assert.equal(result.complete, true);
  assert.deepEqual(names(result), ['DB', 'Other', 'DB', 'Public']);
  assert.ok(result.declarations.every(d => d.kind === 'lua-global' && !Object.hasOwn(d, 'scope') &&
    d.activationState === 'unconditional' && d.addonId === ' __proto__ ' && d.source.file === 'Å\\Fixture.lua'));
  assert.deepEqual(result.declarations[0].source.range, { start: { line: 0, column: 0 }, end: { line: 0, column: 2 } });
  assert.equal(Object.hasOwn(result.declarations[0], 'conditions'), false);
});

test('locals, parameters, loops, local functions and local function-name targets are excluded', () => {
  const result = analyze(`local DB = DB; DB = {}; function DB() end
local function F(param) local DB; DB = 1; param = 2; Inner = 3 end
for i, v in pairs({}) do i = 1; Loop = v end
function Public(param) param = 1; Nested = 2 end`);
  assert.equal(result.complete, true);
  assert.deepEqual(names(result), ['Inner', 'Loop', 'Public', 'Nested']);
  assert.deepEqual(result.declarations.map(d => d.activationState), ['unknown', 'unknown', 'unconditional', 'unknown']);
});

test('a later local does not erase an earlier global assignment', () => {
  const result = analyze('DB = 1; local DB = 2; DB = 3; do local Other; Other = 4 end; Last = 5');
  assert.deepEqual(names(result), ['DB', 'Last']);
});

test('table fields, member writes and method declarations never invent direct-name globals', () => {
  const result = analyze("local T = {}; T.a = 1; T['b'] = 2; function T:method() self.x = 3 end; Global = { field = 1 }");
  assert.equal(result.complete, true);
  assert.deepEqual(names(result), ['Global']);
});

test('field names and shadowing leave only the nonlocal environment read with its original UTF-16 range', () => {
  const line = 'Title="😀"; Box._G=1; Box:getfenv(); Meta={load=1}; local require = require';
  const result = analyze(line + '\r\nMeta = 2');
  const column = line.lastIndexOf('require');
  assert.equal(result.complete, false);
  assert.deepEqual(names(result), ['Title', 'Meta', 'Meta']);
  assert.ok(result.declarations.every(declaration => declaration.activationState === 'unknown'));
  assert.deepEqual(result.declarations[2].source.range, { start: { line: 1, column: 0 }, end: { line: 1, column: 4 } });
  assert.deepEqual(codes(result), ['LUA0004']);
  assert.deepEqual(result.diagnostics[0].source.range, {
    start: { line: 0, column }, end: { line: 0, column: column + 'require'.length },
  });
});

test('non-direct statements remain runtime-unknown and nested functions never become active by inference', () => {
  const result = analyze('if flag then A = 1 end; do B = 1 end; while flag do C = 1 end; function F() D = 1 end; E = function() G = 1 end');
  assert.deepEqual(names(result), ['A', 'B', 'C', 'F', 'D', 'E', 'G']);
  assert.deepEqual(result.declarations.map(d => d.activationState),
    ['unknown', 'unknown', 'unknown', 'unconditional', 'unknown', 'unconditional', 'unknown']);
});

test('dynamic environment access/rebinding is incomplete and cannot make supported names active', () => {
  for (const text of ['DB = 1; _G[key] = 2', 'DB = 1; setfenv(1, {})', 'DB = 1; local env = getfenv()',
    'DB = 1; local alias = _G; alias[key] = 1', 'DB = 1; loadstring(text)()']) {
    const result = analyze(text);
    assert.equal(result.complete, false);
    assert.ok(codes(result).includes('LUA0004'));
    assert.deepEqual(names(result), ['DB']);
    assert.equal(result.declarations[0].activationState, 'unknown');
  }
  assert.equal(analyze('local function setfenv() end; setfenv(); DB = 1').complete, true);
  assert.equal(analyze('local _G = {}; _G[key] = 1; DB = 1').complete, true);
});

test('inherited restrictions and all returned source trees are independent copies', () => {
  const options = freeze({ addonId: 'caller', conditions: [condition()] });
  const before = JSON.stringify(options);
  const first = analyze('First, Second = 1, 2', options);
  const second = analyze('First, Second = 1, 2', options);
  assert.ok(first.declarations.every(d => d.activationState === 'conditional'));
  const stable = JSON.stringify(second);
  first.declarations[0].conditions[0].values.push('changed');
  first.declarations[0].conditions[0].source.range.start.column = 99;
  first.declarations[0].source.file = 'changed';
  assert.equal(JSON.stringify(options), before);
  assert.equal(JSON.stringify(second), stable);
  assert.deepEqual(first.declarations[1].conditions[0].values, ['vanilla']);
  assert.equal(first.declarations[1].conditions[0].source.range.start.column, 2);
  assert.equal(first.declarations[1].source.file, 'Fixture.lua');
});

test('malformed projections fail without declarations and do not echo caller values', () => {
  for (const options of [null, {}, { addonId: '' }, { addonId: 1 }, { addonId: 'private-marker', conditions: [null] },
    { addonId: 'private-marker', conditions: Array(1) }, { addonId: 'private-marker', conditions: [{ ...condition(), values: [1] }] }]) {
    const result = analyze('DB = 1', options);
    assert.equal(result.complete, false);
    assert.deepEqual(names(result), []);
    assert.deepEqual(codes(result), ['LUA0001']);
    assert.doesNotMatch(result.diagnostics[0].message, /private-marker/);
  }
  assert.deepEqual(codes(analyze(null)), ['LUA0001']);
  assert.deepEqual(codes(analyze('DB = 1', { addonId: 'x' }, '')), ['LUA0001']);
});

test('BOM/UTF-16 offsets and mixed endings remain original; loader shebang extensions are rejected', () => {
  const result = analyze('\uFEFFDB = 1\r\n-- 🧪\rNext = 2\n');
  assert.deepEqual(names(result), ['DB', 'Next']);
  assert.deepEqual(result.declarations.map(d => d.source.range), [
    { start: { line: 0, column: 1 }, end: { line: 0, column: 3 } },
    { start: { line: 2, column: 0 }, end: { line: 2, column: 4 } },
  ]);
  for (const text of ['\uFEFF\uFEFFDB = 1', '#!/fixture/never-execute\nDB = 1']) {
    assert.deepEqual(codes(analyze(text)), ['LUA0002']);
  }
  assert.equal(analyze('-- #! harmless comment\nDB = 1').complete, true);
});

test('syntax errors suppress prefix declarations, retain bounded source points and reset parser state', () => {
  const result = analyze('\uFEFFDB = 1\r\nBroken =');
  assert.equal(result.complete, false);
  assert.deepEqual(names(result), []);
  assert.deepEqual(codes(result), ['LUA0002']);
  assert.deepEqual(result.diagnostics[0].source.range, { start: { line: 1, column: 8 }, end: { line: 1, column: 8 } });
  assert.deepEqual(names(analyze('After = 1')), ['After']);
});

test('input/node/depth limits fail closed and subsequent calls remain usable', () => {
  for (const text of [' '.repeat(1024 * 1024 + 1), 'Name = 1;'.repeat(17000),
    'DB = ' + '{ key = '.repeat(260) + '1' + ' }'.repeat(260)]) {
    const result = analyze(text);
    assert.equal(result.complete, false);
    assert.deepEqual(names(result), []);
    assert.deepEqual(codes(result), ['LUA0003']);
    assert.deepEqual(names(analyze('After = 1')), ['After']);
  }
});

test('actual Lua and TOC declarations compose through existing neutral contracts and selected-only resolution', () => {
  const id = 'installation/example';
  const create = (path, text) => {
    const parsed = parseToc(text, path);
    return { metadata: parsed.metadata, identity: { logicalAddonId: id, tocVariantId: JSON.stringify([id, path]),
      tocPath: path, tocSuffix: parsed.metadata.tocSuffix, source: parsed.entries[0].source } };
  };
  const era = create('Example/Example_Vanilla.toc', '## SavedVariables[AllowLoadGameType vanilla]: DB');
  const retail = create('Example/Example_Mainline.toc', '## SavedVariablesPerCharacter: Retail');
  const restrictions = toGlobalDeclarations([era.metadata])[0].conditions;
  const lua = analyze('DB = DB or {}; local Hidden = {}; if flag then Runtime = 1 end',
    { addonId: 'original/lua', conditions: restrictions }, 'Example/Code.lua');
  const other = analyze('NonSelected = 1', { addonId: 'other/lua' }, 'Example/Other.lua');
  const inputs = freeze([{ logicalAddonId: id, addonBaseName: 'Example', candidates: [era, retail],
    selectionPolicy: { schemaVersion: 1, id: 'caller', client: WoWClient.ClassicEra,
      clientFamily: 'classic', suffixPrecedence: ['Vanilla', null] }, providers: [
      { providerId: '@wow-addon/lua-analysis', tocVariantId: era.identity.tocVariantId, declarations: lua.declarations },
      { providerId: '@wow-addon/lua-analysis', tocVariantId: retail.identity.tocVariantId, declarations: other.declarations },
    ] }]);
  const policy = JSON.parse(fs.readFileSync('examples/classic-era-condition-profile.json', 'utf8'));
  const before = JSON.stringify(inputs);
  const view = resolveGlobalRegistry(policy.environment, inputs, policy.policy);
  assert.deepEqual(view.activeGlobals, ['DB']);
  assert.equal(view.complete, false); // Runtime assignment is deliberately unknown.
  const db = view.entries.find(e => e.name === 'DB');
  assert.deepEqual(db.declarations.map(d => d.declaration.kind), ['saved-variable', 'lua-global']);
  assert.deepEqual(db.declarations.map(d => d.providerId), ['@wow-addon/toc-metadata-adapter', '@wow-addon/lua-analysis']);
  assert.deepEqual(db.declarations.map(d => d.declaration.activationState), ['conditional', 'conditional']);
  assert.deepEqual(db.declarations.map(d => d.evaluation.availability), ['active', 'active']);
  assert.deepEqual(view.diagnostics, []);
  assert.equal(JSON.stringify(inputs), before);
});

test('backend defaults are untouched across success, syntax error and resource rejection', async () => {
  analyze('DB = 1');
  const backend = (await import('luaparse')).default;
  const before = JSON.stringify(backend.defaultOptions);
  analyze('error("FIXTURE_MUST_ONLY_BE_PARSED"); return 1');
  analyze('Broken =');
  analyze(' '.repeat(1024 * 1024 + 1));
  assert.equal(JSON.stringify(backend.defaultOptions), before);
});

test('Lua 5.1 accepts one optional semicolon after break with original source positions', () => {
  for (const text of ['while true do break; end; After = 1', 'repeat break; until true; After = 1',
    'for i = 1, 2 do if flag then break; end end; After = 1',
    'while true do break --[[ comment: break; ]]\r\n; end\rAfter = 1']) {
    const result = analyze(text);
    assert.equal(result.complete, true);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(names(result), ['After']);
  }
  const result = analyze('\uFEFFwhile true do break; end\r\nAfter = 1');
  assert.deepEqual(result.declarations[0].source.range,
    { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } });
});

test('Lua 5.1 does not accept extra empty statements or statements after terminal break', () => {
  for (const text of ['while true do break;; end', 'while true do break; Later = 1 end', 'break;',
    'while true do break; break end', 'return 1;;', '; Global = 1']) {
    const result = analyze(text);
    assert.equal(result.complete, false);
    assert.deepEqual(codes(result), ['LUA0002']);
    assert.deepEqual(names(result), []);
  }
});

test('literal-call chaining after valid multiline strings retains original UTF-16 positions', () => {
  const long = analyze('\uFEFFGlobal = factory[=[🧪\r\nsecond]=](); After = 1');
  assert.equal(long.complete, true);
  assert.deepEqual(names(long), ['Global', 'After']);
  assert.deepEqual(long.declarations[1].source.range,
    { start: { line: 1, column: 13 }, end: { line: 1, column: 18 } });
  const short = analyze('Global = factory"first\\\nsecond"(); After = 1');
  assert.equal(short.complete, true);
  assert.deepEqual(names(short), ['Global', 'After']);
  assert.deepEqual(short.declarations[1].source.range,
    { start: { line: 1, column: 11 }, end: { line: 1, column: 16 } });
  const crlf = analyze('Global = factory"first\\\r\nsecond"(); After = 1');
  assert.equal(crlf.complete, true);
  assert.deepEqual(crlf.declarations[1].source.range,
    { start: { line: 1, column: 11 }, end: { line: 1, column: 16 } });
  assert.equal(analyze('Global = factory[=[first\nsecond]=] --[[same line]] ()').complete, true);
});

test('literal-call adaptation preserves real newline ambiguity and malformed string rejection', () => {
  for (const text of ['Global = factory[=[first\nsecond]=]\n()',
    'Global = factory[=[first\nsecond]=] --[[new\nline]] ()',
    'Global = factory"first\nsecond"()', 'Global = factory[=[first\nsecond]]()']) {
    const result = analyze(text);
    assert.equal(result.complete, false);
    assert.deepEqual(codes(result), ['LUA0002']);
    assert.deepEqual(names(result), []);
  }
});

test('Lua 5.1 lexical adaptation does not interpret comments or literal contents as statements', () => {
  const text = 'Text = [=[break;; while end]=]; -- break;\nwhile flag do break; end\nLast = 1';
  const result = analyze(text);
  assert.equal(result.complete, true);
  assert.deepEqual(names(result), ['Text', 'Last']);
  assert.deepEqual(result.declarations[1].source.range,
    { start: { line: 2, column: 0 }, end: { line: 2, column: 4 } });
});

test('inherited conditions are validated before any projection is consumed', () => {
  for (const conditions of [[null], Array(1), undefined, 'invalid']) {
    const options = Object.assign(Object.create({ conditions }), { addonId: 'caller' });
    const result = analyze('DB = 1', options);
    assert.deepEqual(codes(result), ['LUA0001']);
    assert.deepEqual(names(result), []);
  }
  const inherited = [condition()];
  const result = analyze('DB = 1', Object.assign(Object.create({ conditions: inherited }), { addonId: 'caller' }));
  assert.equal(result.declarations[0].activationState, 'conditional');
  result.declarations[0].conditions[0].values.push('changed');
  assert.deepEqual(inherited[0].values, ['vanilla']);
});

test('lexical failures are identical in fresh processes and after other inputs', () => {
  const script = `import { analyzeLua } from '@wow-addon/lua-analysis';
    const run = text => analyzeLua(text, 'Fixture.lua', { addonId: 'caller' });
    const inputs = ['@', '[=', '\\uFEFFDB = 1;\\r\\n[='];
    const first = inputs.map(run);
    run('Before = 1; '.repeat(100));
    const second = inputs.map(run);
    process.stdout.write(JSON.stringify({ first, second }));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  const { first, second } = JSON.parse(child.stdout);
  assert.deepEqual(first, second);
  for (const result of first) {
    assert.deepEqual(codes(result), ['LUA0002']);
    assert.deepEqual(names(result), []);
  }
  assert.deepEqual(first.map(r => r.diagnostics[0].source.range.start),
    [{ line: 0, column: 0 }, { line: 0, column: 0 }, { line: 1, column: 0 }]);
});

test('numeric for bounds and steps see outer bindings, not the loop variable', () => {
  for (const header of [
    '(function() DB = 1; return 1 end)(), 2',
    '1, (function() DB = 1; return 2 end)()',
    '1, 2, (function() DB = 1; return 1 end)()',
  ]) {
    const result = analyze(`for DB = ${header} do DB = 2 end`);
    assert.deepEqual(names(result), ['DB']);
    assert.equal(result.declarations[0].activationState, 'unknown');
  }
  assert.deepEqual(names(analyze('local DB; for DB = (function() DB = 1; return 1 end)(), 2 do DB = 2 end')), []);
});

test('generic for iterators see outer bindings and all loop variables stay body-local', () => {
  const result = analyze('for A, B in (function() A = 1; B = 2; return iterator end)() do A = 3; B = 4 end');
  assert.deepEqual(names(result), ['A', 'B']);
  assert.ok(result.declarations.every(d => d.activationState === 'unknown'));
  assert.deepEqual(names(analyze('local A, B; for A, B in (function() A = 1; B = 2; return iterator end)() do A = 3 end')), []);
  assert.deepEqual(names(analyze('for A in (function(A) A = 1; return iterator end)(1) do A = 2 end')), []);
  assert.deepEqual(names(analyze('for A in (function() local A; A = 1; return iterator end)() do A = 2 end')), []);
});

test('loop-header environment reads cannot falsely activate later globals', () => {
  for (const text of ['for _G in pairs(_G) do end; DB = 1',
    'for _G = (function() return _G.initial end)(), 2 do end; DB = 1',
    'for loadstring in loadstring(text) do end; DB = 1']) {
    const result = analyze(text);
    assert.equal(result.complete, false);
    assert.ok(codes(result).includes('LUA0004'));
    assert.equal(result.declarations.find(d => d.name === 'DB').activationState, 'unknown');
  }
  assert.equal(analyze('local _G = {}; for _G in pairs(_G) do end; DB = 1').complete, true);
  assert.equal(analyze('for _G in iterator do local v = _G end; DB = 1').complete, true);
});

test('scope correction preserves initializer order, repeat conditions and separate branches', () => {
  assert.deepEqual(names(analyze('local DB = (function() DB = 1 end)(); DB = 2')), ['DB']);
  assert.deepEqual(names(analyze('repeat local DB; DB = 1 until (function() DB = 2; return true end)(); DB = 3')), ['DB']);
  const branches = analyze('if flag then local DB; DB = 1 elseif (function() DB = 2; return true end)() then DB = 3 else local DB; DB = 4 end; DB = 5');
  assert.deepEqual(names(branches), ['DB', 'DB', 'DB']);
  assert.deepEqual(branches.declarations.map(d => d.activationState), ['unknown', 'unknown', 'unconditional']);
});

test('scope correction preserves recursive local functions, implicit self and nested loop lifetimes', () => {
  const result = analyze('local function F(_G) F = 1; _G = 2 end; local T = {}; function T:m() self = 1; Inside = 2 end; for DB = 1, 2 do for DB in iterator do DB = 3 end; DB = 4 end; DB = 5');
  assert.equal(result.complete, true);
  assert.deepEqual(names(result), ['Inside', 'DB']);
  assert.deepEqual(result.declarations.map(d => d.activationState), ['unknown', 'unconditional']);
});
