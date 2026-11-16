import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as adapter from '@wow-addon/toc-metadata-adapter';
import { parseToc } from '@wow-addon/toc-parser';
import { buildGlobalRegistry, listGlobals } from '@wow-addon/global-registry';
import { WoWClient, WoWGameMode } from '@wow-addon/addon-metadata';

const source = (file = 'A/Fixture.toc', column = 0) => ({ file, range: {
  start: { line: 0, column }, end: { line: 0, column: column + 1 },
} });
const environment = overrides => ({ schemaVersion: 1, client: WoWClient.ClassicEra,
  clientFamily: 'classic', gameType: 'vanilla', textLocale: 'enUS', ...overrides });
const rule = overrides => ({ providerId: 'authored-provider', name: 'Match',
  field: 'gameType', operator: 'include', valueComparison: 'exact', ...overrides });
const policy = overrides => ({ schemaVersion: 1, id: 'authored-test', nameComparison: 'exact', rules: [rule()], ...overrides });
const condition = (values = ['vanilla'], overrides = {}) => ({ providerId: 'authored-provider',
  name: 'Match', values, raw: `[Match ${values.join(',')}]`, source: source(), ...overrides });
const declaration = (conditions, activationState = 'conditional') => ({ name: 'DB', addonId: 'A',
  kind: 'saved-variable', scope: 'account', activationState, source: source(),
  ...(conditions === undefined ? {} : { conditions }),
});
function evaluate(d, e = environment(), p = policy()) {
  assert.equal(typeof adapter.evaluateGlobalConditions, 'function', 'approved evaluator export is absent');
  return adapter.evaluateGlobalConditions(d, e, p);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const codes = result => result.issues.map(i => i.code);

test('v0.3.3 provides five approved beta exports and readonly TypeScript contracts', () => {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict',
    '--exactOptionalPropertyTypes', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'tests/contracts/v033.ts'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('legacy missing/empty provenance never upgrades conditional or unknown activation', () => {
  for (const conditions of [undefined, []]) {
    assert.deepEqual(evaluate(declaration(conditions, 'unconditional')),
      { availability: 'active', reason: 'unconditional', issues: [] });
    const legacy = evaluate(declaration(conditions));
    assert.equal(legacy.availability, 'unknown');
    assert.equal(legacy.reason, 'missing-provenance');
    assert.deepEqual(codes(legacy), ['CONDEVAL0002']);
    assert.equal(evaluate(declaration(conditions, 'unknown')).availability, 'unknown');
  }
  assert.equal(evaluate(declaration([condition()], 'unknown')).availability, 'unknown');
  assert.equal(evaluate(declaration([condition(['standard'])], 'unknown')).availability, 'unknown');
  const contradictory = evaluate(declaration([condition()], 'unconditional'));
  assert.equal(contradictory.availability, 'unknown');
  assert.equal(contradictory.reason, 'invalid-input');
});

test('include/exclude membership is explicit, uses OR within a rule and retains duplicate values', () => {
  assert.equal(evaluate(declaration([condition(['standard', 'vanilla', 'vanilla'])])).availability, 'active');
  const mismatch = evaluate(declaration([condition(['standard'])]));
  assert.equal(mismatch.availability, 'inactive');
  assert.equal(mismatch.reason, 'condition-mismatch');
  assert.deepEqual(codes(mismatch), ['CONDEVAL0006']);
  const exclude = policy({ rules: [rule({ operator: 'exclude' })] });
  assert.equal(evaluate(declaration([condition(['standard'])]), environment(), exclude).availability, 'active');
  assert.equal(evaluate(declaration([condition(['vanilla'])]), environment(), exclude).availability, 'inactive');
});

test('all nine conservative AND cells agree with the approved independent truth table', () => {
  const inputs = {
    true: () => condition(['vanilla']), false: () => condition(['standard']),
    unknown: () => condition(['vanilla'], { name: 'Unsupported' }),
  };
  const table = {
    true: { true: 'active', false: 'inactive', unknown: 'unknown' },
    false: { true: 'inactive', false: 'inactive', unknown: 'inactive' },
    unknown: { true: 'unknown', false: 'inactive', unknown: 'unknown' },
  };
  for (const [left, row] of Object.entries(table)) {
    for (const [right, expected] of Object.entries(row)) {
      const result = evaluate(declaration([inputs[left](), inputs[right]() ]));
      assert.equal(result.availability, expected, `${left} AND ${right}`);
      if (left === 'unknown' || right === 'unknown') assert.ok(codes(result).includes('CONDEVAL0003'));
      if (left === 'false' || right === 'false') assert.ok(codes(result).includes('CONDEVAL0006'));
    }
  }
});

test('empty include/exclude arguments are unknown rather than vacuous truth', () => {
  for (const values of [[], [''], ['vanilla', '']]) {
    for (const operator of ['include', 'exclude']) {
      const result = evaluate(declaration([condition(values)]), environment(), policy({ rules: [rule({ operator })] }));
      assert.equal(result.availability, 'unknown');
      assert.deepEqual(codes(result), ['CONDEVAL0004']);
    }
  }
});

test('provider IDs are exact and familiar names never borrow another provider meaning', () => {
  const other = condition(['vanilla'], { providerId: 'AUTHORED-PROVIDER' });
  assert.equal(evaluate(declaration([other])).availability, 'unknown');
  assert.equal(evaluate(declaration([condition(['vanilla'], { name: ' MATCH ' })])).availability, 'unknown');
  const ascii = policy({ nameComparison: 'ascii-insensitive' });
  assert.equal(evaluate(declaration([condition(['vanilla'], { name: 'MATCH' })]), environment(), ascii).availability, 'active');
  assert.equal(evaluate(declaration([other]), environment(), ascii).availability, 'unknown');
});

test('value comparisons fold ASCII only when explicitly requested and never normalize Unicode or trim', () => {
  const upper = declaration([condition(['VANILLA'])]);
  assert.equal(evaluate(upper).availability, 'inactive');
  const ascii = policy({ rules: [rule({ valueComparison: 'ascii-insensitive' })] });
  assert.equal(evaluate(upper, environment(), ascii).availability, 'active');
  for (const [value, field] of [['Ä', 'ä'], ['K', 'k'], [' vanilla ', 'vanilla']]) {
    assert.equal(evaluate(declaration([condition([value])]), environment({ gameType: field }), ascii).availability, 'inactive');
  }
});

test('opaque future game types/locales can match explicit caller policy without inferring game support', () => {
  assert.equal(evaluate(declaration([condition(['caller-future'])]), environment({ gameType: 'caller-future' })).availability, 'active');
  const locale = policy({ rules: [rule({ field: 'textLocale' })] });
  assert.equal(evaluate(declaration([condition(['caller-locale'])]), environment({ textLocale: 'caller-locale' }), locale).availability, 'active');
});

test('missing/empty required fields and unsupported game modes remain unknown', () => {
  for (const field of ['gameType', 'textLocale', 'gameMode']) {
    const p = policy({ rules: [rule({ field })] });
    const missing = environment(); delete missing[field];
    for (const e of [missing, environment({ [field]: '' })]) {
      const result = evaluate(declaration([condition()]), e, p);
      assert.equal(result.availability, 'unknown');
      assert.deepEqual(codes(result), ['CONDEVAL0005']);
    }
  }
  const mode = policy({ rules: [rule({ field: 'gameMode' })] });
  assert.equal(evaluate(declaration([condition([WoWGameMode.Hardcore])]),
    environment({ gameMode: WoWGameMode.Hardcore }), mode).availability, 'active');
  for (const gameMode of [WoWGameMode.Unknown, 'future-mode']) {
    assert.equal(evaluate(declaration([condition([gameMode])]), environment({ gameMode }), mode).availability, 'unknown');
  }
  assert.equal(evaluate(declaration([condition()]), environment({ gameMode: 'unused-future-mode' })).availability, 'active');
});

test('unknown or contradictory client context never activates even unconditional input', () => {
  const d = declaration(undefined, 'unconditional');
  for (const e of [environment({ client: WoWClient.Unknown }), environment({ client: 'future-client' }),
    environment({ clientFamily: 'unknown' }), environment({ clientFamily: 'future-family' })]) {
    const result = evaluate(d, e);
    assert.equal(result.availability, 'unknown');
    assert.deepEqual(codes(result), ['CONDEVAL0005']);
  }
  const contradictory = evaluate(d, environment({ clientFamily: 'mainline' }));
  assert.equal(contradictory.availability, 'unknown');
  assert.deepEqual(codes(contradictory), ['CONDEVAL0001']);
});

test('malformed environment/optional shapes return fixed unknown issues without throwing', () => {
  const d = declaration([condition()]);
  const inputs = [null, [], {}, environment({ schemaVersion: 2 }), environment({ client: 1 })];
  for (const field of ['gameType', 'textLocale', 'gameMode']) {
    for (const value of [undefined, null, 42, {}, []]) inputs.push(environment({ [field]: value }));
  }
  for (const input of inputs) {
    const result = evaluate(d, input);
    assert.equal(result.availability, 'unknown');
    assert.deepEqual(codes(result), ['CONDEVAL0001']);
  }
});

test('invalid policies and duplicate semantic rule keys cannot silently pick a winner', () => {
  const inputs = [null, {}, policy({ schemaVersion: 2 }), policy({ id: '' }), policy({ nameComparison: 'locale' }),
    policy({ rules: null }), policy({ rules: Array(1) }), policy({ rules: [null] }),
    policy({ rules: [rule({ providerId: '' })] }), policy({ rules: [rule({ name: '' })] }),
    policy({ rules: [rule({ field: 'client' })] }), policy({ rules: [rule({ operator: 'execute' })] }),
    policy({ rules: [rule({ valueComparison: 'unicode-fold' })] }), policy({ rules: [rule(), rule()] }),
    policy({ nameComparison: 'ascii-insensitive', rules: [rule(), rule({ name: 'MATCH' })] })];
  for (const p of inputs) {
    const result = evaluate(declaration(undefined, 'unconditional'), environment(), p);
    assert.equal(result.availability, 'unknown');
    assert.deepEqual(codes(result), ['CONDEVAL0001']);
  }
  const exactDistinct = policy({ rules: [rule(), rule({ name: 'MATCH' })] });
  assert.equal(evaluate(declaration([condition()]), environment(), exactDistinct).availability, 'active');
});

test('an explicit empty rule policy supports no conditions but retains unconditional availability', () => {
  const p = policy({ rules: [] });
  assert.equal(evaluate(declaration(undefined, 'unconditional'), environment(), p).availability, 'active');
  const unsupported = evaluate(declaration([condition()]), environment(), p);
  assert.equal(unsupported.availability, 'unknown');
  assert.deepEqual(codes(unsupported), ['CONDEVAL0003']);
});

test('opaque provider/name tuples cannot collide through delimiters and raw text is never evaluated', () => {
  const p = policy({ rules: [rule({ providerId: 'a|b', name: 'c' }),
    rule({ providerId: 'a', name: 'b|c', operator: 'exclude' })] });
  const first = condition(['vanilla'], { providerId: 'a|b', name: 'c', raw: 'malformed-looking opaque text' });
  const second = condition(['vanilla'], { providerId: 'a', name: 'b|c' });
  assert.equal(evaluate(declaration([first]), environment(), p).availability, 'active');
  assert.equal(evaluate(declaration([second]), environment(), p).availability, 'inactive');
});

test('malformed declaration/descriptor projections are unknown even when another condition is false', () => {
  const invalids = [null, [], {}, declaration(null), declaration(Array(1)), declaration([null]),
    { ...declaration([]), activationState: 'active' }, { ...declaration([]), source: null },
    { ...declaration([]), conditions: undefined }];
  const mutations = [c => { c.providerId = ''; }, c => { c.name = ''; }, c => { c.raw = null; },
    c => { c.values = null; }, c => { c.values = [1]; }, c => { c.values = Array(1); },
    c => { c.source.file = ''; }, c => { c.source.range.start.line = -1; },
    c => { c.source.range.start.column = 2; c.source.range.end.column = 1; },
    c => { c.source.range.end.line = Number.MAX_SAFE_INTEGER + 1; }];
  for (const mutate of mutations) {
    const c = condition(); mutate(c); invalids.push(declaration([condition(['standard']), c]));
  }
  for (const d of invalids) {
    const result = evaluate(d);
    assert.equal(result.availability, 'unknown');
    assert.equal(result.reason, 'invalid-input');
    assert.ok(codes(result).includes('CONDEVAL0002'));
  }
});

test('issues are canonical across condition/rule permutations, ordered by numeric source positions', () => {
  const a = condition(['x'], { name: 'Unknown', source: source('shared.toc', 10) });
  const b = condition(['x'], { name: 'Unknown', source: source('shared.toc', 2) });
  const first = evaluate(declaration([a, b]));
  assert.deepEqual(first, evaluate(declaration([b, a])));
  assert.deepEqual(first.issues.map(i => i.sources[0].range.start.column), [2, 10]);
  const p = policy({ rules: [rule(), rule({ name: 'Unused' })] });
  assert.deepEqual(evaluate(declaration([condition()]), environment(), p),
    evaluate(declaration([condition()]), environment(), { ...p, rules: [...p.rules].reverse() }));
  assert.equal(evaluate(declaration([a, a])).issues.length, 2);
});

test('returned source trees do not alias frozen inputs or other evaluation results', () => {
  const d = freeze(declaration([condition(['x'], { name: 'Unknown' })]));
  const e = freeze(environment()); const p = freeze(policy());
  const before = JSON.stringify([d, e, p]);
  const first = evaluate(d, e, p); const second = evaluate(d, e, p);
  const stable = JSON.stringify(second);
  first.issues[0].sources[0].file = 'edited';
  first.issues[0].sources[0].range.start.line = 8;
  first.issues[0].sources[0].range.start.column = 9;
  first.issues[0].sources[0].range.end.line = 10;
  first.issues[0].sources[0].range.end.column = 11;
  first.issues[0].sources.push(source('edited'));
  assert.equal(JSON.stringify([d, e, p]), before);
  assert.equal(JSON.stringify(second), stable);
  const duplicated = evaluate(declaration([condition(['x'], { name: 'Unknown' }), condition(['x'], { name: 'Unknown' })]));
  duplicated.issues[0].sources[0].range.start.column = 99;
  assert.equal(duplicated.issues[1].sources[0].range.start.column, 0);
});

test('returned provenance copies omit unknown source fields and never echo private policy values', () => {
  const c = condition(['private-value'], { name: 'private-rule' });
  c.source.range.start.extra = 1n;
  const result = evaluate(declaration([c]));
  assert.equal(result.availability, 'unknown');
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.doesNotMatch(JSON.stringify(result), /private-value|private-rule|authored-test/);
  assert.equal(Object.hasOwn(result.issues[0].sources[0].range.start, 'extra'), false);
});

test('real TOC adapter descriptors evaluate under explicit caller rules without changing static registry', () => {
  const parsed = parseToc('## SavedVariables[AllowLoadGameType vanilla]: DB [AllowLoadTextLocale enUS]', 'A/A_Vanilla.toc');
  const [d] = adapter.toGlobalDeclarations([parsed.metadata]);
  const p = freeze(policy({ nameComparison: 'ascii-insensitive', rules: [
    rule({ providerId: '@wow-addon/toc-metadata-adapter', name: 'AllowLoadGameType' }),
    rule({ providerId: '@wow-addon/toc-metadata-adapter', name: 'ExcludeLoadGameType', operator: 'exclude' }),
    rule({ providerId: '@wow-addon/toc-metadata-adapter', name: 'AllowLoadTextLocale', field: 'textLocale' }),
  ] }));
  const before = JSON.stringify(parsed);
  freeze(d);
  const registry = buildGlobalRegistry([d]);
  assert.equal(evaluate(d, environment(), p).availability, 'active');
  assert.equal(evaluate(d, environment({ textLocale: 'frFR' }), p).availability, 'inactive');
  assert.equal(JSON.stringify(parsed), before);
  assert.deepEqual(listGlobals(registry), []);
  assert.deepEqual(listGlobals(registry, { includeConditional: true }), ['DB']);
  assert.equal(d.activationState, 'conditional');
});

test('AllowLoad and Bootstrap have no implicit builtin truth semantics', () => {
  const p = policy({ rules: [] });
  for (const annotation of ['[Bootstrap]', '[AllowLoad private]']) {
    const parsed = parseToc(`## SavedVariables${annotation}: DB`, 'A/A.toc');
    const [d] = adapter.toGlobalDeclarations([parsed.metadata]);
    const result = evaluate(d, environment(), p);
    assert.equal(result.availability, 'unknown');
    assert.deepEqual(codes(result), ['CONDEVAL0003']);
  }
});
