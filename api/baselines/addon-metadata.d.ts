/** Independent, JSON-serializable contracts. VS Code/LuaLS/Continue are intentionally absent. */
export declare const METADATA_SCHEMA_VERSION: 2;
export declare enum WoWClient {
    Unknown = "unknown",
    Retail = "retail",
    ClassicEra = "classic-era",
    BurningCrusadeClassic = "tbc-classic",
    WrathClassic = "wrath-classic",
    CataclysmClassic = "cataclysm-classic",
    MistsClassic = "mists-classic"
}
/** Hardcore and Season of Discovery are game modes, not unique WOW_PROJECT_ID values. */
export declare enum WoWGameMode {
    Unknown = "unknown",
    Normal = "normal",
    Hardcore = "hardcore",
    SeasonOfDiscovery = "season-of-discovery"
}
export type WoWClientFamily = 'unknown' | 'classic' | 'mainline';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
export type SavedVariableScope = 'account' | 'character';
export interface InlineCondition {
    /** Original casing is preserved. Interpret the name case-insensitively. */
    name: string;
    values: string[];
    raw: string;
    source: SourceReference;
}
export interface MetadataDirective {
    name: string;
    normalizedName: string;
    value: string;
    rawValue: string;
    source: SourceReference;
    conditions: InlineCondition[];
}
export interface AddOnFileReference {
    path: string;
    source: SourceReference;
    conditions: InlineCondition[];
}
export interface SavedVariableDeclaration {
    name: string;
    scope: SavedVariableScope;
    validIdentifier: boolean;
    source: SourceReference;
    conditions: InlineCondition[];
}
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
export interface TocEntry {
    kind: 'blank' | 'comment' | 'directive' | 'file' | 'invalid';
    raw: string;
    source: SourceReference;
    directive?: MetadataDirective;
    fileEntry?: AddOnFileReference;
}
export interface TocParseResult {
    metadata: AddOnMetadata;
    entries: TocEntry[];
    diagnostics: Diagnostic[];
}
