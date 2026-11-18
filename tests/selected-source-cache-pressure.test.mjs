import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {analyzeSelectedSources} from '../scripts/selected-source-graph.mjs';
import {createGraphBudget, bindGraphHostBudget} from '../scripts/selected-source-budget.mjs';
import {context, memoryHost} from './selected-source-engine-fixtures.mjs';

const toc = 'Demo/Demo_Vanilla.toc';
const names = Array.from({length: 64}, (_, index) => `Kept${index}`);
const padding = lines => '-- paddingpaddingpaddingpadding\n'.repeat(lines);
const declarations = names.map(name => `${name}=1`).join('\n');
const files = {
  [toc]: '## SavedVariables: Saved\nEarlier.lua\nCore.lua',
  'Demo/Earlier.lua': padding(2500),
  'Demo/Core.lua': declarations,
};

async function graph(limits = {}, sourceFiles = files) {
  const prepared = context(input => {
    input.profile.addons[0].tocPaths = [toc];
    input.profile.limits = limits;
  });
  const fixture = memoryHost(sourceFiles), budget = createGraphBudget(prepared);
  bindGraphHostBudget(fixture.host, budget, prepared);
  try {
    return {result: await analyzeSelectedSources(getGraphRequest(prepared), fixture.host), budget, fixture};
  } catch (error) {
    return {error, budget, fixture};
  }
}

test('disposable text and line maps yield retention to the same complete graph facts', async t => {
  const ample = await graph();
  assert.ifError(ample.error);
  assert.equal(ample.result.completeUnderPolicy, true);
  assert.equal(ample.result.aggregate.status, 'passed');
  assert.deepEqual(ample.result.resolved.activeGlobals, ['Saved', ...names]);
  assert.equal(ample.result.analyses.length, 3);
  assert.equal(ample.result.declarationOrigins.length, names.length + 1);
  assert.equal(ample.fixture.closes, 1);
  // The real operation has finished and evicted its entire text cache. Observe
  // the retained complete result, rather than reproducing ledger cost formulas.
  const permanent = ample.budget.metrics();
  assert.equal(permanent.textCacheBytes, 0);

  for (const [key, headroom, shortfall] of [
    ['retainedRecords', 128, 128],
    ['retainedStringUnits', 2048, 2048],
  ]) {
    await t.test(`${key}: cached source cannot displace permanent analysis/provider/origin facts`, async () => {
      const limit = permanent[key] + headroom;
      const bounded = await graph({[key]: limit});
      assert.ifError(bounded.error);
      // All source-cache insertions and real SDK calls must have succeeded;
      // this pressure is on retained reply/provider/origin copies afterwards.
      assert.deepEqual(bounded.fixture.calls, ample.fixture.calls);
      assert.equal(bounded.result.completeUnderPolicy, true);
      assert.equal(bounded.result.aggregate.status, 'passed');
      assert.deepEqual(bounded.result, ample.result);
      assert.equal(bounded.fixture.closes, 1);
      assert.equal(bounded.budget.metrics().textCacheBytes, 0);
      assert.ok(bounded.budget.metrics()[key] <= limit);
    });

    await t.test(`${key}: insufficient permanent-output retention still fails closed`, async () => {
      const limit = permanent[key] - shortfall;
      const denied = await graph({[key]: limit});
      if (denied.error) assert.equal(denied.error.code, 'SGRAPH0005');
      else {
        assert.equal(denied.result.completeUnderPolicy, false);
        assert.equal(denied.result.aggregate.status, 'failed');
        assert.ok(denied.result.issues.some(issue => issue.code === 'SGRAPH0005'));
        assert.deepEqual(denied.result.resolved.activeGlobals, []);
      }
      assert.equal(denied.fixture.closes, 1);
      assert.equal(denied.budget.metrics().textCacheBytes, 0);
      assert.ok(denied.budget.metrics()[key] <= limit);
    });
  }
});

test('currently validated source stays charged when input plus reply exceeds string retention', async () => {
  const sourceFiles = {[toc]: '## SavedVariables: Saved\nCore.lua',
    'Demo/Core.lua': `${padding(2800)}${declarations}`};
  const ample = await graph({}, sourceFiles);
  assert.ifError(ample.error);
  assert.equal(ample.result.completeUnderPolicy, true);
  assert.deepEqual(ample.result.resolved.activeGlobals, ['Saved', ...names]);
  const permanent = ample.budget.metrics();
  assert.equal(permanent.textCacheBytes, 0);
  const limit = permanent.retainedStringUnits + 2048;
  const denied = await graph({retainedStringUnits: limit}, sourceFiles);
  // The active input fits and reaches the actual SDK. Its source text is still
  // needed to validate the reply, so that cache entry cannot fund the copy by
  // releasing its charge. Permanent-output headroom alone is insufficient.
  assert.deepEqual(denied.fixture.calls, ample.fixture.calls);
  assert.ifError(denied.error);
  assert.equal(denied.result.completeUnderPolicy, false);
  assert.equal(denied.result.aggregate.status, 'failed');
  assert.ok(denied.result.issues.some(issue => issue.code === 'SGRAPH0005'));
  assert.equal(denied.result.analyses.length, 1);
  assert.deepEqual(denied.result.resolved.activeGlobals, []);
  assert.equal(denied.fixture.closes, 1);
  assert.equal(denied.budget.metrics().textCacheBytes, 0);
  assert.ok(denied.budget.metrics().retainedStringUnits <= limit);
});

