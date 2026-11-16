import { WoWClient, WoWGameMode, type TocParseResult } from '@wow-addon/addon-metadata';
/**
 * @beta
 */
export interface TocParseOptions {
    /** Explicit environment selection; never inferred from a Hardcore/SoD TOC suffix. */
    client?: WoWClient;
    gameMode?: WoWGameMode;
}
/**
 * @beta
 */
export declare function parseToc(content: string, tocPath: string, options?: TocParseOptions): TocParseResult;
