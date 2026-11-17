import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = path.resolve('scripts/inspect-addon-corpus.mjs');
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-sdk-corpus-'));
  try { run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function inspect(root, ...args) {
  const result = spawnSync(process.execPath, [runner, root, ...args], { encoding: 'utf8', windowsHide: true });
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : undefined };
}

test('corpus-files preset accepts explicit hashbang/byte transport with original bytes preserved', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  const file = path.join(root, 'Legacy.lua');
  const bytes = Buffer.concat([Buffer.from('#!fixture\r\n-- '), Buffer.from([0xE9]), Buffer.from('\r\nDB = 1')]);
  fs.writeFileSync(file, bytes);
  const strict = inspect(root, '--lua-analysis');
  assert.equal(strict.report.luaAnalysis.encodingRejected, 1);
  const expanded = inspect(root, '--lua-analysis', '--lua-input-profile', 'corpus-files');
  assert.equal(expanded.status, 0, expanded.stderr);
  assert.equal(expanded.report.parsed.lua, 1);
  assert.equal(expanded.report.luaAnalysis.syntaxAccepted, 1);
  assert.deepEqual(expanded.report.luaAnalysis.transport, { strictUtf8: 0, bytePreserving: 1 });
  assert.equal(expanded.report.luaAnalysis.profile, 'corpus-files');
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.doesNotMatch(expanded.stdout + expanded.stderr, /Legacy|fixture|DB/);
}));

test('byte transport never overrides recognized BOMs or silently expands default input limits', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  fs.writeFileSync(path.join(root, 'BomUtf8.lua'), Buffer.from([0xEF, 0xBB, 0xBF, 0xE9]));
  fs.writeFileSync(path.join(root, 'BomUtf16.lua'), Buffer.from([0xFF, 0xFE, 0x41, 0]));
  fs.writeFileSync(path.join(root, 'Large.lua'), ' '.repeat(1024 * 1024) + 'DB=1');
  const expanded = inspect(root, '--lua-analysis', '--lua-input-profile', 'corpus-files');
  assert.equal(expanded.report.luaAnalysis.encodingRejected, 2);
  assert.equal(expanded.report.luaAnalysis.syntaxAccepted, 1);
  assert.equal(expanded.report.luaAnalysis.transport.strictUtf8, 1);
  assert.equal(inspect(root, '--lua-analysis').report.luaAnalysis.inputLimitRejected, 1);
}));

test('byte transport does not waive invalid non-variadic Lua syntax or leak declarations', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  const file = path.join(root, 'PrivateRejected.lua');
  const bytes = Buffer.concat([Buffer.from('-- '), Buffer.from([0xF8]),
    Buffer.from('\r\nBefore = 1\r\nfunction Collect(first) return ... end')]);
  fs.writeFileSync(file, bytes);
  const result = inspect(root, '--lua-analysis', '--lua-input-profile', 'corpus-files');
  assert.equal(result.status, 1);
  assert.equal(result.report.parsed.lua, 1);
  assert.equal(result.report.luaAnalysis.syntaxRejected, 1);
  assert.equal(result.report.luaAnalysis.declarations, 0);
  assert.equal(result.report.luaAnalysis.encodingRejected, 0);
  assert.deepEqual(result.report.luaAnalysis.transport, { strictUtf8: 0, bytePreserving: 1 });
  assert.deepEqual(result.report.luaAnalysis.diagnosticsByCode, { LUA0002: 1 });
  assert.ok(result.report.failures.includes('lua-syntax-errors'));
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.doesNotMatch(result.stdout + result.stderr, /PrivateRejected|Before|Collect/);
}));

test('Lua input profile arguments reject unknown/repeated/missing or disabled use before traversal', () => fixture(root => {
  for (const args of [['--lua-input-profile', 'corpus-files'], ['--lua-analysis', '--lua-input-profile'],
    ['--lua-analysis', '--lua-input-profile', 'unknown'],
    ['--lua-analysis', '--lua-input-profile', 'corpus-files', '--lua-input-profile', 'corpus-files']]) {
    assert.equal(inspect(root, ...args).status, 2);
  }
}));

