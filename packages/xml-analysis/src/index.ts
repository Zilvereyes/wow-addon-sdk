import { parseXml } from '@wow-addon/xml-parser';
import type { XmlElement, XmlName, XmlText, XmlValue, XmlParseResult } from '@wow-addon/xml-parser';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';

/** Exact expanded-name selector; null denotes no namespace. @beta */
export interface XmlElementSelector {
  readonly namespaceUri: string | null;
  readonly localName: string;
}
/** Explicit, disjoint caller vocabulary; no game schema or default widget list. @beta */
export interface XmlAnalysisPolicy {
  readonly roots: readonly XmlElementSelector[];
  readonly frameElements: readonly XmlElementSelector[];
  readonly includeElements: readonly XmlElementSelector[];
  readonly scriptElements: readonly XmlElementSelector[];
  readonly handlerContainers: readonly XmlElementSelector[];
  readonly handlerElements: readonly XmlElementSelector[];
}
/** Caller-owned inventory identity and inherited restrictions, copied per call. @beta */
export interface XmlAnalysisOptions {
  readonly addonId: string;
  readonly policy: XmlAnalysisPolicy;
  readonly conditions?: readonly ConditionDescriptor[];
}
/** Unresolved frame/template fact; an optional declaration always has unknown activation. @beta */
export interface XmlFrameCandidate {
  readonly elementIndex: number;
  readonly name: XmlValue | null;
  readonly virtual: XmlValue | null;
  readonly inherits: XmlValue | null;
  readonly source: SourceReference;
  readonly declarationIndex: number | null;
}
/** An unresolved source-bearing target. No path resolution or file access occurs. @beta */
export interface XmlFileReference {
  readonly elementIndex: number;
  readonly kind: 'include' | 'script';
  readonly target: XmlValue;
  readonly source: SourceReference;
}
/** Decoded direct-child body, with disjoint original maps; not a Lua parse verdict. @beta */
export interface XmlInlineScript {
  readonly elementIndex: number;
  readonly kind: 'chunk' | 'handler';
  readonly body: XmlValue;
  readonly source: SourceReference;
}
/** Complete means extraction under caller policy, never runtime loading/reachability. @beta */
export interface XmlAnalysisResult {
  readonly schemaVersion: 1;
  readonly complete: boolean;
  readonly frames: readonly XmlFrameCandidate[];
  readonly references: readonly XmlFileReference[];
  readonly scripts: readonly XmlInlineScript[];
  readonly declarations: readonly GlobalDeclaration[];
  readonly diagnostics: readonly Diagnostic[];
}

type RecordValue = Record<string, unknown>;
class Failure extends Error { constructor(readonly code: string) { super(code); } }
const record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const roles = ['roots', 'frameElements', 'includeElements', 'scriptElements', 'handlerContainers', 'handlerElements'] as const;
const key = (uri: string | null, local: string) => JSON.stringify([uri, local]);
function own(value: unknown, name: string): unknown {
  if (!record(value) || !Object.hasOwn(value, name)) throw new Failure('XUI0001');
  return value[name];
}
function dense(value: unknown, maximum: number, code: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Failure('XUI0001');
  if (value.length > maximum) throw new Failure(code);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new Failure('XUI0001');
}
function optionArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value)) throw new Failure('XUI0001');
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0) throw new Failure('XUI0001');
  if (length > maximum) throw new Failure('XUI0003');
  const snapshot: unknown[] = [];
  for (let i = 0; i < length; i++) {
    if (!Object.hasOwn(value, i)) throw new Failure('XUI0001');
    snapshot.push(value[i]);
  }
  return snapshot;
}
function sourceSnapshot(value: unknown, consume: (value: unknown) => string): SourceReference {
  const file = consume(own(value, 'file'));
  if (!file) throw new Failure('XUI0001');
  const range = own(value, 'range');
  function point(value: unknown) {
    const line = own(value, 'line'), column = own(value, 'column');
    if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || (line as number) < 0 || (column as number) < 0) {
      throw new Failure('XUI0001');
    }
    return { line: line as number, column: column as number };
  }
  const start = point(own(range, 'start')), end = point(own(range, 'end'));
  if (end.line < start.line || (end.line === start.line && end.column < start.column)) throw new Failure('XUI0001');
  return { file, range: { start, end } };
}
function copySource(source: SourceReference): SourceReference {
  return { file: source.file, range: {
    start: { line: source.range.start.line, column: source.range.start.column },
    end: { line: source.range.end.line, column: source.range.end.column },
  } };
}

