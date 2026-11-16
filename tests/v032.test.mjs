import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseToc } from '@wow-addon/toc-parser';
import { toGlobalDeclarations, buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { buildGlobalRegistry, listGlobals } from '@wow-addon/global-registry';
import { METADATA_SCHEMA_VERSION } from '@wow-addon/addon-metadata';

const providerId = '@wow-addon/toc-metadata-adapter';
const position = (line, column) => ({ line, column });
const source = (file, line = 0, start = 0, end = 1) => ({
  file, range: { start: position(line, start), end: position(line, end) },
});
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function expectedCondition(file, line, text, raw, name, values) {
  const start = text.indexOf(raw);
  assert.notEqual(start, -1);
  return { providerId, name, values, raw, source: source(file, line, start, start + raw.length) };
}

test('v0.3.2 has one provider-neutral descriptor and an optional readonly declaration field', () => {
  const result = spawnSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--exactOptionalPropertyTypes',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'tests/contracts/v032.ts',
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('TOC adapter preserves exact header/value annotations, spelling, values and raw spans', () => {
  const file = 'Mixed\\Å/Addon_Vanilla.toc';
  const header = '[AllowLoadGameType vanilla, vanilla]';
  const value = '[aLlOwLoAdTeXtLoCaLe enUS, frFR]';
  const text = `## SavedVariables${header}: DB ${value}`;
  const parsed = parseToc(text, file);
  assert.equal(parsed.diagnostics.length, 0);
  const [declaration] = toGlobalDeclarations([parsed.metadata]);
  assert.deepEqual(declaration.conditions, [
    expectedCondition(file, 0, text, header, 'AllowLoadGameType', ['vanilla', 'vanilla']),
    expectedCondition(file, 0, text, value, 'aLlOwLoAdTeXtLoCaLe', ['enUS', 'frFR']),
  ]);
  assert.equal(declaration.addonId, file);
  assert.equal(declaration.activationState, 'conditional');
});

test('BOM, astral Unicode and mixed line endings retain original UTF-16 condition ranges', () => {
  const file = 'Å\\mixed/Fixture.toc';
  const lines = ['\uFEFF## SavedVariables[AllowLoadGameType vanilla]: First', '## Title: 🧪',
    '## SavedVariables: Invalid🧪, DB [AllowLoadTextLocale enUS]'];
  const parsed = parseToc(`${lines[0]}\r\n${lines[1]}\r${lines[2]}\n`, file);
  const declarations = toGlobalDeclarations([parsed.metadata]);
  assert.deepEqual(declarations.map(d => d.name), ['First', 'DB']);
  assert.deepEqual(declarations[0].conditions, [expectedCondition(file, 0, lines[0],
    '[AllowLoadGameType vanilla]', 'AllowLoadGameType', ['vanilla'])]);
  assert.deepEqual(declarations[1].conditions, [expectedCondition(file, 2, lines[2],
    '[AllowLoadTextLocale enUS]', 'AllowLoadTextLocale', ['enUS'])]);
});

test('duplicate symbols and annotations stay ordered across multiple source variants', () => {
  const a = parseToc('## SavedVariables[AllowLoadGameType vanilla]: DB, DB [AllowLoadGameType vanilla]', 'A/A_Vanilla.toc');
  const b = parseToc('## SavedVariables[AllowLoadTextLocale enUS]: DB', 'A/A_Mainline.toc');
  const declarations = toGlobalDeclarations([a.metadata, b.metadata]);
  assert.deepEqual(declarations.map(d => d.addonId), ['A/A_Vanilla.toc', 'A/A_Vanilla.toc', 'A/A_Mainline.toc']);
  assert.deepEqual(declarations.map(d => d.conditions.map(c => c.name)), [
    ['AllowLoadGameType', 'AllowLoadGameType'], ['AllowLoadGameType', 'AllowLoadGameType'], ['AllowLoadTextLocale'],
  ]);
});

test('new provenance copies are independent of frozen input, sibling symbols and repeated calls', () => {
  const parsed = parseToc('## SavedVariables[AllowLoadGameType vanilla]: A, B', 'A/A.toc');
  assert.equal(parsed.metadata.savedVariableDeclarations[0].conditions, parsed.metadata.savedVariableDeclarations[1].conditions);
  freeze(parsed.metadata);
  const before = JSON.stringify(parsed.metadata);
  const first = toGlobalDeclarations([parsed.metadata]);
  const second = toGlobalDeclarations([parsed.metadata]);
  const untouched = JSON.stringify(first[1].conditions);
  first[0].conditions[0].providerId = 'edited';
  first[0].conditions[0].name = 'edited';
  first[0].conditions[0].values.push('edited');
  first[0].conditions[0].raw = 'edited';
  first[0].conditions[0].source.file = 'edited';
  first[0].conditions[0].source.range.start.line = 9;
  first[0].conditions[0].source.range.start.column = 9;
  first[0].conditions[0].source.range.end.line = 9;
  first[0].conditions[0].source.range.end.column = 9;
  first[0].conditions.push({});
  assert.equal(JSON.stringify(first[1].conditions), untouched);
  assert.equal(JSON.stringify(second[0].conditions), untouched);
  assert.equal(JSON.stringify(second[1].conditions), untouched);
  assert.equal(JSON.stringify(parsed.metadata), before);
  // Existing declaration source behavior stays separate from new condition copies.
  assert.equal(first[0].source, parsed.metadata.savedVariableDeclarations[0].source);
});

test('condition copies contain only documented fields and are JSON-safe for typed input', () => {
  const parsed = parseToc('## SavedVariables[Bootstrap]: DB', 'A/A.toc');
  parsed.metadata.savedVariableDeclarations[0].conditions[0].source.range.start.extra = 1n;
  const [declaration] = toGlobalDeclarations([parsed.metadata]);
  assert.deepEqual(declaration.conditions[0].values, []);
  assert.equal(declaration.activationState, 'conditional');
  assert.equal(Object.hasOwn(declaration.conditions[0].source.range.start, 'extra'), false);
  assert.doesNotThrow(() => JSON.stringify(declaration));
});

test('unconditional adapter output retains its exact old shape and metadata schema 2', () => {
  const parsed = parseToc('## SavedVariables: DB', 'A/A.toc');
  const [declaration] = toGlobalDeclarations([parsed.metadata]);
  assert.equal(METADATA_SCHEMA_VERSION, 2);
  assert.equal(parsed.metadata.schemaVersion, 2);
  assert.deepEqual(declaration, { name: 'DB', addonId: 'A/A.toc', kind: 'saved-variable', scope: 'account',
    activationState: 'unconditional', source: source('A/A.toc', 0, 19, 21) });
  assert.equal(Object.hasOwn(declaration, 'conditions'), false);
});

test('registry retains opaque future-provider conditions and legacy missing/empty provenance without evaluating', () => {
  const origin = source('Fixture.lua');
  const records = [
    { name: 'Legacy', addonId: 'A', kind: 'lua-global', activationState: 'conditional', source: origin },
    { name: 'Empty', addonId: 'A', kind: 'lua-global', activationState: 'conditional', source: origin, conditions: [] },
    ...['synthetic-lua-provider', 'synthetic-xml-provider'].map((id, i) => ({
      name: 'Shared', addonId: 'A', kind: i ? 'frame' : 'lua-global', activationState: 'unknown', source: origin,
      conditions: [{ providerId: id, name: 'FutureRule', values: [], raw: '{opaque malformed-looking expression', source: origin }],
    })),
  ];
  freeze(records);
  const registry = buildGlobalRegistry(records);
  assert.deepEqual(listGlobals(registry), []);
  assert.deepEqual(listGlobals(registry, { includeConditional: true }), ['Legacy', 'Empty']);
  assert.deepEqual(listGlobals(registry, { includeUnknown: true }), ['Shared']);
  assert.equal(registry.entries[0].declarations[0], records[0]);
  assert.deepEqual(registry.entries[2].declarations.map(d => d.conditions[0].providerId),
    ['synthetic-lua-provider', 'synthetic-xml-provider']);
  assert.deepEqual(JSON.parse(JSON.stringify(registry)), registry);
});

test('static listing and SV0001 behavior stay unchanged after condition provenance is attached', () => {
  const parsed = parseToc('## SavedVariables: Always\n## SavedVariables[AllowLoadGameType vanilla]: DB\n## SavedVariablesPerCharacter[AllowLoadGameType standard]: DB', 'A/A.toc');
  const before = JSON.stringify(parsed.metadata);
  const registry = buildTocGlobalRegistry([parsed.metadata]);
  assert.deepEqual(listGlobals(registry), ['Always']);
  assert.deepEqual(listGlobals(registry, { includeConditional: true }), ['Always', 'DB']);
  assert.deepEqual(registry.diagnostics.map(d => d.code), ['SV0001']);
  assert.equal(registry.entries[1].declarations.length, 2);
  assert.equal(JSON.stringify(parsed.metadata), before);
});

test('malformed/unknown TOC header annotations do not create unconditional or descriptor-bearing globals', () => {
  for (const header of ['[FutureRule value]', '[AllowLoadGameType vanilla][Bad value]', '[AllowLoadGameType vanilla']) {
    const parsed = parseToc(`## SavedVariables${header}: MustNotLeak`, 'A/A.toc');
    assert.ok(parsed.diagnostics.some(d => d.code === 'TOC0001'));
    assert.deepEqual(toGlobalDeclarations([parsed.metadata]), []);
  }
});
