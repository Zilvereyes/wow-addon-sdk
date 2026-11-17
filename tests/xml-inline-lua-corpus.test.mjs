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
const policy = { roots: [selector('Ui')], frameElements: [selector('Frame')], includeElements: [selector('Include')],
  scriptElements: [selector('Script')], handlerContainers: [selector('Scripts')],
  handlerElements: [selector('OnLoad'), selector('OnEvent')] };
const contextProfile = () => ({ schemaVersion: 1, chunkContext: { kind: 'chunk' }, handlers: [
  { element: selector('OnLoad'), context: { kind: 'function-body', parameters: ['self', 'event'], variadic: false } },
] });
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

// Package wrappers and every injected write live in this authored workspace;
// no installed SDK package/junction or discovered external path is overwritten.
function fixture(run) {
  const temporary = path.resolve(os.tmpdir());
  const workspace = fs.mkdtempSync(path.join(temporary, 'wow-inline-lua-corpus-'));
  try {
    const scripts = path.join(workspace, 'scripts'), scope = path.join(workspace, 'node_modules', '@wow-addon');
    const root = path.join(workspace, 'private-corpus'), provider = path.join(workspace, 'private-provider.json');
    const inline = path.join(workspace, 'private-inline.json');
    fs.mkdirSync(scripts, { recursive: true }); fs.mkdirSync(scope, { recursive: true }); fs.mkdirSync(root);
    fs.writeFileSync(path.join(workspace, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
    fs.writeFileSync(provider, JSON.stringify({ schemaVersion: 1, policy }));
    fs.writeFileSync(inline, JSON.stringify(contextProfile()));
    for (const name of fs.readdirSync(path.join(repository, 'scripts')).filter(name => name.endsWith('.mjs'))) {
      fs.copyFileSync(path.join(repository, 'scripts', name), path.join(scripts, name));
    }
    for (const name of ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry', 'toc-metadata-adapter', 'lua-analysis', 'xml-parser', 'xml-analysis']) {
      const target = path.join(scope, name), real = path.join(repository, 'packages', name);
      if (!['lua-analysis', 'xml-analysis'].includes(name)) {
        fs.symlinkSync(real, target, process.platform === 'win32' ? 'junction' : 'dir'); continue;
      }
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: '@wow-addon/' + name, type: 'module', exports: { '.': './index.mjs' } }));
      const api = pathToFileURL(path.join(real, 'dist', 'index.js')).href;
      fs.writeFileSync(path.join(target, 'index.mjs'), name === 'lua-analysis' ? `
import { analyzeLua as real } from ${JSON.stringify(api)};
export function analyzeLua(content, filename, options) {
  if (content.includes('PRIVATE_RESOURCE') || content.includes('PRIVATE_BACKEND')) return {
    schemaVersion: 1, complete: false, declarations: [], diagnostics: [{
      code: content.includes('PRIVATE_RESOURCE') ? 'LUA0003' : 'LUA0005', severity: 'error',
      message: content.includes('PRIVATE_RESOURCE') ? 'Lua analysis resource limit exceeded.' : 'Lua syntax backend projection is unavailable.',
      source: { file: filename, range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } },
    }] };
  const result = real(content, filename, options);
  if (content.includes('PRIVATE_BAD_LATE')) result.declarations.at(-1).activationState = 'unconditional';
  return result;
}` : `
import * as actual from ${JSON.stringify(api)};
export const analyzeXml = actual.analyzeXml;
export function mapXmlValueRanges(content, filename, value, ranges) {
  const result = actual.mapXmlValueRanges(content, filename, value, ranges);
  if (filename.endsWith('private-bad-original.xml')) result.mappings.at(-1).parts.at(-1).source.file = 'PRIVATE_WRONG_SOURCE';
  return result;
}`);
    }
    const write = (name, content) => { const filename = path.join(root, name); fs.writeFileSync(filename, content); return filename; };
    const argumentsFor = () => ['--xml-analysis', '--xml-provider-profile', provider, '--xml-inline-lua-profile', inline];
    const inspect = ({ args = argumentsFor(), changed = null, blocked = [], sourceRoot = root } = {}) => {
      const flags = [];
      if (changed !== null || blocked.length) {
        const preload = path.join(workspace, 'trusted-authored-io.mjs');
        fs.writeFileSync(preload, `import fs from 'node:fs';
const changed = ${JSON.stringify(changed)}, blocked = new Set(${JSON.stringify(blocked)});
const original = fs.openSync; let opened = 0;
fs.openSync = function(filename, ...args) {
  if (blocked.has(filename)) { const error = new Error('PRIVATE_READ_DETAIL'); error.code = 'EACCES'; throw error; }
  if (filename === changed && ++opened === 2) fs.appendFileSync(filename, ' ');
  return original.call(this, filename, ...args);
};`);
        flags.push('--import', pathToFileURL(preload).href);
      }
      const result = spawnSync(process.execPath, [...flags, path.join(scripts, 'inspect-addon-corpus.mjs'), sourceRoot, ...args],
        { cwd: workspace, encoding: 'utf8', windowsHide: true, timeout: 30000 });
      assert.equal(result.error, undefined);
      for (const secret of [workspace, root, provider, inline, 'private-', 'PRIVATE_', 'decoded:xml-inline:']) {
        assert.equal((result.stdout + result.stderr).includes(secret), false, 'CLI output must remain aggregate');
      }
      return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
    };
    run({ workspace, root, provider, inline, write, inspect, argumentsFor });
  } finally {
    assert.equal(path.dirname(path.resolve(workspace)), temporary);
    assert.ok(path.basename(workspace).startsWith('wow-inline-lua-corpus-'));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function reconcile(counts) {
  assert.equal(counts.discoveredFiles, counts.validatedFiles + counts.rejectedBeforeInline + counts.blockedFiles + counts.skippedFiles);
  assert.equal(counts.discoveredBodies, counts.eligibleBodies + counts.skippedMissingContext);
  assert.equal(counts.eligibleBodies, counts.syntaxAccepted + counts.syntaxRejected + counts.resourceBlockedBodies + counts.backendBlockedBodies);
  assert.equal(counts.lexicalComplete + counts.lexicalIncomplete, counts.syntaxAccepted);
  assert.equal(counts.attemptedBodies, counts.eligibleBodies);
}

test('explicit inline profile invokes actual contextual Lua and mapped origins without standalone Lua parse credit', () => fixture(({ write, inspect }) => {
  const filename = write('private-contextual.xml', '<Ui><Script>Pub<!--gap-->lic=1</Script>' +
    '<Frame><Scripts><OnLoad>self=1; event=2; Handler=3</OnLoad></Scripts></Frame></Ui>');
  const before = digest(filename), result = inspect();
  assert.equal(result.status, 0, 'approved inline flag must run actual APIs');
  assert.equal(result.report.status, 'passed');
  assert.deepEqual(result.report.parsed, { toc: 1, lua: 0, xml: 1 });
  assert.equal(result.report.xmlProvider.inlineChunks, 1); assert.equal(result.report.xmlProvider.inlineHandlers, 1);
  const counts = result.report.xmlInlineLua;
  assert.equal(counts.requested, true); assert.equal(counts.discoveryComplete, true); assert.equal(counts.complete, true);
  for (const field of ['discoveredFiles', 'attemptedFiles', 'submittedFiles', 'completedFiles', 'validatedFiles']) assert.equal(counts[field], 1, field);
  for (const field of ['discoveredBodies', 'eligibleBodies', 'attemptedBodies', 'syntaxAccepted', 'lexicalComplete', 'mappingValidated', 'declarations', 'queriedRecords']) assert.equal(counts[field], 2, field);
  assert.equal(counts.originalParts, 3, 'split identifier has two original parts and handler assignment has one');
  assert.equal(counts.syntaxRejected, 0); assert.equal(counts.skippedMissingContext, 0);
  assert.deepEqual(counts.diagnosticsByCode, {});
  assert.equal(counts.sourceIntegrity.matching, 1);
  assert.deepEqual(result.report.missingFullParsingCapabilities, ['loader-reference-graph']);
  assert.equal(result.report.fullParsing, false); assert.equal(digest(filename), before);
  reconcile(counts);
}));

test('inline flag prerequisites and duplicates are rejected while provider-only mode remains unchanged', () => fixture(({ provider, inline, write, inspect }) => {
  write('private-control.xml', '<Ui><Script>Public=1</Script></Ui>');
  for (const args of [
    ['--xml-inline-lua-profile', inline], ['--xml-analysis', '--xml-inline-lua-profile', inline],
    ['--xml-provider-profile', provider, '--xml-inline-lua-profile', inline],
    ['--xml-analysis', '--xml-provider-profile', provider, '--xml-inline-lua-profile'],
    ['--xml-analysis', '--xml-provider-profile', provider, '--xml-inline-lua-profile', inline, '--xml-inline-lua-profile', inline],
  ]) assert.equal(inspect({ args }).status, 2);
  const plain = inspect({ args: ['--xml-analysis', '--xml-provider-profile', provider] });
  assert.equal(plain.status, 0); assert.equal(Object.hasOwn(plain.report, 'xmlInlineLua'), false);
  assert.equal(plain.report.parsed.lua, 0);
  assert.deepEqual(plain.report.missingFullParsingCapabilities, ['xml-inline-lua-analysis', 'loader-reference-graph']);
}));

test('malformed context profiles fail before traversal without inferring a handler signature', () => fixture(({ inline, write, inspect }) => {
  write('private-unread.xml', '<Ui/>');
  const good = contextProfile();
  for (const value of [{}, { ...good, schemaVersion: 2 }, { ...good, chunkContext: { kind: 'function-body', parameters: [], variadic: false } },
    { ...good, handlers: [good.handlers[0], good.handlers[0]] },
    { ...good, handlers: [{ ...good.handlers[0], context: { kind: 'chunk' } }] },
    { ...good, handlers: [{ ...good.handlers[0], context: { kind: 'function-body', parameters: ['end'], variadic: false } }] },
    { ...good, handlers: [{ ...good.handlers[0], context: { kind: 'function-body', parameters: ['self'] } }] },
    { ...good, handlers: Array.from({ length: 129 }, (_, index) => ({ element: selector('On' + index), context: { kind: 'function-body', parameters: [], variadic: false } })) }]) {
    fs.writeFileSync(inline, JSON.stringify(value));
    const result = inspect();
    assert.equal(result.status, 1); assert.equal(result.report.entriesVisited, 0);
    assert.equal(result.report.xmlInlineLua.discoveryComplete, false); assert.equal(result.report.xmlInlineLua.complete, false);
    assert.equal(result.report.xmlInlineLua.attemptedFiles, 0);
    assert.ok(result.report.failures.includes('xml-inline-lua-profile-invalid'));
  }
}));

test('missing handler context is skipped and never silently parsed as a chunk', () => fixture(({ write, inspect }) => {
  write('private-missing-context.xml', '<Ui><Script>Public=1</Script><Frame><Scripts><OnEvent>self=1; Handler=2</OnEvent></Scripts></Frame></Ui>');
  const result = inspect(), counts = result.report.xmlInlineLua;
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(counts.validatedFiles, 1); assert.equal(counts.discoveredBodies, 2); assert.equal(counts.eligibleBodies, 1);
  assert.equal(counts.skippedMissingContext, 1); assert.equal(counts.syntaxAccepted, 1); assert.equal(counts.declarations, 1);
  assert.equal(counts.mappingValidated, 1); assert.equal(counts.complete, false);
  reconcile(counts);
}));

test('syntax rejection, lexical incompleteness and valid blocked-body results remain distinct within a validated file', () => fixture(({ write, inspect }) => {
  write('private-dispositions.xml', '<Ui><Script>Public=1</Script><Script>local =</Script>' +
    '<Script>_G.read=1; Dynamic=2</Script><Script>-- PRIVATE_RESOURCE</Script><Script>-- PRIVATE_BACKEND</Script></Ui>');
  const result = inspect(), counts = result.report.xmlInlineLua;
  assert.equal(result.status, 1);
  assert.equal(counts.validatedFiles, 1); assert.equal(counts.blockedFiles, 0); assert.equal(counts.discoveredBodies, 5);
  assert.equal(counts.syntaxAccepted, 2); assert.equal(counts.syntaxRejected, 1);
  assert.equal(counts.resourceBlockedBodies, 1); assert.equal(counts.backendBlockedBodies, 1);
  assert.equal(counts.lexicalComplete, 1); assert.equal(counts.lexicalIncomplete, 1); assert.equal(counts.mappingValidated, 5);
  assert.equal(counts.declarations, 2);
  for (const code of ['LUA0002', 'LUA0003', 'LUA0004', 'LUA0005']) assert.equal(counts.diagnosticsByCode[code], 1, code);
  assert.equal(counts.complete, false); assert.equal(result.report.parsed.lua, 0);
  reconcile(counts);
}));

test('partial valid providers retain independent bodies while syntax-rejected XML attempts no inline body', () => fixture(({ write, inspect }) => {
  write('private-partial-provider.xml', '<Ui><Frame name="Bad" virtual="invalid"/><Script>Public=1</Script></Ui>');
  write('private-unknown-root.xml', '<Foreign><Script>Unselected=1</Script></Foreign>');
  write('private-rejected.xml', '<Ui><Script></Ui>');
  const result = inspect(), counts = result.report.xmlInlineLua;
  assert.equal(result.status, 1); assert.equal(result.report.parsed.xml, 3);
  assert.equal(counts.discoveredFiles, 3); assert.equal(counts.validatedFiles, 2); assert.equal(counts.rejectedBeforeInline, 1);
  assert.equal(counts.discoveredBodies, 1); assert.equal(counts.attemptedBodies, 1); assert.equal(counts.syntaxAccepted, 1);
  assert.equal(counts.mappingValidated, 1); assert.equal(counts.declarations, 1); assert.equal(counts.complete, false);
  assert.deepEqual(counts.diagnosticsByCode, {}); reconcile(counts);
}));

test('two invalid late body/original projections retain no per-file inline prefix while XML/provider credit stays independent', () => fixture(({ write, inspect }) => {
  const badContext = write('private-bad-context.xml', '<Ui><Script>Early=1</Script><Frame><Scripts><OnLoad>-- PRIVATE_BAD_LATE\nLate=1</OnLoad></Scripts></Frame></Ui>');
  const badOriginal = write('private-bad-original.xml', '<Ui><Script>Early=1</Script><Script>Later=2</Script></Ui>');
  const control = write('private-control.xml', '<Ui><Script>Public=1</Script></Ui>');
  const before = [badContext, badOriginal, control].map(digest), result = inspect(), counts = result.report.xmlInlineLua;
  assert.equal(result.status, 1); assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.parsed.xml, 3); assert.equal(result.report.xmlProvider.validated, 3);
  assert.equal(counts.submittedFiles, 3); assert.equal(counts.completedFiles, 3);
  assert.equal(counts.validatedFiles, 1); assert.equal(counts.blockedFiles, 2); assert.equal(counts.invariantFailures, 2);
  for (const field of ['discoveredBodies', 'eligibleBodies', 'attemptedBodies', 'syntaxAccepted', 'lexicalComplete', 'mappingValidated', 'declarations', 'queriedRecords', 'originalParts']) assert.equal(counts[field], 1, field);
  assert.deepEqual(counts.diagnosticsByCode, {}); assert.deepEqual([badContext, badOriginal, control].map(digest), before);
  reconcile(counts);
}));

