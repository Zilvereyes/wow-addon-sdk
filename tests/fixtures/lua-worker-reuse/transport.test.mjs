import assert from 'node:assert/strict';
import {EventEmitter, once} from 'node:events';
import {readFileSync} from 'node:fs';
import {PassThrough, Writable} from 'node:stream';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {emptyGraphCalls} from '../../../scripts/selected-source-analysis-receipts.mjs';
import {prepareExperiment} from './prepare.mjs';

const profile = filename => JSON.parse(readFileSync(new URL('../../../examples/' + filename, import.meta.url), 'utf8'));
const xmlPolicy = profile('xml-provider-profile.json').policy;
const inlineProfile = profile('xml-inline-lua-profile.json');
function request(number) {
  return {language: 'lua', content: 'Authored' + number + ' = "😀"',
    sourcePath: 'Authored/Fixture' + number + '.lua', addonId: 'authored-deadline', conditions: [],
    luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile};
}

function expected(input) {
  const confirmedApiCalls = emptyGraphCalls();
  confirmedApiCalls.analyzeLua = {invoked: 1, returned: 1};
  const result = analyzeLua(input.content, input.sourcePath, {addonId: input.addonId,
    conditions: input.conditions, profile: input.luaProfile, allowShebang: input.allowShebang,
    context: {kind: 'chunk'}});
  return {result: {language: 'lua', result}, confirmedApiCalls};
}

function frame(input) {
  return Buffer.from(JSON.stringify({id: input.id, ...expected(input), failure: null}) + '\n');
}

test('a frame at the outer deadline earns no receipt and replacement waits for acknowledged child close',
  {timeout: 15000}, async () => {
    const {createCandidate, cleanup} = await prepareExperiment();
    const launches = [], written = new EventEmitter();
    let now = 100;
    const client = createCandidate({now: () => now, timeoutMs: 3000, spawnProcess() {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.exitCode = child.signalCode = null;
      const state = {child, writes: [], signals: [], closed: false, acknowledge() {
        if (state.closed) return;
        state.closed = true;
        child.exitCode = child.signalCode === null ? 0 : null;
        child.emit('close', child.exitCode, child.signalCode);
      }};
      child.stdin = new Writable({write(chunk, _encoding, done) {
        const input = JSON.parse(chunk.toString());
        state.writes.push(input);
        done();
        written.emit('request', state, input);
      }});
      child.kill = signal => { state.signals.push(signal); child.signalCode = signal; return true; };
      launches.push(state);
      return child;
    }});

    try {
      const firstWritten = once(written, 'request');
      const expired = assert.rejects(client.analyze(request(1), 1000), error => {
        assert.equal(error.message, 'graph-analysis-timeout');
        assert.equal(Object.hasOwn(error, 'confirmedApiCalls'), false);
        return true;
      });
      const [old, oldInput] = await firstWritten;
      // Advance only the injected clock. This frame is handled before the wall timer fires.
      now = 1100;
      old.child.stdout.write(frame(oldInput));
      await expired;
      assert.deepEqual(old.signals, ['SIGKILL']);
      assert.equal(old.closed, false);

      const secondWritten = once(written, 'request');
      const following = request(2);
      const recovery = client.analyze(following, 1000);
      void recovery.catch(() => {});
      await setImmediate();
      assert.equal(launches.length, 1);
      assert.equal(old.writes.length, 1);
      old.child.stdout.write(frame(oldInput));
      old.acknowledge();

      const [replacement, newInput] = await secondWritten;
      assert.equal(launches.length, 2);
      assert.equal(newInput.id, oldInput.id + 1);
      old.child.stdout.write(frame(oldInput));
      replacement.child.stdout.write(frame(newInput));
      assert.deepEqual(await recovery, expected(following));
    } finally {
      try {
        const closing = client.close();
        for (const state of launches) state.acknowledge();
        await closing;
      } finally { await cleanup(); }
    }
  });
