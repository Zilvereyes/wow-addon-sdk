import { mapXmlValueRanges, type XmlMappedSourcePart, type XmlSourceMapping, type XmlSourceMappingResult } from '@wow-addon/xml-analysis';
import type { SourceRange, SourceReference, Diagnostic } from '@wow-addon/diagnostics';
import type { XmlValue } from '@wow-addon/xml-parser';
declare const value: XmlValue;
declare const query: SourceRange;
declare const part: XmlMappedSourcePart;
declare const mapping: XmlSourceMapping;
const result: XmlSourceMappingResult = mapXmlValueRanges('<v/>', 'Fixture.xml', value, [query]);
const schema: 1 = result.schemaVersion;
const kind: 'literal' | 'entity' | 'normalized' | 'anchor' = part.kind;
const source: SourceReference = part.source;
const decoded: SourceRange = part.decodedRange;
const diagnostics: readonly Diagnostic[] = result.diagnostics;
// @ts-expect-error result is readonly
result.complete = true;
// @ts-expect-error mapping list is readonly
result.mappings.push(mapping);
// @ts-expect-error mapping fields are readonly
mapping.decodedRange = query;
// @ts-expect-error parts are readonly
mapping.parts.push(part);
// @ts-expect-error part fields are readonly
part.kind = 'literal';
// @ts-expect-error no scalar-only normalization of disjoint parts is exposed
mapping.source;
void [schema, kind, source, decoded, diagnostics];
