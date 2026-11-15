import { WoWClient, WoWGameMode, type TocParseResult } from '@wow-addon/addon-metadata';
export interface TocParseOptions {
    /** Explicit environment selection; never inferred from a Hardcore/SoD TOC suffix. */
    client?: WoWClient;
    gameMode?: WoWGameMode;
}
export declare function parseToc(content: string, tocPath: string, options?: TocParseOptions): TocParseResult;
