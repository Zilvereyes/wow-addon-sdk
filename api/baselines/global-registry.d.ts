import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
export type ActivationState = 'unconditional' | 'conditional' | 'unknown';
export type GlobalKind = 'saved-variable' | 'frame' | 'lua-global';
export type GlobalScope = 'account' | 'character';
/** Provider-neutral global symbol; origin-specific metadata belongs to the adapter, not the registry. */
export interface GlobalDeclaration {
    name: string;
    addonId: string;
    kind: GlobalKind;
    scope?: GlobalScope;
    activationState: ActivationState;
    source: SourceReference;
}
export interface GlobalRegistryEntry {
    name: string;
    declarations: GlobalDeclaration[];
}
export interface GlobalRegistry {
    entries: GlobalRegistryEntry[];
    diagnostics: Diagnostic[];
}
export interface ListGlobalsOptions {
    includeConditional?: boolean;
    includeUnknown?: boolean;
}
/** Preserve first-seen order and all provenance; warn on incompatible scopes within one addon. */
export declare function buildGlobalRegistry(declarations: readonly GlobalDeclaration[]): GlobalRegistry;
/** Only unconditionally available symbols are returned unless explicitly requested. */
export declare function listGlobals(registry: GlobalRegistry, options?: ListGlobalsOptions): string[];
