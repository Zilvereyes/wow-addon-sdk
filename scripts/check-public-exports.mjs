#!/usr/bin/env node
/** Enforce deliberate public entry points and package distribution contents. */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const expected = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter','lua-analysis','xml-parser','xml-analysis'];
const errors = [];
const expectedLicense = fs.readFileSync(path.join(root, 'LICENSE'));
for (const name of expected) {
  const p = path.join(root,'packages',name,'package.json');
  const pkg = JSON.parse(fs.readFileSync(p,'utf8'));
  const keys = Object.keys(pkg.exports ?? {});
  if (keys.length !== 1 || keys[0] !== '.') errors.push(`${name}: exports must expose only '.'`);
  const conditions = Object.keys(pkg.exports?.['.'] ?? {});
  if (conditions.length !== 2 || !conditions.includes('types') || !conditions.includes('default')) {
    errors.push(`${name}: root export conditions must be exactly types and default`);
  }
  if (pkg.exports?.['.']?.types !== './dist/index.d.ts') errors.push(`${name}: wrong type entry point`);
  if (pkg.exports?.['.']?.default !== './dist/index.js') errors.push(`${name}: wrong runtime entry point`);
  const publishFiles = name === 'xml-parser' ? ['dist', 'THIRD-PARTY-NOTICES.txt'] : ['dist'];
  if (JSON.stringify(pkg.files) !== JSON.stringify(publishFiles)) errors.push(`${name}: unexpected publish files`);
  if (pkg.license !== 'MIT') errors.push(`${name}: missing MIT license manifest`);
  const licensePath = path.join(root, 'packages', name, 'LICENSE');
  if (!fs.existsSync(licensePath)) errors.push(`${name}: missing publishable MIT LICENSE file`);
  else if (!fs.readFileSync(licensePath).equals(expectedLicense)) errors.push(`${name}: workspace LICENSE differs from repository LICENSE`);
}
// Only the optional Lua and XML packages have approved third-party runtime edges.
// Verify the installed artifact, not just a semver declaration or MIT label.
try {
  const requireFromLua = createRequire(path.join(root, 'packages/lua-analysis/package.json'));
  const manifestPath = requireFromLua.resolve('luaparse/package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const folder = path.dirname(manifestPath);
  const hash = file => createHash('sha256').update(fs.readFileSync(path.join(folder, file))).digest('hex');
  if (manifest.name !== 'luaparse' || manifest.version !== '0.3.1' || manifest.license !== 'MIT' ||
      Object.keys(manifest.dependencies ?? {}).length !== 0) errors.push('Lua backend manifest differs from the reviewed dependency');
  if (Object.keys(manifest.scripts ?? {}).some(name => /^(preinstall|install|postinstall|prepare)$/.test(name))) {
    errors.push('Lua backend has an unreviewed install lifecycle script');
  }
  if (hash('luaparse.js') !== '1c70940a6e46be63c84c285036925715f110bf06cbf058922372fb5c9d060b27') errors.push('Lua backend source differs from reviewed bytes');
  if (hash('LICENSE') !== 'bedf97319fd3fb51c22dc5a44daf603ca4b2515ae75cae8ac677fb6bd40ec34e') errors.push('Lua backend LICENSE differs from reviewed notice');
} catch {
  errors.push('Cannot verify the reviewed Lua backend artifact/license');
}
try {
  const requireFromXml = createRequire(path.join(root, 'packages/xml-parser/package.json'));
  const saxesManifestPath = requireFromXml.resolve('saxes/package.json');
  const saxesFolder = path.dirname(saxesManifestPath);
  const requireFromSaxes = createRequire(saxesManifestPath);
  const xmlcharsManifestPath = requireFromXml.resolve('xmlchars/package.json');
  const xmlcharsFolder = path.dirname(xmlcharsManifestPath);
  const saxes = JSON.parse(fs.readFileSync(saxesManifestPath, 'utf8'));
  const xmlchars = JSON.parse(fs.readFileSync(xmlcharsManifestPath, 'utf8'));
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (saxes.name !== 'saxes' || saxes.version !== '6.0.0' || saxes.license !== 'ISC' ||
      JSON.stringify(saxes.dependencies) !== JSON.stringify({ xmlchars: '^2.2.0' })) {
    errors.push('XML backend manifest differs from the reviewed dependency');
  }
  if (xmlchars.name !== 'xmlchars' || xmlchars.version !== '2.2.0' || xmlchars.license !== 'MIT' ||
      Object.keys(xmlchars.dependencies ?? {}).length !== 0) errors.push('XML character backend manifest differs from the reviewed dependency');
  if (requireFromSaxes.resolve('xmlchars/package.json') !== xmlcharsManifestPath) {
    errors.push('XML parser resolves a different character backend than its reviewed direct pin');
  }
  for (const manifest of [saxes, xmlchars]) {
    if (Object.keys(manifest.scripts ?? {}).some(name => /^(preinstall|install|postinstall|prepare)$/.test(name))) {
      errors.push('XML backend has an unreviewed install lifecycle script');
    }
    if (Object.keys(manifest.optionalDependencies ?? {}).length || Object.keys(manifest.peerDependencies ?? {}).length ||
        manifest.bundleDependencies?.length || manifest.bundledDependencies?.length) {
      errors.push('XML backend has unreviewed optional, peer or bundled dependencies');
    }
  }
  const reviewedRuntime = [
    [path.join(saxesFolder, 'saxes.js'), 'd00e2ba27ed7d6ac961d03ff14d6b8c0eb5bf063ed2c996c22c6df06ac121423'],
    [path.join(xmlcharsFolder, 'xmlchars.js'), 'd5024cfd86dc4624feda301419bb56f5f3bd2b63963c2bdf88aff7c6afb6bdf2'],
    [path.join(xmlcharsFolder, 'xml/1.0/ed5.js'), 'ea350479ab6f6553c0c3395c30ec440fb39821f6902081939831ddf1b5e8fd0f'],
    [path.join(xmlcharsFolder, 'xml/1.1/ed2.js'), '461d5c71cc6076dc16aebbfd2d3c506481df5a74f43631d82372a6ffdc239d69'],
    [path.join(xmlcharsFolder, 'xmlns/1.0/ed3.js'), 'ff14ffa3a2cdfdd1b6077c4a8443dc949f53d5bb56de5ed89d4dbc5d9fdf08f7'],
  ];
  for (const [file, digest] of reviewedRuntime) {
    if (hash(file) !== digest) errors.push('XML backend source differs from reviewed bytes');
  }
  if (hash(path.join(xmlcharsFolder, 'LICENSE')) !== '45d196313c2647d313cc65ca9b093d2d6974b64d35ee7346f2c60c9d518dff2c') {
    errors.push('XML character backend LICENSE differs from reviewed notice');
  }
  // The saxes npm artifact omits its license. This published SDK notice contains
  // the complete pinned upstream saxes notice followed by xmlchars' MIT notice.
  if (hash(path.join(root, 'packages/xml-parser/THIRD-PARTY-NOTICES.txt')) !==
      'b794316d83690e28cf0e1d3b618a704fdf331ff775288ad651a149831ee816fe') {
    errors.push('XML third-party notices differ from the complete reviewed license bytes');
  }
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  for (const [name, version, integrity] of [
    ['saxes', '6.0.0', 'sha512-xAg7SOnEhrm5zI3puOOKyy1OMcMlIJZYNJY7xLBwSze0UjhPLnWfj2GF2EpT0jmzaJKIWKHLsaSSajf35bcYnA=='],
    ['xmlchars', '2.2.0', 'sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw=='],
  ]) {
    const records = Object.entries(lock.packages ?? {}).filter(([key]) => key.endsWith(`node_modules/${name}`));
    if (records.length !== 1 || records[0][1].version !== version || records[0][1].integrity !== integrity) {
      errors.push(`XML backend lock artifact differs from reviewed ${name}`);
    }
  }
} catch {
  errors.push('Cannot verify the reviewed XML backend artifacts/licenses');
}
if (errors.length) { errors.forEach(x=>console.error(`PUBLIC EXPORT ERROR: ${x}`)); process.exitCode=1; }
else console.log(`Public exports PASS: ${expected.length} packages have explicit root entry points`);
