/**
 * PROPOSAL ONLY: locally declared tooling types, not SDK exports or working graph code.
 * Compile independently; existing SDK types are imported, never redeclared here.
 */
import type { ClientEnvironment, TocParseResult } from '@wow-addon/addon-metadata';
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration, ResolvedAvailability } from '@wow-addon/global-registry';
import type { LuaAnalysisContext, LuaAnalysisResult, LuaAnalysisProfile } from '@wow-addon/lua-analysis';
import type { TocSelectionPolicy, TocSelectionResult, ConditionEvaluationPolicy, ConditionEvaluationResult, ResolvedGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import type { XmlAnalysisPolicy, XmlAnalysisResult, XmlSourceMappingResult } from '@wow-addon/xml-analysis';
import type { XmlParseResult } from '@wow-addon/xml-parser';

export interface SelectedSourceGraphProfile {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly pathPolicy: {
    readonly separators: 'slash-and-backslash';
    readonly caseComparison: 'exact' | 'ascii-insensitive-unique';
    readonly containment: 'addons-root';
    readonly links: 'reject';
    readonly variables: {
      readonly kind: 'explicit-tokens';
      readonly tokens: readonly { readonly token: string; readonly replacement: string }[];
    };
  };
  readonly addons: readonly {
    readonly logicalAddonId: string;
    readonly directory: string;
    readonly addonBaseName: string;
    readonly tocPaths: readonly string[];
  }[];
  readonly limits?: Readonly<Partial<{
    sourceNodes: number; analysisRecords: number; referenceOccurrences: number; occurrences: number;
    graphDepth: number; directoryDepth: number; directoryEntries: number; readBytes: number;
    textCacheBytes: number; retainedRecords: number; retainedStringUnits: number; pathUnits: number;
    operationMilliseconds: number;
  }>>;
}
export interface SelectedSourceGraphRequest {
  readonly profile: SelectedSourceGraphProfile;
  readonly environment: ClientEnvironment;
  readonly selectionPolicy: TocSelectionPolicy;
  readonly conditionPolicy: ConditionEvaluationPolicy;
  readonly xmlPolicy: XmlAnalysisPolicy;
  readonly inlineProfile: {
    readonly schemaVersion: 1;
    readonly chunkContext: { readonly kind: 'chunk' };
    readonly handlers: readonly {
      readonly element: { readonly namespaceUri: string | null; readonly localName: string };
      readonly context: Extract<LuaAnalysisContext, { kind: 'function-body' }>;
    }[];
  };
  readonly luaInputProfile: 'bounded' | 'corpus-files';
}
export type SourceLanguage = 'toc' | 'lua' | 'xml';
export type GraphApiName = 'parseToc' | 'parseXml' | 'analyzeLua' | 'analyzeXml' | 'mapXmlValueRanges';
export type ConfirmedGraphApiCalls = Readonly<Record<GraphApiName, {
  readonly invoked: number; readonly returned: number;
}>>;
export type GraphAnalysis =
  | { readonly language: 'toc'; readonly parsed: TocParseResult }
  | { readonly language: 'lua'; readonly result: LuaAnalysisResult }
  | { readonly language: 'xml'; readonly syntax: XmlParseResult; readonly provider: XmlAnalysisResult | null;
      readonly inline: readonly {
        readonly elementIndex: number; readonly kind: 'chunk' | 'handler';
        readonly status: 'analyzed' | 'missing-context';
        readonly analysis: LuaAnalysisResult | null; readonly mapping: XmlSourceMappingResult | null;
      }[] };

/** Trusted internal port; JSON/profile/corpus text cannot supply methods or executables. */
export interface ReadOnlyGraphHost {
  listDirectory(sourceDirectory: string): Promise<{
    readonly fingerprint: string;
    readonly entries: readonly {
      readonly name: string; readonly kind: 'file' | 'directory' | 'link' | 'unsupported';
      readonly reparsePoint: boolean;
    }[];
  }>;
  verifyDirectory(sourceDirectory: string, fingerprint: string): Promise<boolean>;
  readSource(sourcePath: string, maximumBytes: number): Promise<{
    readonly bytes: Uint8Array; readonly fingerprint: string;
  }>;
  verifySource(sourcePath: string, fingerprint: string, maximumBytes: number): Promise<boolean>;
  analyze(request: {
    readonly language: SourceLanguage; readonly content: string; readonly sourcePath: string;
    readonly addonId: string; readonly conditions: readonly ConditionDescriptor[];
    readonly luaProfile: LuaAnalysisProfile; readonly allowShebang: boolean; readonly xmlPolicy: XmlAnalysisPolicy;
    readonly inlineProfile: SelectedSourceGraphRequest['inlineProfile'];
  }): Promise<{ readonly result: GraphAnalysis; readonly confirmedApiCalls: ConfirmedGraphApiCalls }>;
  nowMilliseconds(): number;
  close(): Promise<void>;
}

export type GraphIssueCode = 'SGRAPH0001' | 'SGRAPH0002' | 'SGRAPH0003' | 'SGRAPH0004' |
  'SGRAPH0005' | 'SGRAPH0006' | 'SGRAPH0007' | 'SGRAPH0008';
export interface GraphLanguageAggregate {
  readonly eligibleSourceFiles: number;
  /** Metadata-discovered files outside the requested candidate/reachable set; no parser credit. */
  readonly notRequestedSourceFiles: number;
  readonly uniqueFilesRead: number;
  readonly syntaxVerdictFiles: number;
  readonly syntaxAcceptedFiles: number;
  readonly syntaxRejectedFiles: number;
  /** Disjoint unique eligible files without a validated syntax verdict, not request/event totals. */
  readonly skippedBeforeSyntaxVerdict: {
    readonly notAttempted: number;
    readonly readRejected: number;
    readonly encodingRejected: number;
    readonly resourceRejected: number;
    readonly workerRejected: number;
    readonly backendRejected: number;
    readonly invariantRejected: number;
  };
  readonly sourceRequestsSubmitted: number;
  readonly sourceRequestsCompleted: number;
  readonly sourceRequestsFailed: number;
  readonly failedRequestsWithUnknownStages: number;
  readonly reusedAnalyses: number;
  readonly readFailures: number;
  readonly workerFailures: number;
  readonly backendFailures: number;
  readonly invariantFailures: number;
  readonly resourceRejected: number;
  readonly encodingRejected: number;
  readonly analysisDiagnosticsByCode: Readonly<Record<string, number>>;
  readonly occurrenceDiagnosticsByCode: Readonly<Record<string, number>>;
  readonly sourceIntegrity: {
    readonly checked: number; readonly matching: number; readonly changed: number; readonly verificationFailures: number;
  };
}
/** Allowlisted CLI projection only; no source paths/names/text or per-source fingerprints. */
export interface SelectedSourceGraphAggregate {
  readonly schemaVersion: 1;
  readonly status: 'passed' | 'failed' | 'incomplete';
  readonly completeUnderPolicy: boolean;
  readonly fullParsing: false;
  readonly clientConformance: false;
  readonly discovery: {
    readonly complete: boolean; readonly entriesVisited: number;
    readonly found: Readonly<Record<SourceLanguage, number>>;
    readonly rejectedLinks: number; readonly unrepresentableEntries: number;
    /** Directories named `.git`, `.svn` or `.hg` (ASCII case-insensitive) that broad discovery did not list. */
    readonly excludedVcsDirectories: number;
  };
  readonly selection: {
    readonly requestedGroups: number; readonly selected: number; readonly noMatch: number;
    readonly unresolved: number; readonly ambiguous: number; readonly invalid: number; readonly notInvoked: number;
    /** Candidate rows, including repeated physical TOCs associated with separate logical groups. */
    readonly explicitCandidateRows: number; readonly selectedCandidateRows: number;
    readonly nonSelectedCandidateRows: number; readonly undecidedCandidateRows: number;
  };
  readonly languages: Readonly<Record<SourceLanguage, GraphLanguageAggregate>>;
  readonly confirmedApiCalls: ConfirmedGraphApiCalls;
  readonly graph: {
    readonly sourceNodes: number; readonly analysisRecords: number; readonly occurrences: number;
    readonly referenceOccurrences: number; readonly resolvedReferences: number; readonly inactiveReferences: number;
    readonly blockedReferences: number; readonly unsupportedReferences: number; readonly missingReferences: number;
    readonly ambiguousReferences: number; readonly cyclicReferences: number;
    readonly activeGuards: number; readonly inactiveGuards: number; readonly unknownGuards: number;
    readonly expandedTokenReferences: number; readonly unsupportedVariables: number;
    readonly guardIssuesByCode: Readonly<Partial<Record<ConditionEvaluationResult['issues'][number]['code'], number>>>;
  };
  readonly inlineLua: {
    readonly discoveredBodies: number; readonly attemptedBodies: number; readonly skippedMissingContext: number;
    readonly syntaxAccepted: number; readonly syntaxRejected: number; readonly resourceBlocked: number;
    readonly backendBlocked: number; readonly lexicalComplete: number; readonly lexicalIncomplete: number;
    readonly mappingValidated: number; readonly originalParts: number;
    readonly diagnosticsByCode: Readonly<Record<string, number>>;
  };
  readonly resolution: {
    readonly eligibleGroups: number; readonly blockedGroups: number; readonly coreComplete: boolean;
    readonly complete: boolean; readonly declarations: number; readonly activeGlobals: number;
    readonly availability: Readonly<Record<ResolvedAvailability, number>>;
    readonly issuesByCode: Readonly<Record<string, number>>;
  };
  readonly issuesByCode: Readonly<Partial<Record<GraphIssueCode, number>>>;
}
export interface SelectedSourceGraphResult {
  readonly schemaVersion: 1;
  readonly completeUnderPolicy: boolean;
  readonly groups: readonly {
    readonly logicalAddonId: string; readonly selection: TocSelectionResult | null;
    readonly graphComplete: boolean; readonly analysisComplete: boolean; readonly resolutionEligible: boolean;
  }[];
  readonly nodes: readonly { readonly sourcePath: string; readonly language: SourceLanguage }[];
  readonly analyses: readonly {
    readonly analysisId: number; readonly sourcePath: string; readonly result: GraphAnalysis;
    readonly confirmedApiCalls: ConfirmedGraphApiCalls;
  }[];
  /** One owned original SDK evaluation per reference, including inactive and declaration-free targets. */
  readonly guardEvaluations: readonly {
    readonly referenceId: number; readonly evaluation: ConditionEvaluationResult;
  }[];
  readonly references: readonly {
    readonly referenceId: number; readonly parentOccurrenceId: number; readonly source: SourceReference;
    readonly constructSource: SourceReference; readonly analysisId: number;
    readonly tocFileEntryIndex: number | null; readonly providerReferenceIndex: number | null;
    readonly rawTarget: string; readonly targetValue: string; readonly expandedTarget: string | null;
    readonly guard: ResolvedAvailability;
    readonly status: 'inactive' | 'resolved' | 'blocked' | 'unsupported' | 'missing' | 'ambiguous' | 'cycle';
    readonly targetSourcePath: string | null; readonly cycleAncestorOccurrenceId: number | null;
  }[];
  readonly occurrences: readonly {
    readonly occurrenceId: number; readonly parentOccurrenceId: number | null;
    readonly referenceId: number | null; readonly tocVariantId: string; readonly logicalAddonId: string;
    readonly sourcePath: string; readonly kind: 'file' | 'inline-chunk' | 'inline-handler';
    readonly analysisId: number | null; readonly inlineElementIndex: number | null;
    readonly reuse: 'invoked' | 'reused' | 'not-analyzed';
    readonly conditions: readonly ConditionDescriptor[]; readonly guard: ResolvedAvailability;
  }[];
  readonly declarationOrigins: readonly ({
    readonly occurrenceId: number; readonly declaration: GlobalDeclaration;
    readonly resolvedEntryIndex: number | null; readonly resolvedDeclarationIndex: number | null;
    readonly mapping: XmlSourceMappingResult | null;
  } & (
    | { readonly origin: 'selected-toc'; readonly tocDeclarationIndex: number;
        readonly providerBatchIndex: null; readonly providerDeclarationIndex: null }
    | { readonly origin: 'provider'; readonly tocDeclarationIndex: null;
        readonly providerBatchIndex: number; readonly providerDeclarationIndex: number }
  ))[];
  readonly diagnostics: readonly Diagnostic[];
  readonly issues: readonly {
    readonly code: GraphIssueCode; readonly logicalAddonId?: string;
    readonly occurrenceId?: number; readonly sources: readonly SourceReference[];
  }[];
  readonly resolved: ResolvedGlobalRegistry;
  readonly aggregate: SelectedSourceGraphAggregate;
}

export declare function analyzeSelectedSources(
  request: SelectedSourceGraphRequest, host: ReadOnlyGraphHost,
): Promise<SelectedSourceGraphResult>;

declare const profile: SelectedSourceGraphProfile;
// @ts-expect-error Existing caller-owned arrays must not become mutable.
profile.addons.push({ logicalAddonId: 'x', directory: 'X', addonBaseName: 'X', tocPaths: [] });
// @ts-expect-error Containment policy cannot authorize arbitrary outside-root reads.
const outside: SelectedSourceGraphProfile['pathPolicy']['containment'] = 'unrestricted';
// @ts-expect-error A handler requires explicit parameters and variadic permission.
const incomplete: SelectedSourceGraphRequest['inlineProfile']['handlers'][number]['context'] = { kind: 'function-body' };
void outside; void incomplete;
declare const result: SelectedSourceGraphResult;
// @ts-expect-error Missing candidate data must not fabricate a completed selection.
const fabricatedSelection: TocSelectionResult = result.groups[0]!.selection;
void fabricatedSelection;

declare const parserDiagnostic: Diagnostic;
// @ts-expect-error A parser Diagnostic cannot replace original guard issues with their sources[] shape.
const lostGuardProvenance: ConditionEvaluationResult['issues'][number] = parserDiagnostic;
void lostGuardProvenance;
