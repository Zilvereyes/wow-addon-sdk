import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';
import { parseSyntax, type SyntaxNode } from './syntax.js';

/**
 * Fixed parser budgets. Corpus callers own stack/heap/deadline supervision.
 *
 * @beta
 */
export type LuaAnalysisProfile = 'bounded' | 'corpus';

/** Explicit entry scope; host parameters and variadic permission are never inferred. @beta */
export type LuaAnalysisContext =
  | { readonly kind: 'chunk' }
  | { readonly kind: 'function-body'; readonly parameters: readonly string[]; readonly variadic: boolean };

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
  readonly profile?: LuaAnalysisProfile;
  readonly allowShebang?: boolean;
  readonly context?: LuaAnalysisContext;
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
  if (!Array.isArray(value)) return false;
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0) return false;
  for (let index = 0; index < length; index++) if (!Object.hasOwn(value, index)) return false;
  return true;
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
function copySource(value: SourceReference): SourceReference {
  return { file: value.file, range: { start: { line: value.range.start.line, column: value.range.start.column },
    end: { line: value.range.end.line, column: value.range.end.column } } };
}
function copyCondition(value: ConditionDescriptor): ConditionDescriptor {
  const values: string[] = [];
  for (let index = 0; index < value.values.length; index++) values.push(value.values[index]!);
  return { providerId: value.providerId, name: value.name, values, raw: value.raw, source: copySource(value.source) };
}

class ContextFailure extends Error { constructor(readonly code: 'LUA0001' | 'LUA0003') { super(code); } }
const keywords = new Set('and break do else elseif end false for function if in local nil not or repeat return then true until while'.split(' '));
function contextSnapshot(value: unknown): LuaAnalysisContext {
  const own = (input: unknown, key: string) => {
    if (!record(input) || !Object.hasOwn(input, key)) throw new ContextFailure('LUA0001');
    return input[key];
  };
  const kind = own(value, 'kind');
  if (typeof kind !== 'string') throw new ContextFailure('LUA0001');
  let units = kind.length;
  if (units > 16 * 1024) throw new ContextFailure('LUA0003');
  if (kind === 'chunk') return { kind };
  if (kind !== 'function-body') throw new ContextFailure('LUA0001');
  const variadic = own(value, 'variadic'), input = own(value, 'parameters');
  if (typeof variadic !== 'boolean' || !Array.isArray(input)) throw new ContextFailure('LUA0001');
  const length = input.length;
  if (!Number.isSafeInteger(length) || length < 0) throw new ContextFailure('LUA0001');
  if (length > 128) throw new ContextFailure('LUA0003');
  const parameters: string[] = [];
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(input, index)) throw new ContextFailure('LUA0001');
    const name: unknown = input[index];
    if (typeof name !== 'string') throw new ContextFailure('LUA0001');
    units += name.length;
    if (units > 16 * 1024) throw new ContextFailure('LUA0003');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || keywords.has(name)) throw new ContextFailure('LUA0001');
    parameters.push(name);
  }
  return { kind, parameters, variadic };
}

// Preserve legacy documented fields/validation while copying numeric array
// cells once. Undocumented iterators cannot substitute caller-owned objects.
function conditionsSnapshot(value: unknown): ConditionDescriptor[] {
  if (!denseArray(value)) throw new ContextFailure('LUA0001');
  const result: ConditionDescriptor[] = [];
  for (let index = 0; index < value.length; index++) {
    const condition = value[index];
    if (!record(condition)) throw new ContextFailure('LUA0001');
    const { providerId, name, raw, values: input, source: originalSource } = condition;
    if (!nonempty(providerId) || !nonempty(name) || typeof raw !== 'string' || !denseArray(input)) throw new ContextFailure('LUA0001');
    const source = copySource(originalSource as SourceReference);
    if (!validSource(source)) throw new ContextFailure('LUA0001');
    const values: string[] = [];
    for (let cell = 0; cell < input.length; cell++) {
      const item: unknown = input[cell];
      if (typeof item !== 'string') throw new ContextFailure('LUA0001');
      values.push(item);
    }
    result.push({ providerId, name, raw, values, source });
  }
  return result;
}

/**
 * Analyze original text without executing it. The explicit profile is Lua 5.1,
 * ASCII identifiers, uninterpreted string values and one optional leading BOM.
 * Preserve original UTF-16 offsets/endings. Bound input to 1 Mi code units,
 * nodes to 50,000 and accepted AST depth to 256 by default. Explicit corpus
 * profile allows 32 Mi units, 4,000,000 nodes and depth 1,024; these are not a
 * CPU/memory sandbox. Callers own process/stack/heap/deadline supervision.
 * Hashbang preprocessing requires allowShebang:true; defaults stay strict.
 * Omitted/chunk context preserves file behavior. Explicit function-body uses
 * at most128 supplied ASCII parameter cells/16Ki context string units, checks
 * its own variadic permission and returns only unknown global activation.
 * Host signatures are never inferred. Function-body leading BOM/hashbangs
 * are syntax errors; allowShebang:true is invalid for that context. New
 * context fields are owned snapshots; duplicate parameter names stay local.
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
  const profile = record(options) ? options.profile : undefined;
  const allowShebang = record(options) ? options.allowShebang : undefined;
  const maximum = (profile === 'corpus' ? 32 : 1) * 1024 * 1024;
  const text = typeof content === 'string' && content.length <= maximum ? content : '';
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
      ('profile' in options && profile !== 'bounded' && profile !== 'corpus') ||
      ('allowShebang' in options && typeof allowShebang !== 'boolean')) {
    return failure('LUA0001', 'Invalid Lua analysis input projection.');
  }
  let context: LuaAnalysisContext = { kind: 'chunk' }, inherited: ConditionDescriptor[] = [];
  try {
    if (Object.hasOwn(options, 'context')) context = contextSnapshot(options.context);
    if ('conditions' in options) inherited = conditionsSnapshot(options.conditions);
  } catch (error) {
    return failure(error instanceof ContextFailure ? error.code : 'LUA0001',
      error instanceof ContextFailure && error.code === 'LUA0003' ? 'Lua analysis resource limit exceeded.' : 'Invalid Lua analysis input projection.');
  }
  if (context.kind === 'function-body' && allowShebang === true) return failure('LUA0001', 'Invalid Lua analysis input projection.');
  if (content.length > maximum) return failure('LUA0003', 'Lua analysis resource limit exceeded.');
  if (context.kind === 'function-body' && (content.charCodeAt(0) === 0xFEFF || content.startsWith('#!'))) {
    return failure('LUA0002', 'Invalid syntax under the Lua 5.1 profile.');
  }
  const parsed = parseSyntax(content, { maxNodes: profile === 'corpus' ? 4000000 : 50000,
    maxDepth: profile === 'corpus' ? 1024 : 256, allowShebang: allowShebang === true,
    ...(context.kind === 'function-body' ? { parameters: context.parameters, variadic: context.variadic } : {}) });
  if (!parsed.ok) return failure(parsed.kind === 'syntax' ? 'LUA0002' : parsed.kind === 'resource' ? 'LUA0003' : 'LUA0005',
    parsed.kind === 'syntax' ? 'Invalid syntax under the Lua 5.1 profile.' : parsed.kind === 'resource' ?
      'Lua analysis resource limit exceeded.' : 'Lua syntax backend projection is unavailable.', parsed.offset);
  const direct = new Set(context.kind === 'function-body' ? [] : parsed.root.body as unknown[]);
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
