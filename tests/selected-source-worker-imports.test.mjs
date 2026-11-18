import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';

const workerUrl = new URL('../scripts/selected-source-analysis-worker.mjs', import.meta.url).href;
const tocModule = '@wow-addon/toc-parser';
const luaModule = '@wow-addon/lua-analysis';
const xmlModules = ['@wow-addon/xml-parser', '@wow-addon/xml-analysis', luaModule];
const marker = 'tracked-sdk-import:';
const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const xmlPolicy = json('../examples/xml-provider-profile.json').policy;
const inlineProfile = json('../examples/xml-inline-lua-profile.json');

function request(language, content, luaProfile = 'bounded') {
  return {language, content, luaProfile, sourcePath: `Fixture/Source.${language}`,
    addonId: 'fixture', conditions: [], allowShebang: false, xmlPolicy, inlineProfile};
}

function receipts(...names) {
  const result = emptyGraphCalls();
  for (const name of names) result[name] = {invoked: 1, returned: 1};
  return result;
}

async function observeWorker(input, use, faults = {}) {
  const replacements = {
    throwsAtInitialization: dataModule("throw Error('authored module initialization failure'); export function parseToc() {}"),
    missingNamedExport: dataModule('export const unrelated = 1;'),
  };
  const hook = dataModule(`
    import {writeSync} from 'node:fs';
    const faults = ${JSON.stringify(faults)};
    const replacements = ${JSON.stringify(replacements)};
    export function resolve(specifier, context, next) {
      if (context.parentURL !== ${JSON.stringify(workerUrl)} || !specifier.startsWith('@wow-addon/')) {
        return next(specifier, context);
      }
      writeSync(2, ${JSON.stringify(marker)} + specifier + '\\n');
      const fault = faults[specifier];
      if (fault === 'missing') throw Object.assign(Error('authored missing module'), {code: 'ERR_MODULE_NOT_FOUND'});
      if (fault) return {url: replacements[fault], shortCircuit: true};
      return next(specifier, context);
    }
  `);
  const preload = dataModule(`import {register} from 'node:module'; register(${JSON.stringify(hook)});`);
  let stderr = '', outputBytes = 0;
  const client = createGraphAnalyzer({spawnProcess(executable, args, options) {
    const child = spawn(executable, ['--import', preload, ...args], options);
    child.stderr.setEncoding('utf8').on('data', chunk => {stderr += chunk;});
    child.stdout.on('data', chunk => {outputBytes += chunk.length;});
    return child;
  }});
  try {
    await use(client.analyze(input));
    return {imports: stderr.split(/\r?\n/u).filter(line => line.startsWith(marker)).map(line => line.slice(marker.length)),
      outputBytes};
  } finally {
    await client.close();
  }
}

test('TOC worker loads only its fixed SDK module even if an unused module is missing', async () => {
  const observed = await observeWorker(request('toc', '## Interface: 11508\nCore.lua'), async pending => {
    const reply = await pending;
    assert.equal(reply.result.parsed.metadata.fileEntries[0].path, 'Core.lua');
    assert.deepEqual(reply.confirmedApiCalls, receipts('parseToc'));
  }, {[luaModule]: 'missing'});
  assert.deepEqual(observed.imports, [tocModule]);
});

test('bounded Lua worker loads only its fixed SDK module', async () => {
  const observed = await observeWorker(request('lua', 'Answer=42'), async pending => {
    const reply = await pending;
    assert.equal(reply.result.result.declarations[0].name, 'Answer');
    assert.deepEqual(reply.confirmedApiCalls, receipts('analyzeLua'));
  });
  assert.deepEqual(observed.imports, [luaModule]);
});

test('corpus Lua launcher leaves SDK initialization to the isolated parser thread', async () => {
  const observed = await observeWorker(request('lua', 'Answer=42', 'corpus'), async pending => {
    const reply = await pending;
    assert.equal(reply.result.result.declarations[0].name, 'Answer');
    assert.deepEqual(reply.confirmedApiCalls, receipts('analyzeLua'));
  });
  // The parser thread has its own execArgv, so the launcher-only probe cannot count its imports.
  assert.deepEqual(observed.imports, []);
});

test('XML worker loads the fixed syntax, provider and inline Lua SDK modules', async () => {
  const observed = await observeWorker(request('xml', '<Ui><Script>Answer=42</Script></Ui>'), async pending => {
    const reply = await pending;
    assert.equal(reply.result.inline[0].analysis.declarations[0].name, 'Answer');
    assert.deepEqual(reply.confirmedApiCalls, receipts('parseXml', 'analyzeXml', 'analyzeLua', 'mapXmlValueRanges'));
  });
  assert.deepEqual(observed.imports.sort(), [...xmlModules].sort());
});

for (const fault of ['missing', 'throwsAtInitialization', 'missingNamedExport']) {
  test(`required SDK module failure (${fault}) exits without a reply or receipts`, async () => {
    const observed = await observeWorker(request('toc', 'Core.lua'), async pending => {
      await assert.rejects(pending, error => {
        assert.equal(error.message, 'graph-analysis-exit');
        assert.equal(Object.hasOwn(error, 'confirmedApiCalls'), false);
        return true;
      });
    }, {[tocModule]: fault});
    assert.ok(observed.imports.includes(tocModule));
    assert.equal(observed.outputBytes, 0);
  });
}
