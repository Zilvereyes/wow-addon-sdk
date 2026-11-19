import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {groupDigest, groupFileName, mergeAggregates, runGroupedSelectedSources} from '../scripts/selected-source-grouped.mjs';

const full = fileURLToPath(new URL('../scripts/inspect-selected-addon-sources.mjs', import.meta.url));
const grouped = fileURLToPath(new URL('../scripts/inspect-selected-addon-sources-by-group.mjs', import.meta.url));
const json = filename => JSON.parse(fs.readFileSync(new URL(filename, import.meta.url), 'utf8'));

function temporary(run) {
  const base = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'wow-sdk-grouped-'));
  const cleanup = () => {
    assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
    fs.rmSync(base, {recursive: true, force: true});
  };
  return Promise.resolve().then(() => run(base)).finally(cleanup);
}

const addon = name => ({logicalAddonId: `private/${name}`, directory: name, addonBaseName: name, tocPaths: [`${name}/${name}_Vanilla.toc`]});
const requestFor = names => ({profile: {schemaVersion: 1, id: 'authored/grouped', addons: names.map(addon)}, luaInputProfile: 'bounded'});
const counts = (status, selected = 1, complete = true) => ({schemaVersion: 1, status, completeUnderPolicy: complete,
  fullParsing: false, selection: {requestedGroups: 1, selected, noMatch: 1 - selected},
  languages: {lua: {sourceRequestsSubmitted: 2, analysisDiagnosticsByCode: {LUA0001: 1}}}, issuesByCode: {}});
const seams = (analyzeRow, calls = []) => ({
  prepare: () => ({}), createHost: async () => ({}),
  analyze: async request => {
    const name = request.profile.addons[0].directory; calls.push(name); return analyzeRow(name);
  },
  now: (() => {let tick = 0; return () => (tick += 10);})(),
});

test('merge sums counts and histograms and combines completeness flags as a conjunction', () => {
  const merged = mergeAggregates([counts('passed'), {...counts('incomplete', 0, false),
    languages: {lua: {sourceRequestsSubmitted: 3, analysisDiagnosticsByCode: {LUA0001: 2, LUA0004: 1}}}}]);
  assert.equal(merged.selection.requestedGroups, 2); assert.equal(merged.selection.selected, 1);
  assert.equal(merged.languages.lua.sourceRequestsSubmitted, 5);
  assert.deepEqual(merged.languages.lua.analysisDiagnosticsByCode, {LUA0001: 3, LUA0004: 1});
  assert.equal(merged.completeUnderPolicy, false); assert.equal(merged.fullParsing, false);
});

test('merge rejects names, lists, unknown flags, bad keys and unsafe counts', () => {
  for (const bad of [{...counts('passed'), extra: 'private-name'}, {...counts('passed'), extra: [1]}, {...counts('passed'), extra: true},
    {...counts('passed'), 'bad key': 1}, {...counts('passed'), extra: -1}, {...counts('passed'), extra: Number.MAX_SAFE_INTEGER + 1},
    {...counts('passed'), schemaVersion: 2}, {...counts('passed'), status: 'unknown'}]) {
    assert.throws(() => mergeAggregates([bad]), {code: 'grouped-receipt'});
  }
  assert.throws(() => mergeAggregates([]), {code: 'grouped-receipt'});
  assert.throws(() => mergeAggregates([{schemaVersion: 1, status: 'passed', selection: {selected: 1}},
    {schemaVersion: 1, status: 'passed'}]), {code: 'grouped-receipt'});
  assert.throws(() => mergeAggregates([{schemaVersion: 1, status: 'passed', ['__proto__']: {x: 1}}]), {code: 'grouped-receipt'});
});

