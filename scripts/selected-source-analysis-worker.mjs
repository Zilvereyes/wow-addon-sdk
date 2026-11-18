/** Fixed graph worker with an opt-in launcher for sequential corpus Lua requests. */
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {createInterface} from 'node:readline';
import {emptyGraphCalls} from './selected-source-analysis-receipts.mjs';

function requireExports(sdk, ...names) {
  for (const name of names) {
    if (!Object.hasOwn(sdk, name)) throw new Error('Missing graph SDK export.');
  }
  return sdk;
}

async function loadApis(language) {
  if (language === 'toc') {
    return requireExports(await import('@wow-addon/toc-parser'), 'parseToc');
  }
  if (language === 'lua') {
    return requireExports(await import('@wow-addon/lua-analysis'), 'analyzeLua');
  }
  const [syntax, provider, lua, composition] = await Promise.all([
    import('@wow-addon/xml-parser'),
    import('@wow-addon/xml-analysis'),
    import('@wow-addon/lua-analysis'),
    import('./xml-inline-lua-validation.mjs'),
  ]);
  requireExports(syntax, 'parseXml');
  requireExports(provider, 'analyzeXml', 'mapXmlValueRanges');
  requireExports(lua, 'analyzeLua');
  requireExports(composition, 'composeGraphXmlInlineLua');
  return {
    parseXml: syntax.parseXml,
    analyzeXml: provider.analyzeXml,
    mapXmlValueRanges: provider.mapXmlValueRanges,
    analyzeLua: lua.analyzeLua,
    composeGraphXmlInlineLua: composition.composeGraphXmlInlineLua,
  };
}

async function analyze(request) {
  // Initialization errors terminate the worker before it can claim an API call.
  const {parseToc, parseXml, analyzeLua, analyzeXml, mapXmlValueRanges, composeGraphXmlInlineLua} = await loadApis(request.language);
  const confirmedApiCalls = emptyGraphCalls();
  const call = (name, api) => (...args) => {
    confirmedApiCalls[name].invoked++;
    const result = api(...args);
    confirmedApiCalls[name].returned++;
    return result;
  };
  try {
    const {language, content, sourcePath, addonId, conditions} = request;
    let result;
    if (language === 'toc') result = {language, parsed: call('parseToc', parseToc)(content, sourcePath)};
    else if (language === 'lua') result = {language, result: call('analyzeLua', analyzeLua)(content, sourcePath,
      {addonId, conditions, profile: request.luaProfile, allowShebang: request.allowShebang, context: {kind: 'chunk'}})};
    else {
      const syntax = call('parseXml', parseXml)(content, sourcePath, {namespaceAware: true});
      result = {language, syntax, provider: null, inline: []};
      if (syntax.complete) {
        const association = {addonId, conditions};
        result.provider = call('analyzeXml', analyzeXml)(content, sourcePath, {addonId, conditions, policy: request.xmlPolicy});
        const inline = composeGraphXmlInlineLua(content, sourcePath, syntax, result.provider,
          {policy: request.xmlPolicy, profile: request.inlineProfile, fileOrdinal: 0, association},
          call('analyzeLua', analyzeLua), call('mapXmlValueRanges', mapXmlValueRanges));
        if (inline !== null) {
          if (inline.status !== 'completed') return {result: null, confirmedApiCalls,
            failure: ['resource', 'invariant'].includes(inline.status) ? inline.status : 'backend'};
          result.inline = inline.bodies.map(({decodedSourcePath: _label, ...row}) => row);
        }
      }
    }
    return {result, confirmedApiCalls, failure: null};
  } catch { return {result: null, confirmedApiCalls, failure: 'backend'}; }
}

if (!isMainThread) parentPort.postMessage(await analyze(workerData));
else {
  const corpusLauncher = process.argv[2] === '--corpus-launcher';
  const maxRequests = corpusLauncher ? 32 : 1;
  const input = createInterface({input: process.stdin, crlfDelay: Infinity});
  let requests = 0;
  for await (const line of input) {
    try {
      const request = JSON.parse(line);
      const isCorpusLua = request.language === 'lua' && request.luaProfile === 'corpus';
      if (corpusLauncher && !isCorpusLua) throw Error('Expected corpus Lua request.');
      let reply;
      if (isCorpusLua) {
        // The actual API wrapper and receipts run in the 8MiB parser stack,
        // not around postMessage (which would only confirm message submission).
        const thread = new Worker(new URL(import.meta.url), {workerData: request, execArgv: [],
          resourceLimits: {maxOldGenerationSizeMb: 2048, stackSizeMb: 8}});
        try {
          reply = await new Promise((resolve, reject) => {
            thread.once('message', resolve); thread.once('error', reject);
            thread.once('exit', code => reject(Error(`graph-parser-thread-${code}`)));
          });
        } finally { await thread.terminate(); }
      } else reply = await analyze(request);
      process.stdout.write(JSON.stringify({id: request.id, ...reply}) + '\n');
      requests++;
      if (requests === maxRequests || reply.failure !== null) break;
    } catch {
      process.stderr.write('Graph analysis worker failure.\n');
      process.exitCode = 2;
      break;
    }
  }
  input.close();
}
