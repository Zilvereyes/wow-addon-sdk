# Follow-up review: parser quality and future SDK capabilities

This is an implementation backlog, not a declaration that these features are already available.

## Implemented and regression-tested in 0.2.x

- UTF-8 BOM at the beginning of TOC files, mixed CRLF/LF/CR line endings, UTF-16 source ranges.
- Case-insensitive directive handling and preservation of repeated custom X-* metadata.
- Misspelled header conditions now produce TOC0001 instead of unconditional declarations.
- Trailing empty CSV segments now map to the end of the directive value.
- TypeScript ImportTypeNode and dynamic import/require boundaries are checked.
- Node test discovery works without a shell-expanded wildcard.

## Separate packages / later milestones

- File path resolution, missing file diagnostics, and case mismatch diagnostics: a **filesystem-aware validation adapter**, not the pure TOC parser. Filesystem case-sensitivity varies by volume and mount; do not equate every macOS installation with case-sensitive filesystem behavior. Support both normalized and exact path comparisons, plus game client path conventions.
- WoW API symbol data per Retail/Classic variants and Interface number: a **versioned API-definition provider**. Do not confuse TOC Interface values with an authoritative API inventory.
- Custom globals and embedded libraries: explicit **symbol providers**, merged through the provider-neutral global registry, with provenance and collision handling.
- Lua/XML and $parent frame analysis: separate parser and **reference-graph** packages.
- AddOn release ZIP and CurseForge/Wago deployment: optional **packaging/publishing adapters**. Deterministic asset filtering, license checks, and TOC load-order verification belong there.
- TypeScript-to-Lua or Luau: separate compilation tooling. esbuild/rollup alone output JavaScript, **not Lua**.
- API Extractor required reports, npm lockfile, npm ci, branch protections: **repository hardening** milestone. CI status alone does not establish branch protection.

Do not add VS Code, LuaLS, AI, game runtime files, filesystem APIs or network APIs to SDK core packages.
