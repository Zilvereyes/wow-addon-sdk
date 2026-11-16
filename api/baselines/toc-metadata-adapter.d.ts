import type { AddOnMetadata } from '@wow-addon/addon-metadata';
import type { GlobalDeclaration, GlobalRegistry } from '@wow-addon/global-registry';
/** Convert TOC metadata to provider-neutral globals; do not evaluate conditions here. */
/**
 * @beta
 */
/**
 * Convert TOC metadata to provider-neutral globals; do not evaluate conditions here.
 *
 * @beta
 */
export declare function toGlobalDeclarations(addons: readonly AddOnMetadata[]): GlobalDeclaration[];
/** Convenience function; the registry itself never imports metadata or TOC. */
/**
 * @beta
 */
/**
 * Convenience function; the registry itself never imports metadata or TOC.
 *
 * @beta
 */
export declare function buildTocGlobalRegistry(addons: readonly AddOnMetadata[]): GlobalRegistry;
