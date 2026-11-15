#!/usr/bin/env node
/** API Extractor API-report runner; requires npm install and approved reports. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');
const exe = path.join(root,'node_modules','.bin',process.platform === 'win32' ? 'api-extractor.cmd' : 'api-extractor');
if (!fs.existsSync(exe)) { console.error('Run npm install before API Extractor'); process.exit(1); }
for (const name of ['diagnostics','addon-metadata','toc-parser','global-registry','toc-metadata-adapter']) {
  const args=['run','--config',`packages/${name}/api-extractor.json`];
  if (local) args.push('--local');
  const result = spawnSync(exe,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
  if (result.status !== 0) process.exit(result.status || 1);
}
