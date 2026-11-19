/** Private graph analysis boundary. Profiles select policy, never executable code. */
import assert from 'node:assert/strict';
import {validateXmlProviderProfile} from './xml-provider-validation.mjs';
import {validateXmlInlineProfile, verifyGraphXmlInlineLua, verifyLuaProjection} from './xml-inline-lua-validation.mjs';
import {verifyXmlSyntax} from './selected-source-syntax-validation.mjs';
import {buildSourceLineIndex} from './source-line-index.mjs';
import {emptyGraphCalls, graphApis} from './selected-source-analysis-receipts.mjs';

export {emptyGraphCalls, graphApis};
export const exact = (value, keys) => assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));

/** Bounded, own-cell snapshot: no toJSON, iterators, coercion, inherited properties or callbacks. */
export function snapshotGraphAnalysisRequest(input) {
  try {
    const fields = ['language', 'content', 'sourcePath', 'addonId', 'conditions', 'luaProfile', 'allowShebang', 'xmlPolicy', 'inlineProfile'];
    exact(input, fields);
    let records = 0, units = 0;
    function copy(value, depth = 0) {
      assert.ok(++records <= 50000 && depth <= 32);
      if (typeof value === 'string') { units += value.length; assert.ok(units <= 2 * 1024 * 1024); return value; }
      if (value === null || typeof value === 'boolean' || Number.isSafeInteger(value)) return value;
      assert.ok(value !== null && typeof value === 'object');
      if (Array.isArray(value)) {
        const length = value.length; assert.ok(Number.isSafeInteger(length) && length >= 0 && length <= 1024);
        const result = [];
        for (let i = 0; i < length; i++) { assert.ok(Object.hasOwn(value, i)); result.push(copy(value[i], depth + 1)); }
        return result;
      }
      const keys = Object.keys(value); assert.ok(keys.length <= 128);
      const result = {};
      for (const key of keys) {
        units += key.length; assert.ok(units <= 2 * 1024 * 1024);
        Object.defineProperty(result, key, {value: copy(value[key], depth + 1), enumerable: true, writable: true, configurable: true});
      }
      return result;
    }
    const request = {};
    for (const key of fields) request[key] = key === 'content' ? input[key] : copy(input[key]);
    assert.ok(['toc', 'lua', 'xml'].includes(request.language));
    assert.ok(['bounded', 'corpus'].includes(request.luaProfile));
    const maxUnits = request.language === 'toc' ? 8 * 1024 * 1024 :
      request.language === 'lua' && request.luaProfile === 'corpus' ? 32 * 1024 * 1024 : 1024 * 1024;
    assert.ok(typeof request.content === 'string' && request.content.length <= maxUnits);
    assert.ok(typeof request.sourcePath === 'string' && request.sourcePath.length > 0 && request.sourcePath.length <= 4096);
    assert.ok(typeof request.addonId === 'string' && request.addonId.length > 0);
    assert.equal(typeof request.allowShebang, 'boolean');
    assert.ok(Array.isArray(request.conditions) && request.conditions.length <= 256);
    for (const condition of request.conditions) {
      exact(condition, ['providerId', 'name', 'raw', 'values', 'source']);
      for (const key of ['providerId', 'name', 'raw']) assert.equal(typeof condition[key], 'string');
      assert.ok(condition.providerId.length > 0 && condition.name.length > 0);
      assert.ok(Array.isArray(condition.values) && condition.values.every(value => typeof value === 'string'));
      const source = condition.source; exact(source, ['file', 'range']); exact(source.range, ['start', 'end']);
      assert.ok(typeof source.file === 'string' && source.file.length > 0 && source.file.length <= 4096);
      for (const point of [source.range.start, source.range.end]) {
        exact(point, ['line', 'column']); assert.ok(Number.isSafeInteger(point.line) && point.line >= 0);
        assert.ok(Number.isSafeInteger(point.column) && point.column >= 0);
      }
      const {start, end} = source.range;
      assert.ok(end.line > start.line || (end.line === start.line && end.column >= start.column));
    }
    validateXmlProviderProfile({schemaVersion: 1, policy: request.xmlPolicy});
    request.inlineProfile = validateXmlInlineProfile(request.inlineProfile);
    return request;
  } catch { throw Error('graph-analysis-input'); }
}

