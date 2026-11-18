/** Authored Windows attribute profiling. All filesystem inputs are temporary fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGraphFileHost } from '../../scripts/selected-source-native.mjs';
import { createWindowsPathInspector } from '../../scripts/selected-source-windows.mjs';
import { prepareGraphContext } from '../../scripts/selected-source-context.mjs';
const json = file => JSON.parse(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8'));
const context = prepareGraphContext({
  profile: json('docs/proposals/selected-source-graph-profile.json'),
  ...json('examples/classic-era-resolution-profile.json'),
  xmlPolicy: json('examples/xml-provider-profile.json').policy,
  inlineProfile: json('examples/xml-inline-lua-profile.json'),
  luaInputProfile: 'bounded',
});
assert.equal(process.platform, 'win32', 'The stock Windows inspector is required.');
const temp = fs.realpathSync(os.tmpdir());
const root = fs.mkdtempSync(path.join(temp, 'wow-sdk-attribute-profile-'));
const directories = [''];
const sources = new Map();
const phases = {};
let phase = 'bootstrap';
function inspectionSite(stack) {
  if (/\bat rootCheck\b/u.test(stack)) return 'rootAncestors';
  if (/\bat verifyCached\b/u.test(stack)) return 'cachedDirectory';
  if (/\bat scan\b/u.test(stack)) return /\bat statChecked\b/u.test(stack) ? 'scanBoundary' : 'scanEntries';
  if (/\bat resolve\b/u.test(stack)) return 'component';
  if (/\bat read\b/u.test(stack)) return 'readBoundary';
  return phase === 'bootstrap' ? 'bootstrap' : 'unclassified';
}
const inspectorFactory = () => {
  const inspector = createWindowsPathInspector();
  return {
    async inspect(paths, remaining) {
      const site = inspectionSite(new Error().stack);
      const sites = phases[phase] ??= {};
      const row = sites[site] ??= { calls: 0, paths: 0, milliseconds: 0 };
      row.calls++;
      row.paths += paths.length;
      const started = performance.now();
      try {
        return await inspector.inspect(paths, remaining);
      } finally {
        row.milliseconds += performance.now() - started;
      }
    },
    close: () => inspector.close(),
  };
};
let host;
try {
  for (let n = 0; n < 16; n++) {
    const addon = 'Demo' + n;
    for (const parts of [[addon], [addon, 'Lib'], [addon, 'Lib', 'Nested']]) {
      const key = path.join(...parts);
      directories.push(key);
      fs.mkdirSync(path.join(root, key));
    }
    for (let file = 0; file < 24; file++) {
      const key = path.join(addon, 'Lib', 'Nested', 'Part' + file + '.lua');
      fs.writeFileSync(path.join(root, key), 'Fixture = ' + file);
      if (file < 2) sources.set(key, 'Fixture = ' + file);
    }
  }
  host = await createGraphFileHost(root, context, { inspectorFactory });
  const issued = new Map();
  phase = 'coldDirectoryListing';
  for (const key of directories) issued.set(key, await host.listDirectory(key));
  phase = 'warmDirectoryListing';
  for (const key of directories) assert.deepEqual(await host.listDirectory(key), issued.get(key));
  phase = 'sourceReads';
  const fingerprints = new Map();
  for (const [key, content] of sources) {
    const reply = await host.readSource(key, 1024);
    assert.equal(reply.bytes.toString('utf8'), content);
    fingerprints.set(key, reply.fingerprint);
  }
  phase = 'directoryVerification';
  for (const [key, issuedDirectory] of issued) assert.equal(await host.verifyDirectory(key, issuedDirectory.fingerprint), true);
  phase = 'sourceVerification';
  for (const [key, fingerprint] of fingerprints) assert.equal(await host.verifySource(key, fingerprint, 1024), true);
  for (const sites of Object.values(phases)) {
    assert.equal(Object.hasOwn(sites, 'unclassified'), false);
    for (const row of Object.values(sites)) row.milliseconds = Math.round(row.milliseconds);
  }
  console.log(JSON.stringify({ directories: directories.length, sources: sources.size, phases, metrics: host.metrics() }));
} finally {
  try {
    if (host) await host.close();
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)), temp);
    assert.ok(path.basename(root).startsWith('wow-sdk-attribute-profile-'));
    fs.rmSync(root, { recursive: true });
  }
}
