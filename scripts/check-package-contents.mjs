#!/usr/bin/env node
/** Assert npm's actual dry-run file listing, not just package.json intent. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const names = ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry', 'toc-metadata-adapter'];
const expectedFiles = ['LICENSE', 'dist/index.d.ts', 'dist/index.js', 'package.json'];

export function validatePackageContents(listing, version) {
  const errors = [];
  // npm 10 (CI) returns an array; npm 12 returns a record keyed by package name.
  if (listing && typeof listing === 'object' && !Array.isArray(listing)) {
    if (!Object.entries(listing).every(([key, value]) => value?.name === key)) return ['invalid npm pack record'];
    listing = Object.values(listing);
  }
  if (!Array.isArray(listing)) return ['npm pack did not return an array'];
  if (listing.length !== names.length) errors.push('expected five workspace packages');
  for (const name of names) {
    const matches = listing.filter(item => item.name === `@wow-addon/${name}`);
    if (matches.length !== 1) { errors.push(`${name}: expected exactly one package`); continue; }
    const item = matches[0];
    if (item.version !== version) errors.push(`${name}: package version differs from root`);
    const files = (item.files ?? []).map(file => file.path).sort();
    for (const expected of expectedFiles) if (!files.includes(expected)) errors.push(`${name}: missing ${expected}`);
    for (const file of files) if (!expectedFiles.includes(file)) errors.push(`${name}: unexpected ${file}`);
    if (new Set(files).size !== files.length) errors.push(`${name}: duplicate file paths`);
  }
  return errors;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !fs.existsSync(npmCli)) {
    console.error('Run through npm run check:packages so npm_execpath identifies the installed npm CLI.');
    process.exitCode = 1;
  } else {
    const result = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--workspaces', '--ignore-scripts', '--json'], {
      cwd: root, encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
    });
    if (result.error || result.signal || result.status !== 0) {
      console.error('npm pack failed:', result.error?.message ?? result.signal ?? result.stderr);
      process.exitCode = 1;
    } else {
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const errors = validatePackageContents(JSON.parse(result.stdout), manifest.version);
        if (errors.length) { errors.forEach(error => console.error(`PACKAGE ERROR: ${error}`)); process.exitCode = 1; }
        else console.log('Package contents PASS: five workspaces, exactly four approved files each including LICENSE');
      } catch (error) { console.error(`Package validation failed: ${error.message}`); process.exitCode = 1; }
    }
  }
}
