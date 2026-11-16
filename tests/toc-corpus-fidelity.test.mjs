import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToc } from '@wow-addon/toc-parser';
import { buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { listGlobals } from '@wow-addon/global-registry';

test('empty hash separators are comments with original BOM/endings/source ranges', () => {
  const input = '\uFEFF## \r\n####\n##\t\r';
  const parsed = parseToc(input, 'Synthetic/Comments.toc');
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.entries.map(entry => entry.kind), ['comment', 'comment', 'comment', 'blank']);
  assert.deepEqual(parsed.entries.map(entry => entry.raw), ['\uFEFF## ', '####', '##\t', '']);
  assert.deepEqual(parsed.entries[0].source.range, {
    start: { line: 0, column: 0 }, end: { line: 0, column: 4 },
  });
  assert.deepEqual(parsed.metadata.directives, []);
  assert.deepEqual(parsed.metadata.files, []);
});

test('dotted custom metadata keys retain spelling, duplicate values and JSON shape', () => {
  const parsed = parseToc([
    '## X-Fixture-2.7-Module: First',
    '## x-fixture-2.7-module: Second',
    '## SavedVariables: DB',
  ].join('\n'), 'Synthetic/Dotted.toc');
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.metadata.customMetadata['X-Fixture-2.7-Module'], ['First', 'Second']);
  assert.deepEqual(parsed.metadata.directives.map(d => d.name), ['X-Fixture-2.7-Module', 'x-fixture-2.7-module', 'SavedVariables']);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
  assert.deepEqual(listGlobals(buildTocGlobalRegistry([parsed.metadata])), ['DB']);
});

test('conditions on dotted custom keys retain raw UTF-16 locations and order', () => {
  const input = '## X-Fixture-2.7[AllowLoadGameType vanilla]: 🧪 [AllowLoadTextLocale enUS]';
  const parsed = parseToc(input, 'Synthetic/Dotted.toc');
  assert.deepEqual(parsed.diagnostics, []);
  const directive = parsed.metadata.directives[0];
  assert.equal(directive.name, 'X-Fixture-2.7');
  assert.equal(directive.value, '🧪');
  assert.deepEqual(directive.conditions.map(c => c.raw), ['[AllowLoadGameType vanilla]', '[AllowLoadTextLocale enUS]']);
  for (const condition of directive.conditions) {
    const start = input.indexOf(condition.raw);
    assert.deepEqual(condition.source.range, {
      start: { line: 0, column: start }, end: { line: 0, column: start + condition.raw.length },
    });
  }
});

test('dotted ordinary directive names and malformed conditions remain errors without leaked globals', () => {
  for (const line of [
    '## Saved.Variables: MustNotLeak',
    '## SavedVariables[UnknownRule value]: MustNotLeak',
    '## X-Fixture-2.7[UnknownRule value]: MustNotLeak',
    '## X-Fixture/2.7: MustNotLeak',
  ]) {
    const parsed = parseToc(line, 'Synthetic/Invalid.toc');
    assert.ok(parsed.diagnostics.some(d => d.code === 'TOC0001' && d.severity === 'error'), line);
    assert.equal(parsed.entries[0].kind, 'invalid');
    assert.deepEqual(listGlobals(buildTocGlobalRegistry([parsed.metadata]), { includeConditional: true }), []);
  }
});

test('nonempty double-hash annotations retain existing strict diagnostics in this focused fix', () => {
  for (const line of ['## MissingColon', '## section heading', '## XML']) {
    const parsed = parseToc(line, 'Synthetic/Strict.toc');
    assert.ok(parsed.diagnostics.some(d => d.code === 'TOC0001'), line);
  }
});

test('indentation still belongs to a file path rather than a hash comment', () => {
  const parsed = parseToc(' ## ', 'Synthetic/Indented.toc');
  assert.equal(parsed.entries[0].kind, 'file');
  assert.deepEqual(parsed.metadata.files, [' ##']);
  assert.ok(parsed.diagnostics.some(d => d.code === 'TOC0006'));
});
