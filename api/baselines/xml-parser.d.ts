import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
/** XML 1.0 document options. Namespace constraints are enabled by default. @beta */
export interface XmlParseOptions {
    readonly namespaceAware?: boolean;
}
/** An owned expanded name; namespace processing never changes original spelling. @beta */
export interface XmlName {
    readonly qualifiedName: string;
    readonly localName: string;
    readonly prefix: string | null;
    readonly namespaceUri: string | null;
}
/** Original provenance of a decoded UTF-16 interval, end exclusive. @beta */
export interface XmlMappedSpan {
    readonly decodedStart: number;
    readonly decodedEnd: number;
    readonly kind: 'literal' | 'normalized' | 'entity';
    readonly source: SourceReference;
}
/** Literal runs map by offset; overlapping entity/normalized spans map whole. @beta */
export interface XmlValue {
    readonly value: string;
    readonly source: SourceReference;
    readonly mappings: readonly XmlMappedSpan[];
}
/** Attribute ranges include spelling and quotes; value ranges exclude quotes. @beta */
export interface XmlAttribute {
    readonly name: XmlName;
    readonly nameSource: SourceReference;
    readonly value: XmlValue;
    readonly source: SourceReference;
}
/** Preorder element projection. Self-closing elements have no closeSource. @beta */
export interface XmlElement {
    readonly name: XmlName;
    readonly nameSource: SourceReference;
    readonly source: SourceReference;
    readonly openSource: SourceReference;
    readonly closeSource: SourceReference | null;
    readonly parentIndex: number | null;
    readonly attributes: readonly XmlAttribute[];
}
/** Original-order text inside an element; CDATA sources exclude delimiters. @beta */
export interface XmlText {
    readonly parentIndex: number;
    readonly kind: 'text' | 'cdata';
    readonly value: XmlValue;
}
/** Complete describes syntax and provenance only, not schema or game loading. @beta */
export interface XmlParseResult {
    readonly schemaVersion: 1;
    readonly complete: boolean;
    readonly elements: readonly XmlElement[];
    readonly text: readonly XmlText[];
    readonly diagnostics: readonly Diagnostic[];
}
/**
 * Parse an XML 1.0 fifth-edition document, optionally enforcing Namespaces 1.0.
 * Reject DTDs and XML 1.1; never execute source or resolve external entities.
 * Input is bounded to 1 Mi UTF-16 units before indexing, 50,000 combined
 * element/attribute/text/mapping records, depth 256 and 2 Mi decoded units.
 * Every failure returns empty projections and fixed diagnostics. Native getters
 * are caller code; only the documented option is consumed, once. Returned
 * records are owned per call (readonly types do not imply runtime freezing).
 * Callers own heap/deadline supervision; this pure API is not a JS sandbox.
 * @beta
 */
export declare function parseXml(content: string, sourcePath: string, options?: XmlParseOptions): XmlParseResult;
