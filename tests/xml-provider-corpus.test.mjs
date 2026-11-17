import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repository = process.cwd();
const selector = localName => ({ namespaceUri: null, localName });
const policy = {
  roots: [selector('Ui')], frameElements: [selector('Frame')], includeElements: [selector('Include')],
  scriptElements: [selector('Script')], handlerContainers: [selector('Scripts')], handlerElements: [selector('OnLoad')],
};
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

// All writes and SDK response mutations are confined to authored temporary
// workspaces. The installed SDK and real corpus are never selected for writes.
function fixture(run) {
  const temporary = path.resolve(os.tmpdir());
  const workspace = fs.mkdtempSync(path.join(temporary, 'wow-xml-provider-corpus-'));
  try {
    const scripts = path.join(workspace, 'scripts'), scope = path.join(workspace, 'node_modules', '@wow-addon');
    const root = path.join(workspace, 'private-corpus'), profile = path.join(workspace, 'private-profile.json');
    fs.mkdirSync(scripts, { recursive: true }); fs.mkdirSync(scope, { recursive: true }); fs.mkdirSync(root);
    fs.writeFileSync(path.join(workspace, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
    fs.writeFileSync(profile, JSON.stringify({ schemaVersion: 1, policy }));
    for (const name of fs.readdirSync(path.join(repository, 'scripts')).filter(name => name.endsWith('.mjs'))) {
      fs.copyFileSync(path.join(repository, 'scripts', name), path.join(scripts, name));
    }
    for (const name of ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry', 'toc-metadata-adapter', 'lua-analysis', 'xml-parser', 'xml-analysis']) {
      const target = path.join(scope, name), real = path.join(repository, 'packages', name);
      if (!['xml-parser', 'xml-analysis'].includes(name)) { fs.symlinkSync(real, target, process.platform === 'win32' ? 'junction' : 'dir'); continue; }
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: '@wow-addon/' + name, type: 'module', exports: { '.': './index.mjs' } }));
      const api = pathToFileURL(path.join(real, 'dist', 'index.js')).href;
      if (name === 'xml-parser') {
        fs.writeFileSync(path.join(target, 'index.mjs'), `
import { parseXml as real } from ${JSON.stringify(api)};
export function parseXml(content, filename, options) {
  const result = real(content, filename, options);
  if (filename.endsWith('private-bad-syntax-diagnostics.xml')) {
    const source = { file: filename, range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } };
    return { schemaVersion: 1, complete: false, elements: [], text: [], diagnostics: [
      { code: 'XML0002', severity: 'error', message: 'PRIVATE_VALID_PREFIX', source },
      { code: 'PRIVATE_UNKNOWN_XML_CODE', severity: 'error', message: 'PRIVATE_INVALID_SUFFIX', source },
    ] };
  }
  if (filename.endsWith('private-bad-syntax-mapping.xml')) result.text.at(-1).value.mappings.at(-1).decodedEnd++;
  return result;
}`);
        continue;
      }
      fs.writeFileSync(path.join(target, 'index.mjs'), `
import { analyzeXml as real } from ${JSON.stringify(api)};
export function analyzeXml(content, filename, options) {
  if (filename.endsWith('private-throw.xml')) throw new Error('PRIVATE_BACKEND_DETAIL');
  if (filename.endsWith('private-resource.xml')) return { schemaVersion: 1, complete: false,
    frames: [], references: [], scripts: [], declarations: [], diagnostics: [{ code: 'XUI0003', severity: 'error',
      message: 'PRIVATE_RESOURCE_DETAIL', source: { file: filename, range: {
        start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } } }] };
  const result = real(content, filename, options);
  if (filename.endsWith('private-bad-activation.xml')) {
    result.declarations.at(-1).activationState = 'unconditional'; result.complete = false;
    result.diagnostics.push({ code: 'XUI0004', severity: 'warning', message: 'PRIVATE_LATE_DIAGNOSTIC', source: result.declarations.at(-1).source });
  }
  if (filename.endsWith('private-bad-mapping.xml')) result.scripts.at(-1).body.mappings.at(-1).source.range.end.column = content.length + 1;
  if (filename.endsWith('private-bad-schema.xml')) result.schemaVersion = 999;
  if (filename.endsWith('private-bad-kind.xml')) result.scripts.at(-1).kind = 'PRIVATE_BAD_KIND';
  if (filename.endsWith('private-dropped-warning.xml')) result.diagnostics.pop();
  if (filename.endsWith('private-moved-warning.xml')) result.diagnostics[0].source = result.frames.at(-1).source;
  return result;
}`);
    }
    const write = (name, content) => { const filename = path.join(root, name); fs.writeFileSync(filename, content); return filename; };
    const inspect = ({ args = ['--xml-analysis', '--xml-provider-profile', profile], blocked = [], changed = null, sourceRoot = root } = {}) => {
      const flags = [];
      if (blocked.length || changed !== null) {
        const preload = path.join(workspace, 'trusted-authored-io.mjs');
        fs.writeFileSync(preload, `import fs from 'node:fs';
const blocked = new Set(${JSON.stringify(blocked)}), changed = ${JSON.stringify(changed)};
const open = fs.openSync; let reads = 0;
fs.openSync = function(filename, ...args) {
  if (blocked.has(filename)) { const error = new Error('PRIVATE_READ_DETAIL'); error.code = 'EACCES'; throw error; }
  if (filename === changed && ++reads === 2) fs.appendFileSync(filename, ' ');
  return open.call(this, filename, ...args);
};`);
        flags.push('--import', pathToFileURL(preload).href);
      }
      const result = spawnSync(process.execPath, [...flags, path.join(scripts, 'inspect-addon-corpus.mjs'), sourceRoot, ...args],
        { cwd: workspace, encoding: 'utf8', windowsHide: true, timeout: 30000 });
      assert.equal(result.error, undefined);
      for (const secret of [workspace, root, profile, 'private-', 'PRIVATE_', 'PrivateFrame', 'Unexpected', '../outside.xml']) {
        assert.equal((result.stdout + result.stderr).includes(secret), false, 'output must remain aggregate');
      }
      return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
    };
    run({ workspace, root, profile, write, inspect });
  } finally {
    assert.equal(path.dirname(path.resolve(workspace)), temporary);
    assert.ok(path.basename(workspace).startsWith('wow-xml-provider-corpus-'));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function reconciles(counts) {
  assert.equal(counts.discovered, counts.rejectedBeforeProjection + counts.validated + counts.blocked + counts.skippedOversized);
  assert.equal(counts.validated, counts.projectionComplete + counts.projectionIncomplete);
}

test('explicit provider inventory retains unknown candidates and mapped bodies without reading references or counting Lua syntax', () => fixture(({ write, inspect }) => {
  const source = '<Ui><Frame name="PrivateFrame"><Scripts><OnLoad>error("PRIVATE_NEVER_EXECUTE")</OnLoad></Scripts></Frame>' +
    '<Include file="../outside.xml"/><Script>A&amp;B<![CDATA[\r\nC]]><!--gap-->D</Script></Ui>';
  const filename = write('private-positive.xml', source), before = digest(filename);
  const result = inspect();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.status, 'passed');
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 0, xml: 1 });
  const counts = result.report.xmlProvider;
  assert.equal(counts.requested, true);
  assert.equal(counts.association, 'caller-owned-inventory');
  assert.equal(counts.resolvedProviderParticipation, false);
  for (const field of ['discovered', 'eligible', 'attempted', 'submitted', 'completed', 'projectionAttempted', 'validated',
    'projectionComplete', 'frameCandidates', 'declarations', 'references', 'inlineChunks', 'inlineHandlers']) assert.equal(counts[field], 1, field);
  for (const field of ['projectionIncomplete', 'rejectedBeforeProjection', 'blocked', 'skippedOversized', 'readFailures',
    'workerFailures', 'backendFailures', 'invariantFailures', 'resourceRejected']) assert.equal(counts[field], 0, field);
  assert.equal(counts.complete, true); assert.equal(counts.discoveryComplete, true);
  assert.equal(counts.checkedDecodedMappings, 9, 'one name, one target, one handler span and six independently authored chunk spans');
  assert.deepEqual(counts.diagnosticsByCode, {});
  assert.equal(digest(filename), before);
  assert.equal(result.report.fullParsing, false);
  assert.deepEqual(result.report.missingFullParsingCapabilities, ['xml-inline-lua-analysis', 'loader-reference-graph']);
  reconciles(counts);
}));

