# Public surface review: frozen core and approved Lua/XML extensions

Core review baseline: v0.3.5 integrated at `0cee5c9`, including the user's named rule. The five core root entry points retain **52 beta declarations**. Approved Lua/profile milestones reached 56, XML syntax reached 65 and XML provider A–D reached 73. Approved v0.7.0 inline Lua A–E adds five, for **78 overall: 16 runtime values/functions and 62 type-only contracts** across the same eight workspaces. The original 30 exports, core ABI and earlier defaults remain; Lua options gain explicit optional context and XML analysis gains a separate mapper. Nothing is promoted to public stability or removed merely to reduce a count.

The source inventory is 16 metadata, five diagnostics, eleven registry, two TOC parser, eighteen adapter, five Lua, nine XML syntax and twelve XML analysis exports, each requiring exactly one `@beta`. Source AST auditing, compiled declaration snapshots and strict API Extractor are the acceptance gates; current-run outcomes are recorded separately. Backend objects and internal syntax-module exports do not become root API. Every root export has one consumer-purpose row below.

## Diagnostics: five shared contracts

| Export | Consumer need / disposition |
| --- | --- |
| `SourcePosition` | Construct and inspect zero-based UTF-16 positions; retain |
| `SourceRange` | Exchange end-exclusive spans across providers; retain |
| `SourceReference` | Attach original files/spans to declarations and issues; retain |
| `DiagnosticSeverity` | Type editor-neutral severity handling; retain |
| `Diagnostic` | Exchange parser/registry diagnostics without editor dependencies; retain |

## AddOn metadata: sixteen contracts and values

| Export | Consumer need / disposition |
| --- | --- |
| `METADATA_SCHEMA_VERSION` | Runtime discriminator for metadata schema 2; retain |
| `WoWClient` | Construct explicit client inputs / inspect parsed suffix classifications; retain |
| `WoWGameMode` | Represent modes separately from client IDs; retain |
| `WoWClientFamily` | Type family-wide applicability and explicit unknown; retain |
| `SavedVariableScope` | Construct/inspect account vs character metadata; retain |
| `InlineCondition` | Inspect exact parser condition provenance; retain |
| `MetadataDirective` | Inspect ordered directive spelling/value/source; retain |
| `AddOnFileReference` | Inspect path/conditions without filesystem resolution; retain |
| `SavedVariableDeclaration` | Inspect name/scope/identifier validity/provenance; retain |
| `AddOnMetadata` | Consume or serialize the parser's metadata projection; retain |
| `TocEntry` | Inspect ordered raw entries and recovery kinds; retain |
| `TocParseResult` | Type parser result and diagnostic handling; retain |
| `CLIENT_ENVIRONMENT_SCHEMA_VERSION` | Runtime discriminator for separate environment schema 1; retain |
| `ClientEnvironment` | Supply explicit client/family/optional knowledge; retain |
| `AddOnIdentity` | Share caller logical identity across variants; retain |
| `TocVariantIdentity` | Associate exact source keys and original provenance; retain |

## Global registry: eleven provider-neutral exports

| Export | Consumer need / disposition |
| --- | --- |
| `ActivationState` | Type declaration-time unconditional/conditional/unknown flags; retain |
| `ResolvedAvailability` | Type derived active/inactive/unknown independently; retain |
| `GlobalKind` | Type saved-variable/frame/Lua declarations; retain, including the optional XML provider's unknown frame candidates |
| `GlobalScope` | Type registry scope independently of TOC metadata; retain |
| `ConditionDescriptor` | Supply opaque condition provenance from any provider; retain |
| `GlobalDeclaration` | Construct provider outputs without parser/metadata dependencies; retain |
| `GlobalRegistryEntry` | Inspect all declarations for one exact name; retain |
| `GlobalRegistry` | Consume static aggregate entries/diagnostics; retain |
| `ListGlobalsOptions` | Explicitly opt into conditional/unknown static names; retain |
| `buildGlobalRegistry` | Aggregate supplied declarations and same-AddOn scope conflicts; retain |
| `listGlobals` | Use the existing static visibility contract; retain |

