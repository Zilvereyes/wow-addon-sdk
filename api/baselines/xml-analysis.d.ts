import type { XmlValue } from '@wow-addon/xml-parser';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';
/** Exact expanded-name selector; null denotes no namespace. @beta */
export interface XmlElementSelector {
    readonly namespaceUri: string | null;
    readonly localName: string;
}
/** Explicit, disjoint caller vocabulary; no game schema or default widget list. @beta */
export interface XmlAnalysisPolicy {
    readonly roots: readonly XmlElementSelector[];
    readonly frameElements: readonly XmlElementSelector[];
    readonly includeElements: readonly XmlElementSelector[];
    readonly scriptElements: readonly XmlElementSelector[];
    readonly handlerContainers: readonly XmlElementSelector[];
    readonly handlerElements: readonly XmlElementSelector[];
}
/** Caller-owned inventory identity and inherited restrictions, copied per call. @beta */
export interface XmlAnalysisOptions {
    readonly addonId: string;
    readonly policy: XmlAnalysisPolicy;
    readonly conditions?: readonly ConditionDescriptor[];
}
/** Unresolved frame/template fact; an optional declaration always has unknown activation. @beta */
export interface XmlFrameCandidate {
    readonly elementIndex: number;
    readonly name: XmlValue | null;
    readonly virtual: XmlValue | null;
    readonly inherits: XmlValue | null;
    readonly source: SourceReference;
    readonly declarationIndex: number | null;
}
/** An unresolved source-bearing target. No path resolution or file access occurs. @beta */
export interface XmlFileReference {
    readonly elementIndex: number;
    readonly kind: 'include' | 'script';
    readonly target: XmlValue;
    readonly source: SourceReference;
}
/** Decoded direct-child body, with disjoint original maps; not a Lua parse verdict. @beta */
export interface XmlInlineScript {
    readonly elementIndex: number;
    readonly kind: 'chunk' | 'handler';
    readonly body: XmlValue;
    readonly source: SourceReference;
}
/** Complete means extraction under caller policy, never runtime loading/reachability. @beta */
export interface XmlAnalysisResult {
    readonly schemaVersion: 1;
    readonly complete: boolean;
    readonly frames: readonly XmlFrameCandidate[];
    readonly references: readonly XmlFileReference[];
    readonly scripts: readonly XmlInlineScript[];
    readonly declarations: readonly GlobalDeclaration[];
    readonly diagnostics: readonly Diagnostic[];
}
/**
 * Extract bounded XML facts under an explicit caller policy, without executing
 * source, fetching references or inferring a game schema. Namespace-aware XML
 * syntax budgets remain unchanged. All declarations have unknown activation.
 * Native option getters are caller code; only documented own fields are read.
 * Options: 1 Mi UTF-16 string units, 50,000 selector/condition/value entries,
 * 128 selectors per role, 256 conditions and 1,024 values per condition.
 * Output: 50,000 fact/declaration/condition/value-cell/mapping records total.
 * Input/backend/resource failures expose no partial facts; XUI0004 warnings
 * preserve independent facts with complete=false. Returned nested records are
 * independently owned, not runtime frozen. Inline bodies are not parsed as Lua.
 * Callers own process/heap/deadline supervision; this API is not a JS sandbox.
 * @beta
 */
export declare function analyzeXml(content: string, sourcePath: string, options: XmlAnalysisOptions): XmlAnalysisResult;