test('provider is opt-in and profile flags require explicit XML syntax analysis', () => fixture(({ profile, write, inspect }) => {
  write('private-ordinary.xml', '<Ui/>');
  const plain = inspect({ args: ['--xml-analysis'] });
  assert.equal(plain.status, 0);
  assert.equal(Object.hasOwn(plain.report, 'xmlProvider'), false);
  assert.equal(plain.report.parsed.xml, 1);
  assert.deepEqual(plain.report.missingFullParsingCapabilities, ['xml-provider', 'loader-reference-graph']);
  for (const args of [
    ['--xml-provider-profile', profile], ['--xml-analysis', '--xml-provider-profile'],
    ['--xml-analysis', '--xml-provider-profile', profile, '--xml-provider-profile', profile],
  ]) assert.equal(inspect({ args }).status, 2);
}));

test('invalid or oversized caller profiles fail before discovery and never silently select a vocabulary', () => fixture(({ root, profile, write, inspect }) => {
  write('private-unread.xml', '<Ui><Frame name="PrivateFrame"/></Ui>');
  const duplicate = { ...policy, frameElements: [selector('Ui')] };
  for (const text of ['{', '{}', JSON.stringify({ schemaVersion: 2, policy }),
    JSON.stringify({ schemaVersion: 1, policy, unexpected: true }), JSON.stringify({ schemaVersion: 1, policy: duplicate }),
    JSON.stringify({ schemaVersion: 1, policy: { ...policy, roots: [] } }),
    JSON.stringify({ schemaVersion: 1, policy: { ...policy, frameElements: Array.from({ length: 129 }, (_, index) => selector('F' + index)) } }),
    ' '.repeat(1024 * 1024 + 1)]) {
    fs.writeFileSync(profile, text);
    const result = inspect();
    assert.equal(result.status, 1);
    assert.equal(result.report.entriesVisited, 0);
    assert.equal(result.report.xmlProvider.discoveryComplete, false);
    assert.equal(result.report.xmlProvider.complete, false);
    assert.equal(result.report.xmlProvider.attempted, 0);
    assert.ok(result.report.failures.includes('xml-provider-profile-invalid'));
    reconciles(result.report.xmlProvider);
  }
  fs.unlinkSync(profile);
  assert.equal(inspect().status, 1);
  const missing = inspect({ sourceRoot: path.join(root, 'missing') });
  assert.equal(missing.report.xmlProvider.discoveryComplete, false);
}));

