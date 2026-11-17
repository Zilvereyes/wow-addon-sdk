/** Trusted SDK worker. XML request text is data and is never executed. */
import { createInterface } from 'node:readline';
import { parseXml } from '@wow-addon/xml-parser';

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  try {
    const request = JSON.parse(line);
    if (!Number.isSafeInteger(request.id) || request.id <= 0) throw new Error('Invalid protocol');
    const providerRequested = Object.hasOwn(request, 'providerOptions');
    if (providerRequested && request.options !== undefined) throw new Error('Invalid protocol');
    const result = parseXml(request.content, request.sourcePath, providerRequested ? { namespaceAware: true } : request.options);
    const response = { id: request.id, result };
    if (providerRequested) {
      response.provider = { attempted: false, result: null };
      if (result.complete) {
        response.provider.attempted = true;
        try {
          // Parser-only callers never load the optional semantic package.
          const { analyzeXml } = await import('@wow-addon/xml-analysis');
          response.provider.result = analyzeXml(request.content, request.sourcePath, request.providerOptions);
        } catch { /* A fixed null projection records a throwing provider backend. */ }
      }
    }
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch {
    // No input text, paths or backend errors enter the operational error stream.
    process.stderr.write('XML worker protocol failure.\n');
    process.exitCode = 2;
    input.close();
    break;
  }
}
