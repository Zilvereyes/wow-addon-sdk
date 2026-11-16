/** Trusted thread: request text is only parsed through the public SDK. */
import { parentPort } from 'node:worker_threads';
import { analyzeLua } from '@wow-addon/lua-analysis';

parentPort.on('message', request => {
  try {
    const result = analyzeLua(request.content, request.sourcePath, request.options);
    parentPort.postMessage({ id: request.id, result });
  } catch { throw new Error('Lua parser thread failed.'); }
});
