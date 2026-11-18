import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLua } from '@wow-addon/lua-analysis';

const content = '\uFEFF-- 😀\r\nOut=1; Out=2\nOther=3';
const filename = 'Authored/Å.lua';
const addonId = 'requester-exact-ID';
const declarations = [
  ['Out', 1, 0, 3], ['Out', 1, 7, 10], ['Other', 2, 0, 5],
].map(([name, line, start, end]) => ({
  name, addonId, kind: 'lua-global', activationState: 'unconditional',
  source: { file: filename, range: {
    start: { line, column: start }, end: { line, column: end },
  } },
}));

function accepted(options) {
  const result = analyzeLua(content, filename, options);
  assert.deepEqual(result, { schemaVersion: 1, complete: true, declarations, diagnostics: [] });
  return result;
}

test('ordinary Lua requester association preserves duplicate declarations and original UTF-16 sources', () => {
  accepted({ addonId });
});

for (const [name, subsequent] of [
  ['undefined', () => undefined],
  ['object', () => ({ private: 'must-not-enter-a-declaration' })],
  ['throwing getter', () => { throw new Error('must-not-read-the-requester-twice'); }],
]) {
  test(`Lua consumes the validated requester once before a later ${name}`, () => {
    let reads = 0;
    const options = { get addonId() { return ++reads === 1 ? addonId : subsequent(); } };
    accepted(options);
    assert.equal(reads, 1);
  });
}

for (const [name, value] of [['undefined', undefined], ['object', {}], ['empty string', '']]) {
  test(`initially invalid ${name} requester retains the invalid-input result`, () => {
    let reads = 0;
    const result = analyzeLua(content, filename, { get addonId() { reads++; return value; } });
    assert.equal(reads, 1);
    assert.equal(result.complete, false);
    assert.deepEqual(result.declarations, []);
    assert.deepEqual(result.diagnostics, [{
      code: 'LUA0001', severity: 'error', message: 'Invalid Lua analysis input projection.',
      source: { file: filename, range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } },
    }]);
  });
}
