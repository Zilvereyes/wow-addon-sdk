import luaparse from 'luaparse';

// Internal module: no AST is exported from the package root.
export interface SyntaxNode extends Record<string, unknown> {
  type: string;
  range: [number, number];
}
type Failure = { ok: false; kind: 'syntax' | 'resource' | 'backend'; offset: number };
type Success = { ok: true; nodes: SyntaxNode[]; root: SyntaxNode; prefix: number };
class NodeLimit extends Error {
  constructor(readonly offset: number) { super('Node budget exceeded'); }
}
class LexicalFailure extends Error {
  constructor(readonly offset: number) { super('Invalid lexical input'); }
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Two pinned-backend Lua 5.1 defects need parse-only lexical adaptation:
// parseBlock misses the optional ';' after terminal break, and call ambiguity
// compares a multiline literal's starting line rather than its ending line.
// Token boundaries prevent edits inside comments/strings from becoming code.
// Every edit replaces one UTF-16 unit with a space. Original text is retained
// by the public source mapper; backend literal values/locations are not exposed.
function profileBody(body: string): string {
  // wait:true resets the cursor but not token/lookahead. Finish an empty parse
  // first so lexer exceptions never consult uninitialized/prior-input tokens.
  luaparse.parse('', { wait: false, comments: false, scope: false, ranges: false, locations: false,
    luaVersion: '5.1', encodingMode: 'none', extendedIdentifiers: false,
    onCreateNode: null, onCreateScope: null, onDestroyScope: null, onLocalDeclaration: null });
  luaparse.parse(body, { wait: true, comments: false, scope: false, ranges: false, locations: false,
    luaVersion: '5.1', encodingMode: 'none', extendedIdentifiers: false,
    onCreateNode: null, onCreateScope: null, onDestroyScope: null, onLocalDeclaration: null });
  const types = luaparse.tokenTypes;
  let previous: { type: number; value: unknown; range: [number, number] } | undefined;
  let lastEnd = 0;
  const edits: number[] = [];
  for (;;) {
    let token: unknown;
    try { token = luaparse.lex(); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      let unread = lastEnd;
      while (unread < body.length && /[ \t\r\n\v\f]/.test(body[unread]!)) unread++;
      const index = (error as SyntaxError & { index?: unknown }).index;
      // Some lexical errors use the parser token's offset (now EOF at zero).
      // Anchor those at this input's unread span, never a previous document.
      throw new LexicalFailure(Number.isSafeInteger(index) && (index as number) >= unread &&
        (index as number) <= body.length ? index as number : unread);
    }
    if (!record(token) || typeof token.type !== 'number') throw new Error('Unavailable lexer projection');
    if (token.type === types.EOF) break;
    const range = token.range;
    if (!Array.isArray(range) || range.length !== 2 ||
        !range.every(value => Number.isSafeInteger(value) && value >= 0 && value <= body.length) ||
        range[0] < lastEnd || range[1] <= range[0]) throw new Error('Unavailable lexer range');
    if (previous?.type === types.Keyword && previous.value === 'break' &&
        token.type === types.Punctuator && token.value === ';') edits.push(range[0]);
    if (previous?.type === types.StringLiteral && token.type === types.Punctuator && token.value === '(' &&
        !/[\r\n]/.test(body.slice(previous.range[1], range[0]))) {
      const [start, end] = previous.range;
      const quoted = body[start] === '"' || body[start] === "'";
      for (let offset = start + 1; offset < end - 1; offset++) {
        if (body[offset] !== '\r' && body[offset] !== '\n') continue;
        edits.push(offset);
        if (quoted && body[offset - 1] === '\\') edits.push(offset - 1);
      }
    }
    previous = { type: token.type, value: token.value, range: range as [number, number] };
    lastEnd = range[1];
  }
  if (!edits.length) return body;
  const units = body.split('');
  for (const offset of edits) units[offset] = ' ';
  return units.join('');
}

export function parseSyntax(content: string, limits: { maxNodes: number; maxDepth: number; allowShebang: boolean;
  parameters?: readonly string[]; variadic?: boolean }): Failure | Success {
  const prefix = content.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let body = content.slice(prefix);
  // luaparse silently skips shebangs. Keep the strict default and perform only
  // the explicitly selected equal-width loader preprocessing ourselves.
  if (body.startsWith('#!')) {
    if (!limits.allowShebang) return { ok: false, kind: 'syntax', offset: prefix };
    const newline = body.search(/[\r\n]/);
    const end = newline < 0 ? body.length : newline;
    body = ' '.repeat(end) + body.slice(end);
  }
  let root: unknown;
  let created = 0;
  try {
    const adapted = profileBody(body);
    // The SDK annotates lexical references below and maps offsets on the original text.
    root = luaparse.parse(adapted, {
      wait: false, comments: true, scope: false, ranges: true, locations: false,
      luaVersion: '5.1', encodingMode: 'none', extendedIdentifiers: false,
      onCreateScope: null, onDestroyScope: null, onLocalDeclaration: null,
      onCreateNode: (node: unknown) => {
        if (++created > limits.maxNodes) {
          const offset = record(node) && Array.isArray(node.range) && Number.isSafeInteger(node.range[0]) ? node.range[0] as number : 0;
          throw new NodeLimit(offset);
        }
      },
    });
  } catch (error) {
    if (error instanceof LexicalFailure) return { ok: false, kind: 'syntax', offset: prefix + error.offset };
    if (error instanceof NodeLimit) return { ok: false, kind: 'resource', offset: Math.min(content.length, prefix + Math.max(0, error.offset)) };
    if (error instanceof RangeError) return { ok: false, kind: 'resource', offset: prefix };
    if (error instanceof SyntaxError) {
      const index = (error as SyntaxError & { index?: unknown }).index;
      return { ok: false, kind: 'syntax', offset: prefix +
        (Number.isSafeInteger(index) && (index as number) >= 0 && (index as number) <= body.length ? index as number : 0) };
    }
    return { ok: false, kind: 'backend', offset: prefix };
  }
  if (!record(root) || root.type !== 'Chunk' || !Array.isArray(root.body)) return { ok: false, kind: 'backend', offset: prefix };
  const nodes: SyntaxNode[] = [];
  const seen = new WeakSet<object>();
  const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (value === null || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    let childDepth = depth;
    if (record(value) && typeof value.type === 'string') {
      const range = value.range;
      if (!Array.isArray(range) || range.length !== 2 ||
          !range.every(offset => Number.isSafeInteger(offset) && offset >= 0 && offset <= body.length) || range[1] < range[0]) {
        return { ok: false, kind: 'backend', offset: prefix };
      }
      if (depth > limits.maxDepth || nodes.length >= limits.maxNodes) return { ok: false, kind: 'resource', offset: prefix + range[0] };
      nodes.push(value as SyntaxNode);
      childDepth++;
    }
    // Count each backend object once and keep the range walk iterative.
    const children = Object.values(value);
    for (let i = children.length - 1; i >= 0; i--) stack.push({ value: children[i], depth: childDepth });
  }
  if (limits.variadic === false) {
    // A Chunk backend permits root varargs; explicit function bodies do not
    // inherit permission from nested functions or their parameter nodes.
    let invalid = Infinity;
    const visited = new WeakSet<object>();
    const pending: unknown[] = [(root as SyntaxNode).body];
    while (pending.length) {
      const current = pending.pop();
      if (current === null || typeof current !== 'object' || visited.has(current)) continue;
      visited.add(current);
      if (record(current) && current.type === 'FunctionDeclaration') continue;
      if (record(current) && current.type === 'VarargLiteral') invalid = Math.min(invalid, (current.range as [number, number])[0]);
      for (const child of Object.values(current)) pending.push(child);
    }
    if (invalid !== Infinity) return { ok: false, kind: 'syntax', offset: prefix + invalid };
  }
  try { annotateScopes(root as SyntaxNode, limits.parameters ?? []); }
  catch (error) { return { ok: false, kind: error instanceof RangeError ? 'resource' : 'backend', offset: prefix }; }
  return { ok: true, nodes, root: root as SyntaxNode, prefix };
}

// The backend introduces for variables before parsing header expressions.
// Recompute lexical reference annotations on the bounded/validated AST, using
// Lua 5.1 declaration order. Property/field names are not variable references.
function annotateScopes(root: SyntaxNode, parameters: readonly string[]): void {
  const visible = new Set(parameters);
  const introduced: string[] = [];

  function introduce(name: string): void {
    // A shadow keeps the name local after this block ends as well.
    if (visible.has(name)) return;
    visible.add(name);
    introduced.push(name);
  }

  function restore(checkpoint: number): void {
    for (let index = introduced.length - 1; index >= checkpoint; index--) {
      visible.delete(introduced[index]!);
    }
    introduced.length = checkpoint;
  }

  function node(value: unknown): SyntaxNode {
    if (!record(value) || typeof value.type !== 'string') throw new Error('Unavailable scope node');
    return value as SyntaxNode;
  }
  function list(value: unknown): void {
    if (!Array.isArray(value)) throw new Error('Unavailable scope list');
    for (const child of value) visit(child);
  }
  function bind(value: unknown): void {
    const id = node(value);
    if (id.type === 'VarargLiteral') return;
    if (id.type !== 'Identifier' || typeof id.name !== 'string') throw new Error('Unavailable binding');
    id.isLocal = true;
    introduce(id.name);
  }
  function bindings(value: unknown): void {
    if (!Array.isArray(value)) throw new Error('Unavailable bindings');
    for (const child of value) bind(child);
  }
  function visit(value: unknown): void {
    if (value === null) return;
    const current = node(value);
    switch (current.type) {
      case 'Chunk': list(current.body); break;
      case 'Identifier': current.isLocal = visible.has(current.name as string); break;
      case 'LocalStatement': list(current.init); bindings(current.variables); break;
      case 'AssignmentStatement': list(current.variables); list(current.init); break;
      case 'FunctionDeclaration': {
        if (current.isLocal === true) bind(current.identifier);
        else visit(current.identifier);
        const checkpoint = introduced.length;
        try {
          if (record(current.identifier) && current.identifier.type === 'MemberExpression' && current.identifier.indexer === ':') introduce('self');
          bindings(current.parameters);
          list(current.body);
        } finally { restore(checkpoint); }
        break;
      }
      case 'ForNumericStatement': {
        visit(current.start); visit(current.end); visit(current.step);
        const checkpoint = introduced.length;
        try { bind(current.variable); list(current.body); }
        finally { restore(checkpoint); }
        break;
      }
      case 'ForGenericStatement': {
        list(current.iterators);
        const checkpoint = introduced.length;
        try { bindings(current.variables); list(current.body); }
        finally { restore(checkpoint); }
        break;
      }
      case 'RepeatStatement': {
        const checkpoint = introduced.length;
        try { list(current.body); visit(current.condition); }
        finally { restore(checkpoint); }
        break;
      }
      case 'WhileStatement': case 'IfClause': case 'ElseifClause': {
        visit(current.condition);
        const checkpoint = introduced.length;
        try { list(current.body); }
        finally { restore(checkpoint); }
        break;
      }
      case 'DoStatement': case 'ElseClause': {
        const checkpoint = introduced.length;
        try { list(current.body); }
        finally { restore(checkpoint); }
        break;
      }
      case 'IfStatement': list(current.clauses); break;
      case 'CallStatement': visit(current.expression); break;
      case 'ReturnStatement': list(current.arguments); break;
      case 'MemberExpression': visit(current.base); break;
      case 'IndexExpression': visit(current.base); visit(current.index); break;
      case 'CallExpression': visit(current.base); list(current.arguments); break;
      case 'TableCallExpression': visit(current.base); visit(current.arguments); break;
      case 'StringCallExpression': visit(current.base); visit(current.argument); break;
      case 'TableConstructorExpression': list(current.fields); break;
      case 'TableKey': visit(current.key); visit(current.value); break;
      case 'TableKeyString': case 'TableValue': visit(current.value); break;
      case 'BinaryExpression': case 'LogicalExpression': visit(current.left); visit(current.right); break;
      case 'UnaryExpression': visit(current.argument); break;
      case 'BreakStatement': case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'NilLiteral': case 'VarargLiteral': break;
      default: throw new Error('Unavailable scope node type');
    }
  }
  visit(root);
}
