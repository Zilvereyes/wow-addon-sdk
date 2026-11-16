import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as adapter from '@wow-addon/toc-metadata-adapter';
import { parseToc } from '@wow-addon/toc-parser';
import { listGlobals } from '@wow-addon/global-registry';
import { WoWClient } from '@wow-addon/addon-metadata';

const environment = overrides => ({ schemaVersion: 1, client: WoWClient.ClassicEra,
  clientFamily: 'classic', gameType: 'vanilla', textLocale: 'enUS', ...overrides });
const conditionPolicy = JSON.parse(fs.readFileSync('examples/classic-era-condition-profile.json', 'utf8')).policy;
const source = (file = 'Fixture.lua', column = 0) => ({ file, range: {
  start: { line: 0, column }, end: { line: 0, column: column + 1 },
} });
const selectionPolicy = overrides => ({ schemaVersion: 1, id: 'authored-selection', client: WoWClient.ClassicEra,
  clientFamily: 'classic', suffixPrecedence: ['Vanilla', 'Classic', null], ...overrides });
function candidate(id, path, content = '## SavedVariables: DB') {
  const parsed = parseToc(content, path);
  return { identity: { logicalAddonId: id, tocVariantId: JSON.stringify([id, path]),
    tocPath: path, tocSuffix: parsed.metadata.tocSuffix, source: parsed.entries[0].source }, metadata: parsed.metadata };
}
function group(overrides = {}) {
  const id = overrides.logicalAddonId ?? 'installation/Å';
  return { logicalAddonId: id, addonBaseName: 'A', selectionPolicy: selectionPolicy(), candidates: [
    candidate(id, 'Å\\A_Vanilla.toc', '## SavedVariables: Era, Shared\n## SavedVariables[AllowLoadGameType vanilla]: Conditional'),
    candidate(id, 'Å/A_Mainline.toc', '## SavedVariablesPerCharacter: Shared, Retail'),
  ], ...overrides };
}
const global = (name = 'Provider', overrides = {}) => ({ name, addonId: 'original-provider-id', kind: 'lua-global',
  activationState: 'unconditional', source: source(), ...overrides });
const descriptor = (values = ['vanilla'], overrides = {}) => ({ providerId: '@wow-addon/toc-metadata-adapter',
  name: 'AllowLoadGameType', values, raw: '[AllowLoadGameType vanilla]', source: source('restriction.toc'), ...overrides });
const bundle = (g, declarations, overrides = {}) => ({ providerId: 'synthetic-lua',
  tocVariantId: g.candidates[0].identity.tocVariantId, declarations, ...overrides });
