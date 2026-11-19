import {writeSync} from 'node:fs';
import {createRequire, syncBuiltinESMExports} from 'node:module';
import {getHeapStatistics} from 'node:v8';
import {isMainThread, resourceLimits, threadId, workerData} from 'node:worker_threads';

if (!isMainThread) {
  writeSync(2, 'graph-memory-thread:' + JSON.stringify({
    id: workerData.id, threadId, heapLimitBytes: getHeapStatistics().heap_size_limit,
    maxOldGenerationSizeMb: resourceLimits.maxOldGenerationSizeMb, stackSizeMb: resourceLimits.stackSizeMb,
  }) + '\n');
} else {
  const rss = () => ({
    rssKiB: Math.round(process.memoryUsage.rss() / 1024),
    peakRssKiB: process.resourceUsage().maxRSS,
    measuredAtMs: Date.now(),
  });
  let currentId;
  const active = new Set();
  process.on('message', ({sample}) => {
    process.send({kind: 'sample', sample, active: active.size, ...rss()});
  });
  process.channel.unref();

  const threads = createRequire(import.meta.url)('node:worker_threads');
  threads.Worker = class ObservedWorker extends threads.Worker {
    constructor(entry, options) {
      // An authored entry wrapper observes the isolate with the exact Worker options supplied by the launcher.
      const source = 'import ' + JSON.stringify(import.meta.url) + '; await import(' + JSON.stringify(entry.href) + ');';
      super(new URL('data:text/javascript,' + encodeURIComponent(source)), options);
      const {id} = options.workerData;
      const idInLauncher = this.threadId;
      currentId = id;
      active.add(idInLauncher);
      process.send({kind: 'start', id, threadId: idInLauncher, execArgv: options.execArgv, active: active.size, ...rss()});
      this.once('exit', () => {
        active.delete(idInLauncher);
        process.send({kind: 'exit', id, threadId: idInLauncher, active: active.size, ...rss()});
      });
    }
  };
  syncBuiltinESMExports();

  const write = process.stdout.write;
  process.stdout.write = function (...args) {
    process.send({kind: 'frame', id: currentId, active: active.size, ...rss()});
    return Reflect.apply(write, this, args);
  };
}
