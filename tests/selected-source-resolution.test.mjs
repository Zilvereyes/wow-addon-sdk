import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveGlobalRegistry} from '@wow-addon/toc-metadata-adapter';
import {traceSelectedSources} from '../scripts/selected-source-engine.mjs';
import {composeGraphResolution} from '../scripts/selected-source-resolution.mjs';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {context, memoryHost, simple, slash} from './selected-source-engine-fixtures.mjs';

async function run(input = simple(), alterContext = () => {}, alterHost = () => {}) {
  const prepared = context(alterContext), fixture = memoryHost(input, alterHost);
  const trace = await traceSelectedSources(prepared, fixture.host);
  assert.equal(fixture.closes, 1);
  return {prepared, trace, fixture, result: composeGraphResolution(prepared, trace)};
}

test('composition uses actual selected SDK resolution and ordinal origins for identical duplicate declarations', async () => {
  const input = simple(); input['Demo/Demo_Vanilla.toc'] = '## SavedVariables: DB, bad-name, DB\nView.xml\nCore.lua\nCore.lua';
  const {result, trace, prepared} = await run(input);
  assert.deepEqual(result.resolved.activeGlobals, ['DB', 'Child', 'Out', 'Core']);
  const saved = result.declarationOrigins.filter(origin => origin.origin === 'selected-toc');
  assert.deepEqual(saved.map(origin => origin.tocDeclarationIndex), [0, 2]);
  assert.deepEqual(saved.map(origin => origin.resolvedDeclarationIndex), [0, 1]);
  assert.deepEqual(result.resolved.entries[0].declarations.map(row => slash(row.originalAddonId)), ['Demo/Demo_Vanilla.toc', 'Demo/Demo_Vanilla.toc']);
  const core = result.declarationOrigins.filter(origin => origin.declaration.name === 'Core');
  assert.deepEqual(core.map(origin => origin.resolvedDeclarationIndex), [0, 1, 2]);
  assert.equal(new Set(core.map(origin => origin.occurrenceId)).size, 3);
  assert.deepEqual(core.map(origin => origin.providerBatchIndex), [2, 3, 4]);
  assert.equal(result.declarationOrigins.find(origin => origin.declaration.name === 'Out').mapping.mappings[0].parts.length, 2);
  const request = getGraphRequest(prepared), group = trace.groups[0];
  const expected = resolveGlobalRegistry(request.environment, [{logicalAddonId: group.logicalAddonId, addonBaseName: 'Demo',
    candidates: group.candidates.map(({loaded}) => ({identity: {logicalAddonId: group.logicalAddonId,
      tocVariantId: JSON.stringify([group.logicalAddonId, loaded.sourcePath]), tocPath: loaded.sourcePath,
      tocSuffix: loaded.parsed.metadata.tocSuffix, source: {file: loaded.sourcePath, range: {start: {line: 0, column: 0}, end: {line: 0, column: 0}}}},
    metadata: loaded.parsed.metadata})), selectionPolicy: request.selectionPolicy, providers: trace.providerBatches.get(0)}], request.conditionPolicy);
  assert.deepEqual(result.resolved, expected);
  assert.equal(result.complete, false); // Invalid identifier/duplicate diagnostics remain analysis evidence.
});

test('origin or exact-variant invariant failure excludes the whole group while an independent group survives', async () => {
  for (const corrupt of [trace => trace.originInputs[0].providerDeclarationIndex++, trace => trace.providerBatches.get(0)[0].tocVariantId = 'wrong',
    trace => trace.providerBatches.get(0)[0].providerId = 'wrong-provider',
    trace => trace.originInputs[0].mapping.mappings[0].parts[0].source.range.start.column++]) {
    const prepared = context(input => input.profile.addons.push({logicalAddonId: '__proto__', directory: 'Other', addonBaseName: 'Other', tocPaths: ['Other/Other.toc']}));
    const fixture = memoryHost({...simple(), 'Other/Other.toc': '## SavedVariables: OtherDB\nCore.lua', 'Other/Core.lua': 'OtherGlobal=1'});
    const trace = await traceSelectedSources(prepared, fixture.host); corrupt(trace);
    const result = composeGraphResolution(prepared, trace);
    assert.deepEqual(result.resolved.activeGlobals, ['OtherDB', 'OtherGlobal']);
    assert.equal(result.groups[0].resolutionEligible, false);
    assert.equal(result.groups[1].resolutionEligible, true);
    assert.equal(result.issues[0].code, 'SGRAPH0007'); assert.equal(result.complete, false);
  }
});

test('late changed source blocks all affected declarations including automatic SavedVariables', async () => {
  const {result} = await run(simple(), () => {}, host => {host.verifySource = async source => !slash(source).endsWith('Core.lua');});
  assert.deepEqual(result.resolved.entries, []);
  assert.ok(result.declarationOrigins.length > 0);
  assert.ok(result.declarationOrigins.every(origin => origin.resolvedEntryIndex === null && origin.resolvedDeclarationIndex === null));
  assert.equal(result.complete, false);
});

