/** Resumable per-group selected-source runner. Private tooling, opt-in and read-only.
 *
 * Each requested group runs as its own single-group request with the unchanged profiles and limits.
 * A group receipt stores only the derived aggregate counts, a timing number, a source fingerprint and an input digest.
 * It never stores paths, addon identities, file names or error messages.
 * The final batch receipt is the sum of the per-group runs and is not one original full request.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {readBoundedFile} from './read-bounded-file.mjs';
import {prepareGraphContext} from './selected-source-context.mjs';
import {createSelectedSourceHost} from './selected-source-host.mjs';
import {analyzeSelectedSourceAggregate} from './selected-source-graph.mjs';

export const GROUPED_SCHEMA_VERSION = 1;
const RECEIPT_LIMIT = 1024 * 1024;
const GROUP_STATUSES = new Set(['passed', 'incomplete', 'failed']);
const FLAG_PATHS = new Set(['completeUnderPolicy', 'fullParsing', 'clientConformance', 'discovery.complete',
  'resolution.coreComplete', 'resolution.complete']);
const KEY = /^[A-Za-z][A-Za-z0-9]*$/u;
// Fixed, bounded codes only: legacy SGRAPH0005-style codes and the fixed graph-* and grouped-* transport codes.
const FAILURE_CODE = /^(?:[A-Za-z]{3,8}\d{4}|(?:graph|grouped)(?:-[a-z0-9]{1,24}){1,4})$/u;
const FINGERPRINT = /^[0-9a-f]{64}$/u;
const SOURCE_EXTENSIONS = /\.(?:toc|lua|xml)$/iu;
const SOURCE_FILE_LIMIT = 64 * 1024 * 1024;
const BATCH_FILE = 'batch-receipt.json';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const invalidReceipt = () => Object.assign(new Error('Invalid grouped receipt.'), {code: 'grouped-receipt'});

function sha256(value) {return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export const groupFileName = index => `group-${String(index + 1).padStart(4, '0')}.json`;
const failedFileName = index => `group-${String(index + 1).padStart(4, '0')}.failed.json`;

/** The digest binds one group to the exact profiles, policies and runtime label that produced its receipt. */
export function groupDigest(request, group, runtimeId = '') {
  return sha256({runtimeId, request: {...request, profile: {...request.profile, addons: [group]}}});
}

/**
 * Hashes the TOC, Lua and XML bytes of one group directory without following links. Only the digest is kept.
 * Returns null when the directory cannot be read completely, so an unverifiable group is never reused or accepted.
 * Non-source entries and linked directories are not part of the fingerprint; a linked source file makes it unverifiable.
 */
export function fingerprintGroup(root, group) {
  try {
    if (typeof group?.directory !== 'string' || group.directory.includes('\0')) return null;
    const base = path.resolve(root), directory = path.resolve(base, group.directory);
    if (directory === base || !directory.startsWith(base + path.sep)) return null;
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
    const files = [];
    const walk = relative => {
      for (const entry of fs.readdirSync(path.join(directory, relative), {withFileTypes: true})) {
        const child = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isSymbolicLink()) {
          if (SOURCE_EXTENSIONS.test(entry.name)) throw invalidReceipt();
        } else if (entry.isDirectory()) walk(child);
        else if (entry.isFile() && SOURCE_EXTENSIONS.test(entry.name)) files.push(child);
      }
    };
    walk('');
    files.sort();
    const hash = createHash('sha256');
    for (const file of files) {
      const bytes = readBoundedFile(path.join(directory, file), SOURCE_FILE_LIMIT);
      hash.update(`${file.split(path.sep).join('/')}\0${bytes.length}\0`);
      hash.update(createHash('sha256').update(bytes).digest());
    }
    return hash.digest('hex');
  } catch {return null;}
}

function safeFingerprint(fingerprint, root, group) {
  try {
    const value = fingerprint(root, group);
    return typeof value === 'string' && FINGERPRINT.test(value) ? value : null;
  } catch {return null;}
}

function checkedDirectory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || directory.includes('\0') ||
    /^(?:[\\/]{2}|[A-Za-z]+:\/\/)/u.test(directory)) throw invalidReceipt();
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw invalidReceipt();
  return directory;
}

