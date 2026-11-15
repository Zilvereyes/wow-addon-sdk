# Changelog

Changes are recorded by release. This project is in pre-1.0 development.

## [Unreleased]

### Repository hardening (in progress)

- Test Node 22 and 24 on both Windows and Linux; retire EOL Node 20.
- Discover tests deterministically and fail if no test files are found.
- Make build explicit in the validation pipeline and audit public package entry points.
- Normalize source line endings and document portable quick-start commands.
- Pending: reviewed npm lockfile, `npm ci`, and approved API Extractor reports as a mandatory gate.


### Review follow-up

- Fix TOC0001 end positions after recognized header conditions are removed.
- Allow static `import(specifier, options)` without bypassing architecture rules; `require()` retains a single-argument restriction.
- Add six regression tests without changing the public TypeScript API.


### Fixed

- Reject unknown or malformed TOC header conditions instead of exposing globals unconditionally (TOC0001).
- Correct diagnostic spans for trailing empty and whitespace-only CSV cells (TOC0004).
- Detect forbidden TypeScript import type references and reject non-static module loads in architecture checks (ARCH0001).
- Use Node test discovery without shell globbing; add Windows/Node 20 CI coverage.

- Planned: condition normalization, active client/TOC resolution, richer symbol contracts.
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
