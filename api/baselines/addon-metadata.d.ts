/**
 * Independent, JSON-serializable contracts. VS Code/LuaLS/Continue are intentionally absent.
 *
 * @beta
 */
export declare const METADATA_SCHEMA_VERSION: 2;
/**
 * @beta
 */
export declare enum WoWClient {
    Unknown = "unknown",
    Retail = "retail",
    ClassicEra = "classic-era",
    BurningCrusadeClassic = "tbc-classic",
    WrathClassic = "wrath-classic",
    CataclysmClassic = "cataclysm-classic",
    MistsClassic = "mists-classic"
}
/**
 * Hardcore and Season of Discovery are game modes, not unique WOW_PROJECT_ID values.
 *
 * @beta
 */
export declare enum WoWGameMode {
    Unknown = "unknown",
    Normal = "normal",
    Hardcore = "hardcore",
    SeasonOfDiscovery = "season-of-discovery"
}
/**
 * @beta
 */
export type WoWClientFamily = 'unknown' | 'classic' | 'mainline';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
/**
 * @beta
 */
export type SavedVariableScope = 'account' | 'character';
/**
 * @beta
 */
export interface InlineCondition {
    /** Original casing is preserved. Interpret the name case-insensitively. */
    name: string;
    values: string[];
    raw: string;
    source: SourceReference;
}
/**
 * @beta
 */
export interface MetadataDirective {
    name: string;
    normalizedName: string;
    value: string;
    rawValue: string;
    source: SourceReference;
    conditions: InlineCondition[];
}
/**
 * @beta
 */
export interface AddOnFileReference {
    path: string;
    source: SourceReference;
    conditions: InlineCondition[];
}
/**
 * @beta
 */
export interface SavedVariableDeclaration {
    name: string;
    scope: SavedVariableScope;
    validIdentifier: boolean;
    source: SourceReference;
    conditions: InlineCondition[];
}
/**
 * @beta
 */
export interface AddOnMetadata {
    schemaVersion: typeof METADATA_SCHEMA_VERSION;
    name: string;
    tocPath: string;
    /** Specific client, if deducible from suffix. Unknown for family-wide TOCs. */
    client: WoWClient;
    clientFamily: WoWClientFamily;
    gameMode: WoWGameMode;
    tocSuffix: string | null;
    /** First interface version retained for compatibility; see interfaceVersions. */
    interface?: string;
    interfaceVersions: string[];
    savedVariables: string[];
    savedVariablesPerCharacter: string[];
    dependencies: string[];
    optionalDependencies: string[];
    files: string[];
    embeddedLibraries: string[];
    /** Plain object for wire/JSON safety; directive spellings are retained. */
    customMetadata: Record<string, string[]>;
    /** Lossless semantic entries, including duplicates/conditions. */
    directives: MetadataDirective[];
    fileEntries: AddOnFileReference[];
    savedVariableDeclarations: SavedVariableDeclaration[];
    sourceReferences: SourceReference[];
}
/**
 * @beta
 */
export interface TocEntry {
    kind: 'blank' | 'comment' | 'directive' | 'file' | 'invalid';
    raw: string;
    source: SourceReference;
    directive?: MetadataDirective;
    fileEntry?: AddOnFileReference;
}
/**
 * @beta
 */
export interface TocParseResult {
    metadata: AddOnMetadata;
    entries: TocEntry[];
    diagnostics: Diagnostic[];
}
/**
 * Version of the separate client-environment input; metadata remains schema 2.
 *
 * @beta
 */
export declare const CLIENT_ENVIRONMENT_SCHEMA_VERSION: 1;
/**
 * Explicit caller-supplied environment. Omitted optional fields mean unknown.
 * Unsupported values never imply activation. A contradictory known client/family
 * must be diagnosed by a selector rather than silently repaired.
 * Readonly fields are a TypeScript contract, not runtime validation or freezing.
 *
 * @beta
 */
export interface ClientEnvironment {
    readonly schemaVersion: typeof CLIENT_ENVIRONMENT_SCHEMA_VERSION;
    readonly client: WoWClient;
    readonly clientFamily: WoWClientFamily;
    readonly gameMode?: WoWGameMode;
    readonly gameType?: string;
    readonly textLocale?: string;
}
/**
 * Caller-owned identity scoped to an installation or workspace. The caller
 * supplies a non-empty opaque ID shared by all variants of one logical AddOn.
 * No path, case or Unicode normalization is implied; validation is caller-owned.
 *
 * @beta
 */
export interface AddOnIdentity {
    readonly logicalAddonId: string;
}
/**
 * Exact source identity, separate from logical identity and active selection.
 * Set tocVariantId to JSON.stringify([logicalAddonId, tocPath]). Preserve the
 * original path, supplied suffix and UTF-16 source reference without normalization.
 * Readonly is shallow: the existing SourceReference shape remains unchanged.
 *
 * @beta
 */
export interface TocVariantIdentity extends AddOnIdentity {
    readonly tocVariantId: string;
    readonly tocPath: string;
    readonly tocSuffix: string | null;
    readonly source: SourceReference;
}
