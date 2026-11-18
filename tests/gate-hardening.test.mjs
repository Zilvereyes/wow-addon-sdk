import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const packages = ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry',
  'toc-metadata-adapter', 'lua-analysis', 'xml-parser', 'xml-analysis'];
const repository = process.cwd();

// Audits operate on copied manifests/configs and authored sources. Corrupting
// a fixture never writes through a workspace/dependency link into this repo.
function fixture(run) {
  const temporary = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, 'wow-sdk-gate-hardening-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    for (const name of ['check-architecture.mjs', 'check-public-exports.mjs', 'run-api-extractor.mjs']) {
      fs.copyFileSync(path.join(repository, 'scripts', name), path.join(root, 'scripts', name));
    }
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ references: packages.map(name => ({ path: './packages/' + name })) }));
    fs.copyFileSync(path.join(repository, 'LICENSE'), path.join(root, 'LICENSE'));
    fs.copyFileSync(path.join(repository, 'package-lock.json'), path.join(root, 'package-lock.json'));
    for (const name of packages) {
      const target = path.join(root, 'packages', name);
      fs.mkdirSync(path.join(target, 'src'), { recursive: true });
      fs.mkdirSync(path.join(target, 'etc'));
      const manifest = JSON.parse(fs.readFileSync(path.join(repository, 'packages', name, 'package.json'), 'utf8'));
      manifest.version = '1.0.0';
      for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        if (dependency.startsWith('@wow-addon/')) manifest.dependencies[dependency] = '1.0.0';
      }
      fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest));
      for (const file of ['LICENSE', 'api-extractor.json', ...(name === 'xml-parser' ? ['THIRD-PARTY-NOTICES.txt'] : [])]) {
        fs.copyFileSync(path.join(repository, 'packages', name, file), path.join(target, file));
      }
      fs.writeFileSync(path.join(target, 'tsconfig.json'), JSON.stringify({ references: Object.keys(manifest.dependencies ?? {})
        .filter(name => name.startsWith('@wow-addon/')).map(name => ({ path: '../' + name.slice('@wow-addon/'.length) })) }));
      fs.writeFileSync(path.join(target, 'src/index.ts'), 'export {};\n');
      fs.writeFileSync(path.join(target, 'etc', name + '.api.md'), 'AUTHORED_REPORT_MUST_NOT_BE_REWRITTEN\n');
    }
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.symlinkSync(fs.realpathSync(path.join(repository, 'node_modules/typescript')),
      path.join(root, 'node_modules/typescript'), process.platform === 'win32' ? 'junction' : 'dir');
    for (const name of ['luaparse', 'saxes', 'xmlchars']) {
      fs.cpSync(path.join(repository, 'node_modules', name), path.join(root, 'node_modules', name), { recursive: true });
    }
    const extractor = path.join(root, 'node_modules/@microsoft/api-extractor');
    fs.mkdirSync(extractor, { recursive: true });
    fs.writeFileSync(path.join(extractor, 'package.json'), JSON.stringify({ bin: { 'api-extractor': './fixture.cjs' } }));
    fs.writeFileSync(path.join(extractor, 'fixture.cjs'), "process.stdout.write('AUTHORED_EXTRACTOR_INVOKED\\n');\n");
    const audit = script => spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
      cwd: root, encoding: 'utf8', windowsHide: true,
    });
    const edit = (relative, change) => {
      const file = path.join(root, relative);
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      change(value);
      fs.writeFileSync(file, JSON.stringify(value));
    };
    run({ root, audit, edit });
  } finally {
    assert.equal(path.dirname(path.resolve(root)), temporary);
    assert.ok(path.basename(root).startsWith('wow-sdk-gate-hardening-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('gate hardening fixtures preserve legitimate dependency, export and strict-report controls', () => fixture(({ audit }) => {
  for (const script of ['check-architecture.mjs', 'check-public-exports.mjs', 'run-api-extractor.mjs']) {
    const result = audit(script);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    if (script === 'run-api-extractor.mjs') assert.equal(result.stdout.match(/AUTHORED_EXTRACTOR_INVOKED/gu)?.length, 8);
  }
}));

test('architecture requires each root reference to resolve to its approved package config', () => fixture(({ audit, edit }) => {
  edit('tsconfig.json', config => {
    config.references.find(ref => ref.path === './packages/diagnostics').path = './examples/diagnostics';
  });
  const result = audit('check-architecture.mjs');
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /root tsconfig.*unknown package target/);
  assert.match(result.stderr, /root tsconfig missing diagnostics/);
}));

