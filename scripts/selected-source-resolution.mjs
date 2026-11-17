/** Private graph-to-registry composition. Publication never changes an SDK result. */
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {resolveGlobalRegistry, toGlobalDeclarations, evaluateGlobalConditions} from '@wow-addon/toc-metadata-adapter';
import {getGraphRequest} from './selected-source-context.mjs';
import {requireGraphBudget} from './selected-source-budget.mjs';

const TOC_PROVIDER = '@wow-addon/toc-metadata-adapter';
const same = (actual, expected) => assert.ok(isDeepStrictEqual(actual, expected), 'graph-resolution-invariant');

/** Match by input ordinal and guaranteed first-seen entry order, then validate the entire cell.
 * Identical declarations deliberately consume distinct declaration ordinals.
 */
function mapOrigins(request, resolved, rows, budget) {
  budget.retain(1, 0);
  const entries = new Map();
  for (const row of rows) {
    budget.check();
    let entry = entries.get(row.origin.declaration.name);
    if (!entry) {budget.retain(2, row.origin.declaration.name.length); entry = {index: entries.size, count: 0}; entries.set(row.origin.declaration.name, entry);}
    const declarationIndex = entry.count++, declaration = {...row.origin.declaration, addonId: row.logicalAddonId};
    const expected = {logicalAddonId: row.logicalAddonId, tocVariantId: row.tocVariantId, providerId: row.providerId,
      originalAddonId: row.origin.declaration.addonId, declaration,
      evaluation: evaluateGlobalConditions(declaration, request.environment, request.conditionPolicy)};
    same(resolved.entries[entry.index]?.name, declaration.name);
    same(resolved.entries[entry.index]?.declarations[declarationIndex], expected);
    row.origin.resolvedEntryIndex = entry.index; row.origin.resolvedDeclarationIndex = declarationIndex;
  }
  same(resolved.entries.length, entries.size);
  for (const entry of entries.values()) same(resolved.entries[entry.index].declarations.length, entry.count);
}