test('Lua corpus opt-in parses real SDK syntax/providers with BOM/ranges and aggregate privacy', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '## SavedVariables: DB');
  const text = '\uFEFF-- 🧪\r\nPrivateGlobal = {}; local Hidden = {}; if flag then PrivateMaybe = 1 end';
  const file = path.join(root, 'PrivateFile.lua'); fs.writeFileSync(file, text);
  const result = inspect(root, '--lua-analysis');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.parsed.lua, 1);
  assert.deepEqual(result.report.unimplementedParsers, []);
  assert.deepEqual(result.report.disabledParsers, ['xml']);
  assert.equal(result.report.luaAnalysis.syntaxAccepted, 1);
  assert.equal(result.report.luaAnalysis.declarations, 2);
  assert.deepEqual(result.report.luaAnalysis.activation, { unconditional: 1, conditional: 0, unknown: 1 });
  assert.equal(result.report.luaAnalysis.checkedSourceReferences, 2);
  assert.equal(result.report.luaAnalysis.resolvedProviderParticipation, false);
  assert.equal(result.stdout, inspect(root, '--lua-analysis').stdout);
  assert.doesNotMatch(result.stdout + result.stderr, /PrivateGlobal|PrivateMaybe|PrivateFile|Hidden|🧪/);
  assert.equal(fs.readFileSync(file, 'utf8'), text);
  assert.equal(result.report.fullParsing, false);
}));

test('Lua corpus syntax rejection and dynamic environment uncertainty stay failed and explained', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  fs.writeFileSync(path.join(root, 'Invalid.lua'), 'Prefix = 1; Broken =');
  fs.writeFileSync(path.join(root, 'Dynamic.lua'), 'DB = 1; _G[name] = 2');
  const result = inspect(root, '--lua-analysis');
  assert.equal(result.status, 1);
  assert.equal(result.report.parsed.lua, 2);
  assert.equal(result.report.luaAnalysis.syntaxAccepted, 1);
  assert.equal(result.report.luaAnalysis.syntaxRejected, 1);
  assert.equal(result.report.luaAnalysis.incompleteFiles, 1);
  assert.deepEqual(result.report.luaAnalysis.diagnosticsByCode, { LUA0002: 1, LUA0004: 1 });
  assert.ok(result.report.failures.includes('lua-syntax-errors'));
  assert.ok(result.report.failures.includes('lua-analysis-incomplete'));
  assert.equal(result.report.luaAnalysis.declarations, 1);
}));

test('Lua corpus rejects invalid UTF-8 and input limits without counting them as parsed', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  fs.writeFileSync(path.join(root, 'Invalid.lua'), Buffer.from([0xC3, 0x28]));
  fs.writeFileSync(path.join(root, 'Large.lua'), ' '.repeat(1024 * 1024 + 1));
  const result = inspect(root, '--lua-analysis');
  assert.equal(result.status, 1);
  assert.equal(result.report.luaAnalysis.attempted, 2);
  assert.equal(result.report.luaAnalysis.submitted, 0);
  assert.equal(result.report.parsed.lua, 0);
  assert.equal(result.report.luaAnalysis.encodingRejected, 1);
  assert.equal(result.report.luaAnalysis.inputLimitRejected, 1);
  assert.ok(result.report.failures.includes('lua-invalid-utf8'));
  assert.ok(result.report.failures.includes('lua-input-limit'));
}));

test('Lua corpus byte bounds and malformed profiles fail before unbounded reading/analysis', () => fixture(root => fixture(config => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  fs.writeFileSync(path.join(root, 'Large.lua'), 'DB = 10000');
  const bounded = inspect(root, '--lua-analysis', '--max-file-bytes', '5');
  assert.equal(bounded.status, 1);
  assert.equal(bounded.report.skippedOversizedLua, 1);
  assert.equal(bounded.report.luaAnalysis.submitted, 0);
  const profile = path.join(config, 'bad.json'); fs.writeFileSync(profile, '{}');
  const invalid = inspect(root, '--lua-analysis', '--resolution-profile', profile);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.report.entriesVisited, 0);
  assert.equal(invalid.report.luaAnalysis.attempted, 0);
})));

