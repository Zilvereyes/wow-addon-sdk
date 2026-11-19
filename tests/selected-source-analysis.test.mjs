import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {PassThrough, Writable} from 'node:stream';
import {parseToc} from '@wow-addon/toc-parser';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {parseXml} from '@wow-addon/xml-parser';
import {analyzeXml, mapXmlValueRanges} from '@wow-addon/xml-analysis';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';
import {snapshotGraphAnalysisRequest, verifyGraphAnalysisReply, emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';
import {composeXmlInlineLua, verifyXmlInlineLua} from '../scripts/xml-inline-lua-validation.mjs';
import {verifyXmlProvider} from '../scripts/xml-provider-validation.mjs';
import {verifyXmlSyntax} from '../scripts/selected-source-syntax-validation.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const condition = () => ({providerId: '@wow-addon/toc-metadata-adapter', name: 'AllowLoadGameType', raw: '[AllowLoadGameType vanilla]',
  values: ['vanilla'], source: {file: 'Requester/Requester_Vanilla.toc', range: {start: {line: 2, column: 0}, end: {line: 2, column: 27}}}});
const request = (language, content, conditions = []) => ({language, content, sourcePath: `Shared/Source.${language}`,
  addonId: 'requester-exact-ID', conditions, luaProfile: 'bounded', allowShebang: false,
  xmlPolicy: {...json('../examples/xml-provider-profile.json').policy,
    handlerElements: [{namespaceUri: null, localName: 'OnLoad'}, {namespaceUri: null, localName: 'OnClick'}]},
  inlineProfile: json('../examples/xml-inline-lua-profile.json')});
const receipts = (...names) => {const result = emptyGraphCalls(); for (const name of names) result[name].invoked = result[name].returned = 1; return result;};
const xml = '<Ui><Frame name="Authored"><Scripts><OnLoad>Handler=1</OnLoad><OnClick>Missing=1</OnClick></Scripts></Frame><Script>Ou<!--gap-->t=1; Value=&quot;😀&quot;</Script></Ui>';

test('real supervised TOC/Lua calls preserve duplicate entries, paths and inherited conditions', async () => {
  const client = createGraphAnalyzer();
  try {
    const toc = await client.analyze(request('toc', '## SavedVariables: One, One\r\nFile.lua\r\nFile.lua'));
    assert.deepEqual(toc.confirmedApiCalls, receipts('parseToc'));
    assert.deepEqual(toc.result.parsed.metadata.fileEntries.map(row => row.path), ['File.lua', 'File.lua']);
    assert.equal(toc.result.parsed.metadata.savedVariableDeclarations.length, 2);
    const input = request('lua', 'First=1\r\nif true then Second=2 end', [condition()]);
    const lua = await client.analyze(input);
    assert.deepEqual(lua.confirmedApiCalls, receipts('analyzeLua'));
    assert.deepEqual(lua.result.result.declarations.map(row => row.activationState), ['conditional', 'unknown']);
    for (const declaration of lua.result.result.declarations) {
      assert.equal(declaration.addonId, input.addonId); assert.equal(declaration.source.file, input.sourcePath);
      assert.deepEqual(declaration.conditions, input.conditions);
    }
    input.luaProfile = 'corpus';
    const corpus = await client.analyze(input);
    assert.deepEqual(corpus, lua, 'actual corpus-thread calls return the same bounded authored result and receipts');
  } finally { await client.close(); }
});

test('graph Lua projection checks the exact enumerable shape independently of field order', () => {
  const input = request('lua', 'Exact=1', [condition()]);
  const analysis = analyzeLua(input.content, input.sourcePath, {addonId: input.addonId, conditions: input.conditions});
  const declaration = Object.fromEntries(Object.entries(analysis.declarations[0]).reverse());
  const reply = {result: {language: 'lua', result: {...analysis, declarations: [declaration]}},
    confirmedApiCalls: receipts('analyzeLua'), failure: null};
  assert.deepEqual(verifyGraphAnalysisReply(reply, input), {
    result: reply.result, confirmedApiCalls: reply.confirmedApiCalls, failure: null,
  });
  const withHiddenName = structuredClone(reply);
  const changed = withHiddenName.result.result.declarations[0];
  Object.defineProperty(changed, 'name', {enumerable: false});
  changed.extra = 'Exact';
  assert.throws(() => verifyGraphAnalysisReply(withHiddenName, input));
  const wrongRange = structuredClone(reply);
  wrongRange.result.result.declarations[0].source.range.start.column++;
  assert.throws(() => verifyGraphAnalysisReply(wrongRange, input));
});

