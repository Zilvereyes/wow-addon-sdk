# v0.3.4: selection-aware resolved globals

**Status: A–E approved and integrated through PR #20 as `e3a477b`.** The user approved implementation in [issue #6, comment 6919012067](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6919012067). The starting baseline was v0.3.3 / `59f81ee`, with 45 beta exports and 118 tests. This design added six beta exports (51 total at integration), source version 0.3.4 and a separate resolved-result schema 1 while retaining metadata/environment schemas 2/1. All 142 tests and supported final-head/main CI jobs passed; see [#7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7). Later pre-freeze surface review is tracked separately.

## Outcome

For one explicit environment, select each logical AddOn's TOC before evaluating its declarations. Return a derived view with exact variant/provider/source provenance, known active global names, inactive/unknown selected declarations and scope-conflict diagnostics for declarations that are actually known to coexist. Non-selected and unresolved-selection sources contribute zero active globals. Existing static parser/adapter/registry APIs stay unchanged.

The caller supplies selection and condition policies already supported by v0.3.1/v0.3.3. The resolver adds no built-in game rules, filesystem discovery or source execution. Future Lua/XML providers supply records associated with an exact TOC variant; their syntax/reference-graph implementation remains in #11.

## A — Six additive beta exports in the existing adapter leaf

| Export | Contract |
| --- | --- |
| `ProviderDeclarationSet` | Readonly nonempty providerId, exact tocVariantId and declaration array |
| `GlobalResolutionInput` | AddOnIdentity plus readonly addonBaseName, candidates, selectionPolicy and optional providers |
| `ResolvedGlobalDeclaration` | Readonly logicalAddonId, tocVariantId, providerId, originalAddonId, copied GlobalDeclaration and ConditionEvaluationResult |
| `GlobalResolutionIssue` | Fixed code/message, optional logicalAddonId and independent source array |
| `ResolvedGlobalRegistry` | New derived result shape described below |
| `resolveGlobalRegistry` | Pure composition operation |

```ts
resolveGlobalRegistry(
  environment: ClientEnvironment,
  addons: readonly GlobalResolutionInput[],
  conditionPolicy: ConditionEvaluationPolicy,
): ResolvedGlobalRegistry
```

The total becomes 51 beta exports. Keep the five package boundaries, existing imports/dependency directions and all previous exports. Source/workspace versions and internal ranges advance to 0.3.4 only during implementation; third-party lock records and metadata/environment schemas stay unchanged.

The new derived result has readonly:

- `schemaVersion: 1`, independently versioning this new result rather than reusing metadata schema 2;
- `complete: boolean`, meaning source selection and each selected declaration's availability are known without structural input errors;
- `activeGlobals: readonly string[]`, the query result for known active names;
- `entries`, an ordered array of readonly `{ name, declarations: readonly ResolvedGlobalDeclaration[] }` records covering selected active/inactive/unknown declarations;
- `addons`, ordered readonly `{ logicalAddonId, selection: TocSelectionResult }` records for well-formed logical inputs;
- `diagnostics: readonly Diagnostic[]`, scope-conflict diagnostics from known active declarations only;
- `issues: readonly GlobalResolutionIssue[]`, root/group/association errors.

This result is distinct from GlobalRegistry. Resolved declarations retain declaration-time activation flags; `activeGlobals` derives visibility from evaluation, including known-true conditional declarations. Static `listGlobals()` continues using static flags and does not become an environment resolver. Do not rewrite conditional to unconditional just to reuse that query.

## B — Identity, selection and provider association

1. Logical IDs are nonempty opaque caller strings with exact case/Unicode/whitespace. One input groups all variants of that logical AddOn; duplicate logical IDs invalidate all groups sharing that ID. Independent valid groups may still resolve.
2. Use the existing pure selector with the shared environment, input base name, candidates and explicit per-AddOn selection policy. Candidate identities retain the exact JSON.stringify([logicalAddonId, tocPath]) key. No path equivalence, filename repair or family/gameType inference is introduced.
3. Non-selected, no-match, invalid, ambiguous and unresolved source groups contribute no declarations. No-match remains a normal known empty selection. Other unsuccessful selection states make complete false, with their existing TOCSEL issues retained in addons[].selection.
4. Validate provider-set association fields for every set: nonempty provider ID, known exact candidate variant ID and dense declaration array. A missing/unknown association cannot be silently attached to the selected source and invalidates that AddOn's contributions. Repeated provider/variant batches are allowed and preserve declaration order/duplicates.
5. Consume the selected metadata's SavedVariable projection and only the matching provider sets' declaration contents. Non-selected declaration contents are not evaluated or returned. Validate the selected consumed projections before conversion/copying so ordinary malformed JSON shapes cannot throw or leak partially accepted records.
6. The metadata projection requires a dense SavedVariable declaration array with boolean validIdentifier, string name, valid scope/source and typed condition data. Invalid identifiers with otherwise well-formed records retain the old adapter's skip behavior. Unconsumed legacy metadata fields are outside this validator.
7. Automatically map the selected TOC's SavedVariables through the existing adapter, then append matching provider-set declarations. Providers supplement automatic TOC output; records are never silently deduplicated.
8. Derived declaration copies use addonId = logicalAddonId for coexistence checks. Preserve the original static addonId separately as originalAddonId, and preserve exact tocVariantId/providerId/source. Original inputs keep their original identities.

The provider-set ID identifies the supplying provider. Individual condition descriptors may legitimately carry another provider's ID, for example inherited TOC load restrictions on a future Lua/XML declaration. Each condition continues to be evaluated under its own exact provider/name rule. No automatic cross-provider rewriting occurs.