test('a failing group does not stop later groups and only that group repeats on resume', () => temporary(async base => {
  const request = requestFor(['PrivateAlpha', 'PrivateBeta', 'PrivateGamma']);
  const first = [], second = [];
  let broken = true;
  const run = (calls, resume = true) => runGroupedSelectedSources({root: base, request, receiptDirectory: base, resume,
    ...seams(name => {if (name === 'PrivateBeta' && broken) throw Object.assign(new Error('private failure text'), {code: 'SGRAPH0005'}); return counts('passed');}, calls)});
  const one = await run(first);
  assert.deepEqual(first, ['PrivateAlpha', 'PrivateBeta', 'PrivateGamma']);
  assert.equal(one.exitCode, 1); assert.equal(one.report.status, 'failed');
  assert.deepEqual(one.report.groups, {total: 3, completed: 2, threw: 1, resumed: 0, passed: 2, incomplete: 0, faulted: 0});
  assert.equal(one.report.aggregate.selection.requestedGroups, 2);
  assert.ok(fs.existsSync(path.join(base, groupFileName(0)))); assert.ok(fs.existsSync(path.join(base, groupFileName(2))));
  assert.equal(fs.existsSync(path.join(base, groupFileName(1))), false);
  const failure = JSON.parse(fs.readFileSync(path.join(base, 'group-0002.failed.json'), 'utf8'));
  assert.deepEqual(Object.keys(failure).sort(), ['code', 'digest', 'durationMilliseconds', 'index', 'kind', 'outcome', 'peakRssKiB', 'schemaVersion']);
  assert.equal(failure.code, 'SGRAPH0005');
  broken = false;
  const two = await run(second);
  assert.deepEqual(second, ['PrivateBeta']);
  assert.equal(two.exitCode, 0); assert.equal(two.report.status, 'passed');
  assert.deepEqual(two.report.groups, {total: 3, completed: 3, threw: 0, resumed: 2, passed: 3, incomplete: 0, faulted: 0});
  assert.equal(two.report.aggregate.selection.requestedGroups, 3);
  assert.equal(fs.existsSync(path.join(base, 'group-0002.failed.json')), false);
  assert.deepEqual(two.report.timing.perGroupMilliseconds.length, 3);
}));

test('receipts and the batch receipt never contain addon identities, directories or error text', () => temporary(async base => {
  const request = requestFor(['PrivateAlpha', 'PrivateBeta']);
  await runGroupedSelectedSources({root: base, request, receiptDirectory: base,
    ...seams(name => {if (name === 'PrivateBeta') throw Error('PrivateBeta failed in C:\\Users\\private'); return counts('passed');})});
  const text = fs.readdirSync(base).map(name => fs.readFileSync(path.join(base, name), 'utf8')).join('\n');
  assert.ok(text.includes('selected-source-batch'));
  for (const forbidden of ['Private', 'private', 'C:\\', 'failed in']) assert.equal(text.includes(forbidden), false, forbidden);
}));

test('a changed profile, group or runtime label invalidates old receipts; --no-resume repeats everything', () => temporary(async base => {
  const request = requestFor(['AlphaDir', 'BetaDir']);
  const run = (override = {}, calls = []) => runGroupedSelectedSources({root: base, request, receiptDirectory: base,
    ...override, ...seams(() => counts('passed'), calls)});
  await run();
  const same = []; assert.equal((await run({}, same)).report.groups.resumed, 2); assert.deepEqual(same, []);
  const labelled = []; await run({runtimeId: 'other-build'}, labelled); assert.deepEqual(labelled, ['AlphaDir', 'BetaDir']);
  const forced = []; await run({resume: false, runtimeId: 'other-build'}, forced); assert.deepEqual(forced, ['AlphaDir', 'BetaDir']);
  const changed = {...request, profile: {...request.profile, addons: [{...request.profile.addons[0], tocPaths: ['AlphaDir/AlphaDir_Mainline.toc']}, request.profile.addons[1]]}};
  const calls = [];
  await runGroupedSelectedSources({root: base, request: changed, receiptDirectory: base, runtimeId: 'other-build', ...seams(() => counts('passed'), calls)});
  assert.deepEqual(calls, ['AlphaDir']);
  assert.notEqual(groupDigest(request, request.profile.addons[0]), groupDigest(request, request.profile.addons[1]));
}));

