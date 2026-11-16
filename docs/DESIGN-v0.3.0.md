# v0.3.0 environment and identity proposal

**Status: APPROVED — decisions A–D approved on 2026-11-16 in [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6913838520).**
This document records the approved design for [issue #8](https://github.com/Zilvereyes/wow-addon-sdk/issues/8) after merged PR #5. Its additive implementation and tests are on the contracts-and-corpus branch. See [migration notes](MIGRATION-v0.2-to-v0.3.md) for implemented behavior and [execution plan](EXECUTION-v0.3.5.md) for subsequent steps. The original proposal remains below as design history; its approval requests are now satisfied for A–D only.

## Decision A — explicit, independently versioned environment

Proposed additive exports in `@wow-addon/addon-metadata`:

```ts
export const CLIENT_ENVIRONMENT_SCHEMA_VERSION = 1 as const;

export interface ClientEnvironment {
  readonly schemaVersion: typeof CLIENT_ENVIRONMENT_SCHEMA_VERSION;
  readonly client: WoWClient;
  readonly clientFamily: WoWClientFamily;
  readonly gameMode?: WoWGameMode;
  readonly gameType?: string;
  readonly textLocale?: string;
}
```

- Require the schema version, specific client and family. Existing `Unknown` values explicitly represent missing knowledge; a known family may accompany an unknown specific client.
- Omitted game mode, game type or locale means unknown, never Normal, Retail or a locale default.
- `gameType` and `textLocale` retain provider-supplied values. They are not numeric project IDs and do not establish supported activation semantics. Later resolvers recognize only separately verified values; unrecognized input remains unresolved.
- A specific client paired with a contradictory known family must not become an active selection. v0.3.0 defines that constraint; a later selector must report an environment diagnostic. It must never silently repair the environment.
- Hardcore and Season of Discovery remain game modes; no new WOW_PROJECT_ID constants are introduced.
- Readonly is a TypeScript contract, not a claim that deserialized objects are runtime-frozen or validated. No implicit validator or parser inference is added in this stage.

Approval requested: required versus optional fields, explicit unknown handling, and the separate environment version.

## Decision B — caller-owned logical identity and exact source identity

Proposed additive contracts:

```ts
export interface AddOnIdentity {
  readonly logicalAddonId: string;
}

export interface TocVariantIdentity extends AddOnIdentity {
  readonly tocVariantId: string;
  readonly tocPath: string;
  readonly tocSuffix: string | null;
  readonly source: SourceReference;
}
```

The caller supplies a non-empty opaque logical AddOn ID scoped to its installation or workspace. It reuses that ID for all TOCs belonging to one logical AddOn, and supplies distinct IDs for independent installations. A folder name alone does not prove global identity.

Define the variant key as `JSON.stringify([logicalAddonId, tocPath])`. This represents two strings unambiguously, without delimiter collisions. Preserve `tocPath`, suffix and source values exactly; no case folding, Unicode normalization, separator replacement, filesystem resolution or suffix inference occurs in identity construction. Empty IDs are invalid; whitespace/case inside a non-empty supplied ID remains significant.

For example, Mainline and Vanilla TOCs can have the same logical ID but distinct variant keys. An unsuffixed TOC is another source variant, not an automatic fallback selection. Two spellings of the same physical path remain separate source records unless the caller explicitly establishes equivalence. This avoids accidentally merging different case-sensitive or Unicode paths. Synthetic mixed-separator tests verify shared caller identity and exact preserved paths, not implicit path canonicalization.

The source reference is supplied by the producer and copied without changing its zero-based UTF-16, end-exclusive positions. No reading of the filesystem is required.

Approval requested: caller-owned logical IDs and deliberately exact source keys, including case, Unicode and path-alias behavior.

## Decision C — additive wire compatibility

Keep `METADATA_SCHEMA_VERSION = 2` because the existing `AddOnMetadata` shape and `parseToc()` serialized output remain unchanged. New environment and identity contracts are separate inputs/records; they are not required fields injected into existing metadata.

Do not change the adapter's current `GlobalDeclaration.addonId = addon.tocPath` in v0.3.0. Carry the new logical identity separately until the reviewed resolver integration stage. A later change to serialized metadata must receive a separate schema and migration decision.

Existing 30 exports retain one `@beta` tag each. The four proposed symbols are additive beta exports only after approval; the eventual total would be 34, requiring reviewed declaration baselines and API reports. No version bump or new stability claim occurs in this design-only PR.

Approval requested: keep metadata schema 2 and use a separate version for environment records.

## Decision D — conservative unsupported inputs

Unknown clients, unfamiliar game-type strings and unsupported modes are preserved without invented compatibility. They cannot justify activation. v0.3.0 adds neither suffix precedence nor condition evaluation; those require source verification and independent decisions in v0.3.1 and v0.3.3.

Approval requested: preserve unknown data and defer all selection/evaluation behavior to their scheduled stages.

## Implementation acceptance after approval

| Requirement | Required evidence |
| --- | --- |
| Same logical AddOn, Mainline and Vanilla variants | One supplied logical ID, two distinct source keys and preserved source references |
| Classic-family, unsuffixed and unknown inputs | Contracts express them without guessing a specific client or active TOC |
| Windows/POSIX/mixed separators, case and Unicode | Exact original path text retained; caller controls equivalence |
| JSON roundtrip | Environment schema and identity values survive serialization |
| Compatibility | Existing 38 tests still pass; parser output, metadata schema and static registry semantics are unchanged |
| Public API | Four deliberate beta additions, reviewed snapshots and strict API Extractor reports |
| Distribution | Architecture/dependency gates and license/package assertions pass on supported matrix |

Read the implementation's current tests and manifests before adding coverage. Do not assert v0.3.0 or v0.3.5 completion from this proposal.

## Later approval boundaries

Actual suffix precedence and fallback behavior, condition descriptors and supported condition semantics remain open in issue #6. This proposal does not approve them. Branch protection is an operational follow-up: main was reported unprotected at integration, and this PR does not change repository administration settings.