function verifyToc(parsed, content, filename) {
  exact(parsed, ['metadata', 'entries', 'diagnostics']);
  assert.equal(parsed.metadata.schemaVersion, 2); assert.equal(parsed.metadata.tocPath, filename);
  const lines = content.split(/\r\n|\r|\n/u);
  assert.equal(parsed.entries.length, lines.length);
  const suffixes = {Standard: ['retail', 'mainline'], Mainline: ['retail', 'mainline'], Classic: ['unknown', 'classic'],
    Vanilla: ['classic-era', 'classic'], TBC: ['tbc-classic', 'classic'], Wrath: ['wrath-classic', 'classic'],
    Cata: ['cataclysm-classic', 'classic'], Mists: ['mists-classic', 'classic'], WoWLabs: ['retail', 'mainline'],
    Plunderstorm: ['retail', 'mainline'], WoWHack: ['retail', 'mainline']};
  const basename = filename.replace(/\\/gu, '/').split('/').at(-1).replace(/\.toc$/iu, '');
  const suffix = Object.keys(suffixes).find(key => basename.toLowerCase().endsWith(`_${key.toLowerCase()}`)) ?? null;
  assert.equal(parsed.metadata.tocSuffix, suffix);
  assert.equal(parsed.metadata.name, suffix === null ? basename : basename.slice(0, -suffix.length - 1));
  assert.equal(parsed.metadata.client, suffix === null ? 'unknown' : suffixes[suffix][0]);
  assert.equal(parsed.metadata.clientFamily, suffix === null ? 'unknown' : suffixes[suffix][1]);
  assert.equal(parsed.metadata.gameMode, 'unknown');
  function projection(text, line, base) {
    const conditions = [], positions = []; let clean = '', cursor = 0;
    for (const match of text.matchAll(/\[(AllowLoadGameType|ExcludeLoadGameType|AllowLoadTextLocale|AllowLoad|Bootstrap)(?:\s+([^\]]*))?\]/gi)) {
      for (let offset = cursor; offset < match.index; offset++) {clean += text[offset]; positions.push(base + offset);}
      const raw = match[0];
      conditions.push({name: match[1], values: match[2] ? match[2].split(',').map(value => value.trim()).filter(Boolean) : [], raw,
        source: {file: filename, range: {start: {line, column: base + match.index}, end: {line, column: base + match.index + raw.length}}}});
      cursor = match.index + raw.length;
    }
    for (let offset = cursor; offset < text.length; offset++) {clean += text[offset]; positions.push(base + offset);}
    return {clean, conditions, positions};
  }
  const saved = [], expectedFiles = [], expectedDirectives = [], diagnostics = [], references = [], seenSaved = new Set();
  const metadataLists = {interfaceVersions: [], dependencies: [], optionalDependencies: [], embeddedLibraries: []}, custom = new Map();
  const unique = (list, value) => {if (!list.includes(value)) list.push(value);};
  const diagnostic = (severity, code, message, source) => diagnostics.push({severity, code, message, source});
  const keyword = new Set('and break do else elseif end false for function if in local nil not or repeat return then true until while'.split(' '));
  const slice = source => {
    exact(source, ['file', 'range']); assert.equal(source.file, filename); exact(source.range, ['start', 'end']);
    const {start, end} = source.range;
    for (const point of [start, end]) {
      exact(point, ['line', 'column']); assert.ok(Number.isSafeInteger(point.line) && point.line >= 0 && point.line < lines.length);
      assert.ok(Number.isSafeInteger(point.column) && point.column >= 0 && point.column <= lines[point.line].length);
    }
    assert.equal(start.line, end.line); assert.ok(end.column >= start.column);
    return lines[start.line].slice(start.column, end.column);
  };
  const stack = [parsed]; let records = 0;
  while (stack.length) {
    assert.ok(++records <= 1000000);
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Object.hasOwn(value, 'file') && Object.hasOwn(value, 'range')) { slice(value); continue; }
    for (const child of Object.values(value)) stack.push(child);
  }
  for (const [index, entry] of parsed.entries.entries()) {
    assert.ok(['blank', 'comment', 'directive', 'file', 'invalid'].includes(entry.kind));
    assert.equal(entry.raw, lines[index]); assert.equal(entry.source.range.start.line, index);
    assert.equal(entry.source.range.start.column, 0); assert.equal(slice(entry.source), lines[index]);
    const original = lines[index].slice(0, 1024), bom = index === 0 && original.startsWith('\uFEFF') ? 1 : 0;
    const effective = original.slice(bom);
    if (lines[index].length > 1024) diagnostic('warning', 'TOC0005', 'Game client ignores text after character 1024', entry.source);
    if (!effective.trim()) assert.equal(entry.kind, 'blank');
    else if (/^#{2,}\s*$/u.test(effective) || (effective.startsWith('#') && !effective.startsWith('##'))) assert.equal(entry.kind, 'comment');
    else if (effective.startsWith('##')) {
      const match = /^##\s*([Xx]-[A-Za-z0-9_][A-Za-z0-9_.-]*|[A-Za-z_][A-Za-z0-9_-]*)(\s*(?:\[[^\]]+\]\s*)*):(.*)$/u.exec(effective);
      const header = match ? projection(match[2], index, bom + effective.indexOf(match[1]) + match[1].length) : null;
      if (!match || header.clean.trim()) {
        assert.equal(entry.kind, 'invalid');
        if (!match) diagnostic('error', 'TOC0001', 'Expected ## Directive: Value', entry.source);
        else {
          const first = header.clean.search(/\S/u), last = header.clean.trimEnd().length - 1;
          diagnostic('error', 'TOC0001', `Unsupported or malformed TOC header annotation: ${header.clean.slice(first).trimEnd()}`,
            {file: filename, range: {start: {line: index, column: header.positions[first]}, end: {line: index, column: header.positions[last] + 1}}});
        }
        continue;
      }
      assert.equal(entry.kind, 'directive');
      const base = bom + effective.length - match[3].length, value = projection(match[3], index, base);
      const conditions = [...header.conditions, ...value.conditions], name = match[1];
      const directive = {name, normalizedName: name.toLowerCase(), value: value.clean.trim(), rawValue: match[3], source: entry.source, conditions};
      assert.deepEqual(entry.directive, directive); expectedDirectives.push(directive); references.push(entry.source);
      const key = directive.normalizedName;
      if (['interface', 'savedvariables', 'savedvariablespercharacter', 'requireddeps', 'optionaldeps', 'x-embeds'].includes(key) || key.startsWith('dep')) {
        let start = 0; const cells = [];
        for (const cell of value.clean.split(',')) {
          const token = cell.trim(), offset = start + cell.length - cell.trimStart().length;
          const mappedEnd = value.positions.length ? value.positions.at(-1) + 1 : base;
          const begin = value.positions[offset] ?? mappedEnd, end = token ? (value.positions[offset + token.length - 1] ?? begin) + 1 : begin;
          const source = {file: filename, range: {start: {line: index, column: begin}, end: {line: index, column: end}}};
          if (token) {
            cells.push({token, source});
          } else if (value.clean.length > 0) diagnostic('warning', 'TOC0004', `Empty item in ${name}`, source);
          start += cell.length + 1;
        }
        for (const {token, source} of cells) {
          if (key === 'savedvariables' || key === 'savedvariablespercharacter') {
            const validIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(token) && !keyword.has(token);
            if (!validIdentifier) diagnostic('warning', 'TOC0003', `Invalid Lua identifier: ${token}`, source);
            if (seenSaved.has(token)) diagnostic('warning', 'TOC0002', `Repeated SavedVariables name: ${token}`, source);
            seenSaved.add(token); saved.push({name: token, scope: key === 'savedvariables' ? 'account' : 'character', validIdentifier, source, conditions});
            references.push(source);
          } else unique(metadataLists[key === 'interface' ? 'interfaceVersions' : key === 'optionaldeps' ? 'optionalDependencies' :
            key.startsWith('dep') || key === 'requireddeps' ? 'dependencies' : 'embeddedLibraries'], token);
        }
        if (key === 'x-embeds') {
          const row = custom.get(key) ?? {name, values: []}; row.values.push(directive.value); custom.set(key, row);
        }
      } else {
        const row = custom.get(key) ?? {name, values: []}; row.values.push(directive.value); custom.set(key, row);
      }
    } else {
      assert.equal(entry.kind, 'file'); const value = projection(effective, index, bom);
      const expected = {path: value.clean.trimEnd(), source: entry.source, conditions: value.conditions};
      assert.deepEqual(entry.fileEntry, expected); expectedFiles.push(expected); references.push(entry.source);
      if (/^\s+/u.test(expected.path)) diagnostic('warning', 'TOC0006', 'Leading whitespace belongs to the filename', entry.source);
    }
  }
  assert.deepEqual(parsed.metadata.fileEntries, expectedFiles);
  assert.deepEqual(parsed.metadata.files, expectedFiles.map(row => row.path));
  assert.deepEqual(parsed.metadata.directives, expectedDirectives);
  assert.deepEqual(parsed.metadata.savedVariableDeclarations, saved);
  assert.deepEqual(parsed.metadata.sourceReferences, references);
  for (const [key, list] of Object.entries(metadataLists)) assert.deepEqual(parsed.metadata[key], list);
  assert.deepEqual(parsed.metadata.customMetadata, Object.fromEntries([...custom.values()].map(row => [row.name, row.values])));
  assert.equal(parsed.metadata.interface, metadataLists.interfaceVersions[0]);
  for (const [key, scope] of [['savedVariables', 'account'], ['savedVariablesPerCharacter', 'character']]) {
    assert.deepEqual(parsed.metadata[key], [...new Set(saved.filter(row => row.scope === scope).map(row => row.name))]);
  }
  assert.deepEqual(parsed.diagnostics, diagnostics);
}

