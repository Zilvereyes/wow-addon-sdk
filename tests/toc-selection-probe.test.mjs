import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseToc } from '@wow-addon/toc-parser';
import { runTestNode } from './test-node.mjs';

const script = path.resolve('scripts/create-toc-selection-probe.mjs');
function temporary(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-probe-'));
  try { run(root); } finally {
    assert.ok(path.resolve(root).startsWith(path.join(path.resolve(os.tmpdir()), 'wow-sdk-probe-')));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function generate(out, version = '11508', ...extra) {
  return runTestNode([script, out, version, ...extra]);
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function readProbeFile(root, relativePath) {
  const segments = relativePath.split('/');
  assert.ok(segments.every(segment => segment && segment !== '.' && segment !== '..' && !/[\\:\0]/u.test(segment)),
    'probe path must use portable relative components');
  const canonicalRoot = fs.realpathSync(root);
  const file = fs.realpathSync(path.join(canonicalRoot, ...segments));
  const fromRoot = path.relative(canonicalRoot, file);
  assert.ok(fromRoot && !path.isAbsolute(fromRoot) && fromRoot.split(path.sep)[0] !== '..',
    'canonical probe file must be inside its fixture');
  assert.ok(fs.statSync(file).isFile(), 'probe output must be a file');
  return fs.readFileSync(file);
}

test('test subprocess reports a deadline separately from a child exit code', () => {
  assert.throws(() => runTestNode(['--eval', 'setTimeout(() => {}, 30000)'], 200), { code: 'ETIMEDOUT' });
  assert.equal(runTestNode(['--eval', 'process.exitCode = 2']).status, 2);
});

test('probe generation produces a complete hashed matrix without asserting observed winners', () => temporary(root => {
  const out = path.join(root, 'new-probe');
  const result = generate(out);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /wow-sdk-probe-/);
  const manifest = JSON.parse(readProbeFile(out, 'probe.ready.json').toString('utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.interfaceVersion, '11508');
  assert.equal(manifest.runtimeVerified, false);
  assert.equal(manifest.scenarios.length, 8);
  assert.ok(manifest.scenarios.every(s => !Object.hasOwn(s, 'winner')));
  assert.deepEqual(manifest.scenarios.find(s => s.id === 'EraAll').suffixes, ['Vanilla', 'Classic', null]);
  assert.deepEqual(manifest.scenarios.find(s => s.id === 'MainlineAll').suffixes, ['Standard', 'Mainline', null]);
  assert.deepEqual(manifest.scenarios.find(s => s.id === 'FutureFallback').suffixes, ['SDKFuture', null]);
  const paths = new Set();
  for (const item of manifest.files) {
    assert.equal(paths.has(item.path), false);
    paths.add(item.path);
    const bytes = readProbeFile(out, item.path);
    assert.equal(bytes.length, item.bytes);
    assert.equal(digest(bytes), item.sha256);
    if (item.path.endsWith('.toc')) {
      const parsed = parseToc(bytes.toString('utf8'), item.path);
      // The heading case deliberately captures current strict parser diagnostics.
      if (item.path.includes('SDKProbe_Headings/')) assert.equal(parsed.diagnostics.filter(d => d.code === 'TOC0001').length, 2);
      else assert.deepEqual(parsed.diagnostics, [], item.path);
      assert.deepEqual(parsed.metadata.interfaceVersions, ['11508']);
      assert.equal(parsed.metadata.files.length, 1);
      const markerPath = path.join(path.dirname(item.path), parsed.metadata.files[0]).replaceAll('\\', '/');
      assert.ok(manifest.files.some(f => f.path === markerPath), markerPath);
      assert.deepEqual(parsed.metadata.savedVariables, []);
      assert.deepEqual(parsed.metadata.savedVariablesPerCharacter, []);
    }
  }
  assert.equal(manifest.files.filter(f => f.path.endsWith('.toc')).length, 16);
  assert.equal(manifest.files.filter(f => f.path.endsWith('.lua')).length, 16);
}));

test('probe output is deterministic and marker Lua only reads runtime values and prints local evidence', () => temporary(root => {
  const a = path.join(root, 'a'); const b = path.join(root, 'b');
  assert.equal(generate(a).status, 0);
  assert.equal(generate(b).status, 0);
  const manifestBytes = readProbeFile(a, 'probe.ready.json');
  assert.deepEqual(manifestBytes, readProbeFile(b, 'probe.ready.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const markers = new Set();
  for (const file of manifest.files.filter(f => f.path.endsWith('.lua'))) {
    const lua = readProbeFile(a, file.path).toString('utf8');
    const marker = /SDK_TOC_PROBE\|schema=1\|case=[A-Za-z]+\|variant=[A-Za-z]+/.exec(lua)?.[0];
    assert.ok(marker, file.path);
    assert.equal(markers.has(marker), false);
    markers.add(marker);
    assert.doesNotMatch(lua, /SendChatMessage|SavedVariables|CreateFrame|SetCVar|LoadAddOn|DisableAddOn|EnableAddOn|io\.|os\.|loadstring/);
  }
}));

test('probe generator refuses existing outputs without overwriting a sentinel', () => temporary(root => {
  const out = path.join(root, 'existing'); fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'sentinel.txt'), 'retain');
  assert.equal(generate(out).status, 1);
  assert.equal(fs.readFileSync(path.join(out, 'sentinel.txt'), 'utf8'), 'retain');
  assert.equal(fs.existsSync(path.join(out, 'probe.ready.json')), false);
}));

test('probe generator refuses AddOns paths and junction aliases into them', () => temporary(root => {
  const addons = path.join(root, 'AddOns'); fs.mkdirSync(addons);
  assert.equal(generate(path.join(addons, 'new-probe')).status, 1);
  assert.equal(fs.existsSync(path.join(addons, 'new-probe')), false);
  const alias = path.join(root, 'alias'); fs.symlinkSync(addons, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(generate(path.join(alias, 'new-probe')).status, 1);
  assert.deepEqual(fs.readdirSync(addons), []);
}));

test('probe generator rejects absent parents and invalid Interface or argument values', () => temporary(root => {
  assert.equal(generate(path.join(root, 'missing', 'new')).status, 1);
  for (const version of ['0', '-1', '11508\n', '11508,120000', 'not-a-number']) {
    assert.equal(generate(path.join(root, 'new'), version).status, 2);
  }
  assert.equal(generate(path.join(root, 'new'), '11508', '--force').status, 2);
  assert.equal(fs.existsSync(path.join(root, 'new')), false);
}));
