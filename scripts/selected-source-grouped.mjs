/** Resumable per-group selected-source runner. Private tooling, opt-in and read-only.
 *
 * Each requested group runs as its own single-group request with the unchanged profiles and limits.
 * A group receipt stores derived counts, timing, and opaque digests of the verified inputs.
 * It never stores paths, addon identities, file names or error messages.
 * The final batch receipt is the sum of the per-group runs and is not one original full request.
 */
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {readBoundedFile} from './read-bounded-file.mjs';
import {prepareGraphContext} from './selected-source-context.mjs';
import {createSelectedSourceHost} from './selected-source-host.mjs';
import {analyzeSelectedSourceAggregate} from './selected-source-graph.mjs';
import {createSelectedSourceCounts, validSelectedSourceCounts} from './selected-source-accounting.mjs';
import {captureVerifiedInputs, receiptDigest, validInputReceipt, verifyReceiptInputs} from './selected-source-grouped-receipt.mjs';
import {GRAPH_LIMITS} from './selected-source-profile.mjs';

export const GROUPED_SCHEMA_VERSION = 1;
const RECEIPT_LIMIT = 1024 * 1024;
const FAILURE_CODES = new Set(['SGRAPH0001', 'SGRAPH0005', 'SGRAPH0007',
  'graph-native-attributes', 'graph-native-budget', 'graph-native-busy', 'graph-native-changed',
  'graph-native-closed', 'graph-native-containment', 'graph-native-directory', 'graph-native-encoding',
  'graph-native-identity', 'graph-native-input', 'graph-native-io', 'graph-native-link',
  'graph-native-read', 'graph-native-root', 'graph-native-missing',
  'graph-native-ambiguous', 'graph-native-unsupported', 'graph-native-blocked',
  'grouped-receipt']);
const BATCH_FILE = 'batch-receipt.json';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const invalidReceipt = () => Object.assign(new Error('Invalid grouped receipt.'), {code: 'grouped-receipt'});

export const groupFileName = index => `group-${String(index + 1).padStart(4, '0')}.json`;
const failedFileName = index => `group-${String(index + 1).padStart(4, '0')}.failed.json`;

/** Binds the receipt to the original request, runtime label and installation identity. */
export function groupDigest(request, group, runtimeId = '', installation = null) {
  return receiptDigest({runtimeId, installation, request: {...request, profile: {...request.profile, addons: [group]}}});
}

function checkedDirectory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || directory.includes('\0') ||
    /^(?:[\\/]{2}|[A-Za-z]+:\/\/)/u.test(directory) ||
    (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/u.test(directory))) throw invalidReceipt();
  const normalized = path.resolve(directory);
  try {
    const stat = fs.lstatSync(normalized, {bigint: true});
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw invalidReceipt();
    return {canonical: fs.realpathSync.native(normalized), dev: stat.dev, ino: stat.ino};
  } catch {throw invalidReceipt();}
}

function outsideCorpus(root, target) {
  const relative = path.relative(root, target);
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}

function writeAtomic(directory, name, value) {
  const target = path.join(directory, name), temporary = path.join(directory, `${name}.${process.pid}.tmp`);
  const text = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(text) > RECEIPT_LIMIT) throw invalidReceipt();
  fs.writeFileSync(temporary, text, {flag: 'wx'});
  try {fs.renameSync(temporary, target);}
  catch (error) {fs.rmSync(temporary, {force: true}); throw error;}
}

/** Sums the producer's fields and preserves empty histograms in the batch report. */
export function mergeAggregates(aggregates) {
  if (!Array.isArray(aggregates) || aggregates.length === 0) throw invalidReceipt();
  const {schemaVersion: _version, status: _status, ...merged} = createSelectedSourceCounts();
  function add(target, source, first) {
    for (const [key, value] of Object.entries(source)) {
      if (record(value)) add(target[key], value, first);
      else if (typeof value === 'boolean') target[key] = first ? value : target[key] && value;
      else {
        const sum = (target[key] ?? 0) + value;
        if (!integer(sum)) throw invalidReceipt();
        target[key] = sum;
      }
    }
  }
  for (const [index, aggregate] of aggregates.entries()) {
    if (!validSelectedSourceCounts(aggregate)) throw invalidReceipt();
    const {schemaVersion: _schema, status: _state, ...counts} = aggregate;
    add(merged, counts, index === 0);
  }
  return merged;
}

function readReceipt(directory, index, digest, maximumSources) {
  const name = groupFileName(index);
  if (!fs.existsSync(path.join(directory, name))) return null;
  try {
    const receipt = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(readBoundedFile(path.join(directory, name), RECEIPT_LIMIT)));
    if (!record(receipt) || Object.keys(receipt).length !== 10 || receipt.schemaVersion !== GROUPED_SCHEMA_VERSION || receipt.kind !== 'selected-source-group' ||
      receipt.index !== index || receipt.digest !== digest || receipt.outcome !== 'completed' ||
      !integer(receipt.durationMilliseconds) || !integer(receipt.parentPeakRssKiB) ||
      !validSelectedSourceCounts(receipt.aggregate) || !validInputReceipt(receipt.inputs, maximumSources) ||
      receipt.payloadDigest !== receiptDigest([receipt.inputs, receipt.aggregate, receipt.durationMilliseconds, receipt.parentPeakRssKiB])) return null;
    // A run that returned status failed may have hit a transient read or timing fault, so it is repeated.
    return receipt.aggregate.status === 'failed' ? null : receipt;
  } catch {return null;}
}

