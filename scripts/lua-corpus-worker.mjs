/** Larger corpus supervisor; Lua is data, not JS or executable input. */
import { createInterface } from 'node:readline';
import { createLuaParserThread } from './lua-parser-thread-client.mjs';

const parser = createLuaParserThread();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
try {
  for await (const line of input) {
    try {
      const request = JSON.parse(line);
      if (!Number.isSafeInteger(request.id) || request.id <= 0) throw new Error('Invalid protocol');
      const result = await parser.analyze(request);
      process.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
    } catch {
      process.stderr.write('Lua corpus worker failure.\n');
      process.exitCode = 2; input.close(); break;
    }
  }
} finally { await parser.close(); }
