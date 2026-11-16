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

export function parseSyntax(content: string): Failure | Success {
  const prefix = content.charCodeAt(0) === 0xFEFF ? 1 : 0;
  const body = content.slice(prefix);
  // luaparse silently skips shebangs. They are outside this explicit grammar
  // profile; accepting a leading BOM is the only loader preprocessing here.
  if (body.startsWith('#!')) return { ok: false, kind: 'syntax', offset: prefix };
  let root: unknown;
  let created = 0;
  try {
    const adapted = profileBody(body);
    root = luaparse.parse(adapted, {
      wait: false, comments: true, scope: true, ranges: true, locations: true,
      luaVersion: '5.1', encodingMode: 'none', extendedIdentifiers: false,
      onCreateScope: null, onDestroyScope: null, onLocalDeclaration: null,
      onCreateNode: (node: unknown) => {
        if (++created > 50000) {
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
      if (depth > 256 || nodes.length >= 50000) return { ok: false, kind: 'resource', offset: prefix + range[0] };
      nodes.push(value as SyntaxNode);
      childDepth++;
    }
    // Scope globals can reference identifier objects already in the tree.
    // Visit body before globals; count each object once and never recurse in JS.
    const children = Object.values(value);
    for (let i = children.length - 1; i >= 0; i--) stack.push({ value: children[i], depth: childDepth });
  }
  try { annotateScopes(root as SyntaxNode); }
  catch (error) { return { ok: false, kind: error instanceof RangeError ? 'resource' : 'backend', offset: prefix }; }
  return { ok: true, nodes, root: root as SyntaxNode, prefix };
}

// The backend introduces for variables before parsing header expressions.
// Recompute lexical reference annotations on the bounded/validated AST, using
// Lua 5.1 declaration order. Property/field names are not variable references.
function annotateScopes(root: SyntaxNode): void {
  function node(value: unknown): SyntaxNode {
    if (!record(value) || typeof value.type !== 'string') throw new Error('Unavailable scope node');
    return value as SyntaxNode;
  }
  function list(value: unknown, scope: Set<string>): void {
    if (!Array.isArray(value)) throw new Error('Unavailable scope list');
    for (const child of value) visit(child, scope);
  }
  function bind(value: unknown, scope: Set<string>): void {
    const id = node(value);
    if (id.type === 'VarargLiteral') return;
    if (id.type !== 'Identifier' || typeof id.name !== 'string') throw new Error('Unavailable binding');
    id.isLocal = true;
    scope.add(id.name);
  }
  function bindings(value: unknown, scope: Set<string>): void {
    if (!Array.isArray(value)) throw new Error('Unavailable bindings');
    for (const child of value) bind(child, scope);
  }
  function visit(value: unknown, scope: Set<string>): void {
    if (value === null) return;
    const current = node(value);
    const nested = () => new Set(scope);
    switch (current.type) {
      case 'Chunk': list(current.body, scope); break;
      case 'Identifier': current.isLocal = scope.has(current.name as string); break;
      case 'LocalStatement': list(current.init, scope); bindings(current.variables, scope); break;
      case 'AssignmentStatement': list(current.variables, scope); list(current.init, scope); break;
      case 'FunctionDeclaration': {
        if (current.isLocal === true) bind(current.identifier, scope);
        else visit(current.identifier, scope);
        const bodyScope = nested();
        if (record(current.identifier) && current.identifier.type === 'MemberExpression' && current.identifier.indexer === ':') bodyScope.add('self');
        bindings(current.parameters, bodyScope);
        list(current.body, bodyScope);
        break;
      }
      case 'ForNumericStatement': {
        visit(current.start, scope); visit(current.end, scope); visit(current.step, scope);
        const bodyScope = nested(); bind(current.variable, bodyScope); list(current.body, bodyScope); break;
      }
      case 'ForGenericStatement': {
        list(current.iterators, scope);
        const bodyScope = nested(); bindings(current.variables, bodyScope); list(current.body, bodyScope); break;
      }
      case 'RepeatStatement': {
        const bodyScope = nested(); list(current.body, bodyScope); visit(current.condition, bodyScope); break;
      }
      case 'WhileStatement': case 'IfClause': case 'ElseifClause':
        visit(current.condition, scope); list(current.body, nested()); break;
      case 'DoStatement': case 'ElseClause': list(current.body, nested()); break;
      case 'IfStatement': list(current.clauses, scope); break;
      case 'CallStatement': visit(current.expression, scope); break;
      case 'ReturnStatement': list(current.arguments, scope); break;
      case 'MemberExpression': visit(current.base, scope); break;
      case 'IndexExpression': visit(current.base, scope); visit(current.index, scope); break;
      case 'CallExpression': visit(current.base, scope); list(current.arguments, scope); break;
      case 'TableCallExpression': visit(current.base, scope); visit(current.arguments, scope); break;
      case 'StringCallExpression': visit(current.base, scope); visit(current.argument, scope); break;
      case 'TableConstructorExpression': list(current.fields, scope); break;
      case 'TableKey': visit(current.key, scope); visit(current.value, scope); break;
      case 'TableKeyString': case 'TableValue': visit(current.value, scope); break;
      case 'BinaryExpression': case 'LogicalExpression': visit(current.left, scope); visit(current.right, scope); break;
      case 'UnaryExpression': visit(current.argument, scope); break;
      case 'BreakStatement': case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'NilLiteral': case 'VarargLiteral': break;
      default: throw new Error('Unavailable scope node type');
    }
  }
  visit(root, new Set());
}
