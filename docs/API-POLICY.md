# API Compatibility Policy

## Before 1.0

The SDK is in active development. Public TypeScript APIs can change. All 45 intentional exports in the five current packages use `@beta` (30 preserved plus four approved v0.3.0, five approved v0.3.1, one approved v0.3.2 and five approved v0.3.3 additions). `@public` is reserved for an explicit consumer-stability decision, normally v1.0. API changes require reviewed declaration snapshots in `api/baselines`, reviewed reports in `packages/*/etc/*.api.md` and migration notes for compatibility changes.

## 0.3.5 — Architectural Freeze

An architectural freeze establishes stable dependency rules, documented exports, client-aware resolver regression coverage, reviewed API snapshots, a migration record, license-complete npm packages and CI gates. It does **not** constitute a public API compatibility guarantee or a SemVer 1.0 release. See [v0.3.5 roadmap #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) and [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6).

## 1.0.0 — Consumer Stability

From 1.0.0 the project intends to follow SemVer: breaking public API changes require a major version increment; compatible new features minor; bugfixes patch.

## Checks

- `npm run check:architecture` checks import boundaries, package declarations, references and cycles.
- `npm run check:deps` runs dependency-cruiser.
- `npm run check:api` checks compiled declaration snapshots.
- Strict `npm run api:extractor` validates five committed reports as a mandatory CI gate. Only run `npm run api:extractor:local` for deliberate report regeneration and review.
- `npm run check:packages` asserts npm's dry-run listing contains exactly the five workspaces and four approved files each; the public-export audit separately enforces identical MIT LICENSE files.

Versioned serialized metadata (`METADATA_SCHEMA_VERSION`) is separate from the npm package SemVer version.
