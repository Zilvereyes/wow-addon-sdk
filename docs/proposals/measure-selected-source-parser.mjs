/** Compare the real supervised parser against an instrumented copy using authored inputs. */
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createGraphAnalyzer} from '../../scripts/selected-source-analysis-client.mjs';

const clock = () => Number(process.hrtime.bigint()) / 1e6;
const worker = new URL('../../scripts/selected-source-analysis-worker.mjs', import.meta.url);
const metricPrefix = 'graph-parser-timing:';
const [option, ...extra] = process.argv.slice(2);
assert.ok((option === undefined || option === '--xml-only') && extra.length === 0,
  'Usage: node docs/proposals/measure-selected-source-parser.mjs [--xml-only]');
const xmlOnly = option === '--xml-only';
const freshWorkerRevision = xmlOnly ? 'd431facca863b120ea7785ce8a63f400bdb4f1ef' :
  '52b190d0593b1b5a0c317f27600d0ca5ba6cd239';
const json = name => JSON.parse(readFileSync(new URL('../../examples/' + name, import.meta.url), 'utf8'));
const xmlPolicy = json('xml-provider-profile.json').policy;
const inlineProfile = json('xml-inline-lua-profile.json');

function sourceCopy(source, observed) {
  const replace = (before, after, count = 1) => {
    assert.equal(source.split(before).length, count + 1, 'Incorrect measurement point count: ' + before);
    source = source.replaceAll(before, () => after);
  };
  for (const file of ['selected-source-analysis-receipts.mjs', 'xml-inline-lua-validation.mjs']) {
    replace("'./" + file + "'", JSON.stringify(new URL(file, worker).href));
  }
  if (xmlOnly) replace("'./selected-source-lua-thread.mjs'",
    JSON.stringify(new URL('selected-source-lua-thread.mjs', worker).href));
  for (const name of ['toc-parser', 'lua-analysis', 'xml-parser', 'xml-analysis']) {
    replace("'@wow-addon/" + name + "'", JSON.stringify(import.meta.resolve('@wow-addon/' + name)), name === 'lua-analysis' ? 2 : 1);
  }
  if (!observed) return source;
  const prelude = `import {writeSync} from 'node:fs';
const measureClock = () => Number(process.hrtime.bigint()) / 1e6;
const measureEntry = measureClock();
const reportTiming = row => writeSync(2, ${JSON.stringify(metricPrefix)} + JSON.stringify(row) + '\\n');
`;
  replace('  const {parseToc, parseXml, analyzeLua, analyzeXml, mapXmlValueRanges, composeGraphXmlInlineLua} = await loadApis(request.language);',
    `  const loadStart = measureClock();
  const {parseToc, parseXml, analyzeLua, analyzeXml, mapXmlValueRanges, composeGraphXmlInlineLua} = await loadApis(request.language);
  const loaded = measureClock();
  const apiMs = Object.create(null);`);
  replace('    const result = api(...args);', `    const apiStart = measureClock();
    let result;
    try { result = api(...args); }
    finally { apiMs[name] = (apiMs[name] ?? 0) + measureClock() - apiStart; }`);
  replace('    return {result, confirmedApiCalls, failure: null};', `    reportTiming({kind: 'worker', id: request.id, entry: measureEntry,
      loadStart, loaded, analyzed: measureClock(), apiMs});
    return {result, confirmedApiCalls, failure: null};`);
  replace('else {\n  const corpusLauncher', `else {
  reportTiming({kind: 'launcher'});
  const corpusLauncher`);
  replace('        const thread = new Worker(', `        const threadStart = measureClock();
        const thread = new Worker(`);
  replace('        } finally { await thread.terminate(); }', `        } finally { await thread.terminate(); }
        const joined = measureClock();
        const output = JSON.stringify({id: request.id, ...reply}) + '\\n';
        reportTiming({kind: 'frame', id: request.id, threadStart, joined, serialized: measureClock()});
        process.stdout.write(output);`);
  replace("      } else reply = await analyze(request);\n      process.stdout.write(JSON.stringify({id: request.id, ...reply}) + '\\n');",
    "      } else throw Error('Timing copy requires a retained launcher.');");
  return prelude + source;
}