function resolve(inputs, e = environment(), p = conditionPolicy) {
  assert.equal(typeof adapter.resolveGlobalRegistry, 'function', 'approved resolver export is absent');
  return adapter.resolveGlobalRegistry(e, inputs, p);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const records = result => result.entries.flatMap(entry => entry.declarations);

test('v0.3.4 provides the six approved beta contracts and a distinct readonly result schema', () => {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict',
    '--exactOptionalPropertyTypes', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'tests/contracts/v034.ts'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('select before evaluation: no non-selected symbols, declarations or false scope conflict', () => {
  const g = freeze(group()); const before = JSON.stringify(g);
  const result = resolve([g]);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.complete, true);
  assert.deepEqual(result.activeGlobals, ['Era', 'Shared', 'Conditional']);
  assert.deepEqual(result.entries.map(e => e.name), ['Era', 'Shared', 'Conditional']);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.addons[0].selection.selectedVariantId, g.candidates[0].identity.tocVariantId);
  assert.ok(records(result).every(r => r.tocVariantId === g.candidates[0].identity.tocVariantId));
  assert.equal(JSON.stringify(g), before);
});

test('known-true conditional names are visible without rewriting static activation or static queries', () => {
  const g = group(); const staticBefore = listGlobals(adapter.buildTocGlobalRegistry(g.candidates.map(c => c.metadata)));
  const result = resolve([g]);
  const conditional = result.entries.find(e => e.name === 'Conditional').declarations[0];
  assert.equal(conditional.declaration.activationState, 'conditional');
  assert.equal(conditional.evaluation.availability, 'active');
  assert.ok(result.activeGlobals.includes('Conditional'));
  assert.deepEqual(listGlobals(adapter.buildTocGlobalRegistry(g.candidates.map(c => c.metadata))), staticBefore);
  assert.ok(staticBefore.includes('Retail'));
  assert.equal(staticBefore.includes('Conditional'), false);
});

test('independent environments/policies reuse frozen source candidates without cached selection leakage', () => {
  const g = freeze(group());
  const retail = { ...g, selectionPolicy: selectionPolicy({ client: WoWClient.Retail,
    clientFamily: 'mainline', suffixPrecedence: ['Mainline', null] }) };
  const retailEnvironment = environment({ client: WoWClient.Retail, clientFamily: 'mainline', gameType: 'standard' });
  const a = resolve([g]); const b = resolve([retail], retailEnvironment);
  assert.deepEqual(a.activeGlobals, ['Era', 'Shared', 'Conditional']);
  assert.deepEqual(b.activeGlobals, ['Shared', 'Retail']);
  assert.equal(b.complete, true);
  assert.deepEqual(resolve([g]), a);
  const incompatible = resolve([g], retailEnvironment);
  assert.equal(incompatible.complete, false);
  assert.deepEqual(incompatible.activeGlobals, []);
  assert.equal(incompatible.addons[0].selection.status, 'unresolved');
});

test('selected providers preserve exact origins while non-selected contents are not consumed', () => {
  const g = group();
  g.providers = [bundle(g, [global('Lua')]), bundle(g, [null], {
    providerId: 'synthetic-xml', tocVariantId: g.candidates[1].identity.tocVariantId,
  })];
  const result = resolve([freeze(g)]);
  assert.equal(result.complete, true);
  assert.ok(result.activeGlobals.includes('Lua'));
  const lua = result.entries.find(e => e.name === 'Lua').declarations[0];
  assert.equal(lua.providerId, 'synthetic-lua');
  assert.equal(lua.originalAddonId, 'original-provider-id');
  assert.equal(lua.declaration.addonId, g.logicalAddonId);
  assert.deepEqual(lua.declaration.source, source());
  assert.ok(records(result).filter(r => r.providerId === '@wow-addon/toc-metadata-adapter')
    .every(r => r.originalAddonId === g.candidates[0].metadata.tocPath));
});

test('provider declarations can inherit another provider condition ID without rewriting its provenance', () => {
  const g = group(); g.providers = [bundle(g, [global('Frame', { kind: 'frame', activationState: 'conditional',
    conditions: [descriptor()] })], { providerId: 'synthetic-xml' })];
  const result = resolve([g]);
  const frame = result.entries.find(e => e.name === 'Frame').declarations[0];
  assert.equal(frame.providerId, 'synthetic-xml');
  assert.equal(frame.declaration.conditions[0].providerId, '@wow-addon/toc-metadata-adapter');
  assert.equal(frame.evaluation.availability, 'active');
  assert.ok(result.activeGlobals.includes('Frame'));
});

test('only active declarations under the same logical ID produce coexistence scope warnings', () => {
  const id = 'installation/Å';
  const g = group({ candidates: [candidate(id, 'A/A_Vanilla.toc', '## SavedVariables: DB')] });
  const conflict = global('DB', { kind: 'saved-variable', scope: 'character' });
  g.providers = [bundle(g, [conflict])];
  const active = resolve([g]);
  assert.deepEqual(active.diagnostics.map(d => d.code), ['SV0001']);
  assert.ok(records(active).every(r => r.declaration.addonId === id));
  for (const values of [['standard'], ['vanilla']]) {
    const unknown = values[0] === 'vanilla';
    const guarded = { ...g, providers: [bundle(g, [{ ...conflict, activationState: 'conditional',
      conditions: [descriptor(values, unknown ? { name: 'Unsupported' } : {})] }])] };
    const result = resolve([guarded]);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.activeGlobals, ['DB']);
    assert.equal(result.complete, !unknown);
    assert.equal(result.entries[0].declarations[1].evaluation.availability, unknown ? 'unknown' : 'inactive');
  }
  const other = group({ logicalAddonId: 'other', candidates: [candidate('other', 'A/A_Vanilla.toc',
    '## SavedVariablesPerCharacter: DB')] });
  assert.deepEqual(resolve([{ ...g, providers: [] }, other]).diagnostics, []);
});

test('inactive/unknown selected entries remain inspectable but never manufacture active names', () => {
  const g = group(); g.providers = [bundle(g, [
    global('Inactive', { activationState: 'conditional', conditions: [descriptor(['standard'])] }),
    global('Unknown', { activationState: 'unknown' }),
    global('Legacy', { activationState: 'conditional' }),
  ])];
  const result = resolve([g]);
  assert.equal(result.complete, false);
  assert.deepEqual(result.entries.map(e => e.name), ['Era', 'Shared', 'Conditional', 'Inactive', 'Unknown', 'Legacy']);
  assert.deepEqual(result.activeGlobals, ['Era', 'Shared', 'Conditional']);
  assert.equal(result.entries.find(e => e.name === 'Legacy').declarations[0].evaluation.reason, 'missing-provenance');
});

