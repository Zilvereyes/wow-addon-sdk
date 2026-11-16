#!/usr/bin/env node
/** Enforce deliberate public entry points and package distribution contents. */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const expected = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter','lua-analysis'];
const errors = [];
const expectedLicense = fs.readFileSync(path.join(root, 'LICENSE'));
for (const name of expected) {
  const p = path.join(root,'packages',name,'package.json');
  const pkg = JSON.parse(fs.readFileSync(p,'utf8'));
  const keys = Object.keys(pkg.exports ?? {});
  if (keys.length !== 1 || keys[0] !== '.') errors.push(`${name}: exports must expose only '.'`);
  if (pkg.exports?.['.']?.types !== './dist/index.d.ts') errors.push(`${name}: wrong type entry point`);
  if (pkg.exports?.['.']?.default !== './dist/index.js') errors.push(`${name}: wrong runtime entry point`);
  if (JSON.stringify(pkg.files) !== JSON.stringify(['dist'])) errors.push(`${name}: publish only dist files`);
  if (pkg.license !== 'MIT') errors.push(`${name}: missing MIT license manifest`);
  const licensePath = path.join(root, 'packages', name, 'LICENSE');
  if (!fs.existsSync(licensePath)) errors.push(`${name}: missing publishable MIT LICENSE file`);
  else if (!fs.readFileSync(licensePath).equals(expectedLicense)) errors.push(`${name}: workspace LICENSE differs from repository LICENSE`);
}
// The optional Lua package is the sole approved third-party runtime edge.
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
if (errors.length) { errors.forEach(x=>console.error(`PUBLIC EXPORT ERROR: ${x}`)); process.exitCode=1; }
else console.log(`Public exports PASS: ${expected.length} packages have explicit root entry points`);
