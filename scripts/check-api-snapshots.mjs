#!/usr/bin/env node
/** Compare compiled exported declaration files with reviewed baseline. */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const packages = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter','lua-analysis','xml-parser','xml-analysis'];
const errors=[];
// Approved per-package beta root surfaces, including the five inline-Lua
// additions. The existing exports and runtime/type distinction are preserved.
const surfaces = new Map([
  ['diagnostics', [5, 0]], ['addon-metadata', [16, 4]], ['toc-parser', [2, 1]],
  ['global-registry', [11, 2]], ['toc-metadata-adapter', [18, 5]],
  ['lua-analysis', [5, 1]], ['xml-parser', [9, 1]], ['xml-analysis', [12, 2]],
]);
function checkSurface(name, filename) {
  const ast = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let total = 0, runtime = 0, beta = 0;
  if (ast.parseDiagnostics.length) errors.push(`invalid compiled declarations for ${name}`);
  for (const statement of ast.statements) {
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
      errors.push(`unreviewed public export shape for ${name}`);
      continue;
    }
    if (!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    let count = 1;
    if (ts.isVariableStatement(statement)) { count = statement.declarationList.declarations.length; runtime += count; }
    else if (ts.isFunctionDeclaration(statement) || ts.isEnumDeclaration(statement)) runtime++;
    else if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) {
      errors.push(`unreviewed public export shape for ${name}`);
    }
    total += count;
    if (ts.getJSDocTags(statement).some(tag => tag.tagName.text === 'beta')) beta += count;
  }
  const [expectedTotal, expectedRuntime] = surfaces.get(name);
  if (total !== expectedTotal || runtime !== expectedRuntime || beta !== expectedTotal) {
    errors.push(`public API surface for ${name} must retain ${expectedTotal} beta exports (${expectedRuntime} runtime); found ${total} exports, ${runtime} runtime, ${beta} beta`);
  }
}
for (const name of packages) {
  const built=path.join(root,'packages',name,'dist','index.d.ts');
  const baseline=path.join(root,'api','baselines',`${name}.d.ts`);
  if (!existsSync(built) || !existsSync(baseline)) { errors.push(`missing compiled or baseline API for ${name}`); continue; }
  const normalize = x => readFileSync(x,'utf8').replace(/\r\n/g,'\n').trimEnd();
  if (normalize(built) !== normalize(baseline)) errors.push(`public API changed: ${name} (review change and update api/baselines)`);
  checkSurface(name, built);
}
if (errors.length) {
  for (const error of errors) console.error(`API ERROR: ${error}`);
  process.exitCode = 1;
} else console.log(`API snapshot PASS: ${packages.length} declaration surfaces match reviewed baselines; 78 beta exports (16 runtime, 62 type-only)`);
