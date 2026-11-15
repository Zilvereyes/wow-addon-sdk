import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToc } from '@wow-addon/toc-parser';
import { WoWClient, WoWGameMode } from '@wow-addon/addon-metadata';
import { buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { listGlobals } from '@wow-addon/global-registry';

// Would fail if repeated directives overwrite previous declarations or lose source order.
test('reads multiple SavedVariables directives in order with exact source locations', () => {
  const input = [
    '## Interface: 120100, 120105',
    '## SavedVariables: ZUI_DB, ZUI_Config',
    '## SavedVariablesPerCharacter: ZUI_CharacterDB',
    '## SavedVariables: ZUI_Settings',
    'Core.lua',
    'Modules\\Chat.lua'
  ].join('\r\n');
  const { metadata, diagnostics, entries } = parseToc(input, 'ZilverUI/ZilverUI_Mainline.toc');
  assert.equal(diagnostics.length, 0);
  assert.equal(metadata.name, 'ZilverUI');
  assert.equal(metadata.client, WoWClient.Retail);
  assert.equal(metadata.gameMode, WoWGameMode.Unknown);
  assert.deepEqual(metadata.interfaceVersions, ['120100', '120105']);
  assert.deepEqual(metadata.savedVariables, ['ZUI_DB', 'ZUI_Config', 'ZUI_Settings']);
  assert.deepEqual(metadata.savedVariablesPerCharacter, ['ZUI_CharacterDB']);
  assert.deepEqual(metadata.files, ['Core.lua', 'Modules\\Chat.lua']);
  assert.equal(metadata.savedVariableDeclarations[1].source.range.start.line, 1);
  assert.equal(metadata.savedVariableDeclarations[1].source.range.start.column, 27);
  assert.deepEqual(entries.filter((e) => e.kind !== 'blank').map((e) => e.kind), [
    'directive','directive','directive','directive','file','file'
  ]);
});

// Would fail if malformed input crashes, directives are silently discarded, or a whitespace-prefixed # is treated as a comment.
test('reports recoverable errors and preserves ambiguous file lines', () => {
  const result = parseToc([
    '## SavedVariables: Alpha, , 2Bad, Alpha',
    '## MissingColon',
    ' # not a comment',
    '# valid comment',
    '## OptionalDeps: LibA, LibB',
    '## DepAnything: MainDep',
    '## X-Embeds: LibStub, CallbackHandler'
  ].join('\n'), 'Example/Example.toc');
  assert.deepEqual(result.metadata.optionalDependencies, ['LibA','LibB']);
  assert.deepEqual(result.metadata.dependencies, ['MainDep']);
  assert.deepEqual(result.metadata.embeddedLibraries, ['LibStub','CallbackHandler']);
  assert.deepEqual(result.metadata.savedVariables, ['Alpha','2Bad']);
  assert.equal(result.entries[2].kind, 'file');
  assert.equal(result.entries[3].kind, 'comment');
  assert.ok(result.diagnostics.some((d) => d.code === 'TOC0001'));
  assert.ok(result.diagnostics.some((d) => d.code === 'TOC0002'));
  assert.ok(result.diagnostics.some((d) => d.code === 'TOC0003'));
  assert.ok(result.diagnostics.some((d) => d.code === 'TOC0004'));
});

// Would fail if conditional globals leak into unconditional LuaLS diagnostic configuration.
test('preserves conditional metadata and registry excludes conditional-only globals by default', () => {
  const input = [
    '## SavedVariables: AlwaysDB',
    '## SavedVariables: RetailDB [AllowLoadGameType standard]',
    '## SavedVariablesPerCharacter: ClassicDB [AllowLoadGameType vanilla]',
    '[Family]\\Core.lua [AllowLoadGameType vanilla]'
  ].join('\n');
  const parsed = parseToc(input, 'Test/Test_Classic.toc');
  const registry = buildTocGlobalRegistry([parsed.metadata]);
  assert.deepEqual(listGlobals(registry), ['AlwaysDB']);
  assert.deepEqual(listGlobals(registry, { includeConditional: true }), [
    'AlwaysDB','RetailDB','ClassicDB'
  ]);
  assert.equal(parsed.metadata.fileEntries[0].path, '[Family]\\Core.lua');
  assert.equal(parsed.metadata.fileEntries[0].conditions[0].name, 'AllowLoadGameType');
  assert.equal(parsed.metadata.client, WoWClient.Unknown);
  assert.equal(parsed.metadata.clientFamily, 'classic');
});

// Would fail if client-specific suffixes are mistaken for dedicated server project IDs.
test('distinguishes client family, concrete game type and optional mode', () => {
  const era = parseToc('', 'Addon/Addon_Vanilla.toc');
  const classic = parseToc('', 'Addon/Addon_Classic.toc');
  const hardcore = parseToc('', 'Addon/Addon_Vanilla.toc', { gameMode: WoWGameMode.Hardcore });
  assert.equal(era.metadata.client, WoWClient.ClassicEra);
  assert.equal(classic.metadata.client, WoWClient.Unknown);
  assert.equal(classic.metadata.clientFamily, 'classic');
  assert.equal(hardcore.metadata.gameMode, WoWGameMode.Hardcore);
});

// Would fail if deduping one addon accidentally suppresses different addons' origin records.
test('registry retains per-addon origin and distinct account/character scopes', () => {
  const a = parseToc('## SavedVariables: Shared, First\n## SavedVariablesPerCharacter: Player', 'A/A.toc').metadata;
  const b = parseToc('## SavedVariables: Shared', 'B/B.toc').metadata;
  const registry = buildTocGlobalRegistry([a,b]);
  assert.deepEqual(listGlobals(registry), ['Shared','First','Player']);
  assert.equal(registry.entries.find((e) => e.name === 'Shared').declarations.length, 2);
  assert.equal(registry.entries.find((e) => e.name === 'Player').declarations[0].scope, 'character');
});

// Would fail if case-folding overwrites repeated custom values or aliases do not accumulate.
test('retains custom directives, aliases and original directive order', () => {
  const parsed = parseToc([
    '## Title-itIT: Zilver UI',
    '## X-Website: https://example.invalid',
    '## X-Website: https://second.invalid',
    '## RequiredDeps: LibStub',
    '## Dependencies: CallbackHandler',
    '## savedvariables: DB',
    '## savedvariablespercharacter: CharDB'
  ].join('\n'), 'ZilverUI/ZilverUI.toc');
  assert.deepEqual(parsed.metadata.dependencies, ['LibStub', 'CallbackHandler']);
  assert.deepEqual(parsed.metadata.savedVariables, ['DB']);
  assert.deepEqual(parsed.metadata.savedVariablesPerCharacter, ['CharDB']);
  assert.deepEqual(parsed.metadata.customMetadata['X-Website'], ['https://example.invalid','https://second.invalid']);
  assert.equal(parsed.metadata.directives[0].name, 'Title-itIT');
  assert.equal(parsed.metadata.directives[6].normalizedName, 'savedvariablespercharacter');
  assert.equal(JSON.parse(JSON.stringify(parsed.metadata)).schemaVersion, 2);
});

// Would fail if Unicode BOM offset corrupts first-line values or old-style line breaks are dropped.
test('handles BOM, mixed line endings and preserved source offsets', () => {
  const parsed = parseToc('\uFEFF## SavedVariables: DB\r# note\nFrame.xml\r\n', 'X/X.toc');
  assert.deepEqual(parsed.metadata.savedVariables, ['DB']);
  assert.deepEqual(parsed.metadata.files, ['Frame.xml']);
  assert.equal(parsed.entries[1].kind, 'comment');
  assert.deepEqual(parsed.metadata.savedVariableDeclarations[0].source.range, {
    start: { line: 0, column: 20 }, end: { line: 0, column: 22 }
  });
});

// Would fail if game-client line limits are not surfaced or content past the limit is parsed.
test('warns and ignores characters past the WoW line processing limit', () => {
  const raw = '## SavedVariables: ' + ' '.repeat(1006) + 'Invisible';
  const parsed = parseToc(raw, 'X/X.toc');
  assert.ok(parsed.diagnostics.some((d) => d.code === 'TOC0005'));
  assert.deepEqual(parsed.metadata.savedVariables, []);
});

// Would fail if Lua reserved words are mistakenly exposed as declared globals.
test('filters reserved Lua 5.1 keywords from globals without losing source token', () => {
  const parsed = parseToc('## SavedVariables: end, local, valid_DB', 'X/X.toc');
  assert.deepEqual(parsed.metadata.savedVariables, ['end','local','valid_DB']);
  assert.deepEqual(listGlobals(buildTocGlobalRegistry([parsed.metadata])), ['valid_DB']);
  assert.equal(parsed.diagnostics.filter((d) => d.code === 'TOC0003').length, 2);
});

// Would fail if account and per-character scope clashes are silently merged.
test('flags conflicting SavedVariables scopes without dropping provenance', () => {
  const parsed = parseToc('## SavedVariables: DB\n## SavedVariablesPerCharacter: DB', 'X/X.toc');
  const registry = buildTocGlobalRegistry([parsed.metadata]);
  assert.equal(registry.entries[0].declarations.length, 2);
  assert.ok(registry.diagnostics.some((d) => d.code === 'SV0001'));
});

// Would fail if condition extraction corrupts relative paths when directives occur mid-line.
test('extracts inline file conditions without breaking dynamic path variables', () => {
  const parsed = parseToc('[Family]\\[AllowLoadGameType vanilla]Core.lua', 'A/A.toc');
  assert.deepEqual(parsed.metadata.files, ['[Family]\\Core.lua']);
  assert.deepEqual(parsed.metadata.fileEntries[0].conditions[0].values, ['vanilla']);
});

// Would fail if custom metadata uses case-sensitive keys or prototype-sensitive object writes.
test('merges case-insensitive custom directive keys and exports plain JSON-safe records', () => {
  const parsed = parseToc([
    '## X-Website: https://first.invalid',
    '## x-website: https://second.invalid',
    '## __proto__: untrusted'
  ].join('\n'), 'A/A.toc');
  assert.deepEqual(parsed.metadata.customMetadata['X-Website'], [
    'https://first.invalid', 'https://second.invalid'
  ]);
  assert.equal(parsed.metadata.customMetadata['x-website'], undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.metadata.customMetadata))['__proto__'], ['untrusted']);
});
