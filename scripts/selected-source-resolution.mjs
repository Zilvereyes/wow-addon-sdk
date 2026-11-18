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
  let records = 1, stringUnits = 0;
  try {
    const lastByName = new Map();
    for (const row of rows) {
      budget.check();
      const origin = row.origin, name = origin.declaration.name;
      const previous = lastByName.get(name);
      const entryIndex = previous ? previous.resolvedEntryIndex : lastByName.size;
      const declarationIndex = previous ? previous.resolvedDeclarationIndex + 1 : 0;
      if (!previous) {
        budget.retain(1, name.length);
        records++; stringUnits += name.length;
      }
      const declaration = {...origin.declaration, addonId: row.logicalAddonId};
      const expected = {logicalAddonId: row.logicalAddonId, tocVariantId: row.tocVariantId, providerId: row.providerId,
        originalAddonId: origin.declaration.addonId, declaration,
        evaluation: evaluateGlobalConditions(declaration, request.environment, request.conditionPolicy)};
      same(resolved.entries[entryIndex]?.name, declaration.name);
      same(resolved.entries[entryIndex]?.declarations[declarationIndex], expected);
      origin.resolvedEntryIndex = entryIndex; origin.resolvedDeclarationIndex = declarationIndex;
      // Origins are already owned. The last validated occurrence carries both ordinals.
      lastByName.set(name, origin);
    }
    same(resolved.entries.length, lastByName.size);
    for (const origin of lastByName.values()) same(resolved.entries[origin.resolvedEntryIndex].declarations.length, origin.resolvedDeclarationIndex + 1);
  } finally {
    // The origin rows retain ordinal values only. Each lookup ends at this boundary.
    budget.release('retainedRecords', records);
    budget.release('retainedStringUnits', stringUnits);
  }
}

