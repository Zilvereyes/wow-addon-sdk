import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readBoundedFile } from '../scripts/read-bounded-file.mjs';

// Every mutation below targets a file authored directly inside this fixture.
// No discovered path, installation path or external source selects a write.
function fixture(run) {
  const temporary = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, 'wow-sdk-bounded-read-'));
  try { run(root); }
  finally {
    assert.equal(path.dirname(path.resolve(root)), temporary);
    assert.ok(path.basename(root).startsWith('wow-sdk-bounded-read-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const changed = error => error.code === 'bounded-read-changed';

function observe(filename, initialSize, maximumBytes, hooks = {}) {
  const opened = [], closed = [], reads = [];
  const io = {
    ...fs,
    openSync(candidate, flags, ...rest) {
      assert.equal(candidate, filename);
      if (typeof flags === 'number') {
        assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_APPEND |
          fs.constants.O_TRUNC | fs.constants.O_CREAT), 0, 'source must be opened read-only');
        if (fs.constants.O_NOFOLLOW) assert.ok(flags & fs.constants.O_NOFOLLOW, 'final component must not be followed');
      } else assert.equal(flags, 'r');
      hooks.beforeOpen?.();
      const fd = fs.openSync(candidate, flags, ...rest);
      opened.push(fd);
      return fd;
    },
    readSync(fd, buffer, offset, length, position) {
      assert.ok(opened.includes(fd), 'read must use the owned descriptor');
      assert.ok(buffer.byteLength <= initialSize + 1 && buffer.byteLength <= maximumBytes + 1,
        'growth must not enlarge the original bounded allocation');
      assert.ok(length <= initialSize + 1 && length <= maximumBytes + 1, 'native read request must remain bounded');
      reads.push({ bufferLength: buffer.byteLength, length });
      hooks.beforeRead?.(reads.length, buffer);
      return fs.readSync(fd, buffer, offset, length, position);
    },
    closeSync(fd) { closed.push(fd); return fs.closeSync(fd); },
  };
  function assertClosed() {
    assert.deepEqual(closed, opened, 'each owned descriptor must close exactly once');
    for (const fd of opened) assert.throws(() => fs.fstatSync(fd), error => error.code === 'EBADF');
  }
  return { io, opened, closed, reads, assertClosed };
}

test('bounded native reads preserve empty and exact-cap binary sources without writes', () => fixture(root => {
  for (const bytes of [Buffer.alloc(0), Buffer.from([0, 0xFF, 0xEF, 0xBB, 0xBF, 13, 10, 65])]) {
    const filename = path.join(root, `authored-${bytes.length}.txt`);
    fs.writeFileSync(filename, bytes);
    const before = digest(filename), modified = fs.statSync(filename).mtimeMs;
    const observed = observe(filename, bytes.length, 8);
    const result = readBoundedFile(filename, 8, { io: observed.io });
    assert.ok(Buffer.isBuffer(result));
    assert.deepEqual(result, bytes);
    observed.assertClosed();
    assert.equal(digest(filename), before);
    assert.equal(fs.statSync(filename).mtimeMs, modified);
  }
}));

test('an initially oversized native source is rejected before opening or reading it', () => fixture(root => {
  const filename = path.join(root, 'authored-over-cap.txt');
  fs.writeFileSync(filename, Buffer.alloc(9, 65));
  const before = digest(filename);
  const observed = observe(filename, 9, 8);
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), error => error.code === 'bounded-read-limit');
  assert.equal(observed.opened.length, 0);
  assert.equal(observed.reads.length, 0);
  observed.assertClosed();
  assert.equal(digest(filename), before);
}));

test('native growth between lstat and open is rejected before source bytes are read', () => fixture(root => {
  const filename = path.join(root, 'authored-grow-before-open.txt');
  fs.writeFileSync(filename, '1234');
  const observed = observe(filename, 4, 8, {
    beforeOpen() { fs.appendFileSync(filename, Buffer.alloc(64 * 1024, 65)); },
  });
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), changed);
  assert.equal(observed.reads.length, 0, 'changed metadata must prevent a read of the grown source');
  observed.assertClosed();
}));

test('native growth during a read cannot allocate or request the newly grown file size', () => fixture(root => {
  const filename = path.join(root, 'authored-grow-during-read.txt');
  fs.writeFileSync(filename, '12345678');
  const observed = observe(filename, 8, 8, {
    beforeRead(count) { if (count === 1) fs.appendFileSync(filename, Buffer.alloc(64 * 1024, 66)); },
  });
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), changed);
  assert.ok(observed.reads.length > 0, 'exercise actual bounded native reads after adversarial growth');
  observed.assertClosed();
}));

test('same-size native replacement between lstat and open is rejected before reading the wrong file', () => fixture(root => {
  const filename = path.join(root, 'authored-original.txt');
  const replacement = path.join(root, 'authored-replacement.txt');
  fs.writeFileSync(filename, 'ORIGINAL');
  fs.writeFileSync(replacement, 'REPLACED');
  const replacementBefore = digest(replacement);
  const observed = observe(filename, 8, 8, {
    beforeOpen() { fs.unlinkSync(filename); fs.renameSync(replacement, filename); },
  });
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), changed);
  assert.equal(observed.reads.length, 0, 'identity mismatch must prevent reading replacement bytes');
  observed.assertClosed();
  assert.equal(digest(filename), replacementBefore);
}));

