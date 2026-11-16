# Migration from v0.2 to v0.3

## v0.3.0: additive contracts

The four decisions were explicitly approved on 2026-11-16 in [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6913838520). The five workspaces now target 0.3.0; this is a source development version, not a published release. The original 30 beta exports remain; four beta exports are added in `@wow-addon/addon-metadata`.

| Export | Contract |
| --- | --- |
| `CLIENT_ENVIRONMENT_SCHEMA_VERSION` | Literal `1`, independent of metadata schema |
| `ClientEnvironment` | Required schema, client and family; optional game mode, game type and text locale |
| `AddOnIdentity` | Caller-owned non-empty logical AddOn ID, scoped to an installation/workspace |
| `TocVariantIdentity` | Exact source variant ID, TOC path, explicit suffix or null, source reference |

```ts
import {
  CLIENT_ENVIRONMENT_SCHEMA_VERSION, WoWClient,
  type ClientEnvironment, type TocVariantIdentity,
} from '@wow-addon/addon-metadata';
import { parseToc } from '@wow-addon/toc-parser';

const environment: ClientEnvironment = {
  schemaVersion: CLIENT_ENVIRONMENT_SCHEMA_VERSION,
  client: WoWClient.ClassicEra,
  clientFamily: 'classic',
};
const parsed = parseToc('## SavedVariables: DB', 'Example/Example_Vanilla.toc');
const logicalAddonId = 'workspace-installation/example';
const variant: TocVariantIdentity = {
  logicalAddonId,
  tocVariantId: JSON.stringify([logicalAddonId, parsed.metadata.tocPath]),
  tocPath: parsed.metadata.tocPath,
  tocSuffix: parsed.metadata.tocSuffix,
  source: parsed.entries[0]!.source,
};
```

Reuse one logical ID for all variants of one AddOn. Use different IDs for independent installations. Preserve case, Unicode and separators in `tocPath`; source aliases remain separate unless the caller establishes equivalence. `JSON.stringify([logicalAddonId, tocPath])` avoids delimiter collisions. A folder name alone is not a globally unique identity.

These are data contracts. They do not construct or validate IDs, infer suffixes, validate deserialized objects, freeze objects or choose an active TOC. The caller must reject empty IDs and construct consistent variant keys. `readonly` is shallow: the existing mutable `SourceReference` is retained. Runtime boundary validation belongs to the later selector. Known contradictory client/family pairs must be diagnosed there, never silently repaired.

Omitted optional environment fields mean unknown. Preserve unfamiliar game types/locales; they do not establish activation support. Hardcore and Season of Discovery remain game modes. No project constants are introduced.

## Wire compatibility and current behavior

`METADATA_SCHEMA_VERSION` stays **2**. The `AddOnMetadata` JSON shape and `parseToc()` behavior are unchanged. Do not inject the new fields into stored metadata or reinterpret old payloads as environment schema 1.

The static adapter still sets `GlobalDeclaration.addonId = metadata.tocPath`. The static registry retains all source declarations and its existing conditional visibility behavior. It does not select variants or evaluate environment conditions. Keep the separate logical identity alongside metadata until explicit resolver integration.

Source positions remain zero-based UTF-16, end-exclusive. Existing duplicate, path and condition provenance is unchanged. The contract tests typecheck positive and negative cases; API baselines and Extractor reports contain only the four deliberate additions.

## Later increments

TOC selection, condition descriptors, tri-state evaluation and resolved registry views have separate design decisions and tests in [the execution plan](EXECUTION-v0.3.5.md). Their implementation must update this migration record. Lua/XML parsing follows the v0.3.5 core freeze and is not delivered by these types.

## v0.3.1: explicit selection policy

The [approved selection design](DESIGN-v0.3.1.md) adds five beta exports in `toc-metadata-adapter`, bringing the total to 39. All five workspaces target source version 0.3.1. Metadata schema remains 2, environment schema remains 1 and old static callers keep their behavior.

