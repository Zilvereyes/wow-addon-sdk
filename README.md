# WoW AddOn SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A modular, editor-agnostic TypeScript SDK for World of Warcraft AddOn development.**

WoW AddOn SDK provides reusable libraries for parsing AddOn `.toc` files, modeling AddOn metadata, tracking global declarations, and producing source-aware diagnostics. Syntax parsing, semantic models, symbol registries and external tooling adapters are deliberately separated.

> **Status:** Pre-1.0 development preview (`v0.3.4`). Public APIs may change. This is not a published npm release and is not affiliated with Blizzard Entertainment.

## Packages

| Package | Purpose |
| --- | --- |
| `@wow-addon/diagnostics` | Editor-neutral source ranges and diagnostics |
| `@wow-addon/addon-metadata` | TOC and AddOn metadata contracts, client variants, preserved conditions |
| `@wow-addon/toc-parser` | TOC parsing, retained source order and parse diagnostics |
| `@wow-addon/global-registry` | Provider-neutral global declarations, consolidation and scope conflicts |
| `@wow-addon/toc-metadata-adapter` | The official AddOn metadata → global declaration translation |

The core contains **no dependencies on VS Code, LuaLS or Continue**. Dependency boundaries are enforced in source and CI.

## Quick start

Requires Node.js 22+ and npm. On Windows, PowerShell 7 is recommended.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run check:all
node ./examples/inspect-toc.mjs ./examples/ZilverUI/ZilverUI_Mainline.toc
```

```typescript
import { parseToc } from '@wow-addon/toc-parser';
import { buildGlobalRegistry, listGlobals } from '@wow-addon/global-registry';
import { toGlobalDeclarations } from '@wow-addon/toc-metadata-adapter';

const { metadata, diagnostics } = parseToc(
  '## SavedVariables: ZUI_DB\n## SavedVariablesPerCharacter: ZUI_Character',
  'ZilverUI/ZilverUI.toc'
);
const registry = buildGlobalRegistry(toGlobalDeclarations([metadata]));
console.log(listGlobals(registry)); // ['ZUI_DB', 'ZUI_Character']
```

## Architecture and guarantees

- `diagnostics` has no package imports.
- `addon-metadata` and `global-registry` can only depend on `diagnostics`.
- `toc-parser` can depend on `diagnostics` and `addon-metadata`, never the registry.
- `toc-metadata-adapter` connects the two domains without reversing their dependency direction.
- Source positions use **zero-based UTF-16 offsets with exclusive end ranges**.
- Static APIs preserve conditions and omit conditional symbols from `listGlobals()` by default. Explicit evaluation/resolution APIs derive availability under caller-supplied policies.

See [architecture](docs/ARCHITECTURE.md), [diagnostic codes](docs/DIAGNOSTIC-CODES.md), and the [v0.1 → v0.2 migration guide](docs/MIGRATION-v0.1-to-v0.2.md).

## Validation

```powershell
npm run build
npm test
npm run check:architecture
npm run check:deps
npm run check:api
npm run check:all
npm run api:extractor
npm run check:packages
```

GitHub Actions validates Node 22 and 24 on both Ubuntu 24.04 and Windows. The repository includes GitHub Actions verification, TypeScript project references, a custom import-boundary audit, dependency-cruiser rules, versioned declaration snapshots and API Extractor configurations. **Strict API Extractor and actual npm dry-run file-list assertions are mandatory CI gates.** Use `npm run api:extractor:local` only to intentionally regenerate reviewed reports, then run strict `npm run api:extractor`.

v0.3.0 adds separate environment schema 1 and caller-owned logical/variant identity contracts. v0.3.1–0.3.3 provide explicit-policy selection, provenance and conservative evaluation. v0.3.4 composes them into a resolved view: known active names, selected declaration origins and active-only scope conflicts. Static APIs retain their behavior. Metadata remains schema 2; the original 30 beta exports are preserved (52 total including the named condition-rule type), and no built-in WoW-loader policy is inferred. See [migration](docs/MIGRATION-v0.2-to-v0.3.md), [selection](docs/DESIGN-v0.3.1.md), [provenance](docs/DESIGN-v0.3.2.md), [evaluation](docs/DESIGN-v0.3.3.md) and [resolution design](docs/DESIGN-v0.3.4.md). For optional read-only installed-AddOn checks, see [local corpus testing](docs/LOCAL-CORPUS-TESTING.md). The [pre-freeze review](docs/PRE-FREEZE-REVIEW.md) and [public surface inventory](docs/PUBLIC-SURFACE.md) record remaining acceptance before v0.3.5. The [detailed plan](docs/EXECUTION-v0.3.5.md) covers core freeze and subsequent actual Lua/XML parsing.

## Non-goals (v0.3.4)

This release does **not**:

- Parse Lua source code, XML or Blizzard FrameXML.
- Resolve `$parent` frame names or infer saved-variable types.
- Infer an automatic WoW-loader TOC/condition policy. Selection, condition evaluation and resolved views use explicit caller policies and source associations.
- Depend on VS Code, Lua Language Server or AI tooling.
- Modify a user's `.vscode/settings.json` or generate runtime Lua initialization.
- Bundle or redistribute Blizzard-owned source files or game assets.

Those capabilities belong to separately versioned future adapters and analysis packages.

## Roadmap

| Version | Target |
| --- | --- |
| `0.2.x` | Five packages, diagnostics, registry, adapter, architecture checks |
| `0.3.0` | Versioned client environment and logical AddOn identity contracts |
| `0.3.1–0.3.4` | Active TOC selection, condition provenance, tri-state evaluation and resolved global views |
| `0.3.5` | **Architectural Freeze**: API snapshots, environment regression coverage, migration docs, licensing and packaging gates |
| `0.4.x` | LuaLS adapter |
| `0.5.x` | XML and Lua parsers, reference graph |
| `1.0.0` | **Consumer API Stability**, SemVer guarantees |

An architectural freeze in `0.3.5` **is not** a promise of stable public APIs. See [API Policy](docs/API-POLICY.md) and [v0.3.5 roadmap](docs/ROADMAP-v0.3.5.md).

## Contributing and licensing

The repository root is marked `"private": true` in `package.json` **only to prevent accidental npm publication of the monorepo root**. The GitHub repository is public; this field does not control GitHub visibility.

The SDK source code is distributed under the [MIT License](LICENSE). Each independently publishable workspace includes an identical MIT `LICENSE` in its npm tarball and declares `"license": "MIT"`. Please read [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md), and [Licensing and Third-Party Content](docs/LICENSING-AND-THIRD-PARTY.md).

*World of Warcraft* and related names are trademarks of Blizzard Entertainment. This independent community project is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment.