test('real XML provider and inline analysis preserve requester and exact disjoint original mapping', async () => {
  const input = request('xml', xml, [condition()]), client = createGraphAnalyzer();
  try {
    const reply = await client.analyze(input), output = reply.result;
    assert.deepEqual(reply.confirmedApiCalls, {...receipts('parseXml', 'analyzeXml'),
      analyzeLua: {invoked: 2, returned: 2}, mapXmlValueRanges: {invoked: 2, returned: 2}});
    assert.equal(output.provider.declarations[0].addonId, input.addonId);
    assert.deepEqual(output.provider.declarations[0].conditions, input.conditions);
    assert.equal(output.inline.length, 3); assert.equal(output.inline[1].status, 'missing-context');
    assert.equal(output.inline[1].analysis, null); assert.equal(output.inline[1].mapping, null);
    assert.equal(output.inline[0].analysis.declarations[0].activationState, 'unknown');
    assert.equal(output.inline[2].analysis.declarations[0].activationState, 'conditional');
    assert.equal(output.inline[2].mapping.mappings[0].parts.length, 2);
    assert.equal(output.inline[2].mapping.mappings[0].parts[0].source.file, input.sourcePath);
    assert.equal(Object.hasOwn(output.inline[2], 'decodedSourcePath'), false);
  } finally { await client.close(); }
});

test('syntax rejection is a real returned API verdict and suppresses downstream XML calls', async () => {
  const client = createGraphAnalyzer();
  try {
    const xmlReply = await client.analyze(request('xml', '<Ui><broken></Ui>'));
    assert.equal(xmlReply.result.syntax.complete, false); assert.equal(xmlReply.result.provider, null);
    assert.deepEqual(xmlReply.result.inline, []); assert.deepEqual(xmlReply.confirmedApiCalls, receipts('parseXml'));
    const luaReply = await client.analyze(request('lua', 'function f() return ... end'));
    assert.equal(luaReply.result.result.diagnostics[0].code, 'LUA0002');
    assert.deepEqual(luaReply.confirmedApiCalls, receipts('analyzeLua'));
  } finally { await client.close(); }
});

test('confirmed XML provider resource denial retains its verdict and suppresses inline calls', async () => {
  const text = '<Ui>' + '<Frame name="Authored"/>'.repeat(100) + '<Script>Out=1</Script></Ui>';
  const input = request('xml', text, Array.from({length: 256}, condition));
  const client = createGraphAnalyzer();
  try {
    const reply = await client.analyze(input), {syntax, provider, inline} = reply.result;
    assert.equal(syntax.complete, true);
    assert.equal(provider.complete, false);
    assert.deepEqual(provider.diagnostics.map(diagnostic => diagnostic.code), ['XUI0003']);
    assert.deepEqual(inline, []);
    assert.deepEqual(reply.confirmedApiCalls, receipts('parseXml', 'analyzeXml'));
    const withInline = {...structuredClone(reply), failure: null};
    withInline.result.inline.push({elementIndex: 101, kind: 'chunk', status: 'missing-context', analysis: null, mapping: null});
    assert.throws(() => verifyGraphAnalysisReply(withInline, input));
    const malformed = {...structuredClone(reply), failure: null};
    malformed.result.provider.diagnostics[0].source.file = 'Wrong.xml';
    assert.throws(() => verifyGraphAnalysisReply(malformed, input));
  } finally { await client.close(); }
});

test('graph-specific association is strict while legacy provider/inline defaults remain strict', () => {
  const input = request('xml', xml, [condition()]), association = {addonId: input.addonId, conditions: input.conditions};
  const syntax = parseXml(xml, input.sourcePath, {namespaceAware: true});
  const provider = analyzeXml(xml, input.sourcePath, {...association, policy: input.xmlPolicy});
  const inline = composeXmlInlineLua(xml, input.sourcePath, syntax, provider,
    {policy: input.xmlPolicy, profile: input.inlineProfile, fileOrdinal: 0, association}, analyzeLua, mapXmlValueRanges);
  assert.equal(inline.status, 'completed');
  assert.throws(() => verifyXmlProvider(provider, syntax, xml, input.sourcePath, input.xmlPolicy));
  assert.throws(() => verifyXmlInlineLua(inline, xml, input.sourcePath, syntax, provider, input.xmlPolicy, input.inlineProfile, 0));
  assert.equal(verifyXmlInlineLua(inline, xml, input.sourcePath, syntax, provider, input.xmlPolicy, input.inlineProfile, 0, association).metrics.attemptedBodies, 2);
  for (const alter of [p => p.declarations[0].addonId = 'other', p => p.declarations[0].conditions[0].source.file = 'other.toc',
    p => p.declarations[0].conditions[0].values.reverse().push('changed')]) {
    const changed = structuredClone(provider); alter(changed);
    assert.throws(() => verifyXmlProvider(changed, syntax, xml, input.sourcePath, input.xmlPolicy, association));
  }
});

