# Independent review triage — 2026-11-15

Reviewer suggestions require reproduction or a documented standard before implementation.

## Fixed in this patch
- Map both ends of malformed TOC header spans to original offsets after known inline conditions have been removed.
- Permit `import('./local.js', options)` when the target is a string literal; continue rejecting computed specifiers, forbidden package dependencies, and extra `require()` arguments.
- Six regression tests cover those scenarios; no public API migration.

## Backlog (not implemented)
- TSTL multi-return typing (`LuaMultiReturn`), nil and table semantics: future TypeScript-to-Lua adapter and API type provider.
- Retail/Classic API versioning and game-mode resolution: future API-definition provider, not parser/registry internals.
- X-Embeds, missing files, case mismatches and safe paths: opt-in filesystem validation adapter.
- Incremental parsing and cache invalidation: future workspace/LSP layer; clear stale entries on file deletion.
- Packaging: strictly allowlisted game assets and code, path traversal protection, and exclusion of development artifacts.
- Public-export audit, immutable contracts, unique diagnostic code enforcement, UTF-16 range cases, AddOn identity: architecture hardening before freeze.

## TOC paths: correction to Gemini
Warcraft Wiki recommends **backslashes** for TOC file paths to avoid XML Include issues. Forward slashes must not be universally imposed. Preserve the original spelling and normalize only in a compatibility-aware validation adapter.
Filesystem case sensitivity depends on the underlying volume, not solely the operating system.

References:
- https://warcraft.wiki.gg/wiki/TOC_format
- https://typescripttolua.github.io/docs/advanced/language-extensions/
