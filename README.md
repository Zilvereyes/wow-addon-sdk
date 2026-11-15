# WoW AddOn SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A modular, editor-agnostic TypeScript SDK for World of Warcraft AddOn development.**

WoW AddOn SDK provides reusable libraries for parsing AddOn `.toc` files, modeling AddOn metadata, tracking global declarations, and producing source-aware diagnostics. Syntax parsing, semantic models, symbol registries and external tooling adapters are deliberately separated.

> **Status:** Pre-1.0 development preview (`v0.2.0`). Public APIs may change. This is not a published npm release and is not affiliated with Blizzard Entertainment.

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

Requires Node.js 20+ and npm. On Windows, PowerShell 7 is recommended.

```powershell
npm install
npm run check:all
node .\examples\inspect-toc.mjs .\examples\ZilverUI\ZilverUI_Mainline.toc
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
- Conditions are **preserved**, not yet evaluated. Conditional symbols are omitted from `listGlobals()` by default.

See [architecture](docs/ARCHITECTURE.md), [diagnostic codes](docs/DIAGNOSTIC-CODES.md), and the [v0.1 → v0.2 migration guide](docs/MIGRATION-v0.1-to-v0.2.md).

## Validation

```powershell
npm run build
npm test
npm run check:architecture
npm run check:deps
npm run check:api
npm run check:all
```

The repository includes GitHub Actions verification, TypeScript project references, a custom import-boundary audit, dependency-cruiser rules, versioned declaration snapshots and API Extractor configurations. **API Extractor reports require an initial online bootstrap and review before being made a mandatory CI check.**

## Non-goals (v0.2.0)

This release does **not**:

- Parse Lua source code, XML or Blizzard FrameXML.
- Resolve `$parent` frame names or infer saved-variable types.
- Evaluate client/game-mode condition expressions or pick the active TOC automatically.
- Depend on VS Code, Lua Language Server or AI tooling.
- Modify a user's `.vscode/settings.json` or generate runtime Lua initialization.
- Bundle or redistribute Blizzard-owned source files or game assets.

Those capabilities belong to separately versioned future adapters and analysis packages.

## Roadmap

| Version | Target |
| --- | --- |
| `0.2.x` | Five packages, diagnostics, registry, adapter, architecture checks |
| `0.3.0` | Condition normalization, client/TOC resolution |
| `0.3.5` | **Architectural Freeze**: reviewed public API snapshots, dependency audit, migration docs |
| `0.4.x` | LuaLS adapter |
| `0.5.x` | XML and Lua parsers, reference graph |
| `1.0.0` | **Consumer API Stability**, SemVer guarantees |

An architectural freeze in `0.3.5` **is not** a promise of stable public APIs. See [API Policy](docs/API-POLICY.md).

## Contributing and licensing

The repository root is marked `"private": true` in `package.json` **only to prevent accidental npm publication of the monorepo root**. The GitHub repository is public; this field does not control GitHub visibility.

The SDK source code is distributed under the [MIT License](LICENSE). The individual package manifests declare `"license": "MIT"`. Please read [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md), and [Licensing and Third-Party Content](docs/LICENSING-AND-THIRD-PARTY.md).

*World of Warcraft* and related names are trademarks of Blizzard Entertainment. This independent community project is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment.
