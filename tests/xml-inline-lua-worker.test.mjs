import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createXmlWorker } from '../scripts/xml-worker-client.mjs';

const name = localName => ({ namespaceUri: null, localName });
const policy = { roots: [name('Ui')], frameElements: [name('Frame')], includeElements: [],
  scriptElements: [name('Script')], handlerContainers: [name('Scripts')], handlerElements: [name('OnLoad'), name('OnEvent')] };
const profile = { schemaVersion: 1, chunkContext: { kind: 'chunk' }, handlers: [
  { element: name('OnLoad'), context: { kind: 'function-body', parameters: ['self', 'event'], variadic: false } },
] };
const request = content => ({ content, sourcePath: 'Å\\Original.xml',
  providerOptions: { addonId: 'corpus-xml', policy }, inlineOptions: { profile, fileOrdinal: 7 } });

test('inline worker invokes contextual Lua and returns separate ordered disjoint original sidecars', async () => {
  const client = createXmlWorker();
  const content = '<Ui><Script>Pub<!--gap-->lic=1</Script><Frame><Scripts>' +
    '<OnLoad>self=1; event=2; Handler=3</OnLoad><OnEvent>mustNotBeParsed=1</OnEvent></Scripts></Frame></Ui>';
  try {
    const response = await client.analyze(request(content));
    assert.equal(response.syntax.complete, true); assert.equal(response.provider.result.complete, true);
    assert.equal(response.inlineLua.schemaVersion, 1); assert.equal(response.inlineLua.status, 'completed');
    assert.equal(response.inlineLua.bodies.length, 3);
    const [chunk, handler, missing] = response.inlineLua.bodies;
    assert.equal(chunk.kind, 'chunk'); assert.equal(chunk.status, 'analyzed');
    assert.equal(chunk.decodedSourcePath, 'decoded:xml-inline:7:0');
    assert.equal(chunk.analysis.complete, true); assert.deepEqual(chunk.analysis.declarations.map(d => d.name), ['Public']);
    assert.equal(chunk.analysis.declarations[0].source.file, chunk.decodedSourcePath);
    assert.equal(chunk.mapping.complete, true); assert.equal(chunk.mapping.mappings.length, 1);
    assert.deepEqual(chunk.mapping.mappings[0].parts.map(part => part.source.range), [
      { start: { line: 0, column: 12 }, end: { line: 0, column: 15 } },
      { start: { line: 0, column: 25 }, end: { line: 0, column: 28 } },
    ]);
    assert.ok(chunk.mapping.mappings[0].parts.every(part => part.source.file === 'Å\\Original.xml'));
    assert.equal(handler.kind, 'handler'); assert.equal(handler.decodedSourcePath, 'decoded:xml-inline:7:1');
    assert.deepEqual(handler.analysis.declarations.map(d => [d.name, d.activationState]), [['Handler', 'unknown']]);
    assert.equal(handler.mapping.complete, true);
    assert.equal(missing.status, 'missing-context'); assert.equal(missing.analysis, null); assert.equal(missing.mapping, null);
    assert.deepEqual(JSON.parse(JSON.stringify(response)), response);
    const providerOnly = await client.analyze({ content: '<Ui/>', sourcePath: 'Original.xml', providerOptions: { addonId: 'corpus-xml', policy } });
    assert.equal(Object.hasOwn(providerOnly, 'inlineLua'), false);
    const parserOnly = await client.analyze({ content: '<r/>', sourcePath: 'Original.xml' });
    assert.equal(parserOnly.complete, true); assert.equal(Object.hasOwn(parserOnly, 'inlineLua'), false);
  } finally { await client.close(); }
});

