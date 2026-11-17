#!/usr/bin/env node
/** Offline, fail-closed TypeScript import and package-boundary audit. */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const packagesDir = path.join(root, 'packages');
const allowed = new Map([
  ['diagnostics', []],
  ['addon-metadata', ['diagnostics']],
  ['toc-parser', ['diagnostics','addon-metadata']],
  ['global-registry', ['diagnostics']],
  ['toc-metadata-adapter', ['diagnostics','addon-metadata','global-registry']],
  ['lua-analysis', ['diagnostics','global-registry']],
  ['xml-parser', ['diagnostics']],
]);
const external = new Map([
  ['lua-analysis', { luaparse: '0.3.1' }],
  ['xml-parser', { saxes: '6.0.0', xmlchars: '2.2.0' }],
]);
const errors = [];
const pkgNames = [...allowed.keys()];
const packagePrefix = '@wow-addon/';
const rootVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (typeof rootVersion !== 'string' || rootVersion.length === 0) errors.push('root package requires a version');

function allSources(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(dirent => {
    const full = path.join(dir, dirent.name);
    return dirent.isDirectory() ? allSources(full) : dirent.isFile() && full.endsWith('.ts') ? [full] : [];
  });
}

for (const [name, permitted] of allowed) {
  const folder = path.join(packagesDir, name);
  if (!fs.existsSync(folder)) { errors.push(`${name}: missing package`); continue; }
  const pkg = JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));
  const tsconfig = JSON.parse(fs.readFileSync(path.join(folder,'tsconfig.json'),'utf8'));
  if (pkg.version !== rootVersion) errors.push(`${name}: workspace version must match root version ${rootVersion}`);
  const declared = Object.keys(pkg.dependencies ?? {}).filter(dep => dep.startsWith(packagePrefix)).map(dep => dep.slice(packagePrefix.length));
  for (const [dep, version] of Object.entries(pkg.dependencies ?? {})) {
    if (dep.startsWith(packagePrefix) && version !== rootVersion) {
      errors.push(`${name}: internal dependency ${dep} requires exact root version ${rootVersion}`);
    }
  }
  const approvedExternal = external.get(name) ?? {};
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!dep.startsWith(packagePrefix) && !Object.hasOwn(approvedExternal, dep)) {
      errors.push(`${name}: forbidden declared external dependency ${dep}`);
    }
  }
  for (const [dep, version] of Object.entries(approvedExternal)) {
    if (pkg.dependencies?.[dep] !== version) errors.push(`${name}: ${dep} requires exact version ${version}`);
  }
  const referenced = (tsconfig.references ?? []).map(ref => path.basename(ref.path));
  for (const dep of [...declared, ...referenced]) {
    if (!permitted.includes(dep)) errors.push(`${name}: forbidden declared dependency ${dep}`);
  }
  for (const dep of declared) {
    if (!referenced.includes(dep)) errors.push(`${name}: dependency ${dep} is missing from tsconfig.references`);
  }
  for (const dep of referenced) {
    if (!declared.includes(dep)) errors.push(`${name}: tsconfig reference ${dep} is missing from package dependencies`);
  }
  for (const file of allSources(path.join(folder,'src'))) {
    const content = fs.readFileSync(file,'utf8');
    const ast = ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const specs = [];
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specs.push(node.moduleSpecifier.text);
      }
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
        specs.push(node.moduleReference.expression.text);
      }
      if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        if (ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)) {
          specs.push(argument.literal.text);
        } else {
          errors.push(`ARCH0001: non-static module type import (${path.relative(root,file)})`);
        }
      }
      if (ts.isCallExpression(node)) {
        const importCall = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const requireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require';
        if (importCall || requireCall) {
          const target = node.arguments[0];
          // import(specifier, options) remains auditable; require() stays single-argument.
          const validArity = importCall
            ? node.arguments.length === 1 || node.arguments.length === 2
            : node.arguments.length === 1;
          if (!validArity || !target || !ts.isStringLiteral(target)) {
            errors.push(`ARCH0001: non-static module load (${path.relative(root,file)})`);
          } else {
            specs.push(target.text);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    for (const spec of specs) {
      if (name === 'diagnostics') errors.push(`diagnostics must not import: ${spec} (${path.relative(root,file)})`);
      if (spec.startsWith(packagePrefix)) {
        const target = spec.slice(packagePrefix.length).split('/')[0];
        if (!permitted.includes(target)) errors.push(`${name} cannot import ${spec} (${path.relative(root,file)})`);
        if (!declared.includes(target)) errors.push(`${name} imports undeclared dependency ${spec}`);
      } else if (spec.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), spec);
        const here = path.resolve(folder) + path.sep;
        if (!resolved.startsWith(here)) errors.push(`${name} imports outside its package: ${spec}`);
      } else if (!Object.hasOwn(external.get(name) ?? {}, spec)) {
        errors.push(`${name} imports forbidden external module: ${spec}`);
      }
    }
  }
}
for (const entry of fs.readdirSync(packagesDir,{withFileTypes:true})) {
  if (entry.isDirectory() && !allowed.has(entry.name)) errors.push(`unapproved package directory: ${entry.name}`);
}
const rootTsconfig = JSON.parse(fs.readFileSync(path.join(root,'tsconfig.json'),'utf8'));
const refs = (rootTsconfig.references ?? []).map(x=>path.basename(x.path));
for (const name of pkgNames) if (!refs.includes(name)) errors.push(`root tsconfig missing ${name}`);
for (const name of refs) if (!allowed.has(name)) errors.push(`root tsconfig references unknown package ${name}`);
// Separate cycle audit of declared dependencies, not just the approved DAG.
const marks = new Map();
function dfs(name, ancestors) {
  if (marks.get(name) === 'done') return;
  if (ancestors.includes(name)) { errors.push(`cycle: ${[...ancestors,name].join(' -> ')}`); return; }
  const file = path.join(packagesDir,name,'package.json');
  if (fs.existsSync(file)) {
    const pkg = JSON.parse(fs.readFileSync(file,'utf8'));
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (dep.startsWith(packagePrefix)) dfs(dep.slice(packagePrefix.length), [...ancestors,name]);
    }
  }
  marks.set(name,'done');
}
for (const name of pkgNames) dfs(name, []);
if (errors.length) {
  for (const error of errors) console.error(`ARCHITECTURE ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture PASS: ${pkgNames.length} packages, allowed internal imports, declarations and acyclic references`);
}
