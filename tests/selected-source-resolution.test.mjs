import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveGlobalRegistry} from '@wow-addon/toc-metadata-adapter';
import {parseToc} from '@wow-addon/toc-parser';
import {parseXml} from '@wow-addon/xml-parser';
import {analyzeXml} from '@wow-addon/xml-analysis';
import {traceSelectedSources} from '../scripts/selected-source-engine.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';
import {composeGraphResolution} from '../scripts/selected-source-resolution.mjs';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {analyzeSelectedSources} from '../scripts/selected-source-graph.mjs';
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
  const analysisOf = name => trace.analyses.find(analysis => slash(analysis.sourcePath) === 'Demo/' + name).result;
  const providers = [
    analysisOf('Child.xml').inline[0].analysis.declarations,
    analysisOf('View.xml').inline[0].analysis.declarations,
    ...Array(3).fill(analysisOf('Core.lua').result.declarations),
  ].map(declarations => ({providerId: '@wow-addon/lua-analysis', tocVariantId: group.selection.selectedVariantId, declarations}));
  const expected = resolveGlobalRegistry(request.environment, [{logicalAddonId: group.logicalAddonId, addonBaseName: 'Demo',
    candidates: group.candidates.map(({loaded}) => ({identity: {logicalAddonId: group.logicalAddonId,
      tocVariantId: JSON.stringify([group.logicalAddonId, loaded.sourcePath]), tocPath: loaded.sourcePath,
      tocSuffix: loaded.parsed.metadata.tocSuffix, source: {file: loaded.sourcePath, range: {start: {line: 0, column: 0}, end: {line: 0, column: 0}}}},
    metadata: loaded.parsed.metadata})), selectionPolicy: request.selectionPolicy, providers}], request.conditionPolicy);
  assert.deepEqual(result.resolved, expected);
  assert.equal(result.complete, false); // Invalid identifier/duplicate diagnostics remain analysis evidence.
});