test('multiple late invalid projections receive no provider fact, map, diagnostic or verdict credit while syntax remains counted', () => fixture(({ write, inspect }) => {
  const bad = '<Ui><Frame name="PrivateFrame"/><Frame name="Second"/><Script>A&amp;B</Script></Ui>';
  const files = ['activation', 'mapping', 'schema', 'kind'].map(kind => write('private-bad-' + kind + '.xml', bad));
  files.push(write('private-good.xml', '<Ui><Frame name="Good"/></Ui>'));
  const before = files.map(digest), result = inspect();
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 5);
  assert.equal(result.report.xmlAnalysis.accepted, 5);
  const counts = result.report.xmlProvider;
  assert.equal(counts.validated, 1); assert.equal(counts.projectionComplete, 1);
  assert.equal(counts.invariantFailures, 4); assert.equal(counts.blocked, 4);
  assert.equal(counts.frameCandidates, 1); assert.equal(counts.declarations, 1);
  assert.equal(counts.inlineChunks, 0); assert.equal(counts.checkedDecodedMappings, 1);
  assert.equal(counts.checkedSourceReferences, 4);
  assert.deepEqual(counts.diagnosticsByCode, {});
  assert.deepEqual(files.map(digest), before);
  reconciles(counts);
}));

test('syntax rejection, provider ambiguity, backend throw and resource failure have distinct per-file dispositions', () => fixture(({ write, inspect }) => {
  write('private-syntax.xml', '<Ui><Frame></Ui>');
  write('private-ambiguous.xml', '<Ui><Script>A<Unexpected/>B</Script><Frame name="Good"/></Ui>');
  write('private-throw.xml', '<Ui/>'); write('private-resource.xml', '<Ui/>');
  const result = inspect(), counts = result.report.xmlProvider;
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 4);
  assert.equal(result.report.xmlAnalysis.accepted, 3); assert.equal(result.report.xmlAnalysis.rejected, 1);
  assert.equal(counts.discovered, 4); assert.equal(counts.attempted, 4);
  assert.equal(counts.submitted, 4); assert.equal(counts.completed, 4);
  assert.equal(counts.eligible, 3); assert.equal(counts.projectionAttempted, 3);
  assert.equal(counts.rejectedBeforeProjection, 1); assert.equal(counts.validated, 1);
  assert.equal(counts.projectionIncomplete, 1); assert.equal(counts.projectionComplete, 0);
  assert.equal(counts.backendFailures, 1); assert.equal(counts.resourceRejected, 1); assert.equal(counts.blocked, 2);
  assert.equal(counts.frameCandidates, 1); assert.equal(counts.declarations, 1); assert.equal(counts.inlineChunks, 0);
  assert.equal(counts.diagnosticsByCode.XUI0004, 1); assert.equal(counts.diagnosticsByCode.XUI0003, 1);
  assert.equal(counts.invariantFailures, 0);
  reconciles(counts);
}));

