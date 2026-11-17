import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repository = process.cwd();
const packages = ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry', 'toc-metadata-adapter', 'lua-analysis', 'xml-parser'];
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

// Run the actual CLI and worker scripts in an isolated workspace. Only these
// authored wrapper packages can alter returned records; installed SDK bytes
// and the production CLI/worker interfaces remain untouched.
function fixture(run) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-accounting-'));
  try {
    const scripts = path.join(workspace, 'scripts');
    const scope = path.join(workspace, 'node_modules', '@wow-addon');
    const root = path.join(workspace, 'private-corpus');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(scope, { recursive: true });
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(workspace, 'package.json'), '{"type":"module"}');
    for (const name of fs.readdirSync(path.join(repository, 'scripts')).filter(name => name.endsWith('.mjs'))) {
      fs.copyFileSync(path.join(repository, 'scripts', name), path.join(scripts, name));
    }
    for (const name of packages) {
      const target = path.join(scope, name);
      const real = path.join(repository, 'packages', name);
      if (!['toc-parser', 'lua-analysis'].includes(name)) {
        fs.symlinkSync(real, target, process.platform === 'win32' ? 'junction' : 'dir');
        continue;
      }
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: '@wow-addon/' + name,
        type: 'module', exports: { '.': './index.mjs' } }));
      const api = pathToFileURL(path.join(real, 'dist', 'index.js')).href;
      const source = name === 'toc-parser' ? `
import { parseToc as real } from ${JSON.stringify(api)};
export function parseToc(content, filename, options) {
  if (filename.endsWith('private-backend-throws.toc')) throw new Error('private-authored-backend-error');
  const result = real(content, filename, options);
  if (filename.endsWith('private-bad-schema.toc')) result.metadata.schemaVersion = 999;
  if (filename.endsWith('private-bad-source.toc')) result.entries[0].source.range.end.column = content.length + 1;
  return result;
}` : `
import { analyzeLua as real } from ${JSON.stringify(api)};
export function analyzeLua(content, filename, options) {
  const result = real(content, filename, options);
  if (filename.endsWith('private-bad-kind.lua') || filename.endsWith('private-bad-activation.lua')) {
    const late = result.declarations[1];
    if (filename.endsWith('private-bad-kind.lua')) late.kind = 'frame';
    else late.activationState = 'private-invalid-state';
    result.complete = false;
    result.diagnostics.push({ code: 'LUA0004', severity: 'warning', message: 'private-uncredited-diagnostic', source: late.source });
  }
  return result;
}`;
      fs.writeFileSync(path.join(target, 'index.mjs'), source);
    }
    const write = (name, content) => { const filename = path.join(root, name); fs.writeFileSync(filename, content); return filename; };
    const inspect = (args = [], blockedReads = [], sourceRoot = root) => {
      const flags = [];
      if (blockedReads.length) {
        const preload = path.join(workspace, 'trusted-read-failure.mjs');
        fs.writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const blocked = new Set(${JSON.stringify(blockedReads)});
const original = fs.openSync;
fs.openSync = function(filename, ...args) {
  if (typeof filename === 'string' && blocked.has(filename)) {
    const error = new Error('private-authored-read-failure'); error.code = 'EACCES'; throw error;
  }
  return original.call(this, filename, ...args);
};
syncBuiltinESMExports();`);
        flags.push('--import', pathToFileURL(preload).href);
      }
      const result = spawnSync(process.execPath, [...flags, path.join(scripts, 'inspect-addon-corpus.mjs'), sourceRoot, ...args],
        { cwd: workspace, encoding: 'utf8', windowsHide: true });
      assert.equal(result.error, undefined);
      assert.equal(result.stderr, '');
      const report = JSON.parse(result.stdout);
      for (const secret of [workspace, root, 'private-bad-', 'private-invalid-state', 'private-uncredited-diagnostic',
        'private-authored-read-failure', 'private-backend-throws', 'private-authored-backend-error']) {
        assert.equal((result.stdout + result.stderr).includes(secret), false, 'CLI output remains aggregate');
      }
      return { ...result, report };
    };
    run({ workspace, root, write, inspect });
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}

function tocCounts(report, changes = {}) {
  assert.deepEqual(report.tocAnalysis, { complete: true, discoveryComplete: true, discovered: 1, attempted: 1,
    submitted: 1, completed: 1, accepted: 1, rejected: 0, skippedOversized: 0, resourceRejected: 0,
    readFailures: 0, backendFailures: 0, invariantFailures: 0, inputBytes: 1, ...changes });
}

test('TOC accounting distinguishes clean and malformed syntax verdicts from oversized files', () => {
  for (const kind of ['clean', 'syntax', 'oversized']) fixture(({ write, inspect }) => {
    const content = kind === 'clean' ? '#' : kind === 'syntax' ? '## private-missing-colon' : '#'.repeat(100);
    const filename = write('private-control.toc', content), before = digest(filename);
    const result = inspect(kind === 'oversized' ? ['--max-file-bytes', '32'] : []);
    assert.equal(result.status, kind === 'clean' ? 0 : 1);
    assert.equal(result.report.status, kind === 'clean' ? 'passed' : kind === 'syntax' ? 'failed' : 'incomplete');
    tocCounts(result.report, kind === 'oversized' ? { complete: false, submitted: 0, completed: 0, accepted: 0,
      skippedOversized: 1, resourceRejected: 1, inputBytes: 0 } : kind === 'syntax' ?
      { complete: false, accepted: 0, rejected: 1, inputBytes: Buffer.byteLength(content) } : {});
    assert.equal(result.report.parsed.toc, kind === 'oversized' ? 0 : 1);
    if (kind === 'syntax') assert.equal(result.report.diagnosticsByCode.TOC0001, 1);
    assert.equal(digest(filename), before);
  });
});

test('invalid returned TOC projections and late Lua declarations receive no verdict or partial output credit', () => fixture(({ write, inspect }) => {
  const authored = [
    ['private-good.toc', '## SavedVariables: Good'],
    ['private-bad-schema.toc', '## SavedVariables: BadSchema'],
    ['private-bad-source.toc', '## SavedVariables: BadSource'],
    ['private-good.lua', 'GoodLua = 1'],
    ['private-bad-kind.lua', 'FirstKind = 1; LaterKind = 2'],
    ['private-bad-activation.lua', 'FirstActivation = 1; LaterActivation = 2'],
  ];
  const files = authored.map(([name, content]) => { const filename = write(name, content); return [filename, digest(filename)]; });
  const result = inspect(['--lua-analysis']);
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  tocCounts(result.report, { complete: false, discovered: 3, attempted: 3, submitted: 3, completed: 3,
    invariantFailures: 2, inputBytes: authored.filter(([name]) => name.endsWith('.toc')).reduce((sum, [, content]) => sum + Buffer.byteLength(content), 0) });
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 1, xml: 0 });
  assert.equal(result.report.savedVariableDeclarations, 1);
  assert.equal(result.report.adapterDeclarations, 1);
  assert.deepEqual(result.report.diagnosticsByCode, {});
  const lua = result.report.luaAnalysis;
  assert.equal(lua.discoveryComplete, true);
  assert.equal(lua.complete, false);
  for (const field of ['attempted', 'submitted', 'completed']) assert.equal(lua[field], 3, field);
  assert.equal(lua.invariantFailures, 2);
  assert.equal(lua.syntaxAccepted, 1);
  assert.equal(lua.syntaxRejected, 0);
  assert.equal(lua.incompleteFiles, 0);
  assert.equal(lua.declarations, 1);
  assert.equal(lua.checkedSourceReferences, 1, 'invalid late declarations must not credit earlier source references');
  assert.deepEqual(lua.activation, { unconditional: 1, conditional: 0, unknown: 0 });
  assert.deepEqual(lua.diagnosticsByCode, {});
  assert.equal(lua.backendFailures, 0);
  assert.equal(lua.readFailures, 0);
  assert.ok(result.report.failures.includes('toc-invariant-failure'));
  assert.ok(result.report.failures.includes('lua-invariant-failure'));
  for (const [filename, before] of files) assert.equal(digest(filename), before);
}));

test('a TOC parser throw counts as submitted backend failure without a completed verdict or leaked error', () => fixture(({ write, inspect }) => {
  const good = write('private-good.toc', '#');
  const content = '## SavedVariables: PrivateBackendNeverParsed';
  const throwing = write('private-backend-throws.toc', content);
  const before = [digest(good), digest(throwing)];
  const result = inspect();
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  tocCounts(result.report, { complete: false, discovered: 2, attempted: 2, submitted: 2, completed: 1,
    backendFailures: 1, inputBytes: 1 + Buffer.byteLength(content) });
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 0, xml: 0 });
  assert.equal(result.report.savedVariableDeclarations, 0);
  assert.equal(result.report.adapterDeclarations, 0);
  assert.deepEqual(result.report.diagnosticsByCode, {});
  assert.deepEqual(result.report.failures, ['toc-backend-failure']);
  assert.deepEqual([digest(good), digest(throwing)], before);
}));

test('two exact-path read failures stay distinct from submitted parser work and preserve sources', () => fixture(({ write, inspect }) => {
  write('private-good.toc', '#');
  write('private-good.lua', 'GoodLua = 1');
  const deniedToc = write('private-denied.toc', '## SavedVariables: PrivateNeverRead');
  const deniedLua = write('private-denied.lua', 'PrivateNeverRead = 1');
  const before = [digest(deniedToc), digest(deniedLua)];
  const result = inspect(['--lua-analysis'], [deniedToc, deniedLua]);
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  tocCounts(result.report, { complete: false, discovered: 2, attempted: 2, readFailures: 1 });
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 1, xml: 0 });
  const lua = result.report.luaAnalysis;
  assert.equal(lua.discoveryComplete, true);
  assert.equal(lua.complete, false);
  assert.equal(lua.attempted, 2);
  assert.equal(lua.submitted, 1);
  assert.equal(lua.completed, 1);
  assert.equal(lua.readFailures, 1);
  assert.equal(lua.invariantFailures, 0);
  assert.equal(lua.backendFailures, 0);
  assert.equal(lua.syntaxAccepted, 1);
  assert.equal(lua.declarations, 1);
  assert.deepEqual(lua.diagnosticsByCode, {});
  assert.ok(result.report.failures.includes('toc-read-failure'));
  assert.ok(result.report.failures.includes('lua-read-failure'));
  assert.deepEqual([digest(deniedToc), digest(deniedLua)], before);
}));

test('TOC and Lua discovery flags stay false when entry limits, missing roots or profile preflight block traversal', () => fixture(({ workspace, root, write, inspect }) => {
  write('private-control.toc', '#');
  write('private-control.lua', 'GoodLua = 1');
  const profile = path.join(workspace, 'private-invalid-profile.json');
  fs.writeFileSync(profile, '{}');
  for (const [args, sourceRoot] of [
    [['--lua-analysis', '--max-entries', '1'], root],
    [['--lua-analysis'], path.join(root, 'private-missing')],
    [['--lua-analysis', '--resolution-profile', profile], root],
  ]) {
    const result = inspect(args, [], sourceRoot);
    assert.equal(result.status, 1);
    tocCounts(result.report, { complete: false, discoveryComplete: false, discovered: 0, attempted: 0,
      submitted: 0, completed: 0, accepted: 0, inputBytes: 0 });
    assert.equal(result.report.luaAnalysis.discoveryComplete, false);
    assert.equal(result.report.luaAnalysis.complete, false);
    assert.equal(result.report.luaAnalysis.attempted, 0);
    assert.equal(result.report.luaAnalysis.invariantFailures, 0);
    assert.deepEqual(result.report.parsed, { toc: 0, lua: 0, xml: 0 });
  }
}));
