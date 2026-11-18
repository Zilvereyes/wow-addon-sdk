import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareGraphContext} from '../scripts/selected-source-context.mjs';
import {createGraphBudget} from '../scripts/selected-source-budget.mjs';
import {createGraphFileHost} from '../scripts/selected-source-native.mjs';

const json = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const sourcePath = path.join('Demo', 'Core.lua');
const content = 'Out = 1';
const repetitions = 4;
function context(limits = {}) {
  const input = {
    profile: json('../docs/proposals/selected-source-graph-profile.json'),
    ...json('../examples/classic-era-resolution-profile.json'),
    xmlPolicy: json('../examples/xml-provider-profile.json').policy,
    inlineProfile: json('../examples/xml-inline-lua-profile.json'),
    luaInputProfile: 'bounded',
  };
  input.profile.limits = limits;
  return prepareGraphContext(input);
}

async function fixture(run) {
  const temporary = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, 'wow-sdk-native-retention-'));
  try {
    fs.mkdirSync(path.join(root, 'Demo'));
    fs.writeFileSync(path.join(root, sourcePath), content);
    await run(root);
  } finally {
    assert.equal(path.dirname(root), temporary);
    assert.ok(path.basename(root).startsWith('wow-sdk-native-retention-'));
    fs.rmSync(root, {recursive: true, force: true});
  }
}

async function openHost(root, {shared = false, limits = {}, io = fs, now = () => 0,
  inspect = async paths => paths.map(() => ({ok: true, reparsePoint: false}))} = {}) {
  const prepared = context(limits);
  // Isolate native accounting from context ownership and real helper startup.
  // Inputs and directory enumeration remain real authored filesystem operations.
  const budget = shared ? createGraphBudget(prepared, {now, accountContext: false}) : null;
  const inspectorFactory = () => ({
    inspect,
    async close() {},
  });
  const host = await createGraphFileHost(root, prepared, {budget, inspectorFactory, io, now});
  return {host, budget};
}

const retained = metrics => ({records: metrics.retainedRecords, units: metrics.retainedStringUnits});
function assertShared(host, budget) {
  if (!budget) return;
  const native = host.metrics(), shared = budget.metrics();
  assert.deepEqual(retained(shared), retained(native), 'the shared ledger must track native live ownership');
  assert.equal(shared.directoryEntries, native.directoryEntries);
  assert.equal(shared.readBytes, native.chargedReadBytes);
}

test('issued native list and read copies remain owned, distinct, and retention charged', () => fixture(async root => {
  const {host, budget} = await openHost(root, {shared: true});
  try {
    const empty = host.metrics();
    assert.equal(await host.verifyDirectory('', 'unissued'), false);
    assert.equal(await host.verifySource(sourcePath, 'unissued', 1024), false);
    assert.deepEqual(host.metrics(), empty, 'unissued fingerprints perform no I/O or retention');

    const first = await host.listDirectory('');
    const listed = host.metrics();
    const second = await host.listDirectory('');
    const copied = host.metrics();
    assert.deepEqual(first, second);
    assert.notEqual(first, second);
    assert.notEqual(first.entries, second.entries);
    assert.notEqual(first.entries[0], second.entries[0]);
    assert.equal(copied.directoryEntries, listed.directoryEntries, 'an owned cached copy does not rescan');
    assert.equal(copied.retainedRecords - listed.retainedRecords, first.entries.length + 2);
    assert.equal(copied.retainedStringUnits - listed.retainedStringUnits,
      first.fingerprint.length + first.entries.reduce((sum, row) => sum + row.name.length, 0));
    first.entries[0].name = 'caller mutation';
    assert.equal(second.entries[0].name, 'Demo', 'caller mutation does not change another owned copy');

    const original = await host.readSource(sourcePath, 1024);
    const read = host.metrics();
    const another = await host.readSource(sourcePath, 1024);
    const reread = host.metrics();
    assert.equal(original.bytes.toString(), content);
    assert.equal(another.bytes.toString(), content);
    assert.equal(original.fingerprint, another.fingerprint);
    assert.notEqual(original, another);
    assert.notEqual(original.bytes, another.bytes);
    assert.equal(reread.retainedRecords - read.retainedRecords, 2);
    assert.equal(reread.retainedStringUnits - read.retainedStringUnits, original.fingerprint.length);
    assert.equal(reread.chargedReadBytes - read.chargedReadBytes, Buffer.byteLength(content));
    original.bytes.fill(0);
    assert.equal(another.bytes.toString(), content);
    assert.equal(fs.readFileSync(path.join(root, sourcePath), 'utf8'), content);
    assertShared(host, budget);
  } finally {await host.close();}
}));