test('architecture requires a dependency reference to resolve relative to the owning package', () => fixture(({ audit, edit }) => {
  edit('packages/toc-parser/tsconfig.json', config => {
    config.references.find(ref => ref.path === '../diagnostics').path = '../../examples/diagnostics';
  });
  const result = audit('check-architecture.mjs');
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /toc-parser tsconfig.*unknown package target/);
  assert.match(result.stderr, /toc-parser: dependency diagnostics is missing from tsconfig.references/);
}));

test('architecture accepts explicit default config paths and rejects duplicate target references', () => fixture(({ audit, edit }) => {
  edit('tsconfig.json', config => { config.references[0].path += '/tsconfig.json'; });
  edit('packages/toc-parser/tsconfig.json', config => { config.references[0].path += '/tsconfig.json'; });
  const valid = audit('check-architecture.mjs');
  assert.equal(valid.error, undefined);
  assert.equal(valid.status, 0, valid.stderr);
  edit('packages/toc-parser/tsconfig.json', config => {
    config.references.push({ path: config.references[0].path.replace('/tsconfig.json', '') });
  });
  const duplicate = audit('check-architecture.mjs');
  assert.equal(duplicate.error, undefined);
  assert.equal(duplicate.status, 1, duplicate.stdout);
  assert.match(duplicate.stderr, /toc-parser tsconfig.*duplicate reference to/);
}));

test('architecture and export gates reject alternative SDK runtime dependency fields', () => {
  for (const [field, value] of [
    ['optionalDependencies', { luaparse: '0.3.1' }],
    ['peerDependencies', { luaparse: '0.3.1' }],
    ['bundledDependencies', ['@wow-addon/diagnostics']],
    ['bundleDependencies', true],
    ['optionalDependencies', { '@wow-addon/xml-analysis': '1.0.0' }],
  ]) fixture(({ audit, edit }) => {
    edit('packages/toc-parser/package.json', manifest => { manifest[field] = value; });
    for (const script of ['check-architecture.mjs', 'check-public-exports.mjs']) {
      const result = audit(script);
      assert.notEqual(result.status, 0, `${script} accepted ${field}`);
      assert.match(result.stderr, /unsupported runtime dependency field/);
    }
  });
});

test('strict Extractor runner refuses disabled or redirected committed reports before invoking its CLI', () => {
  for (const change of [
    config => { config.apiReport.enabled = false; },
    config => { delete config.apiReport; },
    config => { config.apiReport.reportFolder = '<projectFolder>/unreviewed'; },
    config => { config.apiReport.reportTempFolder = '<projectFolder>/etc'; },
    config => { config.apiReport.reportFileName = 'unreviewed'; },
    config => { config.mainEntryPointFilePath = '<projectFolder>/dist/private.d.ts'; },
    config => { config.extends = './unreviewed.json'; },
    config => { config.projectFolder = '<projectFolder>/unreviewed'; },
    config => { config.apiReport.reportVariants = []; },
  ]) fixture(({ root, audit, edit }) => {
    edit('packages/diagnostics/api-extractor.json', change);
    const report = path.join(root, 'packages/diagnostics/etc/diagnostics.api.md');
    const before = fs.readFileSync(report, 'utf8');
    const result = audit('run-api-extractor.mjs');
    assert.notEqual(result.status, 0, 'runner accepted a disabled/redirected report');
    assert.match(result.stderr, /unreviewed API Extractor configuration/);
    assert.doesNotMatch(result.stdout, /AUTHORED_EXTRACTOR_INVOKED/);
    assert.equal(fs.readFileSync(report, 'utf8'), before);
  });
});

