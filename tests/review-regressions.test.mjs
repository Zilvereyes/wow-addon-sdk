import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseToc } from '@wow-addon/toc-parser';
import { buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { listGlobals } from '@wow-addon/global-registry';

// A typo in header conditions must not become an unconditional Lua global.
test('unknown header annotations cause diagnostics without unconditional globals', () => {
  const parsed = parseToc('## SavedVariables[AllowLoadGameTyp vanilla]: DB', 'Test/Test.toc');
  assert.ok(parsed.diagnostics.some(d => d.code === 'TOC0001' && d.severity === 'error'));
  assert.deepEqual(listGlobals(buildTocGlobalRegistry([parsed.metadata])), []);
  assert.equal(parsed.entries[0].kind, 'invalid');
});
test('valid condition adjacent to an invalid condition never leaks globals', () => {
  const parsed = parseToc('## SavedVariables[AllowLoadGameType vanilla][AllowLoadGameTyp classic]: DB', 'Test/Test.toc');
  assert.ok(parsed.diagnostics.some(d => d.code === 'TOC0001'));
  assert.deepEqual(parsed.metadata.savedVariableDeclarations, []);
});
// Missing trailing CSV cells must point after the last character, not at value start.
test('trailing empty SavedVariables list cell maps to the end of the value', () => {
  const parsed = parseToc('## SavedVariables: DB,', 'Test/Test.toc');
  const diagnostic = parsed.diagnostics.find(d => d.code === 'TOC0004');
  assert.deepEqual(diagnostic?.source.range, {
    start: { line:0, column:22 }, end: { line:0, column:22 },
  });
});
test('whitespace-only CSV cell reports the position after whitespace', () => {
  const parsed = parseToc('## SavedVariables: DB,   ', 'Test/Test.toc');
  const diagnostic = parsed.diagnostics.find(d => d.code === 'TOC0004');
  assert.deepEqual(diagnostic?.source.range, {
    start: { line:0, column:25 }, end: { line:0, column:25 },
  });
});
// Execute the actual audit on a synthetic workspace, including the approved
// optional Lua extension without changing the five core dependency boundaries.
const packages = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter','lua-analysis'];
function auditWithSource(packageName, contents, dependencies) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-audit-'));
  try {
    const scripts = path.join(root,'scripts');
    fs.mkdirSync(scripts,{ recursive:true });
    fs.copyFileSync(path.join(process.cwd(),'scripts/check-architecture.mjs'),path.join(scripts,'check-architecture.mjs'));
    fs.writeFileSync(path.join(root,'package.json'),'{"type":"module"}');
    fs.writeFileSync(path.join(root,'tsconfig.json'),JSON.stringify({ references:packages.map(name=>({path:'./packages/'+name})) }));
    const tsPath = fs.realpathSync(path.join(process.cwd(),'node_modules','typescript'));
    fs.mkdirSync(path.join(root,'node_modules'),{recursive:true});
    fs.symlinkSync(tsPath,path.join(root,'node_modules','typescript'),process.platform === 'win32' ? 'junction' : 'dir');
    for (const name of packages) {
      const folder = path.join(root,'packages',name);
      fs.mkdirSync(path.join(folder,'src'),{recursive:true});
      fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify({name:'@wow-addon/'+name,
        dependencies: name === packageName && dependencies !== undefined ? dependencies : name === 'lua-analysis' ? { luaparse: '0.3.1' } : {} }));
      fs.writeFileSync(path.join(folder,'tsconfig.json'),JSON.stringify({references:[]}));
      fs.writeFileSync(path.join(folder,'src','index.ts'),name === packageName ? contents : 'export {};');
    }
    return spawnSync(process.execPath,[path.join(scripts,'check-architecture.mjs')],{ cwd:root, encoding:'utf8' });
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
}
test('ImportTypeNode must not bypass forbidden dependency detection', () => {
  const result=auditWithSource('global-registry',"type M = import('@wow-addon/addon-metadata').AddOnMetadata;");
  assert.notEqual(result.status,0,result.stderr);
  assert.match(result.stderr,/global-registry cannot import @wow-addon\/addon-metadata/);
});
test('non-static dynamic import is refused', () => {
  const result=auditWithSource('addon-metadata',"const target = '@wow-addon/global-registry'; void import(target);");
  assert.notEqual(result.status,0,result.stderr);
  assert.match(result.stderr,/ARCH0001.*non-static module/);
});
test('non-static require is refused', () => {
  const result=auditWithSource('toc-parser',"declare const require: (id: string) => unknown; const target = 'fs'; require(target);");
  assert.notEqual(result.status,0,result.stderr);
  assert.match(result.stderr,/ARCH0001.*non-static module/);
});
test('dependency-free package passes architecture audit', () => {
  const result=auditWithSource('diagnostics','export const pi = 3;');
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Architecture PASS/);
});