for (const key of ['retainedRecords', 'retainedStringUnits']) {
  test(`owned copy reclaims ${key} mid-copy without consuming any getter twice`, () => {
    const prepared = context(input => {input.profile.limits = {retainedRecords: 4, retainedStringUnits: 30};});
    const budget = createGraphBudget(prepared, {accountContext: false, now: () => 0});
    const disposable = key === 'retainedRecords' ? {records: 2, units: 0} : {records: 0, units: 12};
    budget.retain(disposable.records, disposable.units);
    const consumed = {earlier: 0, nested: 0, cell: 0};
    const array = [];
    Object.defineProperty(array, 0, {enumerable: true, get() {
      assert.equal(++consumed.cell, 1); return 'tail-value';
    }});
    const input = {
      get earlier() {assert.equal(++consumed.earlier, 1); return 'first';},
      get nested() {assert.equal(++consumed.nested, 1); return array;},
    };
    let reclaims = 0;
    const copied = budget.copy(input, () => {
      assert.equal(++reclaims, 1);
      // Both object getters and the array-cell getter have already been read.
      // Retrying the entire copy would reread this mutable external projection.
      assert.deepEqual(consumed, {earlier: 1, nested: 1, cell: 1});
      budget.release('retainedRecords', disposable.records);
      budget.release('retainedStringUnits', disposable.units);
    });
    assert.equal(reclaims, 1);
    assert.deepEqual(consumed, {earlier: 1, nested: 1, cell: 1});
    assert.deepEqual(copied, {earlier: 'first', nested: ['tail-value']});
    assert.notEqual(copied.nested, array);
    assert.equal(budget.metrics().retainedRecords, 3);
    assert.equal(budget.metrics().retainedStringUnits, 28);
  });
}

test('expired copy and reservation never invoke reclamation and preserve the prior ledger', () => {
  let now = 0, reclaims = 0, consumed = 0;
  const prepared = context(input => {input.profile.limits = {
    retainedRecords: 4, retainedStringUnits: 20, operationMilliseconds: 10,
  };});
  const budget = createGraphBudget(prepared, {accountContext: false, now: () => now});
  budget.retain(2, 8);
  const before = budget.metrics();
  const reclaim = () => {reclaims++;};
  assert.throws(() => budget.copy({get earlier() {consumed++; now = 10; return 'ok';}}, reclaim),
    error => error.code === 'SGRAPH0005' && error.limit === 'operationMilliseconds');
  assert.equal(consumed, 1);
  assert.equal(reclaims, 0);
  assert.deepEqual(budget.metrics(), before);
  assert.throws(() => budget.retain(5, 0, reclaim),
    error => error.code === 'SGRAPH0005' && error.limit === 'operationMilliseconds');
  assert.equal(reclaims, 0);
  assert.deepEqual(budget.metrics(), before);
});

for (const mode of ['insufficient', 'throws']) {
  test(`${mode} reclamation rolls back only this incomplete copy`, () => {
    const prepared = context(input => {input.profile.limits = {retainedRecords: 8, retainedStringUnits: 20};});
    const budget = createGraphBudget(prepared, {accountContext: false, now: () => 0});
    budget.retain(2, 8);
    const before = budget.metrics(), released = mode === 'insufficient' ? 1 : 3;
    const marker = Error('authored reclaim failure');
    let reclaims = 0, earlier = 0, later = 0;
    const input = {
      get earlier() {earlier++; return 'ok';},
      get later() {later++; return 'end';},
    };
    const reclaim = () => {
      assert.equal(++reclaims, 1);
      assert.equal(earlier, 1);
      budget.release('retainedStringUnits', released);
      if (mode === 'throws') throw marker;
    };
    assert.throws(() => budget.copy(input, reclaim), error => mode === 'throws' ? error === marker :
      error.code === 'SGRAPH0005' && error.limit === 'retainedStringUnits');
    assert.equal(reclaims, 1);
    assert.equal(earlier, 1);
    assert.equal(later, 0);
    assert.deepEqual(budget.metrics(), {...before, retainedStringUnits: before.retainedStringUnits - released});
  });
}

test('invalid reservation counts never invoke reclamation or change the ledger', () => {
  const prepared = context(input => {input.profile.limits = {retainedRecords: 4, retainedStringUnits: 20};});
  const budget = createGraphBudget(prepared, {accountContext: false, now: () => 0});
  budget.retain(2, 8);
  const before = budget.metrics();
  let reclaims = 0;
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', undefined]) {
    for (const [records, units, limit] of [[invalid, 0, 'retainedRecords'], [0, invalid, 'retainedStringUnits']]) {
      assert.throws(() => budget.retain(records, units, () => {reclaims++;}),
        error => error.code === 'SGRAPH0005' && error.limit === limit);
      assert.deepEqual(budget.metrics(), before);
    }
  }
  assert.equal(reclaims, 0);
});