function fake(onRequest, {delayedClose = false} = {}) {
  const launches = [];
  return {launches, spawnProcess(executable, args, options) {
    const child = new EventEmitter(); child.exitCode = child.signalCode = null;
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({write(chunk, _encoding, done) {onRequest(child, JSON.parse(chunk.toString())); done();}});
    child.kill = () => {child.signalCode = 'SIGKILL'; if (!delayedClose) child.emit('close', null); return true;};
    launches.push({child, executable, args, options}); return child;
  }};
}
const finish = (child, reply) => {child.stdout.write(JSON.stringify(reply) + '\n'); child.exitCode = 0; child.emit('close', 0);};
const luaReply = input => ({id: input.id, result: {language: 'lua', result: analyzeLua(input.content, input.sourcePath,
  {addonId: input.addonId, conditions: input.conditions})}, confirmedApiCalls: receipts('analyzeLua'), failure: null});

test('crash/protocol/invariant failures publish neither result nor invented call receipts', async () => {
  for (const act of [
    (child) => {child.exitCode = 1; child.emit('close', 1);},
    (child, input) => finish(child, {...luaReply(input), id: input.id + 1}),
    (child, input) => {const reply = luaReply(input); reply.result.result.declarations[0].addonId = 'wrong'; finish(child, reply);},
    (child, input) => {const reply = luaReply(input); reply.confirmedApiCalls.parseToc.invoked = 1; finish(child, reply);},
    (child) => {child.stdout.write(Buffer.from([0xff, 10])); child.emit('close', 0);},
    (child, input) => {child.stdout.write(JSON.stringify(luaReply(input)) + '\n{}\n'); child.emit('close', 0);},
  ]) {
    const transport = fake(act), client = createGraphAnalyzer(transport);
    try { await assert.rejects(client.analyze(request('lua', 'Out=1')), error =>
      /^graph-analysis-(exit|invariant)$/u.test(error.message) && !Object.hasOwn(error, 'confirmedApiCalls')); }
    finally { await client.close(); }
  }
});

test('late responses and unreaped children cannot overlap a replacement process', async () => {
  let clock = 0;
  const transport = fake((child, input) => {clock = 10001; child.stdout.write(JSON.stringify(luaReply(input)) + '\n');}, {delayedClose: true});
  const client = createGraphAnalyzer({...transport, now: () => clock, timeoutMs: 20});
  try {
    await assert.rejects(client.analyze(request('lua', 'Out=1')), /graph-analysis-timeout/u);
    await assert.rejects(client.analyze(request('lua', 'Out=1'), 1), /graph-analysis-timeout/u);
    assert.equal(transport.launches.length, 1);
    await assert.rejects(client.close(), /graph-analysis-reap/u);
  } finally { transport.launches[0].child.emit('close', null); await client.close(); }
});

test('deadline includes startup, output cap and fixed execution do not come from profile data', async () => {
  let clock = 0;
  const transport = fake(() => {}), original = transport.spawnProcess;
  transport.spawnProcess = (...args) => {clock = 2; return original(...args);};
  const client = createGraphAnalyzer({...transport, now: () => clock});
  try {
    await assert.rejects(client.analyze(request('lua', 'Out=1'), 1), /graph-analysis-timeout/u);
    const launch = transport.launches[0];
    assert.equal(launch.executable, process.execPath); assert.equal(launch.options.shell, false); assert.equal(launch.options.windowsHide, true);
    assert.ok(launch.args.at(-1).endsWith('selected-source-analysis-worker.mjs'));
    assert.deepEqual(launch.args.slice(0, -1), ['--max-old-space-size=128', '--stack_size=1024']);
    assert.equal(Object.hasOwn(launch.options.env, 'NODE_OPTIONS'), false);
  } finally { await client.close(); }
  const huge = fake(child => child.stdout.write(Buffer.alloc(1025))), capped = createGraphAnalyzer({...huge, maxOutputBytes: 1024});
  try { await assert.rejects(capped.analyze(request('lua', 'Out=1')), /graph-analysis-output-limit/u); }
  finally { await capped.close(); }
});

