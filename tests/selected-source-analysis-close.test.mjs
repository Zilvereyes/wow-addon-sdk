import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {PassThrough, Writable} from 'node:stream';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';

const json = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const request = () => ({language: 'lua', content: 'Authored=1', sourcePath: 'Authored/Source.lua',
  addonId: 'authored-close-fixture', conditions: [], luaProfile: 'bounded', allowShebang: false,
  xmlPolicy: json('../examples/xml-provider-profile.json').policy,
  inlineProfile: json('../examples/xml-inline-lua-profile.json')});

async function acknowledgeCloseAt(milliseconds, timely) {
  let clock = 0, child, acknowledgeRequest;
  const written = new Promise(resolve => {acknowledgeRequest = resolve;});
  const launches = [];
  const client = createGraphAnalyzer({now: () => clock, spawnProcess() {
    child = new EventEmitter(); child.exitCode = child.signalCode = null;
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({write(_chunk, _encoding, done) {acknowledgeRequest(); done();}});
    child.kill = signal => {child.signalCode = signal; return true;};
    launches.push(child); return child;
  }});
  try {
    const pending = assert.rejects(client.analyze(request()), /graph-analysis-closed/u);
    await written;
    const closing = client.close();
    const outcome = timely ? closing : assert.rejects(closing, /graph-analysis-reap/u);
    assert.equal(child.signalCode, 'SIGKILL');
    // Deliver the acknowledgement synchronously after moving monotonic time.
    // No timer callback can run between close() and this owned child's event.
    clock = milliseconds;
    child.emit('close', null);
    await outcome; await pending;
    assert.equal(launches.length, 1);
  } finally {
    child?.emit('close', null);
    await client.close();
  }
}

test('graph analyzer accepts close acknowledged before its ten-second reap deadline', async () => {
  await acknowledgeCloseAt(9999, true);
});

for (const milliseconds of [10000, 10001]) {
  test(`graph analyzer rejects close acknowledged at ${milliseconds}ms before an overdue timer callback`, async () => {
    await acknowledgeCloseAt(milliseconds, false);
  });
}
