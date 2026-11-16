import {
  METADATA_SCHEMA_VERSION, WoWClient, WoWGameMode,
  type AddOnMetadata, type InlineCondition, type MetadataDirective,
  type TocEntry, type TocParseResult, type SavedVariableScope,
  type WoWClientFamily,
} from '@wow-addon/addon-metadata';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';

/**
 * @beta
 */
export interface TocParseOptions {
  /** Explicit environment selection; never inferred from a Hardcore/SoD TOC suffix. */
  client?: WoWClient;
  gameMode?: WoWGameMode;
}

const SUFFIXES: Readonly<Record<string, { client: WoWClient; family: WoWClientFamily }>> = {
  Standard: { client: WoWClient.Retail, family: 'mainline' },
  Mainline: { client: WoWClient.Retail, family: 'mainline' },
  Classic: { client: WoWClient.Unknown, family: 'classic' },
  Vanilla: { client: WoWClient.ClassicEra, family: 'classic' },
  TBC: { client: WoWClient.BurningCrusadeClassic, family: 'classic' },
  Wrath: { client: WoWClient.WrathClassic, family: 'classic' },
  Cata: { client: WoWClient.CataclysmClassic, family: 'classic' },
  Mists: { client: WoWClient.MistsClassic, family: 'classic' },
  WoWLabs: { client: WoWClient.Retail, family: 'mainline' },
  Plunderstorm: { client: WoWClient.Retail, family: 'mainline' },
  WoWHack: { client: WoWClient.Retail, family: 'mainline' },
};

const INLINE_CONDITION = /\[(AllowLoadGameType|ExcludeLoadGameType|AllowLoadTextLocale|AllowLoad|Bootstrap)(?:\s+([^\]]*))?\]/gi;
const LUA_GLOBAL = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const LUA_51_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while',
]);

function source(file: string, line: number, begin: number, end: number): SourceReference {
  return { file, range: { start: { line, column: begin }, end: { line, column: Math.max(begin, end) } } };
}

function targetFromPath(tocPath: string, options: TocParseOptions): {
  name: string; client: WoWClient; family: WoWClientFamily; suffix: string | null;
} {
  const filename = tocPath.replace(/\\/g, '/').split('/').at(-1) ?? '';
  const basename = filename.replace(/\.toc$/i, '');
  const found = Object.keys(SUFFIXES).find((suffix) => basename.toLowerCase().endsWith(`_${suffix.toLowerCase()}`));
  const info = found ? SUFFIXES[found] : undefined;
  let client = options.client ?? info?.client ?? WoWClient.Unknown;
  let family = info?.family ?? 'unknown';
  if (client !== WoWClient.Unknown && options.client !== undefined) {
    family = client === WoWClient.Retail ? 'mainline' : 'classic';
  }
  return {
    name: found ? basename.slice(0, -found.length - 1) : basename,
    client, family, suffix: found ?? null,
  };
}

/** Strip recognized conditions while retaining a source-character mapping for exact ranges. */
function extractConditions(text: string, tocPath: string, line: number, baseColumn: number): {
  clean: string; positions: number[]; conditions: InlineCondition[];
} {
  const conditions: InlineCondition[] = [];
  const positions: number[] = [];
  const chunks: string[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_CONDITION)) {
    const offset = match.index;
    if (offset === undefined) continue;
    const raw = match[0];
    const name = match[1] ?? '';
    const values = match[2];
    const before = text.slice(cursor, offset);
    chunks.push(before);
    for (let index = cursor; index < offset; index++) positions.push(index);
    conditions.push({
      name, values: values ? values.split(',').map((v) => v.trim()).filter(Boolean) : [], raw,
      source: source(tocPath, line, baseColumn + offset, baseColumn + offset + raw.length),
    });
    cursor = offset + raw.length;
  }
  const after = text.slice(cursor);
  chunks.push(after);
  for (let index = cursor; index < text.length; index++) positions.push(index);
  return { clean: chunks.join(''), positions, conditions };
}

function appendUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

/**
 * @beta
 */
