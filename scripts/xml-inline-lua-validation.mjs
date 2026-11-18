/** Trusted tooling composition and checks; no source execution or file access. */
import assert from 'node:assert/strict';
import { XML_PROVIDER_ADDON_ID, verifyXmlProvider } from './xml-provider-validation.mjs';

const keywords = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in',
  'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while']);
const luaMessages = {
  LUA0001: 'Invalid Lua analysis input projection.',
  LUA0002: 'Invalid syntax under the Lua 5.1 profile.',
  LUA0003: 'Lua analysis resource limit exceeded.',
  LUA0004: 'Dynamic environment access is outside the lexical projection.',
  LUA0005: 'Lua syntax backend projection is unavailable.',
};
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => { assert.ok(record(value) && Object.hasOwn(value, key)); return value[key]; };
const identifier = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value) && !keywords.has(value);
function array(value, maximum) {
  assert.ok(Array.isArray(value) && value.length <= maximum);
  const result = [];
  for (let index = 0; index < value.length; index++) { assert.ok(Object.hasOwn(value, index)); result.push(value[index]); }
  return result;
}
const selectorIdentity = selector => JSON.stringify([selector.namespaceUri, selector.localName]);

export function validateXmlInlineProfile(input) {
  assert.equal(own(input, 'schemaVersion'), 1);
  let units = 0;
  function text(value) { assert.equal(typeof value, 'string'); units += value.length; assert.ok(units <= 1024 * 1024); return value; }
  function context(input, expected) {
    const kind = text(own(input, 'kind')); assert.equal(kind, expected);
    if (kind === 'chunk') return { kind };
    const parameters = array(own(input, 'parameters'), 128);
    let contextUnits = kind.length;
    const snapshot = parameters.map(value => { assert.ok(identifier(value)); text(value); contextUnits += value.length; return value; });
    assert.ok(contextUnits <= 16 * 1024);
    const variadic = own(input, 'variadic'); assert.equal(typeof variadic, 'boolean');
    return { kind, parameters: snapshot, variadic };
  }
  const chunkContext = context(own(input, 'chunkContext'), 'chunk'), seen = new Set();
  const handlers = array(own(input, 'handlers'), 128).map(row => {
    const supplied = own(row, 'element'), localName = text(own(supplied, 'localName'));
    assert.ok(localName.length > 0 && !localName.includes(':'));
    const suppliedUri = own(supplied, 'namespaceUri');
    const namespaceUri = suppliedUri === null ? null : text(suppliedUri);
    assert.ok(namespaceUri === null || namespaceUri.length > 0);
    const element = { namespaceUri, localName }, identity = selectorIdentity(element);
    assert.equal(seen.has(identity), false); seen.add(identity);
    return { element, context: context(own(row, 'context'), 'function-body') };
  });
  return { schemaVersion: 1, chunkContext, handlers };
}

function lines(text) {
  const starts = [0], lengths = [];
  for (const match of text.matchAll(/\r\n|\r|\n/gu)) { lengths.push(match.index - starts.at(-1)); starts.push(match.index + match[0].length); }
  lengths.push(text.length - starts.at(-1));
  function offset(position) {
    assert.ok(record(position) && Number.isSafeInteger(position.line) && position.line >= 0 && position.line < starts.length);
    assert.ok(Number.isSafeInteger(position.column) && position.column >= 0 && position.column <= lengths[position.line]);
    return starts[position.line] + position.column;
  }
  function position(offset) {
    assert.ok(Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length);
    if (text[offset] === '\n' && offset > 0 && text[offset - 1] === '\r') offset--;
    let low = 0, high = starts.length;
    while (low + 1 < high) { const middle = (low + high) >>> 1; if (starts[middle] <= offset) low = middle; else high = middle; }
    return { line: low, column: offset - starts[low] };
  }
  function range(value) { const a = offset(value.start), b = offset(value.end); assert.ok(b >= a); return [a, b]; }
  return { offset, position, range };
}
const enumerable = Object.prototype.propertyIsEnumerable;
const exact = (value, fields) => {
  assert.ok(record(value) && Object.keys(value).length === fields.length &&
    fields.every(field => enumerable.call(value, field)));
};
const summary = () => ({ discoveredBodies: 0, eligibleBodies: 0, skippedMissingContext: 0, attemptedBodies: 0,
  syntaxAccepted: 0, syntaxRejected: 0, resourceBlockedBodies: 0, backendBlockedBodies: 0,
  lexicalComplete: 0, lexicalIncomplete: 0, mappingValidated: 0, declarations: 0,
  queriedRecords: 0, originalParts: 0, checkedSourceReferences: 0, diagnosticsByCode: {} });

