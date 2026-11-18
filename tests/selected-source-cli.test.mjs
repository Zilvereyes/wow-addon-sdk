import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {EventEmitter, once} from 'node:events';
import {PassThrough} from 'node:stream';
import {setImmediate} from 'node:timers/promises';

const command = fileURLToPath(new URL('../scripts/inspect-selected-addon-sources.mjs', import.meta.url));
const json = filename => JSON.parse(fs.readFileSync(new URL(filename, import.meta.url), 'utf8'));
class UnconfirmedCliClose extends Error {}

function execute(args, {spawnProcess = spawn, timeoutMs = 120000, reapMs = 10000} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(process.execPath, [command, ...args], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '', failure, reapTimer;
    const deadline = setTimeout(() => stop(Error('Authored CLI test exceeded its deadline.'), true), timeoutMs);
    function stop(error, terminate) {
      if (failure) return;
      failure = error;
      clearTimeout(deadline);
      reapTimer = setTimeout(() => {
        reject(new UnconfirmedCliClose('Authored CLI child did not close. Fixture retained.', {cause: failure}));
        child.stdout.destroy(); child.stderr.destroy(); child.unref();
      }, reapMs);
      if (terminate) {
        try {child.kill('SIGKILL');} catch { /* Close is required even if signalling fails. */ }
      }
    }
    const collect = key => data => {
      if (failure) return;
      const text = data.toString('utf8');
      if (stdout.length + stderr.length + text.length > 1024 * 1024) {
        stop(Error('Authored CLI child did not complete.'), true);
      } else if (key === 'stdout') stdout += text;
      else stderr += text;
    };
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'));
    child.on('error', error => stop(error, false));
    child.once('close', (code, signal) => {
      clearTimeout(deadline); clearTimeout(reapTimer);
      if (failure || signal) reject(failure ?? Error('Authored CLI child did not complete.'));
      else resolve({code, stdout, stderr});
    });
  });
}
function removeFixture(base) {
  assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
  assert.ok(path.basename(base).startsWith('wow-sdk-graph-cli-'));
  fs.rmSync(base, {recursive: true, force: true});
}
async function fixture(run) {
  const temporary = path.resolve(os.tmpdir()), base = fs.mkdtempSync(path.join(temporary, 'wow-sdk-graph-cli-'));
  const root = path.join(base, 'private-installation'), profiles = path.join(base, 'profiles');
  fs.mkdirSync(path.join(root, 'Demo'), {recursive: true}); fs.mkdirSync(profiles);
  const data = {graph: json('../docs/proposals/selected-source-graph-profile.json'), resolution: json('../examples/classic-era-resolution-profile.json'),
    xml: json('../examples/xml-provider-profile.json'), inline: json('../examples/xml-inline-lua-profile.json')};
  data.graph.addons[0].tocPaths = ['Demo/Demo_Vanilla.toc'];
  const paths = Object.fromEntries(Object.keys(data).map(key => [key, path.join(profiles, key + '.json')]));
  const writeProfiles = () => {for (const [key, value] of Object.entries(data)) fs.writeFileSync(paths[key], JSON.stringify(value));};
  writeProfiles();
  const args = () => [root, '--graph-profile', paths.graph, '--resolution-profile', paths.resolution,
    '--xml-provider-profile', paths.xml, '--xml-inline-lua-profile', paths.inline];
  const write = (name, content) => fs.writeFileSync(path.join(root, 'Demo', name), content);
  let confirmedClose = true;
  try {await run({base, root, data, paths, args, writeProfiles, write});}
  catch (error) {confirmedClose = !(error instanceof UnconfirmedCliClose); throw error;}
  finally {if (confirmedClose) removeFixture(base);}
}
const invalid = result => {assert.deepEqual(result, {code: 2, stdout: '', stderr: 'Invalid selected-source graph input.\n'});};

function fakeCliChild(kill) {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = kill; child.unref = () => {};
  return child;
}

test('CLI timeout preserves fixture files until the child closes', async () => {
  const child = fakeCliChild(signal => {child.emit('kill-requested', signal); return true;});
  const stopping = once(child, 'kill-requested');
  let base;
  const completed = assert.rejects(fixture(({base: directory, args}) => {
    base = directory;
    return execute(args(), {spawnProcess: () => child, timeoutMs: 0});
  }), /exceeded its deadline/u);
  try {
    assert.deepEqual(await stopping, ['SIGKILL']);
    await setImmediate();
    assert.ok(fs.existsSync(base), 'fixture must outlive the child');
  } finally {
    child.emit('close', null, 'SIGKILL');
    await completed;
  }
  assert.equal(fs.existsSync(base), false);
});

test('CLI spawn errors also wait for close before removing fixture files', async () => {
  const child = fakeCliChild(() => assert.fail('spawn error needs no termination signal'));
  const failure = Error('Authored spawn error');
  let base;
  const completed = assert.rejects(fixture(({base: directory, args}) => {
    base = directory;
    return execute(args(), {spawnProcess: () => child});
  }), error => error === failure);
  try {
    child.emit('error', failure);
    await setImmediate();
    assert.ok(fs.existsSync(base));
  } finally {
    child.emit('close', -1, null);
    await completed;
  }
  assert.equal(fs.existsSync(base), false);
});

