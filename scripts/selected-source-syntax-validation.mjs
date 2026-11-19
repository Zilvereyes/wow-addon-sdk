/** Independent original-source XML checks, shared with the graph worker boundary. */
import assert from "node:assert/strict";
import {buildSourceLineIndex} from './source-line-index.mjs';

export function verifyXmlSyntax(result, content, filename, sourceLines) {
  const exact = (value, keys) => assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
  exact(result, ['schemaVersion', 'complete', 'elements', 'text', 'diagnostics']);
  assert.ok(Array.isArray(result.diagnostics));
  const messages = {XML0001: 'Invalid XML parse input projection.', XML0002: 'Invalid XML syntax or namespace constraints.',
    XML0003: 'XML parse resource limit exceeded.', XML0004: 'XML declaration or DTD is forbidden by the XML profile.',
    XML0005: 'XML backend projection is unavailable.'};
  for (const diagnostic of result.diagnostics) {
    exact(diagnostic, ['code', 'severity', 'message', 'source']);
    assert.ok(Object.hasOwn(messages, diagnostic.code)); assert.equal(diagnostic.message, messages[diagnostic.code]);
    assert.equal(diagnostic.severity, 'error');
  }
  assert.ok(result.diagnostics.length <= 1);
  const metrics = { checkedSourceReferences: 0, checkedDecodedMappings: 0 };
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.equal(result.schemaVersion, 1);
  assert.equal(typeof result.complete, 'boolean');
  assert.equal(result.complete, result.diagnostics.length === 0);
  assert.ok(Array.isArray(result.elements) && Array.isArray(result.text));
  const {starts, lengths} = sourceLines ?? buildSourceLineIndex(content);
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
  // Independently account for every original construct. Comparing redundant
  // worker fields alone would accept an omitted attribute, child or script body.
  let cursor = 0, elementOrdinal = 0, textOrdinal = 0; const lexicalStack = [];
  while (cursor < content.length) {
    const begin = cursor;
    if (content.startsWith('<!--', cursor) || content.startsWith('<?', cursor)) {
      const comment = content.startsWith('<!--', cursor), delimiter = comment ? '-->' : '?>';
      const end = content.indexOf(delimiter, cursor + (comment ? 4 : 2)); assert.ok(end >= 0);
      cursor = end + delimiter.length; continue;
    }
    if (content.startsWith('<![CDATA[', cursor) || content[cursor] !== '<') {
      const cdata = content.startsWith('<![CDATA[', cursor);
      const end = cdata ? content.indexOf(']]>', cursor + 9) : content.indexOf('<', cursor);
      if (cdata) assert.ok(end >= 0);
      cursor = end < 0 ? content.length : end + (cdata ? 3 : 0);
      if (lexicalStack.length) {
        const row = result.text[textOrdinal++]; assert.ok(row);
        assert.equal(row.parentIndex, lexicalStack.at(-1)); assert.equal(row.kind, cdata ? 'cdata' : 'text');
        assert.deepEqual(offsets(row.value.source), [begin + (cdata ? 9 : 0), cursor - (cdata ? 3 : 0)]);
      }
      continue;
    }
    assert.equal(content.startsWith('<!', cursor), false);
    let quote = null;
    for (cursor++; cursor < content.length; cursor++) {
      if (quote !== null) {if (content[cursor] === quote) quote = null;}
      else if (content[cursor] === '"' || content[cursor] === "'") quote = content[cursor];
      else if (content[cursor] === '>') {cursor++; break;}
    }
    assert.equal(content[cursor - 1], '>');
    const close = content[begin + 1] === '/';
    if (close) {
      const index = lexicalStack.pop(); assert.notEqual(index, undefined);
      assert.deepEqual(offsets(result.elements[index].closeSource), [begin, cursor]);
      assert.equal(offsets(result.elements[index].source)[1], cursor);
    } else {
      const row = result.elements[elementOrdinal]; assert.ok(row);
      assert.equal(row.parentIndex, lexicalStack.at(-1) ?? null);
      assert.deepEqual(offsets(row.openSource), [begin, cursor]);
      const match = /^<([^ \t\r\n/>]+)/u.exec(content.slice(begin, cursor)); assert.ok(match);
      assert.deepEqual(offsets(row.nameSource), [begin + 1, begin + 1 + match[1].length]);
      assert.equal(row.name.qualifiedName, match[1]);
      let at = begin + 1 + match[1].length, attributeOrdinal = 0;
      while (at < cursor) {
        while (/[ \t\r\n]/u.test(content[at] ?? 'x')) at++;
        if (content[at] === '/' || content[at] === '>') break;
        const start = at;
        while (at < cursor && !/[= \t\r\n]/u.test(content[at])) at++;
        const nameEnd = at;
        while (/[ \t\r\n]/u.test(content[at] ?? 'x')) at++;
        assert.equal(content[at++], '=');
        while (/[ \t\r\n]/u.test(content[at] ?? 'x')) at++;
        const delimiter = content[at++]; assert.ok(delimiter === '"' || delimiter === "'");
        const valueStart = at; at = content.indexOf(delimiter, at); assert.ok(at >= valueStart && at < cursor);
        const attribute = row.attributes[attributeOrdinal++]; assert.ok(attribute);
        assert.deepEqual(offsets(attribute.source), [start, at + 1]);
        assert.deepEqual(offsets(attribute.nameSource), [start, nameEnd]);
        assert.deepEqual(offsets(attribute.value.source), [valueStart, at]); at++;
      }
      assert.equal(attributeOrdinal, row.attributes.length);
      if (content[cursor - 2] === '/') {assert.equal(row.closeSource, null); assert.deepEqual(offsets(row.source), [begin, cursor]);}
      else lexicalStack.push(elementOrdinal);
      elementOrdinal++;
    }
  }
  assert.equal(lexicalStack.length, 0); assert.equal(elementOrdinal, result.elements.length); assert.equal(textOrdinal, result.text.length);
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
      if (mapping.kind === 'literal') {
        assert.equal(projected, original);
        assert.equal(original.includes('\r'), false);
        if (!cdata) assert.equal(original.includes('&'), false);
        if (attribute) assert.equal(/[\n\t]/u.test(original), false);
      }
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
  const depths = [], namespaces = [], ancestorStack = [];
  for (const [index, element] of result.elements.entries()) {
    exact(element, ['name', 'nameSource', 'source', 'openSource', 'closeSource', 'parentIndex', 'attributes']);
    assert.ok(Array.isArray(element.attributes));
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
    while (ancestorStack.length && start >= offsets(result.elements[ancestorStack.at(-1)].source)[1]) ancestorStack.pop();
    assert.equal(element.parentIndex, ancestorStack.at(-1) ?? null);
    ancestorStack.push(index);
    if (element.parentIndex === null) { assert.equal(index, 0); depths[index] = 1; }
    else {
      assert.ok(Number.isSafeInteger(element.parentIndex) && element.parentIndex >= 0 && element.parentIndex < index);
      const [parentStart, parentEnd] = offsets(result.elements[element.parentIndex].source);
      assert.ok(start >= parentStart && end <= parentEnd); depths[index] = depths[element.parentIndex] + 1;
    }
    assert.ok(depths[index] <= 256);
    const bindings = new Map(element.parentIndex === null ? [['xml', 'http://www.w3.org/XML/1998/namespace'],
      ['xmlns', 'http://www.w3.org/2000/xmlns/']] : namespaces[element.parentIndex]);
    for (const attribute of element.attributes) {
      const spelling = slice(attribute.nameSource);
      if (spelling === 'xmlns') bindings.set('', attribute.value.value || null);
      else if (spelling.startsWith('xmlns:')) bindings.set(spelling.slice(6), attribute.value.value || null);
    }
    namespaces[index] = bindings;
    function name(value, original, attribute = false) {
      exact(value, ['qualifiedName', 'localName', 'prefix', 'namespaceUri']);
      assert.equal(value.qualifiedName, original);
      const parts = original.split(':'); assert.ok(parts.length <= 2);
      const prefix = parts.length === 2 ? parts[0] : null;
      assert.equal(value.localName, parts.at(-1)); assert.equal(value.prefix, prefix);
      const uri = prefix === null ? (attribute ? (original === 'xmlns' ? bindings.get('xmlns') : null) : bindings.get('') ?? null) : bindings.get(prefix);
      assert.equal(value.namespaceUri, uri);
    }
    name(element.name, slice(element.nameSource));
    assert.equal(slice(element.openSource).slice(1, 1 + element.name.qualifiedName.length), element.name.qualifiedName);
    if (element.closeSource !== null) assert.equal(slice(element.closeSource).slice(2).replace(/\s*>$/u, ''), element.name.qualifiedName);
    records += element.attributes.length;
    for (const attribute of element.attributes) {
      exact(attribute, ['name', 'nameSource', 'value', 'source']);
      name(attribute.name, slice(attribute.nameSource), true);
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