test('request snapshot reads own consumed cells once and rejects executable/oversized/sparse data before spawning', async () => {
  const input = request('lua', 'Out=1', [condition()]); let reads = 0;
  const selected = input.conditions[0];
  Object.defineProperty(input.conditions, 0, {get() {reads++; return reads === 1 ? selected : null;}, enumerable: true});
  input.conditions[Symbol.iterator] = () => {throw Error('must not iterate caller data');};
  assert.deepEqual(snapshotGraphAnalysisRequest(input).conditions[0].values, ['vanilla']); assert.equal(reads, 1);
  const transport = fake(() => {}), client = createGraphAnalyzer(transport);
  try {
    for (const change of [p => p.workerPath = 'untrusted', p => p.content = 'a'.repeat(1024 * 1024 + 1),
      p => {p.conditions.length = 1;}, p => p.xmlPolicy.roots[0].localName = () => 'Ui']) {
      const bad = request('lua', 'Out=1'); change(bad);
      await assert.rejects(client.analyze(bad), /graph-analysis-input/u);
    }
    assert.equal(transport.launches.length, 0);
  } finally { await client.close(); }
});

test('XML keeps its one-Mi UTF-16 unit ceiling and rejects larger files before spawning', async () => {
  const input = request('xml', ' '.repeat(1024 * 1024 - 7) + '🙂<Ui/>');
  assert.equal(input.content.length, 1024 * 1024);
  assert.equal(snapshotGraphAnalysisRequest(input).content, input.content);
  const transport = fake(() => {}), client = createGraphAnalyzer(transport);
  try {
    await assert.rejects(client.analyze({...input, content: input.content + ' '}), /graph-analysis-input/u);
    assert.equal(transport.launches.length, 0);
  } finally { await client.close(); }
});

test('late TOC projection corruption and false receipt totals fail whole-result validation', () => {
  const input = request('toc', 'One.lua\r\nTwo.lua');
  const reply = {result: {language: 'toc', parsed: parseToc(input.content, input.sourcePath)}, confirmedApiCalls: receipts('parseToc'), failure: null};
  assert.equal(verifyGraphAnalysisReply(reply, input).result.parsed.entries.length, 2);
  for (const alter of [p => p.result.parsed.entries[1].source.range.end.column = 1000,
    p => p.result.parsed.metadata.fileEntries.pop(), p => p.confirmedApiCalls.parseToc.returned = 0]) {
    const changed = structuredClone(reply); alter(changed); assert.throws(() => verifyGraphAnalysisReply(changed, input));
  }
});

test('TOC semantic targets/restrictions and failed-stage receipts are independently bound', () => {
  const input = request('toc', 'Core.lua [AllowLoadGameType other]');
  const reply = {result: {language: 'toc', parsed: parseToc(input.content, input.sourcePath)}, confirmedApiCalls: receipts('parseToc'), failure: null};
  for (const alter of [p => {p.result.parsed.entries[0].fileEntry.path = 'Other.lua';},
    p => {p.result.parsed.entries[0].fileEntry.conditions.length = 0;}]) {
    const changed = structuredClone(reply); alter(changed);
    // Reproduce coherent corruption in both redundant copies, not just their equality.
    changed.result.parsed.metadata.fileEntries = changed.result.parsed.entries.map(row => row.fileEntry);
    assert.throws(() => verifyGraphAnalysisReply(changed, input));
  }
  const failed = {result: null, failure: 'backend', confirmedApiCalls: receipts('parseToc')};
  assert.throws(() => verifyGraphAnalysisReply(failed, request('lua', 'Out=1')));
  assert.equal(verifyGraphAnalysisReply(failed, input).result, null);
  const sparse = request('lua', 'Out=1', [condition()]);
  sparse.conditions = new Proxy(sparse.conditions, {get(target, key, receiver) {return key === 'length' ? -1 : Reflect.get(target, key, receiver);}});
  assert.throws(() => snapshotGraphAnalysisRequest(sparse), /graph-analysis-input/u);
});