test('per-file body limits block every inline prefix while preserving syntax/provider facts', () => fixture(({ write, inspect }) => {
  write('private-too-many-bodies.xml', '<Ui>' + '<Script>A=1</Script>'.repeat(5001) + '</Ui>');
  write('private-control.xml', '<Ui><Script>Public=1</Script></Ui>');
  const result = inspect(), counts = result.report.xmlInlineLua;
  assert.equal(result.status, 1); assert.equal(result.report.parsed.xml, 2); assert.equal(result.report.xmlProvider.validated, 2);
  assert.equal(counts.validatedFiles, 1); assert.equal(counts.blockedFiles, 1); assert.equal(counts.resourceRejected, 1);
  assert.equal(counts.discoveredBodies, 1); assert.equal(counts.syntaxAccepted, 1); assert.equal(counts.declarations, 1);
  reconcile(counts);
}));

test('read/size/discovery/source-integrity failures cannot retain inline semantic credit', () => fixture(({ root, inline, write, inspect, argumentsFor }) => {
  const denied = write('private-denied.xml', '<Ui/>');
  write('private-too-large.xml', '<Ui>' + ' '.repeat(100) + '</Ui>');
  write('private-control.xml', '<Ui><Script>A=1</Script></Ui>');
  const bounded = inspect({ args: [...argumentsFor(), '--max-file-bytes', '64'], blocked: [denied] });
  assert.equal(bounded.status, 1);
  assert.equal(bounded.report.xmlInlineLua.readFailures, 1); assert.equal(bounded.report.xmlInlineLua.skippedOversized, 1);
  assert.equal(bounded.report.xmlInlineLua.blockedFiles, 1); assert.equal(bounded.report.xmlInlineLua.skippedFiles, 1);
  assert.equal(bounded.report.xmlInlineLua.validatedFiles, 1); reconcile(bounded.report.xmlInlineLua);
  const truncated = inspect({ args: [...argumentsFor(), '--max-entries', '1'] });
  assert.equal(truncated.report.xmlInlineLua.discoveryComplete, false); assert.equal(truncated.report.xmlInlineLua.complete, false);
  const absent = inspect({ sourceRoot: path.join(root, 'missing') });
  assert.equal(absent.report.xmlInlineLua.discoveryComplete, false);
  // Only this authored XML is deliberately changed by the trusted preload.
  fs.rmSync(denied); fs.rmSync(path.join(root, 'private-too-large.xml'));
  const changed = inspect({ changed: path.join(root, 'private-control.xml') }), counts = changed.report.xmlInlineLua;
  assert.equal(changed.status, 1); assert.equal(counts.readFailures, 1); assert.equal(counts.blockedFiles, 1);
  assert.equal(counts.validatedFiles, 0); assert.equal(counts.syntaxAccepted, 0); assert.equal(counts.declarations, 0);
  assert.equal(counts.mappingValidated, 0); reconcile(counts);
  assert.equal(fs.existsSync(inline), true);
}));
