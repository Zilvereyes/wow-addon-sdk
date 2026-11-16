import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createLuaParserThread } from '../scripts/lua-parser-thread-client.mjs';

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

test('corpus worker runs real SDK above default depth with an eight-MiB parser thread stack', async () => {
  const client = create({ profile: 'corpus' });
  try {
    const content = '#!fixture\r\nDB = ' + '{ key = '.repeat(300) + '1' + ' }'.repeat(300);
    const result = await client.analyze({ ...request(content), options: { addonId: 'caller', profile: 'corpus', allowShebang: true } });
    assert.equal(result.complete, true);
    assert.equal(result.declarations[0].name, 'DB');
    assert.equal((await client.analyze(request('After = 1'))).declarations[0].name, 'After');
  } finally { await client.close(); }
});

test('worker profile limits are explicit and cannot be raised beyond their named bounds', () => {
  assert.throws(() => create({ profile: 'unbounded' }), RangeError);
  assert.throws(() => create({ profile: 'bounded', timeoutMs: 10001 }), RangeError);
  assert.throws(() => create({ profile: 'corpus', timeoutMs: 60001 }), RangeError);
  assert.throws(() => create({ profile: 'corpus', maxOutputBytes: 128 * 1024 * 1024 + 1 }), RangeError);
});

test('parser thread native heap exhaustion is an explicit failure and is reaped', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-lua-thread-'));
  let parser;
  try {
    const file = path.join(root, 'heap.mjs');
    // At most ~52 MiB even if an externally configured V8 limit overrides 8.
    // The ordinary test runtime must terminate this isolate below that bound.
    fs.writeFileSync(file, `import { parentPort } from 'node:worker_threads';
      parentPort.on('message', request => {
        const chunks = [];
        for (let i=0;i<64;i++) chunks.push(Array(100000).fill(i));
        parentPort.postMessage({id:request.id,result:{schemaVersion:1,complete:true,declarations:[],diagnostics:[]}});
      });`);
    parser = createLuaParserThread({ workerPath: file, maxOldGenerationSizeMb: 8 });
    await assert.rejects(parser.analyze(request('not executed')), /lua-parser-thread-failed/);
    await assert.rejects(parser.analyze(request('after failure')), /lua-parser-thread-failed/);
  } finally { await parser?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('corpus supervisor deadlines and crashes stay explicit under the larger preset', async () => {
  await fixture('process.stdin.resume();', { profile: 'corpus', timeoutMs: 100 }, async client => {
    await assert.rejects(client.analyze(request('not executed')), /lua-worker-timeout/);
  });
  await fixture('process.exit(7);', { profile: 'corpus' }, async client => {
    await assert.rejects(client.analyze(request('not executed')), /lua-worker-exit/);
  });
});

test('corpus replacement waits for the failed child close event before starting its successor', async () => {
  // Model delayed OS close deterministically; native worker/heap/deadline tests
  // above separately exercise real processes. No timer or orphan grandchild.
  const launches = [];
  let releaseFirst = () => {};
  const spawnProcess = () => {
    const child = new EventEmitter();
    const first = launches.length === 0;
    child.exitCode = null; child.signalCode = null;
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(chunk, encoding, callback) {
      const request = JSON.parse(chunk.toString());
      child.stdout.write(first ? 'invalid-json\n' : JSON.stringify({ id: request.id,
        result: { schemaVersion: 1, complete: true, declarations: [], diagnostics: [] } }) + '\n');
      callback();
    } });
    child.kill = () => {
      child.signalCode = 'SIGKILL';
      if (!first) child.emit('close');
    };
    if (first) releaseFirst = () => child.emit('close');
    launches.push(child);
    return child;
  };
  const client = create({ profile: 'corpus', spawnProcess });
  try {
    await assert.rejects(client.analyze(request('first')), /lua-worker-protocol/);
    const next = client.analyze(request('second'));
    next.catch(() => {});
    assert.equal(launches.length, 1);
    await assert.rejects(client.analyze(request('overlapping restart')), /lua-worker-busy/);
    releaseFirst();
    assert.equal((await next).complete, true);
    assert.equal(launches.length, 2);
  } finally { releaseFirst(); await client.close(); }
});
