/** Compare maintained and prototype launchers through the real graph on authored files. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {prepareGraphContext, getGraphRequest} from '../../scripts/selected-source-context.mjs';
import {analyzeSelectedSourceAggregate} from '../../scripts/selected-source-graph.mjs';
import {createSelectedSourceHost} from '../../scripts/selected-source-host.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const revision = 'a3d3b0545d0f3984eda718cec01a93330f26c73a';
const patchPath = 'tests/fixtures/launcher-reuse-prototype/prototype.patch';

function profile(filename) {
  return JSON.parse(fs.readFileSync(new URL(filename, import.meta.url), 'utf8'));
}

async function preparePrototype(scratch) {
  const sandbox = path.join(scratch, 'launcher');
  fs.mkdirSync(sandbox);
  fs.cpSync(path.join(repository, 'scripts'), path.join(sandbox, 'scripts'), {recursive: true});
  fs.cpSync(path.join(repository, 'docs', 'workbench'), path.join(sandbox, 'docs', 'workbench'), {recursive: true});
  fs.symlinkSync(path.join(repository, 'node_modules'), path.join(sandbox, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir');
  for (const role of ['client', 'worker']) {
    fs.copyFileSync(path.join(sandbox, 'scripts', 'selected-source-analysis-' + role + '.mjs'),
      path.join(sandbox, 'scripts', 'prototype-analysis-' + role + '.mjs'));
  }
  const patch = execFileSync('git', ['show', revision + ':' + patchPath], {cwd: repository, windowsHide: true});
  execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '-p0'], {cwd: sandbox, input: patch, windowsHide: true});
  const modulePath = path.join(sandbox, 'scripts', 'selected-source-host.mjs');
  const source = fs.readFileSync(modulePath, 'utf8');
  const importName = './selected-source-analysis-client.mjs';
  assert.equal(source.split(importName).length, 2);
  // Keep the production native file port and its shared budget/context identity.
  let prototypeHost = source.replace(importName, './prototype-analysis-client.mjs');
  for (const file of ['selected-source-native.mjs', 'selected-source-budget.mjs']) {
    prototypeHost = prototypeHost.replace('./' + file, new URL('../../scripts/' + file, import.meta.url).href);
  }
  fs.writeFileSync(modulePath, prototypeHost);
  return (await import(pathToFileURL(modulePath).href)).createSelectedSourceHost;
}

function populate(root, smoke) {
  const graph = profile('./selected-source-graph-profile.json');
  const resolution = profile('../../examples/classic-era-resolution-profile.json');
  const xml = profile('../../examples/xml-provider-profile.json');
  const inlineProfile = profile('../../examples/xml-inline-lua-profile.json');
  const files = new Map();
  const hash = content => createHash('sha256').update(content).digest('hex');
  const write = (directory, filename, content) => {
    const absolute = path.join(directory, filename);
    fs.writeFileSync(absolute, content, {flag: 'wx'});
    files.set(absolute, hash(content));
  };

  graph.addons = Array.from({length: smoke ? 1 : 4}, (_, group) => {
    const name = 'Authored' + group;
    const dir = path.join(root, name);
    const nested = path.join(dir, 'UI');
    fs.mkdirSync(nested, {recursive: true});
    const lua = Array.from({length: smoke ? 1 : group === 0 ? 34 : 5}, (_, index) => {
      const file = 'Chunk' + index + '.lua';
      const prefix = 'Authored' + group + 'Chunk' + index;
      const body = Array.from({length: 16}, (_, declaration) =>
        prefix + 'Value' + declaration + ' = ' + declaration).join('\r\n');
      write(dir, file, '-- authored 🙂\r\n' + body);
      return file;
    });
    for (let index = 0; index < 3; index++) {
      const body = '<Frame name="AuthoredFrame' + group + '_' + index + '"><Scripts><OnLoad>' +
        'AuthoredLoad' + group + '_' + index + ' = self' +
        '</OnLoad></Scripts></Frame>';
      write(nested, 'View' + index + '.xml',
        '<Ui>\r\n<!--🙂-->' + body + '<Script>AuthoredInline' + group + '_' + index + ' = 1</Script>\r\n</Ui>');
    }
    const toc = name + '_Vanilla.toc';
    const unselected = name + '_Mainline.toc';
    write(dir, toc, '## Interface: 11509\r\n## SavedVariables: AuthoredDB' + group + '\r\n' +
      [...lua, 'UI\\View0.xml', 'UI\\View1.xml', 'UI\\View2.xml', lua[0]].join('\r\n') + '\r\n');
    write(dir, unselected, '## Interface: 110000\r\n## Title: Authored branch\r\n');
    return {logicalAddonId: 'authored/' + name.toLowerCase(), directory: name, addonBaseName: name,
      tocPaths: [name + '/' + toc, name + '/' + unselected]};
  });
  const request = {profile: graph, environment: resolution.environment, selectionPolicy: resolution.selectionPolicy,
    conditionPolicy: resolution.conditionPolicy, xmlPolicy: xml.policy, inlineProfile, luaInputProfile: 'corpus-files'};
  return {request, files, hash};
}

function measureHost(host, replyDigest) {
  const counts = Object.create(null);
  for (const name of ['listDirectory', 'readSource', 'analyze', 'verifySource', 'verifyDirectory', 'close']) {
    const method = host[name].bind(host);
    host[name] = async (...args) => {
      const phase = name === 'analyze' ? name + '.' + args[0].language : name;
      counts[phase] ??= {count: 0, wallMs: 0};
      const start = performance.now();
      let output;
      try {
        output = await method(...args);
        return output;
      } catch (error) {
        if (name === 'analyze') {
          const code = /^graph-analysis-[a-z-]+$/u.test(error?.message) ? error.message : 'other';
          const row = counts[phase];
          row.errors ??= {};
          row.errors[code] = (row.errors[code] ?? 0) + 1;
        }
        throw error;
      } finally {
        counts[phase].wallMs += performance.now() - start;
        counts[phase].count++;
        if (name === 'analyze' && output !== undefined) replyDigest.update(JSON.stringify(output));
        if (name === 'verifyDirectory' && output === true) counts[phase].matching = (counts[phase].matching ?? 0) + 1;
      }
    };
  }
  return counts;
}

async function measure(mode, createHost, root, {request, files, hash}) {
  const context = prepareGraphContext(request);
  assert.equal(getGraphRequest(context).profile.limits.operationMilliseconds, 900_000);
  const opens = new Map();
  const io = {...fs, openSync(filename, flags, ...options) {
    assert.equal(typeof flags, 'number');
    assert.equal(flags & ~fs.constants.O_NOFOLLOW, fs.constants.O_RDONLY);
    assert.ok(files.has(filename), 'source open must match an authored file');
    const descriptor = fs.openSync(filename, flags, ...options);
    opens.set(filename, (opens.get(filename) ?? 0) + 1);
    return descriptor;
  }};
  const start = performance.now();
  const failures = Object.create(null);
  const onFailure = row => {
    const key = JSON.stringify([row.operation, row.code, row.check]);
    failures[key] = (failures[key] ?? 0) + 1;
  };
  const host = await createHost(root, context, {io, onFailure});
  const digest = createHash('sha256');
  const phases = measureHost(host, digest);
  const aggregate = await analyzeSelectedSourceAggregate(request, host);
  const elapsedMs = Math.round(performance.now() - start);
  // XML declarations carry an unknown activation in this policy fixture.
  assert.equal(aggregate.status, 'incomplete', JSON.stringify({mode, elapsedMs, phases, failures, aggregate}));
  assert.equal(aggregate.completeUnderPolicy, false);
  assert.equal(aggregate.resolution.availability.unknown, request.profile.addons.length * 6);
  assert.equal(aggregate.resolution.eligibleGroups, request.profile.addons.length);
  assert.equal(aggregate.discovery.complete, true);
  const directories = 1 + request.profile.addons.length * 2;
  assert.equal(phases.verifyDirectory.count, directories);
  assert.equal(phases.verifyDirectory.matching, directories);
  assert.equal(phases.verifySource.count, files.size);
  assert.equal(phases.close.count, 1);
  assert.equal(opens.size, files.size);
  for (const [filename, fingerprint] of files) {
    assert.equal(opens.get(filename), 2);
    assert.equal(hash(fs.readFileSync(filename)), fingerprint);
  }
  assert.equal(aggregate.inlineLua.attemptedBodies, request.profile.addons.length * 6);
  assert.equal(aggregate.languages.lua.reusedAnalyses, request.profile.addons.length);
  for (const language of ['toc', 'lua', 'xml']) {
    const count = [...files.keys()].filter(filename => path.extname(filename) === '.' + language).length;
    const result = aggregate.languages[language];
    assert.equal(result.sourceRequestsSubmitted, count);
    assert.equal(result.sourceRequestsCompleted, count);
    assert.equal(result.syntaxAcceptedFiles, count);
    assert.equal(result.invariantFailures, 0);
    assert.deepEqual(result.sourceIntegrity, {checked: count, matching: count, changed: 0, verificationFailures: 0});
  }
  for (const row of Object.values(phases)) row.wallMs = Math.round(row.wallMs);
  return {mode, elapsedMs, phases, replyDigest: digest.digest('hex'), aggregate};
}

const [option, ...extra] = process.argv.slice(2);
assert.ok((option === undefined || option === '--stock' || option === '--smoke' || option === '--ab') && extra.length === 0, 'Expected zero arguments, --stock, --smoke or --ab.');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-authored-stage7-'));
const root = path.join(scratch, 'AddOns');
const fixture = populate(root, option === '--smoke');
const stock = createSelectedSourceHost;
const candidate = option === '--stock' ? null : await preparePrototype(scratch);
const series = candidate ? (option === '--smoke' || option === '--ab' ? [['stock', stock], ['split', candidate]] :
  [['stock', stock], ['split', candidate], ['split', candidate], ['stock', stock]]) : [['stock', stock]];
let baseline;
const measurements = [];
for (const [mode, createHost] of series) {
  const row = await measure(mode, createHost, root, fixture);
  if (baseline) {
    assert.deepEqual(row.aggregate, baseline.aggregate);
    assert.equal(row.replyDigest, baseline.replyDigest);
  } else baseline = row;
  measurements.push({mode, elapsedMs: row.elapsedMs, phases: row.phases});
  process.stderr.write(mode + ' completed with final integrity\n');
}
console.log(JSON.stringify({node: process.version, platform: process.platform,
  prototype: candidate && revision, measurements, aggregate: baseline.aggregate}, null, 2));
assert.equal(path.dirname(fs.realpathSync(scratch)), fs.realpathSync(os.tmpdir()));
assert.ok(path.basename(scratch).startsWith('wow-sdk-authored-stage7-'));
if (candidate) fs.unlinkSync(path.join(scratch, 'launcher', 'node_modules'));
fs.rmSync(scratch, {recursive: true});
