import {
  CLIENT_ENVIRONMENT_SCHEMA_VERSION, METADATA_SCHEMA_VERSION, WoWClient, WoWGameMode,
  type AddOnMetadata, type ClientEnvironment, type TocVariantIdentity, type WoWClientFamily,
} from '@wow-addon/addon-metadata';
import type { SourceReference } from '@wow-addon/diagnostics';
import type { GlobalDeclaration, GlobalRegistry, ResolvedAvailability } from '@wow-addon/global-registry';
import { buildGlobalRegistry } from '@wow-addon/global-registry';

/**
 * Convert TOC metadata to provider-neutral globals without evaluating conditions.
 * Nonempty condition lists are copied independently per declaration; empty lists
 * omit the optional field. Existing declaration source references stay shared.
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
        ...(saved.conditions.length ? { conditions: saved.conditions.map(condition => ({
          providerId: '@wow-addon/toc-metadata-adapter',
          name: condition.name, values: [...condition.values], raw: condition.raw,
          source: { file: condition.source.file, range: {
            start: { line: condition.source.range.start.line, column: condition.source.range.start.column },
            end: { line: condition.source.range.end.line, column: condition.source.range.end.column },
          } },
        })) } : {}),
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

/**
 * Explicit data-only caller semantics, not a built-in WoW condition table.
 * Provider IDs always match exactly; ASCII comparison folds A-Z only.
 * Values are ORed within a rule, with conservative AND across conditions.
 *
 * @beta
 */
export interface ConditionEvaluationPolicy {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly nameComparison: 'exact' | 'ascii-insensitive';
  readonly rules: readonly {
    readonly providerId: string;
    readonly name: string;
    readonly field: 'gameType' | 'textLocale' | 'gameMode';
    readonly operator: 'include' | 'exclude';
    readonly valueComparison: 'exact' | 'ascii-insensitive';
  }[];
}

/**
 * Fixed explanation with independent source copies. Context-only issues may
 * have no source; malformed source objects are never repaired or fabricated.
 *
 * @beta
 */
export interface ConditionEvaluationIssue {
  readonly code: 'CONDEVAL0001' | 'CONDEVAL0002' | 'CONDEVAL0003' |
    'CONDEVAL0004' | 'CONDEVAL0005' | 'CONDEVAL0006';
  readonly message: string;
  readonly sources: readonly SourceReference[];
}

/**
 * Derived condition availability under the supplied caller policy only.
 * This does not select a TOC or alter static declaration/registry visibility.
 *
 * @beta
 */
export interface ConditionEvaluationResult {
  readonly availability: ResolvedAvailability;
  readonly reason: 'unconditional' | 'conditions-satisfied' | 'condition-mismatch' |
    'missing-provenance' | 'unknown' | 'invalid-input';
  readonly issues: readonly ConditionEvaluationIssue[];
}

function asciiFold(value: string): string {
  return value.replace(/[A-Z]/g, character => character.toLowerCase());
}

function validConditionRule(value: unknown): value is ConditionEvaluationPolicy['rules'][number] {
  return record(value) && nonempty(value.providerId) && nonempty(value.name) &&
    typeof value.field === 'string' && ['gameType', 'textLocale', 'gameMode'].includes(value.field) &&
    typeof value.operator === 'string' && ['include', 'exclude'].includes(value.operator) &&
    typeof value.valueComparison === 'string' && ['exact', 'ascii-insensitive'].includes(value.valueComparison);
}

function compareSource(a: SourceReference, b: SourceReference): number {
  return compareText(a.file, b.file) || a.range.start.line - b.range.start.line ||
    a.range.start.column - b.range.start.column || a.range.end.line - b.range.end.line ||
    a.range.end.column - b.range.end.column;
}

function compareSourceLists(a: readonly SourceReference[], b: readonly SourceReference[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = compareSource(a[index]!, b[index]!);
    if (difference) return difference;
  }
  return a.length - b.length;
}

function conditionResult(
  availability: ResolvedAvailability,
  reason: ConditionEvaluationResult['reason'],
  issues: readonly ConditionEvaluationIssue[],
): ConditionEvaluationResult {
  return { availability, reason, issues: issues.map(issue => ({
    code: issue.code, message: issue.message,
    sources: issue.sources.map(origin => ({ file: origin.file, range: {
      start: { line: origin.range.start.line, column: origin.range.start.column },
      end: { line: origin.range.end.line, column: origin.range.end.column },
    } })).sort(compareSource),
  })).sort((a, b) => compareText(a.code, b.code) || compareText(a.message, b.message) ||
    compareSourceLists(a.sources, b.sources)) };
}

/**
 * Evaluate one caller-supplied declaration without selecting a source,
 * interpreting raw syntax, inferring game semantics or mutating any input.
 * Validate the consumed projection, not every legacy declaration field or
 * source-content bound. Ordinary malformed JSON shapes produce unknown.
 * Native objects/getters remain caller code, not a sandbox boundary.
 *
 * @beta
 */