/**
 * Extract bounded XML facts under an explicit caller policy, without executing
 * source, fetching references or inferring a game schema. Namespace-aware XML
 * syntax budgets remain unchanged. All declarations have unknown activation.
 * Native option getters are caller code; only documented own fields are read.
 * Options: 1 Mi UTF-16 string units, 50,000 selector/condition/value entries,
 * 128 selectors per role, 256 conditions and 1,024 values per condition.
 * Output: 50,000 fact/declaration/condition/value-cell/mapping records total.
 * Input/backend/resource failures expose no partial facts; XUI0004 warnings
 * preserve independent facts with complete=false. Returned nested records are
 * independently owned, not runtime frozen. Inline bodies are not parsed as Lua.
 * Callers own process/heap/deadline supervision; this API is not a JS sandbox.
 * @beta
 */
export function analyzeXml(content: string, sourcePath: string, options: XmlAnalysisOptions): XmlAnalysisResult {
  const file = typeof sourcePath === 'string' ? sourcePath : '';
  const anchor: SourceReference = { file, range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } };
  const empty = (diagnostics: Diagnostic[]): XmlAnalysisResult =>
    ({ schemaVersion: 1, complete: false, frames: [], references: [], scripts: [], declarations: [], diagnostics });
  const messages: Record<string, string> = {
    XUI0001: 'Invalid XML analysis input projection.',
    XUI0002: 'XML syntax backend projection is unavailable.',
    XUI0003: 'XML analysis resource limit exceeded.',
    XUI0004: 'Unsupported or ambiguous XML construct under the caller policy.',
  };
  const failed = (code: string) => empty([{ code, severity: 'error', message: messages[code]!, source: copySource(anchor) }]);
  let addonId: string, conditions: ConditionDescriptor[], policy: Record<typeof roles[number], Set<string>>;
  try {
    if (typeof content !== 'string' || !file || !record(options)) throw new Failure('XUI0001');
    let units = 0, entries = 0;
    function consume(value: unknown) {
      if (typeof value !== 'string') throw new Failure('XUI0001');
      units += value.length;
      if (units > 1024 * 1024) throw new Failure('XUI0003');
      return value;
    }
    function entry() { if (++entries > 50000) throw new Failure('XUI0003'); }
    addonId = consume(own(options, 'addonId'));
    if (!addonId) throw new Failure('XUI0001');
    const selectedPolicy = own(options, 'policy'), all = new Set<string>();
    policy = { roots: new Set(), frameElements: new Set(), includeElements: new Set(), scriptElements: new Set(),
      handlerContainers: new Set(), handlerElements: new Set() };
    for (const role of roles) {
      const selectors = optionArray(own(selectedPolicy, role), 128);
      if (role === 'roots' && !selectors.length) throw new Failure('XUI0001');
      for (const selector of selectors) {
        entry();
        const uriValue = own(selector, 'namespaceUri');
        const uri = uriValue === null ? null : consume(uriValue);
        const local = consume(own(selector, 'localName'));
        if (!local || local.includes(':') || uri === '') throw new Failure('XUI0001');
        const selected = key(uri, local);
        if (all.has(selected)) throw new Failure('XUI0001');
        all.add(selected); policy[role].add(selected);
      }
    }
    conditions = [];
    if (Object.hasOwn(options, 'conditions')) {
      const selected = optionArray(options.conditions, 256);
      for (const condition of selected) {
        entry();
        const providerId = consume(own(condition, 'providerId')), name = consume(own(condition, 'name'));
        const raw = consume(own(condition, 'raw'));
        if (!providerId || !name) throw new Failure('XUI0001');
        const selectedValues = optionArray(own(condition, 'values'), 1024);
        const values: string[] = [];
        for (const value of selectedValues) { entry(); values.push(consume(value)); }
        const source = sourceSnapshot(own(condition, 'source'), consume);
        conditions.push({ providerId, name, raw, values, source });
      }
    }
  } catch (error) { return failed(error instanceof Failure ? error.code : 'XUI0001'); }

  // Oversized XML stays an XML syntax/profile failure and is checked before indexing.
  if (content.length > 1024 * 1024) {
    return empty([{ code: 'XML0003', severity: 'error', message: 'XML parse resource limit exceeded.', source: copySource(anchor) }]);
  }
  const starts = [0], ends: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\r' || content[i] === '\n') {
      ends.push(i);
      if (content[i] === '\r' && content[i + 1] === '\n') i++;
      starts.push(i + 1);
    }
  }
  ends.push(content.length);
  function bounds(value: unknown): [number, number] {
    const source = sourceSnapshot(value, value => { if (typeof value !== 'string') throw new Failure('XUI0002'); return value; });
    if (source.file !== file) throw new Failure('XUI0002');
    function offset(point: { line: number; column: number }) {
      const start = starts[point.line], end = ends[point.line];
      if (start === undefined || end === undefined || point.column > end - start) throw new Failure('XUI0002');
      return start + point.column;
    }
    return [offset(source.range.start), offset(source.range.end)];
  }
  function inside(inner: [number, number], outer: [number, number]) {
    if (inner[0] < outer[0] || inner[1] > outer[1]) throw new Failure('XUI0002');
  }
  let syntax: XmlParseResult;
  try {
    syntax = parseXml(content, file);
    // Validate the consumed syntax seam before projecting anything from it.
    if (own(syntax, 'schemaVersion') !== 1 || typeof own(syntax, 'complete') !== 'boolean') throw new Failure('XUI0002');
    dense(own(syntax, 'elements'), 50000, 'XUI0002');
    dense(own(syntax, 'text'), 50000, 'XUI0002');
    dense(own(syntax, 'diagnostics'), 50000, 'XUI0002');
    const xmlMessages: Record<string, string> = {
      XML0001: 'Invalid XML parse input projection.', XML0002: 'Invalid XML syntax or namespace constraints.',
      XML0003: 'XML parse resource limit exceeded.', XML0004: 'XML declaration or DTD is forbidden by the XML profile.',
      XML0005: 'XML backend projection is unavailable.',
    };
    const diagnostics: Diagnostic[] = [];
    for (const d of syntax.diagnostics) {
      const code = own(d, 'code');
      if (typeof code !== 'string' || !Object.hasOwn(xmlMessages, code) || own(d, 'severity') !== 'error' ||
          own(d, 'message') !== xmlMessages[code]) throw new Failure('XUI0002');
      bounds(own(d, 'source'));
      diagnostics.push({ code, severity: 'error', message: xmlMessages[code]!, source: copySource(d.source) });
    }
    if (!syntax.complete) {
      if (syntax.elements.length || syntax.text.length || !diagnostics.length) throw new Failure('XUI0002');
      return empty(diagnostics);
    }
    if (diagnostics.length || !syntax.elements.length) throw new Failure('XUI0002');
    let records = 0;
    const count = () => { if (++records > 50000) throw new Failure('XUI0002'); };
    function validateName(name: XmlName, source: SourceReference) {
      const qualified = own(name, 'qualifiedName'), local = own(name, 'localName');
      const prefix = own(name, 'prefix'), uri = own(name, 'namespaceUri');
      if (!nonempty(qualified) || !nonempty(local) || !(prefix === null || nonempty(prefix)) ||
          !(uri === null || nonempty(uri)) || qualified !== (prefix === null ? local : `${prefix}:${local}`)) throw new Failure('XUI0002');
      const [a, b] = bounds(source);
      if (content.slice(a, b) !== qualified) throw new Failure('XUI0002');
    }
    function validateValue(value: XmlValue, attribute: boolean, cdata = false) {
      const decoded = own(value, 'value');
      if (typeof decoded !== 'string') throw new Failure('XUI0002');
      const outer = bounds(own(value, 'source'));
      const mappings = own(value, 'mappings'); dense(mappings, 50000, 'XUI0002');
      let end = 0, rawEnd = outer[0];
      for (const mapping of value.mappings) {
        count();
        const a = own(mapping, 'decodedStart'), b = own(mapping, 'decodedEnd'), kind = own(mapping, 'kind');
        if (a !== end || !Number.isSafeInteger(b) || (b as number) <= end || (b as number) > decoded.length) throw new Failure('XUI0002');
        const raw = bounds(own(mapping, 'source')); inside(raw, outer);
        if (raw[0] !== rawEnd || raw[1] <= raw[0]) throw new Failure('XUI0002');
        const spelling = content.slice(...raw), part = decoded.slice(end, b as number);
        if (kind === 'literal') {
          if (part !== spelling) throw new Failure('XUI0002');
        } else if (kind === 'normalized') {
          const expected = /^(?:\r\n|\r)$/u.test(spelling) ? (attribute ? ' ' : '\n') :
            attribute && /^[\t\n]$/u.test(spelling) ? ' ' : null;
          if (part !== expected) throw new Failure('XUI0002');
        } else if (kind === 'entity' && !cdata) {
          const predefined: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&quot;': '"' };
          const numeric = /^&#(?:x([0-9A-Fa-f]+)|([0-9]+));$/u.exec(spelling);
          const expected = Object.hasOwn(predefined, spelling) ? predefined[spelling] : numeric ?
            String.fromCodePoint(Number.parseInt(numeric[1] ?? numeric[2]!, numeric[1] === undefined ? 10 : 16)) : undefined;
          if (part !== expected) throw new Failure('XUI0002');
        } else throw new Failure('XUI0002');
        end = b as number; rawEnd = raw[1];
      }
      if (end !== decoded.length || rawEnd !== outer[1]) throw new Failure('XUI0002');
    }
    const intervals: { index: number; start: number; end: number; contentStart: number; contentEnd: number }[] = [];
    const ancestry: typeof intervals = [];
    let previous = -1;
    for (const [i, element] of syntax.elements.entries()) {
      count();
      const outer = bounds(own(element, 'source')), open = bounds(own(element, 'openSource'));
      inside(open, outer);
      if (outer[0] <= previous || open[0] !== outer[0]) throw new Failure('XUI0002');
      previous = outer[0];
      const parent = own(element, 'parentIndex');
      if (i === 0 ? parent !== null : !Number.isSafeInteger(parent) || (parent as number) < 0 || (parent as number) >= i) throw new Failure('XUI0002');
      while (ancestry.length && outer[0] >= ancestry[ancestry.length - 1]!.contentEnd) ancestry.pop();
      const enclosing = ancestry[ancestry.length - 1];
      if (parent !== (enclosing?.index ?? null)) throw new Failure('XUI0002');
      if (enclosing) inside(outer, [enclosing.contentStart, enclosing.contentEnd]);
      validateName(element.name, element.nameSource); inside(bounds(element.nameSource), open);
      const close = own(element, 'closeSource');
      if (close === null) {
        if (!content.slice(...open).endsWith('/>') || outer[1] !== open[1]) throw new Failure('XUI0002');
      } else {
        const closing = bounds(close); inside(closing, outer);
        if (closing[0] < open[1] || closing[1] !== outer[1]) throw new Failure('XUI0002');
      }
      const interval = { index: i, start: outer[0], end: outer[1], contentStart: open[1],
        contentEnd: close === null ? open[1] : bounds(close)[0] };
      intervals.push(interval); ancestry.push(interval);
      dense(own(element, 'attributes'), 50000, 'XUI0002');
      for (const attribute of element.attributes) {
        count(); inside(bounds(attribute.source), open);
        validateName(attribute.name, attribute.nameSource); inside(bounds(attribute.nameSource), bounds(attribute.source));
        validateValue(attribute.value, true); inside(bounds(attribute.value.source), bounds(attribute.source));
      }
    }
    previous = -1;
    for (const text of syntax.text) {
      count();
      if (!Number.isSafeInteger(text.parentIndex) || text.parentIndex < 0 || text.parentIndex >= syntax.elements.length ||
          (text.kind !== 'text' && text.kind !== 'cdata')) throw new Failure('XUI0002');
      validateValue(text.value, false, text.kind === 'cdata');
      const raw = bounds(text.value.source);
      // The last opening element before the raw text is either its immediate
      // parent or a completed descendant of that parent. Walk only ancestors.
      let low = 0, high = intervals.length;
      while (low + 1 < high) { const middle = (low + high) >>> 1; if (intervals[middle]!.start <= raw[0]) low = middle; else high = middle; }
      let enclosing: typeof intervals[number] | undefined = intervals[low];
      while (enclosing && raw[0] >= enclosing.contentEnd) {
        const parent = syntax.elements[enclosing.index]!.parentIndex;
        enclosing = parent === null ? undefined : intervals[parent];
      }
      if (!enclosing || enclosing.index !== text.parentIndex) throw new Failure('XUI0002');
      inside(raw, [enclosing.contentStart, enclosing.contentEnd]);
      const next = intervals[low + 1];
      if (next && raw[1] > next.start) throw new Failure('XUI0002');
      if (raw[0] < previous) throw new Failure('XUI0002'); previous = raw[1];
    }
  } catch { return failed('XUI0002'); }

  try {
    const frames: XmlFrameCandidate[] = [], references: XmlFileReference[] = [], scripts: XmlInlineScript[] = [];
    const declarations: GlobalDeclaration[] = [], diagnostics: Diagnostic[] = [];
    let records = 0;
    const count = () => { if (++records > 50000) throw new Failure('XUI0003'); };
    const matches = (element: XmlElement, role: typeof roles[number]) => policy[role].has(key(element.name.namespaceUri, element.name.localName));
    const warning = (element: XmlElement) => diagnostics.push({ code: 'XUI0004', severity: 'warning', message: messages.XUI0004!, source: copySource(element.source) });
    const root = syntax.elements[0]!;
    if (!matches(root, 'roots')) { warning(root); return empty(diagnostics); }
    function copyValue(value: XmlValue): XmlValue {
      return { value: value.value, source: copySource(value.source), mappings: value.mappings.map(mapping => {
        count(); return { decodedStart: mapping.decodedStart, decodedEnd: mapping.decodedEnd, kind: mapping.kind, source: copySource(mapping.source) };
      }) };
    }
    const attribute = (element: XmlElement, name: string) => element.attributes.find(a =>
      a.name.namespaceUri === null && a.name.prefix === null && a.name.localName === name)?.value;
    const texts = new Map<number, XmlText[]>(), children = new Set<number>(), frameIndices = new Set<number>();
    for (const element of syntax.elements) if (element.parentIndex !== null) children.add(element.parentIndex);
    for (const text of syntax.text) { const group = texts.get(text.parentIndex) ?? []; group.push(text); texts.set(text.parentIndex, group); }
    function body(element: XmlElement, i: number, kind: XmlInlineScript['kind']) {
      count();
      let value = '';
      const mappings: XmlValue['mappings'][number][] = [];
      for (const part of texts.get(i) ?? []) {
        const shift = value.length;
        for (const mapping of part.value.mappings) {
          count(); mappings.push({ decodedStart: mapping.decodedStart + shift, decodedEnd: mapping.decodedEnd + shift,
            kind: mapping.kind, source: copySource(mapping.source) });
        }
        value += part.value.value;
      }
      const start = element.openSource.range.end, end = element.closeSource?.range.start ?? start;
      scripts.push({ elementIndex: i, kind, source: copySource(element.source), body: { value, mappings,
        source: { file, range: { start: { line: start.line, column: start.column }, end: { line: end.line, column: end.column } } } } });
    }
    for (const [i, element] of syntax.elements.entries()) {
      if (i > 0 && matches(element, 'frameElements')) {
        count(); frameIndices.add(i);
        const name = attribute(element, 'name'), virtual = attribute(element, 'virtual'), inherits = attribute(element, 'inherits');
        let declarationIndex: number | null = null;
        if (virtual && virtual.value !== 'true' && virtual.value !== 'false') warning(element);
        else if (name && name.value && !name.value.includes('$') && (!virtual || virtual.value === 'false')) {
          count(); declarationIndex = declarations.length;
          const copied = conditions.map(condition => {
            count(); return { providerId: condition.providerId, name: condition.name, raw: condition.raw, source: copySource(condition.source),
              values: condition.values.map(value => { count(); return value; }) };
          });
          declarations.push({ name: name.value, addonId, kind: 'frame', activationState: 'unknown', source: copySource(name.source),
            ...(copied.length ? { conditions: copied } : {}) });
        }
        frames.push({ elementIndex: i, name: name ? copyValue(name) : null, virtual: virtual ? copyValue(virtual) : null,
          inherits: inherits ? copyValue(inherits) : null, source: copySource(element.source), declarationIndex });
      }
      const include = element.parentIndex === 0 && matches(element, 'includeElements');
      const script = element.parentIndex === 0 && matches(element, 'scriptElements');
      if (include || script) {
        const target = attribute(element, 'file');
        if (target) {
          count(); references.push({ elementIndex: i, kind: include ? 'include' : 'script', target: copyValue(target), source: copySource(element.source) });
          if (!target.value) warning(element);
        } else if (include) warning(element);
        if (script) {
          if (children.has(i) || (target && (texts.get(i) ?? []).some(t => /[^ \t\r\n]/u.test(t.value.value)))) warning(element);
          else if (!target) body(element, i, 'chunk');
        }
      }
      const parent = element.parentIndex === null ? undefined : syntax.elements[element.parentIndex];
      if (matches(element, 'handlerElements') && parent && matches(parent, 'handlerContainers') &&
          parent.parentIndex !== null && frameIndices.has(parent.parentIndex)) {
        if (attribute(element, 'file') || children.has(i)) warning(element);
        else body(element, i, 'handler');
      }
    }
    return { schemaVersion: 1, complete: diagnostics.length === 0, frames, references, scripts, declarations, diagnostics };
  } catch (error) { return failed(error instanceof Failure && error.code === 'XUI0003' ? 'XUI0003' : 'XUI0002'); }
}
