import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, copyFileSync, mkdtempSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/launcher-reuse-prototype/', import.meta.url));

function run(executable, args, cwd) {
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(executable, args, {cwd, env, stdio: 'inherit', windowsHide: true});
  if (result.error) throw result.error;
  assert.equal(result.signal, null);
  return result.status;
}

test('isolated launcher comparison on authored inputs', {timeout: 420_000}, () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'wow-sdk-launcher-ci-'));
  cpSync(join(root, 'scripts'), join(sandbox, 'scripts'), {recursive: true});
  cpSync(join(root, 'examples'), join(sandbox, 'examples'), {recursive: true});
  symlinkSync(join(root, 'node_modules'), join(sandbox, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir');
  for (const role of ['client', 'worker']) {
    copyFileSync(join(sandbox, 'scripts', 'selected-source-analysis-' + role + '.mjs'),
      join(sandbox, 'scripts', 'prototype-analysis-' + role + '.mjs'));
  }
  assert.equal(run('git', ['-c', 'core.autocrlf=false', 'apply', '-p0', join(fixture, 'prototype.patch')], sandbox), 0);
  for (const file of ['measure-prototype.mjs', 'measure-prototype-memory.mjs', 'prototype-fault-controls.mjs']) {
    copyFileSync(join(fixture, file), join(sandbox, file));
  }
  const controls = run(process.execPath, ['--test', 'prototype-fault-controls.mjs'], sandbox);
  const compare = run(process.execPath, ['measure-prototype.mjs', '--ab'], sandbox);
  const memory = run(process.execPath, ['measure-prototype-memory.mjs'], sandbox);
  assert.deepEqual({controls, compare, memory}, {controls: 0, compare: 0, memory: 0});
});
