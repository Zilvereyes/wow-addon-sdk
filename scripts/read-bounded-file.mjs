/** Read-only tooling transport. Never allocate from a post-open file size. */
import fs from 'node:fs';

function changed() {
  return Object.assign(new Error('Corpus input changed during bounded read.'), { code: 'bounded-read-changed' });
}
function sameFile(initial, observed) {
  return observed.isFile() && !observed.isSymbolicLink() && initial.dev === observed.dev && initial.ino === observed.ino &&
    initial.size === observed.size && initial.mtimeNs === observed.mtimeNs && initial.ctimeNs === observed.ctimeNs;
}

// io is a trusted internal test seam, never selected by corpus input or CLI data.
export function readBoundedFile(filename, maximumBytes, { io = fs } = {}) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) throw new RangeError('Invalid bounded read limit.');
  const initial = io.lstatSync(filename, { bigint: true });
  if (!initial.isFile() || initial.isSymbolicLink() || typeof initial.size !== 'bigint' || initial.size < 0n) throw changed();
  if (initial.size > BigInt(maximumBytes)) {
    throw Object.assign(new Error('Corpus input exceeds bounded read limit.'), { code: 'bounded-read-limit' });
  }
  // Nonblocking open also permits rejecting a FIFO substituted before fstat.
  const descriptor = io.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) |
    (fs.constants.O_NONBLOCK ?? 0));
  try {
    if (!sameFile(initial, io.fstatSync(descriptor, { bigint: true }))) throw changed();
    // One sentinel byte detects growth without reading or allocating its size.
    const initialSize = Number(initial.size); // exact after the safe-integer caller cap
    const bytes = Buffer.alloc(initialSize + 1);
    let total = 0;
    while (total < bytes.length) {
      const count = io.readSync(descriptor, bytes, total, bytes.length - total, total);
      if (count === 0) break;
      total += count;
    }
    if (total !== initialSize || !sameFile(initial, io.fstatSync(descriptor, { bigint: true })) ||
        !sameFile(initial, io.lstatSync(filename, { bigint: true }))) throw changed();
    return bytes.subarray(0, total);
  } finally { io.closeSync(descriptor); }
}
