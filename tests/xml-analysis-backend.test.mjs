import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Copy only the built provider into an authored workspace. The syntax wrapper
// delegates to the installed parser before corrupting selected result fields.
// No installed SDK file, production option or source text chooses a backend.
test('unusable syntax projections fail closed independently and syntax diagnostics retain owned sources', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-xml-provider-backend-'));
  try {
    const scope = path.join(workspace, 'node_modules', '@wow-addon');
    fs.mkdirSync(scope, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'package.json'), '{"type":"module"}');
    const analysis = path.join(scope, 'xml-analysis');
    const syntax = path.join(scope, 'xml-parser');
    fs.mkdirSync(analysis); fs.mkdirSync(syntax);
    fs.writeFileSync(path.join(analysis, 'package.json'), '{"type":"module","exports":{".":"./index.mjs"}}');
    fs.copyFileSync(path.resolve('packages/xml-analysis/dist/index.js'), path.join(analysis, 'index.mjs'));
    fs.writeFileSync(path.join(syntax, 'package.json'), '{"type":"module","exports":{".":"./index.mjs"}}');
    fs.writeFileSync(path.join(syntax, 'index.mjs'), `
import { parseXml as real } from ${JSON.stringify(pathToFileURL(path.resolve('packages/xml-parser/dist/index.js')).href)};
let last, calls = 0, extraReads = 0;
export const snapshot = () => ({ last, calls, extraReads });
export function parseXml(content, filename, options) {
  calls++;
  if (filename === 'private-backend-error.xml') throw new Error('PRIVATE_BACKEND_MESSAGE');
  const result = real(content, filename, options); last = result;
  if (filename === 'private-bad-schema.xml') result.schemaVersion = 999;
  if (filename === 'private-bad-mapping.xml') result.text[0].value.mappings[1].decodedStart = 0;
  if (filename === 'private-bad-element-parent.xml') result.elements[2].parentIndex = 0;
  if (filename === 'private-bad-text-parent.xml') result.text[0].parentIndex = 1;
  if (filename === 'private-null-prefix-uri.xml') result.elements[1].name.namespaceUri = null;
  if (filename === 'private-extra-position.xml') {
    function decorate(value) {
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) {
        for (const point of [value.range.start, value.range.end]) {
          point.privateMarker = { value: 'PRIVATE_BACKEND_POSITION_OBJECT' };
          Object.defineProperty(point, 'privateGetter', { enumerable: true, get() {
            extraReads++; throw new Error('PRIVATE_BACKEND_POSITION_GETTER');
          } });
        }
      } else for (const item of Object.values(value)) decorate(item);
    }
    decorate(result);
  }
  return result;
}`);
    for (const name of ['diagnostics', 'global-registry']) fs.symlinkSync(path.resolve('packages', name),
      path.join(scope, name), process.platform === 'win32' ? 'junction' : 'dir');
    const harness = path.join(workspace, 'check.mjs');
    fs.writeFileSync(harness, `
import assert from 'node:assert/strict';
import { analyzeXml } from '@wow-addon/xml-analysis';
import { snapshot } from '@wow-addon/xml-parser';
const pick = localName => ({ namespaceUri: null, localName });
const policy = { roots: [pick('Ui')], frameElements: [pick('Frame')], includeElements: [],
  scriptElements: [pick('Script')], handlerContainers: [], handlerElements: [] };
const options = { addonId: 'authored', policy };
const text = '<Ui><Frame name="Prefix"/><Script>A&amp;B</Script></Ui>';
const valid = analyzeXml(text, 'good.xml', options);
assert.equal(valid.complete, true);
for (const file of ['private-bad-schema.xml', 'private-bad-mapping.xml', 'private-backend-error.xml']) {
  const result = analyzeXml(text, file, options);
  assert.equal(result.complete, false);
  for (const field of ['frames', 'references', 'scripts', 'declarations']) assert.deepEqual(result[field], []);
  assert.deepEqual(result.diagnostics.map(value => value.code), ['XUI0002']);
  assert.doesNotMatch(JSON.stringify(result.diagnostics.map(value => value.message)), /PRIVATE_BACKEND_MESSAGE|private-bad|Prefix/);
  assert.deepEqual(analyzeXml(text, 'good.xml', options), valid);
}
for (const [content, file] of [
  ['<Ui xmlns:p="urn:wrong"><p:Frame name="Bad"/></Ui>', 'private-null-prefix-uri.xml'],
  ['<Ui><Unknown><Include file="x"/></Unknown></Ui>', 'private-bad-element-parent.xml'],
  ['<Ui><Script><Unknown>nested</Unknown></Script></Ui>', 'private-bad-text-parent.xml'],
]) {
  const result = analyzeXml(content, file, { ...options, policy: { ...policy, includeElements: [pick('Include')] } });
  assert.equal(result.complete, false);
  assert.deepEqual(result.diagnostics.map(value => value.code), ['XUI0002']);
  for (const field of ['frames', 'references', 'scripts', 'declarations']) assert.deepEqual(result[field], []);
  assert.deepEqual(analyzeXml(text, 'good.xml', options), valid);
}
const rejected = analyzeXml('<Ui>&amp</Ui>', 'syntax.xml', options);
assert.deepEqual(rejected.diagnostics.map(value => value.code), ['XML0002']);
const originalFile = snapshot().last.diagnostics[0].source.file;
const originalColumn = snapshot().last.diagnostics[0].source.range.start.column;
rejected.diagnostics[0].source.file = 'changed';
rejected.diagnostics[0].source.range.start.column = 900;
assert.equal(snapshot().last.diagnostics[0].source.file, originalFile);
assert.equal(snapshot().last.diagnostics[0].source.range.start.column, originalColumn);
const calls = snapshot().calls;
const invalid = analyzeXml(text, 'good.xml', { ...options, policy: { ...policy, roots: [] } });
assert.deepEqual(invalid.diagnostics.map(value => value.code), ['XUI0001']);
assert.equal(snapshot().calls, calls, 'invalid policies are rejected before syntax parsing');
const decorated = analyzeXml(text, 'private-extra-position.xml', options);
assert.equal(decorated.complete, true, 'extra backend position fields are ignored rather than spread or evaluated');
assert.equal(snapshot().extraReads, 0);
assert.doesNotMatch(JSON.stringify(decorated), /PRIVATE_BACKEND_POSITION|privateMarker|privateGetter/);
function positions(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) found.push(value.range.start, value.range.end);
  else for (const item of Object.values(value)) positions(item, found);
  return found;
}
for (const point of positions(decorated)) assert.deepEqual(Object.keys(point).sort(), ['column', 'line']);
const backend = snapshot().last;
const frameStart = backend.elements[1].source.range.start.column;
const bodyStart = backend.elements[2].openSource.range.end.column;
const bodyEnd = backend.elements[2].closeSource.range.start.column;
decorated.frames[0].source.range.start.column = 999;
decorated.scripts[0].body.source.range.start.column = 998;
decorated.scripts[0].body.source.range.end.column = 997;
assert.equal(backend.elements[1].source.range.start.column, frameStart);
assert.equal(backend.elements[2].openSource.range.end.column, bodyStart);
assert.equal(backend.elements[2].closeSource.range.start.column, bodyEnd);
assert.equal(backend.elements[1].source.range.start.privateMarker.value, 'PRIVATE_BACKEND_POSITION_OBJECT');
assert.equal(snapshot().extraReads, 0);
process.stdout.write('isolated XML provider backend checks passed\\n');
`);
    const result = spawnSync(process.execPath, [harness], { cwd: workspace, encoding: 'utf8', windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, 'isolated XML provider backend checks passed\n');
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