function cases() {
  const repeats = (count, line) => Array.from({length: count}, (_, i) => line(i)).join('\r\n');
  const inputs = [];
  for (let index = 0; index < 34; index++) {
    const size = ['small', 'medium', 'large'][index % 3];
    const records = [8, 120, 1200][index % 3];
    if (!xmlOnly) inputs.push({language: 'lua', size, content: '-- authored 🙂\r\n' + repeats(records, i => 'AuthoredLua' + i + ' = ' + i)});
    if (index % 4 === 0) inputs.push({language: 'toc', size: 'manifest',
      content: '## Interface: 11509\r\n' + repeats(records, i => 'File' + i + '.lua')});
    else {
      const inline = size !== 'small';
      inputs.push({language: 'xml', size, content: '<Ui>\r\n<!--🙂-->' +
        repeats(inline ? records / 10 : records, i => '<Frame name="Authored' + i + '">' +
          (inline ? '<Scripts><OnLoad>AuthoredXml' + i + ' = self</OnLoad></Scripts>' : '') + '</Frame>') + '</Ui>'});
    }
  }
  return inputs.map(({language, size, content}, index) => ({
    kind: language + '-' + size,
    request: {language, content, sourcePath: 'Authored/File' + index + '.' + language,
      addonId: 'authored-fixture', conditions: [], luaProfile: 'corpus', allowShebang: false, xmlPolicy, inlineProfile},
  }));
}

async function run(inputs, workerPath, observed) {
  const metrics = new Map();
  const live = new Set();
  const startupMs = [];
  let launches = 0;
  let closes = 0;
  let active;
  let telemetryError;
  const rootApi = {toc: 'parseToc', lua: 'analyzeLua', xml: 'parseXml'};
  const client = createGraphAnalyzer({spawnProcess(executable, args, options) {
    assert.equal(args[1], fileURLToPath(worker));
    const start = clock();
    const child = spawn(executable, [args[0], workerPath, ...args.slice(2)], options);
    launches++;
    live.add(child);
    child.once('close', (code, signal) => {
      if (code !== 0 || signal !== null) telemetryError ??= Error('Launcher closed unsuccessfully.');
      live.delete(child);
      closes++;
    });
    child.stdout.prependListener('data', chunk => {
      if (active && chunk.at(-1) === 10) active.frameAt = clock();
    });
    if (observed) createInterface({input: child.stderr}).on('line', line => {
      try {
        assert.ok(line.startsWith(metricPrefix), 'Unexpected timing-copy stderr.');
        const row = JSON.parse(line.slice(metricPrefix.length));
        if (row.kind === 'launcher') { startupMs.push(clock() - start); return; }
        assert.ok(row.kind === 'worker' || row.kind === 'frame');
        assert.ok(Number.isInteger(row.id) && row.id >= 1 && row.id <= inputs.length);
        const entry = metrics.get(row.id) ?? {};
        assert.equal(entry[row.kind], undefined, 'Duplicate timing event.');
        entry[row.kind] = row;
        metrics.set(row.id, entry);
      } catch (error) { telemetryError ??= error; }
    });
    return child;
  }});
  const results = [];
  const uses = {lua: 0, tocXml: 0};
  try {
    for (const {kind, request} of inputs) {
      const pool = request.language === 'lua' ? 'lua' : 'tocXml';
      const use = ++uses[pool];
      const lifecycle = use === 1 ? 'first' : use === 32 ? 'retire' : use === 33 ? 'afterRotation' : 'warm';
      active = {kind, pool, lifecycle, start: clock()};
      const reply = await client.analyze(request);
      active.end = clock();
      assert.ok(active.frameAt >= active.start && active.end >= active.frameAt, 'Expected an acknowledged final frame.');
      assert.equal(reply.result.language, request.language);
      assert.deepEqual(reply.confirmedApiCalls[rootApi[request.language]], {invoked: 1, returned: 1});
      if (request.language === 'xml') {
        const inlineCount = {'xml-small': 0, 'xml-medium': 12, 'xml-large': 120}[kind];
        assert.equal(reply.result.inline.length, inlineCount);
        assert.deepEqual(reply.confirmedApiCalls.analyzeXml, {invoked: 1, returned: 1});
        for (const api of ['analyzeLua', 'mapXmlValueRanges']) {
          assert.deepEqual(reply.confirmedApiCalls[api], {invoked: inlineCount, returned: inlineCount});
        }
      }
      results.push({...active, reply});
      active = undefined;
    }
  } finally { await client.close(); }
  if (telemetryError) throw telemetryError;
  assert.equal(live.size, 0);
  assert.equal(closes, launches);
  assert.equal(launches, xmlOnly ? 2 : 4);
  if (observed) {
    assert.equal(startupMs.length, launches);
    assert.equal(metrics.size, inputs.length);
  }

  const samples = results.map(({kind, pool, lifecycle, start, end, frameAt}, index) => {
    const row = {kind, pool, lifecycle, total: end - start, postFrame: end - frameAt};
    if (observed) {
      const {worker, frame} = metrics.get(index + 1);
      assert.ok(frame.threadStart <= worker.entry && worker.entry <= worker.loadStart &&
        worker.loadStart <= worker.loaded && worker.loaded <= worker.analyzed &&
        worker.analyzed <= frame.joined && frame.joined <= frame.serialized, 'Unexpected parser phase order.');
      Object.assign(row, {
        threadEntry: worker.entry - frame.threadStart,
        workerModuleSetup: worker.loadStart - worker.entry,
        sdkImports: worker.loaded - worker.loadStart,
        analysis: worker.analyzed - worker.loaded,
        parserApis: Object.values(worker.apiMs).reduce((sum, ms) => sum + ms, 0),
        ...worker.apiMs,
        threadReplyAndJoin: frame.joined - worker.analyzed,
        serialize: frame.serialized - frame.joined,
      });
    }
    return row;
  });
  return {launches, closes, startupMs, samples, replies: results.map(row => row.reply)};
}

