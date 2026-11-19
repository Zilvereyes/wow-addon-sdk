/** Tooling-only checks. No corpus text, paths, names or messages are reported. */
import assert from 'node:assert/strict';
import {buildSourceLineIndex} from './source-line-index.mjs';

export const XML_PROVIDER_ADDON_ID = 'corpus-xml';
const roles = ['roots', 'frameElements', 'includeElements', 'scriptElements', 'handlerContainers', 'handlerElements'];
const ownKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function validateXmlProviderProfile(profile) {
  assert.ok(ownKeys(profile, ['schemaVersion', 'policy']));
  assert.equal(profile.schemaVersion, 1);
  assert.ok(ownKeys(profile.policy, roles));
  let units = XML_PROVIDER_ADDON_ID.length;
  const selected = new Set();
  for (const role of roles) {
    const list = profile.policy[role];
    assert.ok(Array.isArray(list) && list.length <= 128 && (role !== 'roots' || list.length > 0));
    for (let index = 0; index < list.length; index++) {
      assert.ok(Object.hasOwn(list, index));
      const selector = list[index];
      assert.ok(ownKeys(selector, ['namespaceUri', 'localName']));
      assert.ok(typeof selector.localName === 'string' && selector.localName.length > 0 && !selector.localName.includes(':'));
      assert.ok(selector.namespaceUri === null || (typeof selector.namespaceUri === 'string' && selector.namespaceUri.length > 0));
      units += selector.localName.length + (selector.namespaceUri?.length ?? 0);
      assert.ok(units <= 1024 * 1024);
      const identity = JSON.stringify([selector.namespaceUri, selector.localName]);
      assert.equal(selected.has(identity), false);
      selected.add(identity);
    }
  }
  return profile.policy;
}