## TOC parser: two exports

| Export | Consumer need / disposition |
| --- | --- |
| `TocParseOptions` | Supply explicit client/mode overrides to parsing; retain |
| `parseToc` | Parse strings without filesystem or game execution; retain |

## TOC metadata adapter and orchestration: eighteen exports

| Export | Consumer need / disposition |
| --- | --- |
| `toGlobalDeclarations` | Translate SavedVariables with static activation/provenance; retain |
| `buildTocGlobalRegistry` | Existing convenience composition for static callers; retain |
| `TocSelectionPolicy` | Construct explicit versioned priorities/applicability; retain |
| `TocSelectionCandidate` | Associate parsed metadata with exact variant identity; retain |
| `TocSelectionIssue` | Handle selection failures and source arrays; retain |
| `TocSelectionResult` | Handle all five selection outcomes; retain |
| `selectTocVariant` | Select before evaluating declarations; retain |
| `ConditionEvaluationRule` | Reuse/type individual policy rules without indexed-access syntax; add at user request |
| `ConditionEvaluationPolicy` | Construct explicit provider/name/field/comparison semantics; retain |
| `ConditionEvaluationIssue` | Handle fixed evaluation codes and copied sources; retain |
| `ConditionEvaluationResult` | Inspect availability, reason and retained unknown-term issues; retain |
| `evaluateGlobalConditions` | Derive availability without changing static records; retain in approved leaf for now |
| `ProviderDeclarationSet` | Associate external declarations with exact provider/variant; retain |
| `GlobalResolutionInput` | Group one logical AddOn's candidates and providers; retain |
| `ResolvedGlobalDeclaration` | Inspect exact origins, copied static declaration and evaluation; retain |
| `GlobalResolutionIssue` | Handle root/group failures without fabricated source; retain |
| `ResolvedGlobalRegistry` | Consume selected entries, partial completeness and active names; retain |
| `resolveGlobalRegistry` | Compose selection, evaluation and active-only conflict checks; retain |

## Lua extension: five approved exports

| Export | Consumer need / disposition |
| --- | --- |
| `LuaAnalysisOptions` | Supply exact caller identity and optional inherited provider restrictions; add |
| `LuaAnalysisProfile` | Select a fixed bounded/corpus budget explicitly; defaults retain the original profile; add in v0.4.1 |
| `LuaAnalysisContext` | Explicit chunk/function-body parameter and variadic scope without guessed host signatures; add in v0.7.0 |
| `LuaAnalysisResult` | Inspect syntax/projection completeness, independent declaration origins and diagnostics without backend AST; add |
| `analyzeLua` | Parse the explicit Lua 5.1 profile and derive conservative lexical globals without execution; add |

No internal validation, copying, canonicalization or context helpers become root API. No GlobalSymbol rename is needed. The new actual Lua provider composes with TOC metadata in tests using the existing neutral registry/selection contracts, without importing the TOC adapter itself. This does not prove Classic Era grammar conformance, an XML provider or filesystem reachability. See [the approved Lua design](DESIGN-LUA-ANALYSIS.md).

## XML syntax extension: nine approved exports

The user approved XML A–F on 2026-11-17 ([decision](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6947486320)). These exports belong only to the new `@wow-addon/xml-parser` root entry point. They do not widen existing core contracts.

| Export | Consumer need / disposition |
| --- | --- |
| `XmlParseOptions` | Explicit optional namespace constraints, enabled by default; add |
| `XmlName` | Inspect original qualified spelling and owned local/prefix/namespace metadata; add |
| `XmlMappedSpan` | Relate a decoded end-exclusive UTF-16 interval to literal/normalized/entity source provenance; add |
| `XmlValue` | Consume decoded attribute/text values with complete original-source mapping; add |
| `XmlAttribute` | Inspect original name/value/quoted-attribute ranges in source order; add |
| `XmlElement` | Inspect flat preorder elements with parent indices and open/close/original ranges; add |
| `XmlText` | Inspect original-order element text and CDATA with decoded mappings; add |
| `XmlParseResult` | Handle independent schema 1, syntax completeness, flat projections and diagnostics; add |
| `parseXml` | Parse bounded XML 1.0 documents without executing source or fetching references; add |

