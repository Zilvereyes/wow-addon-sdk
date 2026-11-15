#!/usr/bin/env node
/** Compare compiled exported declaration files with reviewed baseline. */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const packages = ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter'];
const errors=[];
for (const name of packages) {
  const built=path.join(root,'packages',name,'dist','index.d.ts');
  const baseline=path.join(root,'api','baselines',`${name}.d.ts`);
  if (!existsSync(built) || !existsSync(baseline)) { errors.push(`missing compiled or baseline API for ${name}`); continue; }
  const normalize = x => readFileSync(x,'utf8').replace(/\r\n/g,'\n').trimEnd();
  if (normalize(built) !== normalize(baseline)) errors.push(`public API changed: ${name} (review change and update api/baselines)`);
}
if (errors.length) {
  for (const error of errors) console.error(`API ERROR: ${error}`);
  process.exitCode = 1;
} else console.log(`API snapshot PASS: ${packages.length} public declaration surfaces match reviewed v0.2.0 baseline`);