test('each ambiguous element requires its own correctly located warning before any provider metric credit', () => fixture(({ write, inspect }) => {
  const ambiguous = '<Ui><Frame name="First" virtual="invalid"/><Frame name="Second" virtual="invalid"/>' +
    '<Frame name="Valid"/></Ui>';
  const files = [write('private-dropped-warning.xml', ambiguous), write('private-moved-warning.xml', ambiguous),
    write('private-warning-control.xml', '<Ui><Frame name="Control"/></Ui>')];
  const before = files.map(digest), result = inspect(), counts = result.report.xmlProvider;
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 3, 'all original XML inputs have valid syntax');
  assert.equal(result.report.xmlAnalysis.accepted, 3);
  assert.equal(counts.submitted, 3); assert.equal(counts.completed, 3); assert.equal(counts.projectionAttempted, 3);
  assert.equal(counts.invariantFailures, 2, 'dropped and mislocated warnings both invalidate the entire provider projection');
  assert.equal(counts.blocked, 2); assert.equal(counts.validated, 1);
  assert.equal(counts.projectionComplete, 1); assert.equal(counts.projectionIncomplete, 0);
  assert.equal(counts.frameCandidates, 1); assert.equal(counts.declarations, 1);
  assert.equal(counts.checkedDecodedMappings, 1); assert.equal(counts.checkedSourceReferences, 4);
  assert.deepEqual(counts.diagnosticsByCode, {}, 'neither invalid projection contributes a diagnostic prefix');
  assert.deepEqual(files.map(digest), before);
  reconciles(counts);
}));

test('several ambiguity causes on one element may share a correctly located warning source', () => fixture(({ write, inspect }) => {
  write('private-multiple-causes.xml', '<Ui><Script file="">AmbiguousBody</Script></Ui>');
  const result = inspect(), counts = result.report.xmlProvider;
  assert.equal(result.status, 1); assert.equal(result.report.status, 'failed');
  assert.equal(counts.validated, 1); assert.equal(counts.projectionIncomplete, 1);
  assert.equal(counts.invariantFailures, 0); assert.equal(counts.blocked, 0);
  assert.equal(counts.references, 1); assert.equal(counts.inlineChunks, 0);
  assert.ok(counts.diagnosticsByCode.XUI0004 >= 1);
  reconciles(counts);
}));

test('late invalid XML diagnostics receive no syntax histogram or source-reference prefix credit', () => fixture(({ write, inspect }) => {
  const files = [write('private-bad-syntax-diagnostics.xml', '<Ui/>'), write('private-syntax-control.xml', '<Ui/>')];
  const before = files.map(digest), result = inspect();
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 1);
  const syntax = result.report.xmlAnalysis, provider = result.report.xmlProvider;
  assert.equal(syntax.invariantFailures, 1); assert.equal(syntax.accepted, 1); assert.equal(syntax.rejected, 0);
  assert.deepEqual(syntax.diagnosticsByCode, {}, 'a valid diagnostic prefix from an invalid result must not be credited');
  assert.equal(syntax.checkedSourceReferences, 3, 'only the control element, opening tag and element name sources count');
  assert.equal(syntax.checkedDecodedMappings, 0);
  assert.equal(provider.invariantFailures, 1); assert.equal(provider.blocked, 1); assert.equal(provider.validated, 1);
  assert.equal(provider.rejectedBeforeProjection, 0); assert.deepEqual(provider.diagnosticsByCode, {});
  assert.deepEqual(files.map(digest), before);
  reconciles(provider);
}));

