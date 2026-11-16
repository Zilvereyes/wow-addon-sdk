# Public surface review before v0.3.5

Review baseline: integrated v0.3.4 at `e3a477b`, plus the user's requested named rule. The five root entry points expose **52 beta declarations**, including type-only exports; this is not 52 runtime functions. The original 30 exports are retained by requirement. Nothing is promoted to public stability or removed merely to reduce a count.

The source AST audit counts 16 metadata, five diagnostics, eleven registry, two parser and eighteen adapter exports, each with exactly one `@beta`: **12 runtime values/functions and 40 type-only contracts**. Compiled declaration snapshots and strict API Extractor verify the reviewed shape. The named rule is the only new export in this increment; it preserves the former inline rule structure and policy JSON. An exact-name comparison confirms all 30 hardening-baseline exports remain and every current export has exactly one row below.

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
| `GlobalKind` | Type saved-variable/frame/Lua declarations; retain, actual latter providers remain unimplemented |
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

No internal validation, copying, canonicalization or context helpers become public. No `GlobalSymbol` rename or new package is needed for this increment. Synthetic multi-provider tests exercise these exchange contracts, but do not prove a real Lua/XML provider, language dialect or filesystem graph.

## Compatibility disposition

Closed literal unions currently describe the accepted values of the installed SDK version. Adding an issue code, reason, result status, client/mode or symbol kind can break exhaustive consumer TypeScript switches. Treat such a change as an API compatibility change requiring reviewed snapshots, changelog and migration guidance, even if existing runtime paths retain their values. Beta status permits reviewed evolution; it does not make these changes invisible or consumer-safe.

Keep current unions in this increment. Widening codes to arbitrary strings would weaken existing validation contracts and negative type tests, and would itself change the approved interface. Version-tolerant consumers should include an explicit fallback that reports unsupported data and treats unrecognized availability conservatively; never infer active from an unfamiliar issue/status. Shared `Diagnostic.code` is already a string and remains unchanged. Decide stable extension guarantees separately before v1.0.

See [the pre-freeze disposition](PRE-FREEZE-REVIEW.md) for evaluator placement, branch protection and outstanding parser evidence.
