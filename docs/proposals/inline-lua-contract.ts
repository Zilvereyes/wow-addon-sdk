/**
 * PROPOSAL ONLY. These declarations are not exports from the current SDK.
 * Compile this file separately to check the proposed consumer types.
 */
import type { Diagnostic, SourceRange, SourceReference } from '@wow-addon/diagnostics';
import type { LuaAnalysisOptions, LuaAnalysisResult } from '@wow-addon/lua-analysis';
import type { XmlValue } from '@wow-addon/xml-parser';

export type LuaAnalysisContext =
  | { readonly kind: 'chunk' }
  | {
      readonly kind: 'function-body';
      readonly parameters: readonly string[];
      readonly variadic: boolean;
    };

export interface ProposedLuaAnalysisOptions extends LuaAnalysisOptions {
  readonly context?: LuaAnalysisContext;
}

export interface XmlMappedSourcePart {
  readonly decodedRange: SourceRange;
  readonly kind: 'literal' | 'entity' | 'normalized' | 'anchor';
  readonly source: SourceReference;
}
export interface XmlSourceMapping {
  readonly decodedRange: SourceRange;
  readonly parts: readonly XmlMappedSourcePart[];
}
export interface XmlSourceMappingResult {
  readonly schemaVersion: 1;
  readonly complete: boolean;
  readonly mappings: readonly XmlSourceMapping[];
  readonly diagnostics: readonly Diagnostic[];
}

// The implementation proposal adds context? directly to LuaAnalysisOptions.
declare function proposedAnalyzeLua(
  content: string, sourcePath: string, options: ProposedLuaAnalysisOptions
): LuaAnalysisResult;
declare function proposedMapXmlValueRanges(
  content: string, sourcePath: string, value: XmlValue,
  ranges: readonly SourceRange[]
): XmlSourceMappingResult;

// Decoded coordinates and original XML provenance remain distinct.
// The existing GlobalDeclaration/Diagnostic source and inherited condition
// sources are not rewritten or collapsed into a synthetic enclosing interval.
export function proposedConsumer(
  originalXml: string, originalPath: string, body: XmlValue
) {
  const decoded = proposedAnalyzeLua(body.value, 'decoded:authored:0', {
    addonId: 'authored',
    context: { kind: 'function-body', parameters: ['self', 'event'], variadic: true },
  });
  const declarationRanges = decoded.declarations.map(d => d.source.range);
  const diagnosticRanges = decoded.diagnostics.map(d => d.source.range);
  const mapped = proposedMapXmlValueRanges(originalXml, originalPath, body, [
    ...declarationRanges, ...diagnosticRanges,
  ]);
  // Occurrence indices, including duplicates, bind sidecars to decoded output.
  // mapping.complete is independent from decoded.complete.
  return { decoded, mapped, declarationCount: declarationRanges.length };
}

// @ts-expect-error Function bodies require explicit variadic permission.
const missingPermission: LuaAnalysisContext = { kind: 'function-body', parameters: [] };
// @ts-expect-error Function bodies require explicit parameter declarations.
const missingParameters: LuaAnalysisContext = { kind: 'function-body', variadic: true };
// @ts-expect-error Chunk has no configurable parameter scope.
const chunkParameters: LuaAnalysisContext = { kind: 'chunk', parameters: ['self'] };
void [missingPermission, missingParameters, chunkParameters];
