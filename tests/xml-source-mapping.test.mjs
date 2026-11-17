import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as analysis from '@wow-addon/xml-analysis';

const file = 'Å\\Original.xml';
const point = (line, column) => ({ line, column });
const range = (sl, sc, el = sl, ec = sc) => ({ start: point(sl, sc), end: point(el, ec) });
function position(text, offset) {
  let line = 0, start = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/gu)) {
    if (match.index >= offset) break;
    assert.ok(offset >= match.index + match[0].length, 'fixture offset is outside a line terminator');
    line++; start = match.index + match[0].length;
  }
  return point(line, offset - start);
}
const span = (text, start, end = start) => ({ start: position(text, start), end: position(text, end) });
const source = (text, start, end = start, identity = file) => ({ file: identity, range: span(text, start, end) });
const mapped = (text, value, start, end, mappings, identity = file) => ({ value,
  source: source(text, start, end, identity), mappings: mappings.map(([a, b, kind, rawStart, rawEnd]) =>
    ({ decodedStart: a, decodedEnd: b, kind, source: source(text, rawStart, rawEnd, identity) })) });
const literal = (text = '<v>abc</v>', identity = file) => mapped(text, 'abc', 3, 6, [[0, 3, 'literal', 3, 6]], identity);
function map(text, value, queries, identity = file) {
  assert.equal(typeof analysis.mapXmlValueRanges, 'function', 'approved XML source mapper export is absent');
  return analysis.mapXmlValueRanges(text, identity, value, queries);
}
function failure(text, value, queries, code = 'XUI0001', identity = file) {
  const result = map(text, value, queries, identity);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.complete, false);
  assert.deepEqual(result.mappings, []);
  assert.deepEqual(result.diagnostics.map(d => [d.code, d.severity]), [[code, 'error']]);
  assert.deepEqual(result.diagnostics[0].source, { file: typeof identity === 'string' && identity.length <= 1024 * 1024 ? identity : '', range: range(0, 0) });
  assert.doesNotMatch(JSON.stringify(result.diagnostics.map(d => d.message)), /PRIVATE/);
  return result;
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const selector = localName => ({ namespaceUri: null, localName });
const policy = { roots: [selector('Ui')], frameElements: [], includeElements: [], scriptElements: [selector('Script')], handlerContainers: [], handlerElements: [] };

test('approved mapper export maps clipped literals and retains duplicate query order', () => {
  const text = '<v>abc</v>', value = literal(text);
  const queries = [range(0, 1, 0, 3), range(0, 0, 0, 1), range(0, 1, 0, 3)];
  const result = map(text, value, queries);
  assert.equal(result.complete, true);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.mappings.map(m => m.decodedRange), queries);
  assert.deepEqual(result.mappings.map(m => m.parts), [
    [{ decodedRange: queries[0], kind: 'literal', source: source(text, 4, 6) }],
    [{ decodedRange: queries[1], kind: 'literal', source: source(text, 3, 4) }],
    [{ decodedRange: queries[2], kind: 'literal', source: source(text, 4, 6) }],
  ]);
});

