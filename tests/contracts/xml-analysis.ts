import { analyzeXml, type XmlElementSelector, type XmlAnalysisPolicy, type XmlAnalysisOptions,
  type XmlFrameCandidate, type XmlFileReference, type XmlInlineScript, type XmlAnalysisResult } from '@wow-addon/xml-analysis';
import type { SourceReference, Diagnostic } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';
import type { XmlValue } from '@wow-addon/xml-parser';

declare const selector: XmlElementSelector;
declare const policy: XmlAnalysisPolicy;
declare const options: XmlAnalysisOptions;
declare const frame: XmlFrameCandidate;
declare const reference: XmlFileReference;
declare const script: XmlInlineScript;
declare const condition: ConditionDescriptor;
const result: XmlAnalysisResult = analyzeXml('<Ui/>', 'Fixture.xml', options);
const schema: 1 = result.schemaVersion;
const namespace: string | null = selector.namespaceUri;
const frameName: XmlValue | null = frame.name;
const virtual: XmlValue | null = frame.virtual;
const inherits: XmlValue | null = frame.inherits;
const declaration: number | null = frame.declarationIndex;
const source: SourceReference = frame.source;
const target: XmlValue = reference.target;
const referenceKind: 'include' | 'script' = reference.kind;
const scriptKind: 'chunk' | 'handler' = script.kind;
const body: XmlValue = script.body;
const globals: readonly GlobalDeclaration[] = result.declarations;
const diagnostics: readonly Diagnostic[] = result.diagnostics;
const inherited: readonly ConditionDescriptor[] | undefined = options.conditions;
// @ts-expect-error selector fields are readonly
selector.localName = 'Other';
// @ts-expect-error policy lists are readonly
policy.roots.push(selector);
// @ts-expect-error policy fields are readonly
policy.roots = [];
// @ts-expect-error options are readonly
options.addonId = 'Other';
// @ts-expect-error inherited conditions are readonly
options.conditions?.push(condition);
// @ts-expect-error explicit undefined is not an omitted condition list
const badOptional: XmlAnalysisOptions = { addonId: 'a', policy, conditions: undefined };
// @ts-expect-error namespace awareness is fixed, not an available provider option
const namespaceOff: XmlAnalysisOptions = { addonId: 'a', policy, namespaceAware: false };
// @ts-expect-error result fields are readonly
result.complete = true;
// @ts-expect-error result arrays are readonly
result.frames.push(frame);
// @ts-expect-error candidate fields are readonly
frame.declarationIndex = 0;
// @ts-expect-error reference fields are readonly
reference.target = body;
// @ts-expect-error script fields are readonly
script.kind = 'chunk';
// @ts-expect-error file reference kind has only the approved values
const badKind: XmlFileReference = { ...reference, kind: 'handler' };
// @ts-expect-error no backend or loader AST is public
result.ast;
// @ts-expect-error provider facts are not executable
result.execute();
void [schema, namespace, frameName, virtual, inherits, declaration, source, target, referenceKind,
  scriptKind, body, globals, diagnostics, inherited, badOptional, namespaceOff, badKind];
