import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const runner = path.resolve('scripts/inspect-addon-corpus.mjs');
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-xml-corpus-'));
  try {
    fs.writeFileSync(path.join(root, 'Seed.toc'), '# Authored synthetic corpus\n');
    run(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function inspect(root, ...args) {
  const result = spawnSync(process.execPath, [runner, root, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.error, undefined);
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : undefined };
}
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

test('XML corpus opt-in actually parses namespace-aware syntax, decoded mappings and original BOM ranges without changing sources', () => fixture(root => {
  const filename = path.join(root, 'private-authored-fixture.xml');
  const content = '\uFEFF<?xml version="1.0"?>\r\n<Ui xmlns="urn:authored" xmlns:p="urn:child" label="a\t&#x1F600;&amp;\r\nb">\r\n<p:Frame>secret-authored-text &lt; &#65;\r<![CDATA[raw &amp;\r\n]]></p:Frame>\n</Ui>';
  fs.writeFileSync(filename, content);
  const before = digest(filename), statBefore = fs.statSync(filename);
  const result = inspect(root, '--xml-analysis');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.report.status, 'passed');
  assert.equal(result.report.fullParsing, false);
  assert.deepEqual(result.report.files, { toc: 1, lua: 0, xml: 1 });
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 0, xml: 1 });
  assert.deepEqual(result.report.unimplementedParsers, []);
  assert.deepEqual(result.report.disabledParsers, ['lua']);
  const counts = result.report.xmlAnalysis;
  assert.equal(counts.namespaceAware, true);
  for (const name of ['discovered', 'attempted', 'submitted', 'completed', 'accepted']) assert.equal(counts[name], 1, name);
  for (const name of ['rejected', 'profileRejected', 'resourceRejected', 'encodingRejected', 'inputLimitRejected',
    'readFailures', 'workerFailures', 'backendFailures', 'invariantFailures']) assert.equal(counts[name], 0, name);
  assert.equal(counts.complete, true);
  assert.equal(counts.resolvedProviderParticipation, false);
  assert.ok(counts.checkedSourceReferences > 10);
  assert.ok(counts.checkedDecodedMappings > 8);
  assert.equal(counts.inputBytes, Buffer.byteLength(content));
  assert.deepEqual(counts.sourceIntegrity, { checked: 1, matching: 1, changed: 0, verificationFailures: 0 });
  assert.equal(digest(filename), before);
  assert.equal(fs.statSync(filename).mtimeMs, statBefore.mtimeMs);
  for (const secret of [root, filename, path.basename(filename), 'secret-authored-text', 'urn:authored', before]) {
    assert.equal((result.stdout + result.stderr).includes(secret), false, 'Corpus output must remain aggregate');
  }
  assert.equal(inspect(root, '--xml-analysis').stdout, result.stdout, 'Aggregate output must be deterministic');
}));

test('XML corpus distinguishes completed syntax/profile rejections from blocked work and fails closed on namespace errors', () => fixture(root => {
  const authored = new Map([
    ['accepted.xml', '<Ui><Frame/></Ui>'],
    ['syntax.xml', '<Ui><Frame></Ui>'],
    ['namespace.xml', '<p:Ui/>'],
    ['doctype.xml', '<!DOCTYPE Ui SYSTEM "file:///authored-never-read"><Ui/>'],
    ['version.xml', '<?xml version="1.1"?><Ui/>'],
  ]);
  for (const [filename, content] of authored) fs.writeFileSync(path.join(root, filename), content);
  const result = inspect(root, '--xml-analysis');
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'failed');
  assert.equal(result.report.parsed.xml, 5);
  const counts = result.report.xmlAnalysis;
  for (const name of ['discovered', 'attempted', 'submitted', 'completed']) assert.equal(counts[name], 5, name);
  assert.equal(counts.accepted, 1);
  assert.equal(counts.rejected, 4);
  assert.equal(counts.profileRejected, 2);
  assert.deepEqual(counts.diagnosticsByCode, { XML0002: 2, XML0004: 2 });
  for (const name of ['resourceRejected', 'encodingRejected', 'readFailures', 'workerFailures', 'backendFailures', 'invariantFailures']) {
    assert.equal(counts[name], 0, name);
  }
  assert.deepEqual(counts.sourceIntegrity, { checked: 5, matching: 5, changed: 0, verificationFailures: 0 });
  assert.deepEqual(result.report.failures, ['xml-profile-rejected', 'xml-syntax-errors']);
  assert.equal(result.stdout.includes('authored-never-read'), false);
}));