function summarize(samples) {
  const groups = Map.groupBy(samples, sample => sample.kind);
  const median = values => {
    const sorted = values.toSorted((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return Math.round((sorted[middle] + sorted[(sorted.length - 1) >> 1]) * 5) / 10;
  };
  return Object.fromEntries([...groups].map(([kind, group]) => [kind, {
    count: group.length,
    ...Object.fromEntries(Object.keys(group[0]).filter(key => typeof group[0][key] === 'number')
      .map(key => [key, median(group.map(row => row[key]))])),
  }]));
}


const freshWorker = execFileSync('git', ['show', freshWorkerRevision + ':scripts/selected-source-analysis-worker.mjs'], {
  cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', windowsHide: true,
}).replaceAll('\r\n', '\n');
const scratch = mkdtempSync(join(tmpdir(), 'wow-parser-phases-'));
const stockPath = join(scratch, 'fresh-worker.mjs');
const observedPath = join(scratch, 'observed-worker.mjs');
try {
  writeFileSync(stockPath, sourceCopy(freshWorker, false), {flag: 'wx'});
  writeFileSync(observedPath, sourceCopy(freshWorker, true), {flag: 'wx'});
  const inputs = cases();
  const trials = [];
  let baseline;
  for (const observed of [false, true, true, false]) {
    const {replies, ...measurements} = await run(inputs, observed ? observedPath : stockPath, observed);
    if (baseline) assert.deepEqual(replies, baseline);
    else baseline = replies;
    trials.push({observed, ...measurements});
  }
  console.log(JSON.stringify({
    node: process.version, platform: process.platform, freshWorkerRevision, repliesChecked: inputs.length * trials.length,
    launches: trials.map(trial => trial.launches), closes: trials.map(trial => trial.closes),
    replyDigest: createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
    stockWarmMediansMs: summarize(trials.filter(t => !t.observed).flatMap(t => t.samples)
      .filter(sample => sample.lifecycle === 'warm')),
    observedWarmMediansMs: summarize(trials.filter(t => t.observed).flatMap(t => t.samples)
      .filter(sample => sample.lifecycle === 'warm')),
    observedLifecycleMediansMs: summarize(trials.filter(t => t.observed).flatMap(t => t.samples)
      .filter(sample => sample.lifecycle !== 'warm')
      .map(sample => ({...sample, kind: sample.pool + '-' + sample.lifecycle}))),
    launcherEntryReceiptMs: trials.flatMap(t => t.startupMs).map(Math.round),
  }, null, 2));
} finally {
  rmSync(stockPath, {force: true});
  rmSync(observedPath, {force: true});
  rmdirSync(scratch);
}