export function composeGraphResolution(context, trace) {
  const request = getGraphRequest(context), budget = requireGraphBudget(trace.budget, context);
  budget.check();
  const groups = budget.copy(trace.groups.map(group => ({logicalAddonId: group.logicalAddonId, selection: group.selection,
    graphComplete: group.graphComplete, analysisComplete: group.analysisComplete, resolutionEligible: group.resolutionEligible}))),
    issues = budget.copy([]), inputs = [], declarationOrigins = budget.copy([]), published = [];
  budget.retain(3, 0); const owners = new Map();
  let resolverInputRecords = 1, resolverInputUnits = 0, core;
  try {
    for (const owner of trace.occurrences) {
      budget.check(); assert.ok(!owners.has(owner.occurrenceId), 'graph-resolution-invariant');
      budget.retain(1, 0); owners.set(owner.occurrenceId, owner);
    }
    for (let index = 0; index < trace.groups.length; index++) {
      budget.check();
      const group = trace.groups[index], status = groups[index], before = budget.metrics();
      try {
        same(group.index, index); same(group.logicalAddonId, request.profile.addons[index]?.logicalAddonId);
        if (!group.selection || !['selected', 'no-match'].includes(group.selection.status)) {status.resolutionEligible = false; continue;}
        const profile = request.profile.addons[index];
        let inputRecords = 0, inputUnits = 0;
        const copyInput = value => budget.copy(value, undefined, (_owned, records, units) => {
          inputRecords += records; inputUnits += units;
        });
        const input = copyInput({logicalAddonId: profile.logicalAddonId, addonBaseName: profile.addonBaseName,
          candidates: group.candidates.map(({loaded}) => {
            assert.ok(loaded, 'graph-resolution-invariant');
            const sourcePath = loaded.sourcePath;
            return {identity: {logicalAddonId: profile.logicalAddonId, tocVariantId: JSON.stringify([profile.logicalAddonId, sourcePath]),
              tocPath: sourcePath, tocSuffix: loaded.parsed.metadata.tocSuffix,
              source: {file: sourcePath, range: {start: {line: 0, column: 0}, end: {line: 0, column: 0}}}}, metadata: loaded.parsed.metadata};
          }), selectionPolicy: request.selectionPolicy, providers: []});
        const variant = group.selection.status === 'selected' ? group.selection.selectedVariantId : null;
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
        const batches = trace.providerBatches.get(index) ?? [];
        for (let providerBatchIndex = 0; providerBatchIndex < batches.length; providerBatchIndex++) {
          budget.check();
          const batch = batches[providerBatchIndex], owner = owners.get(batch?.occurrenceId);
          assert.ok(owner, 'graph-resolution-invariant');
          same(batch.providerBatchIndex, providerBatchIndex);
          same(owner.logicalAddonId, group.logicalAddonId);
          same(owner.tocVariantId, variant); same(batch.tocVariantId, variant);
          same(batch.analysisId, owner.analysisId); same(batch.inlineElementIndex, owner.inlineElementIndex);
          assert.ok(variant !== null && Number.isSafeInteger(owner.analysisId), 'graph-resolution-invariant');
          const analysis = trace.analyses[owner.analysisId];
          same(analysis?.analysisId, owner.analysisId); same(analysis?.sourcePath, owner.sourcePath);
          let declarations, mapping = null;
          if (owner.kind === 'inline-chunk' || owner.kind === 'inline-handler') {
            same(analysis.result.language, 'xml'); same(batch.frameIndex, null);
            const inline = analysis.result.inline.find(value => value.elementIndex === owner.inlineElementIndex);
            assert.ok(inline?.analysis && inline.mapping, 'graph-resolution-invariant');
            same(owner.kind, 'inline-' + inline.kind);
            declarations = inline.analysis.declarations;
            mapping = inline.mapping;
            same(mapping.mappings.length, declarations.length);
          } else if (analysis.result.language === 'lua') {
            same(owner.kind, 'file'); same(batch.frameIndex, null);
            declarations = analysis.result.result.declarations;
          } else {
            same(owner.kind, 'file'); same(analysis.result.language, 'xml');
            const frames = analysis.result.provider.frames;
            let cursor = xmlCursors.get(owner.occurrenceId) ?? 0;
            while (cursor < frames.length && frames[cursor].declarationIndex === null) {budget.check(); cursor++;}
            assert.ok(cursor < frames.length, 'graph-resolution-invariant');
            same(batch.frameIndex, cursor);
            const declaration = analysis.result.provider.declarations[frames[cursor].declarationIndex];
            assert.ok(declaration, 'graph-resolution-invariant');
            budget.retain(2, 0); inputRecords += 2; // A single-element input array and its reference.
            declarations = [declaration];
            if (!xmlCursors.has(owner.occurrenceId)) budget.retain(1, 0);
            xmlCursors.set(owner.occurrenceId, cursor + 1);
          }
          const providerId = batch.frameIndex === null ? '@wow-addon/lua-analysis' : '@wow-addon/xml-analysis';
          same(batch.providerId, providerId);
          assert.ok(declarations.length > 0, 'graph-resolution-invariant');
          same(batch.declarationCount, declarations.length);
          if (providerId === '@wow-addon/lua-analysis') {
            same(luaOwners.has(owner.occurrenceId), false); budget.retain(1, 0); luaOwners.set(owner.occurrenceId, true);
          }
          // The SDK reads these inputs synchronously and owns its output. Origins
          // need separate owned copies because they are returned alongside the analyses.
          const provider = copyInput({providerId, tocVariantId: variant, declarations: null});
          provider.declarations = declarations;
          input.providers.push(provider);
          for (let providerDeclarationIndex = 0; providerDeclarationIndex < declarations.length; providerDeclarationIndex++) {
            budget.check();
            append({occurrenceId: owner.occurrenceId, declaration: declarations[providerDeclarationIndex],
              origin: 'provider', tocDeclarationIndex: null, providerBatchIndex, providerDeclarationIndex,
              mapping: mapping === null ? null : {...mapping, mappings: [mapping.mappings[providerDeclarationIndex]]},
              resolvedEntryIndex: null, resolvedDeclarationIndex: null}, providerId);
          }
        }
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
          for (const row of rows) {budget.check(); published.push(row);}
        }
        for (const origin of originRows) {budget.check(); declarationOrigins.push(origin);}
        if (status.resolutionEligible) {
          inputs.push(input);
          resolverInputRecords += inputRecords; resolverInputUnits += inputUnits;
        } else {
          budget.release('retainedRecords', inputRecords);
          budget.release('retainedStringUnits', inputUnits);
        }
      } catch (error) {
        const after = budget.metrics();
        budget.release('retainedRecords', after.retainedRecords - before.retainedRecords);
        budget.release('retainedStringUnits', after.retainedStringUnits - before.retainedStringUnits);
        if (error?.code === 'SGRAPH0005') throw error;
        status.graphComplete = false; status.analysisComplete = false; status.resolutionEligible = false;
        issues.push(budget.copy({code: 'SGRAPH0007', logicalAddonId: group.logicalAddonId, sources: []}));
      }
    }
    core = resolveGlobalRegistry(request.environment, inputs, request.conditionPolicy);
  } finally {
    // The SDK result owns its projections and the remaining checks use published origins.
    inputs.length = 0;
    budget.release('retainedRecords', resolverInputRecords);
    budget.release('retainedStringUnits', resolverInputUnits);
  }
  const resolved = budget.copy(core);
  mapOrigins(request, resolved, published, budget); budget.check();
  return {resolved, declarationOrigins, groups, issues,
    complete: resolved.complete && groups.length === request.profile.addons.length && groups.some(group => group.selection?.status === 'selected') &&
      groups.every(group => group.graphComplete && group.analysisComplete && group.resolutionEligible)};
}
