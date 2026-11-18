import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseToc} from '@wow-addon/toc-parser';
import {parseXml} from '@wow-addon/xml-parser';
import {analyzeXml} from '@wow-addon/xml-analysis';
import {analyzeLua} from '@wow-addon/lua-analysis';
import {getGraphRequest} from '../scripts/selected-source-context.mjs';
import {emptyGraphCalls} from '../scripts/selected-source-analysis.mjs';
import {analyzeSelectedSourceAggregate, analyzeSelectedSources} from '../scripts/selected-source-graph.mjs';
import {context, memoryHost, simple, slash} from './selected-source-engine-fixtures.mjs';

function authoredWithoutInline(files, changeReply) {
  return memoryHost(files, host => {
    host.nowMilliseconds = () => 0;
    host.analyze = async input => {
      const {language, content, sourcePath, addonId, conditions, xmlPolicy, luaProfile, allowShebang} = input;
      const confirmedApiCalls = emptyGraphCalls();
      const invoke = (name, call) => {
        confirmedApiCalls[name].invoked++;
        const result = call();
        confirmedApiCalls[name].returned++;
        return result;
      };
      const result = language === 'toc' ? {language, parsed: invoke('parseToc', () => parseToc(content, sourcePath))} :
        language === 'lua' ? {language, result: invoke('analyzeLua', () => analyzeLua(content, sourcePath,
          {addonId, conditions, profile: luaProfile, allowShebang, context: {kind: 'chunk'}}))} :
          {language, syntax: invoke('parseXml', () => parseXml(content, sourcePath)),
            provider: invoke('analyzeXml', () => analyzeXml(content, sourcePath, {addonId, conditions, policy: xmlPolicy})), inline: []};
      changeReply?.(input, result);
      return {result, confirmedApiCalls};
    };
  });
}

test('private graph result composes real providers, duplicate origins and a separately allowlisted wire result', async () => {
  const replies = new Map();
  const prepared = context(), request = getGraphRequest(prepared), fixture = memoryHost(simple(), host => {
    const analyze = host.analyze;
    host.analyze = async input => {
      const reply = await analyze(input);
      replies.set(JSON.stringify(input), structuredClone(reply));
      return reply;
    };
  });
  const result = await analyzeSelectedSources(request, fixture.host);
  assert.deepEqual(Object.keys(result).sort(), ['schemaVersion', 'completeUnderPolicy', 'groups', 'nodes', 'analyses', 'guardEvaluations',
    'references', 'occurrences', 'declarationOrigins', 'diagnostics', 'issues', 'resolved', 'aggregate'].sort());
  assert.equal(fixture.closes, 1); assert.equal(result.completeUnderPolicy, true);
  assert.deepEqual(result.resolved.activeGlobals, ['DB', 'Child', 'Out', 'Core']);
  assert.equal(result.declarationOrigins.filter(row => row.declaration.name === 'Core').length, 3);
  assert.equal(result.aggregate.languages.lua.syntaxVerdictFiles, 1);
  assert.equal(result.aggregate.inlineLua.syntaxAccepted, 2);
  assert.deepEqual(result.aggregate.confirmedApiCalls.analyzeLua, {invoked: 3, returned: 3});
  assert.equal(result.aggregate.fullParsing, false); assert.equal(result.aggregate.clientConformance, false);
  const wire = JSON.stringify(result.aggregate);
  for (const secret of ['Demo', 'Core.lua', 'View.xml', 'logicalAddonId', 'sourcePath', 'fingerprint', 'SavedVariables', 'Out=1']) assert.equal(wire.includes(secret), false);
  assert.equal(result.aggregate.status, 'passed'); assert.equal(Object.isFrozen(request), true);
  let syntaxReads = 0;
  const compact = memoryHost(simple(), host => {
    host.analyze = async input => {
      const reply = structuredClone(replies.get(JSON.stringify(input)));
      assert.ok(reply);
      if (input.language === 'xml') {
        const syntax = reply.result.syntax;
        Object.defineProperty(reply.result, 'syntax', {enumerable: true, get() {syntaxReads++; return syntax;}});
        for (const row of [reply.result, syntax]) {
          Object.defineProperty(row, Symbol('ignored field'), {enumerable: true, get() {assert.fail('unexpected symbol read');}});
        }
      }
      return reply;
    };
  });
  assert.deepEqual(await analyzeSelectedSourceAggregate(request, compact.host), result.aggregate);
  assert.equal(syntaxReads, 2);
  assert.deepEqual(compact.reads, fixture.reads);
  assert.equal(compact.closes, 1);
});

