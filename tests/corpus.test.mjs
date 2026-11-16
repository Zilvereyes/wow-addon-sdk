import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = path.resolve('scripts/inspect-addon-corpus.mjs');
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-corpus-'));
  try { run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function inspect(root, ...args) {
  const result = spawnSync(process.execPath, [runner, root, ...args], { encoding: 'utf8', windowsHide: true });
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : undefined };
}

test('corpus parses every TOC variant read-only and inventories Lua/XML without claiming parsing', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'Å'));
  const contents = {
    'Å/Å_Vanilla.toc': '\uFEFF## Title: 🧪\r\n## SavedVariables: DB\rCore.lua\nFrame.xml',
    'Å/Å_Mainline.TOC': '## SavedVariables: RetailDB',
    'Å/Core.lua': 'error("must never execute")',
    'Å/Frame.xml': '<Ui><Frame name="Example"/></Ui>',
  };
  for (const [name, value] of Object.entries(contents)) fs.writeFileSync(path.join(root, name), value);
  const result = inspect(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.files, { toc: 2, lua: 1, xml: 1 });
  assert.deepEqual(result.report.parsed, { toc: 2, lua: 0, xml: 0 });
  assert.equal(result.report.status, 'passed');
  assert.equal(result.report.fullParsing, false);
  assert.deepEqual(result.report.unimplementedParsers, ['lua', 'xml']);
  assert.equal(result.report.checkedSourceReferences > 0, true);
  assert.equal(result.report.savedVariableDeclarations, 2);
  assert.doesNotMatch(result.stdout + result.stderr, /RetailDB|Core\.lua|Å|must never execute/);
  assert.equal(result.stdout, inspect(root).stdout);
  for (const [name, value] of Object.entries(contents)) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), value);
}));

test('full-parser gate fails explicitly while Lua/XML parsers are absent', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  const result = inspect(root, '--require-all-parsers');
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'failed');
  assert.ok(result.report.failures.includes('unimplemented-parsers'));
}));

test('corpus surfaces parser errors as aggregate codes without exposing source text or paths', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'private-name.toc'), '## private-missing-colon\n## SavedVariables: DB,,bad-name');
  const result = inspect(root);
  assert.equal(result.status, 1);
  assert.deepEqual(result.report.diagnosticsByCode, { TOC0001: 1, TOC0003: 1, TOC0004: 1 });
  assert.doesNotMatch(result.stdout + result.stderr, /private-name|private-missing-colon|bad-name/);
}));

test('corpus rejects empty and missing roots with a nonzero result', () => fixture(root => {
  assert.equal(inspect(root).status, 1);
  const result = inspect(path.join(root, 'missing'));
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /wow-sdk-corpus-/);
}));

test('corpus reports incomplete coverage when byte or traversal limits are reached', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '## Title: too large');
  const oversized = inspect(root, '--max-file-bytes', '4');
  assert.equal(oversized.status, 1);
  assert.equal(oversized.report.status, 'incomplete');
  assert.equal(oversized.report.skippedOversizedTocs, 1);
  fs.writeFileSync(path.join(root, 'B.toc'), '');
  const bounded = inspect(root, '--max-entries', '1');
  assert.equal(bounded.status, 1);
  assert.equal(bounded.report.status, 'incomplete');
  assert.ok(bounded.report.failures.includes('entry-limit'));
}));

test('corpus rejects invalid limits and unknown flags', () => fixture(root => {
  for (const args of [['--max-entries', '0'], ['--max-file-bytes', '-1'], ['--max-entries', '1x'], ['--unknown']]) {
    assert.equal(inspect(root, ...args).status, 2);
  }
}));

test('corpus skips directory links instead of traversing an external tree', () => fixture(root => fixture(outside => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  fs.writeFileSync(path.join(outside, 'outside.toc'), '## invalid');
  fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = inspect(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.skippedLinks, 1);
  assert.equal(result.report.parsed.toc, 1);
  assert.deepEqual(result.report.diagnosticsByCode, {});
  assert.equal(inspect(path.join(root, 'linked')).status, 1);
})));