export function evaluateGlobalConditions(
  declaration: GlobalDeclaration,
  environment: ClientEnvironment,
  policy: ConditionEvaluationPolicy,
): ConditionEvaluationResult {
  const invalidContext = (): ConditionEvaluationResult => conditionResult('unknown', 'invalid-input', [{
    code: 'CONDEVAL0001', message: 'Invalid environment or condition policy.', sources: [],
  }]);
  if (!record(environment) || environment.schemaVersion !== CLIENT_ENVIRONMENT_SCHEMA_VERSION ||
      typeof environment.client !== 'string' || typeof environment.clientFamily !== 'string' ||
      (['gameType', 'textLocale', 'gameMode'] as const).some(field =>
        Object.hasOwn(environment, field) && typeof environment[field] !== 'string') ||
      !record(policy) || policy.schemaVersion !== 1 || !nonempty(policy.id) ||
      !['exact', 'ascii-insensitive'].includes(policy.nameComparison) || !Array.isArray(policy.rules)) return invalidContext();
  const normalizeName = (value: string): string => policy.nameComparison === 'exact' ? value : asciiFold(value);
  const rules = new Map<string, ConditionEvaluationPolicy['rules'][number]>();
  for (const rule of Array.from(policy.rules)) {
    if (!validConditionRule(rule)) return invalidContext();
    const key = JSON.stringify([rule.providerId, normalizeName(rule.name)]);
    if (rules.has(key)) return invalidContext();
    rules.set(key, rule);
  }
  if (!knownClient(environment.client) || !['classic', 'mainline'].includes(environment.clientFamily)) {
    return conditionResult('unknown', 'unknown', [{
      code: 'CONDEVAL0005', message: 'Client environment knowledge is unresolved.', sources: [],
    }]);
  }
  if (environment.clientFamily !== familyOf(environment.client)) return invalidContext();
  const declarationSources = record(declaration) && validSource(declaration.source) ? [declaration.source] : [];
  const invalidDeclaration = (sources = declarationSources): ConditionEvaluationResult => conditionResult('unknown', 'invalid-input', [{
    code: 'CONDEVAL0002', message: 'Invalid or contradictory declaration projection.', sources,
  }]);
  if (!record(declaration) || !validSource(declaration.source) ||
      !['conditional', 'unconditional', 'unknown'].includes(declaration.activationState) ||
      (Object.hasOwn(declaration, 'conditions') && !Array.isArray(declaration.conditions))) return invalidDeclaration();
  const conditions = Array.from(declaration.conditions ?? []);
  const invalidDescriptors: ConditionEvaluationIssue[] = [];
  for (const descriptor of conditions) {
    if (!record(descriptor) || !nonempty(descriptor.providerId) || !nonempty(descriptor.name) ||
        typeof descriptor.raw !== 'string' || !Array.isArray(descriptor.values) ||
        !Array.from(descriptor.values).every(value => typeof value === 'string') || !validSource(descriptor.source)) {
      invalidDescriptors.push({ code: 'CONDEVAL0002', message: 'Invalid condition descriptor projection.',
        sources: record(descriptor) && validSource(descriptor.source) ? [descriptor.source] : declarationSources });
    }
  }
  if (invalidDescriptors.length) return conditionResult('unknown', 'invalid-input', invalidDescriptors);
  if (declaration.activationState === 'unknown') return conditionResult('unknown', 'unknown', [{
    code: 'CONDEVAL0002', message: 'Static activation provenance is unknown.', sources: declarationSources,
  }]);
  if (declaration.activationState === 'unconditional') {
    return conditions.length ? invalidDeclaration() : conditionResult('active', 'unconditional', []);
  }
  if (conditions.length === 0) return conditionResult('unknown', 'missing-provenance', [{
    code: 'CONDEVAL0002', message: 'Conditional declaration has no condition provenance.', sources: declarationSources,
  }]);

  let inactive = false;
  let unknown = false;
  const issues: ConditionEvaluationIssue[] = [];
  for (const descriptor of conditions) {
    const sources = [descriptor.source];
    const rule = rules.get(JSON.stringify([descriptor.providerId, normalizeName(descriptor.name)]));
    if (!rule) {
      unknown = true;
      issues.push({ code: 'CONDEVAL0003', message: 'Provider condition is unsupported by the explicit policy.', sources });
      continue;
    }
    if (descriptor.values.length === 0 || descriptor.values.some(value => value.length === 0)) {
      unknown = true;
      issues.push({ code: 'CONDEVAL0004', message: 'Condition arguments are missing or empty.', sources });
      continue;
    }
    const value = environment[rule.field];
    if (!nonempty(value) || (rule.field === 'gameMode' && !knownMode(value))) {
      unknown = true;
      issues.push({ code: 'CONDEVAL0005', message: 'Required environment field is unknown or unsupported.', sources });
      continue;
    }
    const normalizeValue = (text: string): string => rule.valueComparison === 'exact' ? text : asciiFold(text);
    const matched = descriptor.values.some(argument => normalizeValue(argument) === normalizeValue(value));
    const satisfied = rule.operator === 'include' ? matched : !matched;
    if (!satisfied) {
      inactive = true;
      issues.push({ code: 'CONDEVAL0006', message: 'Condition excludes the declaration under the explicit policy.', sources });
    }
  }
  if (inactive) return conditionResult('inactive', 'condition-mismatch', issues);
  if (unknown) return conditionResult('unknown', 'unknown', issues);
  return conditionResult('active', 'conditions-satisfied', []);
}
