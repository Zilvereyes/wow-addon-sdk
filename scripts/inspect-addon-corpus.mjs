#!/usr/bin/env node
/** Read-only local TOC smoke test. Never execute or export third-party source. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLuaWorker } from './lua-worker-client.mjs';
import { createXmlWorker } from './xml-worker-client.mjs';
import { readBoundedFile } from './read-bounded-file.mjs';
import { XML_PROVIDER_ADDON_ID, validateXmlProviderProfile, verifyXmlProvider } from './xml-provider-validation.mjs';
import { validateXmlInlineProfile, verifyXmlInlineLua } from './xml-inline-lua-validation.mjs';
import { parseToc } from '@wow-addon/toc-parser';
import { selectTocVariant, toGlobalDeclarations, evaluateGlobalConditions, resolveGlobalRegistry } from '@wow-addon/toc-metadata-adapter';

const args = process.argv.slice(2);
const rootArgument = args.shift();
const limits = { '--max-entries': 100000, '--max-file-bytes': 8 * 1024 * 1024 };
let requireAll = false;
let luaEnabled = false;
let xmlEnabled = false;
let luaInputProfile = null;
let selectionProfilePath = null;
let conditionProfilePath = null;
let resolutionProfilePath = null;
let xmlProviderProfilePath = null;
let xmlInlineProfilePath = null;
let valid = Boolean(rootArgument && !rootArgument.startsWith('--'));
while (args.length && valid) {
  const flag = args.shift();
  if (flag === '--require-all-parsers') { requireAll = true; continue; }
  if (flag === '--lua-analysis') {
    if (luaEnabled) { valid = false; break; }
    luaEnabled = true;
    continue;
  }
  if (flag === '--xml-analysis') {
    if (xmlEnabled) { valid = false; break; }
    xmlEnabled = true;
    continue;
  }
  if (flag === '--xml-provider-profile') {
    const value = args.shift();
    if (xmlProviderProfilePath !== null || !value || value.startsWith('--')) { valid = false; break; }
    xmlProviderProfilePath = value;
    continue;
  }
  if (flag === '--xml-inline-lua-profile') {
    const value = args.shift();
    if (xmlInlineProfilePath !== null || !value || value.startsWith('--')) { valid = false; break; }
    xmlInlineProfilePath = value;
    continue;
  }
  if (flag === '--lua-input-profile') {
    const value = args.shift();
    if (luaInputProfile !== null || value !== 'corpus-files') { valid = false; break; }
    luaInputProfile = value;
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
if (!valid || (luaInputProfile !== null && !luaEnabled) || (xmlProviderProfilePath !== null && !xmlEnabled) ||
    (xmlInlineProfilePath !== null && (!xmlEnabled || xmlProviderProfilePath === null))) {
  console.error('Usage: node scripts/inspect-addon-corpus.mjs <AddOns-directory> [--max-entries N] [--max-file-bytes N] [--lua-analysis] [--lua-input-profile corpus-files] [--xml-analysis] [--xml-provider-profile <JSON-file>] [--xml-inline-lua-profile <JSON-file>] [--require-all-parsers] [--selection-profile <JSON-file>] [--condition-profile <JSON-file>] [--resolution-profile <JSON-file>]');
  process.exit(2);
}

const root = path.resolve(rootArgument);
const report = {
  schemaVersion: 1, status: 'passed', fullParsing: false,
  unimplementedParsers: [], disabledParsers: [...(luaEnabled ? [] : ['lua']), ...(xmlEnabled ? [] : ['xml'])],
  missingFullParsingCapabilities: ['xml-provider', 'loader-reference-graph'],
  files: { toc: 0, lua: 0, xml: 0 }, parsed: { toc: 0, lua: 0, xml: 0 },
  entriesVisited: 0, skippedLinks: 0, skippedOversizedTocs: 0, skippedOversizedLua: 0,
  checkedSourceReferences: 0, savedVariableDeclarations: 0,
  adapterDeclarations: 0, conditionDescriptors: 0,
  diagnosticsByCode: {}, diagnosticsBySeverity: { error: 0, warning: 0, info: 0 },
  failures: [],
};
const failures = new Set();
const luaFiles = [];
const xmlFiles = [];
report.tocAnalysis = {
  complete: true, discoveryComplete: false, discovered: 0, attempted: 0, submitted: 0, completed: 0,
  accepted: 0, rejected: 0, skippedOversized: 0, resourceRejected: 0, readFailures: 0,
  backendFailures: 0, invariantFailures: 0, inputBytes: 0,
};
if (xmlEnabled) report.xmlAnalysis = {
  complete: true, discoveryComplete: false, namespaceAware: true, discovered: 0, attempted: 0, submitted: 0, completed: 0,
  accepted: 0, rejected: 0, profileRejected: 0, resourceRejected: 0,
  encodingRejected: 0, inputLimitRejected: 0, readFailures: 0, workerFailures: 0, backendFailures: 0,
  invariantFailures: 0, checkedSourceReferences: 0, checkedDecodedMappings: 0, inputBytes: 0,
  sourceIntegrity: { checked: 0, matching: 0, changed: 0, verificationFailures: 0 },
  diagnosticsByCode: {}, resolvedProviderParticipation: false,
};
if (xmlProviderProfilePath !== null) report.xmlProvider = {
  requested: true, complete: false, discoveryComplete: false,
  association: 'caller-owned-inventory', resolvedProviderParticipation: false,
  discovered: 0, eligible: 0, attempted: 0, submitted: 0, completed: 0, projectionAttempted: 0,
  validated: 0, projectionComplete: 0, projectionIncomplete: 0, rejectedBeforeProjection: 0,
  blocked: 0, skippedOversized: 0, readFailures: 0, encodingRejected: 0, inputLimitRejected: 0,
  workerFailures: 0, backendFailures: 0, invariantFailures: 0, resourceRejected: 0,
  frameCandidates: 0, declarations: 0, references: 0, inlineChunks: 0, inlineHandlers: 0,
  checkedSourceReferences: 0, checkedDecodedMappings: 0, inputBytes: 0, diagnosticsByCode: {},
};
if (xmlProviderProfilePath !== null) report.missingFullParsingCapabilities = ['xml-inline-lua-analysis', 'loader-reference-graph'];
if (xmlInlineProfilePath !== null) {
  report.missingFullParsingCapabilities = ['loader-reference-graph'];
  report.xmlInlineLua = {
    requested: true, complete: false, discoveryComplete: false, association: 'caller-owned-inventory', resolvedProviderParticipation: false,
    discoveredFiles: 0, attemptedFiles: 0, submittedFiles: 0, completedFiles: 0, validatedFiles: 0,
    rejectedBeforeInline: 0, blockedFiles: 0, skippedFiles: 0, skippedOversized: 0,
    readFailures: 0, encodingRejected: 0, inputLimitRejected: 0, workerFailures: 0, backendFailures: 0,
    invariantFailures: 0, resourceRejected: 0, providerBlockedBeforeInline: 0,
    discoveredBodies: 0, eligibleBodies: 0, skippedMissingContext: 0, attemptedBodies: 0,
    syntaxAccepted: 0, syntaxRejected: 0, resourceBlockedBodies: 0, backendBlockedBodies: 0,
    lexicalComplete: 0, lexicalIncomplete: 0, mappingValidated: 0, declarations: 0,
    queriedRecords: 0, originalParts: 0, checkedSourceReferences: 0, diagnosticsByCode: {},
    sourceIntegrity: { checked: 0, matching: 0, changed: 0, verificationFailures: 0 },
  };
}
if (luaEnabled) report.luaAnalysis = {
  complete: true, discoveryComplete: false, attempted: 0, submitted: 0, completed: 0,
  syntaxAccepted: 0, syntaxRejected: 0, incompleteFiles: 0,
  encodingRejected: 0, inputLimitRejected: 0, resourceRejected: 0,
  workerFailures: 0, readFailures: 0, backendFailures: 0, invariantFailures: 0,
  declarations: 0, activation: { unconditional: 0, conditional: 0, unknown: 0 },
  checkedSourceReferences: 0, inputBytes: 0, diagnosticsByCode: {},
  resolvedProviderParticipation: false,
  ...(luaInputProfile === 'corpus-files' ? { profile: 'corpus-files', transport: { strictUtf8: 0, bytePreserving: 0 } } : {}),
};
let incomplete = false;
const fail = (reason, partial = false) => { failures.add(reason); incomplete ||= partial; };
let discoveryComplete = false;
const failDiscovery = (reason, partial = true) => { discoveryComplete = false; fail(reason, partial); };
const selectionGroups = new Map();
let selectionProfile = null;
let selectionReady = true;
let conditionProfile = null;
let conditionReady = true;
let resolutionProfile = null;
let resolutionReady = true;
let xmlProviderPolicy = null;
let xmlProviderReady = true;
let xmlInlineProfile = null;
let xmlInlineReady = true;
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
if (xmlProviderProfilePath !== null) {
  try { xmlProviderPolicy = validateXmlProviderProfile(readProfile(xmlProviderProfilePath)); }
  catch { fail('xml-provider-profile-invalid'); xmlProviderReady = false; }
}
if (xmlInlineProfilePath !== null) {
  try { xmlInlineProfile = validateXmlInlineProfile(readProfile(xmlInlineProfilePath)); }
  catch { fail('xml-inline-lua-profile-invalid'); xmlInlineReady = false; }
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

function checkParse(content, filename, parsed) {
  const metrics = { checkedSourceReferences: 0, conditionDescriptors: 0, adapterDeclarations: 0,
    savedVariableDeclarations: 0, diagnosticsByCode: {}, diagnosticsBySeverity: { error: 0, warning: 0, info: 0 },
    conditionEvaluation: { declarations: 0, availability: { active: 0, inactive: 0, unknown: 0 }, issuesByCode: {} } };
  const pendingFailures = [];
  assert.equal(parsed.metadata.tocPath, filename);
  assert.equal(parsed.metadata.schemaVersion, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
  const lines = content.split(/\r\n|\n|\r/u);
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
      if (count) metrics.checkedSourceReferences++;
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
      metrics.conditionDescriptors++;
    }
  }
  metrics.adapterDeclarations += declarations.length;
  if (conditionProfile !== null) {
    const beforeEvaluation = JSON.stringify(declarations);
    for (const declaration of declarations) {
      const result = evaluateGlobalConditions(declaration, conditionProfile.environment, conditionProfile.policy);
      assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
      assert.ok(Object.hasOwn(metrics.conditionEvaluation.availability, result.availability));
      visit(result, false);
      metrics.conditionEvaluation.declarations++;
      metrics.conditionEvaluation.availability[result.availability]++;
      for (const issue of result.issues) metrics.conditionEvaluation.issuesByCode[issue.code] = (metrics.conditionEvaluation.issuesByCode[issue.code] ?? 0) + 1;
      if (result.availability === 'unknown') pendingFailures.push('condition-unknown');
    }
    assert.equal(JSON.stringify(declarations), beforeEvaluation);
  }
  metrics.savedVariableDeclarations += parsed.metadata.savedVariableDeclarations.length;
  for (const diagnostic of parsed.diagnostics) {
    assert.ok(['TOC0001', 'TOC0002', 'TOC0003', 'TOC0004', 'TOC0005', 'TOC0006'].includes(diagnostic.code));
    assert.equal(diagnostic.severity, diagnostic.code === 'TOC0001' ? 'error' : 'warning');
    metrics.diagnosticsByCode[diagnostic.code] = (metrics.diagnosticsByCode[diagnostic.code] ?? 0) + 1;
    metrics.diagnosticsBySeverity[diagnostic.severity]++;
  }
  return { metrics, pendingFailures, lineLengths: lines.map(line => line.length) };
}

function addCounts(target, additions) {
  for (const [key, count] of Object.entries(additions)) target[key] = (target[key] ?? 0) + count;
}

function inspectToc(filename, folder, depth) {
  const counts = report.tocAnalysis;
  counts.discovered++; counts.attempted++;
  let bytes;
  try { bytes = readBoundedFile(filename, limits['--max-file-bytes']); }
  catch (error) {
    counts.complete = false;
    if (error.code === 'bounded-read-limit') {
      report.skippedOversizedTocs++; counts.skippedOversized++; counts.resourceRejected++;
      fail('oversized-toc', true);
    } else { counts.readFailures++; fail('toc-read-failure', true); }
    return;
  }
  counts.inputBytes += bytes.length;
  const content = bytes.toString('utf8'), relative = path.relative(root, filename);
  let parsed;
  try { counts.submitted++; parsed = parseToc(content, relative); counts.completed++; }
  catch { counts.backendFailures++; counts.complete = false; fail('toc-backend-failure', true); return; }
  try {
    const checked = checkParse(content, relative, parsed);
    let candidate;
    // Only immediate AddOn-folder TOCs participate in selection. Construct the
    // complete association before committing any projection-derived metrics.
    const base = path.basename(folder);
    if ((selectionProfile !== null || resolutionProfile !== null) && depth === 1) {
      const logicalAddonId = JSON.stringify(['local-corpus-group', base]);
      candidate = { identity: { logicalAddonId, tocVariantId: JSON.stringify([logicalAddonId, relative]),
        tocPath: relative, tocSuffix: parsed.metadata.tocSuffix, source: parsed.entries[0].source }, metadata: parsed.metadata };
    }
    const metrics = checked.metrics;
    for (const field of ['checkedSourceReferences', 'conditionDescriptors', 'adapterDeclarations', 'savedVariableDeclarations']) {
      report[field] += metrics[field];
    }
    addCounts(report.diagnosticsByCode, metrics.diagnosticsByCode);
    addCounts(report.diagnosticsBySeverity, metrics.diagnosticsBySeverity);
    if (conditionProfile !== null) {
      report.conditionEvaluation.declarations += metrics.conditionEvaluation.declarations;
      addCounts(report.conditionEvaluation.availability, metrics.conditionEvaluation.availability);
      addCounts(report.conditionEvaluation.issuesByCode, metrics.conditionEvaluation.issuesByCode);
    }
    if (resolutionProfile !== null) sourceLineLengths.set(relative, checked.lineLengths);
    for (const reason of checked.pendingFailures) fail(reason);
    if (candidate) {
      const candidates = selectionGroups.get(base) ?? [];
      candidates.push(candidate); selectionGroups.set(base, candidates);
    }
    report.parsed.toc++;
    if (metrics.diagnosticsBySeverity.error) { counts.rejected++; counts.complete = false; }
    else counts.accepted++;
  } catch { counts.invariantFailures++; counts.complete = false; fail('toc-invariant-failure', true); }
}

function walk(folder, depth = 0) {
  if (depth > 64) { failDiscovery('depth-limit'); return; }
  const remaining = limits['--max-entries'] - report.entriesVisited;
  if (remaining <= 0) { failDiscovery('entry-limit'); return; }
  const entries = [];
  try {
    const directory = fs.opendirSync(folder, { bufferSize: 1 });
    try {
      let entry;
      while ((entry = directory.readSync()) !== null) {
        // Detect overflow with one extra read; do not process an unordered subset.
        if (entries.length >= remaining) { failDiscovery('entry-limit'); return; }
        entries.push(entry);
      }
    } finally { directory.closeSync(); }
  } catch { failDiscovery('directory-read'); return; }
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    if (report.entriesVisited >= limits['--max-entries']) { failDiscovery('entry-limit'); return; }
    report.entriesVisited++;
    const filename = path.join(folder, entry.name);
    let stat;
    // Classify with lstat so junctions are never intentionally followed.
    // Failure to classify an entry leaves the eligible XML inventory unknown.
    // TOC processing errors below are independent of directory discovery.
    try { stat = fs.lstatSync(filename); }
    catch { failDiscovery('read-or-invariant-failure'); continue; }
    try {
      if (stat.isSymbolicLink()) { report.skippedLinks++; failDiscovery('skipped-links'); continue; }
      if (stat.isDirectory()) { walk(filename, depth + 1); continue; }
      if (!stat.isFile()) continue;
      const extension = path.extname(entry.name).slice(1).toLowerCase();
      if (!Object.hasOwn(report.files, extension)) continue;
      report.files[extension]++;
      if (extension === 'lua' && luaEnabled) {
        luaFiles.push({ filename, relative: path.relative(root, filename) });
        continue;
      }
      if (extension === 'xml' && xmlEnabled) {
        xmlFiles.push({ filename, relative: path.relative(root, filename) });
        report.xmlAnalysis.discovered++;
        continue;
      }
      if (extension !== 'toc') continue;
      // Never resolve or read file paths referenced by a TOC; only discovered TOCs.
      inspectToc(filename, folder, depth);
    } catch { fail('read-or-invariant-failure', true); }
  }
}

try {
  if (selectionReady && conditionReady && resolutionReady && xmlProviderReady && xmlInlineReady) {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) failDiscovery('invalid-root', false);
    else { discoveryComplete = true; walk(root); }
  }
} catch { failDiscovery('unreadable-root', false); }
report.tocAnalysis.discoveryComplete = discoveryComplete;
report.tocAnalysis.complete &&= discoveryComplete;
if (luaEnabled) {
  report.luaAnalysis.discoveryComplete = discoveryComplete;
  report.luaAnalysis.complete &&= discoveryComplete;
}
if (xmlEnabled) {
  report.xmlAnalysis.discoveryComplete = discoveryComplete;
  report.xmlAnalysis.complete = discoveryComplete;
}
if (report.xmlProvider) {
  report.xmlProvider.discoveryComplete = discoveryComplete;
  report.xmlProvider.complete = discoveryComplete;
  report.xmlProvider.discovered = report.xmlAnalysis.discovered;
}
if (report.xmlInlineLua) {
  report.xmlInlineLua.discoveryComplete = discoveryComplete;
  report.xmlInlineLua.complete = discoveryComplete;
  report.xmlInlineLua.discoveredFiles = report.xmlAnalysis.discovered;
}
if (luaEnabled) {
  const counts = report.luaAnalysis;
  const expanded = luaInputProfile === 'corpus-files';
  const maximumUnits = (expanded ? 32 : 1) * 1024 * 1024;
  const worker = createLuaWorker({ profile: expanded ? 'corpus' : 'bounded' });
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
        // Keep allocation bounded by the selected input profile even if a
        // caller independently raises the generic byte limit.
        if (stat.size > 4 * maximumUnits) {
          counts.inputLimitRejected++; counts.resourceRejected++; counts.complete = false;
          fail('lua-input-limit', true); continue;
        }
        const bytes = readBoundedFile(filename, Math.min(limits['--max-file-bytes'], 4 * maximumUnits));
        counts.inputBytes += bytes.length;
        try { content = decoder.decode(bytes); if (expanded) counts.transport.strictUtf8++; }
        catch {
          const bom = (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) ||
            (bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[0] === 0xFE && bytes[1] === 0xFF) ||
            (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xFE && bytes[3] === 0xFF);
          if (!expanded || bom) {
            counts.encodingRejected++; counts.complete = false;
            fail('lua-invalid-utf8', true); continue;
          }
          // Buffer latin1 is a byte-preserving transport, not WHATWG/1252 or
          // an assertion about intended Unicode/locale. Original bytes stay.
          content = bytes.toString('latin1'); counts.transport.bytePreserving++;
        }
        if (content.length > maximumUnits) {
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
          options: { addonId: JSON.stringify(['local-corpus-lua-file', relative]),
            ...(expanded ? { profile: 'corpus', allowShebang: true } : {}) } });
        counts.completed++;
      } catch {
        counts.workerFailures++; counts.complete = false; fail('lua-worker-failure', true); continue;
      }
      try {
        assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
        assert.equal(result.schemaVersion, 1);
        assert.ok(Array.isArray(result.declarations) && Array.isArray(result.diagnostics));
        assert.equal(result.complete, result.diagnostics.length === 0);
        let checkedReferences = 0;
        const diagnosticsByCode = {}, activation = { unconditional: 0, conditional: 0, unknown: 0 };
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
            checkedReferences++;
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
          diagnosticsByCode[diagnostic.code] = (diagnosticsByCode[diagnostic.code] ?? 0) + 1;
        }
        if (['LUA0001', 'LUA0002', 'LUA0003', 'LUA0005'].some(code => codes.has(code))) {
          assert.equal(result.declarations.length, 0);
        }
        for (const declaration of result.declarations) {
          assert.equal(declaration.kind, 'lua-global');
          assert.equal(Object.hasOwn(declaration, 'scope'), false);
          assert.ok(Object.hasOwn(activation, declaration.activationState));
          activation[declaration.activationState]++;
        }
        // Commit only after every diagnostic, source and late declaration has
        // validated. A bad file contributes no partial projection metrics.
        counts.checkedSourceReferences += checkedReferences;
        addCounts(counts.diagnosticsByCode, diagnosticsByCode);
        addCounts(counts.activation, activation);
        counts.declarations += result.declarations.length;
        if (codes.has('LUA0001') || codes.has('LUA0005')) {
          counts.backendFailures++; fail('lua-backend-failure', true);
        } else if (codes.has('LUA0003')) {
          counts.resourceRejected++; fail('lua-resource-limit', true);
        } else {
          report.parsed.lua++;
          if (codes.has('LUA0002')) {
            counts.syntaxRejected++; fail('lua-syntax-errors');
          } else counts.syntaxAccepted++;
          if (codes.has('LUA0004')) { counts.incompleteFiles++; fail('lua-analysis-incomplete'); }
        }
        if (!result.complete) counts.complete = false;
      } catch { counts.invariantFailures++; counts.complete = false; fail('lua-invariant-failure', true); }
    }
  } finally { await worker.close(); }
  counts.diagnosticsByCode = Object.fromEntries(Object.entries(counts.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
// XML transport is deliberately fixed: strict UTF-8 (retaining BOM), a bounded
// read, and namespace validation. XML never chooses paths, backend options or
// referenced files for this tooling adapter.
if (xmlEnabled) {
  const counts = report.xmlAnalysis;
  const providerCounts = report.xmlProvider;
  const inlineCounts = report.xmlInlineLua;
  const maximumUnits = 1024 * 1024;
  const maximumBytes = Math.min(limits['--max-file-bytes'], 4 * maximumUnits);
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const worker = createXmlWorker();
  function readXml(filename) {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('xml-read-failure');
    if (stat.size > maximumBytes) throw new Error('xml-input-limit');
    const bytes = readBoundedFile(filename, maximumBytes);
    return { bytes, digest: createHash('sha256').update(bytes).digest('hex') };
  }
  function verifyXml(result, content, filename) {
    const metrics = { checkedSourceReferences: 0, checkedDecodedMappings: 0 };
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.equal(result.schemaVersion, 1);
    assert.equal(typeof result.complete, 'boolean');
    assert.equal(result.complete, result.diagnostics.length === 0);
    assert.ok(Array.isArray(result.elements) && Array.isArray(result.text));
    const starts = [0], lengths = [];
    const breaks = /\r\n|\r|\n/gu;
    for (const match of content.matchAll(breaks)) {
      lengths.push(match.index - starts.at(-1)); starts.push(match.index + match[0].length);
    }
    lengths.push(content.length - starts.at(-1));
    function offsets(source) {
      assert.equal(source.file, filename);
      const positions = [source.range.start, source.range.end];
      const offsets = positions.map(position => {
        assert.ok(Number.isSafeInteger(position.line) && position.line >= 0 && position.line < starts.length);
        assert.ok(Number.isSafeInteger(position.column) && position.column >= 0 && position.column <= lengths[position.line]);
        return starts[position.line] + position.column;
      });
      assert.ok(offsets[1] >= offsets[0]);
      return offsets;
    }
    const slice = source => { const [start, end] = offsets(source); return content.slice(start, end); };
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) {
        offsets(value); metrics.checkedSourceReferences++; return;
      }
      for (const child of Object.values(value)) visit(child);
    }
    visit(result);
    if (!result.complete) {
      assert.equal(result.elements.length, 0); assert.equal(result.text.length, 0);
      return metrics;
    }
    assert.ok(result.elements.length > 0);
    let records = result.elements.length + result.text.length, decodedUnits = 0;
    function mapped(value, attribute, cdata = false) {
      assert.equal(typeof value.value, 'string');
      assert.ok(Array.isArray(value.mappings));
      decodedUnits += value.value.length;
      records += value.mappings.length;
      const [begin, end] = offsets(value.source);
      let decoded = 0, raw = begin;
      for (const mapping of value.mappings) {
        assert.equal(mapping.decodedStart, decoded);
        assert.ok(Number.isSafeInteger(mapping.decodedEnd) && mapping.decodedEnd > decoded && mapping.decodedEnd <= value.value.length);
        const [start, stop] = offsets(mapping.source);
        assert.equal(start, raw); assert.ok(stop > start && stop <= end);
        const original = content.slice(start, stop), projected = value.value.slice(decoded, mapping.decodedEnd);
        if (mapping.kind === 'literal') assert.equal(projected, original);
        else if (mapping.kind === 'normalized') {
          assert.ok((attribute ? /^(?:\r\n|\r|\n|\t)$/u : /^(?:\r\n|\r)$/u).test(original));
          assert.equal(projected, attribute ? ' ' : '\n');
        } else {
          assert.equal(mapping.kind, 'entity'); assert.equal(cdata, false);
          const predefined = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&quot;': '"' };
          if (Object.hasOwn(predefined, original)) assert.equal(projected, predefined[original]);
          else {
            const match = /^&#(?:(x)([0-9a-fA-F]+)|([0-9]+));$/u.exec(original);
            assert.ok(match);
            assert.equal(projected, String.fromCodePoint(Number.parseInt(match[2] ?? match[3], match[1] ? 16 : 10)));
          }
        }
        metrics.checkedDecodedMappings++; decoded = mapping.decodedEnd; raw = stop;
      }
      assert.equal(decoded, value.value.length); assert.equal(raw, end);
    }
    const depths = [];
    for (const [index, element] of result.elements.entries()) {
      assert.equal(slice(element.nameSource), element.name.qualifiedName);
      const [start, end] = offsets(element.source), [openStart, openEnd] = offsets(element.openSource);
      assert.equal(start, openStart); assert.ok(openEnd <= end);
      assert.ok(slice(element.openSource).startsWith('<') && slice(element.openSource).endsWith('>'));
      if (element.closeSource === null) { assert.equal(end, openEnd); assert.ok(slice(element.openSource).endsWith('/>')); }
      else {
        const [closeStart, closeEnd] = offsets(element.closeSource);
        assert.ok(closeStart >= openEnd); assert.equal(closeEnd, end);
        assert.ok(slice(element.closeSource).startsWith('</'));
      }
      if (element.parentIndex === null) { assert.equal(index, 0); depths[index] = 1; }
      else {
        assert.ok(Number.isSafeInteger(element.parentIndex) && element.parentIndex >= 0 && element.parentIndex < index);
        const [parentStart, parentEnd] = offsets(result.elements[element.parentIndex].source);
        assert.ok(start >= parentStart && end <= parentEnd); depths[index] = depths[element.parentIndex] + 1;
      }
      assert.ok(depths[index] <= 256);
      records += element.attributes.length;
      for (const attribute of element.attributes) {
        assert.equal(slice(attribute.nameSource), attribute.name.qualifiedName);
        const [attributeStart, attributeEnd] = offsets(attribute.source), [valueStart, valueEnd] = offsets(attribute.value.source);
        assert.ok(attributeStart >= openStart && attributeEnd <= openEnd && valueStart > attributeStart && valueEnd < attributeEnd);
        const quote = content[valueStart - 1]; assert.ok(quote === '"' || quote === "'"); assert.equal(content[valueEnd], quote);
        mapped(attribute.value, true);
      }
    }
    for (const text of result.text) {
      assert.ok(Number.isSafeInteger(text.parentIndex) && text.parentIndex >= 0 && text.parentIndex < result.elements.length);
      assert.ok(text.kind === 'text' || text.kind === 'cdata');
      const parent = result.elements[text.parentIndex], [start, end] = offsets(text.value.source);
      assert.ok(start >= offsets(parent.openSource)[1] && parent.closeSource !== null && end <= offsets(parent.closeSource)[0]);
      if (text.kind === 'cdata') {
        assert.equal(content.slice(start - 9, start), '<![CDATA['); assert.equal(content.slice(end, end + 3), ']]>');
      }
      mapped(text.value, false, text.kind === 'cdata');
    }
    assert.ok(records <= 50000 && decodedUnits <= 2 * 1024 * 1024);
    return metrics;
  }
  try {
    for (const [fileOrdinal, { filename, relative }] of xmlFiles.entries()) {
      counts.attempted++;
      if (providerCounts) providerCounts.attempted++;
      if (inlineCounts) inlineCounts.attemptedFiles++;
      let providerProjection = null, providerDisposition = 'blocked', providerComplete = false;
      let inlineProjection = null, inlineDisposition = 'blocked';
      const providerErrors = new Set();
      const inlineErrors = new Set();
      function inlineFailure(field, reason) {
        if (!inlineCounts) return;
        if (!inlineErrors.has(field)) { inlineCounts[field]++; inlineErrors.add(field); }
        inlineCounts.complete = false; fail(reason, true);
      }
      function providerFailure(field, reason) {
        if (!providerCounts) return;
        if (!providerErrors.has(field)) { providerCounts[field]++; providerErrors.add(field); }
        providerCounts.complete = false;
        fail(reason, true);
      }
      let input;
      try {
        input = readXml(filename); counts.inputBytes += input.bytes.length;
        if (providerCounts) providerCounts.inputBytes += input.bytes.length;
      }
      catch (error) {
        counts.complete = false;
        if (error.message === 'xml-input-limit') { counts.inputLimitRejected++; counts.resourceRejected++; fail('xml-input-limit', true); }
        else { counts.readFailures++; fail('xml-read-failure', true); }
        if (providerCounts) {
          if (error.message === 'xml-input-limit') {
            providerCounts.skippedOversized++;
            providerFailure('resourceRejected', 'xml-provider-input-limit');
            providerFailure('inputLimitRejected', 'xml-provider-input-limit');
          } else { providerCounts.blocked++; providerFailure('readFailures', 'xml-provider-read-failure'); }
        }
        if (inlineCounts) {
          if (error.message === 'xml-input-limit') {
            inlineCounts.skippedFiles++; inlineCounts.skippedOversized++;
            inlineFailure('resourceRejected', 'xml-inline-lua-input-limit'); inlineFailure('inputLimitRejected', 'xml-inline-lua-input-limit');
          } else { inlineCounts.blockedFiles++; inlineFailure('readFailures', 'xml-inline-lua-read-failure'); }
        }
        continue;
      }
      try {
        let content;
        try { content = decoder.decode(input.bytes); }
        catch {
          counts.encodingRejected++; counts.complete = false; fail('xml-invalid-utf8', true);
          providerFailure('encodingRejected', 'xml-provider-invalid-utf8');
          inlineFailure('encodingRejected', 'xml-inline-lua-invalid-utf8'); continue;
        }
        if (content.length > maximumUnits) {
          counts.inputLimitRejected++; counts.resourceRejected++; counts.complete = false; fail('xml-input-limit', true);
          providerFailure('inputLimitRejected', 'xml-provider-input-limit');
          providerFailure('resourceRejected', 'xml-provider-input-limit');
          inlineFailure('inputLimitRejected', 'xml-inline-lua-input-limit'); inlineFailure('resourceRejected', 'xml-inline-lua-input-limit'); continue;
        }
        let result, providerReply, inlineReply;
        try {
          counts.submitted++;
          if (providerCounts) providerCounts.submitted++;
          if (inlineCounts) inlineCounts.submittedFiles++;
          const response = await worker.analyze({ content, sourcePath: relative,
            ...(providerCounts ? { providerOptions: { addonId: XML_PROVIDER_ADDON_ID, policy: xmlProviderPolicy } } : {}),
            ...(inlineCounts ? { inlineOptions: { profile: xmlInlineProfile, fileOrdinal } } : {}) });
          counts.completed++;
          if (providerCounts) {
            providerCounts.completed++; result = response.syntax; providerReply = response.provider;
            if (providerReply.attempted) providerCounts.projectionAttempted++;
          }
          else result = response;
          if (inlineCounts) { inlineCounts.completedFiles++; inlineReply = response.inlineLua; }
        } catch {
          counts.workerFailures++; counts.complete = false; fail('xml-worker-failure', true);
          providerFailure('workerFailures', 'xml-provider-worker-failure');
          inlineFailure('workerFailures', 'xml-inline-lua-worker-failure'); continue;
        }
        let syntaxValid = false, codes;
        try {
          const metrics = verifyXml(result, content, relative);
          codes = new Set();
          const diagnosticsByCode = {};
          for (const diagnostic of result.diagnostics) {
            assert.ok(['XML0001', 'XML0002', 'XML0003', 'XML0004', 'XML0005'].includes(diagnostic.code));
            assert.equal(diagnostic.severity, 'error');
            codes.add(diagnostic.code);
            diagnosticsByCode[diagnostic.code] = (diagnosticsByCode[diagnostic.code] ?? 0) + 1;
          }
          // Syntax projections and diagnostics form one validation transaction.
          // A late invalid map/code cannot retain an earlier metric prefix.
          counts.checkedSourceReferences += metrics.checkedSourceReferences;
          counts.checkedDecodedMappings += metrics.checkedDecodedMappings;
          addCounts(counts.diagnosticsByCode, diagnosticsByCode);
          if (codes.has('XML0001') || codes.has('XML0005')) { counts.backendFailures++; fail('xml-backend-failure', true); }
          else if (codes.has('XML0003')) { counts.resourceRejected++; fail('xml-resource-limit', true); }
          else {
            report.parsed.xml++;
            if (codes.has('XML0004')) { counts.profileRejected++; counts.rejected++; fail('xml-profile-rejected'); }
            else if (codes.has('XML0002')) { counts.rejected++; fail('xml-syntax-errors'); }
            else counts.accepted++;
          }
          if (!result.complete) counts.complete = false;
          syntaxValid = true;
        } catch {
          counts.invariantFailures++; counts.complete = false; fail('xml-invariant-failure', true);
          providerFailure('invariantFailures', 'xml-provider-syntax-invariant-failure');
          inlineFailure('invariantFailures', 'xml-inline-lua-syntax-invariant-failure');
        }
        if (providerCounts && syntaxValid) {
          if (codes.has('XML0001') || codes.has('XML0005')) providerFailure('backendFailures', 'xml-provider-syntax-backend-failure');
          else if (codes.has('XML0003')) providerFailure('resourceRejected', 'xml-provider-syntax-resource-limit');
          else if (!result.complete) providerDisposition = 'syntax-rejected';
          else {
            providerCounts.eligible++;
            if (providerReply.result === null) providerFailure('backendFailures', 'xml-provider-backend-failure');
            else try {
              providerProjection = verifyXmlProvider(providerReply.result, result, content, relative, xmlProviderPolicy);
              if (providerProjection.outcome === 'resource') providerFailure('resourceRejected', 'xml-provider-resource-limit');
              else if (providerProjection.outcome === 'backend') providerFailure('backendFailures', 'xml-provider-backend-failure');
              else { providerDisposition = 'validated'; providerComplete = providerReply.result.complete; }
            } catch { providerFailure('invariantFailures', 'xml-provider-invariant-failure'); }
          }
        }
        if (inlineCounts && syntaxValid) {
          if (codes.has('XML0001') || codes.has('XML0005')) inlineFailure('backendFailures', 'xml-inline-lua-syntax-backend-failure');
          else if (codes.has('XML0003')) inlineFailure('resourceRejected', 'xml-inline-lua-syntax-resource-limit');
          else if (!result.complete) {
            if (inlineReply?.status === 'rejected-before-inline' && Array.isArray(inlineReply.bodies) && inlineReply.bodies.length === 0) inlineDisposition = 'rejected';
            else inlineFailure('invariantFailures', 'xml-inline-lua-invariant-failure');
          } else if (providerDisposition !== 'validated') {
            inlineFailure('providerBlockedBeforeInline', 'xml-inline-lua-provider-blocked');
            if (providerErrors.has('invariantFailures')) inlineFailure('invariantFailures', 'xml-inline-lua-provider-invariant-failure');
            else if (providerErrors.has('resourceRejected')) inlineFailure('resourceRejected', 'xml-inline-lua-provider-resource-limit');
            else inlineFailure('backendFailures', 'xml-inline-lua-provider-backend-failure');
          } else try {
            inlineProjection = verifyXmlInlineLua(inlineReply, content, relative, result, providerReply.result,
              xmlProviderPolicy, xmlInlineProfile, fileOrdinal);
            if (inlineProjection.status === 'completed') inlineDisposition = 'validated';
            else {
              const field = inlineProjection.status === 'resource' ? 'resourceRejected' : inlineProjection.status === 'backend' ? 'backendFailures' : 'invariantFailures';
              inlineFailure(field, `xml-inline-lua-${inlineProjection.status}-failure`);
              inlineProjection = null;
            }
          } catch { inlineProjection = null; inlineFailure('invariantFailures', 'xml-inline-lua-invariant-failure'); }
        }
      } finally {
        // Re-read with the same fixed bounds; only aggregate equality escapes.
        // This detects source changes without writing or publishing source hashes.
        try {
          const after = readXml(filename); counts.sourceIntegrity.checked++;
          if (inlineCounts) inlineCounts.sourceIntegrity.checked++;
          if (input.digest === after.digest) {
            counts.sourceIntegrity.matching++;
            if (inlineCounts) inlineCounts.sourceIntegrity.matching++;
          }
          else {
            counts.sourceIntegrity.changed++; counts.complete = false; fail('xml-source-changed', true);
            providerFailure('readFailures', 'xml-provider-source-changed');
            providerDisposition = 'blocked'; providerProjection = null;
            if (inlineCounts) inlineCounts.sourceIntegrity.changed++;
            inlineFailure('readFailures', 'xml-inline-lua-source-changed'); inlineDisposition = 'blocked'; inlineProjection = null;
          }
        } catch {
          counts.sourceIntegrity.verificationFailures++; counts.readFailures++; counts.complete = false; fail('xml-integrity-read-failure', true);
          providerFailure('readFailures', 'xml-provider-integrity-read-failure');
          providerDisposition = 'blocked'; providerProjection = null;
          if (inlineCounts) inlineCounts.sourceIntegrity.verificationFailures++;
          inlineFailure('readFailures', 'xml-inline-lua-integrity-read-failure'); inlineDisposition = 'blocked'; inlineProjection = null;
        }
        if (providerCounts) {
          if (providerDisposition === 'syntax-rejected') {
            providerCounts.rejectedBeforeProjection++; providerCounts.complete = false;
          } else if (providerDisposition === 'validated') {
            providerCounts.validated++;
            if (providerComplete) providerCounts.projectionComplete++;
            else { providerCounts.projectionIncomplete++; providerCounts.complete = false; fail('xml-provider-incomplete'); }
          } else { providerCounts.blocked++; providerCounts.complete = false; }
          if (providerProjection) {
            for (const field of ['frameCandidates', 'declarations', 'references', 'inlineChunks', 'inlineHandlers',
              'checkedSourceReferences', 'checkedDecodedMappings']) providerCounts[field] += providerProjection.metrics[field];
            addCounts(providerCounts.diagnosticsByCode, providerProjection.metrics.diagnosticsByCode);
          }
        }
        if (inlineCounts) {
          if (inlineDisposition === 'rejected') { inlineCounts.rejectedBeforeInline++; inlineCounts.complete = false; }
          else if (inlineDisposition === 'validated') {
            inlineCounts.validatedFiles++;
            const metrics = inlineProjection.metrics;
            for (const [field, value] of Object.entries(metrics)) {
              if (field === 'diagnosticsByCode') addCounts(inlineCounts.diagnosticsByCode, value);
              else inlineCounts[field] += value;
            }
            if (!inlineProjection.complete) inlineCounts.complete = false;
            if (metrics.skippedMissingContext) fail('xml-inline-lua-missing-context', true);
            if (metrics.syntaxRejected) fail('xml-inline-lua-syntax-errors');
            if (metrics.lexicalIncomplete) fail('xml-inline-lua-lexical-incomplete');
            if (metrics.resourceBlockedBodies) fail('xml-inline-lua-body-resource-limit', true);
            if (metrics.backendBlockedBodies) fail('xml-inline-lua-body-backend-failure', true);
          } else { inlineCounts.blockedFiles++; inlineCounts.complete = false; }
        }
      }
    }
  } finally { await worker.close(); }
  counts.diagnosticsByCode = Object.fromEntries(Object.entries(counts.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  if (providerCounts) providerCounts.diagnosticsByCode = Object.fromEntries(Object.entries(providerCounts.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  if (providerCounts && providerCounts.validated === 0) {
    providerCounts.complete = false; fail('xml-provider-no-validated-inputs', true);
  }
  if (inlineCounts) {
    inlineCounts.diagnosticsByCode = Object.fromEntries(Object.entries(inlineCounts.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    if (inlineCounts.validatedFiles === 0) { inlineCounts.complete = false; fail('xml-inline-lua-no-validated-files', true); }
  }
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
if (requireAll) {
  if (report.disabledParsers.length > 0) fail('disabled-parsers');
  // Syntax coverage alone does not implement XML providers or loader traversal.
  fail('missing-full-parsing-capabilities');
}
if (report.conditionEvaluation) report.conditionEvaluation.issuesByCode = Object.fromEntries(
  Object.entries(report.conditionEvaluation.issuesByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
report.failures = [...failures].sort();
report.diagnosticsByCode = Object.fromEntries(Object.entries(report.diagnosticsByCode).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
report.status = incomplete ? 'incomplete' : failures.size ? 'failed' : 'passed';
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.size ? 1 : 0;
