# Licensing and Third-Party Content

## SDK code

The original SDK source in this repository is licensed under the MIT License. Preserve the copyright and license notice when copying or redistributing substantial portions. Each independently publishable `packages/*/package.json` declares MIT, and every workspace contains a byte-identical `LICENSE` copied from the repository root. npm includes this license in each workspace tarball and the export audit rejects missing or different notices. The root package is `private: true` only to block accidental publishing of the workspace root.

## Blizzard and other third-party materials

MIT applies only to material the project has authority to license. It does not grant rights to Blizzard-owned content. Do not commit or distribute copied Blizzard FrameXML, game textures, artwork, sound, extracted client files, confidential data or third-party content without appropriate permission and compatible licensing.

Small synthetic `.toc`, Lua and XML fixtures written for tests are preferred. Support for TOC directives, paths and public API names is not itself a transfer of copyright ownership of game assets.

WoW AddOns themselves may be subject to Blizzard's interface/AddOn policies; an independent developer toolkit is not automatically identical to an in-game AddOn. Do not imply Blizzard endorsement.

When a dependency is added, document its upstream license and ensure compliance; the MIT license on this repository does not replace third-party licenses.

## Approved optional Lua runtime dependency

The five original core packages retain no third-party runtime dependency. The separately approved lua-analysis package imports exactly luaparse 0.3.1 (MIT), without vendoring or bundling its source. Its installed dependency retains the original Oskar Schöldström notice. Actual tarball/source/license hashes, lack of runtime subdependencies and lifecycle review are recorded in [the Lua design](DESIGN-LUA-ANALYSIS.md); the repository gate verifies the installed source/license bytes. The SDK's own MIT notice does not replace that dependency notice. The new package's six-file payload includes its private syntax implementation pair; core payloads stay four files each. No installed game sources or assets enter these distributions.

## Approved optional XML runtime dependencies

The user approved XML A–F on 2026-11-17. The seventh workspace, `@wow-addon/xml-parser`, directly pins `saxes` 6.0.0 (ISC) and `xmlchars` 2.2.0 (MIT), alongside the SDK diagnostics package. Saxes declares `xmlchars: ^2.2.0`; the direct exact pin and lockfile retain the reviewed resolution. Existing core/Lua packages gain no dependency. No backend source is bundled, vendored or patched.

The approved v0.6.0 `@wow-addon/xml-analysis` eighth leaf adds only internal xml-parser/diagnostics/global-registry dependencies. It adds no third-party artifact or backend copy; the existing 84 external lock records and retained notices/hashes stay unchanged. Its payload includes the byte-identical SDK MIT LICENSE and only its reviewed package manifest and compiled index pair.

The saxes npm artifact omits its upstream LICENSE file. The XML workspace's `THIRD-PARTY-NOTICES.txt` therefore retains the complete notice from pinned upstream revision `211fa0ebec9b628affc09219199639887174bfc3`: both ISC notices and the historical Mathias Bynens notice, followed by xmlchars' original MIT license. Preserve the complete file when redistributing this workspace. Its own `LICENSE` still licenses only SDK-authored material. The XML package payload adds this notice to the usual manifest, SDK license and two compiled entry-point files; actual pack-list acceptance is checked separately.

`scripts/check-public-exports.mjs` encodes the exact backend versions, dependency resolution, lifecycle restrictions, registry integrity strings, installed runtime source hashes and retained notice bytes. In particular:

| Reviewed artifact | SHA-256 |
| --- | --- |
| `saxes.js` | `d00e2ba27ed7d6ac961d03ff14d6b8c0eb5bf063ed2c996c22c6df06ac121423` |
| Complete upstream saxes notice | `0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e` |
| xmlchars `LICENSE` | `45d196313c2647d313cc65ca9b093d2d6974b64d35ee7346f2c60c9d518dff2c` |

The gate also checks the xmlchars entry point and XML 1.0, XML 1.1 and namespace runtime modules consumed by saxes. Dependency/license review does not imply vulnerability-database clearance or establish Classic Era compatibility. Installed AddOn sources, game assets, private paths and complete local diagnostics must never enter public packages or GitHub evidence. Local corpus evidence contains aggregate counts and integrity equality only.
