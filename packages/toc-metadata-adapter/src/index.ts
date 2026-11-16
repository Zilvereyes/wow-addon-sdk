import {
  CLIENT_ENVIRONMENT_SCHEMA_VERSION, METADATA_SCHEMA_VERSION, WoWClient, WoWGameMode,
  type AddOnMetadata, type ClientEnvironment, type TocVariantIdentity, type WoWClientFamily,
} from '@wow-addon/addon-metadata';
import type { SourceReference } from '@wow-addon/diagnostics';
import type { GlobalDeclaration, GlobalRegistry } from '@wow-addon/global-registry';
import { buildGlobalRegistry } from '@wow-addon/global-registry';

/**
 * Convert TOC metadata to provider-neutral globals; do not evaluate conditions here.
 *
 * @beta
 */
export function toGlobalDeclarations(addons: readonly AddOnMetadata[]): GlobalDeclaration[] {
  const output: GlobalDeclaration[] = [];
  for (const addon of addons) {
    for (const saved of addon.savedVariableDeclarations) {
      if (!saved.validIdentifier) continue;
      output.push({
        name: saved.name,
        // Distinguish different TOC client variants; the future resolver selects the active one.
        addonId: addon.tocPath,
        kind: 'saved-variable',
        scope: saved.scope,
        activationState: saved.conditions.length ? 'conditional' : 'unconditional',
        source: saved.source,
      });
    }
  }
  return output;
}

/**
 * Convenience function; the registry itself never imports metadata or TOC.
 *
 * @beta
 */
export function buildTocGlobalRegistry(addons: readonly AddOnMetadata[]): GlobalRegistry {
  return buildGlobalRegistry(toGlobalDeclarations(addons));
}

/**
 * Explicit caller-owned selection rules, not a built-in WoW loader table.
 * Optional game type/mode fields are exact applicability constraints.
 * Suffixes are ASCII letter-led tokens containing letters, digits, underscore
 * or hyphen. Null denotes an exact unsuffixed base filename; priority order is
 * significant and duplicates are invalid, including case-equivalent suffixes.
 *
 * @beta
 */
export interface TocSelectionPolicy {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly client: WoWClient;
  readonly clientFamily: WoWClientFamily;
  readonly gameType?: string;
  readonly gameMode?: WoWGameMode;
  readonly suffixPrecedence: readonly (string | null)[];
}

/**
 * One caller-grouped source variant and its separately parsed metadata.
 * Existing nested metadata/source contracts remain shallowly readonly.
 *
 * @beta
 */
export interface TocSelectionCandidate {
  readonly identity: TocVariantIdentity;
  readonly metadata: AddOnMetadata;
}

/**
 * Selection-specific issue. Environment-only failures can have no source.
 * Source references are copied so result edits cannot mutate input provenance.
 * The shared Diagnostic contract remains unchanged.
 *
 * @beta
 */
export interface TocSelectionIssue {
  readonly code: 'TOCSEL0001' | 'TOCSEL0002' | 'TOCSEL0003' | 'TOCSEL0004';
  readonly message: string;
  readonly sources: readonly SourceReference[];
}

/**
 * Derived selection only: selectedVariantId is present exactly for selected.
 * No metadata, static registry or condition activation is changed.
 *
 * @beta
 */
export interface TocSelectionResult {
  readonly status: 'selected' | 'no-match' | 'unresolved' | 'ambiguous' | 'invalid';
  readonly selectedVariantId?: string;
  readonly issues: readonly TocSelectionIssue[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function suffix(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value));
}

function knownClient(value: unknown): value is WoWClient {
  return Object.values(WoWClient).some(client => client !== WoWClient.Unknown && client === value);
}

function familyOf(client: WoWClient): 'mainline' | 'classic' {
  return client === WoWClient.Retail ? 'mainline' : 'classic';
}

function knownMode(value: unknown): value is WoWGameMode {
  return Object.values(WoWGameMode).some(mode => mode !== WoWGameMode.Unknown && mode === value);
}