test('XML rejection shape, expanded names and namespaces cannot authorize invented provider references', () => {
  const rejected = parseXml('<Ui><broken></Ui>', 'Authored.xml');
  assert.doesNotThrow(() => verifyXmlSyntax(rejected, '<Ui><broken></Ui>', 'Authored.xml'));
  for (const alter of [p => p.diagnostics = 'x', p => p.diagnostics[0].code = 'PRIVATE_CODE',
    p => p.diagnostics[0].severity = 'warning', p => p.diagnostics[0].message = 'private']) {
    const changed = structuredClone(rejected); alter(changed);
    assert.throws(() => verifyXmlSyntax(changed, '<Ui><broken></Ui>', 'Authored.xml'));
  }
  for (const text of ['<Ui><Ignored file="Other.lua"/></Ui>',
    '<u:Ui xmlns:u="urn:authored"><u:Ignored file="Other.lua"/></u:Ui>',
    '<Ui xmlns="urn:authored"><Ignored xmlns="" file="Other.lua"/></Ui>']) {
    const valid = parseXml(text, 'Authored.xml', {namespaceAware: true});
    assert.doesNotThrow(() => verifyXmlSyntax(valid, text, 'Authored.xml'));
    for (const alter of [p => p.elements[1].name.localName = 'Script', p => p.elements[1].name.namespaceUri = 'urn:other',
      p => p.elements[1].name.prefix = 'other']) {
      const changed = structuredClone(valid); alter(changed);
      assert.throws(() => verifyXmlSyntax(changed, text, 'Authored.xml'));
    }
  }
});

test('omitted XML attributes, children or body text reject the entire projection', () => {
  const text = '<Ui xmlns="urn:authored"><Ignored file="Other.lua"/><Script>Out=1<!--gap-->;Two=2</Script><![CDATA[tail]]></Ui>';
  const valid = parseXml(text, 'Authored.xml');
  assert.doesNotThrow(() => verifyXmlSyntax(valid, text, 'Authored.xml'));
  for (const change of [p => p.elements[0].attributes.length = 0, p => p.elements[1].attributes.length = 0,
    p => p.elements.splice(1, 1), p => p.text.pop(), p => p.text[0].parentIndex = 0]) {
    const changed = structuredClone(valid); change(changed);
    assert.throws(() => verifyXmlSyntax(changed, text, 'Authored.xml'));
  }
});

test('a validated backend failure can confirm a direct API attempt without inventing a syntax result', async () => {
  const calls = emptyGraphCalls(); calls.analyzeLua.invoked = 1;
  const transport = fake((child, input) => finish(child, {id: input.id, result: null, confirmedApiCalls: calls, failure: 'backend'}));
  const client = createGraphAnalyzer(transport);
  try {
    await assert.rejects(client.analyze(request('lua', 'Out=1')), error => error.message === 'graph-analysis-backend' &&
      assert.deepEqual(error.confirmedApiCalls, calls) === undefined);
  } finally {await client.close();}
});

test('TOC leading filename spaces, BOM, directives and SavedVariables scopes retain actual semantics', async () => {
  const input = request('toc', '\uFEFF## SavedVariables[AllowLoadGameType vanilla]: One, Ou[AllowLoad yes]t\r\n## SavedVariablesPerCharacter: Character\r\n File.lua\r\n## unsupported heading');
  const client = createGraphAnalyzer();
  try {
    const reply = await client.analyze(input);
    assert.equal(reply.result.parsed.metadata.fileEntries[0].path, ' File.lua');
    for (const alter of [p => p.result.parsed.metadata.savedVariableDeclarations[0].scope = 'character',
      p => p.result.parsed.metadata.savedVariableDeclarations[0].conditions = [],
      p => p.result.parsed.metadata.tocSuffix = 'Vanilla']) {
      const changed = {...structuredClone(reply), failure: null}; alter(changed);
      assert.throws(() => verifyGraphAnalysisReply(changed, input));
    }
  } finally {await client.close();}
});

