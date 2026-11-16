# v0.3.2: preserve provider-neutral condition provenance

**Status: A–D approved, implemented on the feature branch, final verification in progress.** The user explicitly approved implementation in [issue #6, comment 6917507563](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6917507563). The [v0.3.1 selector PR #16](https://github.com/Zilvereyes/wow-addon-sdk/pull/16) is merged into main as `fdb8d69`, with all four supported post-merge CI jobs passed. This document records the approved contract and its acceptance requirements.

## Observed gap and intended result

`parseToc()` retains conditions on directives, file references and SavedVariable declarations. Before v0.3.2, the TOC adapter checked only `saved.conditions.length` and emitted a conditional/unconditional flag; condition names, values, raw text and source ranges disappeared at that boundary. The registry already retains whole declarations, so it does not need to parse or interpret TOC syntax to preserve this data.

For each valid SavedVariable, the adapter should retain every supplied condition in original order on its derived declaration. Existing identity, scope, duplicate handling, activation flags, static listings and scope-conflict diagnostics stay unchanged. No condition becomes true or false in this increment.

## Approved contract (decision A)

Add exactly one beta export to `@wow-addon/global-registry`, using its existing diagnostics dependency:

```ts
export interface ConditionDescriptor {
  readonly providerId: string;
  readonly name: string;
  readonly values: readonly string[];
  readonly raw: string;
  readonly source: SourceReference;
}
```

Add `readonly conditions?: readonly ConditionDescriptor[]` to the existing `GlobalDeclaration`. The reviewed total becomes 40 exports after the five v0.3.1 additions. Neither the registry nor diagnostics imports metadata, TOC, Lua or XML types. There is no new package or dependency edge.

`providerId` identifies the adapter/provider that supplied the descriptor, not an inferred game grammar or the process that originally created the file. The TOC adapter uses the exact stable ID `@wow-addon/toc-metadata-adapter`. Future providers use their own IDs. A future evaluator must explicitly support a provider/name combination; a matching condition name alone cannot establish shared semantics.

Names, values and raw text are opaque to the registry. Provider-specific condition grammar, nesting and truth rules are deliberately outside this descriptor. Unsupported names or empty argument lists remain representable; their presence is not evidence that a condition is valid or active. This phase adds no public runtime validator or diagnostics.

## Adapter mapping and ownership (decision B)

1. Continue skipping SavedVariable records with `validIdentifier === false`.
2. Retain `addonId = addon.tocPath`, original symbol order/duplicates, scope and existing `source` behavior. Logical identity is composed only by the later resolver.
3. Compute the old activation flag exactly as before: nonempty conditions produce `conditional`; no conditions produce `unconditional`.
4. For a nonempty list, copy each documented condition field and add the provider ID. Preserve name casing, parsed value order/duplicates, raw annotation spelling and exact file/UTF-16 range. Raw text retains spacing that the parser's semantic value list already trims.
5. Allocate a new conditions array, new descriptor, new values array, and new source/range/start/end objects for every output declaration and every invocation. Conditions shared by two parsed SavedVariables must not alias each other or their inputs in adapter output. Copy only documented source fields.
6. For an empty list, omit the new property completely. This preserves the existing serialized shape of unconditional adapter output. Existing declaration source aliasing and registry retention-by-reference remain unchanged and are documented separately from these new condition copies.
7. Do not reinterpret or broaden parser grammar. Unknown/malformed header annotations remain parser diagnostics with no leaked SavedVariable. An unfamiliar descriptor supplied directly by another provider is retained as opaque provenance.

Readonly applies to the new TypeScript fields and arrays. Existing `SourceReference` remains shallowly mutable; copying provides adapter input/output independence, not runtime freezing or full ownership isolation within the registry.

## Compatibility and absence (decision C)

Keep `METADATA_SCHEMA_VERSION = 2` and environment schema 1. `AddOnMetadata` is unchanged; this optional field belongs to the separate global-declaration contract. Root/workspace source versions and internal ranges advance together to 0.3.2 only during implementation, with unchanged third-party lock resolutions.

Old declarations without `conditions` remain accepted by `buildGlobalRegistry()`. In particular, a legacy `conditional` declaration without descriptors has unavailable provenance; a later evaluator must not infer unconditional availability from the missing field. An empty list also cannot override `activationState`. This increment does not define evaluator truth tables or conjunction rules.

Condition-bearing adapter output gains a new optional JSON field. TypeScript consumers of the existing interface remain compatible, but consumers using exact JSON snapshots or closed external validators must update their expectations. There is no global-registry wire-schema constant to bump; metadata schema 2 must not be misrepresented as a version for serialized global declarations. Document the additive field and its absence semantics explicitly.

## Verification contract (decision D)

| Requirement | Independent acceptance evidence |
| --- | --- |
| One provider-neutral export and optional field | Positive/negative TypeScript fixtures, reviewed global-registry baseline/report, exactly 40 beta exports after v0.3.1 |
| Loss point repaired | Authored TOC with header and value annotations; compare adapter descriptors against exact expected text/ranges, not only against parser objects |
| Ordering and duplicates | Multiple annotations, duplicate arguments, repeated symbols and multiple TOCs retain their order and exact spelling |
| UTF-16 and raw provenance | BOM, astral Unicode before a value annotation, mixed line endings and mixed slash paths; independently calculate end-exclusive spans |
| No aliasing in new provenance | Frozen input, two symbols sharing input conditions, repeated adapter calls; mutate every nested output field and check input/sibling output unchanged |
| Opaque future providers | Authored Lua/XML-provider records retain unknown names, empty values, raw text and independent origins through registry JSON roundtrip |
| Old behavior | Unconditional output has no new property; legacy conditional records remain accepted; listGlobals options and SV0001 results remain identical |
| Malformed headers | Existing unknown/interleaved malformed annotations remain diagnostics and produce zero unintended declarations |
| Architecture and package compatibility | Five-package boundary/dependency checks; deliberate API diffs; locked install, integrated tests, strict Extractor and exact package/license payloads |
| Real corpus | Read-only TOC run, aggregate condition counts/copy invariants, unchanged parser diagnostic histogram and no unreported skips; Lua/XML still reported as unimplemented |
| Final delivery | Supported Ubuntu/Windows × Node 22/24 CI on a concrete reviewed head; separately authorized merge; no tag or publication |

Implementation order: demonstrate the missing descriptor/type and adapter-copy behavior; add the registry contract; implement only the adapter mapping; verify focused tests and unchanged static behavior; update deliberate API/version/migration records; extend the opt-in corpus invariant checks; then run integrated and final-head CI gates. No broad parser recovery change is bundled here.

## Subsequent decisions

v0.3.3 must separately define supported provider/name semantics, argument validation, case rules, multi-condition composition and active/inactive/unknown outcomes. v0.3.4 must compose selected variant identity with evaluation before resolving globals. Approval of A–D does not decide those contracts, a built-in loader policy, Lua/XML parser boundaries or release publication.
