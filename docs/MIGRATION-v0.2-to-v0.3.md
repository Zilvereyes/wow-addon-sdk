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