test('aggregate-only validation can release XML trees before resolving an authored graph under pressure', async () => {
  const files = simple();
  const xml = ['View.xml', 'More.xml', 'EvenMore.xml', 'End.xml'];
  files['Demo/Demo_Vanilla.toc'] = ['## SavedVariables: DB', ...xml, 'Core.lua'].join('\n');
  for (const [document, filename] of xml.entries()) {
    const frames = Array.from({length: 35}, (_, row) =>
      '<Frame name="Frame' + document + 'N' + row + '" virtual="false"/>');
    files['Demo/' + filename] = ['<Ui>', ...frames, '</Ui>'].join('\n');
  }
  const original = authoredWithoutInline(files);
  const full = await analyzeSelectedSources(getGraphRequest(context()), original.host);
  const retainedRecords = 10000;
  const lower = getGraphRequest(context(input => {input.profile.limits = {retainedRecords};}));
  const constrained = authoredWithoutInline(files);
  const insufficient = (await analyzeSelectedSources(lower, constrained.host)).aggregate;
  assert.equal(insufficient.status, 'failed');
  assert.ok(insufficient.issuesByCode.SGRAPH0005 > 0);
  assert.ok(insufficient.languages.xml.syntaxVerdictFiles < xml.length);
  const compact = authoredWithoutInline(files);
  const actual = await analyzeSelectedSourceAggregate(lower, compact.host);
  assert.deepEqual(actual, full.aggregate);
  assert.deepEqual(compact.reads, original.reads);
  assert.equal(compact.closes, 1);
  assert.equal(actual.languages.xml.syntaxVerdictFiles, xml.length);
  assert.ok(full.analyses.filter(row => row.result.language === 'xml').every(row => row.result.syntax.elements.length === 36));
});

test('aggregate-only validation still rejects a changed discarded syntax tree', async () => {
  const request = getGraphRequest(context());
  const files = {...simple(), 'Demo/View.xml': '<Ui><Include file="Child.xml"/></Ui>', 'Demo/Child.xml': '<Ui/>'};
  const corrupted = () => authoredWithoutInline(files, (input, result) => {
    if (input.language === 'xml' && slash(input.sourcePath) === 'Demo/View.xml') {
      result.syntax.elements.pop();
    }
  });
  const full = corrupted(), compact = corrupted();
  const expected = (await analyzeSelectedSources(request, full.host)).aggregate;
  const actual = await analyzeSelectedSourceAggregate(request, compact.host);
  assert.deepEqual(actual, expected);
  assert.equal(actual.languages.xml.syntaxVerdictFiles, 0);
  assert.deepEqual(compact.reads, full.reads);
  assert.equal(compact.closes, 1);
});

test('final integrity failure withdraws affected syntax/API/resolution credit while an independent group remains', async () => {
  const prepared = context(input => input.profile.addons.push({logicalAddonId: 'other', directory: 'Other', addonBaseName: 'Other', tocPaths: ['Other/Other.toc']}));
  const fixture = memoryHost({...simple(), 'Other/Other.toc': '## SavedVariables: Good\nFine.lua', 'Other/Fine.lua': 'Fine=1'},
    host => {host.verifySource = async name => !slash(name).endsWith('Core.lua');});
  const result = await analyzeSelectedSources(getGraphRequest(prepared), fixture.host);
  assert.deepEqual(result.resolved.activeGlobals, ['Good', 'Fine']);
  assert.deepEqual(result.groups.map(row => row.resolutionEligible), [false, true]);
  assert.equal(result.aggregate.languages.lua.syntaxVerdictFiles, 1);
  assert.equal(result.aggregate.languages.lua.skippedBeforeSyntaxVerdict.readRejected, 1);
  assert.equal(result.aggregate.completeUnderPolicy, false); assert.equal(result.aggregate.status, 'failed');
  assert.equal(result.aggregate.resolution.coreComplete, true); assert.equal(result.aggregate.resolution.complete, false);
});

test('invalid preflight and exhausted publication never return a fabricated resolver prefix and always close the host', async () => {
  const invalid = memoryHost(simple());
  await assert.rejects(analyzeSelectedSources({}, invalid.host), error => error.code === 'SGRAPH0001');
  assert.equal(invalid.closes, 1); assert.deepEqual(invalid.reads, []);
  let now = 0;
  const prepared = context(), fixture = memoryHost(simple(), host => {
    host.nowMilliseconds = () => now; const close = host.close;
    host.close = async () => {await close(); now = 900000;};
  });
  await assert.rejects(analyzeSelectedSources(getGraphRequest(prepared), fixture.host), error => error.code === 'SGRAPH0005');
  assert.equal(fixture.closes, 1);
});
