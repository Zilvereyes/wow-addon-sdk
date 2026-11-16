import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';
import { parseSyntax, type SyntaxNode } from './syntax.js';

/**
 * Caller-owned source association and optional inherited restrictions.
 * This package never discovers files or infers TOC reachability. Conditions
 * are copied without interpreting their grammar or truth.
 *
 * @beta
 */
export interface LuaAnalysisOptions {
  readonly addonId: string;
  readonly conditions?: readonly ConditionDescriptor[];
}

/**
 * Lua 5.1 syntax plus a conservative lexical declaration projection.
 * Complete does not prove runtime execution, values, every possible global
 * mutation or reachability. No backend AST is exposed. Returned trees are
 * independent of inputs and other calls; readonly is not runtime freezing.
 *
 * @beta
 */
export interface LuaAnalysisResult {
  readonly schemaVersion: 1;
  readonly complete: boolean;
  readonly declarations: readonly GlobalDeclaration[];
  readonly diagnostics: readonly Diagnostic[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
function denseArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Array.from(value).every((_, index) => Object.hasOwn(value, index));
}
function validSource(value: unknown): value is SourceReference {
  if (!record(value) || !nonempty(value.file) || !record(value.range)) return false;
  const { start, end } = value.range;
  if (!record(start) || !record(end)) return false;
  for (const position of [start, end]) {
    if (!Number.isSafeInteger(position.line) || !Number.isSafeInteger(position.column) ||
        (position.line as number) < 0 || (position.column as number) < 0) return false;
  }
  return (end.line as number) > (start.line as number) ||
    (end.line === start.line && (end.column as number) >= (start.column as number));
}
function validCondition(value: unknown): value is ConditionDescriptor {
  return record(value) && nonempty(value.providerId) && nonempty(value.name) && typeof value.raw === 'string' &&
    denseArray(value.values) && value.values.every(v => typeof v === 'string') && validSource(value.source);
}
function copySource(value: SourceReference): SourceReference {
  return { file: value.file, range: { start: { line: value.range.start.line, column: value.range.start.column },
    end: { line: value.range.end.line, column: value.range.end.column } } };
}
function copyCondition(value: ConditionDescriptor): ConditionDescriptor {
  return { providerId: value.providerId, name: value.name, values: [...value.values], raw: value.raw, source: copySource(value.source) };
}

/**
 * Analyze original text without executing it. The explicit profile is Lua 5.1,
 * ASCII identifiers, uninterpreted string values and one optional leading BOM.
 * Preserve original UTF-16 offsets/endings. Bound input to 1 Mi code units,
 * nodes to 50,000 and accepted AST depth to 256; these are not a CPU/memory
 * sandbox. Corpus callers must add process deadlines and heap limits.
 * Direct chunk bindings retain static unconditional/inherited-conditional
 * flags; other flow/function assignments remain unknown. Dynamic environment
 * access makes the projection incomplete and all returned bindings unknown.
 * Invalid syntax/resource/input yields no declarations. Native getters remain
 * caller code; only documented input projections are validated/copied.
 *
 * @beta
 */
export function analyzeLua(content: string, sourcePath: string, options: LuaAnalysisOptions): LuaAnalysisResult {
  // Reject oversized input before constructing the line index or invoking the
  // backend. Resource failure is anchored at the original start of input.
  const text = typeof content === 'string' && content.length <= 1024 * 1024 ? content : '';
  const file = typeof sourcePath === 'string' ? sourcePath : '';
  // Original line starts, including CRLF as one break. No source normalization.
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') { if (text[i + 1] === '\n') i++; starts.push(i + 1); }
    else if (text[i] === '\n') starts.push(i + 1);
  }
  function position(offset: number) {
    // A source point inside CRLF is anchored at the start of that line break.
    if (text[offset] === '\n' && offset > 0 && text[offset - 1] === '\r') offset--;
    let low = 0, high = starts.length;
    while (low + 1 < high) { const middle = Math.floor((low + high) / 2); if (starts[middle]! <= offset) low = middle; else high = middle; }
    return { line: low, column: offset - starts[low]! };
  }
  const source = (start: number, end = start): SourceReference => ({ file, range: { start: position(start), end: position(end) } });
  function failure(code: string, message: string, offset = 0): LuaAnalysisResult {
    return { schemaVersion: 1, complete: false, declarations: [], diagnostics: [
      { code, severity: 'error', message, source: source(offset) },
    ] };
  }
  if (typeof content !== 'string' || !nonempty(sourcePath) || !record(options) || !nonempty(options.addonId) ||
      ('conditions' in options && (!denseArray(options.conditions) || !options.conditions.every(validCondition)))) {
    return failure('LUA0001', 'Invalid Lua analysis input projection.');
  }
  if (content.length > 1024 * 1024) return failure('LUA0003', 'Lua analysis resource limit exceeded.');
  const parsed = parseSyntax(content);
  if (!parsed.ok) return failure(parsed.kind === 'syntax' ? 'LUA0002' : parsed.kind === 'resource' ? 'LUA0003' : 'LUA0005',
    parsed.kind === 'syntax' ? 'Invalid syntax under the Lua 5.1 profile.' : parsed.kind === 'resource' ?
      'Lua analysis resource limit exceeded.' : 'Lua syntax backend projection is unavailable.', parsed.offset);
  const direct = new Set(parsed.root.body as unknown[]);
  const environmentNames = new Set(['_G', 'getfenv', 'setfenv', 'load', 'loadstring', 'dofile', 'require']);
  const unsupported = parsed.nodes.filter(node => node.type === 'Identifier' && node.isLocal === false &&
    typeof node.name === 'string' && environmentNames.has(node.name)).sort((a, b) => a.range[0] - b.range[0]);
  const found: { node: SyntaxNode; name: string; direct: boolean }[] = [];
  for (const node of parsed.nodes) {
    let targets: unknown[] = [];
    if (node.type === 'AssignmentStatement') {
      if (!Array.isArray(node.variables)) return failure('LUA0005', 'Lua syntax backend projection is unavailable.');
      targets = node.variables;
    } else if (node.type === 'FunctionDeclaration' && node.identifier !== null && node.isLocal === false) {
      targets = [node.identifier];
    }
    for (const target of targets) {
      if (!record(target) || target.type !== 'Identifier') continue;
      if (target.isLocal === true) continue;
      if (target.isLocal !== false || typeof target.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(target.name)) {
        return failure('LUA0005', 'Lua syntax backend projection is unavailable.');
      }
      found.push({ node: target as SyntaxNode, name: target.name, direct: direct.has(node) });
    }
  }
  found.sort((a, b) => a.node.range[0] - b.node.range[0]);
  const inherited = options.conditions ?? [];
  const declarations: GlobalDeclaration[] = found.map(({ node, name, direct }) => ({
    name, addonId: options.addonId, kind: 'lua-global',
    activationState: unsupported.length || !direct ? 'unknown' : inherited.length ? 'conditional' : 'unconditional',
    source: source(parsed.prefix + node.range[0], parsed.prefix + node.range[1]),
    ...(inherited.length ? { conditions: inherited.map(copyCondition) } : {}),
  }));
  return { schemaVersion: 1, complete: unsupported.length === 0, declarations,
    diagnostics: unsupported.map(node => ({ code: 'LUA0004', severity: 'warning',
      message: 'Dynamic environment access is outside the lexical projection.',
      source: source(parsed.prefix + node.range[0], parsed.prefix + node.range[1]),
    })) };
}