/** A receipt confirms direct worker API calls, never the SDK's internal subcalls. */
export function verifyGraphAnalysisReply(reply, request) {
  exact(reply, ['result', 'confirmedApiCalls', 'failure']);
  exact(reply.confirmedApiCalls, graphApis);
  for (const counts of Object.values(reply.confirmedApiCalls)) {
    exact(counts, ['invoked', 'returned']);
    assert.ok(Number.isSafeInteger(counts.invoked) && counts.invoked >= 0 && counts.invoked <= 5000);
    assert.ok(Number.isSafeInteger(counts.returned) && counts.returned >= 0 && counts.returned <= counts.invoked);
  }
  assert.ok(reply.failure === null || ['backend', 'resource', 'invariant'].includes(reply.failure));
  const calls = reply.confirmedApiCalls;
  const root = request.language === 'toc' ? 'parseToc' : request.language === 'lua' ? 'analyzeLua' : 'parseXml';
  assert.equal(calls[root].invoked, 1);
  if (request.language !== 'xml') {
    for (const name of graphApis) if (name !== root) assert.deepEqual(calls[name], {invoked: 0, returned: 0});
  } else {
    assert.deepEqual(calls.parseToc, {invoked: 0, returned: 0});
    assert.ok(calls.analyzeXml.invoked <= calls.parseXml.returned);
    assert.ok(calls.analyzeLua.invoked === 0 || calls.analyzeXml.returned === 1);
    assert.ok(calls.mapXmlValueRanges.invoked <= calls.analyzeLua.returned);
    assert.ok(calls.analyzeLua.returned - calls.mapXmlValueRanges.invoked <= 1);
    if (calls.mapXmlValueRanges.invoked !== calls.mapXmlValueRanges.returned) {
      assert.equal(calls.analyzeLua.returned, calls.mapXmlValueRanges.invoked);
    }
  }
  assert.ok(Object.values(calls).reduce((sum, count) => sum + count.invoked - count.returned, 0) <= 1);
  // Failed whole-result validation is atomic: callers get neither syntax credit nor a partial projection.
  if (reply.failure !== null) { assert.equal(reply.result, null); return reply; }
  const result = reply.result;
  assert.equal(result.language, request.language);
  const expected = emptyGraphCalls(), one = name => { expected[name] = {invoked: 1, returned: 1}; };
  const association = {addonId: request.addonId, conditions: request.conditions};
  if (result.language === 'toc') {
    exact(result, ['language', 'parsed']); verifyToc(result.parsed, request.content, request.sourcePath); one('parseToc');
  } else if (result.language === 'lua') {
    exact(result, ['language', 'result']);
    verifyLuaProjection(result.result, {value: request.content}, {kind: 'chunk'}, request.sourcePath, association, 1000000); one('analyzeLua');
  } else {
    exact(result, ['language', 'syntax', 'provider', 'inline']);
    const sourceLines = buildSourceLineIndex(request.content);
    verifyXmlSyntax(result.syntax, request.content, request.sourcePath, sourceLines); one('parseXml');
    assert.ok(Array.isArray(result.inline));
    if (!result.syntax.complete) { assert.equal(result.provider, null); assert.deepEqual(result.inline, []); }
    else {
      one('analyzeXml');
      const attemptedBodies = verifyGraphXmlInlineLua(result.inline, request.content, request.sourcePath, result.syntax,
        result.provider, request.xmlPolicy, request.inlineProfile, association, sourceLines);
      expected.analyzeLua = {invoked: attemptedBodies, returned: attemptedBodies};
      expected.mapXmlValueRanges = {...expected.analyzeLua};
    }
  }
  assert.deepEqual(calls, expected);
  return {result, confirmedApiCalls: calls, failure: null};
}