function writeAtomic(directory, name, value) {
  const target = path.join(directory, name), temporary = path.join(directory, `${name}.${process.pid}.tmp`);
  const text = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(text) > RECEIPT_LIMIT) throw invalidReceipt();
  fs.writeFileSync(temporary, text, {flag: 'wx'});
  try {fs.renameSync(temporary, target);}
  catch (error) {fs.rmSync(temporary, {force: true}); throw error;}
}

/** Walks one fixed-shape aggregate, rejecting anything that is not a count, a flag or a keyed histogram. */
function visit(value, where, handle) {
  for (const key of Object.keys(value)) {
    if (!KEY.test(key)) throw invalidReceipt();
    const here = where ? `${where}.${key}` : key, item = value[key];
    if (record(item)) visit(item, here, handle);
    else handle(here, key, item, value);
  }
}

/** Sums fixed counts and histograms; complete/conformance flags are the conjunction of every group. */
export function mergeAggregates(aggregates) {
  if (!Array.isArray(aggregates) || aggregates.length === 0) throw invalidReceipt();
  const merged = Object.create(null);
  const ensure = (path_, target) => {
    let cursor = target;
    for (const key of path_.slice(0, -1)) {
      if (!Object.hasOwn(cursor, key)) cursor[key] = Object.create(null);
      cursor = cursor[key];
    }
    return cursor;
  };
  for (const [position, aggregate] of aggregates.entries()) {
    if (!record(aggregate) || aggregate.schemaVersion !== 1 || !GROUP_STATUSES.has(aggregate.status)) throw invalidReceipt();
    visit(aggregate, '', (where, key, item) => {
      if (where === 'schemaVersion' || where === 'status') return;
      const parts = where.split('.'), parent = ensure(parts, merged), isFlag = FLAG_PATHS.has(where);
      if (typeof item === 'boolean') {
        if (!isFlag) throw invalidReceipt();
        parent[key] = position === 0 ? item : parent[key] === true && item;
      } else if (integer(item)) {
        if (isFlag) throw invalidReceipt();
        const next = (Object.hasOwn(parent, key) ? parent[key] : 0) + item;
        if (!Number.isSafeInteger(next)) throw invalidReceipt();
        parent[key] = next;
      } else throw invalidReceipt();
    });
  }
  // The fixed shape must be identical in every aggregate, in both directions, so sums never hide a shape change.
  // Histogram contents (paths containing ByCode) are keyed by diagnostic code and may differ between groups.
  const shape = aggregate => {
    const keys = new Set();
    visit(aggregate, '', where => {if (!where.includes('ByCode')) keys.add(where);});
    return keys;
  };
  const expected = shape(aggregates[0]);
  for (const aggregate of aggregates) {
    const seen = shape(aggregate);
    if (seen.size !== expected.size || [...expected].some(where => !seen.has(where))) throw invalidReceipt();
  }
  const plain = value => record(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;
  return plain(merged);
}

function readReceipt(directory, index, digest, sourceFingerprint) {
  const name = groupFileName(index);
  if (!fs.existsSync(path.join(directory, name))) return null;
  try {
    const receipt = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(readBoundedFile(path.join(directory, name), RECEIPT_LIMIT)));
    if (!record(receipt) || receipt.schemaVersion !== GROUPED_SCHEMA_VERSION || receipt.kind !== 'selected-source-group' ||
      receipt.index !== index || receipt.digest !== digest || receipt.outcome !== 'completed' ||
      receipt.sourceFingerprint !== sourceFingerprint ||
      !integer(receipt.durationMilliseconds) || !integer(receipt.parentPeakRssKiB)) return null;
    mergeAggregates([receipt.aggregate]);
    // A run that returned status failed may have hit a transient read or timing fault, so it is repeated.
    return receipt.aggregate.status === 'failed' ? null : receipt;
  } catch {return null;}
}

/**
 * Runs every group in order. A group that already has a matching completed receipt is not repeated, and that match
 * includes a fingerprint of the group's current TOC/Lua/XML bytes, so a changed AddOn is analyzed again.
 * The fingerprint is taken before and after each analysis; a group whose bytes changed meanwhile, or whose bytes
 * cannot be fingerprinted, is recorded as failed with a fixed code and never receipted as completed.
 * A group that throws is recorded as failed and retried on the next resume; later groups still run.
 * `parentPeakRssKiB` is the lifetime maximum of this parent process; it is neither per group nor inclusive of children.
 * Test seams (`prepare`, `createHost`, `analyze`, `fingerprint`, `now`) are trusted internal parameters, never CLI data.
 */
