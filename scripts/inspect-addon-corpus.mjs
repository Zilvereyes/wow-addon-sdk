#!/usr/bin/env node
/** Read-only local TOC smoke test. Never execute or export third-party source. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseToc } from '@wow-addon/toc-parser';
import { selectTocVariant, toGlobalDeclarations } from '@wow-addon/toc-metadata-adapter';

const args = process.argv.slice(2);
const rootArgument = args.shift();
const limits = { '--max-entries': 100000, '--max-file-bytes': 8 * 1024 * 1024 };
let requireAll = false;
let selectionProfilePath = null;
let valid = Boolean(rootArgument && !rootArgument.startsWith('--'));
while (args.length && valid) {
  const flag = args.shift();
  if (flag === '--require-all-parsers') { requireAll = true; continue; }
  if (flag === '--selection-profile') {
    const value = args.shift();
    if (selectionProfilePath !== null || !value || value.startsWith('--')) { valid = false; break; }
    selectionProfilePath = value;
    continue;
  }
  if (!Object.hasOwn(limits, flag)) { valid = false; break; }
  const value = args.shift();
  if (!value || !/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value))) { valid = false; break; }
  limits[flag] = Number(value);
}
if (!valid) {
  console.error('Usage: node scripts/inspect-addon-corpus.mjs <AddOns-directory> [--max-entries N] [--max-file-bytes N] [--require-all-parsers] [--selection-profile <JSON-file>]');
  process.exit(2);
}

const root = path.resolve(rootArgument);
const report = {
  schemaVersion: 1, status: 'passed', fullParsing: false,
  unimplementedParsers: ['lua', 'xml'],
  files: { toc: 0, lua: 0, xml: 0 }, parsed: { toc: 0, lua: 0, xml: 0 },
  entriesVisited: 0, skippedLinks: 0, skippedOversizedTocs: 0,
  checkedSourceReferences: 0, savedVariableDeclarations: 0,
  adapterDeclarations: 0, conditionDescriptors: 0,
  diagnosticsByCode: {}, diagnosticsBySeverity: { error: 0, warning: 0, info: 0 },
  failures: [],
};
const failures = new Set();
let incomplete = false;
const fail = (reason, partial = false) => { failures.add(reason); incomplete ||= partial; };
const selectionGroups = new Map();
let selectionProfile = null;
let selectionReady = true;
if (selectionProfilePath !== null) {
  report.selection = {
    groups: 0, candidates: 0,
    statuses: { selected: 0, 'no-match': 0, unresolved: 0, ambiguous: 0, invalid: 0 }, issuesByCode: {},
  };
  try {
    const stat = fs.statSync(selectionProfilePath);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Invalid selection profile');
    const bytes = fs.readFileSync(selectionProfilePath);
    if (bytes.length > 1024 * 1024) throw new Error('Oversized selection profile');
    selectionProfile = JSON.parse(bytes.toString('utf8'));
    const result = selectTocVariant(selectionProfile.environment, 'profile-validation', 'Profile', [], selectionProfile.policy);
    if (result.status !== 'no-match') {
      for (const issue of result.issues) report.selection.issuesByCode[issue.code] = (report.selection.issuesByCode[issue.code] ?? 0) + 1;
      fail('selection-profile-invalid'); selectionReady = false;
    }
  } catch { fail('selection-profile-invalid'); selectionReady = false; }
}

function checkParse(content, filename) {
  const parsed = parseToc(content, filename);
  assert.equal(parsed.metadata.tocPath, filename);
  assert.equal(parsed.metadata.schemaVersion, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
  const lines = content.split(/\r\n|\n|\r/u);
  // Walk every diagnostic, condition, declaration and entry source reference.
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) {
      assert.equal(value.file, filename);
      const { start, end } = value.range;
      for (const pos of [start, end]) {
        assert.ok(Number.isInteger(pos.line) && pos.line >= 0 && pos.line < lines.length);
        assert.ok(Number.isInteger(pos.column) && pos.column >= 0 && pos.column <= lines[pos.line].length);
      }
      assert.ok(end.line > start.line || (end.line === start.line && end.column >= start.column));
      report.checkedSourceReferences++;
      return;
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(parsed);
  const before = JSON.stringify(parsed.metadata);
  const declarations = toGlobalDeclarations([parsed.metadata]);
  assert.equal(JSON.stringify(parsed.metadata), before);
  assert.deepEqual(JSON.parse(JSON.stringify(declarations)), declarations);
  const originals = parsed.metadata.savedVariableDeclarations.filter(declaration => declaration.validIdentifier);
  assert.equal(declarations.length, originals.length);
  for (const [index, original] of originals.entries()) {
    const derived = declarations[index];
    assert.equal(derived.activationState, original.conditions.length ? 'conditional' : 'unconditional');
    if (original.conditions.length === 0) {
      assert.equal(Object.hasOwn(derived, 'conditions'), false);
      continue;
    }
    assert.equal(derived.conditions.length, original.conditions.length);
    assert.notEqual(derived.conditions, original.conditions);
    for (const [conditionIndex, condition] of original.conditions.entries()) {
      const copy = derived.conditions[conditionIndex];
      assert.equal(copy.providerId, '@wow-addon/toc-metadata-adapter');
      assert.equal(copy.name, condition.name);
      assert.equal(copy.raw, condition.raw);
      assert.deepEqual(copy.values, condition.values);
      assert.deepEqual(copy.source, condition.source);
      assert.notEqual(copy, condition);
      assert.notEqual(copy.values, condition.values);
      assert.notEqual(copy.source, condition.source);
      assert.notEqual(copy.source.range, condition.source.range);
      assert.notEqual(copy.source.range.start, condition.source.range.start);
      assert.notEqual(copy.source.range.end, condition.source.range.end);
      report.conditionDescriptors++;
    }
  }
  report.adapterDeclarations += declarations.length;
  report.savedVariableDeclarations += parsed.metadata.savedVariableDeclarations.length;
  for (const diagnostic of parsed.diagnostics) {
    report.diagnosticsByCode[diagnostic.code] = (report.diagnosticsByCode[diagnostic.code] ?? 0) + 1;
    report.diagnosticsBySeverity[diagnostic.severity]++;
  }
  report.parsed.toc++;
  return parsed;
}

function walk(folder, depth = 0) {
  if (depth > 64) { fail('depth-limit', true); return; }
  const remaining = limits['--max-entries'] - report.entriesVisited;
  if (remaining <= 0) { fail('entry-limit', true); return; }
  const entries = [];
  try {
    const directory = fs.opendirSync(folder, { bufferSize: 1 });
    try {
      let entry;
      while ((entry = directory.readSync()) !== null) {
        // Detect overflow with one extra read; do not process an unordered subset.
        if (entries.length >= remaining) { fail('entry-limit', true); return; }
        entries.push(entry);
      }
    } finally { directory.closeSync(); }
  } catch { fail('directory-read', true); return; }
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    if (report.entriesVisited >= limits['--max-entries']) { fail('entry-limit', true); return; }
    report.entriesVisited++;
    const filename = path.join(folder, entry.name);
    try {
      // Recheck with lstat so directory junctions are never intentionally followed.
      const stat = fs.lstatSync(filename);
      if (stat.isSymbolicLink()) { report.skippedLinks++; fail('skipped-links', true); continue; }
      if (stat.isDirectory()) { walk(filename, depth + 1); continue; }
      if (!stat.isFile()) continue;
      const extension = path.extname(entry.name).slice(1).toLowerCase();
      if (!Object.hasOwn(report.files, extension)) continue;
      report.files[extension]++;
      if (extension !== 'toc') continue;
      if (stat.size > limits['--max-file-bytes']) {
        report.skippedOversizedTocs++; fail('oversized-toc', true); continue;
      }
      // Never resolve or read file paths referenced by a TOC; only discovered TOCs.
      const content = fs.readFileSync(filename);
      if (content.length > limits['--max-file-bytes']) { fail('file-changed', true); continue; }
      const relative = path.relative(root, filename);
      const parsed = checkParse(content.toString('utf8'), relative);
      // Only immediate AddOn-folder TOCs participate; embedded library manifests
      // remain part of the parse inventory, not independent loader candidates.
      if (selectionProfile !== null && depth === 1) {
        const base = path.basename(folder);
        const logicalAddonId = JSON.stringify(['local-corpus-group', base]);
        const candidates = selectionGroups.get(base) ?? [];
        candidates.push({
          identity: {
            logicalAddonId, tocVariantId: JSON.stringify([logicalAddonId, relative]),
            tocPath: relative, tocSuffix: parsed.metadata.tocSuffix, source: parsed.entries[0].source,
          },
          metadata: parsed.metadata,
        });
        selectionGroups.set(base, candidates);
      }
    } catch { fail('read-or-invariant-failure', true); }
  }
}

try {
  if (selectionReady) {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('invalid-root');
    else walk(root);
  }
} catch { fail('unreadable-root'); }
if (selectionProfile !== null && selectionReady) {
  for (const [base, candidates] of selectionGroups) {
    try {
      const before = JSON.stringify(candidates);
      const result = selectTocVariant(selectionProfile.environment, candidates[0].identity.logicalAddonId, base, candidates, selectionProfile.policy);
      assert.equal(JSON.stringify(candidates), before);
      report.selection.groups++;
      report.selection.candidates += candidates.length;
      report.selection.statuses[result.status]++;
      for (const issue of result.issues) report.selection.issuesByCode[issue.code] = (report.selection.issuesByCode[issue.code] ?? 0) + 1;
      if (!['selected', 'no-match'].includes(result.status)) fail(`selection-${result.status}`);
    } catch { fail('selection-invariant-failure', true); }
  }
  if (report.selection.groups === 0) fail('no-selection-groups');
  report.selection.issuesByCode = Object.fromEntries(Object.entries(report.selection.issuesByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
if (report.parsed.toc === 0) fail('no-parsed-tocs');
if (report.diagnosticsBySeverity.error > 0) fail('toc-parse-errors');
if (requireAll) fail('unimplemented-parsers');
report.failures = [...failures].sort();
report.diagnosticsByCode = Object.fromEntries(Object.entries(report.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
report.status = incomplete ? 'incomplete' : failures.size ? 'failed' : 'passed';
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.size ? 1 : 0;
