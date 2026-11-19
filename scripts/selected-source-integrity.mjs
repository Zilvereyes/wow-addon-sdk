/** Read-only observer for one selected-source group run. Private tooling, never changes the host's results.
 *
 * It wraps a host, counts failures and verification outcomes per phase, and hashes every source the group read
 * with its own bounded reads: once before the host's first read of that source and once after the group ended.
 * Paths and file contents stay in memory. The returned summary holds counts, fixed labels and path-bound digests only.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBoundedFile} from './read-bounded-file.mjs';

export const INTEGRITY_PHASES = ['listDirectory', 'readSource', 'verifySource', 'verifyDirectory'];
const CODE = /^graph-native-[a-z]{1,24}$/u;
const CAPS = {'.toc': 8 * 1024 * 1024, '.xml': 4 * 1024 * 1024, '.lua': 128 * 1024 * 1024};
const sha = value => createHash('sha256').update(value).digest('hex');
const integer = value => Number.isSafeInteger(value) && value >= 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const emptyPhase = verifies => ({calls: 0, rejected: 0, ...(verifies ? {falseResults: 0, falseWithoutChange: 0} : {}), nativeCodes: {}});
export const emptyIntegrity = () => ({filesObserved: 0, hashUnavailable: 0, changedDuringGroup: 0, directoriesObserved: 0,
  contentDigestBefore: sha(''), contentDigestAfter: sha(''), phases: Object.fromEntries(INTEGRITY_PHASES.map(name =>
    [name, emptyPhase(name.startsWith('verify'))]))});

/** Independent content hash. Returns null when the file cannot be read within its bound. */
function hashFile(absolute) {
  try {return sha(readBoundedFile(absolute, CAPS[path.extname(absolute).toLowerCase()] ?? 1024 * 1024));}
  catch {return null;}
}
function snapshotDirectory(absolute) {
  try {return sha(fs.readdirSync(absolute, {withFileTypes: true}).map(entry => `${entry.isDirectory() ? 'd' : 'f'}:${entry.name}`).sort().join('\0'));}
  catch {return null;}
}
const bound = (key, hash) => sha(key + '\0' + (hash ?? 'unavailable'));

/** Wraps `host`; call `finish()` once after the analysis to hash again and obtain the count-only summary. */
export function observeGroupIntegrity(host, root) {
  const files = new Map(), directories = new Map(), phases = emptyIntegrity().phases;
  const absolute = key => path.join(root, key);
  const noteFailure = (phase, error) => {
    phases[phase].rejected++;
    const code = typeof error?.code === 'string' && CODE.test(error.code) ? error.code : 'other';
    phases[phase].nativeCodes[code] = (phases[phase].nativeCodes[code] ?? 0) + 1;
  };
  function remember(map, key, hasher) {if (!map.has(key)) map.set(key, hasher(absolute(key)));}
  const call = (phase, method, args, before) => async () => {
    phases[phase].calls++;
    before?.();
    try {return await method.apply(host, args);} catch (error) {noteFailure(phase, error); throw error;}
  };
  const wrapped = Object.create(host);
  for (const name of Object.keys(host)) if (typeof host[name] === 'function') wrapped[name] = host[name].bind(host);
  if (typeof host.listDirectory === 'function') wrapped.listDirectory = (key, ...rest) =>
    call('listDirectory', host.listDirectory, [key, ...rest], () => remember(directories, key, snapshotDirectory))();
  if (typeof host.readSource === 'function') wrapped.readSource = (key, ...rest) =>
    call('readSource', host.readSource, [key, ...rest], () => remember(files, key, hashFile))();
  if (typeof host.verifySource === 'function') wrapped.verifySource = async (key, ...rest) => {
    const result = await call('verifySource', host.verifySource, [key, ...rest])();
    if (result !== true) {
      phases.verifySource.falseResults++;
      if (files.has(key) && files.get(key) !== null && hashFile(absolute(key)) === files.get(key)) phases.verifySource.falseWithoutChange++;
    }
    return result;
  };
  if (typeof host.verifyDirectory === 'function') wrapped.verifyDirectory = async (key, ...rest) => {
    const result = await call('verifyDirectory', host.verifyDirectory, [key, ...rest])();
    if (result !== true) {
      phases.verifyDirectory.falseResults++;
      if (directories.has(key) && directories.get(key) !== null && snapshotDirectory(absolute(key)) === directories.get(key)) phases.verifyDirectory.falseWithoutChange++;
    }
    return result;
  };
  let finished = false;
  return {host: wrapped, finish() {
    if (finished) throw Error('Integrity observer already finished.');
    finished = true;
    const before = [], after = [];
    let unavailable = 0, changed = 0;
    for (const [key, hash] of files) {
      const later = hashFile(absolute(key));
      if (hash === null || later === null) unavailable++; else if (hash !== later) changed++;
      before.push(bound(key, hash)); after.push(bound(key, later));
    }
    return {filesObserved: files.size, hashUnavailable: unavailable, changedDuringGroup: changed, directoriesObserved: directories.size,
      contentDigestBefore: sha(before.sort().join('\n')), contentDigestAfter: sha(after.sort().join('\n')), phases};
  }};
}

/** Accepts only the fixed summary shape, so a receipt can never smuggle paths or messages. */
export function validIntegrity(value) {
  if (!record(value) || !['filesObserved', 'hashUnavailable', 'changedDuringGroup', 'directoriesObserved'].every(key => integer(value[key])) ||
    !/^[0-9a-f]{64}$/u.test(value.contentDigestBefore) || !/^[0-9a-f]{64}$/u.test(value.contentDigestAfter) || !record(value.phases)) return false;
  if (Object.keys(value).length !== 7 || Object.keys(value.phases).join() !== INTEGRITY_PHASES.join()) return false;
  return INTEGRITY_PHASES.every(name => {
    const phase = value.phases[name], keys = name.startsWith('verify') ? ['calls', 'rejected', 'falseResults', 'falseWithoutChange', 'nativeCodes'] : ['calls', 'rejected', 'nativeCodes'];
    return record(phase) && Object.keys(phase).join() === keys.join() && keys.slice(0, -1).every(key => integer(phase[key])) &&
      record(phase.nativeCodes) && Object.entries(phase.nativeCodes).every(([code, count]) => (code === 'other' || CODE.test(code)) && integer(count));
  });
}

/** Sums counts across groups. Digests are per group and are not merged. */
export function sumIntegrity(summaries) {
  const total = emptyIntegrity();
  delete total.contentDigestBefore; delete total.contentDigestAfter;
  let groupsWithChange = 0;
  for (const summary of summaries) {
    for (const key of ['filesObserved', 'hashUnavailable', 'changedDuringGroup', 'directoriesObserved']) total[key] += summary[key];
    if (summary.changedDuringGroup > 0) groupsWithChange++;
    for (const name of INTEGRITY_PHASES) {
      for (const [key, item] of Object.entries(summary.phases[name])) {
        if (key === 'nativeCodes') for (const [code, count] of Object.entries(item)) total.phases[name].nativeCodes[code] = (total.phases[name].nativeCodes[code] ?? 0) + count;
        else total.phases[name][key] += item;
      }
    }
  }
  return {...total, groupsWithChange};
}