export function verifyLuaProjection(analysis, body, context, decodedSourcePath,
  association = { addonId: XML_PROVIDER_ADDON_ID, conditions: [] }, recordLimit = 50000) {
  exact(analysis, ['schemaVersion', 'complete', 'declarations', 'diagnostics']);
  assert.equal(analysis.schemaVersion, 1); assert.equal(typeof analysis.complete, 'boolean');
  assert.ok(Array.isArray(analysis.declarations) && Array.isArray(analysis.diagnostics));
  assert.ok(analysis.declarations.length + analysis.diagnostics.length <= recordLimit);
  assert.equal(analysis.complete, analysis.diagnostics.length === 0);
  const decoded = lines(body.value), queries = [], codes = new Set(), diagnosticsByCode = {};
  function source(source) {
    exact(source, ['file', 'range']); assert.equal(source.file, decodedSourcePath);
    exact(source.range, ['start', 'end']); const offsets = decoded.range(source.range); queries.push(source.range);
    return offsets;
  }
  const conditioned = association.conditions.length > 0;
  const declarationFields = ['name', 'addonId', 'kind', 'activationState', 'source'];
  if (conditioned) declarationFields.push('conditions');
  const activation = conditioned ? 'conditional' : 'unconditional';
  for (const declaration of analysis.declarations) {
    exact(declaration, declarationFields);
    assert.ok(identifier(declaration.name)); assert.equal(declaration.addonId, association.addonId);
    if (conditioned) assert.deepEqual(declaration.conditions, association.conditions);
    assert.equal(declaration.kind, 'lua-global');
    assert.ok(declaration.activationState === activation || declaration.activationState === 'unknown');
    if (context.kind === 'function-body') {
      assert.equal(declaration.activationState, 'unknown'); assert.equal(context.parameters.includes(declaration.name), false);
    }
    const [begin, end] = source(declaration.source);
    assert.equal(body.value.slice(begin, end), declaration.name);
  }
  for (const diagnostic of analysis.diagnostics) {
    exact(diagnostic, ['code', 'severity', 'message', 'source']);
    assert.ok(['LUA0001', 'LUA0002', 'LUA0003', 'LUA0004', 'LUA0005'].includes(diagnostic.code));
    assert.equal(diagnostic.severity, diagnostic.code === 'LUA0004' ? 'warning' : 'error');
    assert.equal(diagnostic.message, luaMessages[diagnostic.code]); source(diagnostic.source); codes.add(diagnostic.code);
    diagnosticsByCode[diagnostic.code] = (diagnosticsByCode[diagnostic.code] ?? 0) + 1;
  }
  if (['LUA0001', 'LUA0002', 'LUA0003', 'LUA0005'].some(code => codes.has(code))) {
    assert.equal(analysis.declarations.length, 0); assert.equal(analysis.diagnostics.length, 1);
  }
  if (codes.has('LUA0004')) assert.ok(analysis.declarations.every(declaration => declaration.activationState === 'unknown'));
  // A prevalidated explicit context cannot legitimately produce invalid-input.
  assert.equal(codes.has('LUA0001'), false);
  const disposition = codes.has('LUA0003') ? 'resourceBlockedBodies' : codes.has('LUA0005') ? 'backendBlockedBodies' :
    codes.has('LUA0002') ? 'syntaxRejected' : 'syntaxAccepted';
  const conditionRecords = analysis.declarations.length * association.conditions.reduce((sum, condition) => sum + 2 + condition.values.length, 0);
  return { queries, conditionRecords, diagnosticsByCode, disposition, lexical: codes.has('LUA0004') ? 'lexicalIncomplete' : 'lexicalComplete' };
}

