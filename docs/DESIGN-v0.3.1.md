# v0.3.1: explicit-policy TOC selection

**Approved:** the user accepted the concrete five-export proposal from [issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6916570730); approval is recorded in [comment 6916678035](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6916678035). A built-in WoW-loader policy remains a separate verified-data task. This design implements the approved pure selection seam, not automatic game behavior.

## Public seam and package boundary

Five additive beta exports live in `@wow-addon/toc-metadata-adapter`: `TocSelectionPolicy`, `TocSelectionCandidate`, `TocSelectionIssue`, `TocSelectionResult` and `selectTocVariant`. The total reviewed surface becomes 39 exports. No package, dependency edge or metadata schema is added; the adapter can already depend on metadata and diagnostics. The old static adapter/registry functions retain their behavior.

```ts
selectTocVariant(environment, logicalAddonId, addonBaseName, candidates, policy)
```

The policy has schema 1, non-empty opaque ID, known client/family and an ordered nonempty `suffixPrecedence` list. Optional `gameType` and `gameMode` constrain applicability exactly. The caller owns policy meaning, environment gathering and variant grouping; no filesystem discovery or game-type/project-ID inference occurs here.

## Observable outcomes

| Status | Meaning | Selected ID |
| --- | --- | --- |
| `selected` | Exactly one candidate at the first available explicit priority | Present |
| `no-match` | Valid records/policy, no eligible matching filename/priority | Absent |
| `unresolved` | Unknown client/family or policy applicability cannot be established | Absent |
| `ambiguous` | More than one source candidate at the best available priority | Absent |
| `invalid` | Malformed/contradictory input, duplicate identity or invalid candidate projection/source | Absent |

Issues use `TOCSEL0001` invalid environment/policy/logical input, `TOCSEL0002` invalid/duplicate candidate, `TOCSEL0003` ambiguous best priority and `TOCSEL0004` unresolved applicability. Each has a message and source array. Environment-only issues can have no source; the existing shared `Diagnostic.source` remains mandatory. Issue and source ordering is canonical and independent of candidate input order.

## Validation and matching rules

1. Environment schema is 1. Specific client and family must be known and consistent before selection. Unknown/unsupported client values or unknown family yield unresolved; contradictory known client/family yields invalid. The selector does not repair either.
2. Policy schema is 1; its ID, client, family, priorities and any supplied constraints must be valid. Unknown required policy client/mode is invalid. A valid policy for another environment is unresolved. A required game type/mode must be supplied and exactly match. Supplied optional environment fields must have string shape; null, numbers, objects and explicit undefined are malformed. Unused optional strings are not interpreted, enum-normalized or defaulted.
3. `gameType` is an opaque exact caller constraint, not an SDK game-type registry. A caller-defined future value can match an explicitly supplied policy, but the SDK makes no claim that the game recognizes it. Game modes use the existing known enum. No mode/client compatibility table is invented.
4. Suffix tokens start with an ASCII letter and contain only ASCII letters, digits, underscore or hyphen. Null represents an exact unsuffixed filename. Duplicate case-equivalent suffixes or repeated null are invalid. Sparse arrays and undefined cells are invalid. Supplied priority order is honored, including explicit placement of null.
5. Logical IDs remain opaque non-empty strings, including significant whitespace. The base name is a non-empty leaf name without slash, backslash, colon, control characters or dot/dot-dot path segments. Paths and Unicode remain exact.
6. Every candidate must carry the supplied logical ID and `JSON.stringify([logicalAddonId, tocPath])` variant key. Metadata schema is 2, metadata/identity paths match exactly, and suffix classifications agree under case-insensitive suffix comparison. Candidate source file is non-empty and positions are ordered nonnegative safe integers. These checks validate the selection projection; they do not validate every legacy metadata field or source-content bounds.
7. Extract only the final filename component, accepting either slash convention without normalizing stored paths. The extension comparison is case-insensitive; the base name comparison is exact, including case and Unicode. Suffix comparison is case-insensitive. No filesystem equivalence is inferred.
8. A null suffix can match fallback only when the stem equals the supplied base name. In particular, parser null on `Addon_Future.toc` does not make it `Addon.toc`. An unfamiliar suffix can be selected only when a caller/provider explicitly supplies coherent classification and an explicit policy includes it.
9. Duplicate exact variant IDs invalidate the entire selection. Invalid records are not discarded to make another candidate win. Distinct equal-priority sources are ambiguous, even if their physical paths might alias. Return no filesystem-order winner.
10. Return only the derived ID/issues. The function never modifies metadata, environment, policy, identities or source references. Returned issue references are independent canonical copies containing only documented source fields. Existing readonly types remain shallow and do not imply runtime freezing or isolation from caller-defined getters.

## Acceptance and remaining work

Positive/negative type fixtures enforce the five exports, literal schema and readonly/optional contracts. Behavioral tests cover all permutations of concrete/family/fallback inputs, caller priority changes, unknown future filenames, explicit future classification, path/Unicode/case behavior, best-priority ties, duplicate IDs, malformed policy/candidate/source data, sparse arrays, exact optional constraints, immutable multi-environment reuse and output-source independence.

Update the adapter declaration baseline/API report, package source version 0.3.1, diagnostic catalog and migration record intentionally. Run integrated gates and supported Windows/Ubuntu × Node 22/24 CI on a final SHA. The [client probe](TOC-SELECTION-CLIENT-PROBE.md) prepares independently observable future loader data but has not been installed or run in-game.

The optional corpus profile exercises this seam against actual parsed records without changing game policy defaults: 100 immediate-folder groups / 227 candidates yielded 98 selections and two no-matches under the authored example policy, with no invalid/ambiguous/unresolved groups. Nested library manifests remain parse-only. Parser errors and unimplemented Lua/XML status remain visible and nonzero. See [local corpus evidence](LOCAL-CORPUS-TESTING.md).

v0.3.2 retains provider-neutral condition provenance; v0.3.3 evaluates approved conditions; v0.3.4 composes selection/evaluation into resolved globals and proves non-selected declarations cannot leak. Selecting an ID alone does not change static `listGlobals` visibility. A verified built-in game policy, merges, tags and publication are not authorized by this selection approval.