```ts
import { selectTocVariant, type TocSelectionPolicy } from '@wow-addon/toc-metadata-adapter';

// Authored policy supplied by this caller; not a built-in WoW loader table.
const policy: TocSelectionPolicy = {
  schemaVersion: 1, id: 'workspace/explicit-era-policy',
  client: WoWClient.ClassicEra, clientFamily: 'classic',
  suffixPrecedence: ['Vanilla', 'Classic', null],
};
const selection = selectTocVariant(
  environment, logicalAddonId, 'Example',
  [{ identity: variant, metadata: parsed.metadata }], policy,
);
if (selection.status === 'selected') {
  console.log(selection.selectedVariantId);
}
```

The priority list is caller-owned. Required optional constraints are exact and never defaulted; an unknown client/family or mismatched applicability returns unresolved. Non-empty opaque IDs remain significant without trimming. Provide the exact base filename stem separately from logical identity, so an unknown suffixed TOC cannot be mistaken for fallback.

All source records remain inspectable. The selector returns a variant ID rather than changing the static registry, evaluating conditions or exposing a resolved global list. Handle all five result statuses. `TocSelectionIssue.sources` may be empty for environment-only errors; do not fabricate a source to coerce it into shared `Diagnostic`. Result source ranges are copied, so editing them cannot affect the input.

No built-in loader policy, condition semantics or metadata schema migration is introduced. See the design for validation boundaries, filename matching and future provider/resolver integration.

## v0.3.2: provider-neutral condition provenance

The [approved condition design](DESIGN-v0.3.2.md) adds one beta `ConditionDescriptor` in `global-registry` and an optional readonly `GlobalDeclaration.conditions` array. The reviewed surface becomes 40 exports; all five workspace versions/internal ranges advance to 0.3.2. Metadata remains schema 2 and environment schema remains 1.

The TOC adapter now adds this field for nonempty condition lists:

```ts
// Derived from ## SavedVariables[AllowLoadGameType vanilla]: DB
declaration.conditions?.[0];
// { providerId: '@wow-addon/toc-metadata-adapter', name: 'AllowLoadGameType',
//   values: ['vanilla'], raw: '[AllowLoadGameType vanilla]', source: ... }
```

Names, parsed values, raw text and original UTF-16 spans remain exact and ordered. The provider ID identifies the adapter supplying the descriptor; it is not a game-version or grammar assertion. Other providers may retain opaque names and empty values. Registry code does not interpret them.

For unconditional TOC output, the new property is omitted, preserving its old JSON shape. Conditional output gains an additive field: exact JSON snapshots and closed external validators must accept it. `GlobalDeclaration` has no independent wire-schema constant; `METADATA_SCHEMA_VERSION` versions metadata, not serialized registry declarations.

Legacy conditional declarations without descriptors remain accepted. Missing or empty provenance cannot override `activationState` or establish truth. Static `listGlobals` options, addonId = tocPath and SV0001 behavior are unchanged; selected-variant/environment resolution remains a later step.

The adapter independently copies each new conditions array, descriptor, values array and source/range/position object per declaration and invocation. Editing one output's condition provenance cannot modify input or sibling output. Existing declaration `source` aliasing and the registry's retention of supplied declaration objects remain unchanged. Readonly is a TypeScript contract; no runtime freezing or full registry ownership isolation is added.

## v0.3.3: explicit-policy condition evaluation

Five approved beta additions bring the surface to 45 exports: `ResolvedAvailability` in global-registry, plus `ConditionEvaluationPolicy`, `ConditionEvaluationIssue`, `ConditionEvaluationResult` and `evaluateGlobalConditions` in the adapter. Workspace source versions/internal ranges become 0.3.3; metadata/environment schemas remain 2/1. Static declaration-time ActivationState is unchanged.

```ts
const result = evaluateGlobalConditions(declaration, environment, callerPolicy);
// result.availability: active | inactive | unknown
// result.reason and result.issues retain explanations and copied source ranges.
```

