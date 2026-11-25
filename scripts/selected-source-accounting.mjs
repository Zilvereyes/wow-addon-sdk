/** Public selected-source counts. Private source identities never enter this projection. */
import assert from 'node:assert/strict';
import {getGraphRequest} from './selected-source-context.mjs';
import {requireGraphBudget} from './selected-source-budget.mjs';

const LANGUAGES = ['toc', 'lua', 'xml'];
const APIS = ['parseToc', 'parseXml', 'analyzeLua', 'analyzeXml', 'mapXmlValueRanges'];
const DIAGNOSTICS = new Set([
  'TOC0001', 'TOC0002', 'TOC0003', 'TOC0004', 'TOC0005', 'TOC0006',
  'LUA0001', 'LUA0002', 'LUA0003', 'LUA0004', 'LUA0005',
  'XML0001', 'XML0002', 'XML0003', 'XML0004', 'XML0005',
  'XUI0001', 'XUI0002', 'XUI0003', 'XUI0004', 'SV0001',
]);
const GUARD_CODES = new Set(['CONDEVAL0001', 'CONDEVAL0002', 'CONDEVAL0003', 'CONDEVAL0004', 'CONDEVAL0005', 'CONDEVAL0006']);
const RESOLUTION_CODES = new Set(['RESOLVE0001', 'RESOLVE0002', 'RESOLVE0003']);
const GRAPH_CODES = new Set(['SGRAPH0001', 'SGRAPH0002', 'SGRAPH0003', 'SGRAPH0004', 'SGRAPH0005', 'SGRAPH0006', 'SGRAPH0007', 'SGRAPH0008']);
const invariant = condition => assert.ok(condition, 'graph-accounting-invariant');
const integer = value => Number.isSafeInteger(value) && value >= 0;
const counts = () => ({toc: 0, lua: 0, xml: 0});
const languageCounts = () => ({
  eligibleSourceFiles: 0, notRequestedSourceFiles: 0, uniqueFilesRead: 0,
  syntaxVerdictFiles: 0, syntaxAcceptedFiles: 0, syntaxRejectedFiles: 0,
  skippedBeforeSyntaxVerdict: {notAttempted: 0, readRejected: 0, encodingRejected: 0, resourceRejected: 0,
    workerRejected: 0, backendRejected: 0, invariantRejected: 0},
  sourceRequestsSubmitted: 0, sourceRequestsCompleted: 0, sourceRequestsFailed: 0,
  failedRequestsWithUnknownStages: 0, reusedAnalyses: 0,
  readFailures: 0, workerFailures: 0, backendFailures: 0, invariantFailures: 0, resourceRejected: 0, encodingRejected: 0,
  analysisDiagnosticsByCode: {}, occurrenceDiagnosticsByCode: {},
  sourceIntegrity: {checked: 0, matching: 0, changed: 0, verificationFailures: 0},
});
export const createSelectedSourceCounts = () => ({
  schemaVersion: 1, status: 'incomplete', completeUnderPolicy: false, fullParsing: false, clientConformance: false,
  discovery: {complete: false, entriesVisited: 0, found: counts(), rejectedLinks: 0, unrepresentableEntries: 0, excludedVcsDirectories: 0},
  selection: {requestedGroups: 0, selected: 0, noMatch: 0, unresolved: 0, ambiguous: 0, invalid: 0, notInvoked: 0,
    explicitCandidateRows: 0, selectedCandidateRows: 0, nonSelectedCandidateRows: 0, undecidedCandidateRows: 0},
  languages: {toc: languageCounts(), lua: languageCounts(), xml: languageCounts()},
  confirmedApiCalls: {parseToc: {invoked: 0, returned: 0}, parseXml: {invoked: 0, returned: 0},
    analyzeLua: {invoked: 0, returned: 0}, analyzeXml: {invoked: 0, returned: 0}, mapXmlValueRanges: {invoked: 0, returned: 0}},
  graph: {sourceNodes: 0, analysisRecords: 0, occurrences: 0, referenceOccurrences: 0, resolvedReferences: 0,
    inactiveReferences: 0, blockedReferences: 0, unsupportedReferences: 0, missingReferences: 0,
    ambiguousReferences: 0, cyclicReferences: 0, activeGuards: 0, inactiveGuards: 0, unknownGuards: 0,
    expandedTokenReferences: 0, unsupportedVariables: 0, guardIssuesByCode: {}},
  inlineLua: {discoveredBodies: 0, attemptedBodies: 0, skippedMissingContext: 0, syntaxAccepted: 0, syntaxRejected: 0,
    resourceBlocked: 0, backendBlocked: 0, lexicalComplete: 0, lexicalIncomplete: 0,
    mappingValidated: 0, originalParts: 0, diagnosticsByCode: {}},
  resolution: {eligibleGroups: 0, blockedGroups: 0, coreComplete: false, complete: false, declarations: 0,
    activeGlobals: 0, availability: {active: 0, inactive: 0, unknown: 0}, issuesByCode: {}},
  issuesByCode: {},
});