test('known inactive false-plus-unknown conditions retain issues without making availability incomplete', () => {
  const g = group(); g.providers = [bundle(g, [global('Excluded', { activationState: 'conditional',
    conditions: [descriptor(['standard']), descriptor(['x'], { name: 'Unsupported' })] })])];
  const result = resolve([g]);
  assert.equal(result.complete, true);
  const excluded = result.entries.find(e => e.name === 'Excluded').declarations[0];
  assert.equal(excluded.evaluation.availability, 'inactive');
  assert.deepEqual(excluded.evaluation.issues.map(i => i.code), ['CONDEVAL0003', 'CONDEVAL0006']);
  assert.equal(result.activeGlobals.includes('Excluded'), false);
});

test('duplicate logical IDs exclude all colliding groups while independent valid groups form a partial result', () => {
  const a = group(); const b = group();
  const other = group({ logicalAddonId: 'independent', candidates: [candidate('independent', 'A/A_Vanilla.toc', '## SavedVariables: Independent')] });
  const result = resolve([a, b, other]);
  assert.equal(result.complete, false);
  assert.deepEqual(result.activeGlobals, ['Independent']);
  assert.ok(result.issues.some(i => i.code === 'RESOLVE0002' && i.logicalAddonId === a.logicalAddonId));
  assert.deepEqual(result.addons.map(a => a.logicalAddonId), ['independent']);
});

test('no-match is a known empty selection; ambiguous/invalid variants never contribute globals', () => {
  const id = 'installation/Å';
  const noMatch = resolve([group({ candidates: [candidate(id, 'A/A_Future.toc')] })]);
  assert.equal(noMatch.complete, true);
  assert.deepEqual(noMatch.activeGlobals, []);
  assert.equal(noMatch.addons[0].selection.status, 'no-match');
  const a = candidate(id, 'A/A_Vanilla.toc'); const b = candidate(id, 'B/A_Vanilla.toc');
  for (const candidates of [[a, b], [a, structuredClone(a)]]) {
    const result = resolve([group({ candidates })]);
    assert.equal(result.complete, false);
    assert.deepEqual(result.activeGlobals, []);
    assert.ok(['ambiguous', 'invalid'].includes(result.addons[0].selection.status));
  }
});

test('root context/policy are validated even for an empty AddOn list', () => {
  assert.deepEqual(resolve([]), { schemaVersion: 1, complete: true, activeGlobals: [], entries: [], addons: [], diagnostics: [], issues: [] });
  for (const [inputs, e, p] of [[null, environment(), conditionPolicy], [[], null, conditionPolicy],
    [[], environment({ client: WoWClient.Unknown }), conditionPolicy], [[], environment(), {}],
    [[], environment({ clientFamily: 'mainline' }), conditionPolicy]]) {
    const result = resolve(inputs, e, p);
    assert.equal(result.complete, false);
    assert.deepEqual(result.activeGlobals, []);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.issues.map(i => i.code), ['RESOLVE0001']);
    assert.deepEqual(result.issues[0].sources, []);
  }
});

test('malformed group shapes never throw or create fabricated logical IDs', () => {
  const g = group();
  for (const value of [null, [], {}, { ...g, logicalAddonId: '' }, { ...g, addonBaseName: '../A' }, { ...g, candidates: null }]) {
    const result = resolve([value]);
    assert.equal(result.complete, false);
    assert.deepEqual(result.activeGlobals, []);
    assert.ok(result.issues.some(i => i.code === 'RESOLVE0002'));
    if (!value?.logicalAddonId) assert.equal(Object.hasOwn(result.issues[0], 'logicalAddonId'), false);
  }
  const partial = resolve([undefined, g]);
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.activeGlobals, ['Era', 'Shared', 'Conditional']);
});

test('invalid provider associations and selected projection errors exclude the entire AddOn', () => {
  const g = group();
  const selected = bundle(g, [global()]);
  for (const provider of [null, { ...selected, providerId: '' }, { ...selected, tocVariantId: 'foreign' },
    { ...selected, declarations: null }, { ...selected, declarations: Array(1) }, { ...selected, declarations: [null] },
    { ...selected, declarations: [global(), { ...global('Bad'), source: null }] },
    { ...selected, declarations: [global('Bad', { activationState: 'unconditional', conditions: [descriptor()] })] }]) {
    const result = resolve([{ ...g, providers: [provider] }]);
    assert.equal(result.complete, false);
    assert.deepEqual(result.activeGlobals, []);
    assert.ok(result.issues.some(i => i.code === 'RESOLVE0003'));
  }
  const explicitUndefined = resolve([{ ...g, providers: undefined }]);
  assert.equal(explicitUndefined.complete, false);
});