test('Lua corpus opt-in is explicit and cannot waive missing XML providers and loader traversal', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'Seed.toc'), '#');
  fs.writeFileSync(path.join(root, 'Code.lua'), 'DB = 1');
  const normal = inspect(root);
  assert.equal(normal.status, 0);
  assert.equal(normal.report.parsed.lua, 0);
  assert.deepEqual(normal.report.disabledParsers, ['lua', 'xml']);
  assert.deepEqual(normal.report.unimplementedParsers, []);
  assert.equal(Object.hasOwn(normal.report, 'luaAnalysis'), false);
  assert.equal(inspect(root, '--lua-analysis', '--lua-analysis').status, 2);
  const required = inspect(root, '--lua-analysis', '--require-all-parsers');
  assert.equal(required.status, 1);
  assert.equal(required.report.parsed.lua, 1);
  assert.ok(required.report.failures.includes('missing-full-parsing-capabilities'));
}));

test('opt-in composed corpus resolution excludes non-selected/nested sources and includes true conditionals', () => fixture(root => fixture(config => {
  fs.mkdirSync(path.join(root, 'PrivateAddon', 'embedded'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Other'));
  const inputs = {
    'PrivateAddon/PrivateAddon_Vanilla.toc': '## SavedVariables: SecretEra, SecretShared\n## SavedVariables[AllowLoadGameType vanilla]: SecretConditional',
    'PrivateAddon/PrivateAddon_Mainline.toc': '## SavedVariablesPerCharacter: SecretShared, SecretRetail',
    'PrivateAddon/embedded/Library.toc': '## SavedVariables: SecretLibrary',
    'Other/Other_Future.toc': '## SavedVariables: SecretFuture',
  };
  for (const [name, text] of Object.entries(inputs)) fs.writeFileSync(path.join(root, name), text);
  const profile = path.join(config, 'private-profile.json');
  fs.writeFileSync(profile, fs.readFileSync('examples/classic-era-resolution-profile.json'));
  const result = inspect(root, '--resolution-profile', profile);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.parsed.toc, 4);
  assert.deepEqual(result.report.resolution, { groups: 2, candidates: 3, complete: true,
    selections: { selected: 1, 'no-match': 1, unresolved: 0, ambiguous: 0, invalid: 0 },
    declarations: 3, availability: { active: 3, inactive: 0, unknown: 0 }, activeGlobals: 3,
    diagnosticsByCode: {}, issuesByCode: {} });
  assert.doesNotMatch(result.stdout + result.stderr, /PrivateAddon|Secret|Library|Other_Future|vanilla|private-profile/);
  assert.equal(result.stdout, inspect(root, '--resolution-profile', profile).stdout);
  for (const [name, text] of Object.entries(inputs)) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), text);
  assert.equal(result.report.fullParsing, false);
})));

test('composed resolution keeps unknown availability and original TOC errors visibly failed', () => fixture(root => fixture(config => {
  fs.mkdirSync(path.join(root, 'A'));
  fs.writeFileSync(path.join(root, 'A', 'A_Vanilla.toc'), '## XML\n## SavedVariables: Known\n## SavedVariables[Bootstrap]: Maybe');
  const profile = path.join(config, 'profile.json');
  fs.writeFileSync(profile, fs.readFileSync('examples/classic-era-resolution-profile.json'));
  const result = inspect(root, '--resolution-profile', profile);
  assert.equal(result.status, 1);
  assert.equal(result.report.resolution.complete, false);
  assert.equal(result.report.resolution.activeGlobals, 1);
  assert.deepEqual(result.report.resolution.availability, { active: 1, inactive: 0, unknown: 1 });
  assert.deepEqual(result.report.resolution.issuesByCode, { CONDEVAL0003: 1 });
  assert.ok(result.report.failures.includes('resolution-incomplete'));
  assert.ok(result.report.failures.includes('toc-parse-errors'));
})));

test('resolution profiles reject invalid/oversized contexts before traversal and reject missing/repeated flags', () => fixture(root => fixture(config => {
  fs.writeFileSync(path.join(root, 'root-only.toc'), '## SavedVariables: DB');
  const profile = path.join(config, 'profile.json');
  const original = JSON.parse(fs.readFileSync('examples/classic-era-resolution-profile.json', 'utf8'));
  for (const text of ['{', '{}', ' '.repeat(1024 * 1024 + 1), JSON.stringify({ ...original, conditionPolicy: {} }),
    JSON.stringify({ ...original, selectionPolicy: {} }), JSON.stringify({ ...original,
      environment: { ...original.environment, client: 'unknown' } })]) {
    fs.writeFileSync(profile, text);
    const result = inspect(root, '--resolution-profile', profile);
    assert.equal(result.status, 1);
    assert.equal(result.report.entriesVisited, 0);
    assert.ok(result.report.failures.includes('resolution-profile-invalid'));
  }
  fs.writeFileSync(profile, JSON.stringify(original));
  assert.equal(Object.hasOwn(inspect(root).report, 'resolution'), false);
  assert.equal(inspect(root, '--resolution-profile').status, 2);
  assert.equal(inspect(root, '--resolution-profile', profile, '--resolution-profile', profile).status, 2);
  const empty = inspect(root, '--resolution-profile', profile);
  assert.equal(empty.status, 1);
  assert.equal(empty.report.resolution.complete, false);
  assert.ok(empty.report.failures.includes('no-resolution-groups'));
})));

