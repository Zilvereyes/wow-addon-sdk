# Licensing and Third-Party Content

## SDK code

The original SDK source in this repository is licensed under the MIT License. Preserve the copyright and license notice when copying or redistributing substantial portions. Each independently publishable `packages/*/package.json` declares MIT, and every workspace contains a byte-identical `LICENSE` copied from the repository root. npm includes this license in each workspace tarball and the export audit rejects missing or different notices. The root package is `private: true` only to block accidental publishing of the workspace root.

## Blizzard and other third-party materials

MIT applies only to material the project has authority to license. It does not grant rights to Blizzard-owned content. Do not commit or distribute copied Blizzard FrameXML, game textures, artwork, sound, extracted client files, confidential data or third-party content without appropriate permission and compatible licensing.

Small synthetic `.toc` fixtures written for tests are preferred. Support for TOC directives, paths and public API names is not itself a transfer of copyright ownership of game assets.

WoW AddOns themselves may be subject to Blizzard's interface/AddOn policies; an independent developer toolkit is not automatically identical to an in-game AddOn. Do not imply Blizzard endorsement.

When a dependency is added, document its upstream license and ensure compliance; the MIT license on this repository does not replace third-party licenses.

## Approved optional Lua runtime dependency

The five original core packages retain no third-party runtime dependency. The separately approved lua-analysis package imports exactly luaparse 0.3.1 (MIT), without vendoring or bundling its source. Its installed dependency retains the original Oskar Schöldström notice. Actual tarball/source/license hashes, lack of runtime subdependencies and lifecycle review are recorded in [the Lua design](DESIGN-LUA-ANALYSIS.md); the repository gate verifies the installed source/license bytes. The SDK's own MIT notice does not replace that dependency notice. The new package's six-file payload includes its private syntax implementation pair; core payloads stay four files each. No installed game sources or assets enter these distributions.
