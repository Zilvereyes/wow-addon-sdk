import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as metadata from '@wow-addon/addon-metadata';
import { parseToc } from '@wow-addon/toc-parser';
import { toGlobalDeclarations } from '@wow-addon/toc-metadata-adapter';

test('v0.3.0 exports independent environment schema and preserves metadata schema 2', () => {
  assert.equal(metadata.CLIENT_ENVIRONMENT_SCHEMA_VERSION, 1);
  assert.equal(metadata.METADATA_SCHEMA_VERSION, 2);
  const parsed = parseToc('## SavedVariables: DB', 'A/A_Vanilla.toc').metadata;
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(Object.hasOwn(parsed, 'logicalAddonId'), false);
  assert.equal(Object.hasOwn(parsed, 'environment'), false);
  assert.equal(toGlobalDeclarations([parsed])[0].addonId, 'A/A_Vanilla.toc');
});

test('public environment and identity types enforce required, readonly and optional contracts', () => {
  const result = spawnSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--exactOptionalPropertyTypes',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'tests/contracts/v030.ts',
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('caller identity recipe preserves source variants, mixed paths, case and Unicode', () => {
  const logicalAddonId = 'installation/Å🧪';
  const paths = ['Å/Å_Mainline.toc', 'Å\\Å_Vanilla.toc', 'Å/Å_Classic.toc', 'Å\\mixed/Å.toc', 'å/Å.toc'];
  const variants = paths.map(tocPath => {
    const parsed = parseToc('', tocPath);
    return {
      logicalAddonId, tocVariantId: JSON.stringify([logicalAddonId, tocPath]),
      tocPath, tocSuffix: parsed.metadata.tocSuffix, source: parsed.entries[0].source,
    };
  });
  assert.equal(new Set(variants.map(v => v.tocVariantId)).size, paths.length);
  assert.deepEqual(variants.map(v => v.tocPath), paths);
  assert.deepEqual(variants.map(v => v.tocSuffix), ['Mainline', 'Vanilla', 'Classic', null, null]);
  assert.deepEqual(JSON.parse(JSON.stringify(variants)), variants);
  assert.deepEqual(variants.map(v => JSON.parse(v.tocVariantId)), paths.map(p => [logicalAddonId, p]));
});

test('unknown environment data survives JSON without injecting game mode or locale defaults', () => {
  const environment = {
    schemaVersion: metadata.CLIENT_ENVIRONMENT_SCHEMA_VERSION,
    client: metadata.WoWClient.Unknown, clientFamily: 'unknown', gameType: 'future-type',
  };
  const restored = JSON.parse(JSON.stringify(environment));
  assert.deepEqual(restored, environment);
  assert.equal(Object.hasOwn(restored, 'gameMode'), false);
  assert.equal(Object.hasOwn(restored, 'textLocale'), false);
});
