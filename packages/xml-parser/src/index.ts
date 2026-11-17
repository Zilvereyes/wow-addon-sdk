import { SaxesParser } from 'saxes';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';

/** XML 1.0 document options. Namespace constraints are enabled by default. @beta */
export interface XmlParseOptions { readonly namespaceAware?: boolean; }
/** An owned expanded name; namespace processing never changes original spelling. @beta */
export interface XmlName {
  readonly qualifiedName: string;
  readonly localName: string;
  readonly prefix: string | null;
  readonly namespaceUri: string | null;
}
/** Original provenance of a decoded UTF-16 interval, end exclusive. @beta */
export interface XmlMappedSpan {
  readonly decodedStart: number;
  readonly decodedEnd: number;
  readonly kind: 'literal' | 'normalized' | 'entity';
  readonly source: SourceReference;
}
/** Literal runs map by offset; overlapping entity/normalized spans map whole. @beta */
export interface XmlValue {
  readonly value: string;
  readonly source: SourceReference;
  readonly mappings: readonly XmlMappedSpan[];
}
/** Attribute ranges include spelling and quotes; value ranges exclude quotes. @beta */
export interface XmlAttribute {
  readonly name: XmlName;
  readonly nameSource: SourceReference;
  readonly value: XmlValue;
  readonly source: SourceReference;
}
/** Preorder element projection. Self-closing elements have no closeSource. @beta */
export interface XmlElement {
  readonly name: XmlName;
  readonly nameSource: SourceReference;
  readonly source: SourceReference;
  readonly openSource: SourceReference;
  readonly closeSource: SourceReference | null;
  readonly parentIndex: number | null;
  readonly attributes: readonly XmlAttribute[];
}
/** Original-order text inside an element; CDATA sources exclude delimiters. @beta */
export interface XmlText {
  readonly parentIndex: number;
  readonly kind: 'text' | 'cdata';
  readonly value: XmlValue;
}
/** Complete describes syntax and provenance only, not schema or game loading. @beta */
export interface XmlParseResult {
  readonly schemaVersion: 1;
  readonly complete: boolean;
  readonly elements: readonly XmlElement[];
  readonly text: readonly XmlText[];
  readonly diagnostics: readonly Diagnostic[];
}

class Failure extends Error {
  constructor(readonly code: string, readonly offset: number) { super(code); }
}
type MutableElement = { -readonly [K in keyof XmlElement]: XmlElement[K] };
const whitespace = (unit: string | undefined) => unit !== undefined && /[ \t\r\n]/u.test(unit);

/**
 * Parse an XML 1.0 fifth-edition document, optionally enforcing Namespaces 1.0.
 * Reject DTDs and XML 1.1; never execute source or resolve external entities.
 * Input is bounded to 1 Mi UTF-16 units before indexing, 50,000 combined
 * element/attribute/text/mapping records, depth 256 and 2 Mi decoded units.
 * Every failure returns empty projections and fixed diagnostics. Native getters
 * are caller code; only the documented option is consumed, once. Returned
 * records are owned per call (readonly types do not imply runtime freezing).
 * Callers own heap/deadline supervision; this pure API is not a JS sandbox.
 * @beta
 */