test('CLI unconfirmed reap fails the test while retaining its authored fixture', async () => {
  const child = fakeCliChild(() => false);
  let base;
  try {
    await assert.rejects(fixture(({base: directory, args}) => {
      base = directory;
      return execute(args(), {spawnProcess: () => child, timeoutMs: 0, reapMs: 0});
    }), error => error instanceof UnconfirmedCliClose && /exceeded its deadline/u.test(error.cause?.message));
    assert.ok(fs.existsSync(base));
    assert.equal(child.stdout.destroyed, true);
    assert.equal(child.stderr.destroyed, true);
  } finally {
    child.emit('close', null, 'SIGKILL');
    if (base) removeFixture(base);
  }
});

test('CLI requires one absolute local root and the exact four unique profile flags', () => fixture(async ({args}) => {
  const valid = args();
  for (const bad of [[], valid.slice(0, -2), [...valid, '--graph-profile', 'again'], [...valid, '--selection-profile', 'other'],
    [...valid, '--output', 'destination'], [...valid, '--lua-input-profile', 'bounded'], [...valid, '--lua-input-profile'],
    ['relative', ...valid.slice(1)], ['C:relative', ...valid.slice(1)], ['\\\\server\\share', ...valid.slice(1)],
    ['file:///private/source', ...valid.slice(1)]]) invalid(await execute(bad));
}));

test('all profiles fail closed before host creation for invalid UTF-8, oversize JSON or rejected policy', () => fixture(async ({args, paths, data, writeProfiles}) => {
  for (const key of Object.keys(paths)) {
    fs.writeFileSync(paths[key], Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d])); invalid(await execute(args())); writeProfiles();
    fs.writeFileSync(paths[key], ' '.repeat(1024 * 1024 + 1)); invalid(await execute(args())); writeProfiles();
  }
  data.graph.unapproved = true; writeProfiles(); invalid(await execute(args())); delete data.graph.unapproved;
  data.xml.policy.handlerElements = [{namespaceUri: null, localName: ''}]; writeProfiles(); invalid(await execute(args()));
}));

test('actual native CLI emits counts only, exercises all parsers and leaves authored source bytes unchanged', () => fixture(async ({args, root, write}) => {
  write('Demo_Vanilla.toc', '## SavedVariables: PrivateDB\nView.xml\nPrivateCore.lua\n');
  write('View.xml', '<Ui><Script>PrivateInline=1</Script></Ui>'); write('PrivateCore.lua', 'PrivateGlobal=1');
  write('PrivateUnused.lua', 'error("must never execute")');
  const snapshot = () => Object.fromEntries(fs.readdirSync(path.join(root, 'Demo')).map(name => [name,
    createHash('sha256').update(fs.readFileSync(path.join(root, 'Demo', name))).digest('hex')]));
  const before = snapshot(), result = await execute([...args(), '--lua-input-profile', 'corpus-files']);
  assert.equal(result.code, 0, result.stderr); assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout); assert.equal(report.status, 'passed'); assert.equal(report.completeUnderPolicy, true);
  assert.equal(report.fullParsing, false); assert.equal(report.clientConformance, false);
  assert.deepEqual(report.discovery.found, {toc: 1, lua: 2, xml: 1});
  for (const language of ['toc', 'lua', 'xml']) assert.equal(report.languages[language].syntaxVerdictFiles, 1);
  assert.equal(report.confirmedApiCalls.analyzeLua.returned, 2); assert.equal(report.inlineLua.attemptedBodies, 1);
  assert.equal(report.resolution.declarations, 3);
  assert.deepEqual(Object.keys(report).sort(), ['schemaVersion', 'status', 'completeUnderPolicy', 'fullParsing', 'clientConformance', 'discovery',
    'selection', 'languages', 'confirmedApiCalls', 'graph', 'inlineLua', 'resolution', 'issuesByCode'].sort());
  for (const privateValue of [root, 'PrivateDB', 'PrivateInline', 'PrivateGlobal', 'PrivateCore', 'Demo/', 'Demo\\', 'authored/demo']) assert.equal(result.stdout.includes(privateValue), false);
  assert.deepEqual(snapshot(), before);
}));

test('valid incomplete native analysis emits an honest aggregate and exits one', () => fixture(async ({args, data, writeProfiles, write}) => {
  data.inline.handlers = []; writeProfiles();
  write('Demo_Vanilla.toc', 'View.xml');
  write('View.xml', '<Ui><Frame><Scripts><OnLoad>PrivateMissing=1</OnLoad></Scripts></Frame></Ui>');
  const result = await execute(args()); assert.equal(result.code, 1); assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout); assert.equal(report.completeUnderPolicy, false); assert.equal(report.status, 'incomplete');
  assert.equal(report.inlineLua.skippedMissingContext, 1); assert.equal(report.resolution.coreComplete, true);
  assert.equal(result.stdout.includes('PrivateMissing'), false);
}));

test('an exhausted operation produces fixed safe failure text without a fabricated aggregate', () => fixture(async ({args, data, writeProfiles, write}) => {
  data.graph.limits = {retainedRecords: 1}; writeProfiles(); write('Demo_Vanilla.toc', '');
  assert.deepEqual(await execute(args()), {code: 1, stdout: '', stderr: 'Selected-source graph analysis failed.\n'});
}));
