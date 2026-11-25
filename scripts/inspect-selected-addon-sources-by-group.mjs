/** Opt-in read-only selected-source CLI that runs one group at a time and can resume.
 * Receipts under --receipt-directory hold derived counts only. Only the batch receipt is serialized.
 */
import path from 'node:path';
import fs from 'node:fs';
import {readBoundedFile} from './read-bounded-file.mjs';
import {prepareGraphContext} from './selected-source-context.mjs';
import {validateXmlProviderProfile} from './xml-provider-validation.mjs';
import {validateXmlInlineProfile} from './xml-inline-lua-validation.mjs';
import {runGroupedSelectedSources} from './selected-source-grouped.mjs';

const required = ['--graph-profile', '--resolution-profile', '--xml-provider-profile', '--xml-inline-lua-profile', '--receipt-directory'];
const optional = ['--lua-input-profile', '--runtime-id', '--no-resume'];
const invalid = () => {throw Error('Invalid selected-source CLI input.');};
function profile(filename) {
  const bytes = readBoundedFile(filename, 1024 * 1024);
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}
let root, request, receiptDirectory, runtimeId = '', resume = true;
try {
  const args = process.argv.slice(2), flags = new Map();
  root = args.shift();
  if (typeof root !== 'string' || !path.isAbsolute(root) || root.includes('\0') ||
    /^(?:[\\/]{2}|[A-Za-z]+:\/\/)/u.test(root) || (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/u.test(root))) invalid();
  for (let index = 0; index < args.length;) {
    const flag = args[index];
    if (flag === '--no-resume') {
      if (flags.has(flag)) invalid();
      flags.set(flag, true); index += 1; continue;
    }
    const value = args[index + 1];
    if ((!required.includes(flag) && !optional.includes(flag)) || flags.has(flag) ||
      typeof value !== 'string' || value.length === 0 || value.startsWith('--')) invalid();
    flags.set(flag, value); index += 2;
  }
  if (required.some(flag => !flags.has(flag)) || (flags.has('--lua-input-profile') && flags.get('--lua-input-profile') !== 'corpus-files')) invalid();
  if (flags.has('--runtime-id') && !/^[A-Za-z0-9._-]{1,64}$/u.test(flags.get('--runtime-id'))) invalid();
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) invalid();
  receiptDirectory = flags.get('--receipt-directory');
  const graph = profile(flags.get('--graph-profile')), resolution = profile(flags.get('--resolution-profile')),
    xmlPolicy = validateXmlProviderProfile(profile(flags.get('--xml-provider-profile'))),
    inlineProfile = validateXmlInlineProfile(profile(flags.get('--xml-inline-lua-profile')));
  request = {profile: graph, environment: resolution.environment, selectionPolicy: resolution.selectionPolicy,
    conditionPolicy: resolution.conditionPolicy, xmlPolicy, inlineProfile, luaInputProfile: flags.get('--lua-input-profile') ?? 'bounded'};
  runtimeId = flags.get('--runtime-id') ?? '';
  resume = !flags.has('--no-resume');
  prepareGraphContext(request); // Preflight before any host or receipt exists.
} catch {
  process.stderr.write('Invalid selected-source graph input.\n'); process.exitCode = 2; request = undefined;
}
if (request) {
  try {
    const {report, exitCode} = await runGroupedSelectedSources({root, request, receiptDirectory, runtimeId, resume});
    process.stdout.write(JSON.stringify(report) + '\n');
    process.exitCode = exitCode;
  } catch {
    process.stderr.write('Selected-source grouped analysis failed.\n'); process.exitCode = 1;
  }
}
