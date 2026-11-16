import type { Diagnostic } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';
/**
 * Fixed parser budgets. Corpus callers own stack/heap/deadline supervision.
 *
 * @beta
 */
export type LuaAnalysisProfile = 'bounded' | 'corpus';
/**
 * Caller-owned source association and optional inherited restrictions.
 * This package never discovers files or infers TOC reachability. Conditions
 * are copied without interpreting their grammar or truth.
 *
 * @beta
 */
export interface LuaAnalysisOptions {
    readonly addonId: string;
    readonly conditions?: readonly ConditionDescriptor[];
    readonly profile?: LuaAnalysisProfile;
    readonly allowShebang?: boolean;
}
/**
 * Lua 5.1 syntax plus a conservative lexical declaration projection.
 * Complete does not prove runtime execution, values, every possible global
 * mutation or reachability. No backend AST is exposed. Returned trees are
 * independent of inputs and other calls; readonly is not runtime freezing.
 *
 * @beta
 */
export interface LuaAnalysisResult {
    readonly schemaVersion: 1;
    readonly complete: boolean;
    readonly declarations: readonly GlobalDeclaration[];
    readonly diagnostics: readonly Diagnostic[];
}
/**
 * Analyze original text without executing it. The explicit profile is Lua 5.1,
 * ASCII identifiers, uninterpreted string values and one optional leading BOM.
 * Preserve original UTF-16 offsets/endings. Bound input to 1 Mi code units,
 * nodes to 50,000 and accepted AST depth to 256 by default. Explicit corpus
 * profile allows 32 Mi units, 4,000,000 nodes and depth 1,024; these are not a
 * CPU/memory sandbox. Callers own process/stack/heap/deadline supervision.
 * Hashbang preprocessing requires allowShebang:true; defaults stay strict.
 * Direct chunk bindings retain static unconditional/inherited-conditional
 * flags; other flow/function assignments remain unknown. Dynamic environment
 * access makes the projection incomplete and all returned bindings unknown.
 * Invalid syntax/resource/input yields no declarations. Native getters remain
 * caller code; only documented input projections are validated/copied.
 *
 * @beta
 */
export declare function analyzeLua(content: string, sourcePath: string, options: LuaAnalysisOptions): LuaAnalysisResult;
