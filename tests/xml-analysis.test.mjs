import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseToc } from '@wow-addon/toc-parser';
import { analyzeLua } from '@wow-addon/lua-analysis';
import { buildGlobalRegistry, listGlobals } from '@wow-addon/global-registry';
import { resolveGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { WoWClient } from '@wow-addon/addon-metadata';

let provider;
try { provider = await import('@wow-addon/xml-analysis'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const selector = (localName, namespaceUri = null) => ({ namespaceUri, localName });
const policy = () => ({ roots: [selector('Ui')], frameElements: [selector('Frame')],
  includeElements: [selector('Include')], scriptElements: [selector('Script')],
  handlerContainers: [selector('Scripts')], handlerElements: [selector('OnLoad')] });
const options = changes => ({ addonId: 'authored/Å', policy: policy(), ...changes });
function analyze(content, selected = options(), file = 'Fixture.xml') {
  assert.equal(typeof provider?.analyzeXml, 'function', 'approved XML provider export is absent');
  return provider.analyzeXml(content, file, selected);
}

test('approved XML provider exposes analyzeXml with literal frame candidates and unknown declarations', () => {
  const result = analyze('<Ui><Frame name="Authored"/></Ui>');
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.complete, true);
  assert.equal(result.frames.length, 1);
  assert.equal(result.frames[0].declarationIndex, 0);
  assert.equal(result.declarations[0].name, 'Authored');
  assert.equal(result.declarations[0].kind, 'frame');
  assert.equal(result.declarations[0].activationState, 'unknown');
  assert.deepEqual(listGlobals(buildGlobalRegistry(result.declarations)), []);
});

const range = (sl, sc, el, ec) => ({ start: { line: sl, column: sc }, end: { line: el, column: ec } });
const origin = (file = 'Restriction.toc') => ({ file, range: range(0, 0, 0, 1) });
const condition = changes => ({ providerId: 'authored-provider', name: 'restriction', values: ['era'],
  raw: '[restriction era]', source: origin(), ...changes });
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function offset(input, point) {
  const lines = input.split(/\r\n|\r|\n/u);
  assert.ok(Number.isSafeInteger(point.line) && point.line >= 0 && point.line < lines.length);
  assert.ok(Number.isSafeInteger(point.column) && point.column >= 0 && point.column <= lines[point.line].length);
  let cursor = 0, line = 0;
  for (const match of input.matchAll(/\r\n|\r|\n/gu)) {
    if (line++ === point.line) break;
    cursor = match.index + match[0].length;
  }
  return cursor + point.column;
}
function slice(input, source, file = 'Fixture.xml') {
  assert.equal(source.file, file);
  const start = offset(input, source.range.start), end = offset(input, source.range.end);
  assert.ok(start <= end);
  return input.slice(start, end);
}
function invariant(input, result, file = 'Fixture.xml') {
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  for (const frame of result.frames) {
    slice(input, frame.source, file);
    for (const value of [frame.name, frame.virtual, frame.inherits]) if (value) checkValue(value);
    assert.ok(frame.declarationIndex === null || Number.isInteger(frame.declarationIndex) &&
      frame.declarationIndex >= 0 && frame.declarationIndex < result.declarations.length);
  }
  for (const reference of result.references) { slice(input, reference.source, file); checkValue(reference.target); }
  for (const script of result.scripts) { slice(input, script.source, file); checkValue(script.body); }
  for (const declaration of result.declarations) slice(input, declaration.source, file);
  function checkValue(value) {
    slice(input, value.source, file);
    let end = 0;
    for (const mapping of value.mappings) {
      assert.equal(mapping.decodedStart, end);
      assert.ok(mapping.decodedEnd > end && mapping.decodedEnd <= value.value.length);
      const raw = slice(input, mapping.source, file);
      if (mapping.kind === 'literal') assert.equal(raw, value.value.slice(end, mapping.decodedEnd));
      end = mapping.decodedEnd;
    }
    assert.equal(end, value.value.length);
  }
}
function failed(input, selected = options(), code = 'XUI0001') {
  const result = analyze(input, selected);
  assert.equal(result.complete, false);
  for (const field of ['frames', 'references', 'scripts', 'declarations']) assert.deepEqual(result[field], []);
  assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [code]);
  assert.equal(result.diagnostics[0].severity, 'error');
  assert.equal(analyze('<Ui><Frame name="Recovery"/></Ui>').complete, true);
  return result;
}

test('eight XML provider exports enforce the approved readonly contracts', () => {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict',
    '--exactOptionalPropertyTypes', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'tests/contracts/xml-analysis.ts'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('frame occurrences retain duplicate and string-key names, entity spelling and preorder indices', () => {
  const input = '<Ui><Frame name="Repeat"/><Frame name="Repeat"/><Frame name="Å space-key"/><Frame name="A&amp;B"/></Ui>';
  const result = analyze(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.deepEqual(result.frames.map(frame => [frame.elementIndex, frame.declarationIndex]), [[1, 0], [2, 1], [3, 2], [4, 3]]);
  assert.deepEqual(result.declarations.map(value => value.name), ['Repeat', 'Repeat', 'Å space-key', 'A&B']);
  assert.ok(result.declarations.every(value => value.addonId === 'authored/Å' && value.kind === 'frame' && value.activationState === 'unknown'));
  assert.equal(slice(input, result.declarations[3].source), 'A&amp;B');
  assert.deepEqual(result.diagnostics, []);
});

test('virtual, inherits and unresolved names retain candidates without expanding templates or parent names', () => {
  const input = '<Ui><Frame name="Literal"/><Frame name="Explicit" virtual="false"/>' +
    '<Frame name="Template" virtual="true"/><Frame name="Invalid" virtual="TRUE"/>' +
    '<Frame name=""/><Frame/><Frame name="$parentA"><Frame name="$parentB"/></Frame>' +
    '<Frame name=" Inherited " inherits="Template,Future"/></Ui>';
  const result = analyze(input);
  assert.equal(result.complete, false);
  invariant(input, result);
  assert.equal(result.frames.length, 9);
  assert.deepEqual(result.frames.map(frame => frame.declarationIndex), [0, 1, null, null, null, null, null, null, 2]);
  assert.deepEqual(result.declarations.map(value => value.name), ['Literal', 'Explicit', ' Inherited ']);
  assert.equal(result.frames[2].virtual.value, 'true');
  assert.equal(result.frames[8].inherits.value, 'Template,Future');
  assert.deepEqual(result.diagnostics.map(value => [value.code, value.severity]), [['XUI0004', 'warning']]);
});

test('expanded-name matching honors aliases and unqualified attribute roles without namespace fallback', () => {
  const p = policy();
  for (const field of Object.keys(p)) p[field] = p[field].map(value => ({ ...value, namespaceUri: 'urn:authored' }));
  const input = '<a:Ui xmlns:a="urn:authored" xmlns:b="urn:authored" xmlns:x="urn:wrong">' +
    '<b:Frame name="Alias" x:name="Fake"/><x:Frame name="Wrong"/><Frame name="NoNamespace"/>' +
    '<a:Frame x:name="OnlyNamespaced"/><a:Script x:file="ignored">Body</a:Script></a:Ui>';
  const result = analyze(input, options({ policy: p }));
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[1].name, null);
  assert.deepEqual(result.declarations.map(value => value.name), ['Alias']);
  assert.deepEqual(result.references, []);
  assert.deepEqual(result.scripts.map(value => [value.kind, value.body.value]), [['chunk', 'Body']]);
  const foreign = analyze('<Ui/>', options({ policy: p }));
  assert.equal(foreign.complete, false);
  assert.deepEqual(foreign.frames, []);
  assert.deepEqual(foreign.diagnostics.map(value => [value.code, value.severity]), [['XUI0004', 'warning']]);
  assert.equal(analyze('<Ui xmlns="urn:authored"><Frame name="Default"/></Ui>', options({ policy: p })).declarations[0].name, 'Default');
  const namespacedAttributes = analyze('<Ui xmlns:x="urn:wrong"><Frame name="Literal" x:virtual="true" x:inherits="Fake"/></Ui>');
  assert.deepEqual(namespacedAttributes.declarations.map(value => value.name), ['Literal']);
  assert.equal(namespacedAttributes.frames[0].virtual, null);
  assert.equal(namespacedAttributes.frames[0].inherits, null);
});

test('file references preserve targets, duplicates and order without traversing paths or resolving cycles', () => {
  const targets = ['../other.xml', 'C:\\private\\file.lua', 'https://example.invalid/source.lua', '$variable/path', 'same.xml', 'same.xml'];
  const input = '<Ui>' + targets.map((target, index) => `<${index % 2 ? 'Script' : 'Include'} file="${target}"/>`).join('') +
    '<Frame><Include file="nested.xml"/><Script file="nested.lua"/></Frame></Ui>';
  const result = analyze(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.deepEqual(result.references.map(value => value.target.value), targets);
  assert.deepEqual(result.references.map(value => value.kind), ['include', 'script', 'include', 'script', 'include', 'script']);
  assert.deepEqual(result.references.map(value => value.elementIndex), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(result.scripts, []);
  assert.deepEqual(result.diagnostics, []);
  const mapped = analyze('<Ui><Include file="a&amp;b.xml"/></Ui>');
  assert.equal(mapped.references[0].target.value, 'a&b.xml');
  assert.deepEqual(mapped.references[0].target.mappings.map(value => value.kind), ['literal', 'entity', 'literal']);
});

test('recognized malformed constructs retain independent facts and reject ambiguous or nested bodies', () => {
  const input = '<Ui><Frame name="Good"><Scripts><OnLoad>ok</OnLoad><OnLoad file="bad.lua">bad</OnLoad>' +
    '<OnLoad>A<Unexpected/>B</OnLoad></Scripts><OnLoad>wrong parent</OnLoad></Frame>' +
    '<Include/><Include file=""/><Script file=""/><Script file="x.lua">nonwhite</Script>' +
    '<Script file="y.lua"><Unexpected/></Script><Script>A<Unexpected/>B</Script>' +
    '<Scripts><OnLoad>wrong grandparent</OnLoad></Scripts><Script>valid</Script></Ui>';
  const result = analyze(input);
  assert.equal(result.complete, false);
  invariant(input, result);
  assert.deepEqual(result.declarations.map(value => value.name), ['Good']);
  assert.deepEqual(result.references.map(value => value.target.value), ['', '', 'x.lua', 'y.lua']);
  assert.deepEqual(result.scripts.map(value => [value.kind, value.body.value]), [['handler', 'ok'], ['chunk', 'valid']]);
  assert.equal(result.diagnostics.length, 8);
  assert.ok(result.diagnostics.every(value => value.code === 'XUI0004' && value.severity === 'warning'));
  const whitespaceOnly = analyze('<Ui><Script file="x.lua"> \r\n\t<!--gap--><?pi ignored?></Script></Ui>');
  assert.equal(whitespaceOnly.complete, true);
  assert.deepEqual(whitespaceOnly.scripts, []);
});

test('inline body joins text and CDATA with six independently calculated raw-offset mappings', () => {
  const input = '<Ui><Script>A&amp;B<![CDATA[\r\nC]]><!--gap-->D</Script></Ui>';
  const result = analyze(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  const body = result.scripts[0].body;
  assert.equal(body.value, 'A&B\nCD');
  assert.equal(slice(input, body.source), 'A&amp;B<![CDATA[\r\nC]]><!--gap-->D');
  assert.deepEqual(body.mappings.map(value => [value.decodedStart, value.decodedEnd, value.kind,
    offset(input, value.source.range.start), offset(input, value.source.range.end)]), [
    [0, 1, 'literal', 12, 13], [1, 2, 'entity', 13, 18], [2, 3, 'literal', 18, 19],
    [3, 4, 'normalized', 28, 30], [4, 5, 'literal', 30, 31], [5, 6, 'literal', 44, 45],
  ]);
  assert.equal(slice(input, result.scripts[0].source), '<Script>A&amp;B<![CDATA[\r\nC]]><!--gap-->D</Script>');
});

test('body gaps never invent whitespace or merge mappings; empty and self-closing bodies have exact origins', () => {
  const input = '<Ui><Script>Ab<!--gap--><?pi ignored?>cd<![CDATA[]]><![CDATA[EF]]></Script>' +
    '<Script/><Script></Script><Frame><Scripts><OnLoad/></Scripts></Frame></Ui>';
  const result = analyze(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.deepEqual(result.scripts.map(value => [value.kind, value.body.value]), [['chunk', 'AbcdEF'], ['chunk', ''], ['chunk', ''], ['handler', '']]);
  assert.deepEqual(result.scripts[0].body.mappings.map(value => slice(input, value.source)), ['Ab', 'cd', 'EF']);
  for (const script of result.scripts.slice(1)) {
    assert.deepEqual(script.body.mappings, []);
    assert.equal(slice(input, script.body.source), '');
    const wholeEnd = offset(input, script.source.range.end);
    const raw = slice(input, script.source);
    const expected = raw.endsWith('/>') ? wholeEnd : offset(input, script.source.range.start) + raw.indexOf('>') + 1;
    assert.equal(offset(input, script.body.source.range.start), expected);
    assert.equal(offset(input, script.body.source.range.end), expected);
  }
});

test('BOM, astral entities, original paths and mixed line breaks preserve UTF-16 mapped intervals', () => {
  const input = '\uFEFF<Ui>\r\n<Script>🧪&#x1F9EA;\rA\nB\r\nC</Script></Ui>';
  const file = 'Å\\Original.xml';
  const result = analyze(input, options(), file);
  assert.equal(result.complete, true);
  invariant(input, result, file);
  const body = result.scripts[0].body;
  assert.equal(body.value, '🧪🧪\nA\nB\nC');
  assert.deepEqual(body.mappings[0].source.range, range(1, 8, 1, 10));
  assert.deepEqual(body.mappings[1].source.range, range(1, 10, 1, 19));
  assert.deepEqual([body.mappings[1].decodedStart, body.mappings[1].decodedEnd], [2, 4]);
  assert.equal(slice(input, body.mappings[1].source, file), '&#x1F9EA;');
  assert.deepEqual(body.source.range, range(1, 8, 4, 1));
});

test('input, policy and inherited-condition shapes fail closed without coercion and recover independently', () => {
  for (const input of [null, undefined, 1, {}, ['<Ui/>']]) failed(input);
  for (const selected of [null, true, [], {}, options({ addonId: '' }), options({ addonId: 1 }),
    options({ policy: null }), options({ conditions: undefined }), options({ conditions: null }), options({ conditions: Array(1) })]) {
    failed('<Ui/>', selected);
  }
  assert.deepEqual(provider.analyzeXml('<Ui/>', 'Fixture.xml', undefined).diagnostics.map(value => value.code), ['XUI0001']);
  for (const field of Object.keys(policy())) {
    for (const value of [null, {}, Array(1), [null], [selector('')], [selector('a:b')], [selector('a', '')], [selector('a', 1)]]) {
      failed('<Ui/>', options({ policy: { ...policy(), [field]: value } }));
    }
    const duplicate = selector('Dup');
    failed('<Ui/>', options({ policy: { ...policy(), [field]: [duplicate, { ...duplicate }] } }));
  }
  failed('<Ui/>', options({ policy: { ...policy(), roots: [] } }));
  failed('<Ui/>', options({ policy: { ...policy(), frameElements: [selector('Ui')] } }));
  const minimal = { roots: [selector('Ui')], frameElements: [], includeElements: [], scriptElements: [], handlerContainers: [], handlerElements: [] };
  assert.equal(analyze('<Ui><Frame name="Ignored"/></Ui>', options({ policy: minimal })).complete, true);
  assert.deepEqual(analyze('<Ui><Frame name="Ignored"/></Ui>', options({ policy: minimal })).frames, []);
  for (const changes of [{ providerId: '' }, { name: '' }, { raw: 1 }, { values: Array(1) }, { values: [null] },
    { source: null }, { source: origin('') }, { source: { file: 'x', range: range(0, -1, 0, 1) } },
    { source: { file: 'x', range: range(1, 0, 0, 1) } },
    { source: { file: 'x', range: range(0, 0, 0, Number.MAX_SAFE_INTEGER + 1) } }]) {
    failed('<Ui/>', options({ conditions: [condition(changes)] }));
  }
  for (const sourcePath of ['', null, undefined, 1, {}]) {
    const result = provider.analyzeXml('<Ui/>', sourcePath, options());
    assert.equal(result.complete, false);
    assert.deepEqual(result.frames, []);
    assert.deepEqual(result.diagnostics.map(value => value.code), ['XUI0001']);
  }
});

test('only own documented projections are consumed once and unused getters never run', () => {
  const reads = new Map();
  const own = (value, label) => Object.fromEntries(Object.keys(value).map(key => [key, value[key]]));
  function counted(value, label) {
    const projected = {};
    for (const [key, item] of Object.entries(value)) Object.defineProperty(projected, key, { enumerable: true,
      get() { const id = label + '.' + key; reads.set(id, (reads.get(id) ?? 0) + 1); return item; } });
    Object.defineProperty(projected, 'privateExtra', { enumerable: true, get() { throw new Error('PRIVATE_UNUSED'); } });
    return projected;
  }
  const projectedPolicy = counted(Object.fromEntries(Object.entries(policy()).map(([key, values]) =>
    [key, values.map((value, index) => counted(value, key + index))])), 'policy');
  const selected = counted({ addonId: 'owned', policy: projectedPolicy,
    conditions: [counted(condition({ source: counted({ file: 'Restriction.toc', range: counted({
      start: counted({ line: 0, column: 0 }, 'start'), end: counted({ line: 0, column: 1 }, 'end'),
    }, 'range') }, 'source') }), 'condition')] }, 'options');
  const result = analyze('<Ui><Frame name="Owned"/></Ui>', selected);
  assert.equal(result.complete, true);
  assert.ok(reads.size > 20);
  assert.ok([...reads.values()].every(count => count === 1), JSON.stringify([...reads]));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_UNUSED|privateExtra/);
  for (const key of ['addonId', 'policy']) {
    const inherited = Object.assign(Object.create({ [key]: options()[key] }), own(options(), 'unused'));
    delete inherited[key];
    failed('<Ui/>', inherited);
  }
  const inheritedOptional = Object.assign(Object.create({ conditions: [condition({ raw: 'PRIVATE_INHERITED' })] }), options());
  const ignored = analyze('<Ui><Frame name="NoInheritedConditions"/></Ui>', inheritedOptional);
  assert.equal(ignored.complete, true);
  assert.equal(Object.hasOwn(ignored.declarations[0], 'conditions'), false);
  const inheritedPolicy = policy();
  delete inheritedPolicy.roots;
  failed('<Ui/>', options({ policy: Object.assign(Object.create({ roots: [selector('Ui')] }), inheritedPolicy) }));
  const inheritedSelector = Object.assign(Object.create({ localName: 'Frame' }), { namespaceUri: null });
  failed('<Ui/>', options({ policy: { ...policy(), frameElements: [inheritedSelector] } }));
  const inheritedCondition = condition();
  delete inheritedCondition.name;
  failed('<Ui/>', options({ conditions: [Object.assign(Object.create({ name: 'restriction' }), inheritedCondition)] }));
  for (const throwing of [
    { ...options(), get addonId() { throw new Error('PRIVATE_INPUT'); } },
    options({ policy: { ...policy(), get roots() { throw new Error('PRIVATE_INPUT'); } } }),
    options({ conditions: [{ ...condition(), get values() { throw new Error('PRIVATE_INPUT'); } }] }),
  ]) assert.doesNotMatch(JSON.stringify(failed('<Ui/>', throwing)), /PRIVATE_INPUT/);
});

test('consumed arrays are capped before cells are read, including arrays of empty condition values', () => {
  let reads = 0;
  function cappedArray(length) {
    const values = Array(length);
    Object.defineProperty(values, 0, { enumerable: true, get() { reads++; throw new Error('PRIVATE_OVERSIZE_CELL'); } });
    return values;
  }
  for (const selected of [options({ policy: { ...policy(), frameElements: cappedArray(129) } }),
    options({ conditions: cappedArray(257) }), options({ conditions: [condition({ values: cappedArray(1025) })] })]) {
    const result = failed('<Ui/>', selected, 'XUI0003');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_OVERSIZE_CELL/);
  }
  assert.equal(reads, 0);
  const atSelectorLimit = { ...policy(), frameElements: Array.from({ length: 128 }, (_, index) => selector('Frame' + index)) };
  assert.equal(analyze('<Ui><Frame0 name="Limit"/></Ui>', options({ policy: atSelectorLimit })).complete, true);
  assert.equal(analyze('<Ui/>', options({ conditions: Array.from({ length: 256 }, () => condition({ values: [] })) })).complete, true);
  assert.equal(analyze('<Ui/>', options({ conditions: [condition({ values: Array(1024).fill('') })] })).complete, true);
  failed('<Ui/>', options({ conditions: Array.from({ length: 50 }, () => condition({ values: Array(1000).fill('') })) }), 'XUI0003');
});

test('caller array iterators are never consumed in place of dense own numeric selector and condition cells', () => {
  const input = '<Ui><Frame name="Literal"><Scripts><OnLoad>body</OnLoad></Scripts></Frame><Include file="x.xml"/><Script>chunk</Script></Ui>';
  const expected = analyze(input, options({ conditions: [condition()] }));
  assert.equal(expected.complete, true);
  let iteratorReads = 0;
  function altered(array, replacement, throws) {
    Object.defineProperty(array, Symbol.iterator, { get() {
      iteratorReads++;
      if (throws) throw new Error('PRIVATE_ARRAY_ITERATOR');
      return function* () { yield replacement; yield replacement; };
    } });
    return array;
  }
  for (const throws of [true, false]) {
    for (const field of Object.keys(policy())) {
      const p = policy();
      altered(p[field], selector('PrivateIteratorVocabulary'), throws);
      assert.deepEqual(analyze(input, options({ policy: p, conditions: [condition()] })), expected, field);
    }
    const conditions = altered([condition()], condition({ name: 'PRIVATE_ITERATOR_CONDITION' }), throws);
    assert.deepEqual(analyze(input, options({ conditions })), expected);
    const values = altered(['era'], 'PRIVATE_ITERATOR_VALUE', throws);
    assert.deepEqual(analyze(input, options({ conditions: [condition({ values })] })), expected);
  }
  assert.equal(iteratorReads, 0, 'Symbol.iterator access is outside the approved own numeric-cell projection');
});

test('aggregate option entry budget is reserved before reading late over-budget condition value cells', () => {
  let reads = 0;
  const conditions = Array.from({ length: 50 }, () => condition({ values: Array(1000).fill('') }));
  Object.defineProperty(conditions[49].values, 999, { get() { reads++; throw new Error('PRIVATE_AGGREGATE_CELL'); } });
  failed('<Ui/>', options({ conditions }), 'XUI0003');
  assert.equal(reads, 0);
});

test('consumed UTF-16 string units and output records have independent bounded failure paths', () => {
  const limit = 1024 * 1024;
  const selectorUnits = Object.values(policy()).flat().reduce((sum, value) => sum + value.localName.length + (value.namespaceUri?.length ?? 0), 0);
  const atLimit = options({ addonId: 'x'.repeat(limit - selectorUnits) });
  assert.equal(analyze('<Ui><Frame name="Limit"/></Ui>', atLimit).complete, true);
  failed('<Ui/>', { ...atLimit, addonId: atLimit.addonId + 'x' }, 'XUI0003');
  // 49,900 empty value cells + 50 conditions + six selectors fit the input
  // entry budget. One copied declaration fits; two exhaust output records.
  const selected = options({ conditions: Array.from({ length: 50 }, () => condition({ values: Array(998).fill('') })) });
  const input = '<Ui><Frame name="First"/></Ui>';
  assert.equal(analyze(input, selected).complete, true);
  failed('<Ui><Frame name="First"/><Frame name="Second"/></Ui>', selected, 'XUI0003');
  // Independent syntax resource limits pass through rather than becoming XUI.
  failed('<Ui>' + 'x'.repeat(1024 * 1024) + '</Ui>', options(), 'XML0003');
  failed('<Ui>' + '<Frame>'.repeat(256) + '</Frame>'.repeat(256) + '</Ui>', options(), 'XML0003');
});

test('syntax and profile errors pass through with no facts and fixed private-safe diagnostics', () => {
  for (const [input, code] of [['<Ui>&amp</Ui>', 'XML0002'], ['<p:Ui/>', 'XML0002'],
    ['<!DOCTYPE Ui SYSTEM "file:///PRIVATE_NEVER_READ"><Ui/>', 'XML0004'],
    ['<?xml version="1.1"?><Ui/>', 'XML0004']]) {
    const result = failed(input, options(), code);
    assert.doesNotMatch(JSON.stringify(result.diagnostics.map(value => value.message)), /PRIVATE_NEVER_READ|file:\/\/\//);
  }
});

test('frozen inputs, independent calls and nested outputs share no condition, map or source objects', async () => {
  const input = '<Ui><Frame name="A&amp;B" inherits="Template"/><Include file="x.xml"/><Script>A&amp;B</Script></Ui>';
  const selected = freeze(options({ conditions: [condition()] }));
  const before = JSON.stringify(selected);
  const [first, second] = await Promise.all([Promise.resolve().then(() => analyze(input, selected)),
    Promise.resolve().then(() => analyze(input, selected))]);
  const stable = JSON.stringify(second);
  invariant(input, first);
  first.frames[0].name.mappings[0].source.file = 'changed';
  first.frames[0].name.source.range.start.column = 999;
  first.frames[0].source.range.end.line = 999;
  first.references[0].target.value = 'changed';
  first.scripts[0].body.mappings[0].source.range.start.column = 999;
  first.declarations[0].conditions[0].values.push('changed');
  first.declarations[0].conditions[0].source.range.end.column = 999;
  assert.equal(JSON.stringify(second), stable);
  assert.equal(JSON.stringify(selected), before);
  assert.equal(first.declarations[0].source.file, 'Fixture.xml', 'candidate mapping sources do not alias declaration provenance');
  assert.deepEqual(analyze(input, selected), second);
  const two = analyze('<Ui><Frame name="A"/><Frame name="B"/></Ui>', selected);
  two.declarations[0].conditions[0].values.push('mutated first');
  assert.deepEqual(two.declarations[1].conditions[0].values, ['era']);
  assert.equal(two.declarations[0].activationState, 'unknown');
});

test('real XML, TOC and Lua projections compose without nonselected variants or active unknown frames', () => {
  const id = 'authored-installation';
  const candidate = (file, content) => {
    const metadata = parseToc(content, file).metadata;
    return { identity: { logicalAddonId: id, tocVariantId: JSON.stringify([id, file]), tocPath: file,
      tocSuffix: metadata.tocSuffix, source: metadata.sourceReferences[0] }, metadata };
  };
  const era = candidate('A/A_Vanilla.toc', '## SavedVariables: SelectedSaved');
  const retail = candidate('A/A_Mainline.toc', '## SavedVariables: NonselectedSaved');
  const eraXml = analyze('<Ui><Frame name="SelectedCandidate"/><Frame name="$parentChild" virtual="true"/></Ui>', options({ addonId: 'xml-era' }), 'Era.xml');
  const retailXml = analyze('<Ui><Frame name="NonselectedCandidate"/></Ui>', options({ addonId: 'xml-retail' }), 'Retail.xml');
  const lua = analyzeLua('SelectedLua = 1', 'Era.lua', { addonId: 'lua-era' });
  assert.equal(eraXml.frames.length, 2);
  const result = resolveGlobalRegistry({ schemaVersion: 1, client: WoWClient.ClassicEra, clientFamily: 'classic' }, [{
    logicalAddonId: id, addonBaseName: 'A', candidates: [retail, era], selectionPolicy: {
      schemaVersion: 1, id: 'authored', client: WoWClient.ClassicEra, clientFamily: 'classic', suffixPrecedence: ['Vanilla'],
    }, providers: [
      { providerId: 'xml', tocVariantId: era.identity.tocVariantId, declarations: eraXml.declarations },
      { providerId: 'xml', tocVariantId: retail.identity.tocVariantId, declarations: retailXml.declarations },
      { providerId: 'lua', tocVariantId: era.identity.tocVariantId, declarations: lua.declarations },
    ],
  }], { schemaVersion: 1, id: 'explicit-no-condition-rules', nameComparison: 'exact', rules: [] });
  assert.equal(result.complete, false, 'selected unknown XML candidates remain unknown after selection');
  assert.deepEqual(result.activeGlobals, ['SelectedSaved', 'SelectedLua']);
  assert.deepEqual(result.entries.map(value => value.name), ['SelectedSaved', 'SelectedCandidate', 'SelectedLua']);
  const frame = result.entries[1].declarations[0];
  assert.equal(frame.providerId, 'xml');
  assert.equal(frame.originalAddonId, 'xml-era');
  assert.equal(frame.declaration.activationState, 'unknown');
  assert.equal(frame.evaluation.availability, 'unknown');
  assert.equal(frame.declaration.source.file, 'Era.xml');
  assert.ok(result.entries.flatMap(value => value.declarations).every(value => value.tocVariantId === era.identity.tocVariantId));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});
