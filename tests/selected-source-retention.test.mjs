import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traceSelectedSources} from '../scripts/selected-source-engine.mjs';
import {createGraphBudget, bindGraphHostBudget} from '../scripts/selected-source-budget.mjs';
import {context, memoryHost, slash} from './selected-source-engine-fixtures.mjs';

const toc = 'Demo/Demo_Vanilla.toc';

test('candidate-shell denial happens before the first candidate content load', async () => {
  const paths = [toc, ...Array.from({length: 127}, (_, index) => `Demo/Missing_${index}.toc`)];
  const prepare = bounded => context(input => {
    input.profile.addons[0].tocPaths = paths;
    if (bounded) input.profile.limits = {retainedRecords: 32};
  });
  const denied = memoryHost({[toc]: ''});
  const blocked = await traceSelectedSources(prepare(true), denied.host);
  assert.equal(blocked.fatal, 'resource');
  assert.ok(blocked.issues.some(issue => issue.code === 'SGRAPH0005'));
  assert.deepEqual(denied.reads, []);
  assert.deepEqual(denied.calls, []);
  assert.equal(denied.closes, 1);

  // With ample retention, the same candidate list reaches its real missing-data
  // outcome. No synthetic parser or candidate-row count substitutes for loading.
  const control = memoryHost({[toc]: ''});
  const traced = await traceSelectedSources(prepare(false), control.host);
  assert.equal(traced.fatal, null);
  assert.equal(traced.groups[0].candidates.length, paths.length);
  assert.equal(traced.groups[0].selection, null);
  assert.deepEqual(control.reads, [toc]);
  assert.deepEqual(control.calls.map(request => request.language), ['toc']);
  assert.equal(control.closes, 1);
});

test('conditional TOC event shells are reserved before retaining references or loading descendants', async () => {
  const descriptorCount = 64;
  const files = {
    [toc]: `Core.lua ${'[Bootstrap x]'.repeat(descriptorCount)}`,
    'Demo/Core.lua': 'Out=1',
  };
  const prepare = ({noMatch = false, retainedRecords} = {}) => context(input => {
    input.profile.addons[0].tocPaths = [toc];
    if (noMatch) input.profile.addons[0].addonBaseName = 'None';
    if (retainedRecords !== undefined) input.profile.limits = {retainedRecords};
    input.environment.gameType = 'x';
    input.conditionPolicy.rules.push({providerId: '@wow-addon/toc-metadata-adapter', name: 'Bootstrap',
      field: 'gameType', operator: 'include', valueComparison: 'exact'});
  });

  // Observe the ordinary retained parser/candidate state with identical source
  // facts but a known no-match selection. The bound below leaves room for a
  // root occurrence, yet less than one record per translated condition. It
  // intentionally does not repeat the implementation's shell-cost formula.
  const baselineContext = prepare({noMatch: true});
  const baseline = memoryHost(files), ledger = createGraphBudget(baselineContext);
  bindGraphHostBudget(baseline.host, ledger, baselineContext);
  let ordinaryRetention;
  const verify = baseline.host.verifySource;
  baseline.host.verifySource = async (...args) => {
    ordinaryRetention = ledger.metrics().retainedRecords;
    return verify(...args);
  };
  const noMatch = await traceSelectedSources(baselineContext, baseline.host);
  assert.equal(noMatch.fatal, null);
  assert.equal(noMatch.groups[0].selection.status, 'no-match');
  assert.ok(Number.isSafeInteger(ordinaryRetention) && ordinaryRetention > 0);

  const denied = memoryHost(files);
  const blocked = await traceSelectedSources(prepare({retainedRecords: ordinaryRetention + descriptorCount / 2}), denied.host);
  assert.equal(blocked.fatal, 'resource');
  assert.equal(blocked.groups[0].selection.status, 'selected');
  assert.equal(blocked.analyses.length, 1);
  assert.equal(blocked.analyses[0].result.parsed.metadata.fileEntries[0].conditions.length, descriptorCount);
  assert.equal(blocked.occurrences.length, 1);
  assert.deepEqual(blocked.references, []);
  assert.deepEqual(blocked.guardEvaluations, []);
  assert.deepEqual(denied.reads, [toc]);
  assert.deepEqual(denied.calls.map(request => request.language), ['toc']);
  assert.equal(denied.closes, 1);

  const control = memoryHost(files);
  const traced = await traceSelectedSources(prepare(), control.host);
  assert.equal(traced.fatal, null);
  assert.equal(traced.groups[0].resolutionEligible, true);
  assert.equal(traced.references.length, 1);
  assert.equal(traced.guardEvaluations[0].evaluation.availability, 'active');
  assert.deepEqual(control.reads, [toc, 'Demo/Core.lua']);
  assert.equal(control.calls.find(request => request.language === 'lua').conditions.length, descriptorCount);
  assert.ok(traced.occurrences.some(row => slash(row.sourcePath) === 'Demo/Core.lua'));
  assert.equal(control.closes, 1);
});
