import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareGraphContext} from '../scripts/selected-source-context.mjs';
import {createGraphAnalyzer} from '../scripts/selected-source-analysis-client.mjs';

const json = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
export const slash = value => value.replaceAll('\\', '/');
export function context(alter = () => {}) {
  const input = {profile: json('../docs/proposals/selected-source-graph-profile.json'),
    ...json('../examples/classic-era-resolution-profile.json'), xmlPolicy: json('../examples/xml-provider-profile.json').policy,
    inlineProfile: json('../examples/xml-inline-lua-profile.json'), luaInputProfile: 'bounded'};
  alter(input); return prepareGraphContext(input);
}
export function memoryHost(input, alter = () => {}) {
  const files = new Map(Object.entries(input)), reads = [], calls = [], directories = new Map([['', []]]);
  for (const name of files.keys()) {
    const pieces = name.split('/');
    for (let i = 0; i < pieces.length; i++) {
      const parent = pieces.slice(0, i).join('/'), leaf = pieces[i], folder = i < pieces.length - 1;
      if (!directories.has(parent)) directories.set(parent, []);
      const rows = directories.get(parent);
      if (!rows.some(row => row.name === leaf)) rows.push({name: leaf, kind: folder ? 'directory' : 'file', reparsePoint: false});
      if (folder && !directories.has(pieces.slice(0, i + 1).join('/'))) directories.set(pieces.slice(0, i + 1).join('/'), []);
    }
  }
  const analyzer = createGraphAnalyzer(); let closes = 0;
  const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex');
  const host = {
    async listDirectory(name) {
      const rows = directories.get(slash(name)); if (!rows) throw Error('authored missing directory');
      return {fingerprint: fingerprint(JSON.stringify(rows)), entries: structuredClone(rows)};
    },
    async readSource(name, maximum) {
      reads.push(slash(name)); const content = files.get(slash(name)); if (content === undefined) throw Error('authored missing source');
      const bytes = Buffer.from(content); if (bytes.length > maximum) throw Error('authored read cap');
      return {bytes, fingerprint: fingerprint(bytes)};
    },
    async verifySource(name, previous) {return files.has(slash(name)) && fingerprint(Buffer.from(files.get(slash(name)))) === previous;},
    async verifyDirectory(name, previous) {return fingerprint(JSON.stringify(directories.get(slash(name)))) === previous;},
    async analyze(request) {calls.push(structuredClone(request)); return analyzer.analyze(request);},
    nowMilliseconds: () => performance.now(),
    async close() {closes++; await analyzer.close();},
  };
  alter(host, files, directories); return {host, files, directories, reads, calls, get closes() {return closes;}};
}
export const simple = () => ({'Demo/Demo_Vanilla.toc': '## SavedVariables: DB\nView.xml\nCore.lua\nCore.lua',
  'Demo/Demo_Mainline.toc': 'Never.lua', 'Demo/Never.lua': 'Never=1', 'Demo/Unused.lua': 'Unused=1',
  'Demo/View.xml': '<Ui><Include file="Child.xml"/><Script>Ou<!--gap-->t=1</Script><Script file="Core.lua"/></Ui>',
  'Demo/Child.xml': '<Ui><Script>Child=1</Script></Ui>', 'Demo/Core.lua': 'Core=1'});