All eight types expose readonly contracts, with independently owned per-call records and no runtime freeze. `complete` concerns accepted syntax and provenance only. DTDs/XML 1.1 are rejected; every failure empties both element and text projections. Namespaces are checked by default; `{ namespaceAware: false }` is an explicit direct-API grammar choice and makes no game-loader claim. The fixed budgets, decoded-map interpretation and remaining XML provider/reference-graph work are described in [XML migration](MIGRATION-v0.4-to-v0.5.md). Neither saxes/xmlchars objects nor worker controls become public API.

## XML fact extension: eight approved exports

The user approved provider A–D on 2026-11-17. These belong only to `@wow-addon/xml-analysis`; syntax-only consumers retain their existing dependencies/API.

| Export | Consumer need / disposition |
| --- | --- |
| `XmlElementSelector` | Select exact namespace URI/local name pairs |
| `XmlAnalysisPolicy` | Supply disjoint explicit vocabularies and structural roles |
| `XmlAnalysisOptions` | Associate caller identity, policy and inherited conditions |
| `XmlFrameCandidate` | Retain literal, virtual, inherited and unresolved name facts with declaration indices |
| `XmlFileReference` | Inspect unresolved Include/Script targets and exact value maps |
| `XmlInlineScript` | Inspect chunk/handler body text with original disjoint decoded maps |
| `XmlAnalysisResult` | Handle independent schema 1, owned ordered facts, unknown declarations and diagnostics |
| `analyzeXml` | Parse namespace-aware XML and extract bounded policy facts without execution or file traversal |

All seven new interfaces have readonly fields. Imported existing source/declaration types keep their original ABI. Runtime outputs are independently owned. No caller/backend extras or custom array iterators become public projection. complete describes extraction under policy, not loader participation or parsed inline Lua. See [migration and limits](MIGRATION-v0.5-to-v0.6.md).

## XML original-source mapping: four additional approved exports

These bring xml-analysis to twelve root exports without a Lua package import or new edge. Original XML and mapped decoded values are validated; returned occurrence sidecars do not replace existing core source fields.

| Export | Consumer need / disposition |
| --- | --- |
| `XmlMappedSourcePart` | Preserve each ordered literal/entity/normalized contribution or point anchor |
| `XmlSourceMapping` | Retain one query occurrence and all disjoint original parts |
| `XmlSourceMappingResult` | Distinguish batch mapping success from syntax/lexical completeness |
| `mapXmlValueRanges` | Validate and map a bounded batch against original content without parsing or execution |

See [source0.7 migration](MIGRATION-v0.6-to-v0.7.md) for limits, point/CRLF behavior and decoder identity separation. No inherited condition source is remapped.

## Compatibility disposition

Closed literal unions currently describe the accepted values of the installed SDK version. Adding an issue code, reason, result status, client/mode or symbol kind can break exhaustive consumer TypeScript switches. Treat such a change as an API compatibility change requiring reviewed snapshots, changelog and migration guidance, even if existing runtime paths retain their values. Beta status permits reviewed evolution; it does not make these changes invisible or consumer-safe.

Keep current unions in this increment. Widening codes to arbitrary strings would weaken existing validation contracts and negative type tests, and would itself change the approved interface. Version-tolerant consumers should include an explicit fallback that reports unsupported data and treats unrecognized availability conservatively; never infer active from an unfamiliar issue/status. Shared `Diagnostic.code` is already a string and remains unchanged. Decide stable extension guarantees separately before v1.0.

See [the pre-freeze disposition](PRE-FREEZE-REVIEW.md) for evaluator placement, branch protection and outstanding parser evidence.
