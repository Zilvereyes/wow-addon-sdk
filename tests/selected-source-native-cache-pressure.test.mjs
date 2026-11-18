import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSelectedSourceHost} from '../scripts/selected-source-host.mjs';
import {createGraphBudget, graphHostBudget} from '../scripts/selected-source-budget.mjs';
import {createGraphFileHost} from '../scripts/selected-source-native.mjs';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {analyzeSelectedSources} from '../scripts/selected-source-graph.mjs';
import {context, slash} from './selected-source-engine-fixtures.mjs';

const toc = 'Demo/Demo_Vanilla.toc', earlier = 'Demo/Earlier.lua', final = 'Demo/Final.lua';
const lines = 2500;
const multiline = '-- authored padding\n'.repeat(lines);
// Same byte/string length and no declarations; only disposable line-map cost differs.
const compact = multiline.replaceAll('\n', ' ');

async function fixture(run) {
  const temporary = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, 'wow-sdk-native-cache-pressure-'));
  try {
    fs.mkdirSync(path.join(root, 'Demo'));
    fs.writeFileSync(path.join(root, toc), '## SavedVariables: Saved\nEarlier.lua\nFinal.lua');
    fs.writeFileSync(path.join(root, earlier), multiline);
    fs.writeFileSync(path.join(root, final), 'Out = 1');
    await run(root);
  } finally {
    assert.equal(path.dirname(root), temporary);
    assert.ok(path.basename(root).startsWith('wow-sdk-native-cache-pressure-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
}

async function graph(root, limits = {}) {
  const prepared = context(input => {
    input.profile.addons[0].tocPaths = [toc];
    input.profile.limits = limits;
  });
  const liveFiles = new Set(), liveDirectories = new Set(), opens = [], reads = [], calls = [];
  let closes = 0, inspectorCloses = 0;
  const io = {...fs,
    openSync(name, flags, ...rest) {
      assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC), 0);
      const fd = fs.openSync(name, flags, ...rest);
      assert.equal(liveFiles.has(fd), false);
      liveFiles.add(fd); opens.push(slash(path.relative(root, name))); return fd;
    },
    closeSync(fd) {
      assert.equal(liveFiles.delete(fd), true, 'each source descriptor closes exactly once');
      return fs.closeSync(fd);
    },
    opendirSync(...args) {
      const directory = fs.opendirSync(...args); liveDirectories.add(directory);
      return {
        readSync: () => directory.readSync(),
        closeSync() {
          assert.equal(liveDirectories.delete(directory), true, 'each directory descriptor closes exactly once');
          return directory.closeSync();
        },
      };
    },
  };
  const inspectorFactory = () => ({
    async inspect(paths) {return paths.map(() => ({ok: true, reparsePoint: false}));},
    async close() {inspectorCloses++;},
  });
  // Real authored filesystem I/O and real supervised SDK requests. Only platform
  // attribute inspection and the operation clock use deterministic trusted ports.
  const host = await createSelectedSourceHost(root, prepared, {io, inspectorFactory, now: () => 0});
  const budget = graphHostBudget(host, prepared);
  const readSource = host.readSource, analyze = host.analyze, close = host.close;
  host.readSource = async (name, maximum) => {
    const row = {sourcePath: slash(name), before: budget.metrics(), callsBefore: calls.length};
    reads.push(row);
    try {const value = await readSource(name, maximum); row.after = budget.metrics(); return value;}
    catch (error) {row.error = error.code; row.after = budget.metrics(); throw error;}
  };
  host.analyze = async request => {calls.push(slash(request.sourcePath)); return analyze(request);};
  host.close = async () => {closes++; return close();};
  let result, error;
  try {result = await analyzeSelectedSources(getGraphRequest(prepared), host);}
  catch (caught) {error = caught;}
  assert.equal(closes, 1, 'traversal closes the composed host once');
  assert.equal(inspectorCloses, 1, 'the composed close owns its native inspector');
  assert.equal(liveFiles.size, 0);
  assert.equal(liveDirectories.size, 0);
  assert.equal(budget.metrics().textCacheBytes, 0, 'all cache charges are released on completion or failure');
  const detach = budget.attachRetentionReclaimer(() => assert.fail('a cleanup-only lease is never consumed'));
  detach(); detach(); // A finished or failed trace leaves no active engine lease.
  return {result, error, budget, reads, calls, opens};
}