/** Independent intersection/range checks, using already verified body maps. */
function verifyMapping(mapping, body, queries, content, filename, raw = lines(content), remainingParts = 50000) {
  exact(mapping, ['schemaVersion', 'complete', 'mappings', 'diagnostics']); assert.equal(mapping.schemaVersion, 1);
  assert.equal(mapping.complete, true); assert.deepEqual(mapping.diagnostics, []);
  assert.ok(Array.isArray(mapping.mappings)); assert.equal(mapping.mappings.length, queries.length);
  assert.ok(queries.length <= 50000 && Number.isSafeInteger(remainingParts) && remainingParts >= 0);
  const partLimit = Math.min(remainingParts, 50000 - queries.length);
  const decoded = lines(body.value), spans = body.mappings;
  let parts = 0, sourceUnits = 0;
  const original = (a, b) => ({ file: filename, range: { start: raw.position(a), end: raw.position(b) } });
  const decodedRange = (a, b) => ({ start: decoded.position(a), end: decoded.position(b) });
  function firstAfter(point) {
    let low = 0, high = spans.length;
    while (low < high) { const middle = (low + high) >>> 1; if (spans[middle].decodedEnd <= point) low = middle + 1; else high = middle; }
    return low;
  }
  for (const [index, query] of queries.entries()) {
    const actual = mapping.mappings[index]; exact(actual, ['decodedRange', 'parts']); assert.deepEqual(actual.decodedRange, query);
    assert.ok(Array.isArray(actual.parts) && actual.parts.length <= partLimit - parts);
    parts += actual.parts.length; // Reserve the whole array before constructing any expected part.
    const [begin, end] = decoded.range(query), expected = [];
    function part(a, b, kind, source) {
      assert.ok(expected.length < actual.parts.length);
      expected.push({ decodedRange: decodedRange(a, b), kind, source });
    }
    if (begin === end) {
      let source, kind = 'anchor';
      if (!spans.length) source = { file: filename, range: { start: body.source.range.start, end: body.source.range.start } };
      else if (begin === body.value.length) { const point = spans.at(-1).source.range.end; source = { file: filename, range: { start: point, end: point } }; }
      else {
        const span = spans[firstAfter(begin)], [start] = raw.range(span.source.range);
        if (begin > span.decodedStart && span.kind === 'entity') { source = span.source; kind = 'entity'; }
        else if (begin > span.decodedStart) { assert.equal(span.kind, 'literal'); source = original(start + begin - span.decodedStart, start + begin - span.decodedStart); }
        else { const point = span.source.range.start; source = { file: filename, range: { start: point, end: point } }; }
      }
      part(begin, end, kind, source);
    } else for (let cursor = firstAfter(begin); cursor < spans.length && spans[cursor].decodedStart < end; cursor++) {
      const span = spans[cursor], a = Math.max(begin, span.decodedStart), b = Math.min(end, span.decodedEnd);
      const [start] = raw.range(span.source.range);
      part(a, b, span.kind, span.kind === 'literal' ? original(start + a - span.decodedStart, start + b - span.decodedStart) : span.source);
    }
    assert.deepEqual(actual.parts, expected);
    for (const part of actual.parts) { assert.equal(part.source.file, filename); raw.range(part.source.range); sourceUnits += part.source.file.length; }
  }
  assert.ok(mapping.mappings.length + parts <= 50000 && sourceUnits <= 1024 * 1024);
  return parts;
}

function bodyContext(script, syntax, profile) {
  if (script.kind === 'chunk') return profile.chunkContext;
  const element = syntax.elements[script.elementIndex]; assert.ok(element);
  return profile.handlers.find(row => row.element.namespaceUri === element.name.namespaceUri && row.element.localName === element.name.localName)?.context ?? null;
}

