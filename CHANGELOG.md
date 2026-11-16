# Changelog

Changes are recorded by release. This project is in pre-1.0 development.

## [Unreleased]

### Client selection evidence tooling

- Add a staging-only generator for eight synthetic TOC-selection/comment scenarios with distinct local Lua markers, MIT licenses and a final hashed manifest. Refuse existing outputs and resolved AddOns paths; installation and runtime observations remain separate user actions.
- Add five integration checks for deterministic generated content, references, input validation and output preservation. No built-in loader policy or runtime conformance is inferred.

### TOC corpus fidelity follow-up

- Recognize empty hash-only separators as comments, preserving original raw text and UTF-16 ranges.
- Accept dotted custom `X-` metadata names while preserving duplicate spelling/value provenance and condition ranges. Ordinary dotted names and malformed annotations remain errors.
- Add six focused regression cases. The same local 434-TOC corpus reduces TOC0001 diagnostics from 194 to 19, with 347 SavedVariable declarations unchanged; the run remains failed on outstanding findings and Lua/XML remain inventory-only.

### v0.3.0 contract foundation (source version; not published)

- Add approved client-environment schema 1, explicit unknown fields, caller-owned logical AddOn identity and exact TOC-variant identity. Preserve metadata schema 2 and the previous 30 beta exports; four additive beta exports bring the total to 34.
- Add positive/negative TypeScript contract tests and runtime compatibility/identity examples.
- Add a bounded read-only local TOC corpus runner with source-range/JSON checks, aggregate-only output and explicit unimplemented Lua/XML status. Record the actual installed-corpus diagnostics rather than declaring a false pass.
- Use locked PowerShell installs, enforce Node 22+, check native exit statuses and run strict API/package gates.
- Assert actual npm dry-run file lists and reject extra assets or missing licenses in all five packages.
- Add migration guidance, complete repository review coverage and a detailed execution plan through v0.3.5 and subsequent TOC/Lua/XML parsing.

### Repository hardening (merged in PR #5)

- Test Node 22 and 24 on both Windows and Linux; retire EOL Node 20.
- Discover tests deterministically and fail if no test files are found.
- Make build explicit in the validation pipeline and audit public package entry points.
- Normalize source line endings and document portable quick-start commands.
- Committed the reviewed npm 10.9.2 lockfile; CI installs reproducibly with `npm ci` on Windows/Ubuntu and Node 22/24.
- Reviewed 30 `@beta` exports, preserved their TSDoc descriptions, and committed five API reports with declaration baselines.
- Made strict API Extractor and npm package validation mandatory CI gates.
- Added identical MIT `LICENSE` files to five publishable workspaces and license-consistency validation.


### Review follow-up

- Fix TOC0001 end positions after recognized header conditions are removed.
- Allow static `import(specifier, options)` without bypassing architecture rules; `require()` retains a single-argument restriction.
- Add six regression tests without changing the public TypeScript API.


### Fixed

- Reject unknown or malformed TOC header conditions instead of exposing globals unconditionally (TOC0001).
- Correct diagnostic spans for trailing empty and whitespace-only CSV cells (TOC0004).
- Detect forbidden TypeScript import type references and reject non-static module loads in architecture checks (ARCH0001).
- Use Node test discovery without shell globbing; add Windows/Node 20 CI coverage.

- Planned: client/TOC selection, condition provenance, tri-state evaluation and resolved global views through [v0.3.5 roadmap #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) and [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6).
- Under review: separating provider `GlobalDeclaration` input from consolidated `GlobalSymbol` output; not yet implemented in the v0.2.0 API.

## [0.2.0] - 2026-11-15

- Added standalone `@wow-addon/diagnostics` package with UTF-16 `SourcePosition` and `SourceRange`.
- Added `@wow-addon/global-registry` and `@wow-addon/toc-metadata-adapter`.
- Renamed/decoupled `savedvariables-registry` as part of the provider-neutral registry design.
- Added stable diagnostic codes and contract migration notes.
- Added source import-boundary audits, dependency-cruiser configuration, API declaration snapshots, tests and CI.
- **Breaking:** `SourceRange` changed from flat coordinates to `{start:{line,column},end:{line,column}}`.

## [0.1.0] - 2026-11-15

- Initial prototype: TOC parser, metadata model and SavedVariables registry.

[Unreleased]: https://github.com/Zilvereyes/wow-addon-sdk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Zilvereyes/wow-addon-sdk/releases/tag/v0.2.0
[0.1.0]: https://github.com/Zilvereyes/wow-addon-sdk/releases/tag/v0.1.0