test('inherited inline condition/value/source copies consume the per-file retained-record cap', () => {
  const input = request('xml', '', [{...condition(), values: []}]);
  for (const count of [10000, 10001]) {
    const text = `<Ui><Script>${'Out=1;'.repeat(count)}</Script></Ui>`;
    const syntax = parseXml(text, input.sourcePath), association = {addonId: input.addonId, conditions: input.conditions};
    const provider = analyzeXml(text, input.sourcePath, {...association, policy: input.xmlPolicy});
    const inline = composeXmlInlineLua(text, input.sourcePath, syntax, provider,
      {policy: input.xmlPolicy, profile: input.inlineProfile, fileOrdinal: 0, association}, analyzeLua, mapXmlValueRanges);
    assert.equal(inline.status, count === 10000 ? 'completed' : 'resource');
    if (count === 10000) assert.equal(verifyXmlInlineLua(inline, text, input.sourcePath, syntax, provider,
      input.xmlPolicy, input.inlineProfile, 0, association).metrics.declarations, count);
    else assert.deepEqual(inline.bodies, []);
  }
});

test('corpus Lua accepts more than the inline-only 50000 declaration cap', async () => {
  const input = request('lua', 'Out=1;'.repeat(50001)); input.luaProfile = 'corpus';
  const client = createGraphAnalyzer();
  try {
    const reply = await client.analyze(input);
    assert.equal(reply.result.result.declarations.length, 50001);
    assert.deepEqual(reply.confirmedApiCalls, receipts('analyzeLua'));
  } finally {await client.close();}
});

test('TOC diagnostic state and CSV/custom aliases are independently complete', async () => {
  const content = '## invalid heading\n##\n## SavedVariables: Good,,end,Good\n## SavedVariablesPerCharacter: Good\n## Interface: 11508,, 11509\n## DepSomething: Core, Core\n## RequiredDeps: Other\n## OptionalDeps: Optional\n## X-Embeds: One, Two\n## x-EMBEDS: Three\n## Embed: Custom\n## Title[Unsupported yes]: Invalid\nCore.lua [Bootstrap]\nCore.lua [Bootſtrap]\n';
  const input = request('toc', content), client = createGraphAnalyzer();
  try {
    const output = await client.analyze(input);
    const reply = {...output, failure: null};
    assert.ok(reply.result.parsed.diagnostics.some(row => row.code === 'TOC0001'));
    reply.result.parsed.diagnostics = [];
    assert.throws(() => verifyGraphAnalysisReply(reply, input));
  } finally {await client.close();}
});

test('XML entity targets cannot be reclassified as literal filename text', () => {
  const text = '<Ui><Script file="Dir&#x2f;Other.lua"/></Ui>', valid = parseXml(text, 'Authored.xml');
  assert.doesNotThrow(() => verifyXmlSyntax(valid, text, 'Authored.xml'));
  const value = valid.elements[1].attributes[0].value;
  value.value = 'Dir&#x2f;Other.lua'; value.mappings = [{decodedStart: 0, decodedEnd: value.value.length, kind: 'literal', source: value.source}];
  assert.throws(() => verifyXmlSyntax(valid, text, 'Authored.xml'));
});

test('interleaved failed XML receipts and provider inherited-record amplification are bounded', () => {
  const input = request('xml', '<Ui/>'), calls = receipts('parseXml', 'analyzeXml', 'analyzeLua');
  calls.mapXmlValueRanges.invoked = 1;
  const failed = {result: null, failure: 'backend', confirmedApiCalls: calls};
  assert.equal(verifyGraphAnalysisReply(failed, input).failure, 'backend');
  calls.analyzeLua = {invoked: 2, returned: 2};
  assert.throws(() => verifyGraphAnalysisReply(failed, input));
  const association = {addonId: input.addonId, conditions: Array.from({length: 256}, condition)};
  for (const count of [10, 65, 100]) {
    const text = '<Ui>' + '<Frame name="Authored"/>'.repeat(count) + '</Ui>', syntax = parseXml(text, input.sourcePath);
    const provider = analyzeXml(text, input.sourcePath, {addonId: input.addonId, policy: input.xmlPolicy});
    for (const declaration of provider.declarations) declaration.conditions = structuredClone(association.conditions);
    if (count === 100) assert.throws(() => verifyXmlProvider(provider, syntax, text, input.sourcePath, input.xmlPolicy, association));
    else {
      assert.equal(analyzeXml(text, input.sourcePath, {...association, policy: input.xmlPolicy}).complete, true);
      assert.equal(verifyXmlProvider(provider, syntax, text, input.sourcePath, input.xmlPolicy, association).outcome, 'validated');
    }
  }
});
