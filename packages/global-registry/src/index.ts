import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';

/**
 * @beta
 */
export type ActivationState = 'unconditional' | 'conditional' | 'unknown';
/**
 * Derived availability only; static declarations retain ActivationState.
 *
 * @beta
 */
export type ResolvedAvailability = 'active' | 'inactive' | 'unknown';
/**
 * @beta
 */
export type GlobalKind = 'saved-variable' | 'frame' | 'lua-global';
/**
 * @beta
 */
export type GlobalScope = 'account' | 'character';

/**
 * Opaque condition provenance supplied by an adapter/provider. The registry
 * retains these fields without interpreting grammar, validity or truth.
 * Readonly is shallow; SourceReference retains its existing mutable shape.
 *
 * @beta
 */
export interface ConditionDescriptor {
  readonly providerId: string;
  readonly name: string;
  readonly values: readonly string[];
  readonly raw: string;
  readonly source: SourceReference;
}

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
  /** Missing/empty provenance never overrides activationState or implies truth. */
  readonly conditions?: readonly ConditionDescriptor[];
}

/**
 * @beta
 */
export interface GlobalRegistryEntry {
  name: string;
  declarations: GlobalDeclaration[];
}

/**
 * @beta
 */
export interface GlobalRegistry {
  entries: GlobalRegistryEntry[];
  diagnostics: Diagnostic[];
}

/**
 * @beta
 */
export interface ListGlobalsOptions {
  includeConditional?: boolean;
  includeUnknown?: boolean;
}

/**
 * Preserve first-seen order and all provenance; warn on incompatible scopes within one addon.
 *
 * @beta
 */
export function buildGlobalRegistry(declarations: readonly GlobalDeclaration[]): GlobalRegistry {
  const entries = new Map<string, GlobalRegistryEntry>();
  // Full provenance stays in each entry; conflict detection only needs the first opposite scope.
  const firstSavedVariableScopes = new Map<GlobalRegistryEntry,
    Map<string, Partial<Record<GlobalScope, GlobalDeclaration>>>>();
  const diagnostics: Diagnostic[] = [];
  for (const declaration of declarations) {
    // Registry is independent of the syntax and provenance of providers.
    let entry = entries.get(declaration.name);
    if (!entry) {
      entry = { name: declaration.name, declarations: [] };
      entries.set(declaration.name, entry);
    }
    const scope = declaration.scope;
    if (declaration.kind === 'saved-variable' && scope !== undefined) {
      let byAddon = firstSavedVariableScopes.get(entry);
      if (!byAddon) {
        byAddon = new Map();
        firstSavedVariableScopes.set(entry, byAddon);
      }
      let firstByScope = byAddon.get(declaration.addonId);
      if (!firstByScope) {
        firstByScope = {};
        byAddon.set(declaration.addonId, firstByScope);
      }
      const conflicting = firstByScope[scope === 'account' ? 'character' : 'account'];
      if (conflicting) {
        diagnostics.push({
          code: 'SV0001', severity: 'warning',
          message: `SavedVariable ${declaration.name} uses conflicting scopes in ${declaration.addonId}`,
          source: declaration.source,
          related: [conflicting.source],
        });
      }
      firstByScope[scope] ??= declaration;
    }
    entry.declarations.push(declaration);
  }
  return { entries: [...entries.values()], diagnostics };
}

/**
 * Only unconditionally available symbols are returned unless explicitly requested.
 *
 * @beta
 */
export function listGlobals(registry: GlobalRegistry, options: ListGlobalsOptions = {}): string[] {
  const permitted = (state: ActivationState): boolean =>
    state === 'unconditional' || (state === 'conditional' && options.includeConditional === true) ||
    (state === 'unknown' && options.includeUnknown === true);
  return registry.entries
    .filter(entry => entry.declarations.some(declaration => permitted(declaration.activationState)))
    .map(entry => entry.name);
}