export async function runGroupedSelectedSources({root, request, receiptDirectory, runtimeId = '', resume = true,
  prepare = prepareGraphContext, createHost = createSelectedSourceHost, analyze = analyzeSelectedSourceAggregate,
  fingerprint = fingerprintGroup, now = () => performance.now()}) {
  const directory = checkedDirectory(receiptDirectory);
  prepare(request); // The complete request must pass preflight before any host or receipt exists.
  const groups = request.profile.addons, completed = [], timings = [], failedIndexes = [];
  let resumed = 0;
  for (let index = 0; index < groups.length; index++) {
    const single = {...request, profile: {...request.profile, addons: [groups[index]]}};
    const digest = groupDigest(request, groups[index], runtimeId);
    const before = safeFingerprint(fingerprint, root, groups[index]);
    const reused = resume && before !== null ? readReceipt(directory, index, digest, before) : null;
    if (reused) {
      resumed++; completed.push(reused.aggregate); timings.push(reused.durationMilliseconds); continue;
    }
    const started = now();
    let aggregate = null, code = null;
    try {
      const context = prepare(single);
      const host = await createHost(root, context);
      aggregate = await analyze(single, host);
      mergeAggregates([aggregate]);
    } catch (error) {
      aggregate = null;
      code = typeof error?.code === 'string' && error.code.length <= 64 && FAILURE_CODE.test(error.code) ? error.code : null;
    }
    const after = safeFingerprint(fingerprint, root, groups[index]);
    if (aggregate && (before === null || after === null)) {aggregate = null; code = 'grouped-fingerprint';}
    else if (aggregate && before !== after) {aggregate = null; code = 'grouped-source-changed';}
    const durationMilliseconds = Math.max(0, Math.round(now() - started));
    const parentPeakRssKiB = Math.max(0, Math.round(process.resourceUsage().maxRSS));
    timings.push(durationMilliseconds);
    if (aggregate) {
      writeAtomic(directory, groupFileName(index), {schemaVersion: GROUPED_SCHEMA_VERSION, kind: 'selected-source-group',
        index, digest, outcome: 'completed', sourceFingerprint: before, aggregate, durationMilliseconds, parentPeakRssKiB});
      completed.push(aggregate);
    } else {
      failedIndexes.push(index);
      fs.rmSync(path.join(directory, groupFileName(index)), {force: true});
      writeAtomic(directory, failedFileName(index), {schemaVersion: GROUPED_SCHEMA_VERSION,
        kind: 'selected-source-group', index, digest, outcome: 'failed', code, durationMilliseconds, parentPeakRssKiB});
    }
  }
  // A group that later completes must not leave a stale failure record behind.
  for (let index = 0; index < groups.length; index++) {
    if (!failedIndexes.includes(index)) fs.rmSync(path.join(directory, failedFileName(index)), {force: true});
  }
  const counts = {total: groups.length, completed: completed.length, threw: failedIndexes.length, resumed,
    passed: 0, incomplete: 0, faulted: 0};
  for (const aggregate of completed) counts[{passed: 'passed', incomplete: 'incomplete', failed: 'faulted'}[aggregate.status]]++;
  const status = counts.threw > 0 || counts.faulted > 0 ? 'failed' : counts.incomplete > 0 ? 'incomplete' : 'passed';
  const batch = {schemaVersion: GROUPED_SCHEMA_VERSION, kind: 'selected-source-batch', aggregation: 'sum-of-per-group-runs',
    status, groups: counts, timing: {totalGroupMilliseconds: timings.reduce((sum, value) => sum + value, 0),
      maximumGroupMilliseconds: Math.max(0, ...timings), perGroupMilliseconds: timings},
    aggregate: completed.length > 0 ? mergeAggregates(completed) : null};
  writeAtomic(directory, BATCH_FILE, batch);
  return {report: batch, exitCode: status === 'passed' ? 0 : 1};
}