export function composeGraphResolution(context, trace) {
  const request = getGraphRequest(context), budget = requireGraphBudget(trace.budget, context);
  budget.check();
  const groups = budget.copy(trace.groups.map(group => ({logicalAddonId: group.logicalAddonId, selection: group.selection,
    graphComplete: group.graphComplete, analysisComplete: group.analysisComplete, resolutionEligible: group.resolutionEligible}))),
    issues = budget.copy([]), inputs = [], declarationOrigins = budget.copy([]), published = [];
  budget.retain(3, 0); const owners = new Map();
  for (const owner of trace.occurrences) {
    budget.check(); assert.ok(!owners.has(owner.occurrenceId), 'graph-resolution-invariant');
    budget.retain(1, 0); owners.set(owner.occurrenceId, owner);
  }
  for (const origin of trace.originInputs) {budget.check(); assert.ok(owners.has(origin.occurrenceId), 'graph-resolution-invariant');}
  for (let index = 0; index < trace.groups.length; index++) {
    budget.check();
    const group = trace.groups[index], status = groups[index], before = budget.metrics();
    try {
      same(group.index, index); same(group.logicalAddonId, request.profile.addons[index]?.logicalAddonId);
      if (!group.selection || !['selected', 'no-match'].includes(group.selection.status)) {status.resolutionEligible = false; continue;}
      const profile = request.profile.addons[index];
      const input = budget.copy({logicalAddonId: profile.logicalAddonId, addonBaseName: profile.addonBaseName,
        candidates: group.candidates.map(({loaded}) => {
          assert.ok(loaded, 'graph-resolution-invariant');
          const sourcePath = loaded.sourcePath;
          return {identity: {logicalAddonId: profile.logicalAddonId, tocVariantId: JSON.stringify([profile.logicalAddonId, sourcePath]),
            tocPath: sourcePath, tocSuffix: loaded.parsed.metadata.tocSuffix,
            source: {file: sourcePath, range: {start: {line: 0, column: 0}, end: {line: 0, column: 0}}}}, metadata: loaded.parsed.metadata};
        }), selectionPolicy: request.selectionPolicy, providers: trace.providerBatches.get(index) ?? []});
      const variant = group.selection.status === 'selected' ? group.selection.selectedVariantId : null;
      for (const provider of input.providers) {budget.check(); same(provider.tocVariantId, variant); assert.ok(provider.declarations.length > 0, 'graph-resolution-invariant');}
      const selected = variant === null ? null : input.candidates.find(candidate => candidate.identity.tocVariantId === variant);
      const roots = trace.occurrences.filter(owner => owner.logicalAddonId === group.logicalAddonId && owner.parentOccurrenceId === null);
      budget.retain(4, 0); const originRows = [], rows = [], xmlCursors = new Map(), luaOwners = new Map();
      const append = (origin, providerId) => {
        const owned = budget.copy(origin); originRows.push(owned);
        budget.retain(1, group.logicalAddonId.length + variant.length + providerId.length);
        rows.push({origin: owned, logicalAddonId: group.logicalAddonId, tocVariantId: variant, providerId});
      };
      if (selected && roots.length) {
        same(roots.length, 1); same(roots[0].tocVariantId, variant); same(roots[0].sourcePath, selected.identity.tocPath);
        const declarations = toGlobalDeclarations([selected.metadata]); let ordinal = 0;
        selected.metadata.savedVariableDeclarations.forEach((saved, tocDeclarationIndex) => {
          budget.check(); if (!saved.validIdentifier) return;
          append({occurrenceId: roots[0].occurrenceId, declaration: declarations[ordinal++], origin: 'selected-toc', tocDeclarationIndex,
            providerBatchIndex: null, providerDeclarationIndex: null, mapping: null, resolvedEntryIndex: null, resolvedDeclarationIndex: null}, TOC_PROVIDER);
        });
        same(ordinal, declarations.length);
      } else if (status.resolutionEligible && variant !== null) assert.fail('graph-resolution-invariant');
      const providerOrigins = trace.originInputs.filter(origin => owners.get(origin.occurrenceId)?.logicalAddonId === group.logicalAddonId);
      let ordinal = 0;
      let batchOwner = null;
      input.providers.forEach((provider, providerBatchIndex) => provider.declarations.forEach((declaration, providerDeclarationIndex) => {
        budget.check(); const origin = providerOrigins[ordinal++], owner = owners.get(origin?.occurrenceId);
        assert.ok(origin && owner, 'graph-resolution-invariant');
        if (providerDeclarationIndex === 0) batchOwner = owner.occurrenceId;
        else same(owner.occurrenceId, batchOwner);
        same(owner.tocVariantId, variant); same(origin.origin, 'provider'); same(origin.tocDeclarationIndex, null);
        same(origin.providerBatchIndex, providerBatchIndex); same(origin.providerDeclarationIndex, providerDeclarationIndex);
        same(origin.resolvedEntryIndex, null); same(origin.resolvedDeclarationIndex, null); same(origin.declaration, declaration);
        const analysis = trace.analyses[owner.analysisId];
        same(analysis?.analysisId, owner.analysisId); same(analysis?.sourcePath, owner.sourcePath);
        if (owner.kind === 'inline-chunk' || owner.kind === 'inline-handler') {
          same(provider.providerId, '@wow-addon/lua-analysis');
          const inline = analysis.result.inline.find(value => value.elementIndex === owner.inlineElementIndex);
          assert.ok(inline?.analysis && inline.mapping, 'graph-resolution-invariant');
          same(provider.declarations.length, inline.analysis.declarations.length);
          same(declaration, inline.analysis.declarations[providerDeclarationIndex]);
          same(origin.mapping, {...inline.mapping, mappings: [inline.mapping.mappings[providerDeclarationIndex]]});
        } else {
          same(origin.mapping, null);
          same(provider.providerId, analysis.result.language === 'lua' ? '@wow-addon/lua-analysis' : '@wow-addon/xml-analysis');
          if (analysis.result.language === 'lua') {
            same(provider.declarations.length, analysis.result.result.declarations.length);
            same(declaration, analysis.result.result.declarations[providerDeclarationIndex]);
          }
          else {
            // XML emits one batch per declared frame in preorder. Bind that
            // ordinal to the validated analysis, never just batch/sidecar equality.
            same(analysis.result.language, 'xml'); same(providerDeclarationIndex, 0); same(provider.declarations.length, 1);
            const frames = analysis.result.provider.frames;
            let cursor = xmlCursors.get(owner.occurrenceId) ?? 0;
            while (cursor < frames.length && frames[cursor].declarationIndex === null) {budget.check(); cursor++;}
            assert.ok(cursor < frames.length, 'graph-resolution-invariant');
            same(declaration, analysis.result.provider.declarations[frames[cursor].declarationIndex]);
            if (!xmlCursors.has(owner.occurrenceId)) budget.retain(1, 0);
            xmlCursors.set(owner.occurrenceId, cursor + 1);
          }
        }
        if (provider.providerId === '@wow-addon/lua-analysis' && providerDeclarationIndex === 0) {
          same(luaOwners.has(owner.occurrenceId), false); budget.retain(1, 0); luaOwners.set(owner.occurrenceId, true);
        }
        append(origin, provider.providerId);
      }));
      same(providerOrigins.length, ordinal);
      if (status.resolutionEligible) {
        for (const owner of trace.occurrences) {
          budget.check(); if (owner.logicalAddonId !== group.logicalAddonId) continue;
          const analysis = trace.analyses[owner.analysisId];
          if (owner.kind === 'inline-chunk' || owner.kind === 'inline-handler') {
            const inline = analysis?.result.inline.find(row => row.elementIndex === owner.inlineElementIndex);
            same(luaOwners.has(owner.occurrenceId), (inline?.analysis?.declarations.length ?? 0) > 0); continue;
          }
          if (analysis?.result.language === 'lua') {
            same(luaOwners.has(owner.occurrenceId), analysis.result.result.declarations.length > 0); continue;
          }
          if (analysis?.result.language !== 'xml' || !analysis.result.provider) continue;
          const frames = analysis.result.provider.frames;
          for (let cursor = xmlCursors.get(owner.occurrenceId) ?? 0; cursor < frames.length; cursor++) {
            budget.check(); same(frames[cursor].declarationIndex, null);
          }
        }
        // The independent SDK probe prevents an invalid group from publishing a prefix.
        const probe = resolveGlobalRegistry(request.environment, [input], request.conditionPolicy); budget.check();
        same(probe.addons.length, 1); same(probe.addons[0].selection, group.selection); same(probe.issues, []);
        mapOrigins(request, probe, rows, budget);
        inputs.push(input); for (const row of rows) {budget.check(); published.push(row);}
      }
      for (const origin of originRows) {budget.check(); declarationOrigins.push(origin);}
    } catch (error) {
      const after = budget.metrics();
      budget.release('retainedRecords', after.retainedRecords - before.retainedRecords);
      budget.release('retainedStringUnits', after.retainedStringUnits - before.retainedStringUnits);
      if (error?.code === 'SGRAPH0005') throw error;
      status.graphComplete = false; status.analysisComplete = false; status.resolutionEligible = false;
      issues.push(budget.copy({code: 'SGRAPH0007', logicalAddonId: group.logicalAddonId, sources: []}));
    }
  }
  const resolved = budget.copy(resolveGlobalRegistry(request.environment, inputs, request.conditionPolicy));
  mapOrigins(request, resolved, published, budget); budget.check();
  return {resolved, declarationOrigins, groups, issues,
    complete: resolved.complete && groups.length === request.profile.addons.length && groups.some(group => group.selection?.status === 'selected') &&
      groups.every(group => group.graphComplete && group.analysisComplete && group.resolutionEligible)};
}