test('late invalid XML maps receive no earlier mapping or source-reference prefix credit', () => fixture(({ write, inspect }) => {
  const files = [write('private-bad-syntax-mapping.xml', '<Ui><Script>A&amp;B</Script></Ui>'),
    write('private-map-control.xml', '<Ui/>')];
  const before = files.map(digest), result = inspect();
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 1);
  const syntax = result.report.xmlAnalysis, provider = result.report.xmlProvider;
  assert.equal(syntax.invariantFailures, 1); assert.equal(syntax.accepted, 1);
  assert.equal(syntax.checkedDecodedMappings, 0, 'early valid mappings from the invalid file must not survive');
  assert.equal(syntax.checkedSourceReferences, 3, 'only the unaffected control receives source-reference credit');
  assert.deepEqual(syntax.diagnosticsByCode, {});
  assert.equal(provider.invariantFailures, 1); assert.equal(provider.blocked, 1); assert.equal(provider.validated, 1);
  for (const field of ['frameCandidates', 'declarations', 'inlineChunks', 'checkedDecodedMappings', 'checkedSourceReferences']) assert.equal(provider[field], 0);
  assert.deepEqual(files.map(digest), before);
  reconciles(provider);
}));

test('provider read, encoding and byte-limit blocks remain separate from submitted work', () => fixture(({ profile, write, inspect }) => {
  const denied = write('private-denied.xml', '<Ui/>');
  write('private-encoding.xml', Buffer.from([0xFF, 0xFE]));
  write('private-oversized.xml', '<Ui>' + ' '.repeat(100) + '</Ui>');
  write('private-good.xml', '<Ui/>');
  const result = inspect({ args: ['--xml-analysis', '--xml-provider-profile', profile, '--max-file-bytes', '32'], blocked: [denied] });
  const counts = result.report.xmlProvider;
  assert.equal(result.status, 1); assert.equal(result.report.parsed.xml, 1);
  assert.equal(counts.readFailures, 1); assert.equal(counts.encodingRejected, 1);
  assert.equal(counts.skippedOversized, 1); assert.equal(counts.resourceRejected, 1);
  assert.equal(counts.submitted, 1); assert.equal(counts.completed, 1); assert.equal(counts.validated, 1);
  assert.equal(counts.blocked, 2); assert.equal(counts.discoveryComplete, true); assert.equal(counts.complete, false);
  reconciles(counts);
}));

test('external Script ambiguity uses XML whitespace rather than JavaScript Unicode whitespace', () => fixture(({ write, inspect }) => {
  write('private-xml-space.xml', '<Ui><Script file="unopened.lua"> \t\r\n</Script></Ui>');
  write('private-nonbreaking-space.xml', '<Ui><Script file="unopened.lua">\u00A0</Script></Ui>');
  const result = inspect(), counts = result.report.xmlProvider;
  assert.equal(result.status, 1); assert.equal(result.report.status, 'failed');
  assert.equal(result.report.parsed.xml, 2);
  assert.equal(counts.validated, 2); assert.equal(counts.projectionComplete, 1); assert.equal(counts.projectionIncomplete, 1);
  assert.equal(counts.references, 2); assert.equal(counts.inlineChunks, 0); assert.equal(counts.invariantFailures, 0);
  assert.deepEqual(counts.diagnosticsByCode, { XUI0004: 1 });
  reconciles(counts);
}));

test('post-projection source changes discard all staged provider metrics', () => fixture(({ write, inspect }) => {
  const filename = write('private-changing.xml', '<Ui><Frame name="PrivateFrame"/></Ui>');
  const result = inspect({ changed: filename }), counts = result.report.xmlProvider;
  assert.equal(result.status, 1);
  assert.equal(counts.readFailures, 1); assert.equal(counts.blocked, 1); assert.equal(counts.validated, 0);
  for (const field of ['frameCandidates', 'declarations', 'checkedSourceReferences', 'checkedDecodedMappings']) assert.equal(counts[field], 0);
  assert.deepEqual(counts.diagnosticsByCode, {});
  reconciles(counts);
}));

test('truncated discovery and a requested run without XML inputs cannot claim complete provider acceptance', () => fixture(({ root, profile, write, inspect }) => {
  const absent = inspect();
  assert.equal(absent.status, 1); assert.equal(absent.report.xmlProvider.complete, false);
  assert.ok(absent.report.failures.includes('xml-provider-no-validated-inputs'));
  write('private-unread.xml', '<Ui/>');
  for (const options of [{ args: ['--xml-analysis', '--xml-provider-profile', profile, '--max-entries', '1'] },
    { sourceRoot: path.join(root, 'missing') }]) {
    const result = inspect(options), counts = result.report.xmlProvider;
    assert.equal(result.status, 1); assert.equal(counts.discoveryComplete, false); assert.equal(counts.complete, false);
    assert.equal(counts.attempted, 0); assert.equal(counts.validated, 0); reconciles(counts);
  }
}));
