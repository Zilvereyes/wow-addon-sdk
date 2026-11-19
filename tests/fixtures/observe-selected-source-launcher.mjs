import {writeSync} from 'node:fs';
import {createRequire, syncBuiltinESMExports} from 'node:module';
import {getHeapStatistics} from 'node:v8';
import {isMainThread, resourceLimits, threadId} from 'node:worker_threads';

if (!isMainThread) {
  writeSync(2, 'graph-memory-thread:' + JSON.stringify({
    threadId, heapLimitBytes: getHeapStatistics().heap_size_limit,
    maxOldGenerationSizeMb: resourceLimits.maxOldGenerationSizeMb, stackSizeMb: resourceLimits.stackSizeMb,
  }) + '\n');
} else {
  const workers = new Set();
  const report = (kind, fields) => process.send({
    kind, ...fields, live: workers.size, executing: [...workers].filter(worker => worker.executing).length,
    rssKiB: Math.round(process.memoryUsage.rss() / 1024),
    peakRssKiB: process.resourceUsage().maxRSS,
    measuredAtMs: Date.now(),
  });
  let currentId;
  process.on('message', ({sample}) => report('sample', {sample}));
  process.channel.unref();

  const threads = createRequire(import.meta.url)('node:worker_threads');
  threads.Worker = class ObservedWorker extends threads.Worker {
    constructor(entry, options) {
      const source = 'import ' + JSON.stringify(import.meta.url) + '; await import(' + JSON.stringify(entry.href) + ');';
      super(new URL('data:text/javascript,' + encodeURIComponent(source)), options);
      const worker = {threadId: this.threadId, id: options.workerData?.id, executing: options.workerData != null};
      workers.add(worker);
      if (worker.id !== undefined) currentId = worker.id;
      report('start', {...worker, execArgv: options.execArgv});
      this.on('message', () => {worker.executing = false;});
      this.once('exit', () => {
        workers.delete(worker);
        report('exit', {id: worker.id, threadId: worker.threadId});
      });
      if (options.workerData == null) {
        const post = this.postMessage;
        this.postMessage = function (request, ...args) {
          worker.id = currentId = request.id;
          worker.executing = true;
          report('dispatch', {id: worker.id, threadId: worker.threadId});
          return Reflect.apply(post, this, [request, ...args]);
        };
      }
    }
  };
  syncBuiltinESMExports();

  const write = process.stdout.write;
  process.stdout.write = function (...args) {
    report('frame', {id: currentId});
    return Reflect.apply(write, this, args);
  };
}
