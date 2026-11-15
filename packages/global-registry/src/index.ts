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
export function buildGlobalRegistry(declarations: readonly GlobalDeclaration[]): GlobalRegistry {
  const entries = new Map<string, GlobalRegistryEntry>();
  const diagnostics: Diagnostic[] = [];
  for (const declaration of declarations) {
    // Registry is independent of the syntax and provenance of providers.
    let entry = entries.get(declaration.name);
    if (!entry) {
      entry = { name: declaration.name, declarations: [] };
      entries.set(declaration.name, entry);
    }
    if (declaration.kind === 'saved-variable') {
      const conflicting = entry.declarations.find(previous =>
        previous.kind === 'saved-variable' && previous.addonId === declaration.addonId &&
        previous.scope !== undefined && declaration.scope !== undefined &&
        previous.scope !== declaration.scope,
      );
      if (conflicting) {
        diagnostics.push({
          code: 'SV0001', severity: 'warning',
          message: `SavedVariable ${declaration.name} uses conflicting scopes in ${declaration.addonId}`,
          source: declaration.source,
          related: [conflicting.source],
        });
      }
    }
    entry.declarations.push(declaration);
  }
  return { entries: [...entries.values()], diagnostics };
}

/** Only unconditionally available symbols are returned unless explicitly requested. */
export function listGlobals(registry: GlobalRegistry, options: ListGlobalsOptions = {}): string[] {
  const permitted = (state: ActivationState): boolean =>
    state === 'unconditional' || (state === 'conditional' && options.includeConditional === true) ||
    (state === 'unknown' && options.includeUnknown === true);
  return registry.entries
    .filter(entry => entry.declarations.some(declaration => permitted(declaration.activationState)))
    .map(entry => entry.name);
}
