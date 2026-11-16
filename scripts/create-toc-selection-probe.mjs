#!/usr/bin/env node
/** Author synthetic client probes in a NEW staging directory, never in AddOns. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const [outputArgument, interfaceVersion, ...extra] = process.argv.slice(2);
if (!outputArgument || outputArgument.startsWith('--') || !interfaceVersion ||
    !/^[1-9][0-9]{0,8}$/u.test(interfaceVersion) || extra.length) {
  console.error('Usage: node scripts/create-toc-selection-probe.mjs <new-staging-directory> <Interface-version>');
  process.exit(2);
}

const scenarios = [
  { id: 'EraAll', suffixes: ['Vanilla', 'Classic', null] },
  { id: 'EraFamily', suffixes: ['Classic', null] },
  { id: 'EraSpecific', suffixes: ['Vanilla', null] },
  { id: 'MainlineAll', suffixes: ['Standard', 'Mainline', null] },
  { id: 'MainlineFamily', suffixes: ['Mainline', null] },
  { id: 'Unsuffixed', suffixes: [null] },
  { id: 'FutureFallback', suffixes: ['SDKFuture', null] },
  { id: 'Headings', suffixes: [null] },
];

function markerLua(id, variant) {
  return `-- Authored SDK client-observation marker; outputs only this probe's metadata/build.
local addonName = ...
local version, build, buildDate, interfaceVersion = GetBuildInfo()
local getMetadata = (C_AddOns and C_AddOns.GetAddOnMetadata) or GetAddOnMetadata
local custom = getMetadata and getMetadata(addonName, "X-SDK.Probe-1.0") or "api-unavailable"
print("SDK_TOC_PROBE|schema=1|case=${id}|variant=${variant}"
    .. "|version=" .. tostring(version) .. "|build=" .. tostring(build)
    .. "|interface=" .. tostring(interfaceVersion) .. "|project=" .. tostring(WOW_PROJECT_ID)
    .. "|custom=" .. tostring(custom))
`;
}

try {
  const output = path.resolve(outputArgument);
  // Resolve the existing parent so a junction/symlink alias cannot target AddOns.
  const parent = fs.realpathSync(path.dirname(output));
  const resolvedOutput = path.join(parent, path.basename(output));
  if (resolvedOutput.split(/[\\/]+/u).some(segment => segment.toLowerCase() === 'addons')) {
    console.error('Probe staging must be outside every AddOns directory. Installation is a separate user action.');
    process.exit(1);
  }
  // No recursive mkdir, overwrite option, copy/install step or cleanup operation.
  fs.mkdirSync(resolvedOutput);
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const license = fs.readFileSync(path.join(repository, 'LICENSE'));
  const files = [];
  function write(relative, bytes) {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
    fs.writeFileSync(path.join(resolvedOutput, relative), data, { flag: 'wx' });
    files.push({ path: relative, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  }
  for (const scenario of scenarios) {
    const folder = `SDKProbe_${scenario.id}`;
    fs.mkdirSync(path.join(resolvedOutput, folder));
    write(`${folder}/LICENSE`, license);
    for (const suffix of scenario.suffixes) {
      const variant = suffix ?? 'unsuffixed';
      const tocName = `${folder}${suffix === null ? '' : `_${suffix}`}.toc`;
      const marker = `Probe_${variant}.lua`;
      const headings = scenario.id === 'Headings' ? '## SDK probe section\n## XML\n' : '';
      write(`${folder}/${tocName}`, [
        `## Interface: ${interfaceVersion}`,
        `## Title: SDK TOC Probe ${scenario.id}`,
        '## Notes: Authored client evidence; no inferred expected winner',
        '## X-SDK.Probe-1.0: expected-v1',
        headings + marker,
        '',
      ].join('\n'));
      write(`${folder}/${marker}`, markerLua(scenario.id, variant));
    }
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  // The manifest is the final write: absent manifest means incomplete staging.
  fs.writeFileSync(path.join(resolvedOutput, 'probe.ready.json'), JSON.stringify({
    schemaVersion: 1, interfaceVersion, runtimeVerified: false, scenarios, files,
  }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'created', scenarios: scenarios.length, files: files.length, runtimeVerified: false }));
} catch (error) {
  // Leave partial staging intact without a ready manifest; never delete user data.
  console.error(`Probe generation failed (${typeof error.code === 'string' ? error.code : 'generation-error'}); no installation was performed.`);
  process.exitCode = 1;
}
