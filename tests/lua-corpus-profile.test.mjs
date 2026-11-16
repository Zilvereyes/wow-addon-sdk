import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLua } from '@wow-addon/lua-analysis';

const run = (text, options = {}) => analyzeLua(text, 'Fixture.lua', { addonId: 'caller', ...options });
const codes = result => result.diagnostics.map(d => d.code);

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
