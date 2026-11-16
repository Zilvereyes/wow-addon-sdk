import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { WoWClient, WoWGameMode } from '@wow-addon/addon-metadata';
import { parseToc } from '@wow-addon/toc-parser';
import * as adapter from '@wow-addon/toc-metadata-adapter';
import { listGlobals } from '@wow-addon/global-registry';

const logicalId = 'installation/one';
const era = { schemaVersion: 1, client: WoWClient.ClassicEra, clientFamily: 'classic' };
const retail = { schemaVersion: 1, client: WoWClient.Retail, clientFamily: 'mainline' };
const policy = overrides => ({ schemaVersion: 1, id: 'authored-fixture', client: WoWClient.ClassicEra,
  clientFamily: 'classic', suffixPrecedence: ['Vanilla', 'Classic', null], ...overrides });
function candidate(tocPath, text = '## SavedVariables: DB', id = logicalId) {
  const parsed = parseToc(text, tocPath);
  return { identity: {
    logicalAddonId: id, tocVariantId: JSON.stringify([id, tocPath]), tocPath,
    tocSuffix: parsed.metadata.tocSuffix, source: parsed.entries[0].source,
  }, metadata: parsed.metadata };
}
function select(candidates, p = policy(), environment = era, id = logicalId, base = 'Addon') {
  assert.equal(typeof adapter.selectTocVariant, 'function', 'approved selector export is absent');
  return adapter.selectTocVariant(environment, id, base, candidates, p);
}
const selected = entry => ({ status: 'selected', selectedVariantId: entry.identity.tocVariantId, issues: [] });
function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => j !== i)).map(rest => [item, ...rest]));
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('v0.3.1 exposes the five approved beta contracts with readonly TypeScript boundaries', () => {
  const result = spawnSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--exactOptionalPropertyTypes',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'tests/contracts/v031.ts',
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('selection follows the explicit policy across every input permutation', () => {
  const vanilla = candidate('A/Addon_Vanilla.toc');
  const classic = candidate('A/Addon_Classic.toc');
  const plain = candidate('A/Addon.toc');
  for (const entries of permutations([plain, vanilla, classic])) assert.deepEqual(select(entries), selected(vanilla));
  assert.deepEqual(select([vanilla, classic], policy({ suffixPrecedence: ['Classic', 'Vanilla'] })), selected(classic));
  assert.deepEqual(select([vanilla, plain], policy({ suffixPrecedence: [null, 'Vanilla'] })), selected(plain));
  assert.deepEqual(select([classic, candidate('B/Addon_Classic.toc'), vanilla]), selected(vanilla));
});

test('fallback must be an exact base filename; parser null on unfamiliar suffix is not fallback', () => {
  const future = candidate('A/Addon_Future.toc');
  const plain = candidate('A/Addon.toc');
  const onlyFuture = select([future], policy({ suffixPrecedence: [null] }));
  assert.equal(onlyFuture.status, 'no-match');
  assert.equal(Object.hasOwn(onlyFuture, 'selectedVariantId'), false);
  assert.deepEqual(select([future, plain], policy({ suffixPrecedence: [null] })), selected(plain));
  assert.equal(select([candidate('A/Other.toc')]).status, 'no-match');
});

test('safe caller-classified future suffix requires explicit matching identity, metadata and policy', () => {
  const future = candidate('A/Addon_Future.toc');
  future.identity.tocSuffix = 'Future'; future.metadata.tocSuffix = 'Future';
  assert.equal(select([future]).status, 'no-match');
  assert.deepEqual(select([future], policy({ suffixPrecedence: ['Future'] })), selected(future));
});

test('suffix and extension comparisons ignore case while exact paths and basename Unicode remain significant', () => {
  const mixed = candidate('Å\\dir/Addon_vAnIlLa.TOC');
  mixed.identity.tocSuffix = 'vAnIlLa';
  assert.deepEqual(select([mixed], policy({ suffixPrecedence: ['VANILLA'] })), selected(mixed));
  assert.equal(select([candidate('A/addon_Vanilla.toc')]).status, 'no-match');
  const unicode = candidate('A/Å_Vanilla.toc');
  assert.deepEqual(select([unicode], policy(), era, logicalId, 'Å'), selected(unicode));
  assert.equal(select([unicode], policy(), era, logicalId, 'A\u030A').status, 'no-match');
});

test('best-priority ties are ambiguous with canonical sources, independent of input order', () => {
  const a = candidate('A/Addon_Vanilla.toc'); const b = candidate('B/Addon_Vanilla.toc');
  const first = select([b, a]); const second = select([a, b]);
  assert.equal(first.status, 'ambiguous');
  assert.equal(Object.hasOwn(first, 'selectedVariantId'), false);
  assert.deepEqual(first, second);
  assert.equal(first.issues[0].code, 'TOCSEL0003');
  assert.deepEqual(first.issues[0].sources.map(s => s.file), ['A/Addon_Vanilla.toc', 'B/Addon_Vanilla.toc']);
});

test('ambiguity sources sharing a file sort by numeric UTF-16 position', () => {
  const a = candidate('A/Addon_Vanilla.toc'); const b = candidate('B/Addon_Vanilla.toc');
  a.identity.source = { file: 'shared-origin.toc', range: { start: { line: 0, column: 10 }, end: { line: 0, column: 11 } } };
  b.identity.source = { file: 'shared-origin.toc', range: { start: { line: 0, column: 2 }, end: { line: 0, column: 3 } } };
  assert.deepEqual(select([a, b]), select([b, a]));
  assert.deepEqual(select([a, b]).issues[0].sources.map(s => s.range.start.column), [2, 10]);
});

test('duplicate exact variant identities invalidate the whole selection', () => {
  const a = candidate('A/Addon_Vanilla.toc'); const duplicate = structuredClone(a);
  duplicate.identity.source.range.start.column = 1;
  duplicate.identity.source.range.end.column = 2;
  for (const entries of [[a, duplicate], [duplicate, a]]) {
    const result = select(entries);
    assert.equal(result.status, 'invalid');
    assert.ok(result.issues.some(i => i.code === 'TOCSEL0002'));
    assert.equal(Object.hasOwn(result, 'selectedVariantId'), false);
  }
  assert.deepEqual(select([a, duplicate]), select([duplicate, a]));
});

test('unknown environments stay unresolved and contradictory known family/schema is invalid', () => {
  const c = [candidate('A/Addon_Vanilla.toc')];
  for (const e of [{ ...era, client: WoWClient.Unknown }, { ...era, client: 'future-client' }, { ...era, clientFamily: 'unknown' }]) {
    const result = select(c, policy(), e);
    assert.equal(result.status, 'unresolved');
    assert.equal(result.issues[0].code, 'TOCSEL0004');
  }
  for (const e of [null, {}, { ...era, schemaVersion: 2 }, { ...era, clientFamily: 'mainline' }]) {
    assert.equal(select(c, policy(), e).status, 'invalid');
  }
  assert.equal(select(c, policy(), retail).status, 'unresolved');
});

test('optional caller applicability constraints require exact values without defaults or invented semantics', () => {
  const c = candidate('A/Addon_Vanilla.toc');
  const p = policy({ gameType: 'caller-type', gameMode: WoWGameMode.Hardcore });
  const e = { ...era, gameType: 'caller-type', gameMode: WoWGameMode.Hardcore };
  assert.deepEqual(select([c], p, e), selected(c));
  for (const value of [era, { ...e, gameType: 'Caller-Type' }, { ...e, gameMode: WoWGameMode.Unknown }, { ...e, gameMode: 'future-mode' }]) {
    assert.equal(select([c], p, value).status, 'unresolved');
  }
  assert.deepEqual(select([c], policy(), { ...era, textLocale: 'future-locale', gameMode: WoWGameMode.Unknown }), selected(c));
});

test('supplied optional environment fields require string shape even when the policy does not constrain them', () => {
  const c = candidate('A/Addon_Vanilla.toc');
  for (const field of ['gameType', 'gameMode', 'textLocale']) {
    for (const value of [null, 42, {}, [], undefined]) {
      assert.equal(select([c], policy(), { ...era, [field]: value }).status, 'invalid', field);
    }
  }
  assert.deepEqual(select([c], policy(), { ...era, gameType: 'future-type', gameMode: 'future-mode', textLocale: 'future-locale' }), selected(c));
});

test('malformed policies, duplicate priorities and unsafe tokens are invalid', () => {
  for (const p of [null, {}, policy({ schemaVersion: 2 }), policy({ id: '' }), policy({ client: WoWClient.Unknown }),
    policy({ clientFamily: 'mainline' }), policy({ suffixPrecedence: [] }), policy({ suffixPrecedence: ['Vanilla', 'VANILLA'] }),
    policy({ suffixPrecedence: [null, null] }), policy({ suffixPrecedence: ['../Vanilla'] }), policy({ suffixPrecedence: ['Vanilla:stream'] }),
    policy({ suffixPrecedence: [' Vanilla'] }), policy({ suffixPrecedence: [undefined] }), policy({ suffixPrecedence: Array(1) }),
    policy({ gameType: '' }), policy({ gameMode: WoWGameMode.Unknown })]) {
    const result = select([], p);
    assert.equal(result.status, 'invalid', JSON.stringify(p));
    assert.equal(result.issues[0].code, 'TOCSEL0001');
  }
});

test('mismatched identities/metadata and invalid source positions cannot be ignored in favor of a good candidate', () => {
  const good = candidate('A/Addon_Vanilla.toc');
  const mutations = [
    c => { c.identity.logicalAddonId = 'other'; },
    c => { c.identity.tocVariantId = 'wrong-key'; },
    c => { c.metadata.tocPath = 'alias/Addon_Classic.toc'; },
    c => { c.metadata.tocSuffix = 'Wrath'; },
    c => { c.metadata.schemaVersion = 1; },
    c => { c.identity.source.range.start.line = -1; },
    c => { c.identity.source.range.end.column = -1; },
    c => { c.identity.source.range.start.column = 3; c.identity.source.range.end.column = 2; },
    c => { c.identity.source.range.start.line = 2; c.identity.source.range.end.line = 1; },
    c => { c.identity.source.range.end.column = Number.MAX_SAFE_INTEGER + 1; },
    c => { c.identity.source.file = ''; },
    c => { c.identity.source = null; },
  ];
  for (const mutate of mutations) {
    const bad = candidate('A/Addon_Classic.toc'); mutate(bad);
    const result = select([good, bad]);
    assert.equal(result.status, 'invalid');
    assert.ok(result.issues.some(i => i.code === 'TOCSEL0002'));
  }
  assert.equal(select([null]).status, 'invalid');
  assert.equal(select(null).status, 'invalid');
});

test('empty candidates are no-match; empty IDs or unsafe base names are invalid', () => {
  assert.deepEqual(select([]), { status: 'no-match', issues: [] });
  assert.equal(select([], policy(), era, '').status, 'invalid');
  for (const base of ['', '../Addon', 'A/Addon', 'A\\Addon', 'A:Addon', '.', '..']) {
    assert.equal(select([], policy(), era, logicalId, base).status, 'invalid', base);
  }
});

test('frozen source records support independent environments and derived issues do not alias source ranges', () => {
  const a = candidate('A/Addon_Vanilla.toc', '## SavedVariables: EraDB');
  const b = candidate('B/Addon_Mainline.toc', '## SavedVariables: RetailDB');
  const records = freeze([a, b]); const before = JSON.stringify(records);
  assert.deepEqual(select(records), selected(a));
  assert.deepEqual(select(records, policy({ client: WoWClient.Retail, clientFamily: 'mainline', suffixPrecedence: ['Mainline', null] }), retail), selected(b));
  assert.equal(JSON.stringify(records), before);
  const tie = freeze([candidate('A/Addon_Vanilla.toc'), candidate('B/Addon_Vanilla.toc')]);
  const result = select(tie);
  result.issues[0].sources[0].range.start.column = 999;
  assert.equal(tie[0].identity.source.range.start.column, 0);
  assert.deepEqual(listGlobals(adapter.buildTocGlobalRegistry(records.map(c => c.metadata))), ['EraDB', 'RetailDB']);
});

test('derived source diagnostics contain only canonical range fields, not unknown caller properties', () => {
  const a = candidate('A/Addon_Vanilla.toc'); const b = candidate('B/Addon_Vanilla.toc');
  a.identity.source.range.start.extra = 1n;
  const result = select([a, b]);
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.issues[0].sources[0].range.start, { line: 0, column: 0 });
  assert.doesNotThrow(() => JSON.stringify(result));
});
