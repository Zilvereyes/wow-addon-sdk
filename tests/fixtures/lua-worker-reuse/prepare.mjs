/** Make private stock and candidate wrappers around the exact build under test. */
import assert from 'node:assert/strict';
import {copyFile, cp, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function change(source, anchor, replacement) {
  assert.equal(source.split(anchor).length, 2, anchor);
  return source.replace(anchor, replacement);
}

const observe = `
import {writeSync} from 'node:fs';
import {getHeapStatistics} from 'node:v8';
import {threadId} from 'node:worker_threads';
const emit = (type, threadId, fields = {}) => writeSync(2, JSON.stringify({type, threadId, ...fields}) + '\\n');
function observeWorker(type, id) {
  if (type === 'worker-exit') emit(type, id, {launcherRss: process.memoryUsage.rss()});
  else emit(type, id);
}
function sample(request) {
  const {heapUsed, rss} = process.memoryUsage();
  emit('worker-sample', threadId, {id: request.id, units: request.content.length, heapUsed, rss,
    limit: getHeapStatistics().heap_size_limit});
}
`;

const sampleFresh = `if (!isMainThread) {
  const reply = await analyze(workerData);
  sample(workerData);
  parentPort.postMessage(reply);
}`;

function workerSources(source) {
  const common = observe + source;
  const originalEntry = 'if (!isMainThread) parentPort.postMessage(await analyze(workerData));';
  const originalBody = source.slice(source.indexOf('        // The actual API wrapper'),
    source.indexOf('      } else reply = await analyze(request);'));
  assert.ok(originalBody.startsWith('        // The actual API wrapper'));
  let stock = change(common, originalEntry, sampleFresh);
  stock = change(stock, '        try {\n          reply', `        const ownedId = thread.threadId;
        emit('worker-start', ownedId);
        thread.once('exit', () => observeWorker('worker-exit', ownedId));
        try {
          reply`);
  const serve = `if (!isMainThread) {
  parentPort.on('message', async request => {
    const reply = await analyze(request);
    sample(request);
    parentPort.postMessage({id: request.id, reply});
  });
}`;
  let candidate = "import {createLuaThreadPool} from './lua-thread-pool.mjs';\n" + change(common, originalEntry, serve);
  candidate = change(candidate, '  let requests = 0;', `  const pool = corpusLauncher ? createLuaThreadPool({
    spawnThread: () => new Worker(new URL(import.meta.url), {execArgv: [],
      resourceLimits: {maxOldGenerationSizeMb: 2048, stackSizeMb: 8}}),
    observe: observeWorker,
    onFault: () => { process.exitCode = 2; input.close(); },
  }) : null;
  let requests = 0;`);
  candidate = change(candidate, originalBody, '        reply = await pool.analyze(request);\n');
  candidate = change(candidate, '  input.close();\n}', '  await pool?.close();\n  input.close();\n}');
  return {stock, candidate};
}

export async function prepareExperiment() {
  const folder = await mkdtemp(join(tmpdir(), 'wow-sdk-lua-worker-experiment-'));
  const scripts = join(folder, 'scripts');
  const cleanup = () => rm(folder, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
  try {
    await cp(join(root, 'scripts'), scripts, {recursive: true});
    await symlink(join(root, 'node_modules'), join(folder, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await copyFile(new URL('./lua-thread-pool.mjs', import.meta.url), join(scripts, 'lua-thread-pool.mjs'));
    const read = async name => (await readFile(join(scripts, name), 'utf8')).replaceAll('\r\n', '\n');
    const variants = workerSources(await read('selected-source-analysis-worker.mjs'));
    const client = await read('selected-source-analysis-client.mjs');
    for (const [name, source] of Object.entries(variants)) {
      const worker = name + '-worker.mjs';
      await writeFile(join(scripts, worker), source, {flag: 'wx'});
      let variant = change(client, 'const corpusRequestLimit = 32;',
        `const corpusWorker = fileURLToPath(new URL('./${worker}', import.meta.url));
const corpusRequestLimit = 32;`);
      variant = change(variant, '    const args = [...flags, worker];',
        '    const args = [...flags, corpus ? corpusWorker : worker];');
      await writeFile(join(scripts, name + '-client.mjs'), variant, {flag: 'wx'});
    }
    const load = async name => (await import(pathToFileURL(join(scripts, name + '-client.mjs')).href)).createGraphAnalyzer;
    return {createStock: await load('stock'), createCandidate: await load('candidate'), cleanup};
  } catch (error) {await cleanup(); throw error;}
}
