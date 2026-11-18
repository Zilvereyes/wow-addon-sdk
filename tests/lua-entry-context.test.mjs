import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypeScriptContract } from './test-node.mjs';
import { analyzeLua } from '@wow-addon/lua-analysis';
const file = 'Å\\decoded-handler';
const body = (content, parameters = [], variadic = false, extra = {}) =>
  analyzeLua(content, file, { addonId: 'authored', context: { kind: 'function-body', parameters, variadic }, ...extra });
const names = result => result.declarations.map(d => d.name);
function rejected(result, code) {
  assert.equal(result.complete, false);
  assert.deepEqual(result.declarations, []);
  assert.deepEqual(result.diagnostics.map(d => d.code), [code]);
  assert.equal(result.diagnostics[0].source.file, file);
  assert.doesNotMatch(result.diagnostics[0].message, /PRIVATE/);
}
test('approved Lua context has readonly explicit discriminated parameters and variadic permission', () => {
  verifyTypeScriptContract('tests/contracts/lua-analysis.ts');
});
test('omitted context and explicit chunk remain identical across original profile and loader behavior', () => {
  for (const profile of ['bounded', 'corpus']) for (const content of [
    'Direct=1; function Public(p) p=2; Nested=3 end', '\uFEFFDirect=1', 'return ...', 'local f=function() return ... end',
    '#!authored\nDirect=1', 'Direct=1; require("not-executed")',
  ]) for (const allowShebang of [false, true]) {
    const options = { addonId: 'authored', profile, allowShebang };
    assert.deepEqual(analyzeLua(content, file, { ...options, context: { kind: 'chunk' } }),
      analyzeLua(content, file, options));
  }
});
test('function-body parameters are local and every direct or nested global has unknown activation', () => {
  for (const profile of ['bounded', 'corpus']) {
    const r = body('self=1; event=2; Out=3; function Public() Nested=4 end', ['self', 'event'], false, { profile });
    assert.equal(r.complete, true);
    assert.deepEqual(names(r), ['Out', 'Public', 'Nested']);
    assert.ok(r.declarations.every(d => d.activationState === 'unknown'));
    assert.deepEqual(r.declarations[0].source.range, { start: { line: 0, column: 17 }, end: { line: 0, column: 20 } });
  }
});
test('captures, duplicates, nested parameter shadowing and initializer order retain lexical scope', () => {
  assert.deepEqual(names(body('local function f() p=1; Out=2 end', ['p', 'p'])), ['Out']);
  assert.deepEqual(names(body('local function f(p) p=1 end; p=2')), ['p']);
  assert.deepEqual(names(body('local p=(function() p=1; Out=2 end)(); p=3', ['p'])), ['Out']);
  assert.deepEqual(names(body('for p=(function() p=1; Out=2; return 1 end)(),2 do p=3 end', ['p'])), ['Out']);
  assert.deepEqual(names(body('function t:method() self=1; Out=2 end', ['t'])), ['Out']);
});
test('root variadic permission is independent from each nested function and ignores literal dots', () => {
  rejected(body('return ...'), 'LUA0002');
  assert.equal(body('return ...', [], true).complete, true);
  assert.equal(body('local f=function(...) return ... end').complete, true);
  rejected(body('local f=function() return ... end', [], true), 'LUA0002');
  assert.equal(body('local s="..."; -- ...\nOut=1').complete, true);
  rejected(body('break', [], true), 'LUA0002');
  assert.deepEqual(names(body('Out=1; return ...', [], true)), ['Out']);
});
test('explicit root parameters shadow dynamic environment access without invoking it', () => {
  const unsupported = body('Out=1; require("not-executed")');
  assert.equal(unsupported.complete, false);
  assert.deepEqual(unsupported.diagnostics.map(d => d.code), ['LUA0004']);
  const shadowed = body('Out=1; require("not-executed")', ['require']);
  assert.equal(shadowed.complete, true);
  assert.deepEqual(names(shadowed), ['Out']);
  assert.equal(shadowed.declarations[0].activationState, 'unknown');
});
test('function-body prefixes are grammar input while original file loader defaults are preserved', () => {
  for (const content of ['\uFEFFOut=1', '#!authored\nOut=1']) rejected(body(content), 'LUA0002');
  rejected(body('Out=1', [], false, { allowShebang: true }), 'LUA0001');
  assert.equal(body('local s="\uFEFF"; Out=1').complete, true);
  assert.equal(analyzeLua('\uFEFFOut=1', file, { addonId: 'authored' }).complete, true);
  assert.equal(analyzeLua('#!authored\nOut=1', file, { addonId: 'authored', allowShebang: true }).complete, true);
});
test('context snapshots consume own numeric cells once and never use caller iterators', () => {
  let iteratorReads = 0, reads = 0;
  const parameters = ['p'];
  Object.defineProperty(parameters, Symbol.iterator, { get() { iteratorReads++; throw new Error('PRIVATE_ITERATOR'); } });
  Object.defineProperty(parameters, 0, { get() { reads++; return reads === 1 ? 'p' : {}; } });
  const r = body('p=1; Out=2', parameters);
  assert.equal(r.complete, true);
  assert.deepEqual(names(r), ['Out']);
  assert.equal(iteratorReads, 0);
  assert.equal(reads, 1);
});
test('invalid context projections and names fail closed and recover without private errors', () => {
  for (const context of [null, { kind: 'other' }, { kind: 'function-body' },
    { kind: 'function-body', parameters: [], variadic: 'yes' },
    { kind: 'function-body', parameters: Array(1), variadic: false },
    ...['1x', 'end', '...', 'é', 'p:x', ''].map(name => ({ kind: 'function-body', parameters: [name], variadic: false })),
  ]) rejected(analyzeLua('Out=1', file, { addonId: 'authored', context }), 'LUA0001');
  const options = { addonId: 'authored' };
  Object.defineProperty(options, 'context', { get() { throw new Error('PRIVATE_CONTEXT'); } });
  rejected(analyzeLua('Out=1', file, options), 'LUA0001');
  assert.deepEqual(names(body('Out=1')), ['Out']);
});
test('context array and consumed string caps are enforced before over-limit getters', () => {
  const parameters = Array.from({ length: 128 }, (_, i) => 'p' + i);
  assert.deepEqual(names(body('p0=1; p127=2; Out=3', parameters)), ['Out']);
  let reads = 0;
  const oversized = [...parameters, 'extra'];
  Object.defineProperty(oversized, 0, { get() { reads++; throw new Error('PRIVATE_CELL'); } });
  rejected(body('Out=1', oversized), 'LUA0003');
  assert.equal(reads, 0);
  const maximum = 16 * 1024 - 'function-body'.length;
  assert.equal(body('Out=1', ['p'.repeat(maximum)]).complete, true);
  rejected(body('Out=1', ['p'.repeat(maximum + 1)]), 'LUA0003');
});
test('existing inherited Lua condition values copy numeric string cells rather than undocumented iterators', () => {
  const marker = { private: 'PRIVATE_OBJECT' }, values = ['era'];
  let iteratorReads = 0;
  values[Symbol.iterator] = function* () { iteratorReads++; yield marker; };
  const condition = { providerId: 'authored', name: 'Game', raw: 'era', values,
    source: { file: 'foreign.toc', range: { start: { line: 1, column: 2 }, end: { line: 1, column: 5 } } } };
  const r = analyzeLua('Out=1', file, { addonId: 'authored', conditions: [condition] });
  assert.equal(r.complete, true);
  assert.deepEqual(r.declarations[0].conditions[0].values, ['era']);
  assert.equal(iteratorReads, 0);
  marker.private = 'mutated';
  assert.deepEqual(r.declarations[0].conditions[0].values, ['era']);
  assert.deepEqual(r.declarations[0].conditions[0].source, condition.source);
  assert.notEqual(r.declarations[0].conditions[0].source, condition.source);
});
test('function-body inherited restrictions retain copied foreign sources and exact decoded positions', () => {
  const condition = { providerId: 'authored', name: 'Game', raw: 'era', values: ['era'],
    source: { file: 'foreign.toc', range: { start: { line: 3, column: 4 }, end: { line: 3, column: 7 } } } };
  const r = body('self=1;\r\nOut=2', ['self'], false, { conditions: [condition] });
  assert.equal(r.complete, true);
  assert.deepEqual(names(r), ['Out']);
  assert.equal(r.declarations[0].activationState, 'unknown');
  assert.deepEqual(r.declarations[0].source.range, { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } });
  assert.deepEqual(r.declarations[0].conditions[0], condition);
  assert.notEqual(r.declarations[0].conditions[0], condition);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});
