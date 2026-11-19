import {test} from 'node:test';
import assert from 'node:assert/strict';

/**
 * Step 7 (issue #11): authored controls, one per rejection cause the parsers can report.
 * The full run rejected 6 TOC, 1 Lua and 19 XML syntax verdicts. Its aggregate reports the codes only
 * (TOC0001, LUA0002, XML0002). These fixtures separate the causes behind each code; they do not say which cause
 * produced a given real rejection, which needs the per-group observer on the real corpus.
 */
const {parseXml} = await import('@wow-addon/xml-parser');
const {parseToc} = await import('@wow-addon/toc-parser');
const {analyzeLua} = await import('@wow-addon/lua-analysis');
const codes = result => (result.diagnostics ?? []).map(row => row.code);

const xml = {
  'unterminated entity reference': '<Ui>&amp</Ui>',
  'mismatched closing tag': '<Ui><A></B></Ui>',
  'unclosed root element': '<Ui><A>',
  'unquoted attribute value': '<Ui><A x=1/></Ui>',
  'undefined entity': '<Ui>&foo;</Ui>',
  'two root elements': '<Ui/><Ui/>',
  'text before the root': 'junk<Ui/>',
  'empty document': '',
};
for (const [cause, content] of Object.entries(xml)) {
  test(`XML0002 cause: ${cause}`, () => assert.deepEqual(codes(parseXml(content, 'Authored.xml')), ['XML0002']));
}

test('XML controls: well-formed documents give no diagnostic', () => {
  for (const content of ['<Ui/>', '<Ui><A x="1">&amp;</A></Ui>']) assert.deepEqual(codes(parseXml(content, 'Authored.xml')), []);
});

test('TOC0001 causes: a heading line without a directive colon and a directive line without one are errors', () => {
  assert.deepEqual(codes(parseToc('## Title: A\n## Section Heading\n', 'Authored.toc')), ['TOC0001']);
  assert.deepEqual(codes(parseToc('## Title A\n', 'Authored.toc')), ['TOC0001']);
});

test('TOC controls: an empty ## line and a repeated SavedVariables name are not rejections', () => {
  assert.deepEqual(codes(parseToc('## Title: A\n##\n', 'Authored.toc')), []);
  const repeated = parseToc('## SavedVariables: A, A\n', 'Authored.toc');
  assert.deepEqual((repeated.diagnostics ?? []).map(row => `${row.severity}:${row.code}`), ['warning:TOC0002']);
});

test('LUA0002 cause: invalid Lua 5.1 syntax; valid Lua gives none', () => {
  const options = {addonId: 'authored/demo'};
  assert.deepEqual(codes(analyzeLua('x = = 1', 'Authored.lua', options)), ['LUA0002']);
  assert.deepEqual(codes(analyzeLua('x = 1', 'Authored.lua', options)), []);
});
