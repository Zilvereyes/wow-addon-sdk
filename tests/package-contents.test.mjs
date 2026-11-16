import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePackageContents } from '../scripts/check-package-contents.mjs';

const names = ['diagnostics', 'addon-metadata', 'toc-parser', 'global-registry', 'toc-metadata-adapter', 'lua-analysis'];
const listing = () => names.map(name => ({
  name: `@wow-addon/${name}`, version: '0.3.0',
  files: ['LICENSE', 'dist/index.d.ts', 'dist/index.js', 'package.json',
    ...(name === 'lua-analysis' ? ['dist/syntax.js', 'dist/syntax.d.ts'] : [])].map(path => ({ path })),
}));
test('package gate accepts five frozen core payloads and the approved Lua extension', () => {
  assert.deepEqual(validatePackageContents(listing(), '0.3.0'), []);
  assert.deepEqual(validatePackageContents(Object.fromEntries(listing().map(item => [item.name, item])), '0.3.0'), []);
  assert.ok(validatePackageContents({ invalid: listing()[0] }, '0.3.0').length > 0);
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
