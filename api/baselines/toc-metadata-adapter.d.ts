import { WoWClient, WoWGameMode, type AddOnMetadata, type ClientEnvironment, type TocVariantIdentity, type WoWClientFamily } from '@wow-addon/addon-metadata';
import type { SourceReference } from '@wow-addon/diagnostics';
import type { GlobalDeclaration, GlobalRegistry } from '@wow-addon/global-registry';
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