export function parseXml(content: string, sourcePath: string, options?: XmlParseOptions): XmlParseResult {
  const inputLimit = 1024 * 1024;
  const original = typeof content === 'string' && content.length <= inputLimit ? content : '';
  const file = typeof sourcePath === 'string' ? sourcePath : '';
  const starts = [0];
  for (let i = 0; i < original.length; i++) {
    if (original[i] === '\r') { if (original[i + 1] === '\n') i++; starts.push(i + 1); }
    else if (original[i] === '\n') starts.push(i + 1);
  }
  function position(offset: number) {
    if (original[offset] === '\n' && offset > 0 && original[offset - 1] === '\r') offset--;
    let low = 0, high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (starts[middle]! <= offset) low = middle; else high = middle;
    }
    return { line: low, column: offset - starts[low]! };
  }
  const source = (start: number, end = start): SourceReference =>
    ({ file, range: { start: position(start), end: position(end) } });
  function failed(code: string, offset = 0): XmlParseResult {
    const messages: Record<string, string> = {
      XML0001: 'Invalid XML parse input projection.',
      XML0002: 'Invalid XML syntax or namespace constraints.',
      XML0003: 'XML parse resource limit exceeded.',
      XML0004: 'XML declaration or DTD is forbidden by the XML profile.',
      XML0005: 'XML backend projection is unavailable.',
    };
    return { schemaVersion: 1, complete: false, elements: [], text: [], diagnostics: [
      { code, severity: 'error', message: messages[code]!, source: source(Math.max(0, Math.min(original.length, offset))) },
    ] };
  }
  let namespaceAware = true;
  if (typeof content === 'string' && content.length > inputLimit) return failed('XML0003');
  try {
    if (typeof content !== 'string' || !file ||
        (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options)))) {
      return failed('XML0001');
    }
    if (options !== undefined && Object.hasOwn(options, 'namespaceAware')) {
      const selected = options.namespaceAware;
      if (typeof selected !== 'boolean') return failed('XML0001');
      namespaceAware = selected;
    }
  } catch { return failed('XML0001'); }
  let records = 0, decodedUnits = 0, tokenStart = 0, tokenEnd = 0;
  function count(offset: number) { if (++records > 50000) throw new Failure('XML0003', offset); }
  const elements: MutableElement[] = [], text: XmlText[] = [], stack: number[] = [];
  const elementStarts: number[] = [];
  function value(start: number, end: number, attribute: boolean, cdata = false): XmlValue {
    let decoded = '';
    const mappings: XmlMappedSpan[] = [];
    function append(chunk: string, rawStart: number, rawEnd: number, kind: XmlMappedSpan['kind']) {
      const decodedStart = decoded.length;
      decoded += chunk;
      decodedUnits += chunk.length;
      if (decodedUnits > 2 * 1024 * 1024) throw new Failure('XML0003', rawStart);
      count(rawStart);
      mappings.push({ decodedStart, decodedEnd: decoded.length, kind, source: source(rawStart, rawEnd) });
    }
    let cursor = start;
    while (cursor < end) {
      const begin = cursor;
      if (!cdata && original[cursor] === '&') {
        const close = original.indexOf(';', cursor + 1);
        // Text events may still be buffered in the backend at a chunk boundary.
        // An unfinished reference is malformed source, not a projection outage.
        if (close < 0 || close >= end) throw new Failure('XML0002', cursor);
        const entity = original.slice(cursor + 1, close);
        const predefined: Record<string, string> = { amp: '&', lt: '<', gt: '>', apos: "'", quot: '"' };
        const chunk = Object.hasOwn(predefined, entity) ? predefined[entity]! : entity.startsWith('#x') ?
          String.fromCodePoint(Number.parseInt(entity.slice(2), 16)) : entity.startsWith('#') ?
          String.fromCodePoint(Number.parseInt(entity.slice(1), 10)) : undefined;
        if (chunk === undefined) throw new Failure('XML0005', cursor);
        cursor = close + 1;
        append(chunk, begin, cursor, 'entity');
      } else if (original[cursor] === '\r' || (attribute && (original[cursor] === '\n' || original[cursor] === '\t'))) {
        cursor += original[cursor] === '\r' && original[cursor + 1] === '\n' ? 2 : 1;
        append(attribute ? ' ' : '\n', begin, cursor, 'normalized');
      } else {
        do { cursor++; } while (cursor < end && (cdata || original[cursor] !== '&') && original[cursor] !== '\r' &&
          !(attribute && (original[cursor] === '\n' || original[cursor] === '\t')));
        append(original.slice(begin, cursor), begin, cursor, 'literal');
      }
    }
    return { value: decoded, source: source(start, end), mappings };
  }
  try {
    // Namespace metadata is final only on opentag. No backend object escapes.
    const parser = new SaxesParser({ xmlns: namespaceAware, defaultXMLVersion: '1.0', forceXMLVersion: true });
    parser.on('error', () => { throw new Failure('XML0002', parser.position); });
    parser.on('xmldecl', declaration => { if (declaration.version !== '1.0') throw new Failure('XML0004', tokenStart); });
    parser.on('doctype', () => { throw new Failure('XML0004', tokenStart); });
    function name(qualifiedName: string, metadata?: { local: string; prefix: string; uri: string }): XmlName {
      if (!namespaceAware) return { qualifiedName, localName: qualifiedName, prefix: null, namespaceUri: null };
      if (!metadata) throw new Failure('XML0005', tokenStart);
      return { qualifiedName, localName: metadata.local, prefix: metadata.prefix || null, namespaceUri: metadata.uri || null };
    }
    parser.on('opentag', tag => {
      if (stack.length >= 256) throw new Failure('XML0003', tokenStart);
      count(tokenStart);
      const match = /^<([^ \t\r\n/>]+)/u.exec(original.slice(tokenStart, tokenEnd));
      if (!match || match[1] !== tag.name) throw new Failure('XML0005', tokenStart);
      const attributes: XmlAttribute[] = [];
      let cursor = tokenStart + 1 + tag.name.length;
      while (cursor < tokenEnd) {
        while (whitespace(original[cursor])) cursor++;
        if (original[cursor] === '/' || original[cursor] === '>') break;
        const begin = cursor;
        while (cursor < tokenEnd && !whitespace(original[cursor]) && original[cursor] !== '=') cursor++;
        const nameEnd = cursor, qualified = original.slice(begin, nameEnd);
        while (whitespace(original[cursor])) cursor++;
        if (original[cursor++] !== '=') throw new Failure('XML0005', begin);
        while (whitespace(original[cursor])) cursor++;
        const quote = original[cursor++];
        if (quote !== '"' && quote !== "'") throw new Failure('XML0005', begin);
        const valueStart = cursor;
        cursor = original.indexOf(quote, cursor);
        if (cursor < valueStart || cursor >= tokenEnd) throw new Failure('XML0005', valueStart);
        count(begin);
        const backend = tag.attributes[qualified];
        const mapped = value(valueStart, cursor, true);
        const expected = typeof backend === 'string' ? backend : backend?.value;
        if (mapped.value !== expected) throw new Failure('XML0005', valueStart);
        attributes.push({ name: name(qualified, typeof backend === 'object' && 'uri' in backend ? backend : undefined),
          nameSource: source(begin, nameEnd), value: mapped, source: source(begin, ++cursor) });
      }
      const index = elements.length;
      elements.push({ name: name(tag.name, 'uri' in tag ? tag as { local: string; prefix: string; uri: string } : undefined),
        nameSource: source(tokenStart + 1, tokenStart + 1 + tag.name.length), source: source(tokenStart, tokenEnd),
        openSource: source(tokenStart, tokenEnd), closeSource: null,
        parentIndex: stack.length ? stack[stack.length - 1]! : null, attributes });
      elementStarts.push(tokenStart);
      stack.push(index);
    });
    parser.on('closetag', tag => {
      const index = stack.pop();
      if (index === undefined) throw new Failure('XML0005', tokenStart);
      if (!tag.isSelfClosing) {
        elements[index]!.closeSource = source(tokenStart, tokenEnd);
        elements[index]!.source = source(elementStarts[index]!, tokenEnd);
      }
    });
    let cursor = 0;
    while (cursor < original.length) {
      tokenStart = cursor;
      let kind: 'open' | 'close' | 'text' | 'cdata' | 'skip' = 'skip';
      if (original.startsWith('<!--', cursor)) {
        const close = original.indexOf('-->', cursor + 4); cursor = close < 0 ? original.length : close + 3;
      } else if (original.startsWith('<![CDATA[', cursor)) {
        kind = 'cdata'; const close = original.indexOf(']]>', cursor + 9); cursor = close < 0 ? original.length : close + 3;
      } else if (original.startsWith('<?', cursor)) {
        const close = original.indexOf('?>', cursor + 2); cursor = close < 0 ? original.length : close + 2;
      } else if (original.startsWith('<!DOCTYPE', cursor)) {
        // Detect only markup at the lexical boundary, before backend DTD work.
        throw new Failure('XML0004', cursor);
      } else if (original[cursor] === '<') {
        kind = original[cursor + 1] === '/' ? 'close' : 'open';
        let quote: string | undefined;
        for (cursor++; cursor < original.length; cursor++) {
          const unit = original[cursor];
          if (quote) { if (unit === quote) quote = undefined; }
          else if (unit === '"' || unit === "'") quote = unit;
          else if (unit === '>') { cursor++; break; }
        }
      } else {
        kind = 'text'; const next = original.indexOf('<', cursor); cursor = next < 0 ? original.length : next;
      }
      tokenEnd = cursor;
      parser.write(original.slice(tokenStart, tokenEnd));
      if ((kind === 'text' || kind === 'cdata') && stack.length) {
        const start = tokenStart + (kind === 'cdata' ? 9 : 0), end = tokenEnd - (kind === 'cdata' ? 3 : 0);
        if (end < start) throw new Failure('XML0002', tokenStart);
        count(start);
        text.push({ parentIndex: stack[stack.length - 1]!, kind, value: value(start, end, false, kind === 'cdata') });
      }
    }
    parser.close();
    if (stack.length || !elements.length) throw new Failure('XML0005', 0);
    return { schemaVersion: 1, complete: true, elements, text, diagnostics: [] };
  } catch (error) {
    return error instanceof Failure ? failed(error.code, error.offset) :
      failed(error instanceof RangeError ? 'XML0003' : 'XML0005', tokenStart);
  }
}