## C — Unknowns, invalidity and partial results

Validate the consumed root environment and condition policy even for an empty AddOn list. Invalid/unknown root context or invalid policy returns complete=false, empty activeGlobals/entries and fixed root issues. A valid empty input returns a complete empty result.

Invalid root array shape never throws. Within a valid array, malformed group identity/base/candidate/provider shape, duplicate logical IDs or invalid consumed selected projections exclude that group's contributions and make complete false. Independent well-formed groups remain available as an explicit partial result. Invalid ID values are represented by issues without a fabricated logical ID.

For a valid selection, evaluate every well-formed selected declaration with the approved condition evaluator. Keep inactive and unknown records in entries for inspection. Only active outcomes contribute to activeGlobals or scope-conflict diagnostics. An unknown whole-declaration availability makes complete false. A valid false-plus-unknown condition combination is known inactive under the approved AND, so it need not make the whole result incomplete; its condition issues remain attached to the evaluation.

The caller can require complete before using a whole-project result, or deliberately inspect the known active subset. An unresolved AddOn or condition never becomes active merely because another independent AddOn resolves successfully. Structural errors in a selected consumed projection invalidate that AddOn before any of its declarations enter the result.

## D — Conflicts, provenance ownership and order

Build scope-conflict diagnostics using only known-active copied declarations with logical IDs, reusing the existing registry's SV0001 rule. Inactive/unknown/non-selected declarations cannot manufacture a coexistence warning. A selected TOC and selected provider record with conflicting SavedVariable scopes under one logical ID do warn when both are active. Scope clashes across unrelated logical AddOns keep the existing rule rather than changing static semantics.

Retain first-seen selected name order in entries and activeGlobals; activeGlobals contains each name once when any declaration in its entry is known active. Preserve caller AddOn order, TOC declaration order, provider batch order and duplicate declaration order. Candidate permutation does not change selection. Canonical issue/source sorting is independent from this intentional first-seen declaration ordering.

Copy documented declaration fields, optional scope/condition presence, descriptor/value arrays and every source/range/position object. All outputs are independent of inputs and other calls; original metadata, static declarations, policies and environment remain unchanged. Existing mutable legacy types are not runtime-frozen. Diagnostics may reference the copied declaration sources within the same result, consistent with registry construction, while never referencing input objects. JSON roundtrip preserves result values.

Use fixed root issue codes/messages without echoing private argument/policy values:

| Code | Meaning |
| --- | --- |
| RESOLVE0001 | Invalid/unknown root context, condition policy or input-list shape |
| RESOLVE0002 | Invalid/duplicate AddOn input or malformed selected metadata projection |
| RESOLVE0003 | Invalid provider association or selected provider declaration projection |

Valid available provenance is copied into issue sources; missing/invalid provenance stays absent. Keep TOCSEL issues under selection results and CONDEVAL issues under declaration evaluations rather than erasing or relabelling their meaning.

## E — Acceptance and implementation order

| Requirement | Required independent evidence |
| --- | --- |
| Variant exclusion | Retail/Era candidates with distinct symbols and same-symbol/different-scope records: zero non-selected entries/active names and no false SV0001 |
| Known-true conditional visibility | activeGlobals includes the symbol while its copied static activationState remains conditional; old static queries remain unchanged |
| Real coexistence warnings | Active selected TOC/provider scope conflict warns; inactive/unknown source and unrelated logical ID cases do not create new warnings |
| Generic providers | Selected Lua/XML-authored record origins and inherited TOC condition IDs survive; unselected provider contents are not evaluated |
| Missing knowledge | Unknown environment/selection/condition and no-match produce the specified partial/empty behavior without activation |
| Invalid shapes/associations | Missing metadata arrays, sparse arrays, invalid selected records, foreign keys and duplicate logical IDs never throw or leak a partly invalid group |
| Empty input | Root context/policy validation still runs; known valid empty input is complete and empty |
| Identity/provenance | Exact paths/Unicode/ranges/originalAddonId and caller logical IDs survive with no normalization or input rewriting |
| Mutation and determinism | Frozen inputs, two environments, repeated calls, candidate permutations, duplicate records, first-seen order and deep output-source isolation |
| Serialization/API | Result schema 1, positive/negative readonly contracts, exactly 51 beta exports, reviewed baselines/reports; metadata/environment schemas unchanged |
| Corpus integration | Separate opt-in composed resolution profile, immediate-folder variant grouping, explicit provider limitation, selected declaration/global/conflict counts and retained TOC failures; no claim of Lua/XML parser coverage |
| Delivery | Locked install, integrated tests, architecture/dependency/export/API/strict Extractor/package gates, supported final-head/main CI and independent review |

Execution order: demonstrate missing-export and cross-variant leakage/conditional visibility gaps; implement group/root validation and pure composition; test generic provider provenance and active-only conflicts; add the bounded opt-in corpus mode; deliberately update API/version/migration/diagnostics and full review evidence; run final-head CI and integrate under the recorded session authorization. v0.3.5 then audits the complete freeze requirements. Actual Lua/XML parsing/provider/reference-graph/corpus acceptance remains required by the overall goal and #11.

The opt-in `--resolution-profile` JSON contains environment, selectionPolicy and conditionPolicy. The bounded runner groups immediate AddOn-folder candidates and invokes the real resolver, retaining all TOCs in the parse inventory. It verifies JSON/input/range invariants and emits aggregate counts only. No provider sources are parsed by this mode. Empty immediate-folder input or an incomplete resolved result fails explicitly. Source parse diagnostics remain a separate failing gate even when the derived availability result is complete.
