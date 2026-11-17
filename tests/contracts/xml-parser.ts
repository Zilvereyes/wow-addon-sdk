import { parseXml, type XmlParseOptions, type XmlName, type XmlMappedSpan, type XmlValue,
  type XmlAttribute, type XmlElement, type XmlText, type XmlParseResult } from '@wow-addon/xml-parser';

const options: XmlParseOptions = { namespaceAware: false };
const defaults: XmlParseOptions = {};
const result: XmlParseResult = parseXml('<r a="value">text</r>', 'Fixture.xml', options);
const version: 1 = result.schemaVersion;
const elements: readonly XmlElement[] = result.elements;
const text: readonly XmlText[] = result.text;
declare const element: XmlElement;
declare const attribute: XmlAttribute;
declare const value: XmlValue;
declare const mapping: XmlMappedSpan;
declare const name: XmlName;
const parent: number | null = element.parentIndex;
const namespace: string | null = name.namespaceUri;
const prefix: string | null = name.prefix;
const kind: 'literal' | 'normalized' | 'entity' = mapping.kind;
const textKind: 'text' | 'cdata' = text[0]!.kind;
const completeAttribute: XmlValue = attribute.value;
const completeText: XmlValue = text[0]!.value;
// @ts-expect-error options are readonly
options.namespaceAware = true;
// @ts-expect-error arbitrary truthy settings are not accepted
const invalidOptions: XmlParseOptions = { namespaceAware: 'yes' };
// @ts-expect-error a boolean is required when the option exists
const undefinedOption: XmlParseOptions = { namespaceAware: undefined };
// @ts-expect-error result properties are readonly
result.complete = true;
// @ts-expect-error returned element arrays are readonly
result.elements.push(element);
// @ts-expect-error returned text arrays are readonly
result.text.push(text[0]!);
// @ts-expect-error element fields are readonly
element.parentIndex = 0;
// @ts-expect-error attribute arrays are readonly
element.attributes.push(attribute);
// @ts-expect-error names have readonly fields
name.qualifiedName = 'changed';
// @ts-expect-error attribute fields are readonly
attribute.value = value;
// @ts-expect-error mapped values are readonly
value.value = 'changed';
// @ts-expect-error mapping arrays are readonly
value.mappings.push(mapping);
// @ts-expect-error mapping coordinates are readonly
mapping.decodedStart = 1;
// @ts-expect-error text fields are readonly
text[0]!.kind = 'cdata';
// @ts-expect-error diagnostics arrays are readonly
result.diagnostics.push(result.diagnostics[0]!);
// @ts-expect-error backend AST objects are not public
result.ast;
// @ts-expect-error execution is not part of this API
result.execute();
void [defaults, version, elements, parent, namespace, prefix, kind, textKind, completeAttribute, completeText, invalidOptions, undefinedOption];