test('strict Extractor preflights a later package before invoking any package CLI', () => fixture(({ audit, edit }) => {
  edit('packages/xml-analysis/api-extractor.json', config => { config.apiReport.reportTempFolder = '<projectFolder>/etc'; });
  const result = audit('run-api-extractor.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unreviewed API Extractor configuration/);
  assert.doesNotMatch(result.stdout, /AUTHORED_EXTRACTOR_INVOKED/);
}));

function redirect(root, packageName, body) {
  const file = path.join(root, 'node_modules', packageName, 'unreviewed.cjs');
  const marker = path.join(root, 'backend-must-not-execute.txt');
  fs.writeFileSync(file, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'UNREVIEWED');\n${body}\n`);
  return marker;
}

test('backend provenance gate rejects runtime main redirects without executing the redirected module', () => {
  for (const [name, reviewed] of [['luaparse', 'luaparse.js'], ['saxes', 'saxes.js'], ['xmlchars', 'xmlchars.js']]) {
    fixture(({ root, audit, edit }) => {
      const marker = redirect(root, name, `module.exports = require('./${reviewed}');`);
      edit(`node_modules/${name}/package.json`, manifest => { manifest.main = 'unreviewed.cjs'; });
      const result = audit('check-public-exports.mjs');
      assert.notEqual(result.status, 0, `${name} runtime redirect was accepted`);
      assert.match(result.stderr, /unreviewed backend entry point/);
      assert.equal(fs.existsSync(marker), false, 'audit must resolve metadata without executing backend code');
    });
  }
});

test('backend provenance rejects ESM-only redirects even when require resolves to reviewed bytes', () => fixture(({ root, audit, edit }) => {
  const marker = redirect(root, 'saxes', "module.exports = require('./saxes.js');");
  edit('node_modules/saxes/package.json', manifest => {
    manifest.exports = { '.': { import: './unreviewed.cjs', require: './saxes.js' }, './package.json': './package.json' };
  });
  const result = audit('check-public-exports.mjs');
  assert.notEqual(result.status, 0, 'ESM condition bypassed require-only provenance checks');
  assert.match(result.stderr, /unreviewed backend entry point/);
  assert.equal(fs.existsSync(marker), false);
}));

test('backend provenance rejects unsupported alternate loader metadata without importing code', () => {
  for (const [field, value] of [['module', './unreviewed.cjs'], ['browser', './unreviewed.cjs'], ['type', 'module']]) {
    fixture(({ root, audit, edit }) => {
      const marker = redirect(root, 'saxes', "module.exports = require('./saxes.js');");
      edit('node_modules/saxes/package.json', manifest => { manifest[field] = value; });
      const result = audit('check-public-exports.mjs');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /unreviewed backend entry point/);
      assert.equal(fs.existsSync(marker), false);
    });
  }
});

test('backend provenance binds the xmlchars deep modules actually consumed by saxes', () => fixture(({ root, audit, edit }) => {
  const marker = redirect(root, 'xmlchars', "module.exports = require('./xml/1.0/ed5.js');");
  edit('node_modules/xmlchars/package.json', manifest => {
    manifest.exports = { '.': './xmlchars.js', './package.json': './package.json',
      './xml/1.0/ed5': './unreviewed.cjs', './xml/1.1/ed2': './xml/1.1/ed2.js', './xmlns/1.0/ed3': './xmlns/1.0/ed3.js' };
  });
  const result = audit('check-public-exports.mjs');
  assert.notEqual(result.status, 0, 'redirected xmlchars character classifier was accepted');
  assert.match(result.stderr, /unreviewed backend entry point/);
  assert.equal(fs.existsSync(marker), false);
}));

test('public exports gate requires the declared workspace entry points', () => {
  for (const [field, value] of [
    ['type', 'commonjs'],
    ['main', './dist/alternate.js'],
    ['types', './dist/alternate.d.ts'],
  ]) fixture(({ audit, edit }) => {
    edit('packages/toc-parser/package.json', manifest => { manifest[field] = value; });
    const result = audit('check-public-exports.mjs');
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stdout);
    assert.ok(result.stderr.includes('toc-parser: wrong package.json ' + field), result.stderr);
  });
});

test('backend provenance binds the lock version, integrity and registry URL', () => {
  const names = ['luaparse', 'saxes', 'xmlchars'];
  for (const [field, value] of [
    ['version', '0.0.0'],
    ['integrity', 'sha512-unreviewed'],
    ['resolved', 'https://example.invalid/backend.tgz'],
  ]) fixture(({ audit, edit }) => {
    edit('package-lock.json', lock => {
      for (const name of names) lock.packages['node_modules/' + name][field] = value;
    });
    const result = audit('check-public-exports.mjs');
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stdout);
    for (const name of names) {
      assert.ok(result.stderr.includes('lock artifact differs from reviewed ' + name + ' (' + field + ')'), result.stderr);
    }
  });
});

test('backend provenance requires one lock record at the approved install location', () => fixture(({ audit, edit }) => {
  edit('package-lock.json', lock => {
    lock.packages['packages/lua-analysis/node_modules/luaparse'] = lock.packages['node_modules/luaparse'];
    delete lock.packages['node_modules/luaparse'];
    lock.packages['packages/xml-parser/node_modules/saxes'] = lock.packages['node_modules/saxes'];
  });
  const result = audit('check-public-exports.mjs');
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stdout);
  for (const name of ['luaparse', 'saxes']) {
    assert.ok(result.stderr.includes('lock artifact differs from reviewed ' + name + ' (location)'), result.stderr);
  }
}));
