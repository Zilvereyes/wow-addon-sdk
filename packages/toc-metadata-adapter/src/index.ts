import type { AddOnMetadata } from '@wow-addon/addon-metadata';
import type { GlobalDeclaration, GlobalRegistry } from '@wow-addon/global-registry';
import { buildGlobalRegistry } from '@wow-addon/global-registry';

/** Convert TOC metadata to provider-neutral globals; do not evaluate conditions here. */
/**
 * @beta
 */
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

/** Convenience function; the registry itself never imports metadata or TOC. */
/**
 * @beta
 */
/**
 * Convenience function; the registry itself never imports metadata or TOC.
 *
 * @beta
 */
export function buildTocGlobalRegistry(addons: readonly AddOnMetadata[]): GlobalRegistry {
  return buildGlobalRegistry(toGlobalDeclarations(addons));
}