test('origin or exact-variant invariant failure excludes the whole group while an independent group survives', async () => {
  for (const corrupt of [trace => trace.providerBatches.get(0)[0].providerBatchIndex++, trace => trace.providerBatches.get(0)[0].tocVariantId = 'wrong',
    trace => trace.providerBatches.get(0)[0].providerId = 'wrong-provider',
    trace => trace.providerBatches.get(0)[0].inlineElementIndex++,
    trace => trace.providerBatches.get(0)[0].analysisId++,
    trace => trace.providerBatches.get(0)[0].occurrenceId = -1]) {
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

test('XML frame origins bind to actual analysis ordinals when a batch is redirected or omitted', async () => {
  for (const corrupt of [trace => {trace.providerBatches.get(0)[0].frameIndex = 1;},
    trace => {trace.providerBatches.get(0).length = 0;}]) {
    const prepared = context(), fixture = memoryHost({'Demo/Demo_Vanilla.toc': 'View.xml', 'Demo/Demo_Mainline.toc': '',
      'Demo/View.xml': '<Ui><Frame name="Authored"/><Frame name="Second"/></Ui>'});
    const trace = await traceSelectedSources(prepared, fixture.host);
    const control = composeGraphResolution(prepared, trace); assert.deepEqual(control.resolved.entries.map(row => row.name), ['Authored', 'Second']);
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

test('inline Lua warning mappings do not displace declaration provenance', async () => {
  const xml = '<Ui><!--🙂--><Script>Out = 1; _G[key] = 2</Script></Ui>';
  const prepared = context(), fixture = memoryHost({
    'Demo/Demo_Vanilla.toc': 'View.xml', 'Demo/Demo_Mainline.toc': '', 'Demo/View.xml': xml,
  });
  const graph = await analyzeSelectedSources(getGraphRequest(prepared), fixture.host);
  const inline = graph.analyses.find(row => row.result.language === 'xml').result.inline[0];
  assert.deepEqual(inline.analysis.diagnostics.map(row => row.code), ['LUA0004']);
  assert.equal(inline.mapping.mappings.length, 2);
  assert.deepEqual(graph.issues, []);
  assert.equal(graph.groups[0].graphComplete, true);
  assert.equal(graph.groups[0].resolutionEligible, true);
  assert.equal(graph.groups[0].analysisComplete, false);
  assert.deepEqual(graph.resolved.activeGlobals, []);
  assert.equal(graph.resolved.entries[0].declarations[0].evaluation.availability, 'unknown');
  assert.deepEqual(graph.aggregate.inlineLua.diagnosticsByCode, {LUA0004: 1});
  const [origin] = graph.declarationOrigins;
  assert.equal(origin.declaration.name, 'Out');
  assert.deepEqual(origin.mapping.mappings, [inline.mapping.mappings[0]]);
  const column = xml.indexOf('Out');
  const [part] = origin.mapping.mappings[0].parts;
  assert.equal(slash(part.source.file), 'Demo/View.xml');
  assert.deepEqual(part.source.range, {start: {line: 0, column}, end: {line: 0, column: column + 3}});
});

test('whole and shortened Lua or inline batches cannot omit validated declarations from a complete group', async () => {
  for (const inline of [false, true]) for (const omit of [false, true]) {
    const prepared = context(), files = {'Demo/Demo_Vanilla.toc': inline ? 'View.xml' : 'Core.lua', 'Demo/Demo_Mainline.toc': ''};
    files[inline ? 'Demo/View.xml' : 'Demo/Core.lua'] = inline ? '<Ui><Script>Out=1; Other=2</Script></Ui>' : 'Out=1; Other=2';
    const fixture = memoryHost(files), trace = await traceSelectedSources(prepared, fixture.host);
    assert.deepEqual(composeGraphResolution(prepared, trace).resolved.activeGlobals, ['Out', 'Other']);
    if (omit) trace.providerBatches.get(0).length = 0;
    else trace.providerBatches.get(0)[0].declarationCount = 1;
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
  const inline = origin => origin.declarationOrigins.find(row => row.declaration.name === 'Out');
  inline(result).mapping.mappings[0].parts[0].source.range.start.column = 999;
  assert.notEqual(other.resolved.entries[0].declarations[0].declaration.source.file, 'changed');
  const originalLua = trace.analyses.find(row => row.result.language === 'lua').result.result;
  assert.notEqual(originalLua.declarations[0].source.range.start.column, 999);
  const originalInline = trace.analyses.find(row => slash(row.sourcePath) === 'Demo/View.xml').result.inline[0];
  assert.notEqual(originalInline.mapping.mappings[0].parts[0].source.range.start.column, 999);
  assert.notEqual(inline(other).mapping.mappings[0].parts[0].source.range.start.column, 999);
  assert.notEqual(other.declarationOrigins.at(-1).declaration.source.range.start.column, 999);
  assert.equal(Object.isFrozen(getGraphRequest(prepared)), true);
});

test('composition budget expiry publishes no resolver prefix', async () => {
  let now = 0; const prepared = context();
  const fixture = memoryHost(simple(), host => {host.nowMilliseconds = () => now;});
  const trace = await traceSelectedSources(prepared, fixture.host); now = 900000;
  assert.throws(() => composeGraphResolution(prepared, trace), error => error.code === 'SGRAPH0005');
});

test('a declaration-heavy graph fits the lower retained-record limit with full ownership and ordering', async () => {
  const tocPath = 'Demo/Demo_Vanilla.toc';
  const names = ['Alpha'], targets = [], files = {};
  for (let file = 0; file < 6; file++) {
    const target = 'Part' + file + '.lua';
    const declarations = Array.from({length: 200}, (_, line) => 'Fixture_' + file + '_' + line);
    targets.push(target);
    names.push(...declarations);
    files['Demo/' + target] = declarations.map(name => name + '=1').join('\n');
  }
  files[tocPath] = ['## SavedVariables: Alpha', ...targets].join('\n');
  const prepared = context(input => {
    input.profile.addons[0].tocPaths = [tocPath];
    input.profile.limits = {retainedRecords: 31500};
  });
  const fixture = memoryHost(files);
  const result = await analyzeSelectedSources(getGraphRequest(prepared), fixture.host);
  assert.equal(result.aggregate.status, 'passed', JSON.stringify(result.aggregate.issuesByCode));
  assert.equal(fixture.closes, 1);
  assert.deepEqual(result.resolved.activeGlobals, names);
  assert.deepEqual(result.declarationOrigins.map(origin => origin.declaration.name), names);
  assert.deepEqual(result.declarationOrigins.slice(1).map(origin => [
    origin.providerBatchIndex, origin.providerDeclarationIndex,
    origin.declaration.source.range.start.line, origin.resolvedEntryIndex, origin.resolvedDeclarationIndex,
  ]), names.slice(1).map((_, index) => [Math.floor(index / 200), index % 200, index % 200, index + 1, 0]));
});

test('XML-heavy graph fits the final resolver budget with complete ordered provenance', async () => {
  const addons = [], files = {};
  for (let group = 0; group < 8; group++) {
    const directory = 'Fixture' + group, tocPath = directory + '/' + directory + '_Vanilla.toc';
    addons.push({logicalAddonId: 'authored/fixture-' + group, directory, addonBaseName: directory, tocPaths: [tocPath]});
    const targets = Array.from({length: 5}, (_, index) => 'Body' + index + '.xml');
    files[tocPath] = targets.join('\n');
    for (const [file, target] of targets.entries()) {
      const frames = Array.from({length: 30}, (_, index) => '<Frame name="Group' + group + 'Doc' + file + 'Name' + index + '"/>');
      files[directory + '/' + target] = ['<Ui>', ...frames, '</Ui>'].join('\n');
    }
  }
  async function resolve(retainedRecords) {
    const prepared = context(input => {input.profile.addons = addons; input.profile.limits = {retainedRecords};});
    const fixture = memoryHost(files, host => {
      // Real SDK calls with no subprocess timing dependency for this quota control.
      host.analyze = async ({language, content, sourcePath, addonId, conditions, xmlPolicy}) => {
        const confirmedApiCalls = emptyGraphCalls();
        const invoke = (name, call) => {
          confirmedApiCalls[name].invoked++;
          const projected = call();
          confirmedApiCalls[name].returned++;
          return projected;
        };
        const result = language === 'toc'
          ? {language, parsed: invoke('parseToc', () => parseToc(content, sourcePath))}
          : {language, syntax: invoke('parseXml', () => parseXml(content, sourcePath)),
            provider: invoke('analyzeXml', () => analyzeXml(content, sourcePath, {addonId, conditions, policy: xmlPolicy})),
            inline: []};
        return {result, confirmedApiCalls};
      };
    });
    const result = await analyzeSelectedSources(getGraphRequest(prepared), fixture.host);
    assert.equal(fixture.closes, 1);
    assert.equal(result.declarationOrigins.length, 1200);
    assert.ok(result.groups.every(group => group.resolutionEligible));
    assert.ok(result.declarationOrigins.every((origin, index) => origin.resolvedEntryIndex === index && origin.resolvedDeclarationIndex === 0));
    return result;
  }
  assert.deepEqual(await resolve(119000), await resolve(1_000_000));
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
