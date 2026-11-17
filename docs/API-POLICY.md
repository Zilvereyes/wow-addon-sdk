# API Compatibility Policy

## Before 1.0

The SDK is in active development. Public TypeScript APIs can change. All 78 intentional exports use `@beta`: the five core packages retain 52 reviewed declarations, with five Lua, nine XML syntax and twelve XML analysis exports (16 runtime values/functions, 62 type-only contracts overall). `@public` is reserved for an explicit consumer-stability decision, normally v1.0. API changes require reviewed declaration snapshots in `api/baselines`, reviewed reports in `packages/*/etc/*.api.md` and migration notes. The [public surface inventory](PUBLIC-SURFACE.md) records each consumer purpose; [inline Lua A–E](PROPOSAL-INLINE-LUA.md) and [migration](MIGRATION-v0.6-to-v0.7.md) record the approved additive context/mapping contracts.

Literal unions are closed for the installed version. Adding an issue code, reason, status or other member can break exhaustive TypeScript switches and must be reviewed/documented as a compatibility change. Existing members are not widened to string during this checkpoint. Beta status allows deliberate evolution; it does not promise that new union members are source-compatible. Version-tolerant callers need an unsupported-data fallback and conservative availability handling. See the [pre-freeze review](PRE-FREEZE-REVIEW.md).

## 0.3.5 — Architectural Freeze

An architectural freeze establishes stable dependency rules, documented exports, client-aware resolver regression coverage, reviewed API snapshots, a migration record, license-complete npm packages and CI gates. It does **not** constitute a public API compatibility guarantee or a SemVer 1.0 release. See [v0.3.5 roadmap #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) and [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6).

The [v0.3.5 acceptance record](RELEASE-READINESS-v0.3.5.md) maps each requirement to source, tests and final-head evidence. It freezes the existing core graph; future parser/provider package additions require their own reviewed boundary decisions. The user-selected main protection requires PRs and four supported checks, enforced for administrators; chat authorization is distinct from GitHub review state.

## 1.0.0 — Consumer Stability

From 1.0.0 the project intends to follow SemVer: breaking public API changes require a major version increment; compatible new features minor; bugfixes patch.

## Checks

- `npm run check:architecture` checks import boundaries, package declarations, references and cycles.
- `npm run check:deps` runs dependency-cruiser.
- `npm run check:api` checks compiled declaration snapshots.
- Strict `npm run api:extractor` validates eight committed reports as a mandatory CI gate. Its preflight requires enabled canonical report/entry/temp destinations before invoking any package CLI. Only run `npm run api:extractor:local` for deliberate report regeneration and review.
- `npm run check:packages` asserts five four-file core payloads, one six-file Lua payload, one five-file XML syntax payload with retained third-party notice, and one four-file XML analysis payload. The public-export audit enforces root-only entry points, identical SDK MIT licenses, exact backend source/license hashes and their actual root/deep runtime entry points without importing them.
- Workspace runtime declarations use the reviewed dependencies fields; optional/peer/bundled alternatives cannot bypass graph/pin checks. Unsupported backend entrypoint redirects are rejected, including ESM-only mappings.

Versioned serialized metadata (`METADATA_SCHEMA_VERSION`) is separate from the npm package SemVer version.
