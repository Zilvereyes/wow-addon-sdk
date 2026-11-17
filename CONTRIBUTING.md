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

Do not introduce reverse dependencies or dependencies on VS Code, LuaLS or Continue in core packages. Public API snapshots under `api/baselines` and reports under `packages/*/etc/*.api.md` must be reviewed; never refresh them merely to pass CI. Preserve the original 30 beta exports and all 52 core exports accepted at v0.3.5. The approved optional extensions bring the current total to 78: five Lua, nine XML syntax and twelve XML analysis exports; see the [surface inventory](docs/PUBLIC-SURFACE.md). New literal-union members can break exhaustive consumers and require compatibility review. Use `npm run api:extractor:local` only for intentional changes to the eight canonical reports, then verify with strict `npm run api:extractor`. Keep enabled report/entry/temp destinations canonical; do not disable reports to pass the gate.

Every publishable workspace carries an MIT LICENSE byte-identical to the root. Payloads remain five four-file cores, six-file Lua, five-file XML syntax including complete THIRD-PARTY-NOTICES.txt, and four-file XML analysis. External pins remain luaparse0.3.1, saxes6.0.0 and xmlchars2.2.0 with exact installed source/notice bytes and reviewed root/deep runtime entry points. Do not change them as an incidental lock refresh or introduce optional/peer/bundled dependency declarations. The v0.3.5 freeze is distinct from v1.0 stability. See [roadmap #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7), [approved inline contracts](docs/PROPOSAL-INLINE-LUA.md), [migration](docs/MIGRATION-v0.6-to-v0.7.md) and [licensing](docs/LICENSING-AND-THIRD-PARTY.md).

## Third-party and Blizzard materials

Submit only code/content you are authorized to license under MIT. Do not copy or commit proprietary Blizzard source, extracted FrameXML, artwork, assets or confidential material. Prefer small, independently authored fixtures. Indicate the source and license of any third-party material in the pull request and discuss exceptions before inclusion.

## Reporting issues

Include a minimal reproducible `.toc` example, expected behavior, actual diagnostics and runtime versions. Remove private paths, tokens and secrets before attaching logs.