/** Validate the whole provider result before returning any aggregate credit. */
export function verifyXmlProvider(result, syntax, content, filename, policy,
  association = { addonId: XML_PROVIDER_ADDON_ID, conditions: [] }, sourceLines) {
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.ok(ownKeys(result, ['schemaVersion', 'complete', 'frames', 'references', 'scripts', 'declarations', 'diagnostics']));
  assert.equal(result.schemaVersion, 1);
  assert.equal(typeof result.complete, 'boolean');
  for (const key of ['frames', 'references', 'scripts', 'declarations', 'diagnostics']) assert.ok(Array.isArray(result[key]));
  assert.equal(result.complete, result.diagnostics.length === 0);
  assert.equal(syntax.complete, true);
  const {starts, lengths} = sourceLines ?? buildSourceLineIndex(content);
  const metrics = { frameCandidates: 0, declarations: 0, references: 0, inlineChunks: 0, inlineHandlers: 0,
    checkedSourceReferences: 0, checkedDecodedMappings: 0, diagnosticsByCode: {} };
  function offsets(source) {
    assert.ok(ownKeys(source, ['file', 'range']));
    assert.equal(source.file, filename);
    assert.ok(ownKeys(source.range, ['start', 'end']));
    const positions = [source.range.start, source.range.end].map(position => {
      assert.ok(ownKeys(position, ['line', 'column']));
      assert.ok(Number.isSafeInteger(position.line) && position.line >= 0 && position.line < starts.length);
      assert.ok(Number.isSafeInteger(position.column) && position.column >= 0 && position.column <= lengths[position.line]);
      return starts[position.line] + position.column;
    });
    assert.ok(positions[1] >= positions[0]);
    metrics.checkedSourceReferences++;
    return positions;
  }
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) { offsets(value); return; }
    // Inherited sources belong to the caller's validated TOC, not this XML.
    // They are checked by exact equality below, never accepted as arbitrary files.
    for (const [key, child] of Object.entries(value)) if (key !== 'conditions') visit(child);
  }
  visit(result);
  const codes = new Set(), warningSources = new Set();
  const sourceIdentity = source => JSON.stringify([source.file, source.range.start.line, source.range.start.column,
    source.range.end.line, source.range.end.column]);
  for (const diagnostic of result.diagnostics) {
    assert.ok(ownKeys(diagnostic, ['code', 'severity', 'message', 'source']));
    assert.ok(['XUI0001', 'XUI0002', 'XUI0003', 'XUI0004'].includes(diagnostic.code));
    assert.equal(diagnostic.severity, diagnostic.code === 'XUI0004' ? 'warning' : 'error');
    assert.equal(typeof diagnostic.message, 'string');
    codes.add(diagnostic.code);
    if (diagnostic.code === 'XUI0004') warningSources.add(sourceIdentity(diagnostic.source));
    metrics.diagnosticsByCode[diagnostic.code] = (metrics.diagnosticsByCode[diagnostic.code] ?? 0) + 1;
  }
  if (['XUI0001', 'XUI0002', 'XUI0003'].some(code => codes.has(code))) {
    assert.equal(result.diagnostics.length, 1);
    for (const key of ['frames', 'references', 'scripts', 'declarations']) assert.equal(result[key].length, 0);
    return { outcome: codes.has('XUI0003') ? 'resource' : 'backend', metrics };
  }
  const elements = syntax.elements;
  const matches = (element, role) => policy[role].some(selector => selector.namespaceUri === element.name.namespaceUri &&
    selector.localName === element.name.localName);
  const attribute = (element, name) => element.attributes.find(value => value.name.namespaceUri === null && value.name.localName === name)?.value ?? null;
  const texts = new Map(), children = new Set();
  for (const text of syntax.text) {
    const list = texts.get(text.parentIndex) ?? []; list.push(text.value); texts.set(text.parentIndex, list);
  }
  for (const element of elements) if (element.parentIndex !== null) children.add(element.parentIndex);
  let records = result.frames.length + result.references.length + result.scripts.length + result.declarations.length +
    result.declarations.length * association.conditions.reduce((sum, condition) => sum + 1 + condition.values.length, 0);
  function mapped(actual, expected) {
    assert.deepEqual(actual, expected);
    records += actual.mappings.length;
    metrics.checkedDecodedMappings += actual.mappings.length;
  }
  const expectedFrames = [], expectedReferences = [], expectedScripts = [], expectedDeclarations = [];
  const expectedWarningSources = new Set();
  const warning = element => expectedWarningSources.add(sourceIdentity(element.source));
  if (!matches(elements[0], 'roots')) warning(elements[0]);
  else for (const [index, element] of elements.entries()) {
    if (index === 0) continue;
    const direct = texts.get(index) ?? [];
    if (matches(element, 'frameElements')) {
      const name = attribute(element, 'name'), virtual = attribute(element, 'virtual'), inherits = attribute(element, 'inherits');
      const declares = name !== null && name.value.length > 0 && !name.value.includes('$') && (virtual === null || virtual.value === 'false');
      expectedFrames.push({ elementIndex: index, name, virtual, inherits, source: element.source,
        declarationIndex: declares ? expectedDeclarations.length : null });
      if (declares) expectedDeclarations.push({ name: name.value, addonId: association.addonId, kind: 'frame',
        activationState: 'unknown', source: name.source,
        ...(association.conditions.length ? { conditions: association.conditions } : {}) });
      if (virtual !== null && !['true', 'false'].includes(virtual.value)) warning(element);
    }
    let kind;
    if (element.parentIndex === 0 && (matches(element, 'includeElements') || matches(element, 'scriptElements'))) {
      const include = matches(element, 'includeElements'), file = attribute(element, 'file');
      if (file !== null) {
        expectedReferences.push({ elementIndex: index, kind: include ? 'include' : 'script', target: file, source: element.source });
        if (file.value.length === 0) warning(element);
      } else if (include) warning(element);
      if (!include) {
        if (children.has(index) || (file !== null && direct.some(value => /[^ \t\r\n]/u.test(value.value)))) warning(element);
        else if (file === null) kind = 'chunk';
      }
    }
    const parent = element.parentIndex === null ? null : elements[element.parentIndex];
    const grandparent = parent?.parentIndex === null || parent?.parentIndex === undefined ? null : elements[parent.parentIndex];
    if (matches(element, 'handlerElements') && parent && matches(parent, 'handlerContainers') &&
        grandparent && grandparent.parentIndex !== null && matches(grandparent, 'frameElements')) {
      if (attribute(element, 'file') !== null || children.has(index)) warning(element);
      else kind = 'handler';
    }
    if (kind) {
      let value = '';
      const mappings = [];
      for (const part of direct) {
        for (const mapping of part.mappings) mappings.push({ ...mapping,
          decodedStart: mapping.decodedStart + value.length, decodedEnd: mapping.decodedEnd + value.length });
        value += part.value;
      }
      const start = element.openSource.range.end, end = element.closeSource?.range.start ?? start;
      expectedScripts.push({ elementIndex: index, kind, body: { value,
        source: { file: filename, range: { start, end } }, mappings }, source: element.source });
    }
  }
  assert.equal(result.frames.length, expectedFrames.length);
  assert.equal(result.references.length, expectedReferences.length);
  assert.equal(result.scripts.length, expectedScripts.length);
  assert.deepEqual(result.declarations, expectedDeclarations);
  for (const [index, frame] of result.frames.entries()) {
    assert.deepEqual(frame, expectedFrames[index]);
    for (const key of ['name', 'virtual', 'inherits']) if (frame[key] !== null) mapped(frame[key], expectedFrames[index][key]);
  }
  for (const [index, reference] of result.references.entries()) {
    assert.deepEqual(reference, expectedReferences[index]); mapped(reference.target, expectedReferences[index].target);
  }
  for (const [index, script] of result.scripts.entries()) {
    assert.deepEqual(script, expectedScripts[index]); mapped(script.body, expectedScripts[index].body);
  }
  assert.ok(records <= 50000);
  assert.equal(result.complete, expectedWarningSources.size === 0);
  // Every ambiguous element needs an XUI0004 on its complete original source;
  // reject missing/relocated/extra warnings while allowing multiple causes on
  // one element to have one or several correctly located diagnostics.
  assert.deepEqual(warningSources, expectedWarningSources);
  metrics.frameCandidates = result.frames.length;
  metrics.declarations = result.declarations.length;
  metrics.references = result.references.length;
  metrics.inlineChunks = result.scripts.filter(script => script.kind === 'chunk').length;
  metrics.inlineHandlers = result.scripts.filter(script => script.kind === 'handler').length;
  return { outcome: 'validated', metrics };
}
