import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {analyzeSelectedSources} from '../scripts/selected-source-graph.mjs';
import {context, memoryHost, simple, slash} from './selected-source-engine-fixtures.mjs';

test('private graph result composes real providers, duplicate origins and a separately allowlisted wire result', async () => {
  const prepared = context(), request = getGraphRequest(prepared), fixture = memoryHost(simple());
  const result = await analyzeSelectedSources(request, fixture.host);
  assert.deepEqual(Object.keys(result).sort(), ['schemaVersion', 'completeUnderPolicy', 'groups', 'nodes', 'analyses', 'guardEvaluations',
    'references', 'occurrences', 'declarationOrigins', 'diagnostics', 'issues', 'resolved', 'aggregate'].sort());
  assert.equal(fixture.closes, 1); assert.equal(result.completeUnderPolicy, true);
  assert.deepEqual(result.resolved.activeGlobals, ['DB', 'Child', 'Out', 'Core']);
  assert.equal(result.declarationOrigins.filter(row => row.declaration.name === 'Core').length, 3);
  assert.equal(result.aggregate.languages.lua.syntaxVerdictFiles, 1);
  assert.equal(result.aggregate.inlineLua.syntaxAccepted, 2);
  assert.deepEqual(result.aggregate.confirmedApiCalls.analyzeLua, {invoked: 3, returned: 3});
  assert.equal(result.aggregate.fullParsing, false); assert.equal(result.aggregate.clientConformance, false);
  const wire = JSON.stringify(result.aggregate);
  for (const secret of ['Demo', 'Core.lua', 'View.xml', 'logicalAddonId', 'sourcePath', 'fingerprint', 'SavedVariables', 'Out=1']) assert.equal(wire.includes(secret), false);
  assert.equal(result.aggregate.status, 'passed'); assert.equal(Object.isFrozen(request), true);
});

test('final integrity failure withdraws affected syntax/API/resolution credit while an independent group remains', async () => {
  const prepared = context(input => input.profile.addons.push({logicalAddonId: 'other', directory: 'Other', addonBaseName: 'Other', tocPaths: ['Other/Other.toc']}));
  const fixture = memoryHost({...simple(), 'Other/Other.toc': '## SavedVariables: Good\nFine.lua', 'Other/Fine.lua': 'Fine=1'},
    host => {host.verifySource = async name => !slash(name).endsWith('Core.lua');});
  const result = await analyzeSelectedSources(getGraphRequest(prepared), fixture.host);
  assert.deepEqual(result.resolved.activeGlobals, ['Good', 'Fine']);
  assert.deepEqual(result.groups.map(row => row.resolutionEligible), [false, true]);
  assert.equal(result.aggregate.languages.lua.syntaxVerdictFiles, 1);
  assert.equal(result.aggregate.languages.lua.skippedBeforeSyntaxVerdict.readRejected, 1);
  assert.equal(result.aggregate.completeUnderPolicy, false); assert.equal(result.aggregate.status, 'failed');
  assert.equal(result.aggregate.resolution.coreComplete, true); assert.equal(result.aggregate.resolution.complete, false);
});

test('invalid preflight and exhausted publication never return a fabricated resolver prefix and always close the host', async () => {
  const invalid = memoryHost(simple());
  await assert.rejects(analyzeSelectedSources({}, invalid.host), error => error.code === 'SGRAPH0001');
  assert.equal(invalid.closes, 1); assert.deepEqual(invalid.reads, []);
  let now = 0;
  const prepared = context(), fixture = memoryHost(simple(), host => {
    host.nowMilliseconds = () => now; const close = host.close;
    host.close = async () => {await close(); now = 900000;};
  });
  await assert.rejects(analyzeSelectedSources(getGraphRequest(prepared), fixture.host), error => error.code === 'SGRAPH0005');
  assert.equal(fixture.closes, 1);
});