function validSource(value: unknown): value is SourceReference {
  if (!record(value) || !nonempty(value.file) || !record(value.range)) return false;
  const { start, end } = value.range;
  if (!record(start) || !record(end)) return false;
  for (const position of [start, end]) {
    if (!Number.isSafeInteger(position.line) || !Number.isSafeInteger(position.column) ||
        (position.line as number) < 0 || (position.column as number) < 0) return false;
  }
  return (end.line as number) > (start.line as number) ||
    (end.line === start.line && (end.column as number) >= (start.column as number));
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function selectionResult(
  status: TocSelectionResult['status'], issues: readonly TocSelectionIssue[], selectedVariantId?: string,
): TocSelectionResult {
  const canonical = issues.map(issue => ({
    code: issue.code, message: issue.message,
    sources: issue.sources.map(source => ({
      file: source.file, range: {
        start: { line: source.range.start.line, column: source.range.start.column },
        end: { line: source.range.end.line, column: source.range.end.column },
      },
    })).sort((a, b) => compareText(a.file, b.file) || a.range.start.line - b.range.start.line ||
      a.range.start.column - b.range.start.column || a.range.end.line - b.range.end.line ||
      a.range.end.column - b.range.end.column),
  })).sort((a, b) => compareText(a.code, b.code) || compareText(a.message, b.message) ||
    compareText(JSON.stringify(a.sources), JSON.stringify(b.sources)));
  return selectedVariantId === undefined ? { status, issues: canonical } : { status, selectedVariantId, issues: canonical };
}

/**
 * Validate and apply an explicit caller policy without filesystem access,
 * suffix/game semantics inference, condition evaluation or input mutation.
 * Basenames remain exact (including Unicode); only extension and suffix
 * comparisons ignore case. A parser null suffix on an unfamiliar filename
 * never establishes unsuffixed fallback. No-match is a normal empty result.
 * Runtime checks validate the fields consumed by selection, not every field
 * in the legacy metadata payload. Native objects/getters remain caller code.
 *
 * @beta
 */
export function selectTocVariant(
  environment: ClientEnvironment,
  logicalAddonId: string,
  addonBaseName: string,
  candidates: readonly TocSelectionCandidate[],
  policy: TocSelectionPolicy,
): TocSelectionResult {
  const invalidPolicy = (): TocSelectionResult => selectionResult('invalid', [{
    code: 'TOCSEL0001', message: 'Invalid environment, selection policy or logical AddOn input.', sources: [],
  }]);
  const unresolved = (): TocSelectionResult => selectionResult('unresolved', [{
    code: 'TOCSEL0004', message: 'Environment knowledge or policy applicability is unresolved.', sources: [],
  }]);
  if (!record(environment) || environment.schemaVersion !== CLIENT_ENVIRONMENT_SCHEMA_VERSION ||
      typeof environment.client !== 'string' || typeof environment.clientFamily !== 'string' ||
      (['gameType', 'gameMode', 'textLocale'] as const).some(field =>
        Object.hasOwn(environment, field) && typeof environment[field] !== 'string') ||
      !nonempty(logicalAddonId) || !nonempty(addonBaseName) || addonBaseName === '.' || addonBaseName === '..' ||
      /[\\/:\u0000-\u001f]/.test(addonBaseName)) return invalidPolicy();
  if (!record(policy) || policy.schemaVersion !== 1 || !nonempty(policy.id) || !knownClient(policy.client) ||
      policy.clientFamily !== familyOf(policy.client) || !Array.isArray(policy.suffixPrecedence) ||
      policy.suffixPrecedence.length === 0 || !Array.from(policy.suffixPrecedence).every(suffix) ||
      (Object.hasOwn(policy, 'gameType') && !nonempty(policy.gameType)) ||
      (Object.hasOwn(policy, 'gameMode') && !knownMode(policy.gameMode))) return invalidPolicy();
  const priorities = policy.suffixPrecedence.map(value => value === null ? null : value.toLowerCase());
  if (new Set(priorities).size !== priorities.length) return invalidPolicy();
  if (!knownClient(environment.client) || environment.clientFamily === 'unknown') return unresolved();
  if (environment.clientFamily !== familyOf(environment.client)) return invalidPolicy();
  if (environment.client !== policy.client || environment.clientFamily !== policy.clientFamily ||
      (Object.hasOwn(policy, 'gameType') && environment.gameType !== policy.gameType) ||
      (Object.hasOwn(policy, 'gameMode') && environment.gameMode !== policy.gameMode)) return unresolved();

  const issues: TocSelectionIssue[] = [];
  const usable: { id: string; priority: number; source: SourceReference }[] = [];
  const groups = new Map<string, SourceReference[]>();
  if (!Array.isArray(candidates)) return selectionResult('invalid', [{
    code: 'TOCSEL0002', message: 'Selection candidates must be an array.', sources: [],
  }]);
  for (const candidate of candidates) {
    const identity: unknown = record(candidate) ? candidate.identity : undefined;
    const metadata: unknown = record(candidate) ? candidate.metadata : undefined;
    const source: unknown = record(identity) ? identity.source : undefined;
    const sources = validSource(source) ? [source] : [];
    if (!record(identity) || !record(metadata) || !nonempty(identity.tocPath) ||
        identity.logicalAddonId !== logicalAddonId ||
        identity.tocVariantId !== JSON.stringify([logicalAddonId, identity.tocPath]) ||
        metadata.schemaVersion !== METADATA_SCHEMA_VERSION || metadata.tocPath !== identity.tocPath ||
        !suffix(identity.tocSuffix) || !suffix(metadata.tocSuffix) ||
        (identity.tocSuffix === null ? metadata.tocSuffix !== null :
          metadata.tocSuffix === null || identity.tocSuffix.toLowerCase() !== metadata.tocSuffix.toLowerCase()) ||
        !validSource(source)) {
      issues.push({ code: 'TOCSEL0002', message: 'Invalid candidate identity, metadata projection or source reference.', sources });
      continue;
    }
    const id = identity.tocVariantId as string;
    const group = groups.get(id) ?? [];
    group.push(source);
    groups.set(id, group);
    const filename = identity.tocPath.split(/[\\/]/).at(-1) ?? '';
    if (!filename.toLowerCase().endsWith('.toc')) continue;
    const stem = filename.slice(0, -4);
    const variantSuffix = identity.tocSuffix === null ? null : identity.tocSuffix.toLowerCase();
    const matches = variantSuffix === null ? stem === addonBaseName :
      stem.startsWith(`${addonBaseName}_`) && stem.slice(addonBaseName.length + 1).toLowerCase() === variantSuffix;
    if (!matches) continue;
    const priority = priorities.indexOf(variantSuffix);
    if (priority !== -1) usable.push({ id, priority, source });
  }
  for (const sources of groups.values()) {
    if (sources.length > 1) issues.push({
      code: 'TOCSEL0002', message: 'Duplicate exact TOC variant identity.', sources,
    });
  }
  if (issues.length) return selectionResult('invalid', issues);
  if (usable.length === 0) return selectionResult('no-match', []);
  const bestPriority = usable.reduce((best, candidate) => Math.min(best, candidate.priority), Infinity);
  const best = usable.filter(candidate => candidate.priority === bestPriority);
  if (best.length > 1) return selectionResult('ambiguous', [{
    code: 'TOCSEL0003', message: 'Multiple TOC variants share the best available priority.', sources: best.map(candidate => candidate.source),
  }]);
  return selectionResult('selected', [], best[0]!.id);
}
