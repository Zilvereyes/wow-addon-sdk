import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLua } from '@wow-addon/lua-analysis';

const run = (text, options = {}) => analyzeLua(text, 'Fixture.lua', { addonId: 'caller', ...options });
const codes = result => result.diagnostics.map(d => d.code);

test('larger profile preserves Lua 5.1 vararg function boundaries and exact rejection points', () => {
  // Independently authored classification: Lua 5.1 lparser.c/simpleexp requires
  // the current function, rather than an enclosing function, to be variadic.
  for (const profile of ['bounded', 'corpus']) {
    for (const text of ['local pending = ...', 'function Collect(first, ...) return ... end']) {
      assert.deepEqual(codes(run(text, { profile })), []);
    }
    const invalid = 'Before = 1\r\nfunction Collect(first)\r\n  local pending = ...\r\nend';
    const rejected = run(invalid, { profile });
    assert.deepEqual(codes(rejected), ['LUA0002']);
    assert.deepEqual(rejected.declarations, []);
    assert.deepEqual(rejected.diagnostics[0].source.range,
      { start: { line: 2, column: 18 }, end: { line: 2, column: 18 } });
    assert.deepEqual(codes(run('function Collect(...) return function() return ... end end', { profile })), ['LUA0002']);
  }
});

test('corpus profile accepts above-default input while omitted/explicit bounded stay identical', () => {
  const text = ' '.repeat(1024 * 1024) + 'After = 1';
  const legacy = run(text);
  assert.deepEqual(codes(legacy), ['LUA0003']);
  assert.deepEqual(run(text, { profile: 'bounded' }), legacy);
  const expanded = run(text, { profile: 'corpus' });
  assert.equal(expanded.complete, true);
  assert.equal(expanded.declarations[0].name, 'After');
  assert.equal(expanded.declarations[0].source.range.start.column, 1024 * 1024);
});

test('corpus profile accepts above-default node counts without collapsing occurrences', () => {
  const text = 'Global = 1;'.repeat(17000);
  assert.deepEqual(codes(run(text)), ['LUA0003']);
  const expanded = run(text, { profile: 'corpus' });
  assert.equal(expanded.complete, true);
  assert.equal(expanded.declarations.length, 17000);
  assert.equal(expanded.declarations.at(-1).source.range.end.column, text.length - 5);
});

test('corpus cap and malformed own/inherited profile projections fail closed', () => {
  assert.deepEqual(codes(run(' '.repeat(32 * 1024 * 1024 + 1), { profile: 'corpus' })), ['LUA0003']);
  for (const invalid of [{ profile: 'unbounded' }, { profile: null }, { profile: undefined },
    { allowShebang: 1 }, { allowShebang: undefined }]) {
    for (const options of [{ addonId: 'caller', ...invalid }, Object.assign(Object.create(invalid), { addonId: 'caller' })]) {
      const result = analyzeLua('DB = 1', 'Fixture.lua', options);
      assert.deepEqual(codes(result), ['LUA0001']);
      assert.deepEqual(result.declarations, []);
    }
  }
});

test('hashbang preprocessing is explicit and preserves BOM and original mixed-ending spans', () => {
  for (const text of ['#!fixture\nAfter = 1', '\uFEFF#!fixture\r\nAfter = 1', '#!fixture\rAfter = 1']) {
    assert.deepEqual(codes(run(text, { profile: 'corpus' })), ['LUA0002']);
    const allowed = run(text, { allowShebang: true });
    assert.equal(allowed.complete, true);
    assert.deepEqual(allowed.declarations[0].source.range,
      { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } });
  }
  assert.equal(run('#!header only', { allowShebang: true }).complete, true);
  for (const text of ['#ordinary\nAfter=1', 'After=1\n#!interior', '\uFEFF\uFEFF#!header']) {
    assert.deepEqual(codes(run(text, { allowShebang: true })), ['LUA0002']);
  }
});