/**
 * Each group's output uses the native graph's final verified input proof. An incomplete
 * or passed receipt can resume only after a separate bounded native replay matches it.
 * Test seams are trusted internal parameters, never CLI data.
 */
export async function runGroupedSelectedSources({root, request, receiptDirectory, runtimeId = '', resume = true,
  prepare = prepareGraphContext, createHost = createSelectedSourceHost, analyze = analyzeSelectedSourceAggregate,
  verifyInputs = verifyReceiptInputs, now = () => performance.now()}) {
  const corpus = checkedDirectory(root), receipts = checkedDirectory(receiptDirectory);
  if (!outsideCorpus(corpus.canonical, receipts.canonical)) throw invalidReceipt();
  const directory = receipts.canonical;
  const assertDestination = () => {
    const current = checkedDirectory(directory), currentRoot = checkedDirectory(root);
    if (current.canonical !== directory || current.dev !== receipts.dev || current.ino !== receipts.ino ||
      currentRoot.canonical !== corpus.canonical || currentRoot.dev !== corpus.dev || currentRoot.ino !== corpus.ino ||
      !outsideCorpus(currentRoot.canonical, current.canonical)) throw invalidReceipt();
  };
  prepare(request); // The complete request must pass preflight before any host or receipt exists.
  assertDestination();
  const lock = path.join(directory, '.selected-source-runner.lock');
  let lockFd;
  try {lockFd = fs.openSync(lock, 'wx');}
  catch (error) {
    if (error.code === 'EEXIST') throw Object.assign(new Error('Grouped receipt directory is in use.'), {code: 'grouped-receipt-busy'});
    throw error;
  }
  try {return await run();}
  finally {
    fs.closeSync(lockFd);
    assertDestination();
    fs.unlinkSync(lock);
  }

  async function run() {
    const groups = request.profile.addons, completed = [], timings = [], failedIndexes = [];
    const identity = [corpus.canonical, String(corpus.dev), String(corpus.ino), process.version, process.platform, process.arch];
    let resumed = 0;
    for (let index = 0; index < groups.length; index++) {
      const single = {...request, profile: {...request.profile, addons: [groups[index]]}};
      const started = now();
      const digest = groupDigest(request, groups[index], runtimeId, identity);
      let aggregate = null, inputs = null, code = null;
      try {
        const context = prepare(single);
        const maximumSources = single.profile.limits?.sourceNodes ?? GRAPH_LIMITS.sourceNodes;
        assertDestination();
        const saved = resume && runtimeId ? readReceipt(directory, index, digest, maximumSources) : null;
        if (saved) {
          let matching = false;
          const replay = await createHost(root, context, {now, began: started});
          try {matching = await verifyInputs(context, replay, saved.inputs);}
          catch { /* A verification miss requires fresh analysis under the original deadline. */ }
          finally {await replay.close();}
          if (matching && now() - started < (single.profile.limits?.operationMilliseconds ?? GRAPH_LIMITS.operationMilliseconds)) {
            resumed++; completed.push(saved.aggregate);
            timings.push(Math.max(0, Math.round(now() - started)));
            continue;
          }
        }

        const host = await createHost(root, context, {now, began: started});
        aggregate = await analyze(single, host, {onVerifiedInputs: trace => {inputs = captureVerifiedInputs(trace);}});
        if (!validSelectedSourceCounts(aggregate)) throw invalidReceipt();
        if (!validInputReceipt(inputs, maximumSources)) inputs = null;
      } catch (error) {
        aggregate = null;
        code = FAILURE_CODES.has(error?.code) ? error.code : null;
      }
      const durationMilliseconds = Math.max(0, Math.round(now() - started));
      const parentPeakRssKiB = Math.max(0, Math.round(process.resourceUsage().maxRSS));
      timings.push(durationMilliseconds);
      assertDestination();
      if (aggregate) {
        writeAtomic(directory, groupFileName(index), {schemaVersion: GROUPED_SCHEMA_VERSION, kind: 'selected-source-group',
          index, digest, outcome: 'completed', inputs, aggregate, durationMilliseconds, parentPeakRssKiB,
          payloadDigest: receiptDigest([inputs, aggregate, durationMilliseconds, parentPeakRssKiB])});
        completed.push(aggregate);
      } else {
        failedIndexes.push(index);
        fs.rmSync(path.join(directory, groupFileName(index)), {force: true});
        writeAtomic(directory, failedFileName(index), {schemaVersion: GROUPED_SCHEMA_VERSION,
          kind: 'selected-source-group', index, digest, outcome: 'failed', code, durationMilliseconds, parentPeakRssKiB});
      }
    }
    assertDestination();
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
}