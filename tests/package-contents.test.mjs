import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePackageContents } from '../scripts/check-package-contents.mjs';

const names = ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry', 'toc-metadata-adapter', 'lua-analysis', 'xml-parser', 'xml-analysis'];
const listing = () => names.map(name => ({
  name: `@wow-addon/${name}`, version: '0.3.0',
  files: ['LICENSE', 'dist/index.d.ts', 'dist/index.js', 'package.json',
    ...(name === 'lua-analysis' ? ['dist/syntax.js', 'dist/syntax.d.ts'] : []),
    ...(name === 'xml-parser' ? ['THIRD-PARTY-NOTICES.txt'] : [])].map(path => ({ path })),
}));
test('package gate accepts five frozen core payloads and the approved Lua/XML syntax/provider extensions', () => {
  assert.deepEqual(validatePackageContents(listing(), '0.3.0'), []);
  assert.deepEqual(validatePackageContents(Object.fromEntries(listing().map(item => [item.name, item])), '0.3.0'), []);
  assert.ok(validatePackageContents({ invalid: listing()[0] }, '0.3.0').length > 0);
});

test('XML provider requires its exact four-file payload without helper, backend or source leakage', () => {
  const absent = listing().filter(item => item.name !== '@wow-addon/xml-analysis');
  assert.match(validatePackageContents(absent, '0.3.0').join('\n'), /expected eight|xml-analysis: expected exactly one package/);
  for (const file of ['LICENSE', 'dist/index.js', 'dist/index.d.ts']) {
    const missing = listing(); missing[7].files = missing[7].files.filter(item => item.path !== file);
    assert.match(validatePackageContents(missing, '0.3.0').join('\n'), /xml-analysis: missing/);
  }
  for (const path of ['dist/helper.js', 'dist/index.js.map', 'src/index.ts', 'saxes.js', 'private-source.xml']) {
    const extra = listing(); extra[7].files.push({ path });
    assert.ok(validatePackageContents(extra, '0.3.0').includes(`xml-analysis: unexpected ${path}`));
  }
});

test('XML package must retain complete third-party notices without vendoring backend or game sources', () => {
  const missing = listing(); missing[6].files = missing[6].files.filter(f => f.path !== 'THIRD-PARTY-NOTICES.txt');
  assert.match(validatePackageContents(missing, '0.3.0').join('\n'), /xml-parser: missing THIRD-PARTY-NOTICES.txt/);
  for (const path of ['saxes.js', 'saxes.tgz', 'dist/source.xml', 'dist/index.js.map']) {
    const extra = listing(); extra[6].files.push({ path });
    assert.ok(validatePackageContents(extra, '0.3.0').some(error => error === `xml-parser: unexpected ${path}`));
  }
  const duplicate = listing(); duplicate[6].files.push({ path: 'dist/index.js' });
  assert.match(validatePackageContents(duplicate, '0.3.0').join('\n'), /xml-parser: duplicate file paths/);
});

test('Lua private syntax implementation is required but its source/backend archive cannot leak', () => {
  const missing = listing(); missing[5].files = missing[5].files.filter(f => f.path !== 'dist/syntax.js');
  assert.match(validatePackageContents(missing, '0.3.0').join('\n'), /missing dist\/syntax.js/);
  const extra = listing(); extra[5].files.push({ path: 'luaparse.tgz' });
  assert.match(validatePackageContents(extra, '0.3.0').join('\n'), /unexpected luaparse.tgz/);
});
test('package gate rejects missing licenses, unexpected assets and duplicate workspace entries', () => {
  const extra = listing(); extra[0].files.push({ path: 'dist/unexpected.lua' });
  assert.match(validatePackageContents(extra, '0.3.0').join('\n'), /unexpected\.lua/);
  const missing = listing(); missing[0].files.shift();
  assert.match(validatePackageContents(missing, '0.3.0').join('\n'), /LICENSE/);
  const duplicate = listing(); duplicate[1] = duplicate[0];
  assert.ok(validatePackageContents(duplicate, '0.3.0').length > 0);
  assert.ok(validatePackageContents(listing().slice(1), '0.3.0').length > 0);
  assert.ok(validatePackageContents(listing(), '0.2.0').length > 0);
});