export function composeXmlInlineLua(content, filename, syntax, provider, options, analyzeLua, mapXmlValueRanges) {
  const association = options.association ?? { addonId: XML_PROVIDER_ADDON_ID, conditions: [] };
  const blocked = status => ({ schemaVersion: 1, status, bodies: [] });
  if (!syntax.complete) return blocked('rejected-before-inline');
  try {
    if (verifyXmlProvider(provider, syntax, content, filename, options.policy, association).outcome !== 'validated') return blocked('provider-blocked');
  } catch { return blocked('provider-blocked'); }
  return composeInlineBodies(content, filename, syntax, provider, options, association, analyzeLua, mapXmlValueRanges);
}

/** The graph preserves a confirmed provider failure and rejects malformed projections. */
export function composeGraphXmlInlineLua(content, filename, syntax, provider, options, analyzeLua, mapXmlValueRanges) {
  const {association} = options;
  if (verifyXmlProvider(provider, syntax, content, filename, options.policy, association).outcome !== 'validated') return null;
  return composeInlineBodies(content, filename, syntax, provider, options, association, analyzeLua, mapXmlValueRanges);
}

function composeInlineBodies(content, filename, syntax, provider, options, association, analyzeLua, mapXmlValueRanges) {
  const blocked = status => ({ schemaVersion: 1, status, bodies: [] });
  const scripts = provider.scripts;
  if (scripts.length > 5000 || scripts.reduce((sum, script) => sum + script.body.value.length, 0) > 1024 * 1024) return blocked('resource');
  let records = 0;
  const originalLines = lines(content);
  const bodies = [];
  try {
    for (const [index, script] of scripts.entries()) {
      const decodedSourcePath = `decoded:xml-inline:${options.fileOrdinal}:${index}`, context = bodyContext(script, syntax, options.profile);
      const row = { elementIndex: script.elementIndex, kind: script.kind, decodedSourcePath,
        status: context === null ? 'missing-context' : 'analyzed', analysis: null, mapping: null };
      if (context !== null) {
        try { row.analysis = analyzeLua(script.body.value, decodedSourcePath,
          { addonId: association.addonId, conditions: association.conditions, context, profile: 'bounded', allowShebang: false }); }
        catch { return blocked('backend'); }
        const checked = verifyLuaProjection(row.analysis, script.body, context, decodedSourcePath, association);
        records += row.analysis.declarations.length + row.analysis.diagnostics.length + checked.queries.length + checked.conditionRecords;
        if (records > 50000) return blocked('resource');
        try { row.mapping = mapXmlValueRanges(content, filename, script.body, checked.queries); }
        catch { return blocked('backend'); }
        if (row.mapping?.complete === false) {
          exact(row.mapping, ['schemaVersion', 'complete', 'mappings', 'diagnostics']);
          assert.equal(row.mapping.schemaVersion, 1); assert.deepEqual(row.mapping.mappings, []);
          assert.ok(Array.isArray(row.mapping.diagnostics)); assert.equal(row.mapping.diagnostics.length, 1);
          const diagnostic = row.mapping.diagnostics[0]; exact(diagnostic, ['code', 'severity', 'message', 'source']);
          assert.equal(diagnostic.code, 'XUI0003'); assert.equal(diagnostic.severity, 'error');
          assert.equal(diagnostic.message, 'XML analysis resource limit exceeded.');
          assert.deepEqual(diagnostic.source, { file: filename, range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } });
          return blocked('resource');
        }
        assert.ok(Array.isArray(row.mapping?.mappings));
        assert.equal(row.mapping.mappings.length, checked.queries.length);
        let returnedParts = 0;
        for (const mapped of row.mapping.mappings) {
          assert.ok(Array.isArray(mapped?.parts)); returnedParts += mapped.parts.length;
          assert.ok(returnedParts + checked.queries.length <= 50000);
        }
        if (records + returnedParts > 50000) return blocked('resource');
        records += verifyMapping(row.mapping, script.body, checked.queries, content, filename, originalLines, 50000 - records);
        if (records > 50000) return blocked('resource');
      }
      bodies.push(row);
    }
  } catch { return blocked('invariant'); }
  return { schemaVersion: 1, status: 'completed', bodies };
}

