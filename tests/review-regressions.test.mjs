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
const packages = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter','lua-analysis','xml-parser'];
function auditWithSource(packageName, contents, dependencies, mutate = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-audit-'));
  try {
    const scripts = path.join(root,'scripts');
    fs.mkdirSync(scripts,{ recursive:true });
    fs.copyFileSync(path.join(process.cwd(),'scripts/check-architecture.mjs'),path.join(scripts,'check-architecture.mjs'));
    fs.writeFileSync(path.join(root,'package.json'),'{"type":"module","version":"1.0.0"}');
    fs.writeFileSync(path.join(root,'tsconfig.json'),JSON.stringify({ references:packages.map(name=>({path:'./packages/'+name})) }));
    const tsPath = fs.realpathSync(path.join(process.cwd(),'node_modules','typescript'));
    fs.mkdirSync(path.join(root,'node_modules'),{recursive:true});
    fs.symlinkSync(tsPath,path.join(root,'node_modules','typescript'),process.platform === 'win32' ? 'junction' : 'dir');
    for (const name of packages) {
      const folder = path.join(root,'packages',name);
      fs.mkdirSync(path.join(folder,'src'),{recursive:true});
      const declared = name === packageName && dependencies !== undefined ? dependencies : name === 'lua-analysis' ? { luaparse: '0.3.1' }
        : name === 'xml-parser' ? { saxes: '6.0.0', xmlchars: '2.2.0' } : {};
      fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify({name:'@wow-addon/'+name, version:'1.0.0', dependencies: declared }));
      fs.writeFileSync(path.join(folder,'tsconfig.json'),JSON.stringify({references:Object.keys(declared)
        .filter(name => name.startsWith('@wow-addon/')).map(name => ({path:'../'+name.slice('@wow-addon/'.length)}))}));
      fs.writeFileSync(path.join(folder,'src','index.ts'),name === packageName ? contents : 'export {};');
    }
    mutate(root);
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

test('architecture gate requires exact internal dependency and workspace versions matching the root', () => {
  const source = "import type { SourceReference } from '@wow-addon/diagnostics';";
  const valid = auditWithSource('addon-metadata', source, { '@wow-addon/diagnostics': '1.0.0' });
  assert.equal(valid.status, 0, valid.stderr);
  for (const version of ['0.9.0', '^1.0.0', 'workspace:*']) {
    const result = auditWithSource('addon-metadata', source, { '@wow-addon/diagnostics': version });
    assert.notEqual(result.status, 0, `unexpectedly accepted internal dependency ${version}`);
    assert.match(result.stderr, /internal dependency .* requires exact root version/);
  }
  const mismatched = auditWithSource('addon-metadata', source, { '@wow-addon/diagnostics': '1.0.0' }, root => {
    const file = path.join(root, 'packages/diagnostics/package.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.version = '0.9.0';
    fs.writeFileSync(file, JSON.stringify(manifest));
  });
  assert.notEqual(mismatched.status, 0, 'unexpectedly accepted a stale workspace version');
  assert.match(mismatched.stderr, /diagnostics: workspace version must match root version/);
});

test('XML backend pins are optional-extension-only and cannot add a core/Lua reverse edge', () => {
  assert.equal(auditWithSource('xml-parser', "import { SaxesParser } from 'saxes'; import * as chars from 'xmlchars';").status, 0);
  for (const name of ['diagnostics', 'toc-parser', 'lua-analysis']) {
    const result = auditWithSource(name, "import { parseXml } from '@wow-addon/xml-parser';");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot import|must not import/);
  }
  for (const name of ['toc-parser', 'lua-analysis']) {
    const result = auditWithSource(name, "import { SaxesParser } from 'saxes';");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden external module/);
  }
  for (const module of ['node:fs', 'node:child_process', 'node:http', '@wow-addon/global-registry']) {
    const result = auditWithSource('xml-parser', `import '${module}';`);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden external module|cannot import/);
  }
});