test('four mapper exports have readonly typed source parts and literal result schema', () => {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict',
    '--exactOptionalPropertyTypes', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'tests/contracts/xml-source-mapping.ts'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('split identifiers preserve disjoint original contributions rather than a source hull', () => {
  const text = '<Ui><Script>Pub<!--gap-->lic=1</Script></Ui>';
  const value = mapped(text, 'Public=1', 12, 30, [[0, 3, 'literal', 12, 15], [3, 8, 'literal', 25, 30]]);
  const result = map(text, value, [range(0, 0, 0, 6)]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.mappings[0].parts, [
    { decodedRange: range(0, 0, 0, 3), kind: 'literal', source: source(text, 12, 15) },
    { decodedRange: range(0, 3, 0, 6), kind: 'literal', source: source(text, 25, 28) },
  ]);
});

test('actual provider body maps all six independently calculated entity, normalized and gap spans', () => {
  const text = '<Ui><Script>A&amp;B<![CDATA[\r\nC]]><!--gap-->D</Script></Ui>';
  const projection = analysis.analyzeXml(text, file, { addonId: 'authored', policy });
  assert.equal(projection.complete, true);
  const value = projection.scripts[0].body;
  const query = span(value.value, 0, 6);
  const result = map(text, value, [query]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.mappings[0].parts, [
    ['literal', 0, 1, 12, 13], ['entity', 1, 2, 13, 18], ['literal', 2, 3, 18, 19],
    ['normalized', 3, 4, 28, 30], ['literal', 4, 5, 30, 31], ['literal', 5, 6, 44, 45],
  ].map(([kind, a, b, start, end]) => ({ kind, decodedRange: span(value.value, a, b), source: source(text, start, end) })));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('astral entity halves map whole while literal surrogate halves clip by UTF-16 unit', () => {
  const text = '<v>🧪&#x1F600;</v>';
  const value = mapped(text, '🧪😀', 3, 14, [[0, 2, 'literal', 3, 5], [2, 4, 'entity', 5, 14]]);
  const result = map(text, value, [range(0, 0, 0, 1), range(0, 1, 0, 2), range(0, 2, 0, 3), range(0, 3, 0, 4)]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.mappings.map(m => m.parts[0].source), [source(text, 3, 4), source(text, 4, 5), source(text, 5, 14), source(text, 5, 14)]);
  assert.deepEqual(result.mappings.map(m => m.parts[0].kind), ['literal', 'literal', 'entity', 'entity']);
});

test('point rules cover literal interiors, entity interiors, right-biased gaps and trailing gaps', () => {
  const text = '<v>A<!--gap-->&#x1F600;Z<!--tail--></v>';
  const entityStart = text.indexOf('&#'), entityEnd = text.indexOf(';') + 1, z = entityEnd;
  const value = mapped(text, 'A😀Z', 3, text.indexOf('</v>'), [[0, 1, 'literal', 3, 4],
    [1, 3, 'entity', entityStart, entityEnd], [3, 4, 'literal', z, z + 1]]);
  const result = map(text, value, [0, 1, 2, 3, 4].map(column => range(0, column)));
  assert.equal(result.complete, true);
  assert.deepEqual(result.mappings.map(m => [m.parts[0].kind, m.parts[0].source]), [
    ['anchor', source(text, 3)], ['anchor', source(text, entityStart)], ['entity', source(text, entityStart, entityEnd)],
    ['anchor', source(text, z)], ['anchor', source(text, z + 1)],
  ]);
  const ordinary = map('<v>abc</v>', literal(), [range(0, 1)]);
  assert.deepEqual(ordinary.mappings[0].parts, [{ kind: 'anchor', decodedRange: range(0, 1), source: source('<v>abc</v>', 4) }]);
});

test('empty and comments-only values anchor at their enclosing start; empty query lists stay valid', () => {
  for (const text of ['<Ui><Script/></Ui>', '<Ui><Script></Script></Ui>', '<Ui><Script><!--only--><?pi ignored?></Script></Ui>']) {
    const value = analysis.analyzeXml(text, file, { addonId: 'authored', policy }).scripts[0].body;
    const result = map(text, value, [range(0, 0)]);
    assert.equal(result.complete, true);
    assert.deepEqual(result.mappings[0].parts, [{ decodedRange: range(0, 0), kind: 'anchor', source: { file, range: { start: value.source.range.start, end: value.source.range.start } } }]);
    assert.deepEqual(map(text, value, []).mappings, []);
  }
});

test('mixed CR/LF/CRLF and BOM keep original coordinates and reject interior terminator columns', () => {
  const text = '\uFEFF<v>A\r\nB\rC\nD</v>';
  const value = mapped(text, 'A\nB\nC\nD', 4, 12, [[0, 1, 'literal', 4, 5], [1, 2, 'normalized', 5, 7],
    [2, 3, 'literal', 7, 8], [3, 4, 'normalized', 8, 9], [4, 7, 'literal', 9, 12]]);
  const result = map(text, value, [range(0, 1, 1, 1)]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.mappings[0].parts.map(p => p.source), [source(text, 5, 7), source(text, 7, 8)]);
  const entities = '<v>&#13;&#10;</v>';
  const crlf = mapped(entities, '\r\n', 3, 13, [[0, 1, 'entity', 3, 8], [1, 2, 'entity', 8, 13]]);
  assert.equal(map(entities, crlf, [range(0, 0), range(1, 0)]).complete, true);
  const whole = map(entities, crlf, [range(0, 0, 1, 0)]);
  assert.equal(whole.complete, true);
  assert.deepEqual(whole.mappings[0].parts, [
    { kind: 'entity', decodedRange: range(0, 0), source: source(entities, 3, 8) },
    { kind: 'entity', decodedRange: range(0, 0, 1, 0), source: source(entities, 8, 13) },
  ], 'Lua-compatible CRLF canonicalization collapses the interior boundary but preserves both ordered raw contributions');
  failure(entities, crlf, [range(0, 1)]);
});

test('malformed original correspondence and late queries fail the whole batch with no prefix mappings', () => {
  const text = '<v>abc</v>';
  const mutations = [v => { v.source.file = 'Wrong.xml'; }, v => { v.value = 'abd'; },
    v => { v.mappings[0].decodedEnd = 2; }, v => { v.mappings[0].decodedStart = 1; },
    v => { v.mappings[0].source.range.end.column = 7; }, v => { v.mappings[0].kind = 'private-unknown'; },
    v => { v.source.range.end.column = 99; }, v => { v.mappings = Array(1); }];
  for (const mutate of mutations) { const value = literal(text); mutate(value); failure(text, value, [range(0, 0, 0, 1)]); }
  for (const query of [range(0, -1), range(0, 0, 0, 4), range(0, 2, 0, 1), range(1, 0), null]) {
    failure(text, literal(text), [range(0, 0, 0, 1), query]);
  }
  const overlap = mapped('<v>abc</v>', 'abcbc', 3, 6, [[0, 3, 'literal', 3, 6], [3, 5, 'literal', 4, 6]]);
  failure(text, overlap, [range(0, 0)]);
  for (const [spelling, decoded] of [['&#0;', '\u0000'], ['&#xD800;', '\uD800'], ['&#x110000;', 'x'],
    ['&#xFFFF;', '\uFFFF'], ['&#xFFFE;', '\uFFFE'], ['&#x;', 'x'], ['&unknown;', 'x']]) {
    const input = '<v>' + spelling + '</v>';
    failure(input, mapped(input, decoded, 3, 3 + spelling.length, [[0, 1, 'entity', 3, 3 + spelling.length]]), [range(0, 0)]);
  }
  for (const identity of [null, 1, {}, '']) failure(text, literal(text), [], 'XUI0001', identity);
  assert.deepEqual(analysis.mapXmlValueRanges(text, undefined, literal(text), []).diagnostics.map(d => d.code), ['XUI0001']);
  const rawCr = '<v>\r</v>';
  failure(rawCr, mapped(rawCr, '\r', 3, 4, [[0, 1, 'literal', 3, 4]]), [range(0, 0)]);
});

test('attribute and text normalization spellings validate without reparsing or changing decoded line positions', () => {
  for (const [raw, decoded] of [['\t', ' '], ['\n', ' '], ['\r', ' '], ['\r\n', ' '], ['\r', '\n'], ['\r\n', '\n']]) {
    const text = '<v>' + raw + '</v>';
    const value = mapped(text, decoded, 3, 3 + raw.length, [[0, 1, 'normalized', 3, 3 + raw.length]]);
    const result = map(text, value, [span(decoded, 0, 1)]);
    assert.equal(result.complete, true);
    assert.deepEqual(result.mappings[0].parts[0].source, source(text, 3, 3 + raw.length));
    assert.equal(result.mappings[0].parts[0].kind, 'normalized');
  }
});

test('mapper takes one documented own snapshot, never invokes iterators or rereads mutable getters', () => {
  let reads = 0, iteratorReads = 0;
  const text = '<v>abc</v>', input = literal(text);
  const original = input.mappings[0].source;
  Object.defineProperty(input.mappings[0], 'source', { get() { reads++; return reads === 1 ? original : { file: 'PRIVATE_SUBSTITUTION', range: range(99, 99) }; } });
  Object.defineProperty(original.range.start, 'privateExtra', { enumerable: true, get() { throw new Error('PRIVATE_EXTRA'); } });
  Object.defineProperty(input.mappings, Symbol.iterator, { get() { iteratorReads++; throw new Error('PRIVATE_ITERATOR'); } });
  const queries = [range(0, 0, 0, 1)];
  Object.defineProperty(queries, Symbol.iterator, { get() { iteratorReads++; throw new Error('PRIVATE_ITERATOR'); } });
  const result = map(text, input, queries);
  assert.equal(result.complete, true);
  assert.equal(reads, 1);
  assert.equal(iteratorReads, 0);
  assert.deepEqual(result.mappings[0].parts[0].source, source(text, 3, 4));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  const inherited = Object.assign(Object.create({ value: 'abc' }), { source: source(text, 3, 6), mappings: literal(text).mappings });
  failure(text, inherited, queries);
});

test('results, duplicate mappings and repeated calls own all nested parts and source positions', () => {
  const text = '<v>abc</v>', input = freeze(literal(text)), queries = freeze([range(0, 0, 0, 2), range(0, 0, 0, 2)]);
  const before = JSON.stringify([input, queries]);
  const first = map(text, input, queries), second = map(text, input, queries), stable = JSON.stringify(second);
  first.mappings[0].parts[0].source.file = 'changed';
  first.mappings[0].parts[0].decodedRange.start.column = 999;
  first.mappings[0].decodedRange.end.column = 999;
  assert.equal(first.mappings[1].parts[0].source.file, file);
  assert.equal(JSON.stringify(second), stable);
  assert.equal(JSON.stringify([input, queries]), before);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), second);
});

test('array and string input caps reject before over-limit cell getters and keep bounded diagnostic identity', () => {
  let reads = 0;
  const huge = () => { const array = Array(50001); Object.defineProperty(array, 0, { get() { reads++; throw new Error('PRIVATE_CELL'); } }); return array; };
  failure('<v>abc</v>', { ...literal(), mappings: huge() }, [], 'XUI0003');
  failure('<v>abc</v>', literal(), huge(), 'XUI0003');
  assert.equal(reads, 0);
  failure('x'.repeat(1024 * 1024 + 1), literal(), [], 'XUI0003');
  failure('<v/>', { value: 'x'.repeat(1024 * 1024 + 1), source: source('<v/>', 0), mappings: [] }, [], 'XUI0003');
  failure('<v/>', { value: '', source: source('<v/>', 0), mappings: [] }, [], 'XUI0003', 'x'.repeat(1024 * 1024 + 1));
  const longFile = 'x'.repeat(400000);
  const value = literal('<v>abc</v>', longFile);
  failure('<v>abc</v>', value, [], 'XUI0003', longFile);
});

test('combined output mapping/part and emitted path budgets are exact and batch atomic', () => {
  const text = '<v>abc</v>', value = literal(text, 'x');
  const atLimit = Array.from({ length: 25000 }, () => range(0, 0));
  assert.equal(map(text, value, atLimit, 'x').complete, true);
  failure(text, value, [...atLimit, range(0, 0)], 'XUI0003', 'x');
  const identity = 'x'.repeat(1024);
  const long = literal(text, identity);
  assert.equal(map(text, long, Array.from({ length: 1024 }, () => range(0, 0)), identity).complete, true);
  failure(text, long, Array.from({ length: 1025 }, () => range(0, 0)), 'XUI0003', identity);
});
