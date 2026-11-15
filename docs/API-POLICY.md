# API Compatibility Policy

## Before 1.0

The SDK is in active development. Public TypeScript APIs can change. Each change to public interfaces must include a migration note and an intentional review of the versioned declaration snapshots in `api/baselines`.

## 0.3.5 — Architectural Freeze

An architectural freeze establishes stable dependency rules, documented exports, reviewed API snapshots, a migration record and CI gates. It does **not** constitute a public API compatibility guarantee or a SemVer 1.0 release.

## 1.0.0 — Consumer Stability

From 1.0.0 the project intends to follow SemVer: breaking public API changes require a major version increment; compatible new features minor; bugfixes patch.

## Checks

- `npm run check:architecture` checks import boundaries, package declarations, references and cycles.
- `npm run check:deps` runs dependency-cruiser.
- `npm run check:api` checks compiled declaration snapshots.
- API Extractor configurations exist, but audited/committed reports must be bootstrapped before its validation can become a mandatory gate.

Versioned serialized metadata (`METADATA_SCHEMA_VERSION`) is separate from the npm package SemVer version.
