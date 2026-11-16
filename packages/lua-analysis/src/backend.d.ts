// Private declaration for the exact reviewed runtime dependency. No backend
// node/options type is part of the SDK's public root contract.
declare module 'luaparse' {
  const parser: {
    parse(input: string, options: Record<string, unknown>): unknown;
    lex(): unknown;
    tokenTypes: Readonly<Record<'EOF' | 'Keyword' | 'Punctuator' | 'StringLiteral', number>>;
  };
  export default parser;
}
