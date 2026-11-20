/** Fixed labels used in corpus reports. Never serialize exception text. */
const attributeCodes = new Set([
  'graph-attributes-timeout', 'graph-attributes-protocol', 'graph-attributes-exit',
  'graph-attributes-start', 'graph-attributes-write', 'graph-attributes-reap',
  'graph-attributes-input', 'graph-attributes-output-limit', 'graph-attributes-closed',
  'graph-attributes-busy', 'graph-attributes-runtime', 'graph-attributes-unavailable',
]);
const analysisCodes = new Set([
  'graph-analysis-timeout', 'graph-analysis-protocol', 'graph-analysis-exit',
  'graph-analysis-start', 'graph-analysis-write', 'graph-analysis-reap',
  'graph-analysis-input', 'graph-analysis-output-limit', 'graph-analysis-closed',
  'graph-analysis-busy', 'graph-analysis-resource', 'graph-analysis-backend', 'graph-analysis-invariant',
]);
const nativePhases = new Set(['listDirectory', 'readSource', 'verifyDirectory', 'verifySource']);
const graphPhases = new Set(['traceGraph', 'composeResolution', 'buildAggregate']);
const groupCodes = new Set(['SGRAPH0005', 'SGRAPH0007', 'ERR_ASSERTION', 'grouped-receipt',
  'grouped-fingerprint', 'grouped-source-changed', 'grouped-integrity', 'graph-native-budget', 'unknown']);

export function attributeSubcode(error) {
  return attributeCodes.has(error?.subcode) ? error.subcode :
    attributeCodes.has(error?.message) ? error.message : 'graph-attributes-unavailable';
}

export function analysisSubcode(error) {
  return analysisCodes.has(error?.message) ? error.message : 'unknown';
}

export function groupFailureSubcode(error) {
  if (graphPhases.has(error?.phase)) error = error.cause;
  if (error?.code === 'graph-native-attributes' || attributeCodes.has(error?.message)) return attributeSubcode(error);
  const analysis = analysisSubcode(error);
  if (analysis !== 'unknown') return analysis;
  return groupCodes.has(error?.code) ? error.code : 'unknown';
}

export function graphFailurePhase(error, fallback) {
  return graphPhases.has(error?.phase) ? error.phase : fallback;
}

export function isCorpusFailureCode(phase, subcode) {
  if (nativePhases.has(phase)) return attributeCodes.has(subcode);
  if (phase === 'analyzeSource') return analysisCodes.has(subcode) || subcode === 'unknown';
  if (phase === 'closeHost') return attributeCodes.has(subcode) || analysisCodes.has(subcode) || subcode === 'unknown';
  return false;
}

export function countFailure(tally, phase, subcode) {
  const counts = tally[phase] ??= {};
  counts[subcode] = (counts[subcode] ?? 0) + 1;
}
