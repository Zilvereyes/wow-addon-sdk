#!/usr/bin/env node
/** Read-only local TOC smoke test. Never execute or export third-party source. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseToc } from '@wow-addon/toc-parser';

const args = process.argv.slice(2);
const rootArgument = args.shift();
const limits = { '--max-entries': 100000, '--max-file-bytes': 8 * 1024 * 1024 };
let requireAll = false;
let valid = Boolean(rootArgument && !rootArgument.startsWith('--'));
while (args.length && valid) {
  const flag = args.shift();
  if (flag === '--require-all-parsers') { requireAll = true; continue; }
  if (!Object.hasOwn(limits, flag)) { valid = false; break; }
  const value = args.shift();
  if (!value || !/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value))) { valid = false; break; }
  limits[flag] = Number(value);
}
if (!valid) {
  console.error('Usage: node scripts/inspect-addon-corpus.mjs <AddOns-directory> [--max-entries N] [--max-file-bytes N] [--require-all-parsers]');
  process.exit(2);
}

const root = path.resolve(rootArgument);
const report = {
  schemaVersion: 1, status: 'passed', fullParsing: false,
  unimplementedParsers: ['lua', 'xml'],
  files: { toc: 0, lua: 0, xml: 0 }, parsed: { toc: 0, lua: 0, xml: 0 },
  entriesVisited: 0, skippedLinks: 0, skippedOversizedTocs: 0,
  checkedSourceReferences: 0, savedVariableDeclarations: 0,
  diagnosticsByCode: {}, diagnosticsBySeverity: { error: 0, warning: 0, info: 0 },
  failures: [],
};
const failures = new Set();
let incomplete = false;
const fail = (reason, partial = false) => { failures.add(reason); incomplete ||= partial; };

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
  report.savedVariableDeclarations += parsed.metadata.savedVariableDeclarations.length;
  for (const diagnostic of parsed.diagnostics) {
    report.diagnosticsByCode[diagnostic.code] = (report.diagnosticsByCode[diagnostic.code] ?? 0) + 1;
    report.diagnosticsBySeverity[diagnostic.severity]++;
  }
  report.parsed.toc++;
}

function walk(folder, depth = 0) {
  if (depth > 64) { fail('depth-limit', true); return; }
  let entries;
  try { entries = fs.readdirSync(folder, { withFileTypes: true }); }
  catch { fail('directory-read', true); return; }
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
      checkParse(content.toString('utf8'), path.relative(root, filename));
    } catch { fail('read-or-invariant-failure', true); }
  }
}

try {
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('invalid-root');
  else walk(root);
} catch { fail('unreadable-root'); }
if (report.parsed.toc === 0) fail('no-parsed-tocs');
if (report.diagnosticsBySeverity.error > 0) fail('toc-parse-errors');
if (requireAll) fail('unimplemented-parsers');
report.failures = [...failures].sort();
report.diagnosticsByCode = Object.fromEntries(Object.entries(report.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
report.status = incomplete ? 'incomplete' : failures.size ? 'failed' : 'passed';
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.size ? 1 : 0;