Pass an explicit data-only policy, such as the authored [example](../examples/classic-era-condition-profile.json). It defines exact provider/name matching, field selection, include/exclude membership and casing choices. No default table or client-to-gameType inference is installed. Select the TOC before deriving resolved visibility; evaluating arbitrary declarations does not select their source.

Arguments use OR within a rule and conservative AND across structurally valid conditions: false dominates unknown, unknown dominates true. Unsupported providers/names, missing fields and empty arguments remain unknown and cannot produce active. Legacy conditional records without descriptors remain unknown. Structural invalidity or unresolved static activation takes precedence over the fold; nonempty descriptors on an unconditional record are contradictory.

Handle unknown and all fixed issue codes deliberately. Returned sources are canonical independent copies, and messages do not echo policy/argument values. Validation covers the consumed environment/policy/declaration/descriptor projection rather than every legacy symbol field or original source-content bound. Native object getters remain caller code. Static registry/listing/conflict behavior and serialized declaration records are unchanged by evaluation.

## v0.3.4: composed resolved-global view

Six approved adapter exports bring the total to 51: ProviderDeclarationSet, GlobalResolutionInput, ResolvedGlobalDeclaration, GlobalResolutionIssue, ResolvedGlobalRegistry and resolveGlobalRegistry. All five workspace versions/internal ranges become 0.3.4. Metadata/environment schemas stay 2/1; the new derived result has its own literal schemaVersion 1.

```ts
const view = resolveGlobalRegistry(environment, [{
  logicalAddonId, addonBaseName: 'Example', candidates, selectionPolicy,
  // providers: optional explicitly associated provider declaration batches
}], conditionPolicy);
console.log(view.complete, view.activeGlobals);
```

Group all source variants of one logical AddOn together. IDs and exact variant keys remain caller-owned; duplicate logical IDs invalidate every colliding group. Select first, then derive SavedVariables from the selected metadata and append matching provider batches. The caller establishes provider/source reachability; the pure resolver does no filesystem work or parsing of Lua/XML.

Use `activeGlobals` for resolved names. `entries` retain selected inactive/unknown records and their provider/variant/originalAddonId/evaluation. Copied declarations use logical addonId for coexistence diagnostics while keeping declaration-time activationState: a known-true conditional stays conditional. Static `listGlobals` remains a separate API; the new result is intentionally a different type.

Check `complete` when requiring a whole-project resolved answer. Unknown source selection/availability or consumed-shape errors make it false; independent valid groups can remain as a known-active partial subset. No-match is a normal empty selection. Only active selected records enter SV0001 checks, preserving the existing same-addon scope rule under logical IDs. Invalid selected projections exclude the entire AddOn rather than leaking a partially accepted group.

All returned declared/source/condition data is copied independently from inputs and other calls. Diagnostics may reference copied declaration sources within one result. First-seen selected names and duplicate declaration/provider order are preserved; root issues/sources are canonical. `complete` concerns input projections and availability, not source parse cleanliness or game-loader conformance; parser diagnostics remain the caller's separate gate.

## Pre-freeze checkpoint: named rules and compatibility

The user requested a reusable named rule. `ConditionEvaluationRule` is a beta export from the adapter; `ConditionEvaluationPolicy.rules` now uses `readonly ConditionEvaluationRule[]`. Existing inline object literals remain structurally assignable with exactly the same fields, permitted values and readonly restrictions. Serialized policies and evaluation behavior do not change. The total becomes 52 beta exports; source versions stay 0.3.4 until the separate v0.3.5 release candidate.

Issue-code, reason, status and other literal unions are closed for each installed version. Future members can break exhaustive TypeScript consumers and require reviewed API/migration changes. This checkpoint does not widen unions or promise v1 compatibility. A consumer accepting data from other versions needs an explicit unsupported-data fallback and must not turn unfamiliar availability into active. See [the full surface review](PUBLIC-SURFACE.md) and [pre-freeze acceptance](PRE-FREEZE-REVIEW.md).
