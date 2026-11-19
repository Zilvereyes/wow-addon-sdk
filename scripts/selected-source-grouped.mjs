/** Resumable per-group selected-source runner. Private tooling, opt-in and read-only.
 *
 * Each requested group runs as its own single-group request with the unchanged profiles and limits.
 * A group receipt stores only the derived aggregate counts, a timing number and an input digest.
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
import {observeGroupIntegrity, validIntegrity, sumIntegrity} from './selected-source-integrity.mjs';

export const GROUPED_SCHEMA_VERSION = 2;
const RECEIPT_LIMIT = 1024 * 1024;
const GROUP_STATUSES = new Set(['passed', 'incomplete', 'failed']);
const FLAG_PATHS = new Set(['completeUnderPolicy', 'fullParsing', 'clientConformance', 'discovery.complete',
  'resolution.coreComplete', 'resolution.complete']);
const KEY = /^[A-Za-z][A-Za-z0-9]*$/u;
const FAILURE_CODE = /^[A-Za-z]{3,8}\d{4}$/u;
const BATCH_FILE = 'batch-receipt.json';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const invalidReceipt = () => Object.assign(new Error('Invalid grouped receipt.'), {code: 'grouped-receipt'});

function sha256(value) {return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export const groupFileName = index => `group-${String(index + 1).padStart(4, '0')}.json`;

/** The digest binds one group to the exact profiles, policies and runtime label that produced its receipt. */
export function groupDigest(request, group, runtimeId = '') {
  return sha256({runtimeId, request: {...request, profile: {...request.profile, addons: [group]}}});
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
  // Fixed-shape keys must be present in every aggregate, so sums never hide a shape change.
  const expected = [];
  visit(aggregates[0], '', (where) => expected.push(where));
  for (const aggregate of aggregates) {
    const seen = [];
    visit(aggregate, '', (where) => seen.push(where));
    for (const where of expected) {
      if (!where.includes('ByCode') && !seen.includes(where)) throw invalidReceipt();
    }
  }
  const plain = value => record(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;
  return plain(merged);
}

function readReceipt(directory, index, digest) {
  const name = groupFileName(index);
  if (!fs.existsSync(path.join(directory, name))) return null;
  try {
    const receipt = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(readBoundedFile(path.join(directory, name), RECEIPT_LIMIT)));
    if (!record(receipt) || receipt.schemaVersion !== GROUPED_SCHEMA_VERSION || receipt.kind !== 'selected-source-group' ||
      receipt.index !== index || receipt.digest !== digest || receipt.outcome !== 'completed' ||
      !integer(receipt.durationMilliseconds) || !integer(receipt.peakRssKiB)) return null;
    mergeAggregates([receipt.aggregate]);
    if (!validIntegrity(receipt.integrity)) return null;
    // A run that returned status failed may have hit a transient read or timing fault, so it is repeated.
    return receipt.aggregate.status === 'failed' ? null : receipt;
  } catch {return null;}
}

/**
 * Runs every group in order. A group that already has a matching completed receipt is not repeated.
 * A group that throws is recorded as failed and retried on the next resume; later groups still run.
 * Test seams (`prepare`, `createHost`, `analyze`, `now`) are trusted internal parameters, never CLI data.
 */
export async function runGroupedSelectedSources({root, request, receiptDirectory, runtimeId = '', resume = true,
  prepare = prepareGraphContext, createHost = createSelectedSourceHost, analyze = analyzeSelectedSourceAggregate,
  now = () => performance.now()}) {
  const directory = checkedDirectory(receiptDirectory);
  prepare(request); // The complete request must pass preflight before any host or receipt exists.
  const groups = request.profile.addons, completed = [], integrities = [], timings = [], failedIndexes = [];
  let resumed = 0;
  for (let index = 0; index < groups.length; index++) {
    const single = {...request, profile: {...request.profile, addons: [groups[index]]}};
    const digest = groupDigest(request, groups[index], runtimeId);
    const reused = resume ? readReceipt(directory, index, digest) : null;
    if (reused) {
      resumed++; completed.push(reused.aggregate); integrities.push(reused.integrity); timings.push(reused.durationMilliseconds); continue;
    }
    const started = now();
    let aggregate = null, code = null, observer = null, integrity = null;
    try {
      const context = prepare(single);
      const host = await createHost(root, context);
      observer = observeGroupIntegrity(host, root);
      aggregate = await analyze(single, observer.host);
      mergeAggregates([aggregate]);
    } catch (error) {
      aggregate = null;
      code = typeof error?.code === 'string' && FAILURE_CODE.test(error.code) ? error.code : null;
    }
    try {integrity = observer?.finish() ?? null;} catch {integrity = null;}
    if (aggregate && !validIntegrity(integrity)) aggregate = null; // A result without a valid observation is not a completed group.
    const durationMilliseconds = Math.max(0, Math.round(now() - started));
    const peakRssKiB = Math.max(0, Math.round(process.resourceUsage().maxRSS));
    timings.push(durationMilliseconds);
    if (aggregate) {
      writeAtomic(directory, groupFileName(index), {schemaVersion: GROUPED_SCHEMA_VERSION, kind: 'selected-source-group',
        index, digest, outcome: 'completed', aggregate, integrity, durationMilliseconds, peakRssKiB});
      completed.push(aggregate); integrities.push(integrity);
    } else {
      failedIndexes.push(index);
      fs.rmSync(path.join(directory, groupFileName(index)), {force: true});
      writeAtomic(directory, `group-${String(index + 1).padStart(4, '0')}.failed.json`, {schemaVersion: GROUPED_SCHEMA_VERSION,
        kind: 'selected-source-group', index, digest, outcome: 'failed', code, durationMilliseconds, peakRssKiB});
    }
  }
  // A group that later completes must not leave a stale failure record behind.
  for (let index = 0; index < groups.length; index++) {
    if (!failedIndexes.includes(index)) fs.rmSync(path.join(directory, `group-${String(index + 1).padStart(4, '0')}.failed.json`), {force: true});
  }
  const counts = {total: groups.length, completed: completed.length, threw: failedIndexes.length, resumed,
    passed: 0, incomplete: 0, faulted: 0};
  for (const aggregate of completed) counts[{passed: 'passed', incomplete: 'incomplete', failed: 'faulted'}[aggregate.status]]++;
  const status = counts.threw > 0 || counts.faulted > 0 ? 'failed' : counts.incomplete > 0 ? 'incomplete' : 'passed';
  const batch = {schemaVersion: GROUPED_SCHEMA_VERSION, kind: 'selected-source-batch', aggregation: 'sum-of-per-group-runs',
    status, groups: counts, timing: {totalGroupMilliseconds: timings.reduce((sum, value) => sum + value, 0),
      maximumGroupMilliseconds: Math.max(0, ...timings), perGroupMilliseconds: timings},
    aggregate: completed.length > 0 ? mergeAggregates(completed) : null,
    integrity: integrities.length > 0 ? sumIntegrity(integrities) : null};
  writeAtomic(directory, BATCH_FILE, batch);
  return {report: batch, exitCode: status === 'passed' ? 0 : 1};
}
