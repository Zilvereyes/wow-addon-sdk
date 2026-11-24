/** Private receipt attestation from the native graph's verified inputs. */
import path from 'node:path';
import {createHash} from 'node:crypto';
import {getGraphRequest} from './selected-source-context.mjs';
import {graphHostBudget} from './selected-source-budget.mjs';

export const receiptDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const sourceId = key => receiptDigest(['source-path', key]);
const VCS_DIRECTORY_NAMES = new Set(['.git', '.svn', '.hg']);
const isVcsDirectoryName = name => VCS_DIRECTORY_NAMES.has(name.replace(/[A-Z]/gu, unit => unit.toLowerCase()));

function digestEntries(domain, entries, budget) {
  const digest = createHash('sha256').update(domain);
  for (const key of [...entries.keys()].sort()) {
    budget.check();
    digest.update(JSON.stringify([key, entries.get(key)]));
  }
  return digest.digest('hex');
}

export function captureVerifiedInputs(trace) {
  const {budget} = trace;
  let vcsDirectoryCount = 0;
  for (const key of trace.directories.keys()) if (isVcsDirectoryName(path.basename(key))) vcsDirectoryCount++;
  budget.retain(3 + 2 * (trace.directories.size + trace.files.size + vcsDirectoryCount),
    64 * (trace.files.size + vcsDirectoryCount));
  const directories = new Map(), sources = new Map(), vcsDirectoryIds = new Set();
  for (const [key, row] of trace.directories) {
    budget.check();
    if (!row.valid) return null;
    directories.set(key, row.fingerprint);
    if (isVcsDirectoryName(path.basename(key))) vcsDirectoryIds.add(sourceId(key));
  }
  for (const [key, row] of trace.files) {
    budget.check();
    if (!row.valid || row.fingerprint === null || row.integrity.matching !== 1 ||
        row.integrity.changed !== 0 || row.integrity.verificationFailures !== 0) return null;
    sources.set(sourceId(key), row.fingerprint);
  }
  return {directoryDigest: digestEntries('directories', directories, budget),
    sourceDigest: digestEntries('sources', sources, budget), sourceIds: [...sources.keys()].sort(),
    vcsDirectoryIds: [...vcsDirectoryIds].sort()};
}

export function validInputReceipt(value, maximumSources, maximumDirectories) {
  return value !== null && typeof value === 'object' && Object.keys(value).length === 4 &&
    validHash(value.directoryDigest) && validHash(value.sourceDigest) &&
    Array.isArray(value.sourceIds) && value.sourceIds.length <= maximumSources &&
    value.sourceIds.every((id, index) => validHash(id) && (index === 0 || value.sourceIds[index - 1] < id)) &&
    Array.isArray(value.vcsDirectoryIds) && value.vcsDirectoryIds.length <= maximumDirectories &&
    value.vcsDirectoryIds.every((id, index) => validHash(id) && (index === 0 || value.vcsDirectoryIds[index - 1] < id));
}

/** Replay metadata and only the sources the former graph used. No parser runs on this path. */
export async function verifyReceiptInputs(context, host, receipt) {
  const request = getGraphRequest(context), {limits} = request.profile;
  const budget = graphHostBudget(host, context);
  const wanted = new Set(receipt.sourceIds), wantedVcsDirectories = new Set(receipt.vcsDirectoryIds),
    directoryFingerprints = new Map(), sourcePaths = new Map();
  const sources = new Map(), verified = [];
  const pending = [{key: '', depth: 0}];
  budget.retain(7 + wanted.size + 2 * receipt.vcsDirectoryIds.length,
    64 * (wanted.size + receipt.vcsDirectoryIds.length));
  while (pending.length) {
    const {key, depth} = pending.pop();
    budget.release('retainedRecords', 1);
    budget.release('retainedStringUnits', key.length);
    const snapshot = await host.listDirectory(key);
    try {
      budget.retain(2, key.length + snapshot.fingerprint.length);
      directoryFingerprints.set(key, snapshot.fingerprint);
      for (const row of snapshot.entries) {
        budget.check();
        if (row.reparsePoint || row.kind === 'link' || row.kind === 'unsupported') return false;
        const child = path.join(key, row.name);
        if (row.kind === 'directory') {
          // Broad discovery excludes VCS trees; only revisit one recorded through an explicit reference.
          if (isVcsDirectoryName(row.name) && !wantedVcsDirectories.has(sourceId(child))) continue;
          if (depth === limits.directoryDepth) return false;
          budget.retain(1, child.length);
          pending.push({key: child, depth: depth + 1});
        } else if (row.kind === 'file' && /\.(?:toc|lua|xml)$/iu.test(row.name)) {
          const id = sourceId(child);
          if (!wanted.has(id)) continue;
          if (sourcePaths.has(id)) return false;
          budget.retain(2, id.length + child.length);
          sourcePaths.set(id, child);
        }
      }
    } finally {host.releaseHandoff(snapshot);}
  }
  if (digestEntries('directories', directoryFingerprints, budget) !== receipt.directoryDigest ||
      sourcePaths.size !== wanted.size) return false;

  for (const [id, key] of sourcePaths) {
    budget.use('sourceNodes', 1);
    const extension = path.extname(key).toLowerCase();
    const cap = (extension === '.toc' ? 8 : extension === '.lua' && request.luaInputProfile === 'corpus-files' ? 128 : 4) * 1024 * 1024;
    const row = await host.readSource(key, cap);
    try {
      budget.retain(3, row.fingerprint.length);
      sources.set(id, row.fingerprint);
      verified.push({key, fingerprint: row.fingerprint, maximum: Math.max(1, row.bytes.length)});
    } finally {host.releaseHandoff(row);}
  }
  if (digestEntries('sources', sources, budget) !== receipt.sourceDigest) return false;
  for (const {key, fingerprint, maximum} of verified) {
    if (!await host.verifySource(key, fingerprint, maximum)) return false;
  }
  for (const [key, fingerprint] of directoryFingerprints) {
    if (!await host.verifyDirectory(key, fingerprint)) return false;
  }
  budget.check();
  return true;
}