test('tampered, wrong-index or oversized receipts are repeated and a returned fault is retried', () => temporary(async base => {
  const request = requestFor(['AlphaDir', 'BetaDir', 'GammaDir']);
  let fault = true;
  const run = calls => runGroupedSelectedSources({root: base, request, receiptDirectory: base,
    ...seams(name => (name === 'GammaDir' && fault ? counts('failed', 0, false) : counts('passed')), calls)});
  assert.equal((await run([])).report.status, 'failed');
  fs.writeFileSync(path.join(base, groupFileName(0)), '{"schemaVersion":1}');
  fs.writeFileSync(path.join(base, groupFileName(1)), ' '.repeat(1024 * 1024 + 1));
  fault = false;
  const calls = [];
  const result = await run(calls);
  assert.deepEqual(calls, ['AlphaDir', 'BetaDir', 'GammaDir']);
  assert.equal(result.report.status, 'passed');
}));

test('the receipt directory must be an absolute real directory', () => temporary(async base => {
  const request = requestFor(['AlphaDir']);
  fs.writeFileSync(path.join(base, 'file'), 'x');
  for (const receiptDirectory of ['relative', path.join(base, 'file'), path.join(base, 'missing'), '\\\\server\\share']) {
    await assert.rejects(runGroupedSelectedSources({root: base, request, receiptDirectory, ...seams(() => counts('passed'))}));
  }
}));

// Actual native end-to-end comparison on authored fixtures. Groups share no files, so the sum equals one full run.
function profiles(base, names) {
  const data = {graph: json('../docs/proposals/selected-source-graph-profile.json'), resolution: json('../examples/classic-era-resolution-profile.json'),
    xml: json('../examples/xml-provider-profile.json'), inline: json('../examples/xml-inline-lua-profile.json')};
  data.graph.addons = names.map(addon);
  const directory = path.join(base, 'profiles'); fs.mkdirSync(directory);
  const paths = Object.fromEntries(Object.keys(data).map(key => [key, path.join(directory, key + '.json')]));
  for (const [key, value] of Object.entries(data)) fs.writeFileSync(paths[key], JSON.stringify(value));
  return paths;
}
const profileArgs = paths => ['--graph-profile', paths.graph, '--resolution-profile', paths.resolution,
  '--xml-provider-profile', paths.xml, '--xml-inline-lua-profile', paths.inline];