test('XML frame origins bind to actual analysis ordinals even when batch and sidecar are coherently forged or omitted', async () => {
  for (const corrupt of [trace => {
    trace.providerBatches.get(0)[0].declarations[0].name = 'Forged'; trace.originInputs[0].declaration.name = 'Forged';
  }, trace => {trace.providerBatches.get(0).length = 0; trace.originInputs.length = 0;}]) {
    const prepared = context(), fixture = memoryHost({'Demo/Demo_Vanilla.toc': 'View.xml', 'Demo/Demo_Mainline.toc': '',
      'Demo/View.xml': '<Ui><Frame name="Authored"/></Ui>'});
    const trace = await traceSelectedSources(prepared, fixture.host);
    const control = composeGraphResolution(prepared, trace); assert.deepEqual(control.resolved.entries.map(row => row.name), ['Authored']);
    corrupt(trace); const result = composeGraphResolution(prepared, trace);
    assert.equal(result.groups[0].resolutionEligible, false); assert.deepEqual(result.resolved.entries, []);
    assert.equal(result.issues[0].code, 'SGRAPH0007');
  }
});

test('missing inline context preserves supported facts and untouched core completeness', async () => {
  const {result} = await run({'Demo/Demo_Vanilla.toc': '## SavedVariables: DB\nView.xml', 'Demo/Demo_Mainline.toc': '',
    'Demo/View.xml': '<Ui><Script>Known=1</Script><Frame><Scripts><OnShow>Missing=1</OnShow></Scripts></Frame></Ui>'},
  input => input.xmlPolicy.handlerElements.push({namespaceUri: null, localName: 'OnShow'}));
  assert.equal(result.groups[0].resolutionEligible, true);
  assert.equal(result.groups[0].analysisComplete, false);
  assert.deepEqual(result.resolved.activeGlobals, ['DB', 'Known']);
  assert.equal(result.resolved.complete, true); assert.equal(result.complete, false);
});

test('whole and shortened Lua or inline batches cannot omit validated declarations from a complete group', async () => {
  for (const inline of [false, true]) for (const omit of [false, true]) {
    const prepared = context(), files = {'Demo/Demo_Vanilla.toc': inline ? 'View.xml' : 'Core.lua', 'Demo/Demo_Mainline.toc': ''};
    files[inline ? 'Demo/View.xml' : 'Demo/Core.lua'] = inline ? '<Ui><Script>Out=1; Other=2</Script></Ui>' : 'Out=1; Other=2';
    const fixture = memoryHost(files), trace = await traceSelectedSources(prepared, fixture.host);
    assert.deepEqual(composeGraphResolution(prepared, trace).resolved.activeGlobals, ['Out', 'Other']);
    if (omit) {trace.providerBatches.get(0).length = 0; trace.originInputs.length = 0;}
    else {trace.providerBatches.get(0)[0].declarations.length = 1; trace.originInputs.length = 1;}
    const result = composeGraphResolution(prepared, trace);
    assert.equal(result.groups[0].resolutionEligible, false); assert.deepEqual(result.resolved.entries, []);
    assert.equal(result.issues[0].code, 'SGRAPH0007');
  }
});

test('owned resolution and origins cannot mutate the trace, prepared context, or another call', async () => {
  const {prepared, trace, result} = await run();
  assert.equal(result.complete, true);
  const other = composeGraphResolution(prepared, trace);
  result.resolved.entries[0].declarations[0].declaration.source.file = 'changed';
  result.declarationOrigins.at(-1).declaration.source.range.start.column = 999;
  assert.notEqual(other.resolved.entries[0].declarations[0].declaration.source.file, 'changed');
  assert.notEqual(trace.originInputs.at(-1).declaration.source.range.start.column, 999);
  assert.notEqual(other.declarationOrigins.at(-1).declaration.source.range.start.column, 999);
  assert.equal(Object.isFrozen(getGraphRequest(prepared)), true);
});

test('composition budget expiry publishes no resolver prefix', async () => {
  let now = 0; const prepared = context();
  const fixture = memoryHost(simple(), host => {host.nowMilliseconds = () => now;});
  const trace = await traceSelectedSources(prepared, fixture.host); now = 900000;
  assert.throws(() => composeGraphResolution(prepared, trace), error => error.code === 'SGRAPH0005');
});

test('declaration-free unknown guard and all-no-match selection remain incomplete tool evidence', async () => {
  const unknown = await run({'Demo/Demo_Vanilla.toc': 'Empty.lua [AllowLoadTextLocale enUS]', 'Demo/Demo_Mainline.toc': '', 'Demo/Empty.lua': '-- empty'},
    input => input.conditionPolicy.rules = input.conditionPolicy.rules.filter(rule => rule.name !== 'AllowLoadTextLocale'));
  assert.equal(unknown.result.groups[0].resolutionEligible, true);
  assert.equal(unknown.result.resolved.complete, true); assert.equal(unknown.result.complete, false);
  assert.deepEqual(unknown.result.resolved.entries, []);
  const absent = await run(simple(), input => input.selectionPolicy.suffixPrecedence = ['Classic']);
  assert.equal(absent.result.groups[0].selection.status, 'no-match');
  assert.equal(absent.result.resolved.complete, true); assert.equal(absent.result.complete, false);
});

test('separate environment and selected-variant contexts consume only their own provider batches', async () => {
  const era = await run();
  const other = await run(simple(), input => {
    input.environment.textLocale = 'deDE'; input.selectionPolicy.suffixPrecedence = ['Mainline'];
  });
  assert.deepEqual(era.result.resolved.activeGlobals, ['DB', 'Child', 'Out', 'Core']);
  assert.deepEqual(other.result.resolved.activeGlobals, ['Never']);
  assert.ok(other.result.declarationOrigins.every(origin => origin.declaration.name === 'Never'));
  assert.notEqual(era.result.resolved.addons[0].selection.selectedVariantId, other.result.resolved.addons[0].selection.selectedVariantId);
});
