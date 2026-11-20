/** Private tooling entry point. Only aggregate may be serialized by the CLI. */
import {prepareGraphContext} from './selected-source-context.mjs';
import {traceSelectedSources} from './selected-source-engine.mjs';
import {composeGraphResolution} from './selected-source-resolution.mjs';
import {buildSelectedSourceAggregate} from './selected-source-accounting.mjs';

async function analyzeGraph(request, host, keepXmlSyntax) {
  let context;
  try {context = prepareGraphContext(request);}
  catch (error) {await host.close(); throw error;}
  // trace always closes/reaps the host before resolver publication. If no quota
  // remains for a complete owned result, reject rather than publish a prefix.
  let phase = 'traceGraph';
  try {
    const trace = await traceSelectedSources(context, host, {keepXmlSyntax});
    phase = 'composeResolution';
    const composition = composeGraphResolution(context, trace);
    phase = 'buildAggregate';
    const aggregate = buildSelectedSourceAggregate(context, trace, composition);
    return {trace, composition, aggregate};
  } catch (error) {
    throw Object.assign(Error('Selected-source graph analysis failed.', {cause: error}), {phase, code: error?.code});
  }
}

export async function analyzeSelectedSourceAggregate(request, host) {
  const {trace, aggregate} = await analyzeGraph(request, host, false);
  trace.budget.check();
  return aggregate;
}

export async function analyzeSelectedSources(request, host) {
  const {trace, composition, aggregate} = await analyzeGraph(request, host, true);
  const {budget} = trace;
  const diagnostics = [];
  budget.retain(3 + trace.issues.length + composition.issues.length, 0);
  const append = rows => {
    budget.retain(rows.length, 0);
    for (const row of rows) {budget.check(); diagnostics.push(row);}
  };
  for (const row of trace.analyses) {
    budget.check(); const result = row.result;
    if (result.language === 'toc') append(result.parsed.diagnostics);
    else if (result.language === 'lua') append(result.result.diagnostics);
    else {
      append(result.syntax.diagnostics);
      if (result.provider) append(result.provider.diagnostics);
      for (const inline of result.inline) {
        if (inline.analysis) append(inline.analysis.diagnostics);
        if (inline.mapping) append(inline.mapping.diagnostics);
      }
    }
  }
  append(composition.resolved.diagnostics);
  budget.check();
  return {schemaVersion: 1, completeUnderPolicy: aggregate.completeUnderPolicy,
    groups: composition.groups, nodes: trace.nodes, analyses: trace.analyses,
    guardEvaluations: trace.guardEvaluations, references: trace.references, occurrences: trace.occurrences,
    declarationOrigins: composition.declarationOrigins, diagnostics, issues: [...trace.issues, ...composition.issues],
    resolved: composition.resolved, aggregate};
}
