#!/usr/bin/env node
/** Enforce deliberate public entry points and package distribution contents. */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const expected = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter'];
const errors = [];
for (const name of expected) {
  const p = path.join(root,'packages',name,'package.json');
  const pkg = JSON.parse(fs.readFileSync(p,'utf8'));
  const keys = Object.keys(pkg.exports ?? {});
  if (keys.length !== 1 || keys[0] !== '.') errors.push(`${name}: exports must expose only '.'`);
  if (pkg.exports?.['.']?.types !== './dist/index.d.ts') errors.push(`${name}: wrong type entry point`);
  if (pkg.exports?.['.']?.default !== './dist/index.js') errors.push(`${name}: wrong runtime entry point`);
  if (JSON.stringify(pkg.files) !== JSON.stringify(['dist'])) errors.push(`${name}: publish only dist files`);
  if (pkg.license !== 'MIT') errors.push(`${name}: missing MIT license manifest`);
}
if (errors.length) { errors.forEach(x=>console.error(`PUBLIC EXPORT ERROR: ${x}`)); process.exitCode=1; }
else console.log(`Public exports PASS: ${expected.length} packages have explicit root entry points`);
