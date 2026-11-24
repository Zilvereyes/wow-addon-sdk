import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traceSelectedSources} from '../scripts/selected-source-engine.mjs';
import {composeGraphResolution} from '../scripts/selected-source-resolution.mjs';
import {buildSelectedSourceAggregate} from '../scripts/selected-source-accounting.mjs';
import {createGraphBudget} from '../scripts/selected-source-budget.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {context, memoryHost, simple, slash} from './selected-source-engine-fixtures.mjs';

async function run(files = simple(), alterContext = () => {}, alterHost = () => {}) {
  const prepared = context(alterContext), fixture = memoryHost(files, alterHost);
  const trace = await traceSelectedSources(prepared, fixture.host), composition = composeGraphResolution(prepared, trace);
  return {prepared, fixture, trace, composition, aggregate: buildSelectedSourceAggregate(prepared, trace, composition)};
}
function partitions(aggregate) {
  for (const language of ['toc', 'lua', 'xml']) {
    const row = aggregate.languages[language];
    assert.equal(row.syntaxVerdictFiles, row.syntaxAcceptedFiles + row.syntaxRejectedFiles);
    assert.equal(row.eligibleSourceFiles, row.syntaxVerdictFiles + Object.values(row.skippedBeforeSyntaxVerdict).reduce((a, b) => a + b, 0));
    if (aggregate.discovery.complete) assert.equal(aggregate.discovery.found[language], row.eligibleSourceFiles + row.notRequestedSourceFiles);
  }
  const row = aggregate.selection;
  assert.equal(row.explicitCandidateRows, row.selectedCandidateRows + row.nonSelectedCandidateRows + row.undecidedCandidateRows);
}

test('actual SDK graph has unique files, separate inline calls, duplicate origins and a private-data-free aggregate', async () => {
  const {fixture, trace, aggregate} = await run();
  assert.equal(fixture.closes, 1); assert.equal(aggregate.status, 'passed'); assert.equal(aggregate.completeUnderPolicy, true);
  assert.equal(aggregate.fullParsing, false); assert.equal(aggregate.clientConformance, false);
  assert.deepEqual(aggregate.discovery.found, {toc: 2, lua: 3, xml: 2});
  assert.deepEqual(aggregate.selection, {requestedGroups: 1, selected: 1, noMatch: 0, unresolved: 0, ambiguous: 0, invalid: 0, notInvoked: 0,
    explicitCandidateRows: 2, selectedCandidateRows: 1, nonSelectedCandidateRows: 1, undecidedCandidateRows: 0});
  assert.deepEqual(['toc', 'lua', 'xml'].map(language => {
    const row = aggregate.languages[language]; return [row.eligibleSourceFiles, row.notRequestedSourceFiles, row.uniqueFilesRead, row.syntaxVerdictFiles];
  }), [[2, 0, 2, 2], [1, 2, 1, 1], [2, 0, 2, 2]]);
  assert.equal(aggregate.languages.lua.reusedAnalyses, 2); assert.equal(aggregate.languages.lua.sourceRequestsSubmitted, 1);
  assert.deepEqual(aggregate.confirmedApiCalls, {parseToc: {invoked: 2, returned: 2}, parseXml: {invoked: 2, returned: 2},
    analyzeLua: {invoked: 3, returned: 3}, analyzeXml: {invoked: 2, returned: 2}, mapXmlValueRanges: {invoked: 2, returned: 2}});
  assert.deepEqual(aggregate.inlineLua, {discoveredBodies: 2, attemptedBodies: 2, skippedMissingContext: 0, syntaxAccepted: 2, syntaxRejected: 0,
    resourceBlocked: 0, backendBlocked: 0, lexicalComplete: 2, lexicalIncomplete: 0, mappingValidated: 2, originalParts: 3, diagnosticsByCode: {}});
  assert.equal(aggregate.graph.sourceNodes, 5); assert.equal(aggregate.graph.analysisRecords, 5); assert.equal(aggregate.graph.occurrences, 8);
  assert.equal(aggregate.graph.referenceOccurrences, 5); assert.equal(aggregate.resolution.declarations, 6); assert.equal(aggregate.resolution.activeGlobals, 4);
  partitions(aggregate);
  const serialized = JSON.stringify(aggregate);
  for (const forbidden of ['authored/demo', 'Demo', 'Core', 'Out', 'Child', 'DB', 'sourcePath', 'fingerprint', 'declarationOrigins', 'message', 'conditions']) assert.equal(serialized.includes(forbidden), false, forbidden);
  // Output remains owned independently of the private trace, including nested histograms.
  aggregate.discovery.found.lua = 999; assert.equal(trace.discovery.found.lua, 3);
});

