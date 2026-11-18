import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {test} from 'node:test';
import {prepareExperiment} from './prepare.mjs';

const load = name => JSON.parse(readFileSync(new URL('../../../examples/' + name, import.meta.url), 'utf8'));

test('both modes route only corpus Lua into a generated Worker launcher', async () => {
  const xmlPolicy = load('xml-provider-profile.json').policy;
  const inlineProfile = load('xml-inline-lua-profile.json');
  const make = (language, number, content, luaProfile = 'corpus') => ({
    language, sourcePath: `Authored/Case-${number}.${language}`, content, addonId: 'authored-mixed',
    conditions: [], luaProfile, allowShebang: false, xmlPolicy, inlineProfile,
  });
  const requests = [
    make('toc', 1, '## Interface: 11509\nCore.lua'),
    make('xml', 2, '<Ui><Script>Inline=1</Script></Ui>'),
    make('lua', 3, 'Bounded=1', 'bounded'),
    make('lua', 4, 'Corpus=1'),
  ];
  const {createStock, createCandidate, cleanup} = await prepareExperiment();
  try {
    for (const [mode, create] of [['stock', createStock], ['candidate', createCandidate]]) {
      const launches = [];
      const port = create({spawnProcess(executable, argv, options) {
        assert.equal(executable, process.execPath);
        assert.equal(options.shell, false);
        launches.push(argv.map(arg => basename(arg)));
        throw Error('Fixture observes argv only.');
      }});
      try {
        for (const request of requests) await assert.rejects(port.analyze(request), /^Error: graph-analysis-start$/);
      } finally {await port.close();}
      assert.deepEqual(launches, [
        ['--max-old-space-size=256', 'selected-source-analysis-worker.mjs'],
        ['--max-old-space-size=256', 'selected-source-analysis-worker.mjs'],
        ['--max-old-space-size=128', '--stack_size=1024', 'selected-source-analysis-worker.mjs'],
        ['--max-old-space-size=2048', mode + '-worker.mjs', '--corpus-launcher'],
      ]);
    }
  } finally {await cleanup();}
});
