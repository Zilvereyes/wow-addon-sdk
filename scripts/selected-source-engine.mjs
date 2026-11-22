/** Private selected-source trace. Resolver/public aggregate composition is separate. */
import path from 'node:path';
import assert from 'node:assert/strict';
import {getGraphRequest} from './selected-source-context.mjs';
import {createGraphBudget, graphHostBudget, GraphBudgetError} from './selected-source-budget.mjs';
import {normalizeGraphPath} from './selected-source-profile.mjs';
import {selectGraphToc, openGraphReference} from './selected-source-selection.mjs';
import {verifyGraphAnalysisReply, snapshotGraphAnalysisRequest} from './selected-source-analysis.mjs';

const fold = value => value.replace(/[A-Z]/gu, unit => unit.toLowerCase());
/** Version-control directory names that broad discovery never lists (ASCII case-insensitive; issue #11 decision A–D). */
export const VCS_DIRECTORY_NAMES = Object.freeze(['.git', '.svn', '.hg']);
export const isVcsDirectoryName = name => VCS_DIRECTORY_NAMES.includes(fold(name));
const language = value => ({'.toc': 'toc', '.lua': 'lua', '.xml': 'xml'})[path.extname(value).toLowerCase()] ?? null;
const directoryEntryFields = ['name', 'kind', 'reparsePoint'];
const directoryEntryKeyUnits = directoryEntryFields.reduce((sum, field) => sum + field.length, 0);
const own = (value, fields) => assert.ok(value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field)));
function ownEnumerable(value, fields) {
  own(value, fields);
  assert.ok(fields.every(field => Object.prototype.propertyIsEnumerable.call(value, field)));
}
const failure = (kind, reason = kind) => Object.assign(Error('Selected-source graph operation failed.'), {kind, reason});
const classify = error => {
  const message = error?.message;
  if (['SGRAPH0005', 'graph-native-budget', 'graph-native-input'].includes(error?.code) ||
      ['graph-analysis-resource', 'graph-analysis-output-limit'].includes(message)) return 'resource';
  if (error?.code === 'SGRAPH0007' || error?.code === 'ERR_ASSERTION' || ['graph-analysis-invariant', 'graph-analysis-input'].includes(message)) return 'invariant';
  if (message === 'graph-analysis-backend') return 'backend';
  if (/^graph-analysis-/u.test(message ?? '')) return 'worker';
  return ['resource', 'invariant', 'worker', 'backend', 'encoding', 'read'].includes(error?.kind) ? error.kind : 'read';
};