test('one validated dynamic diagnostic is counted once per analysis and three times per file occurrence', async () => {
  const files = simple(); files['Demo/Core.lua'] = 'Core=1\n_G.Other=2';
  const {aggregate} = await run(files);
  assert.equal(aggregate.status, 'failed'); assert.equal(aggregate.completeUnderPolicy, false);
  assert.deepEqual(aggregate.languages.lua.analysisDiagnosticsByCode, {LUA0004: 1});
  assert.deepEqual(aggregate.languages.lua.occurrenceDiagnosticsByCode, {LUA0004: 3});
  assert.equal(aggregate.languages.lua.syntaxAcceptedFiles, 1); assert.equal(aggregate.languages.lua.reusedAnalyses, 2);
  partitions(aggregate);
});

test('reused XML inline bodies add occurrence diagnostics without doubling inline or standalone Lua credit', async () => {
  const files = simple(); files['Demo/Demo_Vanilla.toc'] = 'View.xml\nView.xml'; files['Demo/View.xml'] = '<Ui><Script>_G.X=1</Script></Ui>';
  const {aggregate} = await run(files);
  assert.equal(aggregate.languages.lua.eligibleSourceFiles, 0); assert.equal(aggregate.languages.xml.reusedAnalyses, 1);
  assert.deepEqual(aggregate.languages.xml.analysisDiagnosticsByCode, {LUA0004: 1});
  assert.deepEqual(aggregate.languages.xml.occurrenceDiagnosticsByCode, {LUA0004: 2});
  assert.equal(aggregate.inlineLua.discoveredBodies, 1); assert.equal(aggregate.inlineLua.lexicalIncomplete, 1);
  assert.deepEqual(aggregate.inlineLua.diagnosticsByCode, {LUA0004: 1});
  assert.equal(aggregate.confirmedApiCalls.analyzeLua.returned, 1); assert.equal(aggregate.confirmedApiCalls.mapXmlValueRanges.returned, 1);
  assert.equal(aggregate.status, 'failed'); partitions(aggregate);
});

test('changed source withdraws all semantic and API credit while operational requests remain observed', async () => {
  const {aggregate} = await run(simple(), () => {}, host => {
    const verify = host.verifySource; host.verifySource = (name, fingerprint, maximum) => slash(name).endsWith('/Core.lua') ? false : verify(name, fingerprint, maximum);
  });
  const row = aggregate.languages.lua;
  assert.equal(row.eligibleSourceFiles, 1); assert.equal(row.syntaxVerdictFiles, 0); assert.equal(row.uniqueFilesRead, 1);
  assert.equal(row.skippedBeforeSyntaxVerdict.readRejected, 1); assert.equal(row.sourceRequestsSubmitted, 1); assert.equal(row.sourceRequestsCompleted, 1);
  assert.equal(row.sourceIntegrity.verificationFailures, 1); assert.equal(aggregate.confirmedApiCalls.analyzeLua.invoked, 2);
  assert.equal(aggregate.resolution.declarations, 0); assert.equal(aggregate.status, 'failed'); partitions(aggregate);
});

test('known failed receipts confirm actual direct stages while crash counters do not invent stages', async () => {
  for (const kind of ['resource', 'backend', 'exit']) {
    const files = simple(); files['Demo/Demo_Vanilla.toc'] = 'View.xml';
    const {aggregate} = await run(files, () => {}, host => {
      const analyze = host.analyze;
      host.analyze = request => {
        if (request.language !== 'xml') return analyze(request);
        const confirmedApiCalls = emptyGraphCalls(); confirmedApiCalls.parseXml = {invoked: 1, returned: 1}; confirmedApiCalls.analyzeXml.invoked = 1;
        throw Object.assign(Error(`graph-analysis-${kind}`), {confirmedApiCalls});
      };
    });
    const row = aggregate.languages.xml;
    assert.equal(row.syntaxVerdictFiles, 0); assert.equal(row.sourceRequestsFailed, 1);
    assert.equal(row.failedRequestsWithUnknownStages, kind === 'exit' ? 1 : 0);
    assert.equal(aggregate.confirmedApiCalls.parseXml.returned, kind === 'exit' ? 0 : 1);
    assert.equal(aggregate.confirmedApiCalls.analyzeXml.invoked, kind === 'exit' ? 0 : 1);
    assert.equal(aggregate.confirmedApiCalls.analyzeXml.returned, 0); assert.equal(aggregate.inlineLua.attemptedBodies, 0);
    assert.equal(row.skippedBeforeSyntaxVerdict[kind === 'exit' ? 'workerRejected' : `${kind}Rejected`], 1);
    assert.equal(row[kind === 'exit' ? 'workerFailures' : kind === 'resource' ? 'resourceRejected' : 'backendFailures'], 1);
    partitions(aggregate);
  }
});

