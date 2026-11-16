# Contributing to WoW AddOn SDK

Thanks for helping build a reusable, editor-agnostic SDK.

## Before opening a pull request

1. Open an issue or discussion for breaking public API changes or new package boundaries.
2. Keep parser, metadata, registry and adapters separate; see `docs/ARCHITECTURE.md`.
3. Use Node.js 22+ with npm 10.9.2 (the pinned CI npm version). The reviewed lockfile is committed. Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check:all`, `npm run api:extractor` and `npm run check:packages`. Avoid routine `npm install` because it may change the lockfile.
4. Add regression tests for new behavior and diagnostics; preserve source order and UTF-16 ranges.
5. Document changes in `CHANGELOG.md`. Include `docs/MIGRATION-*.md` for breaking changes.
6. Avoid committing generated `dist/`, `node_modules/`, `.tsbuildinfo` or credentials.

## Public API and dependencies

Do not introduce reverse dependencies or dependencies on VS Code, LuaLS or Continue in core packages. Public API snapshots under `api/baselines` and reports under `packages/*/etc/*.api.md` must be reviewed; never refresh them merely to pass CI. Preserve the original 30 intentional beta exports and all 52 core exports accepted at v0.3.5. The approved Lua extension adds three, for 55 total; see the [surface inventory](docs/PUBLIC-SURFACE.md). New literal-union members can break exhaustive consumers and require compatibility review. Use `npm run api:extractor:local` only for intentional report changes, and verify with strict `npm run api:extractor`. Publishable workspaces must carry an MIT LICENSE byte-identical to the root. Core packages retain four-file payloads; Lua permits its private syntax implementation pair in an exact six-file payload. Its sole third-party runtime import/version and installed source/license hashes are explicit audited pins; do not change them as an incidental lock refresh. The v0.3.5 architectural freeze is distinct from v1.0 stability. See [roadmap #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) and [Lua A–E](docs/DESIGN-LUA-ANALYSIS.md).

## Third-party and Blizzard materials

Submit only code/content you are authorized to license under MIT. Do not copy or commit proprietary Blizzard source, extracted FrameXML, artwork, assets or confidential material. Prefer small, independently authored fixtures. Indicate the source and license of any third-party material in the pull request and discuss exceptions before inclusion.

## Reporting issues

Include a minimal reproducible `.toc` example, expected behavior, actual diagnostics and runtime versions. Remove private paths, tokens and secrets before attaching logs.
