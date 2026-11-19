import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {observeGroupIntegrity, validIntegrity, sumIntegrity, emptyIntegrity} from '../scripts/selected-source-integrity.mjs';
import {runGroupedSelectedSources} from '../scripts/selected-source-grouped.mjs';

function temporary(run) {
  const base = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'wow-sdk-integrity-'));
  return Promise.resolve().then(() => run(base)).finally(() => {
    assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
    fs.rmSync(base, {recursive: true, force: true});
  });
}
const nativeError = kind => Object.assign(Error('graph-native-' + kind), {code: 'graph-native-' + kind});
function fixture(base) {
  const root = path.join(base, 'root');
  fs.mkdirSync(path.join(root, 'PrivateAddon'), {recursive: true});
  fs.writeFileSync(path.join(root, 'PrivateAddon', 'PrivateCore.lua'), 'PrivateGlobal=1');
  return root;
}
const read = async () => ({bytes: new Uint8Array(1), fingerprint: 'f'});

test('a read followed by unchanged bytes yields equal digests and no change', () => temporary(async base => {
  const root = fixture(base), observer = observeGroupIntegrity({readSource: read}, root);
  await observer.host.readSource('PrivateAddon/PrivateCore.lua', 10);
  const summary = observer.finish();
  assert.equal(summary.filesObserved, 1); assert.equal(summary.changedDuringGroup, 0); assert.equal(summary.hashUnavailable, 0);
  assert.equal(summary.contentDigestBefore, summary.contentDigestAfter);
  assert.equal(summary.phases.readSource.calls, 1); assert.ok(validIntegrity(summary));
}));

test('a source modified after its first read is counted and changes the after digest only', () => temporary(async base => {
  const root = fixture(base), file = path.join(root, 'PrivateAddon', 'PrivateCore.lua');
  const observer = observeGroupIntegrity({readSource: read}, root);
  await observer.host.readSource('PrivateAddon/PrivateCore.lua', 10);
  fs.writeFileSync(file, 'PrivateGlobal=2');
  const summary = observer.finish();
  assert.equal(summary.changedDuringGroup, 1); assert.notEqual(summary.contentDigestBefore, summary.contentDigestAfter);
}));

test('a source removed after its first read is unavailable, never silently equal', () => temporary(async base => {
  const root = fixture(base), observer = observeGroupIntegrity({readSource: read}, root);
  await observer.host.readSource('PrivateAddon/PrivateCore.lua', 10);
  fs.rmSync(path.join(root, 'PrivateAddon', 'PrivateCore.lua'));
  const summary = observer.finish();
  assert.equal(summary.hashUnavailable, 1); assert.equal(summary.changedDuringGroup, 0);
  assert.notEqual(summary.contentDigestBefore, summary.contentDigestAfter);
}));

test('native read failures are counted by fixed code per phase and still rethrown unchanged', () => temporary(async base => {
  const root = fixture(base), failure = nativeError('changed'), other = Error('PrivateMessage');
  const host = {readSource: async key => {throw key === 'a.lua' ? failure : other;}, listDirectory: async () => {throw nativeError('io');}};
  const observer = observeGroupIntegrity(host, root);
  await assert.rejects(observer.host.readSource('a.lua', 1), error => error === failure);
  await assert.rejects(observer.host.readSource('b.lua', 1), error => error === other);
  await assert.rejects(observer.host.listDirectory('PrivateAddon'), {code: 'graph-native-io'});
  const summary = observer.finish();
  assert.deepEqual(summary.phases.readSource.nativeCodes, {'graph-native-changed': 1, other: 1});
  assert.deepEqual(summary.phases.listDirectory.nativeCodes, {'graph-native-io': 1});
  assert.equal(summary.phases.readSource.rejected, 2); assert.equal(summary.phases.readSource.calls, 2);
  assert.equal(JSON.stringify(summary).includes('PrivateMessage'), false);
}));

test('a false source verification is separated into a false report on unchanged bytes and a real change', () => temporary(async base => {
  const root = fixture(base), file = path.join(root, 'PrivateAddon', 'PrivateCore.lua');
  const host = {readSource: read, verifySource: async () => false};
  const observer = observeGroupIntegrity(host, root);
  await observer.host.readSource('PrivateAddon/PrivateCore.lua', 10);
  assert.equal(await observer.host.verifySource('PrivateAddon/PrivateCore.lua', 'f', 10), false);
  fs.writeFileSync(file, 'PrivateGlobal=2');
  assert.equal(await observer.host.verifySource('PrivateAddon/PrivateCore.lua', 'f', 10), false);
  const summary = observer.finish();
  assert.equal(summary.phases.verifySource.calls, 2); assert.equal(summary.phases.verifySource.falseResults, 2);
  assert.equal(summary.phases.verifySource.falseWithoutChange, 1);
}));