const snapshot = root => Object.fromEntries(fs.readdirSync(root, {recursive: true}).filter(name => fs.statSync(path.join(root, name)).isFile())
  .sort().map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')]));
const execute = (script, args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', timeout: 180000, windowsHide: true});

test('actual per-group CLI sums to the same additive counts as one full run and resumes from receipts', () => temporary(async base => {
  const names = ['DemoOne', 'DemoTwo', 'DemoThree'], root = path.join(base, 'private-installation');
  for (const name of names) fs.mkdirSync(path.join(root, name), {recursive: true});
  fs.writeFileSync(path.join(root, 'DemoOne', 'DemoOne_Vanilla.toc'), '## SavedVariables: PrivateDB\nView.xml\nCore.lua\n');
  fs.writeFileSync(path.join(root, 'DemoOne', 'View.xml'), '<Ui><Script>PrivateInline=1</Script></Ui>');
  fs.writeFileSync(path.join(root, 'DemoOne', 'Core.lua'), 'PrivateGlobal=1');
  fs.writeFileSync(path.join(root, 'DemoTwo', 'DemoTwo_Vanilla.toc'), 'Two.lua\n');
  fs.writeFileSync(path.join(root, 'DemoTwo', 'Two.lua'), 'PrivateTwo=2');
  fs.writeFileSync(path.join(root, 'DemoThree', 'DemoThree_Vanilla.toc'), 'Three.lua\n');
  fs.writeFileSync(path.join(root, 'DemoThree', 'Three.lua'), 'PrivateThree=3');
  const paths = profiles(base, names), receipts = path.join(base, 'receipts'); fs.mkdirSync(receipts);
  const before = snapshot(root);
  const whole = execute(full, [root, ...profileArgs(paths), '--lua-input-profile', 'corpus-files']);
  assert.equal(whole.status, 0, whole.stderr);
  const expected = JSON.parse(whole.stdout);
  const args = [root, ...profileArgs(paths), '--receipt-directory', receipts, '--lua-input-profile', 'corpus-files'];
  const one = execute(grouped, args);
  assert.equal(one.status, 0, one.stderr); assert.equal(one.stderr, '');
  const batch = JSON.parse(one.stdout);
  assert.equal(batch.kind, 'selected-source-batch'); assert.equal(batch.aggregation, 'sum-of-per-group-runs');
  assert.deepEqual(batch.groups, {total: 3, completed: 3, threw: 0, resumed: 0, passed: 3, incomplete: 0, faulted: 0});
  assert.equal(batch.status, 'passed');
  for (const key of ['requestedGroups', 'selected', 'explicitCandidateRows', 'selectedCandidateRows']) assert.equal(batch.aggregate.selection[key], expected.selection[key], key);
  for (const language of ['toc', 'lua', 'xml']) {
    for (const key of ['eligibleSourceFiles', 'uniqueFilesRead', 'syntaxVerdictFiles', 'syntaxAcceptedFiles', 'sourceRequestsSubmitted', 'sourceRequestsCompleted']) {
      assert.equal(batch.aggregate.languages[language][key], expected.languages[language][key], `${language}.${key}`);
    }
  }
  assert.equal(batch.aggregate.confirmedApiCalls.analyzeLua.returned, expected.confirmedApiCalls.analyzeLua.returned);
  assert.equal(batch.aggregate.resolution.declarations, expected.resolution.declarations);
  assert.equal(batch.aggregate.inlineLua.attemptedBodies, expected.inlineLua.attemptedBodies);
  assert.equal(fs.readdirSync(receipts).filter(name => /^group-\d{4}\.json$/u.test(name)).length, 3);
  const text = fs.readdirSync(receipts).map(name => fs.readFileSync(path.join(receipts, name), 'utf8')).join('\n');
  for (const forbidden of ['Demo', 'Private', 'Core.lua', 'View.xml', root, base]) assert.equal(text.includes(forbidden), false, forbidden);
  // Resume: nothing is repeated, then one removed receipt repeats exactly one group.
  const again = JSON.parse(execute(grouped, args).stdout);
  assert.equal(again.groups.resumed, 3); assert.deepEqual(again.aggregate, batch.aggregate);
  fs.rmSync(path.join(receipts, groupFileName(1)));
  const partial = JSON.parse(execute(grouped, args).stdout);
  assert.equal(partial.groups.resumed, 2); assert.deepEqual(partial.aggregate, batch.aggregate);
  const forced = JSON.parse(execute(grouped, [...args, '--no-resume']).stdout);
  assert.equal(forced.groups.resumed, 0); assert.deepEqual(forced.aggregate, batch.aggregate);
  assert.deepEqual(snapshot(root), before);
}));

test('per-group CLI requires the receipt directory and the exact flag set', () => temporary(async base => {
  const root = path.join(base, 'installation'); fs.mkdirSync(path.join(root, 'DemoOne'), {recursive: true});
  const paths = profiles(base, ['DemoOne']), receipts = path.join(base, 'receipts'); fs.mkdirSync(receipts);
  const valid = [root, ...profileArgs(paths), '--receipt-directory', receipts];
  const failure = {status: 2, stdout: '', stderr: 'Invalid selected-source graph input.\n'};
  for (const bad of [valid.slice(0, -2), [...valid, '--receipt-directory', receipts], [...valid, '--output', 'x'], [...valid, '--runtime-id', 'bad id'],
    [...valid, '--lua-input-profile', 'bounded'], ['relative', ...valid.slice(1)], [...valid, '--no-resume', '--no-resume']]) {
    const result = execute(grouped, bad);
    assert.deepEqual({status: result.status, stdout: result.stdout, stderr: result.stderr}, failure);
  }
}));
