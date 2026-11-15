# Contributing to WoW AddOn SDK

Thanks for helping build a reusable, editor-agnostic SDK.

## Before opening a pull request

1. Open an issue or discussion for breaking public API changes or new package boundaries.
2. Keep parser, metadata, registry and adapters separate; see `docs/ARCHITECTURE.md`.
3. Use Node.js 20+ and run `npm install`, `npm run check:all` and `npm test` locally.
4. Add regression tests for new behavior and diagnostics; preserve source order and UTF-16 ranges.
5. Document changes in `CHANGELOG.md`. Include `docs/MIGRATION-*.md` for breaking changes.
6. Avoid committing generated `dist/`, `node_modules/`, `.tsbuildinfo` or credentials.

## Public API and dependencies

Do not introduce reverse dependencies or dependencies on VS Code, LuaLS or Continue in core packages. Public API snapshots under `api/baselines` are intentionally reviewed; do not simply refresh them to make a failing CI check pass. The `0.3.5` architectural freeze is distinct from the stability guarantee planned for `1.0.0`.

## Third-party and Blizzard materials

Submit only code/content you are authorized to license under MIT. Do not copy or commit proprietary Blizzard source, extracted FrameXML, artwork, assets or confidential material. Prefer small, independently authored fixtures. Indicate the source and license of any third-party material in the pull request and discuss exceptions before inclusion.

## Reporting issues

Include a minimal reproducible `.toc` example, expected behavior, actual diagnostics and runtime versions. Remove private paths, tokens and secrets before attaching logs.