test('inline worker preserves a completed syntax rejection and skips all bodies after XML rejection', async () => {
  const client = createXmlWorker();
  try {
    const luaRejected = await client.analyze(request('<Ui><Frame><Scripts><OnLoad>return ...</OnLoad></Scripts></Frame></Ui>'));
    assert.equal(luaRejected.inlineLua.status, 'completed');
    const body = luaRejected.inlineLua.bodies[0];
    assert.equal(body.analysis.complete, false); assert.deepEqual(body.analysis.declarations, []);
    assert.equal(body.analysis.diagnostics[0].code, 'LUA0002');
    assert.equal(body.mapping.complete, true); assert.equal(body.mapping.mappings.length, 1);
    const xmlRejected = await client.analyze(request('<Ui><Frame></Ui>'));
    assert.equal(xmlRejected.syntax.complete, false);
    assert.equal(xmlRejected.inlineLua.status, 'rejected-before-inline'); assert.deepEqual(xmlRejected.inlineLua.bodies, []);
  } finally { await client.close(); }
});

const emptySyntax = () => ({ schemaVersion: 1, complete: true, elements: [], text: [], diagnostics: [] });
const emptyProvider = () => ({ schemaVersion: 1, complete: true, frames: [], references: [], scripts: [], declarations: [], diagnostics: [] });
function spawner(makeReply) {
  const launches = [];
  return { launches, spawnProcess(executable, args, options) {
    const child = new EventEmitter(); child.exitCode = null; child.signalCode = null;
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(chunk, _encoding, callback) {
      const message = JSON.parse(chunk.toString());
      child.stdout.write(JSON.stringify(makeReply(message)) + '\n'); callback();
    } });
    child.kill = signal => { child.signalCode = signal; child.emit('close'); return true; };
    launches.push({ executable, args, options }); return child;
  } };
}

test('inline envelope is exact, correlated and cannot select a different worker or supervision limits', async () => {
  const inlineLua = { schemaVersion: 1, status: 'completed', bodies: [] };
  const seam = spawner(message => ({ id: message.id, result: emptySyntax(),
    provider: { attempted: true, result: emptyProvider() }, inlineLua }));
  const client = createXmlWorker({ spawnProcess: seam.spawnProcess });
  try {
    const result = await client.analyze({ ...request('<Ui/>'), workerPath: 'PRIVATE_PATH', timeoutMs: 999999, heap: 999999 });
    assert.deepEqual(result.inlineLua, inlineLua);
    assert.equal(seam.launches[0].executable, process.execPath);
    assert.equal(seam.launches[0].args[0], '--max-old-space-size=256');
    assert.equal(path.basename(seam.launches[0].args[1]), 'xml-analysis-worker.mjs');
    assert.equal(seam.launches[0].options.shell, false); assert.equal(seam.launches[0].options.windowsHide, true);
  } finally { await client.close(); }
  for (const invalid of [undefined, {}, { ...inlineLua, schemaVersion: 2 }, { ...inlineLua, bodies: {} },
    { ...inlineLua, status: 'PRIVATE_UNKNOWN_STATUS' }, { ...inlineLua, extra: true }]) {
    const broken = spawner(message => ({ id: message.id, result: emptySyntax(), provider: { attempted: true, result: emptyProvider() }, inlineLua: invalid }));
    const malformed = createXmlWorker({ spawnProcess: broken.spawnProcess });
    try { await assert.rejects(malformed.analyze(request('<Ui/>')), /xml-worker-protocol/); }
    finally { await malformed.close(); }
  }
});

test('a native unsolicited inline envelope cannot silently change the provider-only protocol', async () => {
  const temporary = path.resolve(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'wow-inline-worker-'));
  let client;
  try {
    const workerPath = path.join(root, 'authored-worker.mjs');
    fs.writeFileSync(workerPath, `import { createInterface } from 'node:readline';
createInterface({input:process.stdin}).on('line', line => {
 const request=JSON.parse(line); process.stdout.write(JSON.stringify({id:request.id,
 result:${JSON.stringify(emptySyntax())},provider:{attempted:true,result:${JSON.stringify(emptyProvider())}},
 inlineLua:{schemaVersion:1,status:'completed',bodies:[]}})+'\\n');
});`);
    client = createXmlWorker({ workerPath });
    await assert.rejects(client.analyze({ content: '<Ui/>', sourcePath: 'Original.xml', providerOptions: { addonId: 'corpus-xml', policy } }), /xml-worker-protocol/);
  } finally {
    await client?.close();
    assert.equal(path.dirname(path.resolve(root)), temporary); assert.ok(path.basename(root).startsWith('wow-inline-worker-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