test('zero selected roots remains incomplete even when the actual empty core result is complete', async () => {
  const {aggregate, composition} = await run(simple(), input => input.profile.addons[0].tocPaths = ['Demo/Demo_Mainline.toc']);
  assert.equal(composition.resolved.complete, true); assert.equal(aggregate.resolution.coreComplete, true);
  assert.equal(aggregate.resolution.complete, false); assert.equal(aggregate.selection.noMatch, 1);
  assert.equal(aggregate.status, 'incomplete'); assert.equal(aggregate.languages.lua.eligibleSourceFiles, 0); partitions(aggregate);
});

test('candidate worker failures are failed observations, while missing rows never invent eligible sources', async () => {
  const failed = await run(simple(), () => {}, host => {
    const analyze = host.analyze; host.analyze = request => slash(request.sourcePath).endsWith('Mainline.toc') ? Promise.reject(Error('graph-analysis-exit')) : analyze(request);
  });
  assert.equal(failed.aggregate.selection.notInvoked, 1); assert.equal(failed.aggregate.selection.undecidedCandidateRows, 2);
  assert.equal(failed.aggregate.languages.toc.workerFailures, 1); assert.equal(failed.aggregate.languages.toc.syntaxVerdictFiles, 1);
  assert.equal(failed.aggregate.status, 'failed'); partitions(failed.aggregate);
  const files = simple(); delete files['Demo/Demo_Mainline.toc']; const missing = await run(files);
  assert.equal(missing.aggregate.selection.notInvoked, 1); assert.equal(missing.aggregate.selection.explicitCandidateRows, 2);
  assert.equal(missing.aggregate.languages.toc.eligibleSourceFiles, 1); assert.equal(missing.aggregate.discovery.found.toc, 1);
  assert.equal(missing.aggregate.languages.lua.eligibleSourceFiles, 0); assert.equal(missing.aggregate.completeUnderPolicy, false); partitions(missing.aggregate);
});

test('unknown guard with no declarations and missing inline context cannot be hidden by complete core', async () => {
  const files = simple(); files['Demo/Demo_Vanilla.toc'] = 'Empty.lua [AllowLoadTextLocale enUS]'; files['Demo/Empty.lua'] = '-- empty';
  const unknown = await run(files, input => input.conditionPolicy.rules = input.conditionPolicy.rules.filter(row => row.name !== 'AllowLoadTextLocale'));
  assert.equal(unknown.aggregate.graph.unknownGuards, 1); assert.deepEqual(unknown.aggregate.graph.guardIssuesByCode, {CONDEVAL0003: 1});
  assert.equal(unknown.aggregate.resolution.declarations, 0); assert.equal(unknown.aggregate.resolution.coreComplete, true);
  assert.equal(unknown.aggregate.resolution.complete, false); assert.equal(unknown.aggregate.status, 'incomplete');
  files['Demo/Demo_Vanilla.toc'] = 'View.xml'; files['Demo/View.xml'] = '<Ui><Frame><Scripts><OnLoad>local x=1</OnLoad></Scripts></Frame></Ui>';
  const missing = await run(files, input => input.inlineProfile.handlers = []);
  assert.equal(missing.aggregate.inlineLua.discoveredBodies, 1); assert.equal(missing.aggregate.inlineLua.skippedMissingContext, 1);
  assert.equal(missing.aggregate.inlineLua.attemptedBodies, 0); assert.equal(missing.aggregate.resolution.coreComplete, true);
  assert.equal(missing.aggregate.completeUnderPolicy, false); assert.equal(missing.aggregate.status, 'incomplete');
});

// These accounting-unit fixtures are trusted private observations, not additional parser evidence.
function observedFile(language = 'lua', failures = []) {
  return {language, fingerprint: null, valid: true, verdict: null, failures: new Set(failures), submitted: 0, completed: 0,
    failed: 0, unknownStages: 0, reuses: 0, failedCalls: [], failureCounts: {read: 0, encoding: 0, resource: 0, worker: 0, backend: 0, invariant: 0},
    integrity: {checked: 0, matching: 0, changed: 0, verificationFailures: 0}};
}
function unit(prepared = context()) {
  const request = getGraphRequest(prepared), groups = request.profile.addons.map(row => ({logicalAddonId: row.logicalAddonId,
    selection: null, graphComplete: false, analysisComplete: false, resolutionEligible: false}));
  const trace = {budget: createGraphBudget(prepared, {accountContext: false}), fatal: null, files: new Map(), analyses: [], nodes: [],
    occurrences: [], references: [], guardEvaluations: [], issues: [], discovery: {complete: true, entriesVisited: 0,
      found: {toc: 0, lua: 0, xml: 0}, rejectedLinks: 0, unrepresentableEntries: 0, excludedVcsDirectories: 0}};
  const composition = {groups, resolved: {complete: true, entries: [], activeGlobals: [], diagnostics: [], issues: []}, complete: false, issues: [], declarationOrigins: []};
  return {prepared, trace, composition, aggregate: () => buildSelectedSourceAggregate(prepared, trace, composition)};
}

