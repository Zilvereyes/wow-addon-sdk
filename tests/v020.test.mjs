import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToc } from '@wow-addon/toc-parser';

// Would fail if public SourceRange keeps the old flattened startLine/endLine contract.
test('source ranges use nested start/end UTF-16 positions', () => {
  const parsed = parseToc('## SavedVariables: DB', 'X/X.toc');
  assert.deepEqual(parsed.metadata.savedVariableDeclarations[0].source.range, {
    start: { line: 0, column: 19 },
    end: { line: 0, column: 21 },
  });
});

import { buildGlobalRegistry, listGlobals } from '@wow-addon/global-registry';
import { toGlobalDeclarations, buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';

const source = (file = 'Example.toc') => ({ file, range: {
  start: { line: 0, column: 0 }, end: { line: 0, column: 1 },
} });

// Would fail if header conditions are mistaken for invalid directive syntax.
test('preserves conditions attached to TOC directive names', () => {
  const parsed = parseToc('## SavedVariables[AllowLoadGameType Classic]: ZUI_DB', 'X/X.toc');
  assert.equal(parsed.diagnostics.length, 0);
  assert.deepEqual(parsed.metadata.savedVariables, ['ZUI_DB']);
  assert.equal(parsed.metadata.savedVariableDeclarations[0].conditions[0].name, 'AllowLoadGameType');
  assert.equal(toGlobalDeclarations([parsed.metadata])[0].activationState, 'conditional');
  assert.deepEqual(listGlobals(buildTocGlobalRegistry([parsed.metadata])), []);
});

// Would fail if the adapter leaks invalid names or changes the declaration order.
test('adapter converts valid names without losing provenance and excludes invalid names', () => {
  const parsed = parseToc('## SavedVariables: DB, bad-name\n## SavedVariablesPerCharacter: Player', 'X/X.toc');
  const declarations = toGlobalDeclarations([parsed.metadata]);
  assert.deepEqual(declarations.map(x => [x.name,x.scope,x.kind,x.addonId,x.activationState]), [
    ['DB','account','saved-variable','X/X.toc','unconditional'],
    ['Player','character','saved-variable','X/X.toc','unconditional'],
  ]);
  assert.deepEqual(declarations[0].source.range.start, { line: 0, column: 19 });
});

// Would fail if registry imports or requires AddOnMetadata/TOC-specific declarations.
test('global registry accepts unrelated symbol providers in one registry', () => {
  const registry = buildGlobalRegistry([
    { name: 'DB', kind:'saved-variable',scope:'account',addonId:'A',activationState:'unconditional',source:source() },
    { name: 'Frame',kind:'frame',addonId:'B',activationState:'unconditional',source:source('Frame.xml') },
    { name: 'Helper',kind:'lua-global',addonId:'C',activationState:'unknown',source:source('Script.lua') },
  ]);
  assert.deepEqual(listGlobals(registry), ['DB','Frame']);
  assert.deepEqual(listGlobals(registry,{includeUnknown:true}), ['DB','Frame','Helper']);
});

// Would fail if explicitly conditional or unknown symbols are silently treated as always active.
test('registry distinguishes conditional and unknown activation states', () => {
  const registry = buildGlobalRegistry([
    {name:'Uncond',kind:'lua-global',addonId:'A',activationState:'unconditional',source:source()},
    {name:'Cond',kind:'lua-global',addonId:'A',activationState:'conditional',source:source()},
    {name:'Unknown',kind:'lua-global',addonId:'A',activationState:'unknown',source:source()},
  ]);
  assert.deepEqual(listGlobals(registry), ['Uncond']);
  assert.deepEqual(listGlobals(registry,{includeConditional:true}), ['Uncond','Cond']);
  assert.deepEqual(listGlobals(registry,{includeUnknown:true}), ['Uncond','Unknown']);
});

// Would fail if registry discards declarations or reports conflicts between unrelated addons.
test('scope conflict preserves both sources and only applies within same addon ID', () => {
  const registry = buildGlobalRegistry([
    {name:'DB',kind:'saved-variable',scope:'account',addonId:'A',activationState:'unconditional',source:source('A.toc')},
    {name:'DB',kind:'saved-variable',scope:'character',addonId:'A',activationState:'unconditional',source:source('A2.toc')},
    {name:'DB',kind:'saved-variable',scope:'character',addonId:'B',activationState:'unconditional',source:source('B.toc')},
  ]);
  assert.equal(registry.entries[0].declarations.length, 3);
  assert.equal(registry.diagnostics.length, 1);
  assert.equal(registry.diagnostics[0].code,'SV0001');
  assert.equal(registry.diagnostics[0].related[0].file,'A.toc');
});

// Would fail if repeated same-scope declarations rescan all prior declarations.
test('scope conflict lookup performs bounded work for repeated declarations', () => {
  let propertyReads = 0;
  const declarations = Array.from({length:64}, () => new Proxy(
    {name:'DB',kind:'saved-variable',scope:'account',addonId:'A',activationState:'unconditional',source:source('A.toc')},
    {get(target, property, receiver) {
      if (property === 'kind' || property === 'scope' || property === 'addonId') propertyReads++;
      return Reflect.get(target, property, receiver);
    }},
  ));
  const registry = buildGlobalRegistry(declarations);
  assert.equal(registry.entries[0].declarations.length, declarations.length);
  assert.deepEqual(registry.diagnostics, []);
  assert.ok(propertyReads <= declarations.length * 6);
});

// Would fail if constant-time scope tracking changes the first-related-source rule.
test('repeated scope conflicts retain first opposite source ordering', () => {
  const declaration = (scope, file) =>
    ({name:'DB',kind:'saved-variable',scope,addonId:'A',activationState:'unconditional',source:source(file)});
  const registry = buildGlobalRegistry([
    declaration('account','Account-1.toc'), declaration('account','Account-2.toc'),
    declaration(undefined,'Unscoped.toc'),
    declaration('character','Character-1.toc'), declaration('character','Character-2.toc'),
    declaration('account','Account-3.toc'),
  ]);
  assert.deepEqual(registry.diagnostics.map(value => [value.source.file, value.related[0].file]), [
    ['Character-1.toc','Account-1.toc'], ['Character-2.toc','Account-1.toc'],
    ['Account-3.toc','Character-1.toc'],
  ]);
});

// Would fail if Unicode surrogate pairs were counted as one editor column.
test('UTF-16 source columns preserve surrogate pairs before variable names', () => {
  const parsed = parseToc('## SavedVariables: 😀, DB', 'Emoji/Emoji.toc');
  assert.deepEqual(parsed.metadata.savedVariableDeclarations[1].source.range, {
    start:{line:0,column:23},end:{line:0,column:25},
  });
});