test('corpus verifies condition copies and reports aggregate counts without exposing provenance', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'private-file.toc'),
    '## SavedVariables[AllowLoadGameType privatevalue]: A, A [Bootstrap]\n## SavedVariables: B');
  const result = inspect(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.adapterDeclarations, 3);
  assert.equal(result.report.conditionDescriptors, 4);
  assert.doesNotMatch(result.stdout + result.stderr, /private-file|privatevalue|AllowLoadGameType|Bootstrap/);
  assert.equal(result.stdout, inspect(root).stdout);
}));

test('optional corpus condition profile reports active/inactive/unknown without hiding unknowns or provenance', () => fixture(root => fixture(config => {
  fs.writeFileSync(path.join(root, 'private-name.toc'), '## SavedVariables: Always\n' +
    '## SavedVariables[AllowLoadGameType vanilla]: Yes\n' +
    '## SavedVariables[ExcludeLoadGameType vanilla]: No\n## SavedVariables[Bootstrap]: Unknown');
  const profile = path.join(config, 'private-profile.json');
  fs.writeFileSync(profile, fs.readFileSync('examples/classic-era-condition-profile.json'));
  const result = inspect(root, '--condition-profile', profile);
  assert.equal(result.status, 1);
  assert.deepEqual(result.report.conditionEvaluation, { declarations: 4,
    availability: { active: 2, inactive: 1, unknown: 1 }, issuesByCode: { CONDEVAL0003: 1, CONDEVAL0006: 1 } });
  assert.ok(result.report.failures.includes('condition-unknown'));
  assert.doesNotMatch(result.stdout + result.stderr, /private-name|private-profile|vanilla|Bootstrap|caller-condition-policy/);
  assert.equal(result.stdout, inspect(root, '--condition-profile', profile).stdout);
  assert.equal(result.report.fullParsing, false);
})));

test('invalid, unknown-context or oversized condition profiles fail before source traversal', () => fixture(root => fixture(config => {
  fs.writeFileSync(path.join(root, 'private-name.toc'), '## SavedVariables: DB');
  const profile = path.join(config, 'profile.json');
  const original = JSON.parse(fs.readFileSync('examples/classic-era-condition-profile.json', 'utf8'));
  for (const input of ['{', JSON.stringify({}), JSON.stringify({ ...original,
    environment: { ...original.environment, client: 'unknown' } }), ' '.repeat(1024 * 1024 + 1)]) {
    fs.writeFileSync(profile, input);
    const result = inspect(root, '--condition-profile', profile);
    assert.equal(result.status, 1);
    assert.equal(result.report.entriesVisited, 0);
    assert.equal(result.report.parsed.toc, 0);
    assert.ok(result.report.failures.includes('condition-profile-invalid'));
    assert.doesNotMatch(result.stdout + result.stderr, /private-name|profile\.json/);
  }
})));

test('condition profile remains opt-in and rejects missing or repeated flag arguments', () => fixture(root => fixture(config => {
  fs.writeFileSync(path.join(root, 'A.toc'), '## SavedVariables: DB');
  assert.equal(Object.hasOwn(inspect(root).report, 'conditionEvaluation'), false);
  const profile = path.join(config, 'profile.json');
  fs.writeFileSync(profile, fs.readFileSync('examples/classic-era-condition-profile.json'));
  assert.equal(inspect(root, '--condition-profile').status, 2);
  assert.equal(inspect(root, '--condition-profile', profile, '--condition-profile', profile).status, 2);
  const result = inspect(root, '--condition-profile', profile);
  assert.equal(result.status, 0);
  assert.equal(result.report.conditionEvaluation.declarations, 1);
  assert.equal(result.report.conditionEvaluation.availability.active, 1);
})));