test('all candidate selection outcomes partition explicit rows, including groups never reached after fatal failure', () => {
  const p = context(input => input.profile.addons = Array.from({length: 6}, (_, index) => ({...input.profile.addons[0], logicalAddonId: `authored/${index}`})));
  const fixture = unit(p), statuses = ['selected', 'no-match', 'unresolved', 'ambiguous', 'invalid'];
  fixture.composition.groups.forEach((row, index) => row.selection = index < statuses.length ? {status: statuses[index], issues: []} : null);
  const aggregate = fixture.aggregate();
  assert.deepEqual(aggregate.selection, {requestedGroups: 6, selected: 1, noMatch: 1, unresolved: 1, ambiguous: 1, invalid: 1, notInvoked: 1,
    explicitCandidateRows: 12, selectedCandidateRows: 1, nonSelectedCandidateRows: 3, undecidedCandidateRows: 8});
  fixture.trace.fatal = 'resource'; fixture.composition.groups.length = 2;
  assert.equal(fixture.aggregate().selection.notInvoked, 4); assert.equal(fixture.aggregate().status, 'failed'); partitions(aggregate);
});

test('unique no-verdict failures use approved priority while repeated failure events stay separate', () => {
  const fixture = unit(); fixture.trace.discovery.found.lua = 10;
  const priority = ['invariant', 'read', 'encoding', 'resource', 'worker', 'backend'];
  priority.forEach((kind, index) => {
    const file = observedFile('lua', priority.slice(index)); file.failureCounts[kind] = 3;
    fixture.trace.files.set(`private-${index}`, file);
  });
  fixture.trace.files.set('private-unattempted', observedFile());
  const accepted = observedFile(); accepted.fingerprint = 'private-hash'; accepted.verdict = true; accepted.integrity = {checked: 1, matching: 1, changed: 0, verificationFailures: 0};
  // A later known worker failure cannot erase a matching accepted source's verdict.
  accepted.failures.add('worker'); accepted.failureCounts.worker = 2; accepted.submitted = 2; accepted.completed = 1; accepted.failed = 1;
  fixture.trace.files.set('private-accepted', accepted);
  const result = fixture.aggregate(), row = result.languages.lua;
  assert.equal(row.eligibleSourceFiles, 8); assert.equal(row.notRequestedSourceFiles, 2); assert.equal(row.syntaxAcceptedFiles, 1);
  assert.deepEqual(row.skippedBeforeSyntaxVerdict, {notAttempted: 1, readRejected: 1, encodingRejected: 1, resourceRejected: 1, workerRejected: 1, backendRejected: 1, invariantRejected: 1});
  assert.equal(row.workerFailures, 5); assert.equal(row.invariantFailures, 3); partitions(result);
});

test('seven discovered files partition four eligible files without claiming partial discovery coverage', () => {
  const fixture = unit(); fixture.trace.discovery.found.lua = 7;
  const accepted = observedFile(); accepted.fingerprint = 'private'; accepted.verdict = true; accepted.integrity.matching = 1;
  fixture.trace.files.set('a', accepted); fixture.trace.files.set('b', observedFile('lua', ['read']));
  fixture.trace.files.set('c', observedFile('lua', ['worker'])); fixture.trace.files.set('d', observedFile());
  const complete = fixture.aggregate(); assert.equal(complete.languages.lua.eligibleSourceFiles, 4); assert.equal(complete.languages.lua.notRequestedSourceFiles, 3); partitions(complete);
  fixture.trace.discovery.complete = false; fixture.trace.discovery.found.lua = 2;
  const partial = fixture.aggregate(); assert.equal(partial.discovery.complete, false); assert.equal(partial.languages.lua.eligibleSourceFiles, 4);
  assert.equal(partial.languages.lua.notRequestedSourceFiles, 0); assert.equal(partial.completeUnderPolicy, false); partitions(partial);
});

test('histogram keys are explicitly allowlisted and exhausted budgets cannot emit an uncharged aggregate', () => {
  const fixture = unit(); fixture.trace.issues.push({code: 'private-path-or-message'});
  assert.throws(fixture.aggregate, /graph-accounting-invariant/);
  const limited = unit(context(input => input.profile.limits = {retainedRecords: 1}));
  assert.throws(limited.aggregate, error => error.code === 'SGRAPH0005');
  const fatal = unit(); fatal.trace.fatal = 'worker'; fatal.trace.issues.push({code: 'SGRAPH0007'});
  const result = fatal.aggregate(); assert.equal(result.status, 'failed'); assert.equal(result.completeUnderPolicy, false); assert.deepEqual(result.issuesByCode, {SGRAPH0007: 1});
});