const histogramCodes = new Map([
  ...LANGUAGES.flatMap(language => ['analysisDiagnosticsByCode', 'occurrenceDiagnosticsByCode']
    .map(field => [`languages.${language}.${field}`, DIAGNOSTICS])),
  ['graph.guardIssuesByCode', GUARD_CODES],
  ['inlineLua.diagnosticsByCode', DIAGNOSTICS],
  ['resolution.issuesByCode', RESOLUTION_CODES],
  ['issuesByCode', GRAPH_CODES],
]);
const countShape = createSelectedSourceCounts();

/** Revalidate stored tooling counts against the producer's shape and its fixed code sets. */
export function validSelectedSourceCounts(input) {
  function valid(value, expected, key) {
    const codes = histogramCodes.get(key);
    if (codes) return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.entries(value).every(([code, count]) => codes.has(code) && integer(count));
    if (expected === null || typeof expected !== 'object') {
      if (key === 'status') return ['passed', 'incomplete', 'failed'].includes(value);
      if (key === 'schemaVersion') return value === expected;
      return typeof expected === 'boolean' ? typeof value === 'boolean' : integer(value);
    }
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === Object.keys(expected).length &&
      Object.keys(expected).every(cell => Object.hasOwn(value, cell) && valid(value[cell], expected[cell], key ? `${key}.${cell}` : cell));
  }
  return valid(input, countShape, '');
}

// File-owned XML diagnostics include its provider/inline/map calls once. Inline occurrences
// do not count those calls a second time; a repeated file occurrence does repeat its diagnostics.
function visitDiagnostics(analysis, visit) {
  if (analysis.language === 'toc') {for (const row of analysis.parsed.diagnostics) visit(row); return;}
  if (analysis.language === 'lua') {for (const row of analysis.result.diagnostics) visit(row); return;}
  invariant(analysis.language === 'xml');
  for (const row of analysis.syntax.diagnostics) visit(row);
  if (analysis.provider) for (const row of analysis.provider.diagnostics) visit(row);
  for (const body of analysis.inline) {
    if (body.analysis) for (const row of body.analysis.diagnostics) visit(row);
    if (body.mapping) for (const row of body.mapping.diagnostics) visit(row);
  }
}

/** Accepts only the engine's private validated trace and the actual resolver composition.
 * Failed receipts confirm calls, never syntax. Late source changes withdraw semantic credit.
 * Exhausted budgets throw; no fabricated successful core result or uncharged fallback exists.
 */
