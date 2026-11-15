import type { AddOnMetadata } from '@wow-addon/addon-metadata';
import type { GlobalDeclaration, GlobalRegistry } from '@wow-addon/global-registry';
/** Convert TOC metadata to provider-neutral globals; do not evaluate conditions here. */
export declare function toGlobalDeclarations(addons: readonly AddOnMetadata[]): GlobalDeclaration[];
/** Convenience function; the registry itself never imports metadata or TOC. */
export declare function buildTocGlobalRegistry(addons: readonly AddOnMetadata[]): GlobalRegistry;
