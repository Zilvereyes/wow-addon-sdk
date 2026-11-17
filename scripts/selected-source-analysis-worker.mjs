/** Fixed one-request graph worker. Lua/XML text is parsed, never executed. */
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {createInterface} from 'node:readline';
import {parseToc} from '@wow-addon/toc-parser';
import {parseXml} from '@wow-addon/xml-parser';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {analyzeXml, mapXmlValueRanges} from '@wow-addon/xml-analysis';
import {composeXmlInlineLua} from './xml-inline-lua-validation.mjs';
import {verifyXmlProvider} from './xml-provider-validation.mjs';
import {emptyGraphCalls} from './selected-source-analysis.mjs';

function analyze(request) {
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
        if (verifyXmlProvider(result.provider, syntax, content, sourcePath, request.xmlPolicy, association).outcome === 'validated') {
          const inline = composeXmlInlineLua(content, sourcePath, syntax, result.provider,
            {policy: request.xmlPolicy, profile: request.inlineProfile, fileOrdinal: 0, association},
            call('analyzeLua', analyzeLua), call('mapXmlValueRanges', mapXmlValueRanges));
          if (inline.status !== 'completed') return {result: null, confirmedApiCalls,
            failure: ['resource', 'invariant'].includes(inline.status) ? inline.status : 'backend'};
          result.inline = inline.bodies.map(({decodedSourcePath: _label, ...row}) => row);
        }
      }
    }
    return {result, confirmedApiCalls, failure: null};
  } catch { return {result: null, confirmedApiCalls, failure: 'backend'}; }
}

if (!isMainThread) parentPort.postMessage(analyze(workerData));
else {
  const input = createInterface({input: process.stdin, crlfDelay: Infinity});
  for await (const line of input) {
    try {
      const request = JSON.parse(line);
      let reply;
      if (request.language === 'lua' && request.luaProfile === 'corpus') {
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
      } else reply = analyze(request);
      process.stdout.write(JSON.stringify({id: request.id, ...reply}) + '\n');
    } catch { process.stderr.write('Graph analysis worker failure.\n'); process.exitCode = 2; }
    input.close(); break;
  }
}