export function parseToc(content: string, tocPath: string, options: TocParseOptions = {}): TocParseResult {
  const target = targetFromPath(tocPath, options);
  const metadata: AddOnMetadata = {
    schemaVersion: METADATA_SCHEMA_VERSION,
    name: target.name, tocPath, client: target.client, clientFamily: target.family,
    gameMode: options.gameMode ?? WoWGameMode.Unknown, tocSuffix: target.suffix,
    interfaceVersions: [], savedVariables: [], savedVariablesPerCharacter: [],
    dependencies: [], optionalDependencies: [], files: [], embeddedLibraries: [],
    customMetadata: Object.create(null) as Record<string, string[]>,
    directives: [], fileEntries: [], savedVariableDeclarations: [], sourceReferences: [],
  };
  const diagnostics: Diagnostic[] = [];
  const entries: TocEntry[] = [];
  const customMetadata = new Map<string, { originalName: string; values: string[] }>();
  const addCustomMetadata = (name: string, value: string): void => {
    const key = name.toLowerCase();
    let record = customMetadata.get(key);
    if (!record) {
      record = { originalName: name, values: [] };
      customMetadata.set(key, record);
    }
    record.values.push(value);
  };
  const seenSavedVariables = new Map<string, SavedVariableScope>();
  const addDiagnostic = (
    severity: Diagnostic['severity'], code: string, message: string, ref: SourceReference,
  ): void => { diagnostics.push({ severity, code, message, source: ref }); };

  /** List split retains empty cells and their source offsets for precise diagnostics. */
  const parseList = (value: string, positions: readonly number[], line: number, baseColumn: number, label: string): {
    value: string; source: SourceReference;
  }[] => {
    const result: { value: string; source: SourceReference }[] = [];
    let start = 0;
    for (const segment of value.split(',')) {
      const leftTrim = segment.length - segment.trimStart().length;
      const token = segment.trim();
      const tokenStartIndex = start + leftTrim;
      // A trailing empty cell has no mapped character; use the mapped end
      // rather than incorrectly pointing back to the start of the value.
      const mappedEnd = positions.length > 0 ? positions[positions.length - 1]! + 1 : 0;
      const startOriginal = positions[tokenStartIndex] ?? mappedEnd;
      const endOriginal = token.length > 0
        ? (positions[tokenStartIndex + token.length - 1] ?? startOriginal) + 1
        : startOriginal;
      const ref = source(tocPath, line, baseColumn + startOriginal, baseColumn + endOriginal);
      if (token) result.push({ value: token, source: ref });
      else if (value.length > 0) addDiagnostic('warning', 'TOC0004', `Empty item in ${label}`, ref);
      start += segment.length + 1;
    }
    return result;
  };

  const lines = content.split(/\r\n|\n|\r/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const original = lines[lineIndex] ?? '';
    // The game processes only the first 1024 characters of each line.
    const effective = original.slice(0, 1024);
    const bomOffset = lineIndex === 0 && effective.startsWith('\uFEFF') ? 1 : 0;
    const line = effective.slice(bomOffset);
    const whole = source(tocPath, lineIndex, 0, original.length);
    if (original.length > 1024) {
      addDiagnostic('warning', 'TOC0005', 'Game client ignores text after character 1024', whole);
    }
    const kindEntry = (kind: TocEntry['kind'], props: Partial<TocEntry> = {}): void => {
      entries.push({ kind, raw: original, source: whole, ...props });
    };
    if (line.trim().length === 0) { kindEntry('blank'); continue; }
    if (line.startsWith('##')) {
      const match = /^##\s*([A-Za-z_][A-Za-z0-9_-]*)(\s*(?:\[[^\]]+\]\s*)*):(.*)$/.exec(line);
      if (!match) {
        addDiagnostic('error', 'TOC0001', 'Expected ## Directive: Value', whole);
        kindEntry('invalid');
        continue;
      }
      const name = match[1] ?? '';
      const rawValue = match[3] ?? '';
      const headerStart = line.indexOf(name) + name.length;
      const headerText = match[2] ?? '';
      const parsedHeader = extractConditions(headerText, tocPath, lineIndex, bomOffset + headerStart);
      // Reject unrecognized bracket annotations rather than silently erasing
      // their conditional semantics and exposing an unconditional global.
      if (parsedHeader.clean.trim().length > 0) {
        const first = parsedHeader.clean.search(/\S/);
        const last = parsedHeader.clean.trimEnd().length - 1;
        const firstOriginal = parsedHeader.positions[first] ?? 0;
        const lastOriginal = parsedHeader.positions[last] ?? firstOriginal;
        const invalidText = parsedHeader.clean.slice(first).trimEnd();
        const annotationSource = source(
          tocPath, lineIndex,
          bomOffset + headerStart + firstOriginal,
          bomOffset + headerStart + lastOriginal + 1,
        );
        addDiagnostic('error', 'TOC0001', `Unsupported or malformed TOC header annotation: ${invalidText}`, annotationSource);
        kindEntry('invalid');
        continue;
      }
      const headerConditions = parsedHeader.conditions;
      const colonIndex = line.length - rawValue.length - 1;
      const rawStart = bomOffset + colonIndex + 1;
      const { clean, positions, conditions: valueConditions } = extractConditions(rawValue, tocPath, lineIndex, rawStart);
      const conditions = [...headerConditions, ...valueConditions];
      const directive: MetadataDirective = {
        name, normalizedName: name.toLowerCase(), value: clean.trim(), rawValue,
        source: whole, conditions,
      };
      metadata.directives.push(directive);
      metadata.sourceReferences.push(whole);
      kindEntry('directive', { directive });
      const csv = () => parseList(clean, positions, lineIndex, rawStart, name);
      const key = directive.normalizedName;
      if (key === 'interface') {
        for (const item of csv()) appendUnique(metadata.interfaceVersions, item.value);
        if (metadata.interface === undefined && metadata.interfaceVersions[0] !== undefined) {
          metadata.interface = metadata.interfaceVersions[0];
        }
      } else if (key === 'savedvariables' || key === 'savedvariablespercharacter') {
        const scope: SavedVariableScope = key === 'savedvariables' ? 'account' : 'character';
        const list = scope === 'account' ? metadata.savedVariables : metadata.savedVariablesPerCharacter;
        for (const item of csv()) {
          const validIdentifier = LUA_GLOBAL.test(item.value) && !LUA_51_KEYWORDS.has(item.value);
          if (!validIdentifier) addDiagnostic('warning', 'TOC0003', `Invalid Lua identifier: ${item.value}`, item.source);
          if (seenSavedVariables.has(item.value)) {
            addDiagnostic('warning', 'TOC0002', `Repeated SavedVariables name: ${item.value}`, item.source);
          }
          seenSavedVariables.set(item.value, scope);
          appendUnique(list, item.value);
          metadata.savedVariableDeclarations.push({
            name: item.value, scope, validIdentifier, source: item.source, conditions,
          });
          metadata.sourceReferences.push(item.source);
        }
      } else if (key === 'optionaldeps') {
        for (const item of csv()) appendUnique(metadata.optionalDependencies, item.value);
      } else if (key === 'dependencies' || key === 'requireddeps' || key.startsWith('dep')) {
        for (const item of csv()) appendUnique(metadata.dependencies, item.value);
      } else if (key === 'x-embeds') {
        for (const item of csv()) appendUnique(metadata.embeddedLibraries, item.value);
        addCustomMetadata(name, directive.value);
      } else {
        addCustomMetadata(name, directive.value);
      }
      continue;
    }
    if (line.startsWith('#')) { kindEntry('comment'); continue; }

    // Leading whitespace is part of a file path in TOC, not a comment prefix.
    const { clean, conditions } = extractConditions(line, tocPath, lineIndex, bomOffset);
    const path = clean.trimEnd();
    const fileEntry = { path, source: whole, conditions };
    metadata.files.push(path);
    metadata.fileEntries.push(fileEntry);
    metadata.sourceReferences.push(whole);
    kindEntry('file', { fileEntry });
    if (/^\s+/.test(path)) {
      addDiagnostic('warning', 'TOC0006', 'Leading whitespace belongs to the filename', whole);
    }
  }
  metadata.customMetadata = Object.fromEntries(
    Array.from(customMetadata.values(), ({ originalName, values }) => [originalName, values]),
  );
  return { metadata, entries, diagnostics };
}
