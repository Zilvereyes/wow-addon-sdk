import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
/**
 * @beta
 */
/**
 * @beta
 */
export type ActivationState = 'unconditional' | 'conditional' | 'unknown';
/**
 * @beta
 */
/**
 * @beta
 */
export type GlobalKind = 'saved-variable' | 'frame' | 'lua-global';
/**
 * @beta
 */
/**
 * @beta
 */
export type GlobalScope = 'account' | 'character';
/** Provider-neutral global symbol; origin-specific metadata belongs to the adapter, not the registry. */
/**
 * @beta
 */
/**
 * Provider-neutral global symbol; origin-specific metadata belongs to the adapter, not the registry.
 *
 * @beta
 */
export interface GlobalDeclaration {
    name: string;
    addonId: string;
    kind: GlobalKind;
    scope?: GlobalScope;
    activationState: ActivationState;
    source: SourceReference;
}
/**
 * @beta
 */
/**
 * @beta
 */
/**
 * @beta
 */
/**
 * Preserve first-seen order and all provenance; warn on incompatible scopes within one addon.
 *
 * @beta
 */
export interface GlobalRegistryEntry {
    name: string;
    declarations: GlobalDeclaration[];
}
/**
 * @beta
 */
/**
 * Preserve first-seen order and all provenance; warn on incompatible scopes within one addon.
 *
 * @beta
 */
export interface GlobalRegistry {
    entries: GlobalRegistryEntry[];
    diagnostics: Diagnostic[];
}
/**
 * @beta
 */
/**
 * Only unconditionally available symbols are returned unless explicitly requested.
 *
 * @beta
 */
export interface ListGlobalsOptions {
    includeConditional?: boolean;
    includeUnknown?: boolean;
}
/** Preserve first-seen order and all provenance; warn on incompatible scopes within one addon. */
/**
 * @beta
 */
/**
 * @beta
 */
export declare function buildGlobalRegistry(declarations: readonly GlobalDeclaration[]): GlobalRegistry;
/** Only unconditionally available symbols are returned unless explicitly requested. */
/**
 * @beta
 */
/**
 * @beta
 */
export declare function listGlobals(registry: GlobalRegistry, options?: ListGlobalsOptions): string[];
