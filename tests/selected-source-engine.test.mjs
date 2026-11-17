import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traceSelectedSources} from '../scripts/selected-source-engine.mjs';
import {createGraphBudget} from '../scripts/selected-source-budget.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';
import {context, memoryHost, simple, slash} from './selected-source-engine-fixtures.mjs';

test('shared graph budget denies before allocation and rolls back rejected owned copies', () => {
  let now = 0; const p = context(input => input.profile.limits = {retainedRecords: 12, retainedStringUnits: 20, readBytes: 10});
  const budget = createGraphBudget(p, {now: () => now, accountContext: false});
  const owned = budget.copy({values: ['same', 'same']}); assert.deepEqual(owned, {values: ['same', 'same']});
  const before = budget.metrics(); assert.throws(() => budget.copy({values: ['x'.repeat(21)]}), error => error.code === 'SGRAPH0005');
  assert.deepEqual(budget.metrics(), before);
  assert.throws(() => budget.copy({['x'.repeat(21)]: ''}), error => error.code === 'SGRAPH0005');
  assert.deepEqual(budget.metrics(), before);
  budget.use('readBytes', 10); assert.throws(() => budget.use('readBytes', 1), error => error.code === 'SGRAPH0005');
  now = 900000; assert.throws(() => budget.check(), error => error.code === 'SGRAPH0005');
});

test('actual selected graph traverses depth-first, retains duplicates and reuses only identical analyses', async () => {
  const fixture = memoryHost(simple());
  const trace = await traceSelectedSources(context(), fixture.host);
  assert.equal(fixture.closes, 1);
  assert.deepEqual(fixture.reads, ['Demo/Demo_Vanilla.toc', 'Demo/Demo_Mainline.toc', 'Demo/View.xml', 'Demo/Child.xml', 'Demo/Core.lua']);
  assert.equal(trace.groups[0].graphComplete, true);
  assert.deepEqual(trace.occurrences.map(row => [row.kind, slash(row.sourcePath)]), [
    ['file', 'Demo/Demo_Vanilla.toc'], ['file', 'Demo/View.xml'], ['file', 'Demo/Child.xml'],
    ['inline-chunk', 'Demo/Child.xml'], ['inline-chunk', 'Demo/View.xml'], ['file', 'Demo/Core.lua'],
    ['file', 'Demo/Core.lua'], ['file', 'Demo/Core.lua'],
  ]);
  assert.deepEqual(trace.occurrences.filter(row => slash(row.sourcePath).endsWith('/Core.lua')).map(row => row.reuse), ['invoked', 'reused', 'reused']);
  assert.equal(trace.analyses.length, 5);
  assert.equal(fixture.calls.filter(row => row.language === 'lua').length, 1);
  assert.deepEqual(trace.guardEvaluations.map(row => row.evaluation.availability), Array(5).fill('active'));
  assert.equal(trace.references.length, 5);
});

test('unknown and false guards retain original issues even on empty targets, without reading inactive paths', async () => {
  const files = simple(); files['Demo/Demo_Vanilla.toc'] = 'Empty.lua [AllowLoadTextLocale enUS]\nBad$[Unknown].lua [AllowLoadGameType other]';
  files['Demo/Empty.lua'] = '-- no declaration';
  const fixture = memoryHost(files);
  const trace = await traceSelectedSources(context(input => input.conditionPolicy.rules = input.conditionPolicy.rules.filter(row => row.name !== 'AllowLoadTextLocale')), fixture.host);
  assert.equal(trace.groups[0].analysisComplete, false);
  assert.equal(trace.guardEvaluations[0].evaluation.availability, 'unknown');
  assert.deepEqual(trace.guardEvaluations[0].evaluation.issues.map(row => row.code), ['CONDEVAL0003']);
  assert.equal(trace.references[0].targetValue, 'Empty.lua');
  assert.equal(trace.analyses.find(row => row.result.language === 'lua').result.result.declarations.length, 0);
  assert.ok(!fixture.reads.some(name => name.includes('Bad')));
  assert.equal(trace.references[1].status, 'inactive');
});

