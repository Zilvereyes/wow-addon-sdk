#!/usr/bin/env node
/** Deterministically discover runnable tests on supported Node LTS versions. */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const testDir = path.resolve(process.argv[2] ?? path.join(root, 'tests'));
const files = [];
function collect(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(item.name)) collect(full);
    } else if (item.isFile() && /\.test\.mjs$/u.test(item.name)) files.push(full);
  }
}
if (!fs.existsSync(testDir) || !fs.statSync(testDir).isDirectory()) {
  console.error(`Test directory does not exist: ${testDir}`);
  process.exit(1);
}
collect(testDir);
files.sort();
if (files.length === 0) {
  console.error(`No *.test.mjs files discovered in ${testDir}; refusing a false-green run.`);
  process.exit(1);
}
console.log(`Running ${files.length} test file(s):`);
for (const file of files) console.log(`  ${path.relative(root, file)}`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
// Windows native/helper tests share the host's CPU with compiler/parser child
// processes. Serialize files so another test file cannot consume a fixed
// production worker deadline before its actual behavior is exercised.
const scheduling = process.platform === 'win32' ? ['--test-concurrency=1'] : [];
const result = spawnSync(process.execPath, ['--test', ...scheduling, ...files], {
  cwd: root, stdio: 'inherit', env
});
if (result.error) { console.error(result.error); process.exit(1); }
if (result.signal) { console.error(`Node tests terminated by ${result.signal}`); process.exit(1); }
process.exit(result.status ?? 1);