test('pathname replacement after the final descriptor stat rejects the snapshot and closes its descriptor', () => fixture(root => {
  const filename = path.join(root, 'authored-post-open.txt');
  const replacement = path.join(root, 'authored-post-open-replacement.txt');
  fs.writeFileSync(filename, 'ORIGINAL');
  fs.writeFileSync(replacement, 'REPLACED');
  const replacementBefore = digest(replacement);
  const observed = observe(filename, 8, 8);
  let descriptorStats = 0;
  observed.io.fstatSync = (fd, ...options) => {
    const stat = fs.fstatSync(fd, ...options);
    // Replace only after capturing the final opened-file snapshot. The
    // pathname recheck must catch this even though that snapshot was stable.
    if (++descriptorStats === 2) { fs.unlinkSync(filename); fs.renameSync(replacement, filename); }
    return stat;
  };
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), changed);
  assert.ok(observed.reads.length > 0, 'exercise the original opened descriptor after its pathname changes');
  observed.assertClosed();
  assert.equal(digest(filename), replacementBefore, 'reader must not modify the replacement file');
}));

test('Linux FIFO replacement cannot block open or reach a corpus read', {
  skip: process.platform !== 'linux' ? 'native FIFO replacement requires Linux; no host setup is performed' : false,
}, () => fixture(root => {
  const filename = path.join(root, 'authored-fifo.txt');
  fs.writeFileSync(filename, 'ORIGINAL');
  const helper = pathToFileURL(path.resolve('scripts/read-bounded-file.mjs')).href;
  // A separate, deadline-bounded child makes the old blocking open a finite
  // regression failure. mkfifo receives one authored path without a shell.
  const source = `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readBoundedFile } from ${JSON.stringify(helper)};
const filename = process.argv[1];
const root = path.dirname(filename);
assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
assert.ok(path.basename(root).startsWith('wow-sdk-bounded-read-'));
assert.equal(path.basename(filename), 'authored-fifo.txt');
const opened = [], closed = [];
let reads = 0;
const io = { ...fs,
  openSync(candidate, flags, ...rest) {
    assert.equal(candidate, filename);
    fs.unlinkSync(filename);
    const made = spawnSync('mkfifo', [filename], { shell: false, encoding: 'utf8',
      timeout: 2000, killSignal: 'SIGKILL' });
    assert.equal(made.error, undefined);
    assert.equal(made.status, 0, made.stderr);
    const fd = fs.openSync(candidate, flags, ...rest);
    opened.push(fd);
    return fd;
  },
  readSync(...args) { reads++; return fs.readSync(...args); },
  closeSync(fd) { closed.push(fd); return fs.closeSync(fd); },
};
assert.throws(() => readBoundedFile(filename, 8, { io }), error => error.code === 'bounded-read-changed');
assert.equal(opened.length, 1);
assert.equal(reads, 0, 'changed non-file must be rejected before reading');
assert.deepEqual(closed, opened);
for (const fd of opened) assert.throws(() => fs.fstatSync(fd), error => error.code === 'EBADF');
assert.ok(fs.lstatSync(filename).isFIFO());
`;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source, filename], {
    shell: false, windowsHide: true, encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL',
  });
  assert.equal(result.error, undefined, 'reader must finish before the native-child deadline');
  assert.equal(result.signal, null, 'reader must not require forced termination');
  assert.equal(result.status, 0, result.stderr);
}));

test('native shrink during a read is an incomplete snapshot rather than successful shorter input', () => fixture(root => {
  const filename = path.join(root, 'authored-shrink.txt');
  fs.writeFileSync(filename, '12345678');
  const observed = observe(filename, 8, 8, {
    beforeRead(count) { if (count === 1) fs.truncateSync(filename, 3); },
  });
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), changed);
  assert.ok(observed.reads.length > 0);
  observed.assertClosed();
}));

test('native read errors propagate while the reader closes its owned descriptor', () => fixture(root => {
  const filename = path.join(root, 'authored-read-error.txt');
  fs.writeFileSync(filename, '12345678');
  const before = digest(filename);
  let nativeError;
  const observed = observe(filename, 8, 8, {
    beforeRead(_count, buffer) {
      const expired = fs.openSync(filename, 'r');
      fs.closeSync(expired);
      try { fs.readSync(expired, buffer, 0, 1, 0); }
      catch (error) { nativeError = error; throw error; }
    },
  });
  assert.throws(() => readBoundedFile(filename, 8, { io: observed.io }), error => error === nativeError);
  assert.ok(nativeError, 'the wrapped operation must produce a real native I/O error');
  observed.assertClosed();
  assert.equal(digest(filename), before);
}));

test('a final-component native symlink is never opened as corpus input', t => fixture(root => {
  const filename = path.join(root, 'authored-source.txt');
  const link = path.join(root, 'authored-link.txt');
  fs.writeFileSync(filename, '12345678');
  const before = digest(filename);
  try { fs.symlinkSync(filename, link, 'file'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip(`native symlink unavailable: ${error.code}`); return; }
    throw error;
  }
  const observed = observe(link, 8, 8);
  assert.throws(() => readBoundedFile(link, 8, { io: observed.io }));
  assert.equal(observed.opened.length, 0);
  assert.equal(observed.reads.length, 0);
  observed.assertClosed();
  assert.equal(digest(filename), before);
}));