test('selected malformed metadata projections cannot throw or leak partial SavedVariables', () => {
  for (const mutate of [m => { m.savedVariableDeclarations = null; },
    m => { m.savedVariableDeclarations = Array(1); }, m => { m.savedVariableDeclarations[0].conditions = null; },
    m => { m.savedVariableDeclarations[0].validIdentifier = 'yes'; }]) {
    const g = group(); mutate(g.candidates[0].metadata);
    const result = resolve([g]);
    assert.equal(result.complete, false);
    assert.deepEqual(result.activeGlobals, []);
    assert.ok(result.issues.some(i => i.code === 'RESOLVE0002'));
  }
  const id = 'installation/Å';
  const valid = resolve([group({ candidates: [candidate(id, 'A/A_Vanilla.toc', '## SavedVariables: bad-name, Good')] })]);
  assert.equal(valid.complete, true);
  assert.deepEqual(valid.activeGlobals, ['Good']);
});

test('first-seen order and duplicate provider batches are retained without global-name duplication', () => {
  const g = group(); g.providers = [bundle(g, [global('Duplicate', { addonId: 'first' })]),
    bundle(g, [global('Duplicate', { addonId: 'second' }), global('Last')])];
  const result = resolve([g]);
  assert.deepEqual(result.activeGlobals, ['Era', 'Shared', 'Conditional', 'Duplicate', 'Last']);
  assert.deepEqual(result.entries.find(e => e.name === 'Duplicate').declarations.map(d => d.originalAddonId), ['first', 'second']);
  assert.deepEqual(resolve([{ ...g, candidates: [...g.candidates].reverse() }]), result);
});

test('opaque prototype-like IDs/names and significant whitespace remain exact caller identities', () => {
  const id = '__proto__'; const g = group({ logicalAddonId: id, candidates: [candidate(id, 'A/A_Vanilla.toc', '## SavedVariables: __proto__')] });
  assert.deepEqual(resolve([g]).activeGlobals, ['__proto__']);
  const spaced = group({ logicalAddonId: ' __proto__ ', candidates: [candidate(' __proto__ ', 'A/A_Vanilla.toc', '## SavedVariables: Other')] });
  const result = resolve([g, spaced]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.addons.map(a => a.logicalAddonId), [id, ' __proto__ ']);
});

test('all returned declaration/condition/source trees are independent of frozen inputs and other calls', () => {
  const g = group(); g.providers = [bundle(g, [global('Provider', { activationState: 'conditional', conditions: [descriptor()] })])];
  freeze(g); const e = freeze(environment()); const p = freeze(structuredClone(conditionPolicy));
  const before = JSON.stringify([g, e, p]);
  const first = resolve([g], e, p); const second = resolve([g], e, p); const stable = JSON.stringify(second);
  const provider = first.entries.find(e => e.name === 'Provider').declarations[0];
  provider.declaration.addonId = 'changed'; provider.declaration.source.file = 'changed';
  provider.declaration.source.range.start.column = 99;
  provider.declaration.conditions[0].values.push('changed');
  provider.declaration.conditions[0].source.range.end.line = 99;
  assert.equal(JSON.stringify([g, e, p]), before);
  assert.equal(JSON.stringify(second), stable);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), second);
});

test('projection copies omit unknown source fields while root issue provenance is canonical and independent', () => {
  const g = group(); g.candidates[0].metadata.savedVariableDeclarations[0].source.range.start.extra = 1n;
  const result = resolve([g]);
  assert.doesNotThrow(() => JSON.stringify(result));
  const invalid = group({ addonBaseName: '../A' });
  invalid.candidates[0].identity.source = source('shared.toc', 10);
  invalid.candidates[1].identity.source = source('shared.toc', 2);
  const issues = resolve([invalid]).issues;
  assert.deepEqual(issues[0].sources.map(s => s.range.start.column), [2, 10]);
  issues[0].sources[0].range.start.column = 999;
  assert.equal(invalid.candidates[1].identity.source.range.start.column, 2);
});

test('scope-diagnostic sources are owned by the result and never alias frozen metadata/provider inputs', () => {
  const id = 'installation/Å';
  const g = group({ candidates: [candidate(id, 'A/A_Vanilla.toc', '## SavedVariables: DB')] });
  g.providers = [bundle(g, [global('DB', { kind: 'saved-variable', scope: 'character' })])];
  freeze(g); const before = JSON.stringify(g);
  const result = resolve([g]);
  assert.equal(result.diagnostics.length, 1);
  result.diagnostics[0].source.file = 'edited';
  result.diagnostics[0].related[0].range.end.column = 999;
  assert.equal(JSON.stringify(g), before);
  assert.equal(resolve([g]).diagnostics[0].source.file, 'Fixture.lua');
});

test('non-selected metadata declaration contents do not affect a valid selected variant', () => {
  const g = group(); g.candidates[1].metadata.savedVariableDeclarations = null;
  const result = resolve([g]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.activeGlobals, ['Era', 'Shared', 'Conditional']);
});