export async function traceSelectedSources(context, host, {keepXmlSyntax = true} = {}) {
  let request, limits, shared, budget;
  try {
    request = getGraphRequest(context); limits = request.profile.limits;
    shared = graphHostBudget(host, context); budget = shared ?? createGraphBudget(context, {now: () => host.nowMilliseconds()});
  } catch (error) {await host.close(); throw error;}
  const trace = {schemaVersion: 1, groups: [], nodes: [], analyses: [], references: [], occurrences: [], guardEvaluations: [], issues: [],
    discovery: {complete: true, entriesVisited: 0, found: {toc: 0, lua: 0, xml: 0}, rejectedLinks: 0, unrepresentableEntries: 0, excludedVcsDirectories: 0},
    files: new Map(), directories: new Map(), providerBatches: new Map(), budget, fatal: null};
  const emergency = {code: 'SGRAPH0005', sources: []};
  const analysisCache = new Map(), textCache = new Map(), failedDirectories = new Set();
  let directoryListRecords = 0, directoryListUnits = 0;
  // Candidate loads and DFS loads are awaited serially; one existing key is
  // sufficient and needs no additional owned Set/container or entry copies.
  let pinnedSourcePath = null;
  let detachReclaimer = null;
  const reserve = (records, units) => budget.retain(records, units, reclaimText);
  const retain = (value, validate) => budget.copy(value, reclaimText, validate);
  function retainAnalysis(record, sourceLanguage, validate) {
    if (keepXmlSyntax || sourceLanguage !== 'xml') return retain(record, validate);
    ownEnumerable(record.result, ['language', 'syntax', 'provider', 'inline']);
    const {language, syntax, provider, inline} = record.result;
    ownEnumerable(syntax, ['schemaVersion', 'complete', 'diagnostics', 'elements', 'text']);
    const {schemaVersion, complete, diagnostics, elements, text} = syntax;
    let temporaryRecords = 0, temporaryUnits = 0;
    const charge = (_owned, records, units) => {
      temporaryRecords += records; temporaryUnits += units;
    };
    try {
      const keyUnits = 'elements'.length + 'text'.length;
      reserve(0, keyUnits); temporaryUnits += keyUnits;
      const ownedElements = retain(elements, charge);
      const ownedText = retain(text, charge);
      const verdict = {schemaVersion, complete, diagnostics};
      return retain({...record, result: {language, syntax: verdict, provider, inline}}, owned => {
        const checkedSyntax = owned.result.syntax;
        checkedSyntax.elements = ownedElements;
        checkedSyntax.text = ownedText;
        // The same full owned reply is required for validation. Only its
        // verdict and diagnostics are needed by aggregate composition.
        try {validate(owned);}
        finally {delete checkedSyntax.elements; delete checkedSyntax.text;}
      });
    } finally {
      budget.release('retainedRecords', temporaryRecords);
      budget.release('retainedStringUnits', temporaryUnits);
    }
  }
  function problem(code, group, sources = [], occurrenceId) {
    const issue = retain({code, ...(group ? {logicalAddonId: group.logicalAddonId} : {}),
      ...(occurrenceId === undefined ? {} : {occurrenceId}), sources}); trace.issues.push(issue);
  }
  function block(group, error, sources = [], occurrenceId) {
    group.graphComplete = false; group.analysisComplete = false;
    const kind = classify(error);
    problem(kind === 'resource' ? 'SGRAPH0005' : ['read', 'encoding'].includes(kind) ? 'SGRAPH0006' : 'SGRAPH0007', group, sources, occurrenceId);
  }
  async function directory(key, consumer = null) {
    budget.check();
    if (failedDirectories.has(key)) throw failure('read');
    if (!trace.directories.has(key)) {
      failedDirectories.add(key);
      const raw = await host.listDirectory(key);
      try {
        budget.check(); own(raw, ['fingerprint', 'entries']);
        assert.ok(typeof raw.fingerprint === 'string' && raw.fingerprint.length > 0 && raw.fingerprint.length <= 4096 && Array.isArray(raw.entries));
        if (!shared) budget.use('directoryEntries', raw.entries.length);
        let entryUnits = 'entries'.length;
        const value = retain(raw, owned => {
          const seen = new Set();
          for (const row of owned.entries) {
            budget.check(); own(row, directoryEntryFields);
            assert.ok(typeof row.name === 'string' && ['file', 'directory', 'link', 'unsupported'].includes(row.kind) && typeof row.reparsePoint === 'boolean');
            assert.equal(seen.has(row.name), false); seen.add(row.name);
            const parsed = normalizeGraphPath(row.name, [], {maximumUnits: limits.pathUnits});
            if (row.kind !== 'unsupported') assert.ok(parsed.status === 'ready' && parsed.components.length === 1);
            entryUnits += directoryEntryKeyUnits + row.name.length + row.kind.length;
          }
          reserve(2, key.length);
        });
        trace.directories.set(key, {...value, consumers: new Set(), valid: true});
        // The retained copy charges the array, each row and each string field.
        directoryListRecords += 1 + value.entries.length;
        directoryListUnits += entryUnits;
        failedDirectories.delete(key);
      } finally {
        host.releaseHandoff?.(raw);
      }
    }
    const value = trace.directories.get(key);
    if (consumer !== null && !value.consumers.has(consumer)) {reserve(1, 0); value.consumers.add(consumer);}
    if (!value.valid) throw failure('read');
    return value;
  }
  async function lookup(input, group) {
    const normalized = normalizeGraphPath(input, [], {maximumUnits: limits.pathUnits});
    if (normalized.status !== 'ready') return {status: normalized.status};
    if (normalized.components.length - 1 > limits.directoryDepth) return {status: 'budget'};
    const actual = [];
    for (let index = 0; index < normalized.components.length; index++) {
      const listing = await directory(actual.join(path.sep), group.index), wanted = normalized.components[index];
      const equivalent = listing.entries.filter(row => fold(row.name) === fold(wanted));
      if (equivalent.length > 1) return {status: 'ambiguous'};
      const row = equivalent[0];
      if (!row || (request.profile.pathPolicy.caseComparison === 'exact' && row.name !== wanted)) return {status: 'missing'};
      if (row.reparsePoint || row.kind === 'link') return {status: 'blocked'};
      if (row.kind === 'unsupported') return {status: 'unsupported'};
      const last = index === normalized.components.length - 1;
      if (row.kind !== (last ? 'file' : 'directory')) return {status: 'blocked'};
      actual.push(row.name);
    }
    return {status: 'ready', sourcePath: actual.join(path.sep)};
  }
  async function discover() {
    const stack = [{key: '', depth: 0}];
    while (stack.length) {
      budget.check(); const {key, depth} = stack.pop();
      try {
        const value = await directory(key); trace.discovery.entriesVisited += value.entries.length;
        const children = [];
        for (const row of value.entries) {
          budget.check();
          if (row.kind === 'link' || row.reparsePoint) {trace.discovery.rejectedLinks++; trace.discovery.complete = false; continue;}
          if (row.kind === 'unsupported') {trace.discovery.unrepresentableEntries++; trace.discovery.complete = false; continue;}
          if (row.kind === 'directory') {
            // Explicit references still resolve through lookup(); only the broad walk skips these.
            if (isVcsDirectoryName(row.name)) {trace.discovery.excludedVcsDirectories++; continue;}
            if (depth + 1 > limits.directoryDepth) {trace.discovery.complete = false; problem('SGRAPH0005'); continue;}
            children.push({key: path.join(key, row.name), depth: depth + 1});
          } else {const selected = language(row.name); if (selected) trace.discovery.found[selected]++;}
        }
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      } catch (error) {trace.discovery.complete = false; problem(classify(error) === 'resource' ? 'SGRAPH0005' : classify(error) === 'invariant' ? 'SGRAPH0007' : 'SGRAPH0006');}
    }
  }
  function evict(key) {
    const value = textCache.get(key); textCache.delete(key);
    budget.release('textCacheBytes', value.bytes); budget.release('retainedRecords', value.records);
    budget.release('retainedStringUnits', value.units);
  }
  function discardTraversalData() {
    for (const key of textCache.keys()) evict(key);
    if (directoryListRecords) {
      for (const value of trace.directories.values()) delete value.entries;
      budget.release('retainedRecords', directoryListRecords);
      budget.release('retainedStringUnits', directoryListUnits);
      directoryListRecords = 0; directoryListUnits = 0;
    }
    let keyUnits = 0;
    for (const key of analysisCache.keys()) keyUnits += key.length;
    budget.release('retainedRecords', analysisCache.size);
    budget.release('retainedStringUnits', keyUnits);
    analysisCache.clear();
    failedDirectories.clear();
  }
  function reclaimText(records, units) {
    for (const key of textCache.keys()) {
      budget.check();
      const current = budget.metrics();
      if (records <= limits.retainedRecords - current.retainedRecords &&
          units <= limits.retainedStringUnits - current.retainedStringUnits) break;
      if (key !== pinnedSourcePath) evict(key);
    }
  }
  function cache({sourcePath, language}, content) {
    // Only TOC and XML emit file references whose original slices need line offsets.
    const indexed = language === 'toc' || language === 'xml';
    let count = indexed ? 1 : 0;
    if (indexed) for (const _break of content.matchAll(/\r\n|\r|\n/gu)) {budget.check(); count++;}
    const bytes = content.length * 2 + count * 8;
    const records = 1 + (indexed ? count + 1 : 0), units = content.length + sourcePath.length;
    for (const key of textCache.keys()) {
      budget.check();
      if (budget.metrics().textCacheBytes + bytes <= limits.textCacheBytes &&
          budget.metrics().retainedRecords + records <= limits.retainedRecords && budget.metrics().retainedStringUnits + units <= limits.retainedStringUnits) break;
      if (key !== pinnedSourcePath) evict(key);
    }
    budget.use('textCacheBytes', bytes);
    try {budget.retain(records, units);} catch (error) {budget.release('textCacheBytes', bytes); throw error;}
    const starts = indexed ? [0] : null;
    if (starts) for (const match of content.matchAll(/\r\n|\r|\n/gu)) starts.push(match.index + match[0].length);
    const value = {content, starts, bytes, records, units}; textCache.set(sourcePath, value); return value;
  }
  function file(sourcePath, group) {
    if (!trace.files.has(sourcePath)) {
      reserve(4, sourcePath.length);
      trace.files.set(sourcePath, {sourcePath, language: language(sourcePath), consumers: new Set(), failures: new Set(), fingerprint: null,
        maximum: null, byteLength: null, verdict: null, valid: true, node: false, submitted: 0, completed: 0, failed: 0,
        unknownStages: 0, reuses: 0, failedCalls: [],
        failureCounts: {read: 0, encoding: 0, resource: 0, worker: 0, backend: 0, invariant: 0},
        integrity: {checked: 0, matching: 0, changed: 0, verificationFailures: 0}});
    }
    const value = trace.files.get(sourcePath);
    if (!value.consumers.has(group.index)) {reserve(1, 0); value.consumers.add(group.index);}
    return value;
  }
  function recordFailure(value, kind) {value.failures.add(kind); value.failureCounts[kind]++;}
  function invalidate(value, changed = false, kind = 'read') {
    value.valid = false; value.verdict = null;
    if (kind === 'read') recordFailure(value, kind);
    if (changed) value.integrity.changed++;
    for (const index of value.consumers) {trace.groups[index].graphComplete = false; trace.groups[index].analysisComplete = false;}
  }
  async function text(value) {
    budget.check();
    if (!value.valid) throw failure('read');
    if (textCache.has(value.sourcePath)) {const cached = textCache.get(value.sourcePath); textCache.delete(value.sourcePath); textCache.set(value.sourcePath, cached); return cached;}
    const maximum = value.language === 'toc' ? 8 * 1024 * 1024 : value.language === 'xml' ? 4 * 1024 * 1024 :
      (request.luaInputProfile === 'corpus-files' ? 128 : 4) * 1024 * 1024;
    let bound = maximum, reservation = 0;
    if (!shared) {bound = Math.min(bound, budget.remainingReadBytes() - 1); if (bound < 1) throw new GraphBudgetError('readBytes');
      reservation = bound + 1; budget.use('readBytes', reservation);}
    const read = await host.readSource(value.sourcePath, bound);
    let content;
    try {
      budget.check(); own(read, ['bytes', 'fingerprint']);
      assert.ok(read.bytes instanceof Uint8Array && read.bytes.length <= bound);
      assert.ok(typeof read.fingerprint === 'string' && read.fingerprint.length > 0 && read.fingerprint.length <= 4096);
      if (!shared) budget.release('readBytes', reservation - read.bytes.length);
      if (value.fingerprint !== null && value.fingerprint !== read.fingerprint) {invalidate(value, true, null); throw failure('read');}
      if (value.fingerprint === null) {reserve(0, read.fingerprint.length); value.fingerprint = read.fingerprint; value.maximum = maximum; value.byteLength = read.bytes.length;}
      try {content = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(read.bytes);}
      catch {
        const bytes = read.bytes, bom = (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) ||
          (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff) ||
          (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff);
        if (value.language !== 'lua' || request.luaInputProfile !== 'corpus-files' || bom) throw failure('encoding');
        content = Buffer.from(bytes).toString('latin1');
      }
    } finally {
      host.releaseHandoff?.(read);
    }
    const maximumUnits = value.language === 'toc' ? 8 * 1024 * 1024 : value.language === 'lua' && request.luaInputProfile === 'corpus-files' ? 32 * 1024 * 1024 : 1024 * 1024;
    if (content.length > maximumUnits) throw failure('resource');
    return cache(value, content);
  }
  function disposition(result) {
    const diagnostics = result.language === 'toc' ? result.parsed.diagnostics : result.language === 'lua' ? result.result.diagnostics : result.syntax.diagnostics;
    const codes = new Set(diagnostics.map(row => row.code));
    if (codes.has('LUA0003') || codes.has('XML0003')) return {verdict: null, blocked: true, complete: false, failure: 'resource'};
    if (codes.has('LUA0005') || codes.has('XML0001') || codes.has('XML0005')) return {verdict: null, blocked: true, complete: false, failure: 'backend'};
    const rejected = result.language === 'toc' ? codes.has('TOC0001') : result.language === 'lua' ? codes.has('LUA0002') : !result.syntax.complete;
    const providerBlocked = result.language === 'xml' && result.syntax.complete && result.provider?.complete !== true;
    const partialInline = result.language === 'xml' && result.inline.some(row => row.status !== 'analyzed' || row.analysis?.complete !== true);
    return {verdict: !rejected, blocked: rejected || providerBlocked,
      complete: !rejected && !providerBlocked && !partialInline && diagnostics.length === 0};
  }
  async function load(sourcePath, group, variantId, conditions) {
    const value = file(sourcePath, group);
    try {
      if (!value.node) {budget.use('sourceNodes', 1); trace.nodes.push(retain({sourcePath, language: value.language})); value.node = true;}
      // The cache belongs to this one immutable complete caller-policy context.
      const keyFor = () => JSON.stringify([group.logicalAddonId, variantId, sourcePath, value.fingerprint, value.language, conditions]);
      if (!value.valid) throw failure('read');
      const previousKey = value.fingerprint === null ? null : keyFor();
      if (previousKey !== null && analysisCache.has(previousKey)) {value.reuses++; return {record: trace.analyses[analysisCache.get(previousKey)], reused: true};}
      if (budget.metrics().analysisRecords >= limits.analysisRecords) throw new GraphBudgetError('analysisRecords');
      const cachedText = await text(value), key = keyFor();
      // The request aliases this content through reply validation; it is not
      // disposable cache retention until that validation has finished.
      pinnedSourcePath = sourcePath;
      try {
      const input = snapshotGraphAnalysisRequest({language: value.language, content: cachedText.content, sourcePath,
        addonId: group.logicalAddonId, conditions, luaProfile: request.luaInputProfile === 'corpus-files' ? 'corpus' : 'bounded',
        allowShebang: value.language === 'lua' && request.luaInputProfile === 'corpus-files', xmlPolicy: request.xmlPolicy, inlineProfile: request.inlineProfile});
      budget.use('analysisRecords', 1); value.submitted++;
      let response;
      try {response = await host.analyze(input); budget.check();}
      catch (error) {
        value.failed++; let confirmed = false;
        if (['graph-analysis-backend', 'graph-analysis-resource', 'graph-analysis-invariant'].includes(error?.message) && Object.hasOwn(error, 'confirmedApiCalls')) try {
          const checked = retain({result: null, failure: classify(error), confirmedApiCalls: error.confirmedApiCalls},
            owned => verifyGraphAnalysisReply(owned, input));
          value.failedCalls.push(checked.confirmedApiCalls); confirmed = true;
        } catch { /* Invalid or over-budget receipts never gain direct-call credit. */ }
        if (!confirmed) value.unknownStages++;
        throw failure(classify(error));
      }
      let record, facts;
      try {
        own(response, ['result', 'confirmedApiCalls']);
        record = retainAnalysis({analysisId: trace.analyses.length, sourcePath, result: response.result, confirmedApiCalls: response.confirmedApiCalls}, value.language,
          owned => {
            verifyGraphAnalysisReply({result: owned.result, confirmedApiCalls: owned.confirmedApiCalls, failure: null}, input);
            facts = disposition(owned.result);
            if (facts.verdict !== null && value.verdict !== null && facts.verdict !== value.verdict) {invalidate(value, false, 'invariant'); throw failure('invariant');}
            reserve(1, key.length);
          });
      } catch (error) {value.failed++; value.unknownStages++; throw error?.code === 'SGRAPH0005' ? error : failure('invariant');}
      trace.analyses.push(record); analysisCache.set(key, record.analysisId); value.completed++;
      if (facts.verdict !== null) value.verdict = facts.verdict;
      if (facts.failure) recordFailure(value, facts.failure);
      return {record, reused: false};
      } finally {pinnedSourcePath = null;}
    } catch (error) {recordFailure(value, classify(error)); throw error;}
  }
  function occurrence(group, sourcePath, parent, referenceId, variantId, conditions, guard, loaded, depth, inline = null, reserved = false) {
    if (depth > limits.graphDepth) throw new GraphBudgetError('graphDepth');
    if (!reserved) budget.use('occurrences', 1);
    const row = retain({occurrenceId: trace.occurrences.length, parentOccurrenceId: parent, referenceId,
      tocVariantId: variantId, logicalAddonId: group.logicalAddonId, sourcePath, kind: inline ? `inline-${inline.kind}` : 'file',
      analysisId: loaded?.record.analysisId ?? null, inlineElementIndex: inline?.elementIndex ?? null,
      reuse: !loaded || inline?.status === 'missing-context' ? 'not-analyzed' : loaded.reused ? 'reused' : 'invoked', conditions, guard});
    trace.occurrences.push(row); return row;
  }
  function events(result) {
    if (result.language === 'toc') return result.parsed.metadata.fileEntries.map((entry, index) => ({type: 'reference', kind: 'toc', index,
      target: entry.path, source: entry.source, constructSource: entry.source,
      conditions: entry.conditions.map(condition => ({providerId: '@wow-addon/toc-metadata-adapter', ...condition}))}));
    if (result.language !== 'xml' || !result.syntax.complete || result.provider === null) return [];
    const rows = [];
    result.provider.references.forEach((entry, index) => rows.push({type: 'reference', kind: entry.kind, index, elementIndex: entry.elementIndex,
      target: entry.target.value, source: entry.target.source, constructSource: entry.source, conditions: []}));
    result.inline.forEach((entry, index) => rows.push({type: 'inline', index, elementIndex: entry.elementIndex, inline: entry}));
    result.provider.frames.forEach((entry, index) => rows.push({type: 'frame', index, elementIndex: entry.elementIndex, frame: entry}));
    return rows.sort((a, b) => a.elementIndex - b.elementIndex);
  }
  function makeFrame(loaded, owner, depth) {
    const result = loaded.record.result;
    const count = result.language === 'toc' ? result.parsed.metadata.fileEntries.length : result.language === 'xml' ?
      (result.provider?.references.length ?? 0) + result.inline.length + (result.provider?.frames.length ?? 0) : 0;
    // Frame + event array + event shells; conditions reference owned source trees,
    // but their translated TOC shells/arrays are newly retained objects.
    const toc = result.language === 'toc' ? result.parsed.metadata.fileEntries : [];
    const descriptors = toc.reduce((total, entry) => total + entry.conditions.length, 0);
    const emptyXmlConditions = result.language === 'xml' ? result.provider?.references.length ?? 0 : 0;
    const records = count + 2 + toc.length + descriptors + emptyXmlConditions;
    const units = descriptors * '@wow-addon/toc-metadata-adapter'.length;
    reserve(records, units);
    return {owner, loaded, events: events(result), cursor: 0, depth, records, units};
  }
  function batch(group, owner, declarationCount, providerId, frameIndex = null) {
    if (declarationCount === 0) return;
    const rows = trace.providerBatches.get(group.index);
    // Only the validated analysis owns declarations during traversal.
    rows.push(retain({
      providerBatchIndex: rows.length, occurrenceId: owner.occurrenceId, analysisId: owner.analysisId,
      tocVariantId: owner.tocVariantId, providerId, declarationCount, frameIndex,
      inlineElementIndex: owner.inlineElementIndex,
    }));
  }
  async function walk(group, root, variantId) {
    const selected = occurrence(group, root.record.sourcePath, null, null, variantId, [], 'active', root, 1);
    const active = new Map([[selected.sourcePath, selected.occurrenceId]]);
    const stack = [makeFrame(root, selected, 1)];
    while (stack.length) {
      budget.check(); const frame = stack.at(-1), {owner} = frame;
      if (frame.cursor >= frame.events.length) {active.delete(owner.sourcePath); stack.pop(); budget.release('retainedRecords', frame.records); budget.release('retainedStringUnits', frame.units); continue;}
      const event = frame.events[frame.cursor++];
      try {
        if (event.type === 'frame') {
          if (event.frame.declarationIndex !== null) batch(group, owner, 1, '@wow-addon/xml-analysis', event.index);
          continue;
        }
        if (event.type === 'inline') {
          const inline = event.inline, child = occurrence(group, owner.sourcePath, owner.occurrenceId, null, variantId,
            owner.conditions, owner.guard, frame.loaded, frame.depth + 1, inline);
          if (inline.status === 'missing-context' || !inline.analysis?.complete) group.analysisComplete = false;
          if (inline.analysis?.diagnostics.some(row => ['LUA0002', 'LUA0003', 'LUA0005'].includes(row.code))) group.graphComplete = false;
          if (inline.analysis) batch(group, child, inline.analysis.declarations.length, '@wow-addon/lua-analysis');
          continue;
        }
        budget.use('referenceOccurrences', 1);
        let rawTarget;
        {
          const sourceText = await text(trace.files.get(owner.sourcePath)), {start, end} = event.source.range;
          assert.ok(sourceText.starts);
          rawTarget = sourceText.content.slice(sourceText.starts[start.line] + start.column, sourceText.starts[end.line] + end.column);
        }
        if (rawTarget.length > limits.pathUnits || event.target.length > limits.pathUnits) throw new GraphBudgetError('pathUnits');
        const conditions = [...owner.conditions, ...event.conditions];
        const row = retain({referenceId: trace.references.length, parentOccurrenceId: owner.occurrenceId, source: event.source,
          constructSource: event.constructSource, analysisId: owner.analysisId, tocFileEntryIndex: event.kind === 'toc' ? event.index : null,
          providerReferenceIndex: event.kind === 'toc' ? null : event.index, rawTarget, targetValue: event.target, expandedTarget: null,
          guard: 'unknown', status: 'blocked', targetSourcePath: null, cycleAncestorOccurrenceId: null});
        reserve(0, 64); // Bounded final enum labels; target/expanded strings are charged separately.
        const gate = await openGraphReference(context, {sourcePath: owner.sourcePath, source: event.source, targetValue: event.target,
          conditions, kind: event.kind}, async target => {
            try {return await lookup(target, group);} catch (error) {return {status: 'blocked', error: classify(error)};}
          });
        const guard = retain({referenceId: row.referenceId, evaluation: gate.evaluation});
        row.guard = gate.evaluation.availability;
        if (gate.expandedTarget !== null) {reserve(0, gate.expandedTarget.length); row.expandedTarget = gate.expandedTarget;}
        trace.references.push(row); trace.guardEvaluations.push(guard);
        if (row.guard === 'unknown') group.analysisComplete = false;
        if (gate.status === 'inactive') {row.status = 'inactive'; continue;}
        if (gate.status !== 'opened' || gate.value.status !== 'ready') {
          const status = gate.status === 'opened' ? gate.value.status : gate.status;
          row.status = ['missing', 'ambiguous', 'unsupported'].includes(status) ? status : 'blocked';
          group.graphComplete = false; group.analysisComplete = false;
          const technical = gate.status === 'opened' ? gate.value.error : null;
          problem(status === 'budget' || technical === 'resource' ? 'SGRAPH0005' : technical === 'read' ? 'SGRAPH0006' : technical ? 'SGRAPH0007' :
            ['missing', 'ambiguous'].includes(status) ? 'SGRAPH0003' : 'SGRAPH0002', group, [event.source], owner.occurrenceId);
          continue;
        }
        const sourcePath = gate.value.sourcePath; reserve(0, sourcePath.length); row.targetSourcePath = sourcePath;
        if (active.has(sourcePath)) {
          row.status = 'cycle'; row.cycleAncestorOccurrenceId = active.get(sourcePath);
          group.graphComplete = false; group.analysisComplete = false; problem('SGRAPH0004', group, [event.source], owner.occurrenceId); continue;
        }
        if (frame.depth + 1 > limits.graphDepth) throw new GraphBudgetError('graphDepth');
        budget.use('occurrences', 1);
        const child = occurrence(group, sourcePath, owner.occurrenceId, row.referenceId, variantId, conditions, row.guard,
          null, frame.depth + 1, null, true);
        let loaded;
        try {loaded = await load(sourcePath, group, variantId, conditions);}
        catch (error) {block(group, error, [event.source], owner.occurrenceId); continue;}
        row.status = 'resolved';
        child.analysisId = loaded.record.analysisId; child.reuse = loaded.reused ? 'reused' : 'invoked';
        const facts = disposition(loaded.record.result);
        if (facts.blocked) group.graphComplete = false;
        if (!facts.complete) group.analysisComplete = false;
        if (loaded.record.result.language === 'lua') batch(group, child, loaded.record.result.result.declarations.length, '@wow-addon/lua-analysis');
        active.set(sourcePath, child.occurrenceId);
        stack.push(makeFrame(loaded, child, frame.depth + 1));
      } catch (error) {block(group, error, [event.source ?? frame.loaded.record.result.parsed?.entries[0].source].filter(Boolean), owner.occurrenceId);}
    }
  }
  try {
    detachReclaimer = budget.attachRetentionReclaimer(reclaimText);
    reserve(2, 128);
    await discover();
    for (const [index, input] of request.profile.addons.entries()) {
      const group = {index, logicalAddonId: input.logicalAddonId, selection: null, candidates: [], selected: null,
        graphComplete: true, analysisComplete: true, resolutionEligible: false};
      reserve(3, input.logicalAddonId.length); trace.groups.push(group); trace.providerBatches.set(index, []);
      // The selector retains one array and a row/loader/loaded shell per candidate.
      // Reserve before calling the loader, including rows whose read will fail.
      reserve(1 + input.tocPaths.length * 3, 0);
      const selected = await selectGraphToc(context, index, async tocPath => {
        const resolved = await lookup(tocPath, group);
        if (resolved.status !== 'ready') throw failure(resolved.status === 'budget' ? 'resource' : 'read');
        const loaded = await load(resolved.sourcePath, group, JSON.stringify([group.logicalAddonId, resolved.sourcePath]), []);
        return {sourcePath: resolved.sourcePath, parsed: loaded.record.result.parsed, loaded};
      });
      group.selection = retain(selected.selection); group.candidates = selected.candidates; group.selected = selected.selected;
      if (selected.selection === null || (!selected.traversable && selected.selection.status !== 'no-match')) {
        group.graphComplete = false; group.analysisComplete = false; problem('SGRAPH0008', group); continue;
      }
      if (selected.traversable) {
        const root = selected.selected.loaded, variantId = selected.selection.selectedVariantId;
        if (!disposition(root.record.result).complete) group.analysisComplete = false;
        await walk(group, root, variantId);
      }
    }
    // Integrity verification uses fingerprints and consumers from the trace.
    // Release the traversal lookups before native verification allocates state.
    discardTraversalData();
    for (const value of trace.files.values()) {
      budget.check(); if (value.fingerprint === null) continue;
      value.integrity.checked++;
      try {
        if (!shared) {
          const bound = Math.min(value.maximum, Math.max(1, value.byteLength), budget.remainingReadBytes() - 1);
          if (bound < Math.max(1, value.byteLength)) throw new GraphBudgetError('readBytes');
          const reservation = bound + 1;
          budget.use('readBytes', reservation); // A boolean cannot refund unobserved verification I/O.
        }
        const maximum = Math.min(value.maximum, Math.max(1, value.byteLength));
        const valid = await host.verifySource(value.sourcePath, value.fingerprint, maximum); budget.check();
        if (valid !== true) {value.integrity.verificationFailures++; invalidate(value); problem('SGRAPH0006', null);}
        else value.integrity.matching++;
      } catch (error) {
        const kind = classify(error); value.integrity.verificationFailures++; invalidate(value, false, null); recordFailure(value, kind);
        problem(kind === 'resource' ? 'SGRAPH0005' : kind === 'invariant' ? 'SGRAPH0007' : 'SGRAPH0006');
      }
    }
    for (const [key, value] of trace.directories) {
      try {
        budget.check(); const valid = await host.verifyDirectory(key, value.fingerprint); budget.check();
        if (valid !== true) throw failure('read');
      } catch (error) {
        value.valid = false; trace.discovery.complete = false;
        for (const index of value.consumers) {trace.groups[index].graphComplete = false; trace.groups[index].analysisComplete = false;}
        problem(classify(error) === 'resource' ? 'SGRAPH0005' : 'SGRAPH0006');
      }
    }
    for (const group of trace.groups) group.resolutionEligible = group.graphComplete && group.selection !== null &&
      ['selected', 'no-match'].includes(group.selection.status);
    return trace;
  } catch (error) {
    trace.fatal = classify(error); emergency.code = trace.fatal === 'resource' ? 'SGRAPH0005' : 'SGRAPH0007'; trace.issues.push(emergency);
    for (const group of trace.groups) {group.graphComplete = false; group.analysisComplete = false; group.resolutionEligible = false;}
    for (const value of trace.files.values()) {value.valid = false; value.verdict = null; value.failures.add(trace.fatal);}
    return trace;
  } finally {
    detachReclaimer?.();
    discardTraversalData();
    try {await host.close();} catch {
      trace.fatal = 'worker'; emergency.code = 'SGRAPH0007'; if (!trace.issues.includes(emergency)) trace.issues.push(emergency);
      for (const group of trace.groups) {group.graphComplete = false; group.analysisComplete = false; group.resolutionEligible = false;}
    }
  }
}