test('only the approved Lua extension may import its exact pinned backend', () => {
  assert.equal(auditWithSource('lua-analysis', "import parser from 'luaparse';").status, 0);
  const forbidden = auditWithSource('toc-parser', "import parser from 'luaparse';");
  assert.notEqual(forbidden.status, 0);
  assert.match(forbidden.stderr, /forbidden external module/);
});

test('core runtime dependency declarations cannot bypass the boundary without imports', () => {
  const result = auditWithSource('toc-parser', 'export {};', { luaparse: '0.3.1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /forbidden declared external dependency/);
});

test('Lua backend version ranges and undeclared backends fail closed', () => {
  for (const dependencies of [{ luaparse: '^0.3.1' }, {}, { luaparse: '0.3.1', unexpected: '1.0.0' }]) {
    const result = auditWithSource('lua-analysis', 'export {};', dependencies);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exact version|forbidden declared external dependency/);
  }
});

// Copilot follow-up: both ends must map to original offsets across stripped annotations.
test('malformed separated TOC annotations map full original header span', () => {
  const parsed = parseToc('## SavedVariables[Bad][AllowLoadGameType vanilla][Oops]: DB', 'Test/Test.toc');
  const diagnostic = parsed.diagnostics.find(d => d.code === 'TOC0001');
  assert.deepEqual(diagnostic?.source.range, {
    start: { line: 0, column: 17 }, end: { line: 0, column: 55 },
  });
  assert.deepEqual(listGlobals(buildTocGlobalRegistry([parsed.metadata])), []);
});

test('malformed header annotation preserves original end after interleaved recognized conditions', () => {
  const input = '## SavedVariables[Bad][AllowLoadGameType vanilla][Oops]   : DB';
  const parsed = parseToc(input, 'Test/Test.toc');
  const diagnostic = parsed.diagnostics.find(d => d.code === 'TOC0001');
  assert.deepEqual(diagnostic?.source.range, {
    start: { line: 0, column: 17 }, end: { line: 0, column: 55 },
  });
});

test('architecture audit permits static local dynamic import with options', () => {
  const result = auditWithSource('addon-metadata', "void import('./index.js', {});");
  assert.equal(result.status, 0, result.stderr);
});

test('architecture audit still refuses a dynamic module target with options', () => {
  const result = auditWithSource('addon-metadata', "const target = '@wow-addon/global-registry'; void import(target, {});");
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /ARCH0001.*non-static module load/);
});

test('architecture audit preserves require single-argument rule', () => {
  const result = auditWithSource('addon-metadata', "declare const require: (...args: unknown[]) => unknown; void require('./index.js', {});");
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /ARCH0001.*non-static module load/);
});

test('architecture audit checks forbidden literal imports even with options', () => {
  const result = auditWithSource('addon-metadata', "void import('@wow-addon/global-registry', {});");
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /addon-metadata cannot import @wow-addon\/global-registry/);
});