export function buildSelectedSourceAggregate(context, trace, composition) {
  const request = getGraphRequest(context), budget = requireGraphBudget(trace.budget, context);
  budget.check();
  // Reserve the complete fixed wire shape before retaining any aggregate output.
  const aggregate = budget.copy(createSelectedSourceCounts()), {selection, graph, inlineLua, resolution} = aggregate;
  let diagnosticCount = 0;
  const add = (target, key, value = 1) => {
    budget.check(); invariant(integer(value) && Object.hasOwn(target, key) && integer(target[key]) && Number.isSafeInteger(target[key] + value));
    target[key] += value;
  };
  const histogram = (target, code, allowed) => {
    budget.check(); invariant(allowed.has(code));
    if (!Object.hasOwn(target, code)) {budget.retain(0, code.length); target[code] = 0;}
    add(target, code);
  };
  const diagnostics = (target, analysis) => visitDiagnostics(analysis, row => {
    histogram(target, row.code, DIAGNOSTICS); diagnosticCount++;
  });
  const matching = file => file?.valid === true && file.fingerprint !== null && file.integrity.matching > 0 &&
    file.integrity.changed === 0 && file.integrity.verificationFailures === 0;
  const calls = receipt => {
    for (const name of APIS) {
      invariant(receipt && Object.hasOwn(receipt, name));
      const row = receipt[name]; invariant(integer(row.invoked) && integer(row.returned) && row.returned <= row.invoked);
      add(aggregate.confirmedApiCalls[name], 'invoked', row.invoked); add(aggregate.confirmedApiCalls[name], 'returned', row.returned);
    }
  };

  aggregate.discovery.complete = trace.discovery.complete === true;
  for (const key of ['entriesVisited', 'rejectedLinks', 'unrepresentableEntries', 'excludedVcsDirectories']) add(aggregate.discovery, key, trace.discovery[key]);
  for (const language of LANGUAGES) add(aggregate.discovery.found, language, trace.discovery.found[language]);
  selection.requestedGroups = request.profile.addons.length;
  invariant(composition.groups.length <= selection.requestedGroups);
  for (let index = 0; index < selection.requestedGroups; index++) {
    budget.check(); const input = request.profile.addons[index], group = composition.groups[index];
    invariant(!group || group.logicalAddonId === input.logicalAddonId);
    const count = input.tocPaths.length, status = group?.selection?.status ?? null;
    add(selection, 'explicitCandidateRows', count);
    if (status === 'selected') {
      invariant(count > 0); add(selection, 'selected'); add(selection, 'selectedCandidateRows'); add(selection, 'nonSelectedCandidateRows', count - 1);
    } else if (status === 'no-match') {
      add(selection, 'noMatch'); add(selection, 'nonSelectedCandidateRows', count);
    } else {
      const key = status === null ? 'notInvoked' : status;
      invariant(['notInvoked', 'unresolved', 'ambiguous', 'invalid'].includes(key));
      add(selection, key); add(selection, 'undecidedCandidateRows', count);
    }
    add(resolution, group?.resolutionEligible === true ? 'eligibleGroups' : 'blockedGroups');
  }
  for (const file of trace.files.values()) {
    budget.check(); invariant(LANGUAGES.includes(file.language)); const target = aggregate.languages[file.language];
    add(target, 'eligibleSourceFiles'); if (file.fingerprint !== null) add(target, 'uniqueFilesRead');
    for (const [field, source] of [['sourceRequestsSubmitted', 'submitted'], ['sourceRequestsCompleted', 'completed'],
      ['sourceRequestsFailed', 'failed'], ['failedRequestsWithUnknownStages', 'unknownStages'], ['reusedAnalyses', 'reuses']]) add(target, field, file[source]);
    invariant(file.completed + file.failed <= file.submitted && file.unknownStages <= file.failed);
    for (const [field, kind] of [['readFailures', 'read'], ['workerFailures', 'worker'], ['backendFailures', 'backend'],
      ['invariantFailures', 'invariant'], ['resourceRejected', 'resource'], ['encodingRejected', 'encoding']]) add(target, field, file.failureCounts[kind]);
    for (const key of ['checked', 'matching', 'changed', 'verificationFailures']) add(target.sourceIntegrity, key, file.integrity[key]);
    if (matching(file) && file.verdict !== null) {
      invariant(typeof file.verdict === 'boolean'); add(target, 'syntaxVerdictFiles');
      add(target, file.verdict ? 'syntaxAcceptedFiles' : 'syntaxRejectedFiles');
    } else {
      // A valid failed analysis may still confirm direct calls, but cannot supply a verdict.
      const kind = ['invariant', 'read', 'encoding', 'resource', 'worker', 'backend'].find(value => file.failures.has(value));
      const key = kind ? `${kind}Rejected` : file.valid === false || file.integrity.verificationFailures || file.integrity.changed ? 'readRejected' : 'notAttempted';
      add(target.skippedBeforeSyntaxVerdict, key);
    }
    if (matching(file)) for (const receipt of file.failedCalls) calls(receipt);
  }
  for (const language of LANGUAGES) {
    const target = aggregate.languages[language], found = aggregate.discovery.found[language];
    // Partial discovery never fabricates an exact inventory equation.
    target.notRequestedSourceFiles = Math.max(0, found - target.eligibleSourceFiles);
    invariant(target.syntaxVerdictFiles === target.syntaxAcceptedFiles + target.syntaxRejectedFiles);
    invariant(target.eligibleSourceFiles === target.syntaxVerdictFiles + Object.values(target.skippedBeforeSyntaxVerdict).reduce((sum, value) => sum + value, 0));
    if (aggregate.discovery.complete) invariant(found === target.eligibleSourceFiles + target.notRequestedSourceFiles);
  }
  for (const analysis of trace.analyses) {
    budget.check(); const file = trace.files.get(analysis.sourcePath); if (!matching(file)) continue;
    invariant(analysis.result.language === file.language); calls(analysis.confirmedApiCalls);
    diagnostics(aggregate.languages[file.language].analysisDiagnosticsByCode, analysis.result);
    if (analysis.result.language !== 'xml') continue;
    for (const body of analysis.result.inline) {
      budget.check(); add(inlineLua, 'discoveredBodies');
      if (body.status === 'missing-context') {add(inlineLua, 'skippedMissingContext'); continue;}
      invariant(body.status === 'analyzed' && body.analysis !== null); add(inlineLua, 'attemptedBodies');
      let rejected = false, resource = false, backend = false, lexical = false;
      for (const diagnostic of body.analysis.diagnostics) {
        histogram(inlineLua.diagnosticsByCode, diagnostic.code, DIAGNOSTICS);
        rejected ||= diagnostic.code === 'LUA0002'; resource ||= diagnostic.code === 'LUA0003'; backend ||= diagnostic.code === 'LUA0005'; lexical ||= diagnostic.code === 'LUA0004';
      }
      const disposition = resource ? 'resourceBlocked' : backend ? 'backendBlocked' : rejected ? 'syntaxRejected' : 'syntaxAccepted';
      add(inlineLua, disposition);
      if (disposition === 'syntaxAccepted') add(inlineLua, lexical ? 'lexicalIncomplete' : 'lexicalComplete');
      if (body.mapping?.complete === true) {
        add(inlineLua, 'mappingValidated'); for (const mapping of body.mapping.mappings) add(inlineLua, 'originalParts', mapping.parts.length);
      }
      if (body.mapping) for (const diagnostic of body.mapping.diagnostics) histogram(inlineLua.diagnosticsByCode, diagnostic.code, DIAGNOSTICS);
    }
  }
  for (const occurrence of trace.occurrences) {
    budget.check(); if (occurrence.kind !== 'file' || occurrence.analysisId === null || !matching(trace.files.get(occurrence.sourcePath))) continue;
    const analysis = trace.analyses[occurrence.analysisId]; invariant(analysis && analysis.analysisId === occurrence.analysisId && analysis.sourcePath === occurrence.sourcePath);
    diagnostics(aggregate.languages[analysis.result.language].occurrenceDiagnosticsByCode, analysis.result);
  }
  graph.sourceNodes = trace.nodes.length; graph.analysisRecords = trace.analyses.length; graph.occurrences = trace.occurrences.length;
  graph.referenceOccurrences = trace.references.length;
  for (const reference of trace.references) {
    budget.check();
    const key = {resolved: 'resolvedReferences', inactive: 'inactiveReferences', blocked: 'blockedReferences', unsupported: 'unsupportedReferences',
      missing: 'missingReferences', ambiguous: 'ambiguousReferences', cycle: 'cyclicReferences'}[reference.status];
    invariant(key); add(graph, key); invariant(['active', 'inactive', 'unknown'].includes(reference.guard)); add(graph, `${reference.guard}Guards`);
    if (reference.expandedTarget !== null && reference.expandedTarget !== reference.targetValue) add(graph, 'expandedTokenReferences');
    if (reference.status === 'unsupported' && reference.expandedTarget === null) add(graph, 'unsupportedVariables');
  }
  invariant(trace.guardEvaluations.length === trace.references.length);
  for (let index = 0; index < trace.guardEvaluations.length; index++) {
    const row = trace.guardEvaluations[index], reference = trace.references[index];
    invariant(row.referenceId === reference.referenceId && row.evaluation.availability === reference.guard);
    for (const issue of row.evaluation.issues) histogram(graph.guardIssuesByCode, issue.code, GUARD_CODES);
  }
  resolution.coreComplete = composition.resolved.complete === true;
  resolution.activeGlobals = composition.resolved.activeGlobals.length;
  for (const entry of composition.resolved.entries) for (const row of entry.declarations) {
    budget.check(); add(resolution, 'declarations'); invariant(['active', 'inactive', 'unknown'].includes(row.evaluation.availability));
    add(resolution.availability, row.evaluation.availability);
  }
  for (const issue of composition.resolved.issues) histogram(resolution.issuesByCode, issue.code, RESOLUTION_CODES);
  for (const diagnostic of composition.resolved.diagnostics) {budget.check(); invariant(DIAGNOSTICS.has(diagnostic.code)); diagnosticCount++;}
  for (const issue of trace.issues) histogram(aggregate.issuesByCode, issue.code, GRAPH_CODES);
  for (const issue of composition.issues) histogram(aggregate.issuesByCode, issue.code, GRAPH_CODES);
  invariant(selection.requestedGroups === selection.selected + selection.noMatch + selection.unresolved + selection.ambiguous + selection.invalid + selection.notInvoked);
  invariant(selection.explicitCandidateRows === selection.selectedCandidateRows + selection.nonSelectedCandidateRows + selection.undecidedCandidateRows);
  invariant(graph.referenceOccurrences === graph.resolvedReferences + graph.inactiveReferences + graph.blockedReferences + graph.unsupportedReferences +
    graph.missingReferences + graph.ambiguousReferences + graph.cyclicReferences);
  invariant(graph.referenceOccurrences === graph.activeGuards + graph.inactiveGuards + graph.unknownGuards);
  invariant(inlineLua.discoveredBodies === inlineLua.attemptedBodies + inlineLua.skippedMissingContext);
  invariant(inlineLua.attemptedBodies === inlineLua.syntaxAccepted + inlineLua.syntaxRejected + inlineLua.resourceBlocked + inlineLua.backendBlocked);
  invariant(inlineLua.syntaxAccepted === inlineLua.lexicalComplete + inlineLua.lexicalIncomplete);
  invariant(resolution.declarations === resolution.availability.active + resolution.availability.inactive + resolution.availability.unknown);
  resolution.complete = trace.fatal === null && aggregate.discovery.complete && composition.complete === true && resolution.coreComplete && selection.selected > 0 &&
    resolution.blockedGroups === 0 && graph.unknownGuards === 0 && inlineLua.skippedMissingContext === 0 && inlineLua.lexicalIncomplete === 0;
  aggregate.completeUnderPolicy = resolution.complete;
  const fileFailures = LANGUAGES.some(language => {
    const row = aggregate.languages[language];
    return row.readFailures + row.workerFailures + row.backendFailures + row.invariantFailures + row.resourceRejected + row.encodingRejected > 0;
  });
  const faults = trace.fatal !== null || fileFailures || Object.keys(aggregate.issuesByCode).some(code => code !== 'SGRAPH0008') ||
    Object.keys(resolution.issuesByCode).length > 0 || diagnosticCount > 0;
  aggregate.status = faults ? 'failed' : aggregate.completeUnderPolicy ? 'passed' : 'incomplete';
  budget.check(); return aggregate;
}
