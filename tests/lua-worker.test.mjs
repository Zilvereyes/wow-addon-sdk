import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let module;
try { module = await import('../scripts/lua-worker-client.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const request = content => ({ content, sourcePath: 'Å/Fixture.lua', options: { addonId: 'caller' } });
function create(options) {
  assert.equal(typeof module?.createLuaWorker, 'function', 'bounded Lua worker client is absent');
  return module.createLuaWorker(options);
}
async function fixture(source, options, action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-lua-worker-'));
  let client;
  try {
    const file = path.join(root, 'fixture.mjs'); fs.writeFileSync(file, source);
    client = create({ ...options, workerPath: file });
    await action(client);
  } finally {
    await client?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('persistent worker calls the actual SDK and survives ordinary syntax errors', async () => {
  const client = create();
  try {
    const first = await client.analyze(request('DB = 1'));
    assert.equal(first.complete, true);
    assert.equal(first.declarations[0].name, 'DB');
    assert.equal(first.declarations[0].source.file, 'Å/Fixture.lua');
    const invalid = await client.analyze(request('Broken ='));
    assert.equal(invalid.diagnostics[0].code, 'LUA0002');
    assert.equal((await client.analyze(request('After = 1'))).declarations[0].name, 'After');
  } finally { await client.close(); }
  await assert.rejects(client.analyze(request('DB = 1')), /lua-worker-closed/);
});

test('worker deadline rejects an unresponsive child and close reaps it', async () => {
  await fixture('process.stdin.resume();', { timeoutMs: 100 }, async client => {
    await assert.rejects(client.analyze(request('private-marker')), /lua-worker-timeout/);
  });
});

test('worker crash is explicit and never converted into empty success', async () => {
  await fixture('process.exit(7);', {}, async client => {
    await assert.rejects(client.analyze(request('private-marker')), /lua-worker-exit/);
  });
});

test('worker replies must match the exact request correlation and result shape', async () => {
  await fixture("process.stdin.on('data', () => process.stdout.write(JSON.stringify({id:-1,result:{}})+'\\n'));", {}, async client => {
    await assert.rejects(client.analyze(request('private-marker')), /lua-worker-protocol/);
  });
});

test('worker output is bounded independently of its heap', async () => {
  await fixture("process.stdin.on('data', () => process.stdout.write('x'.repeat(2048)));", { maxOutputBytes: 1024 }, async client => {
    await assert.rejects(client.analyze(request('private-marker')), /lua-worker-output-limit/);
  });
});

test('one worker refuses overlapping requests rather than mixing results', async () => {
  const client = create();
  try {
    const first = client.analyze(request('First = 1'));
    await assert.rejects(client.analyze(request('Second = 1')), /lua-worker-busy/);
    assert.equal((await first).declarations[0].name, 'First');
  } finally { await client.close(); }
});