for (const shared of [false, true]) {
  const ledger = shared ? 'shared ledger' : 'native counters';
  test(`boolean directory verification releases disposable snapshots with ${ledger}`, () => fixture(async root => {
    const {host, budget} = await openHost(root, {shared});
    try {
      const issued = await host.listDirectory('');
      const before = host.metrics(), beforeShared = budget?.metrics();
      for (let index = 0; index < repetitions; index++) {
        assert.equal(await host.verifyDirectory('', issued.fingerprint), true);
      }
      const after = host.metrics();
      assert.equal(after.directoryEntries - before.directoryEntries, repetitions * issued.entries.length,
        'all verification enumeration remains cumulative scan work');
      assert.equal(after.chargedReadBytes, before.chargedReadBytes);
      assert.deepEqual(issued.entries.map(row => row.name), ['Demo']);
      assertShared(host, budget);
      assert.deepEqual(retained(after), retained(before), 'only the issued snapshot and cache stay retained');
      if (budget) assert.deepEqual(retained(budget.metrics()), retained(beforeShared));
    } finally {await host.close();}
  }));

  test(`boolean source verification releases disposable read results with ${ledger}`, () => fixture(async root => {
    const {host, budget} = await openHost(root, {shared});
    try {
      const issued = await host.readSource(sourcePath, 1024);
      const before = host.metrics(), beforeShared = budget?.metrics();
      for (let index = 0; index < repetitions; index++) {
        assert.equal(await host.verifySource(sourcePath, issued.fingerprint, 1024), true);
      }
      const after = host.metrics(), bytes = repetitions * Buffer.byteLength(content);
      assert.equal(after.chargedReadBytes - before.chargedReadBytes, bytes);
      assert.equal(after.consumedReadBytes - before.consumedReadBytes, bytes);
      assert.equal(after.directoryEntries, before.directoryEntries, 'verification reuses valid directory caches');
      assert.equal(issued.bytes.toString(), content, 'the actual issued result stays intact');
      assertShared(host, budget);
      assert.deepEqual(retained(after), retained(before), 'boolean verification hands no result or buffer to the caller');
      if (budget) assert.deepEqual(retained(budget.metrics()), retained(beforeShared));
    } finally {await host.close();}
  }));

  for (const kind of ['directory', 'source']) {
    for (const limit of ['retainedRecords', 'retainedStringUnits']) {
      test(`repeated ${kind} verification fits one temporary ${limit} allowance with ${ledger}`, () => fixture(async root => {
        // Calibrate the persistent state on the same authored root. The lower
        // limit admits that state plus one full disposable verification result.
        // Thus a later rejection can only arise from accumulated temporaries.
        const probe = await openHost(root, {shared});
        let persistent, temporaryRecords, temporaryUnits;
        try {
          const initialized = probe.host.metrics();
          const issued = kind === 'directory' ? await probe.host.listDirectory('') : await probe.host.readSource(sourcePath, 1024);
          persistent = probe.host.metrics();
          if (kind === 'directory') {
            temporaryRecords = issued.entries.length + 2;
            const ownedUnits = issued.fingerprint.length + issued.entries.reduce((sum, row) => sum + row.name.length, 0);
            // The root cache key is empty, so all other initial string charges
            // belong to the single cached snapshot, including its stat stamp.
            temporaryUnits = persistent.retainedStringUnits - initialized.retainedStringUnits - ownedUnits;
          } else {
            temporaryRecords = 2;
            temporaryUnits = issued.fingerprint.length;
          }
        } finally {await probe.host.close();}
        assert.ok(temporaryRecords > 0);
        assert.ok(temporaryUnits > 0);
        const limits = {[limit]: persistent[limit] + (limit === 'retainedRecords' ? temporaryRecords : temporaryUnits)};
        const {host, budget} = await openHost(root, {shared, limits});
        try {
          const issued = kind === 'directory' ? await host.listDirectory('') : await host.readSource(sourcePath, 1024);
          assert.deepEqual(retained(host.metrics()), retained(persistent), 'the first issued result fits the lower limit');
          assert.equal(kind === 'directory' ? await host.verifyDirectory('', issued.fingerprint) :
            await host.verifySource(sourcePath, issued.fingerprint, 1024), true, 'one full temporary result fits');
          await assert.doesNotReject(async () => {
            for (let index = 1; index < repetitions; index++) {
              assert.equal(kind === 'directory' ? await host.verifyDirectory('', issued.fingerprint) :
                await host.verifySource(sourcePath, issued.fingerprint, 1024), true);
            }
          }, 'completed boolean verifications must make their temporary allowance reusable');
          assertShared(host, budget);
          assert.deepEqual(retained(host.metrics()), retained(persistent));
        } finally {await host.close();}
      }));
    }
  }

  test(`changed directory verification releases its rejected snapshot with ${ledger}`, () => fixture(async root => {
    const {host, budget} = await openHost(root, {shared});
    try {
      const issued = await host.listDirectory('');
      const before = host.metrics();
      fs.writeFileSync(path.join(root, 'Added.lua'), '-- authored change');
      assert.equal(await host.verifyDirectory('', issued.fingerprint), false);
      const after = host.metrics();
      assert.equal(after.directoryEntries - before.directoryEntries, 2, 'changed verification enumerated the fresh directory');
      assert.equal((await host.resolvePath('Added.lua')).status, 'blocked', 'the rejected directory stays invalidated');
      assert.deepEqual(issued.entries.map(row => row.name), ['Demo'], 'the actual issued snapshot is preserved');
      assertShared(host, budget);
      assert.deepEqual(retained(after), retained(before), 'a rejected fresh snapshot does not become persistent ownership');
    } finally {await host.close();}
  }));

  test(`changed source verification charges I/O and preserves invalidation with ${ledger}`, () => fixture(async root => {
    const {host, budget} = await openHost(root, {shared});
    try {
      const issued = await host.readSource(sourcePath, 1024);
      const before = host.metrics();
      fs.writeFileSync(path.join(root, sourcePath), 'Out = 2');
      assert.equal(await host.verifySource(sourcePath, issued.fingerprint, 1024), false);
      const after = host.metrics();
      assert.equal(after.consumedReadBytes - before.consumedReadBytes, Buffer.byteLength(content));
      assert.ok(after.chargedReadBytes - before.chargedReadBytes >= Buffer.byteLength(content),
        'failed I/O keeps the existing conservative read reservation policy');
      assert.equal(await host.verifySource(sourcePath, issued.fingerprint, 1024), false);
      await assert.rejects(host.readSource(sourcePath, 1024), {code: 'graph-native-changed'});
      assert.deepEqual(host.metrics(), after, 'invalidated sources are rejected before more I/O');
      assert.equal(issued.bytes.toString(), content);
      assertShared(host, budget);
      assert.deepEqual(retained(after), retained(before));
    } finally {await host.close();}
  }));

  test(`a failed initial directory scan is disposable and can be retried with ${ledger}`, () => fixture(async root => {
    let denyEntries = true;
    const inspect = async paths => {
      if (denyEntries && paths.includes(path.join(root, 'Demo'))) throw Error('authored attribute failure');
      return paths.map(() => ({ok: true, reparsePoint: false}));
    };
    const {host, budget} = await openHost(root, {shared, inspect});
    try {
      const initialized = host.metrics();
      await assert.rejects(host.listDirectory(''), {code: 'graph-native-attributes'});
      const failed = host.metrics();
      assert.equal(failed.directoryEntries - initialized.directoryEntries, 1, 'failure follows actual row enumeration');
      assert.deepEqual(retained(failed), retained(initialized), 'no failed snapshot or row escaped');
      assertShared(host, budget);
      denyEntries = false;
      const issued = await host.listDirectory('');
      assert.deepEqual(issued.entries.map(row => row.name), ['Demo']);
      assert.equal(host.metrics().directoryEntries - failed.directoryEntries, 1, 'retry scans again instead of reusing a failed snapshot');
      assert.ok(host.metrics().retainedRecords > initialized.retainedRecords, 'successful cache and owned result remain charged');
      assertShared(host, budget);
    } finally {await host.close();}
  }));

  for (const interruption of ['attribute failure', 'expired deadline']) {
    test(`interrupted verification releases scanned rows after ${interruption} with ${ledger}`, () => fixture(async root => {
      let armed = false, time = 0;
      const inspect = async paths => {
        if (armed && paths.includes(path.join(root, 'Demo'))) {
          if (interruption === 'expired deadline') time = 5001;
          throw Error('authored verification interruption');
        }
        return paths.map(() => ({ok: true, reparsePoint: false}));
      };
      const {host, budget} = await openHost(root, {shared, inspect, now: () => time, limits: {operationMilliseconds: 5000}});
      try {
        const issued = await host.listDirectory('');
        const before = host.metrics();
        armed = true;
        if (interruption === 'expired deadline') {
          await assert.rejects(host.verifyDirectory('', issued.fingerprint), {code: 'graph-native-budget'});
        } else {
          assert.equal(await host.verifyDirectory('', issued.fingerprint), false);
          assert.equal((await host.resolvePath('Demo/Core.lua')).status, 'blocked', 'interrupted verification stays invalidated');
        }
        const after = host.metrics();
        assert.equal(after.directoryEntries - before.directoryEntries, 1, 'the interruption happened after fresh rows were retained');
        assert.deepEqual(retained(after), retained(before), 'nested failure cleanup preserves the issued cache and copy exactly once');
        assert.deepEqual(issued.entries.map(row => row.name), ['Demo']);
        assertShared(host, budget);
      } finally {await host.close();}
    }));
  }

  for (const publishCache of [false, true]) {
    const stage = publishCache ? 'owned result allocation' : 'cache publication';
    test(`failed ${stage} preserves only published cache ownership with ${ledger}`, () => fixture(async root => {
      const probe = await openHost(root, {shared});
      let initializedRecords, snapshotRecords;
      try {
        initializedRecords = probe.host.metrics().retainedRecords;
        const issued = await probe.host.listDirectory('');
        snapshotRecords = issued.entries.length + 2;
      } finally {await probe.host.close();}
      // Either admit just the fresh snapshot, or also its persistent cache row.
      // Neither case has space for a returned owned result.
      const limits = {retainedRecords: initializedRecords + snapshotRecords + Number(publishCache)};
      const {host, budget} = await openHost(root, {shared, limits});
      try {
        const initialized = host.metrics();
        await assert.rejects(host.listDirectory(''), {code: 'graph-native-budget'});
        const firstFailure = host.metrics();
        assert.equal(firstFailure.directoryEntries - initialized.directoryEntries, 1);
        if (publishCache) {
          assert.equal(firstFailure.retainedRecords - initialized.retainedRecords, snapshotRecords + 1,
            'a successfully installed cache remains retained when returning its owned copy is denied');
          assert.ok(firstFailure.retainedStringUnits > initialized.retainedStringUnits);
          assert.equal((await host.resolvePath('Demo', {directory: true})).status, 'ready', 'the published cache remains usable');
        } else {
          assert.deepEqual(retained(firstFailure), retained(initialized), 'a snapshot denied cache publication stays disposable');
        }
        await assert.rejects(host.listDirectory(''), {code: 'graph-native-budget'});
        const secondFailure = host.metrics();
        assert.equal(secondFailure.directoryEntries - firstFailure.directoryEntries, publishCache ? 0 : 1,
          'only an actually published cache avoids enumeration on retry');
        assert.deepEqual(retained(secondFailure), retained(firstFailure), 'retries do not accumulate failed allocations');
        assertShared(host, budget);
      } finally {await host.close();}
    }));
  }
}