test('ancestor cycles stop at the original occurrence while a diamond retains ordinary repeated paths', async () => {
  const cyclic = simple(); cyclic['Demo/View.xml'] = '<Ui><Include file="Child.xml"/></Ui>';
  cyclic['Demo/Child.xml'] = '<Ui><Include file="../Demo/View.xml"/></Ui>';
  const first = memoryHost(cyclic), stopped = await traceSelectedSources(context(), first.host);
  const cycle = stopped.references.find(row => row.status === 'cycle');
  assert.ok(cycle); assert.equal(slash(cycle.targetSourcePath), 'Demo/View.xml');
  assert.equal(stopped.occurrences[cycle.cycleAncestorOccurrenceId].sourcePath, cycle.targetSourcePath);
  assert.equal(stopped.groups[0].resolutionEligible, false);
  assert.equal(first.calls.filter(row => row.language === 'xml').length, 2);
  const diamond = simple(); diamond['Demo/View.xml'] = '<Ui><Include file="Left.xml"/><Include file="Right.xml"/></Ui>';
  diamond['Demo/Left.xml'] = diamond['Demo/Right.xml'] = '<Ui><Include file="Shared.xml"/></Ui>';
  diamond['Demo/Shared.xml'] = '<Ui><Script file="Core.lua"/></Ui>';
  const second = memoryHost(diamond), traced = await traceSelectedSources(context(), second.host);
  assert.equal(traced.references.some(row => row.status === 'cycle'), false);
  const copies = traced.occurrences.filter(row => slash(row.sourcePath) === 'Demo/Shared.xml');
  assert.equal(copies.length, 2); assert.equal(copies[0].analysisId, copies[1].analysisId);
  assert.deepEqual(copies.map(row => row.reuse), ['invoked', 'reused']);
  assert.equal(second.calls.filter(row => slash(row.sourcePath) === 'Demo/Shared.xml').length, 1);
});

test('exact logical association scopes cached analyses and late shared-source changes invalidate every consumer', async () => {
  const input = context(row => {
    const original = row.profile.addons[0]; original.logicalAddonId = '__proto__';
    row.profile.addons.push({...structuredClone(original), logicalAddonId: 'x:α'},
      {logicalAddonId: 'independent', directory: 'Independent', addonBaseName: 'Independent', tocPaths: ['Independent/Independent_Vanilla.toc']});
  });
  const files = {...simple(), 'Independent/Independent_Vanilla.toc': 'Unique.lua', 'Independent/Unique.lua': 'Independent=1'};
  const fixture = memoryHost(files, (host, values) => {
    const verify = host.verifySource;
    host.verifySource = async (...args) => {if (slash(args[0]) === 'Demo/Core.lua') values.set('Demo/Core.lua', 'Changed=1'); return verify(...args);};
  });
  const trace = await traceSelectedSources(input, fixture.host);
  assert.deepEqual(fixture.calls.filter(row => slash(row.sourcePath) === 'Demo/Core.lua').map(row => row.addonId), ['__proto__', 'x:α']);
  assert.equal(fixture.reads.filter(name => name === 'Demo/Core.lua').length, 1);
  assert.deepEqual(trace.groups.map(row => row.resolutionEligible), [false, false, true]);
  const failed = [...trace.files.values()].find(row => slash(row.sourcePath) === 'Demo/Core.lua');
  assert.equal(failed.verdict, null); assert.equal(failed.integrity.verificationFailures, 1);
});

test('late corrupted provider association blocks that entire group without invalidating an independent valid request', async () => {
  const input = context(row => row.profile.addons.push({...structuredClone(row.profile.addons[0]), logicalAddonId: 'bad'}));
  const fixture = memoryHost(simple(), host => {
    const analyze = host.analyze;
    host.analyze = async request => {const reply = await analyze(request);
      if (request.addonId === 'bad' && request.language === 'lua') reply.result.result.declarations[0].addonId = 'wrong'; return reply;};
  });
  const trace = await traceSelectedSources(input, fixture.host);
  assert.deepEqual(trace.groups.map(row => row.resolutionEligible), [true, false]);
  assert.equal(trace.issues.some(row => row.code === 'SGRAPH0007' && row.logicalAddonId === 'bad'), true);
  const source = [...trace.files.values()].find(row => slash(row.sourcePath) === 'Demo/Core.lua');
  assert.equal(source.verdict, true); assert.equal(source.unknownStages > 0, true);
  assert.equal(trace.analyses.some(row => row.result.language === 'lua' && row.result.result.declarations.some(declaration => declaration.addonId === 'wrong')), false);
});

