import { WoWClient, WoWGameMode, type AddOnIdentity, type AddOnMetadata, type ClientEnvironment, type TocVariantIdentity, type WoWClientFamily } from '@wow-addon/addon-metadata';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { GlobalDeclaration, GlobalRegistry, ResolvedAvailability } from '@wow-addon/global-registry';
/**
 * Convert TOC metadata to provider-neutral globals without evaluating conditions.
 * Nonempty condition lists are copied independently per declaration; empty lists
 * omit the optional field. Existing declaration source references stay shared.
 *
 * @beta
 */
export declare function toGlobalDeclarations(addons: readonly AddOnMetadata[]): GlobalDeclaration[];
/**
 * Convenience function; the registry itself never imports metadata or TOC.
 *
 * @beta
 */
export declare function buildTocGlobalRegistry(addons: readonly AddOnMetadata[]): GlobalRegistry;
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
export declare function selectTocVariant(environment: ClientEnvironment, logicalAddonId: string, addonBaseName: string, candidates: readonly TocSelectionCandidate[], policy: TocSelectionPolicy): TocSelectionResult;
/**
 * One reusable caller rule. Provider identity, field, operation and comparison
 * retain the same structure previously inlined in ConditionEvaluationPolicy.
 *
 * @beta
 */
export interface ConditionEvaluationRule {
    readonly providerId: string;
    readonly name: string;
    readonly field: 'gameType' | 'textLocale' | 'gameMode';
    readonly operator: 'include' | 'exclude';
    readonly valueComparison: 'exact' | 'ascii-insensitive';
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
    readonly rules: readonly ConditionEvaluationRule[];
}
/**
 * Fixed explanation with independent source copies. Context-only issues may
 * have no source; malformed source objects are never repaired or fabricated.
 *
 * @beta
 */
export interface ConditionEvaluationIssue {
    readonly code: 'CONDEVAL0001' | 'CONDEVAL0002' | 'CONDEVAL0003' | 'CONDEVAL0004' | 'CONDEVAL0005' | 'CONDEVAL0006';
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
    readonly reason: 'unconditional' | 'conditions-satisfied' | 'condition-mismatch' | 'missing-provenance' | 'unknown' | 'invalid-input';
    readonly issues: readonly ConditionEvaluationIssue[];
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
export declare function evaluateGlobalConditions(declaration: GlobalDeclaration, environment: ClientEnvironment, policy: ConditionEvaluationPolicy): ConditionEvaluationResult;
/**
 * Caller-supplied provider batch associated with one exact candidate variant.
 * Multiple batches for one provider/variant retain order and duplicates.
 *
 * @beta
 */
export interface ProviderDeclarationSet {
    readonly providerId: string;
    readonly tocVariantId: string;
    readonly declarations: readonly GlobalDeclaration[];
}
/**
 * One caller-scoped logical AddOn, its variants and explicit selection policy.
 * Provider sets supplement automatic SavedVariables from the selected metadata.
 *
 * @beta
 */
export interface GlobalResolutionInput extends AddOnIdentity {
    readonly addonBaseName: string;
    readonly candidates: readonly TocSelectionCandidate[];
    readonly selectionPolicy: TocSelectionPolicy;
    readonly providers?: readonly ProviderDeclarationSet[];
}
/**
 * Selected declaration with independent copies and explicit derived evaluation.
 * The copied declaration uses logical identity; originalAddonId stays exact.
 *
 * @beta
 */
export interface ResolvedGlobalDeclaration {
    readonly logicalAddonId: string;
    readonly tocVariantId: string;
    readonly providerId: string;
    readonly originalAddonId: string;
    readonly declaration: GlobalDeclaration;
    readonly evaluation: ConditionEvaluationResult;
}
/**
 * Fixed root/group failure with available canonical copied provenance only.
 * Selection and evaluation keep their existing issue contracts separately.
 *
 * @beta
 */
export interface GlobalResolutionIssue {
    readonly code: 'RESOLVE0001' | 'RESOLVE0002' | 'RESOLVE0003';
    readonly message: string;
    readonly logicalAddonId?: string;
    readonly sources: readonly SourceReference[];
}
/**
 * Derived view distinct from static GlobalRegistry. activeGlobals includes
 * known-true conditional records without rewriting their activation flags.
 * complete concerns consumed projections/availability, not source parse errors.
 * Partial results retain the independently known active subset.
 *
 * @beta
 */
export interface ResolvedGlobalRegistry {
    readonly schemaVersion: 1;
    readonly complete: boolean;
    readonly activeGlobals: readonly string[];
    readonly entries: readonly {
        readonly name: string;
        readonly declarations: readonly ResolvedGlobalDeclaration[];
    }[];
    readonly addons: readonly {
        readonly logicalAddonId: string;
        readonly selection: TocSelectionResult;
    }[];
    readonly diagnostics: readonly Diagnostic[];
    readonly issues: readonly GlobalResolutionIssue[];
}
/**
 * Compose explicit selection and condition evaluation into a derived view.
 * Select first; consume only selected metadata/provider declaration contents.
 * Independent valid groups survive partial failures. Static flags, APIs and
 * inputs remain unchanged. Core performs no filesystem discovery/execution.
 * Consumed projection checks do not prove parse correctness or graph reachability;
 * native object/getter behavior remains caller code.
 *
 * @beta
 */
export declare function resolveGlobalRegistry(environment: ClientEnvironment, addons: readonly GlobalResolutionInput[], conditionPolicy: ConditionEvaluationPolicy): ResolvedGlobalRegistry;