test('default corpus mode parses every TOC and explicitly leaves optional Lua disabled', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'Å'));
  const contents = {
    'Å/Å_Vanilla.toc': '\uFEFF## Title: 🧪\r\n## SavedVariables: DB\rCore.lua\nFrame.xml',
    'Å/Å_Mainline.TOC': '## SavedVariables: RetailDB',
    'Å/Core.lua': 'error("must never execute")',
    'Å/Frame.xml': '<Ui><Frame name="Example"/></Ui>',
  };
  for (const [name, value] of Object.entries(contents)) fs.writeFileSync(path.join(root, name), value);
  const result = inspect(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.files, { toc: 2, lua: 1, xml: 1 });
  assert.deepEqual(result.report.parsed, { toc: 2, lua: 0, xml: 0 });
  assert.equal(result.report.status, 'passed');
  assert.equal(result.report.fullParsing, false);
  assert.deepEqual(result.report.unimplementedParsers, []);
  assert.deepEqual(result.report.disabledParsers, ['lua', 'xml']);
  assert.equal(result.report.checkedSourceReferences > 0, true);
  assert.equal(result.report.savedVariableDeclarations, 2);
  assert.doesNotMatch(result.stdout + result.stderr, /RetailDB|Core\.lua|Å|must never execute/);
  assert.equal(result.stdout, inspect(root).stdout);
  for (const [name, value] of Object.entries(contents)) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), value);
}));

test('full-parser gate fails explicitly while providers are absent and syntax parsers are disabled', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  const result = inspect(root, '--require-all-parsers');
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'failed');
  assert.ok(result.report.failures.includes('missing-full-parsing-capabilities'));
}));

test('corpus surfaces parser errors as aggregate codes without exposing source text or paths', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'private-name.toc'), '## private-missing-colon\n## SavedVariables: DB,,bad-name');
  const result = inspect(root);
  assert.equal(result.status, 1);
  assert.deepEqual(result.report.diagnosticsByCode, { TOC0001: 1, TOC0003: 1, TOC0004: 1 });
  assert.doesNotMatch(result.stdout + result.stderr, /private-name|private-missing-colon|bad-name/);
}));

test('corpus rejects empty and missing roots with a nonzero result', () => fixture(root => {
  assert.equal(inspect(root).status, 1);
  const result = inspect(path.join(root, 'missing'));
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /wow-sdk-corpus-/);
}));

test('corpus reports incomplete coverage when byte or traversal limits are reached', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '## Title: too large');
  const oversized = inspect(root, '--max-file-bytes', '4');
  assert.equal(oversized.status, 1);
  assert.equal(oversized.report.status, 'incomplete');
  assert.equal(oversized.report.skippedOversizedTocs, 1);
  fs.writeFileSync(path.join(root, 'B.toc'), '');
  const bounded = inspect(root, '--max-entries', '1');
  assert.equal(bounded.status, 1);
  assert.equal(bounded.report.status, 'incomplete');
  assert.ok(bounded.report.failures.includes('entry-limit'));
}));

test('corpus rejects invalid limits and unknown flags', () => fixture(root => {
  for (const args of [['--max-entries', '0'], ['--max-file-bytes', '-1'], ['--max-entries', '1x'], ['--unknown']]) {
    assert.equal(inspect(root, ...args).status, 2);
  }
}));

test('corpus skips directory links instead of traversing an external tree', () => fixture(root => fixture(outside => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  fs.writeFileSync(path.join(outside, 'outside.toc'), '## invalid');
  fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = inspect(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.skippedLinks, 1);
  assert.equal(result.report.parsed.toc, 1);
  assert.deepEqual(result.report.diagnosticsByCode, {});
  assert.equal(inspect(path.join(root, 'linked')).status, 1);
})));

const selectionProfile = {
  environment: { schemaVersion: 1, client: 'classic-era', clientFamily: 'classic' },
  policy: { schemaVersion: 1, id: 'authored-corpus-policy', client: 'classic-era', clientFamily: 'classic', suffixPrecedence: ['Vanilla', 'Classic', null] },
};

