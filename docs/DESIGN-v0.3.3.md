# v0.3.3 proposal: conservative condition evaluation

**Status: concrete design proposal; semantic decision pending in issue #6.** v0.3.2 is integrated through PR #17 and the authored parser fixtures through PR #18. The current baseline is `df2c2df`, source version 0.3.2, 40 beta exports and 95 tests. This document adds no runtime implementation or metadata-schema change.

## Intended outcome and evidence boundary

Evaluate one supplied declaration against an explicit environment and caller-defined condition policy, returning derived `active | inactive | unknown` availability with reasons and independent source-bearing issues. Select the TOC before invoking this operation; evaluation alone cannot establish that a source belongs to the selected variant. Static registry/declaration records and `listGlobals()` stay unchanged.

The current parser recognizes certain TOC annotation names; v0.3.2 preserves their provider/name/value/raw/source records. Neither observation proves game-loader truth rules, value casing or how the client combines multiple annotations. The staged client probe has no in-game results. Consequently this proposal follows the approved v0.3.1 pattern: an explicit caller-owned policy, with no built-in WoW condition table. The example defines caller semantics; it does not claim client conformance. A later built-in table still needs verified evidence.

## A — Public seam and package boundaries

Add five beta exports, retaining the existing 40:

| Package | Export | Purpose |
| --- | --- | --- |
| global-registry | `ResolvedAvailability` | Type alias `active | inactive | unknown` for derived results; no new field on static entries/declarations |
| toc-metadata-adapter | `ConditionEvaluationPolicy` | Versioned caller-owned comparison rules |
| toc-metadata-adapter | `ConditionEvaluationIssue` | Stable code/message plus zero or more source references |
| toc-metadata-adapter | `ConditionEvaluationResult` | Derived availability, reason and issues |
| toc-metadata-adapter | `evaluateGlobalConditions` | Pure operation accepting declaration, environment and required policy |

The neutral availability union lives in the registry so future providers can reference it without importing the TOC adapter. The evaluator lives in the existing orchestration leaf, which already depends on metadata, diagnostics and registry. Keep all five packages and dependency edges, metadata schema 2 and environment schema 1. Source/workspace versions and internal ranges advance to 0.3.3 during implementation; third-party lock records stay unchanged.

Proposed signature:

```ts
evaluateGlobalConditions(
  declaration: GlobalDeclaration,
  environment: ClientEnvironment,
  policy: ConditionEvaluationPolicy,
): ConditionEvaluationResult
```

The result has readonly `availability`, `reason` and `issues`. Reasons are `unconditional`, `conditions-satisfied`, `condition-mismatch`, `missing-provenance`, `unknown` and `invalid-input`. Issues have readonly `code`, `message` and `sources`. No diagnostic severity or mandatory artificial source is added to the shared Diagnostic contract.

## B — Explicit, serializable comparison policy

Policy schema 1 contains a nonempty opaque `id`, required `nameComparison` (`exact` or `ascii-insensitive`) and a readonly `rules` array. Each rule has exactly these consumed fields:

| Field | Meaning |
| --- | --- |
| `providerId` | Nonempty exact provider ID; always case-sensitive |
| `name` | Nonempty condition name, compared under the policy's nameComparison |
| `field` | One of environment `gameType`, `textLocale` or `gameMode` |
| `operator` | `include` or `exclude` |
| `valueComparison` | `exact` or `ascii-insensitive` |

Rules are data, never functions or executable expressions. ASCII-insensitive comparison folds A–Z only, preserving every original string. No trimming, Unicode normalization, locale registry, client-to-gameType inference or project-ID conversion occurs. Duplicate semantic `(providerId, name)` keys under the chosen name comparison invalidate the policy, even if a declaration would not use them. An empty rule list is a valid explicit policy that supports no conditions. Sparse arrays, missing/unknown rule fields and malformed policy shape are invalid.

For a supported rule and known environment field, `include` is true when any nonempty supplied argument matches that field; `exclude` is true when none matches. Argument duplicates remain representable and do not change membership truth. An empty argument list or empty argument string is unknown; exclusion of an empty list must never become vacuously active. Unknown provider/name pairs remain unknown, regardless of a familiar-looking name from another provider.

An example caller policy can map the TOC adapter's AllowLoadGameType/ExcludeLoadGameType to gameType include/exclude, and AllowLoadTextLocale to textLocale include, while explicitly choosing value casing. That is a caller declaration of meaning. AllowLoad and Bootstrap receive no implicit meaning. Future provider names may be supported only through explicit rules.

## C — Availability, absence and failure rules