test('native retention yields to inactive engine text before the next real SDK request', () => fixture(async root => {
  const ample = await graph(root);
  assert.ifError(ample.error);
  assert.equal(ample.result.completeUnderPolicy, true);
  assert.equal(ample.result.aggregate.status, 'passed');
  assert.deepEqual(ample.result.resolved.activeGlobals, ['Saved', 'Out']);
  assert.deepEqual(ample.calls, [toc, earlier, final]);
  const boundary = ample.reads.find(row => row.sourcePath === final);
  const permanent = ample.budget.metrics().retainedRecords;
  const limit = boundary.before.retainedRecords + 1;
  assert.equal(boundary.callsBefore, 2);
  assert.ok(boundary.before.textCacheBytes > multiline.length * 2);
  // Reclaiming the earlier line map alone leaves room for the completed owned
  // output plus the active final input. This is not a permanent-output shortfall.
  const finalInputRecords = 3; // one source line, starts array and cache shell
  assert.ok(permanent + finalInputRecords + 128 < limit);
  assert.ok(boundary.before.retainedRecords - (lines + 3) + 3 < limit);

  fs.writeFileSync(path.join(root, earlier), compact);
  const compactControl = await graph(root, {retainedRecords: limit});
  assert.ifError(compactControl.error);
  assert.equal(compactControl.result.completeUnderPolicy, true);
  assert.equal(compactControl.result.aggregate.status, 'passed');
  assert.deepEqual(compactControl.calls, ample.calls);
  assert.deepEqual(compactControl.result.resolved, ample.result.resolved);
  assert.equal(compactControl.budget.metrics().retainedRecords, permanent);

  const insufficient = await graph(root, {retainedRecords: permanent - 1});
  if (insufficient.error) assert.equal(insufficient.error.code, 'SGRAPH0005');
  else {
    assert.equal(insufficient.result.completeUnderPolicy, false);
    assert.equal(insufficient.result.aggregate.status, 'failed');
    assert.ok(insufficient.result.issues.some(row => row.code === 'SGRAPH0005'));
  }
  assert.ok(insufficient.budget.metrics().retainedRecords <= permanent - 1);

  fs.writeFileSync(path.join(root, earlier), multiline);
  const bounded = await graph(root, {retainedRecords: limit});
  const observed = bounded.reads.find(row => row.sourcePath === final);
  assert.ok(observed, 'the final source reaches the native read boundary');
  assert.ifError(bounded.error);
  if (observed.error) {
    assert.equal(observed.error, 'graph-native-budget');
    assert.equal(observed.before.sourceNodes, 3);
    assert.equal(observed.before.analysisRecords, 2);
    assert.equal(observed.after.retainedRecords, limit,
      'the fingerprint row fits; the following two-record native handoff is denied');
    assert.ok(observed.after.textCacheBytes > multiline.length * 2);
    assert.deepEqual(bounded.calls, [toc, earlier], 'native denial precedes the next analysis submission');
    assert.ok(bounded.opens.includes(final), 'the source descriptor was opened and closed before retention denial');
  }
  // This assertion is intentionally a regression expectation, not acceptance
  // of the existing fail-closed resource result. Its diagnostic identifies the
  // native allocation and missing next SDK request without exposing any corpus.
  assert.equal(bounded.result.completeUnderPolicy, true, JSON.stringify({
    limit, permanent, activeInputRecords: finalInputRecords, boundary: observed,
    calls: bounded.calls, opens: bounded.opens, issues: bounded.result.issues.map(row => row.code),
  }));
  assert.equal(bounded.result.aggregate.status, 'passed');
  assert.deepEqual(bounded.calls, ample.calls);
  assert.deepEqual(bounded.result, ample.result);
  assert.ok(bounded.budget.metrics().retainedRecords <= limit);
}));