test('XML corpus blocks malformed UTF-8 and UTF-16 transport before submission with honest incomplete status', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'bad-utf8.xml'), Buffer.from([0x3C, 0x55, 0x69, 0x3E, 0xC3, 0x28]));
  fs.writeFileSync(path.join(root, 'utf16.xml'), Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('<Ui/>', 'utf16le')]));
  const result = inspect(root, '--xml-analysis');
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 0);
  const counts = result.report.xmlAnalysis;
  assert.equal(counts.discovered, 2); assert.equal(counts.attempted, 2);
  assert.equal(counts.encodingRejected, 2); assert.equal(counts.submitted, 0); assert.equal(counts.completed, 0);
  assert.equal(counts.accepted, 0); assert.equal(counts.rejected, 0); assert.equal(counts.invariantFailures, 0);
  assert.deepEqual(counts.sourceIntegrity, { checked: 2, matching: 2, changed: 0, verificationFailures: 0 });
  assert.deepEqual(result.report.failures, ['xml-invalid-utf8']);
}));

test('XML corpus enforces its UTF-16 unit cap and derived byte cap even with a larger generic limit', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'units.xml'), '<Ui>' + 'x'.repeat(1024 * 1024) + '</Ui>');
  fs.writeFileSync(path.join(root, 'bytes.xml'), Buffer.alloc(4 * 1024 * 1024 + 1, 0x20));
  const result = inspect(root, '--xml-analysis', '--max-file-bytes', String(16 * 1024 * 1024));
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 0);
  const counts = result.report.xmlAnalysis;
  assert.equal(counts.attempted, 2); assert.equal(counts.inputLimitRejected, 2); assert.equal(counts.resourceRejected, 2);
  assert.equal(counts.submitted, 0); assert.equal(counts.rejected, 0); assert.equal(counts.invariantFailures, 0);
  assert.deepEqual(counts.sourceIntegrity, { checked: 1, matching: 1, changed: 0, verificationFailures: 0 });
  assert.deepEqual(result.report.failures, ['xml-input-limit']);
}));

test('XML corpus additionally respects the caller generic byte cap', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'limited.xml'), '<Ui>' + 'x'.repeat(100) + '</Ui>');
  const result = inspect(root, '--xml-analysis', '--max-file-bytes', '64');
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.xmlAnalysis.inputLimitRejected, 1);
  assert.equal(result.report.xmlAnalysis.resourceRejected, 1);
  assert.equal(result.report.xmlAnalysis.submitted, 0);
}));

test('XML backend resource rejection is completed blocked work and never counted as a syntax verdict', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'deep.xml'), '<Ui>'.repeat(257) + '</Ui>'.repeat(257));
  const result = inspect(root, '--xml-analysis');
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 0);
  const counts = result.report.xmlAnalysis;
  assert.equal(counts.submitted, 1); assert.equal(counts.completed, 1); assert.equal(counts.resourceRejected, 1);
  assert.equal(counts.accepted, 0); assert.equal(counts.rejected, 0); assert.equal(counts.profileRejected, 0);
  assert.equal(counts.backendFailures, 0); assert.equal(counts.invariantFailures, 0);
  assert.deepEqual(counts.diagnosticsByCode, { XML0003: 1 });
  assert.deepEqual(counts.sourceIntegrity, { checked: 1, matching: 1, changed: 0, verificationFailures: 0 });
  assert.deepEqual(result.report.failures, ['xml-resource-limit']);
}));

test('XML analysis stays explicit and duplicate or namespace fallback flags are rejected', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'invalid.xml'), '<p:Ui/>');
  const disabled = inspect(root);
  assert.equal(disabled.status, 0); assert.equal(disabled.report.files.xml, 1); assert.equal(disabled.report.parsed.xml, 0);
  assert.deepEqual(disabled.report.disabledParsers, ['lua', 'xml']);
  assert.deepEqual(disabled.report.unimplementedParsers, []);
  assert.equal(Object.hasOwn(disabled.report, 'xmlAnalysis'), false);
  for (const flags of [['--xml-analysis', '--xml-analysis'], ['--xml-analysis', '--namespace-aware', 'false']]) {
    const rejected = inspect(root, ...flags);
    assert.equal(rejected.status, 2); assert.equal(rejected.stdout, ''); assert.match(rejected.stderr, /^Usage:/u);
  }
}));

test('all syntax parsers cannot waive the missing XML provider and loader reference graph', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'fixture.xml'), '<Ui/>');
  fs.writeFileSync(path.join(root, 'fixture.lua'), 'local authored = true\n');
  const result = inspect(root, '--lua-analysis', '--xml-analysis', '--require-all-parsers');
  assert.equal(result.status, 1); assert.equal(result.report.status, 'failed');
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 1, xml: 1 });
  assert.deepEqual(result.report.disabledParsers, []); assert.deepEqual(result.report.unimplementedParsers, []);
  assert.equal(result.report.fullParsing, false);
  assert.deepEqual(result.report.missingFullParsingCapabilities, ['xml-provider', 'loader-reference-graph']);
  assert.deepEqual(result.report.failures, ['missing-full-parsing-capabilities']);
}));