test('a false directory verification is separated by an independent name snapshot', () => temporary(async base => {
  const root = fixture(base);
  const host = {listDirectory: async () => ({fingerprint: 'd', entries: []}), verifyDirectory: async () => false};
  const observer = observeGroupIntegrity(host, root);
  await observer.host.listDirectory('PrivateAddon');
  await observer.host.verifyDirectory('PrivateAddon', 'd');
  fs.writeFileSync(path.join(root, 'PrivateAddon', 'PrivateNew.lua'), '');
  await observer.host.verifyDirectory('PrivateAddon', 'd');
  const summary = observer.finish();
  assert.equal(summary.phases.verifyDirectory.falseResults, 2); assert.equal(summary.phases.verifyDirectory.falseWithoutChange, 1);
  assert.equal(summary.directoriesObserved, 1);
}));

test('a true verification is not a false report, wrapping keeps host results, and finish runs once', () => temporary(async base => {
  const root = fixture(base), result = {bytes: new Uint8Array(1), fingerprint: 'f'};
  const observer = observeGroupIntegrity({readSource: async () => result, verifySource: async () => true, other: () => 7}, root);
  assert.equal(await observer.host.readSource('PrivateAddon/PrivateCore.lua', 10), result);
  assert.equal(await observer.host.verifySource('PrivateAddon/PrivateCore.lua', 'f', 10), true);
  assert.equal(observer.host.other(), 7);
  const summary = observer.finish();
  assert.equal(summary.phases.verifySource.falseResults, 0); assert.throws(() => observer.finish());
}));

test('summary validation rejects extra keys, bad digests and non-count values; sums add counts only', () => {
  const good = emptyIntegrity();
  assert.ok(validIntegrity(good));
  for (const bad of [{...good, path: 'PrivateAddon'}, {...good, contentDigestBefore: 'x'}, {...good, filesObserved: -1},
    {...good, phases: {...good.phases, readSource: {...good.phases.readSource, nativeCodes: {'Private Name': 1}}}},
    {...good, phases: {...good.phases, extra: {}}}, null, []]) assert.equal(validIntegrity(bad), false);
  const a = emptyIntegrity(), b = emptyIntegrity();
  a.filesObserved = 2; b.filesObserved = 3; b.changedDuringGroup = 1; b.phases.readSource.nativeCodes['graph-native-io'] = 4;
  const total = sumIntegrity([a, b]);
  assert.equal(total.filesObserved, 5); assert.equal(total.groupsWithChange, 1); assert.equal(total.phases.readSource.nativeCodes['graph-native-io'], 4);
  assert.equal('contentDigestBefore' in total, false);
});

test('the runner stores the summary in each group receipt, sums it into the batch and repeats receipts without one', () => temporary(async base => {
  const root = fixture(base), receipts = path.join(base, 'receipts'); fs.mkdirSync(receipts);
  fs.mkdirSync(path.join(root, 'PrivateOther')); fs.writeFileSync(path.join(root, 'PrivateOther', 'PrivateOther.toc'), 'PrivateCore.lua\n');
  const request = {profile: {schemaVersion: 1, id: 'authored/grouped', addons: ['PrivateAddon', 'PrivateOther'].map(name =>
    ({logicalAddonId: `private/${name}`, directory: name, addonBaseName: name, tocPaths: [`${name}/${name}.toc`]}))}, luaInputProfile: 'bounded'};
  let analyses = 0;
  const clock = (() => {let t = 0; return () => (t += 5);})();
  const run = () => runGroupedSelectedSources({root, request, receiptDirectory: receipts, prepare: () => ({}), createHost: async () => ({readSource: read}), now: clock,
    analyze: async (single, host) => {analyses++; await host.readSource('PrivateAddon/PrivateCore.lua', 10); return {schemaVersion: 1, status: 'passed', completeUnderPolicy: true, selection: {selected: 1}, issuesByCode: {}};}});
  const first = await run();
  assert.equal(first.report.integrity.filesObserved, 2); assert.equal(first.report.integrity.phases.readSource.calls, 2);
  assert.equal(first.report.integrity.groupsWithChange, 0);
  const receipt = JSON.parse(fs.readFileSync(path.join(receipts, 'group-0001.json'), 'utf8'));
  assert.ok(validIntegrity(receipt.integrity));
  for (const text of [JSON.stringify(first.report), JSON.stringify(receipt)]) for (const secret of ['PrivateAddon', 'PrivateCore', 'PrivateOther', root]) assert.equal(text.includes(secret), false);
  const before = analyses; await run(); assert.equal(analyses, before); // Both valid receipts are reused.
  delete receipt.integrity; fs.writeFileSync(path.join(receipts, 'group-0001.json'), JSON.stringify(receipt));
  await run(); assert.equal(analyses, before + 1); // Only the group whose receipt lost its summary repeats.
}));
