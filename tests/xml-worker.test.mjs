import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createXmlWorker } from '../scripts/xml-worker-client.mjs';

const request = content => ({ content, sourcePath: 'Å\\Original.xml' });
const emptyResult = () => ({ schemaVersion: 1, complete: true, elements: [], text: [], diagnostics: [] });
async function fixture(source, options, action) {
  const temporary = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, 'wow-xml-worker-'));
  let client;
  try {
    const file = path.join(root, 'fixture.mjs');
    fs.writeFileSync(file, source);
    client = createXmlWorker({ ...options, workerPath: file });
    await action(client);
  } finally {
    await client?.close();
    // Only delete this test-created directory directly beneath the verified
    // temporary root; no input path or filesystem enumeration selects cleanup.
    assert.equal(path.dirname(path.resolve(root)), temporary);
    assert.ok(path.basename(root).startsWith('wow-xml-worker-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function fakeSpawner(onRequest, { delayedFirstClose = false, writeFailure = false } = {}) {
  const launches = [];
  const spawnProcess = (executable, args, options) => {
    const child = new EventEmitter();
    const index = launches.length;
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new Writable({ write(chunk, encoding, callback) {
      if (writeFailure) { callback(new Error('PRIVATE_WRITE_DETAIL')); return; }
      onRequest(child, JSON.parse(chunk.toString()), index);
      callback();
    } });
    child.kill = signal => {
      child.signalCode = signal;
      if (!delayedFirstClose || index !== 0) child.emit('close');
      return true;
    };
    launches.push({ child, executable, args, options });
    return child;
  };
  return { launches, spawnProcess, releaseFirst: () => launches[0]?.child.emit('close') };
}
const reply = (child, message, result = emptyResult()) => child.stdout.write(JSON.stringify({ id: message.id, result }) + '\n');

test('XML worker invokes the actual SDK, preserves paths and reuses the process across syntax/profile failures', async () => {
  const client = createXmlWorker();
  try {
    const valid = await client.analyze(request('<r a="&amp;">🧪</r>'));
    assert.equal(valid.complete, true);
    assert.equal(valid.elements[0].name.qualifiedName, 'r');
    assert.equal(valid.elements[0].source.file, 'Å\\Original.xml');
    assert.equal(valid.elements[0].attributes[0].value.value, '&');
    assert.equal(valid.text[0].value.value, '🧪');
    for (const input of ['<r><c></r>', '<!DOCTYPE r SYSTEM "file:///never-read"><r/>', '<?xml version="1.1"?><r/>']) {
      const invalid = await client.analyze(request(input));
      assert.equal(invalid.complete, false);
      assert.deepEqual(invalid.elements, []);
      assert.deepEqual(invalid.text, []);
      assert.ok(invalid.diagnostics.length > 0);
      assert.deepEqual(await client.analyze(request('<r a="&amp;">🧪</r>')), valid);
    }
    const data = await client.analyze(request('<r><![CDATA[process.exit(99); error("MUST_NOT_EXECUTE")]]></r>'));
    assert.equal(data.complete, true);
    assert.equal(data.text[0].value.value, 'process.exit(99); error("MUST_NOT_EXECUTE")');
    const namespace = await client.analyze({ ...request('<p:r/>'), options: { namespaceAware: false } });
    assert.equal(namespace.complete, true);
    assert.equal(namespace.elements[0].name.localName, 'p:r');
  } finally { await client.close(); }
  await assert.rejects(client.analyze(request('<r/>')), /xml-worker-closed/);
  await client.close();
});

test('fixed worker launch uses the host executable, 256 MiB heap, private path, no shell and a sanitized environment', async () => {
  const original = Object.fromEntries(['NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'NODE_V8_COVERAGE'].map(key => [key, process.env[key]]));
  const seam = fakeSpawner((child, message) => reply(child, message));
  let client;
  try {
    process.env.NODE_OPTIONS = '--require=PRIVATE_MARKER';
    process.env.NODE_TEST_CONTEXT = 'PRIVATE_MARKER';
    process.env.NODE_V8_COVERAGE = 'PRIVATE_MARKER';
    client = createXmlWorker({ spawnProcess: seam.spawnProcess });
    await client.analyze({ ...request('<r/>'), workerPath: 'PRIVATE_MARKER', heap: 999999, timeoutMs: 999999 });
    await client.analyze(request('<s/>'));
    assert.equal(seam.launches.length, 1, 'valid requests reuse the same child');
    const launch = seam.launches[0];
    assert.equal(launch.executable, process.execPath);
    assert.equal(launch.args.length, 2);
    assert.equal(launch.args[0], '--max-old-space-size=256');
    assert.equal(path.basename(launch.args[1]), 'xml-analysis-worker.mjs');
    assert.ok(path.isAbsolute(launch.args[1]));
    assert.equal(launch.options.shell, false);
    assert.equal(launch.options.windowsHide, true);
    assert.deepEqual(launch.options.stdio, ['pipe', 'pipe', 'pipe']);
    for (const key of Object.keys(original)) assert.equal(Object.hasOwn(launch.options.env, key), false);
    assert.doesNotMatch(JSON.stringify(launch.args), /PRIVATE_MARKER/);
  } finally {
    await client?.close();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('internal worker limits cannot exceed the fixed deadline/output preset', () => {
  for (const timeoutMs of [0, -1, 10001, 1.5, NaN, Infinity, '100']) assert.throws(() => createXmlWorker({ timeoutMs }), RangeError);
  for (const maxOutputBytes of [0, -1, 32 * 1024 * 1024 + 1, 1.5, NaN, Infinity, '100']) {
    assert.throws(() => createXmlWorker({ maxOutputBytes }), RangeError);
  }
});

test('native XML worker deadline rejects an unresponsive child and close reaps it', async () => {
  await fixture('process.stdin.resume();', { timeoutMs: 100 }, async client => {
    await assert.rejects(client.analyze(request('PRIVATE_SOURCE')), error => {
      assert.equal(error.message, 'xml-worker-timeout');
      return true;
    });
  });
});

test('native XML worker crash is an explicit failure rather than empty parsing success', async () => {
  await fixture('process.exit(7);', {}, async client => {
    await assert.rejects(client.analyze(request('PRIVATE_SOURCE')), error => {
      assert.equal(error.message, 'xml-worker-exit');
      return true;
    });
  });
});

test('native worker replies require exact correlation, JSON framing and XML result shape', async () => {
  const variants = [
    '"not-json\\n"',
    'JSON.stringify({id:-1,result:{schemaVersion:1,complete:true,elements:[],text:[],diagnostics:[]}})+"\\n"',
    'JSON.stringify({id:request.id,result:{schemaVersion:2,complete:true,elements:[],text:[],diagnostics:[]}})+"\\n"',
    'JSON.stringify({id:request.id,result:{schemaVersion:1,complete:"true",elements:[],text:[],diagnostics:[]}})+"\\n"',
    'JSON.stringify({id:request.id,result:{schemaVersion:1,complete:true,elements:{},text:[],diagnostics:[]}})+"\\n"',
    'JSON.stringify({id:request.id,result:{schemaVersion:1,complete:true,elements:[],text:{},diagnostics:[]}})+"\\n"',
    'JSON.stringify({id:request.id,result:{schemaVersion:1,complete:true,elements:[],text:[],diagnostics:{}}})+"\\n"',
    'JSON.stringify({id:request.id,result:{schemaVersion:1,complete:true,elements:[],text:[],diagnostics:[]}})+"\\nextra\\n"',
  ];
  for (const expression of variants) {
    const source = `import { createInterface } from 'node:readline';
      const input = createInterface({input:process.stdin});
      input.on('line', line => { const request = JSON.parse(line); process.stdout.write(${expression}); });`;
    await fixture(source, {}, async client => {
      await assert.rejects(client.analyze(request('PRIVATE_SOURCE')), /xml-worker-protocol/);
    });
  }
});

test('native output is capped by UTF-8 bytes independently of its heap and JSON framing', async () => {
  // 300 astral characters occupy 600 UTF-16 units but 1,200 UTF-8 bytes.
  await fixture("process.stdin.on('data', () => process.stdout.write('🧪'.repeat(300)));", { maxOutputBytes: 1024 }, async client => {
    await assert.rejects(client.analyze(request('PRIVATE_SOURCE')), /xml-worker-output-limit/);
  });
});

test('native worker refuses concurrent requests and closes an outstanding request explicitly', async () => {
  const client = createXmlWorker();
  try {
    const first = client.analyze(request('<r/>'));
    await assert.rejects(client.analyze(request('<s/>')), /xml-worker-busy/);
    assert.equal((await first).elements[0].name.qualifiedName, 'r');
  } finally { await client.close(); }
  await fixture('process.stdin.resume();', {}, async hung => {
    const pending = assert.rejects(hung.analyze(request('PRIVATE_SOURCE')), /xml-worker-closed/);
    await hung.close();
    await pending;
    await assert.rejects(hung.analyze(request('<r/>')), /xml-worker-closed/);
  });
});

test('worker replacement waits for close/reap before spawning a successor', async () => {
  const seam = fakeSpawner((child, message, index) => {
    if (index === 0) child.stdout.write('invalid-json\n'); else reply(child, message);
  }, { delayedFirstClose: true });
  const client = createXmlWorker({ spawnProcess: seam.spawnProcess });
  try {
    await assert.rejects(client.analyze(request('first')), /xml-worker-protocol/);
    const next = client.analyze(request('second'));
    next.catch(() => {});
    assert.equal(seam.launches.length, 1, 'kill alone must not start a second child');
    await assert.rejects(client.analyze(request('overlapping restart')), /xml-worker-busy/);
    seam.releaseFirst();
    assert.deepEqual(await next, emptyResult());
    assert.equal(seam.launches.length, 2);
  } finally { seam.releaseFirst(); await client.close(); }
});

test('close during replacement prevents a successor after the failed child is reaped', async () => {
  const seam = fakeSpawner(child => child.stdout.write('invalid-json\n'), { delayedFirstClose: true });
  const client = createXmlWorker({ spawnProcess: seam.spawnProcess });
  try {
    await assert.rejects(client.analyze(request('first')), /xml-worker-protocol/);
    const pending = assert.rejects(client.analyze(request('replacement')), /xml-worker-closed/);
    const closing = client.close();
    assert.equal(seam.launches.length, 1);
    seam.releaseFirst();
    await closing;
    await pending;
    assert.equal(seam.launches.length, 1);
  } finally { seam.releaseFirst(); await client.close(); }
});

test('spawn and write failures remain fixed operational errors without source or backend details', async () => {
  const unavailable = createXmlWorker({ spawnProcess() { throw new Error('PRIVATE_START_DETAIL'); } });
  try { await assert.rejects(unavailable.analyze(request('PRIVATE_SOURCE')), error => error.message === 'xml-worker-start'); }
  finally { await unavailable.close(); }
  const seam = fakeSpawner(() => {}, { writeFailure: true });
  const client = createXmlWorker({ spawnProcess: seam.spawnProcess });
  try { await assert.rejects(client.analyze(request('PRIVATE_SOURCE')), error => error.message === 'xml-worker-write'); }
  finally { await client.close(); }
});

test('the output counter resets per complete request while correlation continues across reuse', async () => {
  const identifiers = [];
  const seam = fakeSpawner((child, message) => { identifiers.push(message.id); reply(child, message); });
  const client = createXmlWorker({ spawnProcess: seam.spawnProcess, maxOutputBytes: 150 });
  try {
    for (let i = 0; i < 5; i++) assert.deepEqual(await client.analyze(request('<r/>')), emptyResult());
    assert.deepEqual(identifiers, [1, 2, 3, 4, 5]);
    assert.equal(seam.launches.length, 1);
  } finally { await client.close(); }
});