export function verifyXmlInlineLua(result, content, filename, syntax, provider, policy, profile, fileOrdinal,
  association = { addonId: XML_PROVIDER_ADDON_ID, conditions: [] }) {
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  exact(result, ['schemaVersion', 'status', 'bodies']); assert.equal(result.schemaVersion, 1);
  assert.ok(['completed', 'rejected-before-inline', 'provider-blocked', 'resource', 'backend', 'invariant'].includes(result.status));
  assert.ok(Array.isArray(result.bodies));
  if (result.status !== 'completed') { assert.deepEqual(result.bodies, []); return { status: result.status, metrics: null, complete: false }; }
  assert.equal(verifyXmlProvider(provider, syntax, content, filename, policy, association).outcome, 'validated');
  return verifyInlineBodies(result.bodies, content, filename, syntax, provider, profile, fileOrdinal, association);
}

/** Validate the graph's wire projection in a single provider pass. */
export function verifyGraphXmlInlineLua(inline, content, filename, syntax, provider, policy, profile, association) {
  assert.ok(Array.isArray(inline));
  if (verifyXmlProvider(provider, syntax, content, filename, policy, association).outcome !== 'validated') {
    assert.deepEqual(inline, []);
    return 0;
  }
  const bodies = inline.map((row, index) => {
    exact(row, ['elementIndex', 'kind', 'status', 'analysis', 'mapping']);
    return {...row, decodedSourcePath: `decoded:xml-inline:0:${index}`};
  });
  assert.deepEqual(JSON.parse(JSON.stringify(bodies)), bodies);
  return verifyInlineBodies(bodies, content, filename, syntax, provider, profile, 0, association).metrics.attemptedBodies;
}

function verifyInlineBodies(bodies, content, filename, syntax, provider, profile, fileOrdinal, association) {
  assert.ok(provider.scripts.length <= 5000); assert.equal(bodies.length, provider.scripts.length);
  assert.ok(provider.scripts.reduce((sum, script) => sum + script.body.value.length, 0) <= 1024 * 1024);
  const metrics = summary(); metrics.discoveredBodies = bodies.length;
  const originalLines = lines(content);
  let records = 0;
  for (const [index, row] of bodies.entries()) {
    exact(row, ['elementIndex', 'kind', 'decodedSourcePath', 'status', 'analysis', 'mapping']);
    const script = provider.scripts[index], context = bodyContext(script, syntax, profile);
    assert.equal(row.elementIndex, script.elementIndex); assert.equal(row.kind, script.kind);
    assert.equal(row.decodedSourcePath, `decoded:xml-inline:${fileOrdinal}:${index}`);
    if (context === null) {
      assert.equal(row.status, 'missing-context'); assert.equal(row.analysis, null); assert.equal(row.mapping, null);
      metrics.skippedMissingContext++; continue;
    }
    assert.equal(row.status, 'analyzed'); metrics.eligibleBodies++; metrics.attemptedBodies++;
    const checked = verifyLuaProjection(row.analysis, script.body, context, row.decodedSourcePath, association);
    records += row.analysis.declarations.length + row.analysis.diagnostics.length + checked.queries.length + checked.conditionRecords;
    assert.ok(records <= 50000);
    const parts = verifyMapping(row.mapping, script.body, checked.queries, content, filename, originalLines, 50000 - records);
    records += parts;
    assert.ok(records <= 50000);
    metrics[checked.disposition]++;
    if (checked.disposition === 'syntaxAccepted') metrics[checked.lexical]++;
    metrics.mappingValidated++; metrics.declarations += row.analysis.declarations.length;
    metrics.queriedRecords += checked.queries.length; metrics.originalParts += parts;
    metrics.checkedSourceReferences += checked.queries.length + parts;
    for (const [code, count] of Object.entries(checked.diagnosticsByCode)) metrics.diagnosticsByCode[code] = (metrics.diagnosticsByCode[code] ?? 0) + count;
  }
  return { status: 'completed', metrics, complete: provider.complete && metrics.skippedMissingContext === 0 &&
    metrics.syntaxRejected === 0 && metrics.resourceBlockedBodies === 0 && metrics.backendBlockedBodies === 0 && metrics.lexicalIncomplete === 0 };
}
