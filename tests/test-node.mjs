import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

export function runTestNode(args, timeout = 120000) {
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8', windowsHide: true, timeout, killSignal: 'SIGKILL',
  });
  if (result.error) throw result.error;
  return result;
}

export function verifyTypeScriptContract(fixture) {
  const result = runTestNode([
    'node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--exactOptionalPropertyTypes',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', fixture,
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
