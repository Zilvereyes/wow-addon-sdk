#!/usr/bin/env node
/** Read-only local TOC smoke test. Never execute or export third-party source. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createLuaWorker } from './lua-worker-client.mjs';
import { parseToc } from '@wow-addon/toc-parser';
import { selectTocVariant, toGlobalDeclarations, evaluateGlobalConditions, resolveGlobalRegistry } from '@wow-addon/toc-metadata-adapter';

const args = process.argv.slice(2);
const rootArgument = args.shift();
const limits = { '--max-entries': 100000, '--max-file-bytes': 8 * 1024 * 1024 };
let requireAll = false;
let luaEnabled = false;
let selectionProfilePath = null;
let conditionProfilePath = null;
let resolutionProfilePath = null;
let valid = Boolean(rootArgument && !rootArgument.startsWith('--'));
while (args.length && valid) {
  const flag = args.shift();
  if (flag === '--require-all-parsers') { requireAll = true; continue; }
  if (flag === '--lua-analysis') {
    if (luaEnabled) { valid = false; break; }
    luaEnabled = true;
    continue;
  }
  if (flag === '--selection-profile') {
    const value = args.shift();
    if (selectionProfilePath !== null || !value || value.startsWith('--')) { valid = false; break; }
    selectionProfilePath = value;
    continue;
  }
  if (flag === '--condition-profile') {
    const value = args.shift();
    if (conditionProfilePath !== null || !value || value.startsWith('--')) { valid = false; break; }
    conditionProfilePath = value;
    continue;
  }
  if (flag === '--resolution-profile') {
    const value = args.shift();
    if (resolutionProfilePath !== null || !value || value.startsWith('--')) { valid = false; break; }
    resolutionProfilePath = value;
    continue;
  }
  if (!Object.hasOwn(limits, flag)) { valid = false; break; }
  const value = args.shift();
  if (!value || !/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value))) { valid = false; break; }
  limits[flag] = Number(value);
}
if (!valid) {
  console.error('Usage: node scripts/inspect-addon-corpus.mjs <AddOns-directory> [--max-entries N] [--max-file-bytes N] [--lua-analysis] [--require-all-parsers] [--selection-profile <JSON-file>] [--condition-profile <JSON-file>] [--resolution-profile <JSON-file>]');
  process.exit(2);
}

const root = path.resolve(rootArgument);
const report = {
  schemaVersion: 1, status: 'passed', fullParsing: false,
  unimplementedParsers: ['xml'], disabledParsers: luaEnabled ? [] : ['lua'],
  files: { toc: 0, lua: 0, xml: 0 }, parsed: { toc: 0, lua: 0, xml: 0 },
  entriesVisited: 0, skippedLinks: 0, skippedOversizedTocs: 0, skippedOversizedLua: 0,
  checkedSourceReferences: 0, savedVariableDeclarations: 0,
  adapterDeclarations: 0, conditionDescriptors: 0,
  diagnosticsByCode: {}, diagnosticsBySeverity: { error: 0, warning: 0, info: 0 },
  failures: [],
};
const failures = new Set();
const luaFiles = [];
if (luaEnabled) report.luaAnalysis = {
  complete: true, attempted: 0, submitted: 0, completed: 0,
  syntaxAccepted: 0, syntaxRejected: 0, incompleteFiles: 0,
  encodingRejected: 0, inputLimitRejected: 0, resourceRejected: 0,
  workerFailures: 0, readFailures: 0, backendFailures: 0,
  declarations: 0, activation: { unconditional: 0, conditional: 0, unknown: 0 },
  checkedSourceReferences: 0, inputBytes: 0, diagnosticsByCode: {},
  resolvedProviderParticipation: false,
};
let incomplete = false;
const fail = (reason, partial = false) => { failures.add(reason); incomplete ||= partial; };
const selectionGroups = new Map();
let selectionProfile = null;
let selectionReady = true;
let conditionProfile = null;
let conditionReady = true;
let resolutionProfile = null;
let resolutionReady = true;
const sourceLineLengths = new Map();
function readProfile(filename) {
  const maximum = 1024 * 1024;
  const initial = fs.statSync(filename);
  if (!initial.isFile() || initial.size > maximum) throw new Error('Invalid profile');
  const descriptor = fs.openSync(filename, 'r');
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maximum) throw new Error('Invalid profile');
    const bytes = Buffer.alloc(maximum + 1);
    let size = 0;
    while (size < bytes.length) {
      const read = fs.readSync(descriptor, bytes, size, bytes.length - size, null);
      if (read === 0) break;
      size += read;
    }
    if (size > maximum) throw new Error('Oversized profile');
    return JSON.parse(bytes.subarray(0, size).toString('utf8'));
  } finally { fs.closeSync(descriptor); }
}
if (selectionProfilePath !== null) {
  report.selection = {
    groups: 0, candidates: 0,
    statuses: { selected: 0, 'no-match': 0, unresolved: 0, ambiguous: 0, invalid: 0 }, issuesByCode: {},
  };
  try {
    selectionProfile = readProfile(selectionProfilePath);
    const result = selectTocVariant(selectionProfile.environment, 'profile-validation', 'Profile', [], selectionProfile.policy);
    if (result.status !== 'no-match') {
      for (const issue of result.issues) report.selection.issuesByCode[issue.code] = (report.selection.issuesByCode[issue.code] ?? 0) + 1;
      fail('selection-profile-invalid'); selectionReady = false;
    }
  } catch { fail('selection-profile-invalid'); selectionReady = false; }
}
if (conditionProfilePath !== null) {
  report.conditionEvaluation = { declarations: 0, availability: { active: 0, inactive: 0, unknown: 0 }, issuesByCode: {} };
  try {
    conditionProfile = readProfile(conditionProfilePath);
    // Authored empty declaration validates context/policy without reading corpus sources.
    const result = evaluateGlobalConditions({ name: 'Profile', addonId: 'profile-validation', kind: 'lua-global',
      activationState: 'unconditional', source: { file: 'profile-validation', range: {
        start: { line: 0, column: 0 }, end: { line: 0, column: 0 },
      } } }, conditionProfile.environment, conditionProfile.policy);
    if (result.availability !== 'active') {
      for (const issue of result.issues) report.conditionEvaluation.issuesByCode[issue.code] = (report.conditionEvaluation.issuesByCode[issue.code] ?? 0) + 1;
      fail('condition-profile-invalid'); conditionReady = false;
    }
  } catch { fail('condition-profile-invalid'); conditionReady = false; }
}
if (resolutionProfilePath !== null) {
  report.resolution = { groups: 0, candidates: 0, complete: false,
    selections: { selected: 0, 'no-match': 0, unresolved: 0, ambiguous: 0, invalid: 0 },
    declarations: 0, availability: { active: 0, inactive: 0, unknown: 0 }, activeGlobals: 0,
    diagnosticsByCode: {}, issuesByCode: {} };
  try {
    resolutionProfile = readProfile(resolutionProfilePath);
    const root = resolveGlobalRegistry(resolutionProfile.environment, [], resolutionProfile.conditionPolicy);
    const selection = selectTocVariant(resolutionProfile.environment, 'profile-validation', 'Profile', [], resolutionProfile.selectionPolicy);
    if (!root.complete || selection.status !== 'no-match') {
      for (const issue of [...root.issues, ...selection.issues]) report.resolution.issuesByCode[issue.code] = (report.resolution.issuesByCode[issue.code] ?? 0) + 1;
      fail('resolution-profile-invalid'); resolutionReady = false;
    }
  } catch { fail('resolution-profile-invalid'); resolutionReady = false; }
}

function checkParse(content, filename) {
  const parsed = parseToc(content, filename);
  assert.equal(parsed.metadata.tocPath, filename);
  assert.equal(parsed.metadata.schemaVersion, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
  const lines = content.split(/\r\n|\n|\r/u);
  if (resolutionProfile !== null) sourceLineLengths.set(filename, lines.map(line => line.length));
  // Walk every diagnostic, condition, declaration and entry source reference.
  function visit(value, count = true) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) {
      assert.equal(value.file, filename);
      const { start, end } = value.range;
      for (const pos of [start, end]) {
        assert.ok(Number.isInteger(pos.line) && pos.line >= 0 && pos.line < lines.length);
        assert.ok(Number.isInteger(pos.column) && pos.column >= 0 && pos.column <= lines[pos.line].length);
      }
      assert.ok(end.line > start.line || (end.line === start.line && end.column >= start.column));
      if (count) report.checkedSourceReferences++;
      return;
    }
    for (const child of Object.values(value)) visit(child, count);
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
  if (conditionProfile !== null) {
    const beforeEvaluation = JSON.stringify(declarations);
    for (const declaration of declarations) {
      const result = evaluateGlobalConditions(declaration, conditionProfile.environment, conditionProfile.policy);
      assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
      assert.ok(Object.hasOwn(report.conditionEvaluation.availability, result.availability));
      visit(result, false);
      report.conditionEvaluation.declarations++;
      report.conditionEvaluation.availability[result.availability]++;
      for (const issue of result.issues) report.conditionEvaluation.issuesByCode[issue.code] = (report.conditionEvaluation.issuesByCode[issue.code] ?? 0) + 1;
      if (result.availability === 'unknown') fail('condition-unknown');
    }
    assert.equal(JSON.stringify(declarations), beforeEvaluation);
  }
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
      if (extension === 'lua' && luaEnabled) {
        luaFiles.push({ filename, relative: path.relative(root, filename) });
        continue;
      }
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
      if ((selectionProfile !== null || resolutionProfile !== null) && depth === 1) {
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
  if (selectionReady && conditionReady && resolutionReady) {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('invalid-root');
    else walk(root);
  }
} catch { fail('unreadable-root'); }
if (luaEnabled) {
  const counts = report.luaAnalysis;
  const worker = createLuaWorker();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  try {
    for (const { filename, relative } of luaFiles) {
      counts.attempted++;
      let content;
      try {
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Changed input');
        if (stat.size > limits['--max-file-bytes']) {
          report.skippedOversizedLua++; counts.resourceRejected++; counts.complete = false;
          fail('oversized-lua', true); continue;
        }
        // No valid 1 Mi-code-unit UTF-8 input can need this many bytes. Keep
        // allocation bounded even if a caller raises the generic file limit.
        if (stat.size > 4 * 1024 * 1024) {
          counts.inputLimitRejected++; counts.resourceRejected++; counts.complete = false;
          fail('lua-input-limit', true); continue;
        }
        const fd = fs.openSync(filename, 'r');
        let bytes;
        try {
          const buffer = Buffer.alloc(stat.size + 1);
          let total = 0;
          while (total < buffer.length) {
            const read = fs.readSync(fd, buffer, total, buffer.length - total, total);
            if (read === 0) break;
            total += read;
          }
          const after = fs.fstatSync(fd);
          if (total !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error('Changed input');
          bytes = buffer.subarray(0, total);
        } finally { fs.closeSync(fd); }
        counts.inputBytes += bytes.length;
        try { content = decoder.decode(bytes); }
        catch {
          counts.encodingRejected++; counts.complete = false;
          fail('lua-invalid-utf8', true); continue;
        }
        if (content.length > 1024 * 1024) {
          counts.inputLimitRejected++; counts.resourceRejected++; counts.complete = false;
          fail('lua-input-limit', true); continue;
        }
      } catch {
        counts.readFailures++; counts.complete = false; fail('lua-read-failure', true); continue;
      }
      let result;
      try {
        counts.submitted++;
        result = await worker.analyze({ content, sourcePath: relative,
          options: { addonId: JSON.stringify(['local-corpus-lua-file', relative]) } });
        counts.completed++;
      } catch {
        counts.workerFailures++; counts.complete = false; fail('lua-worker-failure', true); continue;
      }
      try {
        assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
        assert.equal(result.complete, result.diagnostics.length === 0);
        const lengths = content.split(/\r\n|\n|\r/u).map(line => line.length);
        function visitLua(value) {
          if (!value || typeof value !== 'object') return;
          if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) {
            assert.equal(value.file, relative);
            for (const position of [value.range.start, value.range.end]) {
              assert.ok(Number.isSafeInteger(position.line) && position.line >= 0 && position.line < lengths.length);
              assert.ok(Number.isSafeInteger(position.column) && position.column >= 0 && position.column <= lengths[position.line]);
            }
            assert.ok(value.range.end.line > value.range.start.line ||
              (value.range.end.line === value.range.start.line && value.range.end.column >= value.range.start.column));
            counts.checkedSourceReferences++;
            return;
          }
          for (const child of Object.values(value)) visitLua(child);
        }
        visitLua(result);
        const codes = new Set();
        for (const diagnostic of result.diagnostics) {
          assert.ok(['LUA0001', 'LUA0002', 'LUA0003', 'LUA0004', 'LUA0005'].includes(diagnostic.code));
          assert.equal(diagnostic.severity, diagnostic.code === 'LUA0004' ? 'warning' : 'error');
          codes.add(diagnostic.code);
          counts.diagnosticsByCode[diagnostic.code] = (counts.diagnosticsByCode[diagnostic.code] ?? 0) + 1;
        }
        if (codes.has('LUA0001') || codes.has('LUA0005')) {
          assert.equal(result.declarations.length, 0);
          counts.backendFailures++; fail('lua-backend-failure', true);
        } else if (codes.has('LUA0003')) {
          assert.equal(result.declarations.length, 0);
          counts.resourceRejected++; fail('lua-resource-limit', true);
        } else {
          report.parsed.lua++;
          if (codes.has('LUA0002')) {
            assert.equal(result.declarations.length, 0);
            counts.syntaxRejected++; fail('lua-syntax-errors');
          } else counts.syntaxAccepted++;
          if (codes.has('LUA0004')) { counts.incompleteFiles++; fail('lua-analysis-incomplete'); }
        }
        for (const declaration of result.declarations) {
          assert.equal(declaration.kind, 'lua-global');
          assert.equal(Object.hasOwn(declaration, 'scope'), false);
          assert.ok(Object.hasOwn(counts.activation, declaration.activationState));
          counts.activation[declaration.activationState]++;
          counts.declarations++;
        }
        if (!result.complete) counts.complete = false;
      } catch { counts.complete = false; fail('lua-invariant-failure', true); }
    }
  } finally { await worker.close(); }
  counts.diagnosticsByCode = Object.fromEntries(Object.entries(counts.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
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
if (resolutionProfile !== null && resolutionReady) {
  try {
    const inputs = [...selectionGroups].map(([base, candidates]) => ({ logicalAddonId: candidates[0].identity.logicalAddonId,
      addonBaseName: base, candidates, selectionPolicy: resolutionProfile.selectionPolicy }));
    const before = JSON.stringify(inputs);
    const result = resolveGlobalRegistry(resolutionProfile.environment, inputs, resolutionProfile.conditionPolicy);
    assert.equal(JSON.stringify(inputs), before);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.equal(result.schemaVersion, 1);
    function verifySources(value) {
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) {
        const lengths = sourceLineLengths.get(value.file);
        assert.ok(lengths);
        for (const position of [value.range.start, value.range.end]) {
          assert.ok(Number.isSafeInteger(position.line) && position.line >= 0 && position.line < lengths.length);
          assert.ok(Number.isSafeInteger(position.column) && position.column >= 0 && position.column <= lengths[position.line]);
        }
        assert.ok(value.range.end.line > value.range.start.line || (value.range.end.line === value.range.start.line && value.range.end.column >= value.range.start.column));
        return;
      }
      for (const child of Object.values(value)) verifySources(child);
    }
    verifySources(result);
    report.resolution.groups = inputs.length;
    report.resolution.candidates = inputs.reduce((total, input) => total + input.candidates.length, 0);
    report.resolution.complete = result.complete && inputs.length > 0;
    assert.equal(new Set(result.activeGlobals).size, result.activeGlobals.length);
    report.resolution.activeGlobals = result.activeGlobals.length;
    const countIssue = issue => { report.resolution.issuesByCode[issue.code] = (report.resolution.issuesByCode[issue.code] ?? 0) + 1; };
    for (const addon of result.addons) {
      report.resolution.selections[addon.selection.status]++;
      addon.selection.issues.forEach(countIssue);
    }
    for (const entry of result.entries) for (const declaration of entry.declarations) {
      report.resolution.declarations++;
      report.resolution.availability[declaration.evaluation.availability]++;
      declaration.evaluation.issues.forEach(countIssue);
    }
    result.issues.forEach(countIssue);
    for (const diagnostic of result.diagnostics) report.resolution.diagnosticsByCode[diagnostic.code] = (report.resolution.diagnosticsByCode[diagnostic.code] ?? 0) + 1;
    if (!result.complete) fail('resolution-incomplete');
    if (inputs.length === 0) fail('no-resolution-groups');
  } catch { fail('resolution-invariant-failure', true); }
  for (const field of ['issuesByCode', 'diagnosticsByCode']) report.resolution[field] = Object.fromEntries(
    Object.entries(report.resolution[field]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
if (report.parsed.toc === 0) fail('no-parsed-tocs');
if (report.diagnosticsBySeverity.error > 0) fail('toc-parse-errors');
if (requireAll) fail('unimplemented-parsers');
if (report.conditionEvaluation) report.conditionEvaluation.issuesByCode = Object.fromEntries(
  Object.entries(report.conditionEvaluation.issuesByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
report.failures = [...failures].sort();
report.diagnosticsByCode = Object.fromEntries(Object.entries(report.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
report.status = incomplete ? 'incomplete' : failures.size ? 'failed' : 'passed';
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.size ? 1 : 0;