test('optional corpus selection uses top-level caller groups and keeps nested manifests as parse-only inventory', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'A', 'libs', 'Library'), { recursive: true });
  fs.mkdirSync(path.join(root, 'B'));
  for (const name of ['A/A_Vanilla.toc', 'A/A_Classic.toc', 'A/A.toc', 'A/libs/Library/Library.toc', 'B/B_Mainline.toc']) {
    fs.writeFileSync(path.join(root, name), '## SavedVariables: PrivateDB');
  }
  const profile = path.join(root, 'profile.json'); fs.writeFileSync(profile, JSON.stringify(selectionProfile));
  const result = inspect(root, '--selection-profile', profile);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.parsed.toc, 5);
  assert.deepEqual(result.report.selection, {
    groups: 2, candidates: 4,
    statuses: { selected: 1, 'no-match': 1, unresolved: 0, ambiguous: 0, invalid: 0 }, issuesByCode: {},
  });
  assert.doesNotMatch(result.stdout + result.stderr, /PrivateDB|A_Vanilla|Library\.toc|profile\.json/);
}));

test('invalid or unresolved corpus profiles fail before reading source without exposing configuration', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  const file = path.join(root, 'private-profile.json');
  for (const profile of [{}, {
    environment: { ...selectionProfile.environment, client: 'unknown' },
    policy: { ...selectionProfile.policy, id: 'PRIVATE_POLICY_MARKER', gameType: 'PRIVATE_GAME_TYPE' },
  }]) {
    fs.writeFileSync(file, JSON.stringify(profile));
    const result = inspect(root, '--selection-profile', file);
    assert.equal(result.status, 1);
    assert.equal(result.report.parsed.toc, 0);
    assert.equal(result.report.entriesVisited, 0);
    assert.ok(result.report.failures.includes('selection-profile-invalid'));
    assert.doesNotMatch(result.stdout + result.stderr, /private-profile|wow-sdk-corpus-|PRIVATE_POLICY_MARKER|PRIVATE_GAME_TYPE/);
  }
  fs.writeFileSync(file, '{malformed');
  assert.equal(inspect(root, '--selection-profile', file).status, 1);
  assert.equal(inspect(root, '--selection-profile', path.join(root, 'missing')).status, 1);
}));

test('corpus selection profile is opt-in, cannot be repeated, and does not waive parse errors', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'A'));
  fs.writeFileSync(path.join(root, 'A', 'A.toc'), '## invalid');
  const profile = path.join(root, 'profile.json'); fs.writeFileSync(profile, JSON.stringify(selectionProfile));
  assert.equal(Object.hasOwn(inspect(root).report, 'selection'), false);
  const result = inspect(root, '--selection-profile', profile);
  assert.equal(result.status, 1);
  assert.equal(result.report.selection.statuses.selected, 1);
  assert.ok(result.report.failures.includes('toc-parse-errors'));
  assert.equal(inspect(root, '--selection-profile', profile, '--selection-profile', profile).status, 2);
}));

test('oversized selection profile is rejected before traversal', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  const profile = path.join(root, 'large.json'); fs.writeFileSync(profile, ' '.repeat(1024 * 1024 + 1));
  const result = inspect(root, '--selection-profile', profile);
  assert.equal(result.status, 1);
  assert.equal(result.report.entriesVisited, 0);
  assert.equal(result.report.parsed.toc, 0);
  assert.ok(result.report.failures.includes('selection-profile-invalid'));
}));

test('valid selection profile with no immediate AddOn-folder TOCs cannot claim a successful selection run', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  const profile = path.join(root, 'profile.json'); fs.writeFileSync(profile, JSON.stringify(selectionProfile));
  const result = inspect(root, '--selection-profile', profile);
  assert.equal(result.status, 1);
  assert.equal(result.report.parsed.toc, 1);
  assert.equal(result.report.selection.groups, 0);
  assert.ok(result.report.failures.includes('no-selection-groups'));
}));

test('over-budget directories are rejected before processing an unordered subset', () => fixture(root => {
  fs.writeFileSync(path.join(root, 'B.toc'), '');
  fs.writeFileSync(path.join(root, 'A.toc'), '');
  const result = inspect(root, '--max-entries', '1');
  assert.equal(result.status, 1);
  assert.equal(result.report.status, 'incomplete');
  assert.equal(result.report.entriesVisited, 0);
  assert.equal(result.report.parsed.toc, 0);
  assert.ok(result.report.failures.includes('entry-limit'));
}));
