# Migration: WoW AddOn Core v0.1.x → WoW AddOn SDK v0.2.0

**Breaking:** SourceRange, registry package, diagnostic codes and registry API.

## Range migration

```ts
// OLD v0.1
const line = source.range.startLine;
const column = source.range.startColumn;
const last = source.range.endColumn;

// NEW v0.2
const line = source.range.start.line;
const column = source.range.start.column;
const last = source.range.end.column;
```

Ranges are UTF-16 (0-based) and end-exclusive in both releases.

## Imports and registry

```ts
// OLD
import { buildSavedVariablesRegistry, listGlobals } from '@wow-addon/savedvariables-registry';
const reg = buildSavedVariablesRegistry([parsed.metadata]);
for (const origin of reg.entries[0].origins) { /* ... */ }

// NEW
import { buildTocGlobalRegistry } from '@wow-addon/toc-metadata-adapter';
import { buildGlobalRegistry, listGlobals } from '@wow-addon/global-registry';
const reg = buildTocGlobalRegistry([parsed.metadata]);
for (const declaration of reg.entries[0].declarations) { /* ... */ }
// Or map other providers into GlobalDeclaration[] and call buildGlobalRegistry(declarations).
```

`declaration` now has `name`, `addonId`, `kind`, `scope?`, `activationState` and `source`. The registry does not preserve `InlineCondition[]` itself; the TOC parser and metadata model retain original conditions. Future condition evaluators belong in semantic adapters.

## Diagnostics migration

`Diagnostic`, `DiagnosticSeverity`, `SourcePosition`, `SourceRange`, `SourceReference` move to `@wow-addon/diagnostics`. `ParseDiagnostic` from metadata is replaced with `Diagnostic`.

| Old code | New code | Description |
| --- | --- | --- |
| `TOC_MALFORMED_DIRECTIVE` | `TOC0001` | Malformed directive |
| `TOC_DUPLICATE_SAVED_VARIABLE` | `TOC0002` | Duplicate SavedVariable declaration |
| `TOC_INVALID_SAVED_VARIABLE` | `TOC0003` | Invalid Lua 5.1 identifier |
| `TOC_EMPTY_LIST_ITEM` | `TOC0004` | Empty list item |
| `TOC_LINE_TOO_LONG` | `TOC0005` | TOC line processing limit |
| `TOC_LEADING_PATH_WHITESPACE` | `TOC0006` | Leading whitespace in file path |
| `SAVED_VARIABLE_SCOPE_CONFLICT` | `SV0001` | Scope conflict inside one addonId |

## Schema and consumption

`METADATA_SCHEMA_VERSION` is incremented from 1 to 2 because `SourceRange` is a breaking change in serialized JSON. Reject or migrate v1 payloads before upgrading consumers. Avoid mixing v0.1 and v0.2 objects in the same process.

## API and CI

The baseline compiler signatures live in `api/baselines`. Changes require explicit review and updated snapshots. The API Extractor configs are included but need their first reports approved via `npm run api:extractor:local` after an online npm install.