test('XML dependency ranges, omissions and extra runtime dependencies fail closed', () => {
  for (const dependencies of [
    {}, { saxes: '6.0.0' }, { saxes: '^6.0.0', xmlchars: '2.2.0' },
    { saxes: '6.0.0', xmlchars: '^2.2.0' }, { saxes: '6.0.0', xmlchars: '2.2.0', luaparse: '0.3.1' },
  ]) {
    const result = auditWithSource('xml-parser', 'export {};', dependencies);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exact version|forbidden declared external dependency/);
  }
});

// Copy the established gate and reviewed small dependency artifacts into a
// synthetic workspace. Corruption tests never modify the installed dependencies.
function auditPublicExports(mutate = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-export-audit-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.copyFileSync('scripts/check-public-exports.mjs', path.join(root, 'scripts/check-public-exports.mjs'));
    fs.copyFileSync('LICENSE', path.join(root, 'LICENSE'));
    fs.copyFileSync('package-lock.json', path.join(root, 'package-lock.json'));
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    for (const name of packages) {
      const target = path.join(root, 'packages', name);
      fs.mkdirSync(target, { recursive: true });
      for (const file of ['package.json', 'LICENSE', ...(name === 'xml-parser' ? ['THIRD-PARTY-NOTICES.txt'] : [])]) {
        fs.copyFileSync(path.join('packages', name, file), path.join(target, file));
      }
    }
    fs.mkdirSync(path.join(root, 'node_modules'));
    for (const name of ['luaparse', 'saxes', 'xmlchars']) {
      fs.cpSync(path.join('node_modules', name), path.join(root, 'node_modules', name), { recursive: true });
    }
    mutate(root);
    return spawnSync(process.execPath, [path.join(root, 'scripts/check-public-exports.mjs')], { cwd: root, encoding: 'utf8' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('public export gate rejects additional conditional entry points under the package root', () => {
  for (const condition of ['browser', 'node', 'import', 'require']) {
    const result = auditPublicExports(root => {
      const file = path.join(root, 'packages/lua-analysis/package.json');
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      // The private helper is already in the approved Lua packlist. An extra
      // condition can redirect a consumer without adding any tarball files.
      manifest.exports['.'] = { [condition]: './dist/syntax.js', ...manifest.exports['.'] };
      fs.writeFileSync(file, JSON.stringify(manifest));
    });
    assert.notEqual(result.status, 0, `unexpectedly accepted ${condition} entry point`);
    assert.match(result.stderr, /root export conditions must be exactly types and default/);
  }
});

test('public export gate verifies complete XML notices, exact lock artifacts and executable backend bytes', () => {
  const valid = auditPublicExports();
  assert.equal(valid.status, 0, valid.stderr);
  const notice = auditPublicExports(root => {
    fs.appendFileSync(path.join(root, 'packages/xml-parser/THIRD-PARTY-NOTICES.txt'), '\nchanged notice');
  });
  assert.notEqual(notice.status, 0);
  assert.match(notice.stderr, /complete reviewed license bytes/);
  const lock = auditPublicExports(root => {
    const file = path.join(root, 'package-lock.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    value.packages['node_modules/saxes'].integrity = 'sha512-unreviewed';
    fs.writeFileSync(file, JSON.stringify(value));
  });
  assert.notEqual(lock.status, 0);
  assert.match(lock.stderr, /lock artifact differs from reviewed saxes/);
  for (const file of ['saxes/saxes.js', 'xmlchars/xml/1.0/ed5.js', 'xmlchars/xmlns/1.0/ed3.js']) {
    const source = auditPublicExports(root => fs.appendFileSync(path.join(root, 'node_modules', file), '\n// changed artifact'));
    assert.notEqual(source.status, 0);
    assert.match(source.stderr, /XML backend source differs from reviewed bytes/);
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
