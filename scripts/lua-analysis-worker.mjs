/** Trusted SDK worker. Lua request text is data and is never executed. */
import { createInterface } from 'node:readline';
import { analyzeLua } from '@wow-addon/lua-analysis';

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  try {
    const request = JSON.parse(line);
    if (!Number.isSafeInteger(request.id) || request.id <= 0) throw new Error('Invalid protocol');
    const result = analyzeLua(request.content, request.sourcePath, request.options);
    process.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
  } catch {
    // No input text, paths or backend errors enter the operational error stream.
    process.stderr.write('Lua worker protocol failure.\n');
    process.exitCode = 2;
    input.close();
    break;
  }
}
