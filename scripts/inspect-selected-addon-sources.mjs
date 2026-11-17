/** Opt-in read-only selected-source CLI. Only the public count projection is serialized. */
import path from 'node:path';
import fs from 'node:fs';
import {readBoundedFile} from './read-bounded-file.mjs';
import {prepareGraphContext} from './selected-source-context.mjs';
import {validateXmlProviderProfile} from './xml-provider-validation.mjs';
import {validateXmlInlineProfile} from './xml-inline-lua-validation.mjs';
import {createSelectedSourceHost} from './selected-source-host.mjs';
import {analyzeSelectedSources} from './selected-source-graph.mjs';

const required = ['--graph-profile', '--resolution-profile', '--xml-provider-profile', '--xml-inline-lua-profile'];
const invalid = () => {throw Error('Invalid selected-source CLI input.');};
function profile(filename) {
  const bytes = readBoundedFile(filename, 1024 * 1024);
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}
let root, request, context;
try {
  const args = process.argv.slice(2), flags = new Map();
  root = args.shift();
  if (typeof root !== 'string' || !path.isAbsolute(root) || root.includes('\0') ||
    /^(?:[\\/]{2}|[A-Za-z]+:\/\/)/u.test(root) || (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/u.test(root))) invalid();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if ((!required.includes(flag) && flag !== '--lua-input-profile') || flags.has(flag) ||
      typeof value !== 'string' || value.length === 0 || value.startsWith('--')) invalid();
    flags.set(flag, value);
  }
  if (required.some(flag => !flags.has(flag)) || (flags.has('--lua-input-profile') && flags.get('--lua-input-profile') !== 'corpus-files')) invalid();
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) invalid();
  const graph = profile(flags.get('--graph-profile')), resolution = profile(flags.get('--resolution-profile')),
    xmlPolicy = validateXmlProviderProfile(profile(flags.get('--xml-provider-profile'))),
    inlineProfile = validateXmlInlineProfile(profile(flags.get('--xml-inline-lua-profile')));
  request = {profile: graph, environment: resolution.environment, selectionPolicy: resolution.selectionPolicy,
    conditionPolicy: resolution.conditionPolicy, xmlPolicy, inlineProfile, luaInputProfile: flags.get('--lua-input-profile') ?? 'bounded'};
  context = prepareGraphContext(request);
} catch {
  process.stderr.write('Invalid selected-source graph input.\n'); process.exitCode = 2;
}
if (context) {
  try {
    // No source host exists until all four bounded profiles have passed preflight.
    const host = await createSelectedSourceHost(root, context);
    const result = await analyzeSelectedSources(request, host);
    process.stdout.write(JSON.stringify(result.aggregate) + '\n');
    process.exitCode = result.aggregate.completeUnderPolicy === true && result.aggregate.status === 'passed' ? 0 : 1;
  } catch {
    process.stderr.write('Selected-source graph analysis failed.\n'); process.exitCode = 1;
  }
}