test('depth/analysis denial precedes descendant content reads and cache eviction does not invent parser calls', async () => {
  for (const limits of [{graphDepth: 1}, {analysisRecords: 2}, {occurrences: 1}]) {
    const fixture = memoryHost(simple()), trace = await traceSelectedSources(context(row => row.profile.limits = limits), fixture.host);
    assert.equal(trace.groups[0].resolutionEligible, false); assert.equal(trace.issues.some(row => row.code === 'SGRAPH0005'), true);
    assert.deepEqual(fixture.reads, ['Demo/Demo_Vanilla.toc', 'Demo/Demo_Mainline.toc']);
  }
  const fixture = memoryHost(simple()), trace = await traceSelectedSources(context(row => row.profile.limits = {textCacheBytes: 512}), fixture.host);
  assert.equal(trace.groups[0].resolutionEligible, true); assert.equal(trace.analyses.length, 5);
  assert.equal(fixture.calls.filter(row => row.language === 'lua').length, 1);
  assert.equal(trace.budget.metrics().textCacheBytes, 0);
});

test('fresh failed requests consume the analysis cap and initial budget denial still closes the host', async () => {
  const files = simple(); files['Demo/Demo_Vanilla.toc'] = 'Core.lua\nCore.lua';
  const fixture = memoryHost(files, host => {const analyze = host.analyze;
    host.analyze = request => request.language === 'lua' ? Promise.reject(Error('graph-analysis-exit')) : analyze(request);});
  const trace = await traceSelectedSources(context(row => {row.profile.addons[0].tocPaths = ['Demo/Demo_Vanilla.toc']; row.profile.limits = {analysisRecords: 2};}), fixture.host);
  const source = [...trace.files.values()].find(row => row.language === 'lua');
  assert.equal(source.submitted, 1); assert.equal(source.failed, 1); assert.equal(source.unknownStages, 1);
  assert.equal(trace.budget.metrics().analysisRecords, 2); assert.equal(trace.groups[0].resolutionEligible, false);
  const denied = memoryHost(simple());
  const result = await traceSelectedSources(context(row => row.profile.limits = {retainedRecords: 1}), denied.host);
  assert.equal(result.fatal, 'resource');
  assert.equal(denied.closes, 1); assert.deepEqual(denied.reads, []);
  const constructorDenied = memoryHost(simple());
  await assert.rejects(traceSelectedSources(context(row => row.profile.limits = {retainedStringUnits: 1}), constructorDenied.host), error => error.code === 'SGRAPH0005');
  assert.equal(constructorDenied.closes, 1); assert.deepEqual(constructorDenied.reads, []);
});

test('verified resource/backend receipts stay distinct from crashes and never grant syntax credit', async () => {
  for (const kind of ['resource', 'backend', 'exit']) {
    const files = simple(); files['Demo/Demo_Vanilla.toc'] = 'View.xml';
    const fixture = memoryHost(files, host => {const analyze = host.analyze;
      host.analyze = request => {
        if (request.language !== 'xml') return analyze(request);
        const calls = emptyGraphCalls(); calls.parseXml = {invoked: 1, returned: 1}; calls.analyzeXml.invoked = 1;
        throw Object.assign(Error(`graph-analysis-${kind}`), {confirmedApiCalls: calls});
      };});
    const trace = await traceSelectedSources(context(), fixture.host), source = [...trace.files.values()].find(row => row.language === 'xml');
    assert.equal(source.submitted, 1); assert.equal(source.failed, 1); assert.equal(source.verdict, null);
    assert.equal(source.failures.has(kind === 'exit' ? 'worker' : kind), true);
    assert.equal(source.unknownStages, kind === 'exit' ? 1 : 0);
    assert.equal(source.failedCalls.length, kind === 'exit' ? 0 : 1);
    assert.equal(trace.groups[0].resolutionEligible, false);
  }
});