1. Validate environment schema/shape and policy before evaluation. Known contradictory client/family fields are invalid; unknown/unsupported client or family remains unknown. Supplied optional environment values must have string shape. No malformed input throws merely because a record is missing or contains an ordinary JSON shape error.
2. Environment gameType and textLocale are opaque strings. An absent or empty required field is unknown. An explicitly required gameMode must be a known non-Unknown enum member; unsupported modes remain unknown. Unused optional strings are not interpreted. Caller comparison does not establish that an opaque value is a recognized game value.
3. Validate the consumed declaration projection: activationState, source reference and any condition list. Source positions must be nonnegative ordered safe integers; content bounds require the caller's original source. This is not a complete validator for symbol names, kinds, scopes or every GlobalDeclaration field.
4. Unconditional with missing/empty descriptors is active only with valid, known context. Unconditional with nonempty descriptors is contradictory and returns unknown/invalid-input. It must not silently discard conditions.
5. Conditional with missing/empty descriptors is unknown/missing-provenance. This includes old serialized declarations. Unknown activationState stays unknown; the descriptor list cannot override unresolved static provenance.
6. Each conditional descriptor must have nonempty provider/name strings, a string raw field, a dense string values array and valid source. Raw is retained provenance and is never reparsed. A structurally malformed descriptor makes the overall result unknown/invalid-input, even if another descriptor could exclude it.
7. For structurally valid conditional records, combine all condition outcomes with explicit conservative AND: false dominates unknown, unknown dominates true. Do not short-circuit away issues for later unsupported conditions. No unknown condition can produce an active result.
8. Return only derived records with independent copies of documented source fields. Input metadata, declarations, policies, environment and source references never change. Repeated and multi-environment evaluation has no shared mutable cache.

Truth table for two condition outcomes (and its repeated fold for larger nonempty lists):

| AND | true | false | unknown |
| --- | --- | --- | --- |
| true | true | false | unknown |
| false | false | false | false |
| unknown | unknown | false | unknown |

This AND is an approved caller-policy operation if the proposal is accepted; it is not inferred game-loader behavior. Structural invalidity and unresolved static activation take precedence over that fold.

## D — Issues and deterministic provenance

| Code | Meaning |
| --- | --- |
| CONDEVAL0001 | Invalid environment or policy shape/schema/rule configuration |
| CONDEVAL0002 | Invalid/contradictory declaration projection or unavailable static provenance |
| CONDEVAL0003 | Unsupported provider/name pair under the explicit policy |
| CONDEVAL0004 | Missing/empty condition arguments |
| CONDEVAL0005 | Unknown environment/client or missing/unsupported required field |
| CONDEVAL0006 | A supported condition excludes the declaration under the explicit policy |

Messages use fixed explanations rather than echoing private values. Environment/policy failures may have no source. Declaration/condition issues retain valid available provenance; invalid source objects are not fabricated into valid ones. Sources sort by exact filename then numeric start/end positions; issues sort deterministically by code/message/canonical sources. Preserve repeated issues instead of erasing duplicate origins. Returned source objects contain only documented fields and never alias inputs.

## E — Acceptance matrix and execution order

| Case or risk | Required observable evidence |
| --- | --- |
| Unconditional / legacy conditional / unknown static activation | Active / unknown / unknown as specified; absence never upgrades a conditional record |
| Explicit include and exclude | Known membership and nonmembership for gameType/textLocale/gameMode; explicit value-casing differences; no inferred defaults |
| Multiple values | OR inside each rule; duplicate values preserved; empty include/exclude arguments unknown |
| Three-state combination | All nine AND cells; true+unsupported unknown; false+unsupported inactive while retaining both issues |
| Provider isolation | Identical condition name from another provider remains unknown unless explicitly mapped |
| Unknown context | Missing/empty fields, unknown modes/clients and contradictory family data never activate |
| Invalid JSON shapes | Null/arrays, sparse lists, duplicate rule keys, invalid source ranges, malformed descriptors and explicit undefined optionals yield derived unknown issues without ordinary shape-error throws |
| Input/result ownership | Frozen input and two environments; mutation of every nested returned source field leaves inputs and other results unchanged; unknown extra source fields are not copied |
| Determinism | Input condition/rule permutations preserve availability and canonical issue ordering; repeated origins stay visible |
| Static compatibility | Existing listGlobals/SV0001/parser/schema/TOC selection tests remain unchanged |
| API and distribution | Positive/negative TS contracts, exactly 45 beta exports, deliberate reviewed baselines/reports, five package boundaries, unchanged third-party lock records, package/license gates |
| Actual corpus | Read-only aggregate checks retain current TOC diagnostic failures and explicit Lua/XML absence; zero nonempty SavedVariable conditions must remain an honest coverage limitation |
| Final delivery | Locked install, focused/integrated tests, strict Extractor, supported Ubuntu/Windows × Node 22/24 final-head and main CI, followed by evidence updates in #6/#7 |

After the decision: author the missing-export/truth-table regressions, implement the narrow pure seam, verify malformed/unknown paths and ownership, deliberately update API/version/migration/diagnostic records, run integrated/local corpus checks, and publish the focused implementation for review and green integration under the user's session authorization. v0.3.4 then composes selection and evaluation into a resolved registry view and proves that non-selected sources cannot contribute globals. Real Lua/XML parsing remains a separate full acceptance requirement in #11.