test('a default retention lease reclaims an owned copy once and detaches without replacing another owner', () => {
  const prepared = context(input => {input.profile.limits = {retainedRecords: 4, retainedStringUnits: 128};});
  const budget = createGraphBudget(prepared, {accountContext: false, now: () => 0});
  for (const invalid of [undefined, null, {}, 'callback']) {
    assert.throws(() => budget.attachRetentionReclaimer(invalid), {code: 'SGRAPH0007'});
  }
  budget.retain(2, 0);
  const consumed = {earlier: 0, nested: 0, cell: 0, value: 0};
  let reclaims = 0, conflicts = 0;
  const reclaim = () => {
    assert.equal(++reclaims, 1);
    assert.deepEqual(consumed, {earlier: 1, nested: 1, cell: 1, value: 0});
    budget.release('retainedRecords', 2);
  };
  const detach = budget.attachRetentionReclaimer(reclaim);
  assert.throws(() => budget.attachRetentionReclaimer(() => {conflicts++;}), {code: 'SGRAPH0007'});
  const cells = [];
  Object.defineProperty(cells, 0, {enumerable: true, get() {
    assert.equal(++consumed.cell, 1);
    return {get value() {assert.equal(++consumed.value, 1); return 'last';}};
  }});
  const input = {
    get earlier() {assert.equal(++consumed.earlier, 1); return 'first';},
    get nested() {assert.equal(++consumed.nested, 1); return cells;},
  };
  assert.deepEqual(budget.copy(input), {earlier: 'first', nested: [{value: 'last'}]});
  assert.deepEqual(consumed, {earlier: 1, nested: 1, cell: 1, value: 1});
  assert.equal(reclaims, 1);
  assert.equal(conflicts, 0);
  assert.equal(budget.metrics().retainedRecords, 3);
  detach(); detach();
  const before = budget.metrics();
  assert.throws(() => budget.retain(2, 0), error => error.code === 'SGRAPH0005' && error.limit === 'retainedRecords');
  assert.deepEqual(budget.metrics(), before, 'detached reservations fail atomically with ordinary quota rules');
  assert.equal(reclaims, 1);
  const nextDetach = budget.attachRetentionReclaimer(reclaim);
  detach(); // The same callback's new lease must survive its old owner's detach.
  assert.throws(() => budget.attachRetentionReclaimer(() => {}), {code: 'SGRAPH0007'});
  nextDetach();
  const lastDetach = budget.attachRetentionReclaimer(() => {});
  lastDetach();
});

for (const key of ['retainedRecords', 'retainedStringUnits']) {
  test(`an insufficient default ${key} reclaimer is invoked once before atomic quota denial`, () => {
    const prepared = context(input => {input.profile.limits = {retainedRecords: 4, retainedStringUnits: 16};});
    const budget = createGraphBudget(prepared, {accountContext: false, now: () => 0});
    budget.retain(3, 14);
    const before = budget.metrics();
    let reclaims = 0;
    const detach = budget.attachRetentionReclaimer(() => {assert.equal(++reclaims, 1);});
    try {
      const [records, units] = key === 'retainedRecords' ? [2, 0] : [0, 3];
      assert.throws(() => budget.retain(records, units), error => error.code === 'SGRAPH0005' && error.limit === key);
      assert.equal(reclaims, 1);
      assert.deepEqual(budget.metrics(), before);
    } finally {detach();}
  });
}

test('direct native handoff uses the shared default lease and releases descriptor ownership on later denial', () => fixture(async root => {
  let inspectorCloses = 0;
  const inspectorFactory = () => ({
    async inspect(paths) {return paths.map(() => ({ok: true, reparsePoint: false}));},
    async close() {inspectorCloses++;},
  });
  const probeContext = context();
  const probe = await createGraphFileHost(root, probeContext, {inspectorFactory, now: () => 0});
  const initial = probe.metrics().retainedRecords;
  await probe.close();
  // Root contains exactly the Demo entry: snapshot+array+entry, cache row,
  // and handed-off object+array+entry require seven native-owned records.
  const limit = initial + 7;
  const prepared = context(input => {input.profile.limits = {retainedRecords: limit};});
  const budget = createGraphBudget(prepared, {accountContext: false, now: () => 0});
  const host = await createGraphFileHost(root, prepared, {budget, inspectorFactory, now: () => 0});
  budget.retain(2, 0); // Authored caller-owned disposable retention, not native state.
  let reclaims = 0;
  const detach = budget.attachRetentionReclaimer(records => {
    assert.equal(++reclaims, 1);
    assert.equal(records, 3, 'pressure occurs at the owned directory-result handoff');
    budget.release('retainedRecords', 2);
  });
  try {
    const issued = await host.listDirectory('');
    assert.deepEqual(issued.entries.map(row => row.name), ['Demo']);
    assert.equal(reclaims, 1);
    assert.equal(budget.metrics().retainedRecords, limit);
    assert.equal(host.metrics().retainedRecords, limit);
    detach(); detach();
    const before = budget.metrics();
    await assert.rejects(host.listDirectory(''), {code: 'graph-native-budget'});
    assert.deepEqual(budget.metrics(), before, 'denied cached handoff adds no retained ownership');
    assert.equal(reclaims, 1);
  } finally {detach(); await host.close();}
  assert.equal(inspectorCloses, 2, 'probe and direct host each own one inspector close');
}));
