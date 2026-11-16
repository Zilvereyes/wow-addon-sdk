import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseToc } from '@wow-addon/toc-parser';
import { buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { listGlobals } from '@wow-addon/global-registry';

const runner = path.resolve('scripts/run-tests.mjs');
test('test discovery rejects an empty test directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-empty-'));
  try {
    const r = spawnSync(process.execPath, [runner, root], {encoding:'utf8'});
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/No .*test\.mjs files discovered/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('test discovery runs only *.test.mjs and propagates failed assertions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-tests-'));
  try {
    fs.writeFileSync(path.join(root,'correct.test.mjs'), "import {test} from 'node:test';import assert from 'node:assert/strict';test('intentional failure',()=>assert.equal(1,2));\n");
    fs.writeFileSync(path.join(root,'not-a-test.mjs'), "throw Error('not-a-test must not be executed');\n");
    const r = spawnSync(process.execPath, [runner,root], {encoding:'utf8'});
    assert.notEqual(r.status,0);
    assert.match(r.stdout,/intentional failure/);
    assert.doesNotMatch(r.stdout+r.stderr,/not-a-test must not be executed/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('BOM, mixed endings, multiple Interface values and custom fields', () => {
  const content = '\uFEFF## Interface: 120100, 120105\r\n## X-Vendor: First\n## X-Vendor: Second\r## Title: 🧪 Data\r\n';
  const result = parseToc(content, 'Addon/Addon.toc');
  assert.deepEqual(result.metadata.interfaceVersions,['120100','120105']);
  assert.deepEqual(result.metadata.customMetadata['X-Vendor'],['First','Second']);
  assert.equal(result.diagnostics.length,0);
  const title=result.entries.find(e=>e.directive?.normalizedName==='title');
  assert.ok(title);
  assert.equal(title.source.range.end.column,'## Title: 🧪 Data'.length);
});
test('empty and malformed CSV SavedVariables never enter the global registry', () => {
  const result = parseToc('## SavedVariables:\n## SavedVariables: Foo,,123Test,Foo-Bar\n## SavedVariablesPerCharacter:', 'X/X.toc');
  assert.ok(result.diagnostics.some(d=>d.code==='TOC0004'));
  assert.ok(result.diagnostics.some(d=>d.code==='TOC0003'));
  assert.deepEqual(listGlobals(buildTocGlobalRegistry([result.metadata])),['Foo']);
});
test('conditional globals remain opt-in', () => {
  const result = parseToc('## SavedVariables[AllowLoadGameType Classic]: DB','X/X.toc');
  const reg = buildTocGlobalRegistry([result.metadata]);
  assert.deepEqual(listGlobals(reg),[]);
  assert.deepEqual(listGlobals(reg,{includeConditional:true}),['DB']);
});
