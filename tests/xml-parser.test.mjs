import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyTypeScriptContract } from './test-node.mjs';
let xml;
try { xml = await import('@wow-addon/xml-parser'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
function parse(content, sourcePath = 'Fixture.xml', options) {
  assert.equal(typeof xml?.parseXml, 'function', 'approved XML parser export is absent');
  return xml.parseXml(content, sourcePath, options);
}
const range = (sl, sc, el, ec) => ({ start: { line: sl, column: sc }, end: { line: el, column: ec } });
function offsetOf(input, point) {
  let line = 0;
  let start = 0;
  for (let i = 0; i < input.length && line < point.line; i++) {
    if (input[i] === '\r' || input[i] === '\n') {
      if (input[i] === '\r' && input[i + 1] === '\n') i++;
      line++;
      start = i + 1;
    }
  }
  assert.equal(line, point.line, 'source line exists');
  const offset = start + point.column;
  assert.ok(Number.isSafeInteger(point.column) && point.column >= 0 && offset <= input.length);
  assert.ok(!/[\r\n]/.test(input.slice(start, offset)), 'column stays on the referenced line');
  return offset;
}
function raw(input, source, file = 'Fixture.xml') {
  assert.equal(source.file, file);
  const start = offsetOf(input, source.range.start);
  const end = offsetOf(input, source.range.end);
  assert.ok(start <= end, 'source range is ordered');
  return input.slice(start, end);
}
function sources(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) found.push(value);
  else for (const item of Object.values(value)) sources(item, found);
  return found;
}
function invariant(input, result, file = 'Fixture.xml') {
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  for (const source of sources(result)) raw(input, source, file);
  for (let i = 0; i < result.elements.length; i++) {
    const parent = result.elements[i].parentIndex;
    assert.ok(parent === null ? i === 0 : Number.isInteger(parent) && parent >= 0 && parent < i);
  }
  for (const text of result.text) assert.ok(Number.isInteger(text.parentIndex) && text.parentIndex >= 0 && text.parentIndex < result.elements.length);
  for (const value of [...result.text.map(text => text.value), ...result.elements.flatMap(element => element.attributes.map(attribute => attribute.value))]) {
    let next = 0;
    for (const span of value.mappings) {
      assert.equal(span.decodedStart, next);
      assert.ok(Number.isInteger(span.decodedEnd) && span.decodedEnd > next && span.decodedEnd <= value.value.length);
      const original = raw(input, span.source, file);
      if (span.kind === 'literal') assert.equal(original, value.value.slice(span.decodedStart, span.decodedEnd));
      else assert.ok(span.kind === 'entity' || span.kind === 'normalized');
      next = span.decodedEnd;
    }
    assert.equal(next, value.value.length);
  }
}
function failed(input, options, sourcePath = 'Fixture.xml') {
  const result = parse(input, sourcePath, options);
  assert.equal(result.complete, false);
  assert.deepEqual(result.elements, []);
  assert.deepEqual(result.text, []);
  assert.ok(result.diagnostics.length > 0);
  assert.ok(result.diagnostics.every(diagnostic => diagnostic.severity === 'error'));
  if (typeof input === 'string' && typeof sourcePath === 'string' && sourcePath) invariant(input, result, sourcePath);
  return result;
}

test('nine XML exports have readonly public contracts and no backend AST', () => {
  verifyTypeScriptContract('tests/contracts/xml-parser.ts');
});
const catalog = JSON.parse(fs.readFileSync('tests/fixtures/lua-xml-syntax.json', 'utf8'));
assert.equal(catalog.xml.length, 27);
for (const vector of catalog.xml) {
  test(`real SDK XML syntax/namespace/profile axes: ${vector.id}`, () => {
    for (const namespaceAware of [false, true]) {
      const expected = vector.profile === 'allowed' && vector.wellFormed && (!namespaceAware || vector.namespaceWellFormed);
      const result = parse(vector.source, 'Fixture.xml', { namespaceAware });
      assert.equal(result.complete, Boolean(expected), `namespaceAware=${namespaceAware}`);
      invariant(vector.source, result);
      if (!expected) {
        assert.deepEqual(result.elements, []);
        assert.deepEqual(result.text, []);
        assert.ok(result.diagnostics.length > 0);
      } else {
        assert.deepEqual(result.diagnostics, []);
        for (const span of vector.spans ?? []) {
          const matches = sources(result).filter(source => raw(vector.source, source) === span.raw);
          assert.ok(matches.length > 0, `original golden source ${span.raw}`);
          assert.ok(matches.some(source => JSON.stringify(source.range) === JSON.stringify(range(...span.start, ...span.end))));
          assert.equal(vector.source.slice(...span.offsets), span.raw);
        }
      }
    }
  });
}

test('elements retain preorder, exact opening/closing/name ranges, parent indices and attribute order', () => {
  const input = '<Root a = "one" b=\'two\'><Child/><Other>t<Inner/></Other></Root>';
  const result = parse(input, 'Å\\Original.xml');
  assert.equal(result.complete, true);
  invariant(input, result, 'Å\\Original.xml');
  assert.deepEqual(result.elements.map(element => element.name.qualifiedName), ['Root', 'Child', 'Other', 'Inner']);
  assert.deepEqual(result.elements.map(element => element.parentIndex), [null, 0, 0, 2]);
  const [root, child, other, inner] = result.elements;
  assert.equal(raw(input, root.source, 'Å\\Original.xml'), input);
  assert.equal(raw(input, root.openSource, 'Å\\Original.xml'), '<Root a = "one" b=\'two\'>');
  assert.equal(raw(input, root.closeSource, 'Å\\Original.xml'), '</Root>');
  assert.equal(raw(input, root.nameSource, 'Å\\Original.xml'), 'Root');
  assert.equal(raw(input, child.source, 'Å\\Original.xml'), '<Child/>');
  assert.deepEqual(child.source, child.openSource);
  assert.equal(child.closeSource, null);
  assert.equal(inner.closeSource, null);
  assert.equal(raw(input, other.source, 'Å\\Original.xml'), '<Other>t<Inner/></Other>');
  assert.deepEqual(root.attributes.map(attribute => attribute.name.qualifiedName), ['a', 'b']);
  assert.deepEqual(root.attributes.map(attribute => raw(input, attribute.source, 'Å\\Original.xml')), ['a = "one"', "b='two'"]);
  assert.deepEqual(root.attributes.map(attribute => raw(input, attribute.value.source, 'Å\\Original.xml')), ['one', 'two']);
  assert.deepEqual(result.text.map(text => [text.parentIndex, text.kind, text.value.value]), [[2, 'text', 't']]);
});

test('default namespace applies to elements while unprefixed attributes remain without a namespace', () => {
  const input = '<r xmlns="urn:default" xmlns:p="urn:p" a="1" p:a="2"><p:c/><c xmlns=""/></r>';
  const result = parse(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.deepEqual(result.elements.map(element => element.name), [
    { qualifiedName: 'r', localName: 'r', prefix: null, namespaceUri: 'urn:default' },
    { qualifiedName: 'p:c', localName: 'c', prefix: 'p', namespaceUri: 'urn:p' },
    { qualifiedName: 'c', localName: 'c', prefix: null, namespaceUri: null },
  ]);
  const attrs = result.elements[0].attributes;
  assert.equal(attrs.find(attribute => attribute.name.qualifiedName === 'a').name.namespaceUri, null);
  assert.deepEqual(attrs.find(attribute => attribute.name.qualifiedName === 'p:a').name,
    { qualifiedName: 'p:a', localName: 'a', prefix: 'p', namespaceUri: 'urn:p' });
  const unbound = parse('<p:r p:a="1"/>', 'Fixture.xml', { namespaceAware: false });
  assert.equal(unbound.complete, true);
  assert.deepEqual(unbound.elements[0].name, { qualifiedName: 'p:r', localName: 'p:r', prefix: null, namespaceUri: null });
  assert.deepEqual(unbound.elements[0].attributes[0].name, { qualifiedName: 'p:a', localName: 'p:a', prefix: null, namespaceUri: null });
  failed('<p:r/>');
});

test('BOM, mixed CR/LF/CRLF and astral UTF-16 columns keep their original positions', () => {
  const input = '\uFEFF<Å>\r\n<名 a="🧪"/>\rtext\n</Å>';
  const result = parse(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.deepEqual(result.elements[0].nameSource.range, range(0, 2, 0, 3));
  assert.deepEqual(result.elements[0].source.range, range(0, 1, 3, 4));
  assert.deepEqual(result.elements[1].nameSource.range, range(1, 1, 1, 2));
  assert.deepEqual(result.elements[1].attributes[0].value.source.range, range(1, 6, 1, 8));
  assert.equal(result.elements[1].attributes[0].value.value, '🧪');
});

function mappingRows(input, value) {
  return value.mappings.map(span => [span.decodedStart, span.decodedEnd, span.kind, raw(input, span.source)]);
}
test('decoded text, attribute whitespace, entities and CDATA have independently calculated original mappings', () => {
  const input = '<r a="A\tB\r\nC&#xD;&#10;&amp;🧪">x\r\ny&#x1F9EA;&lt;z<![CDATA[p\rq]]>w</r>';
  const result = parse(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  const attribute = result.elements[0].attributes[0].value;
  assert.equal(attribute.value, 'A B C\r\n&🧪');
  assert.deepEqual(mappingRows(input, attribute), [
    [0, 1, 'literal', 'A'], [1, 2, 'normalized', '\t'], [2, 3, 'literal', 'B'],
    [3, 4, 'normalized', '\r\n'], [4, 5, 'literal', 'C'], [5, 6, 'entity', '&#xD;'],
    [6, 7, 'entity', '&#10;'], [7, 8, 'entity', '&amp;'], [8, 10, 'literal', '🧪'],
  ]);
  assert.deepEqual(result.text.map(text => [text.kind, text.value.value]), [['text', 'x\ny🧪<z'], ['cdata', 'p\nq'], ['text', 'w']]);
  assert.deepEqual(mappingRows(input, result.text[0].value), [
    [0, 1, 'literal', 'x'], [1, 2, 'normalized', '\r\n'], [2, 3, 'literal', 'y'],
    [3, 5, 'entity', '&#x1F9EA;'], [5, 6, 'entity', '&lt;'], [6, 7, 'literal', 'z'],
  ]);
  assert.equal(raw(input, result.text[1].value.source), 'p\rq');
  assert.deepEqual(mappingRows(input, result.text[1].value), [[0, 1, 'literal', 'p'], [1, 2, 'normalized', '\r'], [2, 3, 'literal', 'q']]);
});

test('literal mappings coalesce and empty attribute values retain zero-width provenance', () => {
  const input = '<r empty="" a="abc🧪def">literal🧪run</r>';
  const result = parse(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  const [empty, literal] = result.elements[0].attributes;
  assert.equal(empty.value.value, '');
  assert.deepEqual(empty.value.mappings, []);
  assert.deepEqual(empty.value.source.range, range(0, 10, 0, 10));
  assert.deepEqual(mappingRows(input, literal.value), [[0, 8, 'literal', 'abc🧪def']]);
  assert.deepEqual(mappingRows(input, result.text[0].value), [[0, 12, 'literal', 'literal🧪run']]);
});

test('predefined and numeric references decode once without interpreting resulting markup', () => {
  const input = '<r>&amp;lt;&lt;&gt;&apos;&quot;&#65;&#x1F9EA;</r>';
  const result = parse(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.equal(result.text[0].value.value, '&lt;<>\'"A🧪');
  assert.equal(result.elements.length, 1);
  for (const invalid of ['<r>&unknown;</r>', '<r>&#0;</r>', '<r>&#xD800;</r>', '<r>&#x110000;</r>', '<r>&#x;</r>']) failed(invalid);
});

test('unterminated references at markup boundaries and EOF are syntax errors with no projection and independent recovery', () => {
  const valid = '<r a="&amp;">&#65;</r>';
  const expected = parse(valid);
  assert.equal(expected.complete, true);
  const malformed = ['&amp', '&#65', '&#x41', '&'].flatMap(reference => [
    `<r>${reference}</r>`, `<r>${reference}`,
  ]);
  // A semicolon in later markup must not terminate the preceding text reference.
  malformed.push('<r>&amp<c a=";"/></r>', '<r>&#65<c a=";"/></r>');
  for (const input of malformed) {
    for (const namespaceAware of [true, false]) {
      const result = failed(input, { namespaceAware });
      assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), ['XML0002'], input);
      assert.deepEqual(parse(valid), expected, 'failed reference parsing does not affect later calls');
    }
  }
});

test('DOCTYPE-looking comments, CDATA and processing instructions are not declarations or executable Lua', () => {
  const input = '<?fixture <!DOCTYPE r SYSTEM "https://example.invalid/pi">?><r><!-- <!DOCTYPE r> -->' +
    '<![CDATA[<!DOCTYPE r SYSTEM "file:///never-read">]]><?inside error("MUST_NOT_EXECUTE")?></r>';
  const result = parse(input);
  assert.equal(result.complete, true);
  invariant(input, result);
  assert.equal(result.elements.length, 1);
  assert.deepEqual(result.text.map(text => [text.kind, text.value.value]), [['cdata', '<!DOCTYPE r SYSTEM "file:///never-read">']]);
  for (const declaration of ['<!DOCTYPE r><r/>', '<!DOCTYPE r SYSTEM "https://example.invalid/external"><r/>',
    '<!DOCTYPE r SYSTEM "file:///never-read"><r/>', '<!DOCTYPE r [<!ENTITY e "expanded">]><r>&e;</r>',
    '<!DOCTYPE r [<!ATTLIST r added CDATA "default">]><r/>']) {
    for (const namespaceAware of [true, false]) failed(declaration, { namespaceAware });
  }
});

test('XML 1.1 is rejected explicitly and encoding declarations never reinterpret a JS string', () => {
  for (const input of ['<?xml version="1.1"?><r/>', "<?xml version='1.1'?><r/>"]) {
    for (const namespaceAware of [false, true]) failed(input, { namespaceAware });
  }
  const input = '<?xml version="1.0" encoding="ISO-8859-1"?><r>Å🧪</r>';
  const result = parse(input);
  assert.equal(result.complete, true);
  assert.equal(result.text[0].value.value, 'Å🧪');
  invariant(input, result);
});

test('malformed documents expose no prefix tree and a later valid parse recovers independently', () => {
  const expected = parse('<r a="1">valid</r>');
  for (const input of ['<r a="1">prefix<c></r>', '<r/>trailing', 'leading<r/>', '', '<r>',
    '<r><!-- unterminated</r>', '<r><![CDATA[unterminated</r>', '<r a="<"/>', '<r a="1" a="2"/>']) {
    const result = failed(input);
    assert.doesNotMatch(JSON.stringify(result.diagnostics.map(diagnostic => diagnostic.message)), /prefix|unterminated/);
    assert.deepEqual(parse('<r a="1">valid</r>'), expected);
  }
});

test('invalid inputs/options return fixed diagnostics without coercion or caller data leakage', () => {
  for (const content of [null, undefined, 1, {}, ['<r/>']]) failed(content);
  for (const sourcePath of [null, undefined, 1, {}, '']) {
    const result = xml.parseXml('<r/>', sourcePath);
    assert.equal(result.complete, false);
    assert.deepEqual(result.elements, []);
    assert.deepEqual(result.text, []);
    assert.ok(result.diagnostics.length > 0);
  }
  for (const options of [null, true, [], 1, { namespaceAware: 'PRIVATE_INPUT' }, { namespaceAware: null }]) {
    const result = failed('<r/>', options);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INPUT/);
  }
  let coercions = 0;
  const hostile = { toString() { coercions++; throw new Error('PRIVATE_INPUT'); } };
  assert.equal(xml.parseXml(hostile, 'Fixture.xml').complete, false);
  assert.equal(xml.parseXml('<r/>', hostile).complete, false);
  assert.equal(coercions, 0);
});

test('only own consumed options are projected once and unrelated properties are ignored', () => {
  const inherited = Object.create({ namespaceAware: false });
  failed('<p:r/>', inherited);
  let reads = 0;
  const options = { get namespaceAware() { reads++; return false; }, get extra() { throw new Error('unused extra'); } };
  assert.equal(parse('<p:r/>', 'Fixture.xml', options).complete, true);
  assert.equal(reads, 1);
  const throwing = { get namespaceAware() { throw new Error('PRIVATE_INPUT'); } };
  const result = failed('<r/>', throwing);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INPUT/);
  const frozen = Object.freeze({ namespaceAware: false, extra: Object.freeze({ marker: 'unrelated' }) });
  const projected = parse('<p:r/>', 'Fixture.xml', frozen);
  assert.equal(projected.complete, true);
  assert.equal(Object.hasOwn(projected, 'extra'), false);
});

test('every returned nested name, source, attribute and mapping record is independently owned', () => {
  const input = '<r a="one" b="two">text<c a="three"/></r>';
  const first = parse(input);
  const second = parse(input);
  const stable = JSON.stringify(second);
  const siblingName = first.elements[1].name.qualifiedName;
  const siblingPath = first.elements[0].attributes[1].value.source.file;
  first.elements[0].name.qualifiedName = 'changed';
  first.elements[0].source.range.start.column = 900;
  first.elements[0].attributes[0].value.mappings[0].source.file = 'changed';
  first.elements[0].attributes[0].name.localName = 'changed';
  first.text[0].value.mappings.push({});
  assert.equal(first.elements[1].name.qualifiedName, siblingName);
  assert.equal(first.elements[0].attributes[1].value.source.file, siblingPath);
  assert.equal(JSON.stringify(second), stable);
  assert.deepEqual(parse(input), second);
  const small = parse('<r/>');
  small.elements[0].openSource.range.start.column = 80;
  assert.equal(small.elements[0].source.range.start.column, 0, 'equal ranges still have independent source records');
});

test('XML names retain characters that JavaScript treats as non-XML whitespace', () => {
  for (const name of ['\u1680', 'a\uFEFF', 'a\u1680b']) {
    const content = `<${name} ${name}="value"/>`;
    const result = parse(content);
    assert.equal(result.complete, true);
    assert.equal(result.elements[0].name.qualifiedName, name);
    assert.equal(result.elements[0].attributes[0].name.qualifiedName, name);
    invariant(content, result);
  }
});

test('depth 256 is accepted and 257 fails without any projection', () => {
  const atLimit = '<r>'.repeat(256) + '</r>'.repeat(256);
  const valid = parse(atLimit);
  assert.equal(valid.complete, true);
  assert.equal(valid.elements.length, 256);
  invariant(atLimit, valid);
  failed('<r>'.repeat(257) + '</r>'.repeat(257));
  assert.equal(parse('<r/>').complete, true);
});

test('the 1 Mi UTF-16 input boundary is exact', () => {
  const limit = 1024 * 1024;
  const exact = '<r>' + 'x'.repeat(limit - 7) + '</r>';
  assert.equal(exact.length, limit);
  const valid = parse(exact);
  assert.equal(valid.complete, true);
  assert.equal(valid.text[0].value.value.length, limit - 7);
  let reads = 0;
  failed(exact + 'x', { get namespaceAware() { reads++; throw new Error('over-limit options must not be consumed'); } });
  assert.equal(reads, 0, 'input cap is checked before consumed option getters');
  // Astral characters consume two UTF-16 units, not one code point or four UTF-8 bytes.
  const astralExact = '<r>' + '🧪'.repeat((limit - 8) / 2) + 'x</r>';
  assert.equal(astralExact.length, limit);
  assert.equal(parse(astralExact).complete, true);
  failed(astralExact.replace('x</r>', 'xx</r>'));
});

test('the shared 50,000-record budget includes elements, attributes, text and mapping records', () => {
  const elements = '<r>' + '<c/>'.repeat(49999) + '</r>';
  const valid = parse(elements);
  assert.equal(valid.complete, true);
  assert.equal(valid.elements.length, 50000);
  failed('<r>' + '<c/>'.repeat(50000) + '</r>');
  // Root + 16,666 * (element + attribute + literal mapping) = 49,999.
  assert.equal(parse('<r>' + '<c a="x"/>'.repeat(16666) + '</r>').complete, true);
  failed('<r>' + '<c a="x"/>'.repeat(16667) + '</r>');
  // Root + text + 49,998 separate entity mappings = 50,000.
  assert.equal(parse('<r>' + '&amp;'.repeat(49998) + '</r>').complete, true);
  failed('<r>' + '&amp;'.repeat(49999) + '</r>');
  assert.equal(parse('<r/>').complete, true);
});
