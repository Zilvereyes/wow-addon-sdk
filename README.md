# WoW AddOn SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A modular, editor-agnostic TypeScript SDK for World of Warcraft AddOn development.**

WoW AddOn SDK provides reusable libraries for parsing AddOn `.toc` and XML documents, analyzing Lua 5.1 syntax and lexical globals, modeling AddOn metadata, and producing source-aware diagnostics. Syntax parsing, semantic models, symbol registries and external tooling adapters are deliberately separated.

> **Status:** Pre-1.0 development preview (`v0.7.0` source milestone). Public APIs may change. This is not a published npm release and is not affiliated with Blizzard Entertainment. Source versions do not establish release readiness or local corpus acceptance.

## Packages

| Package | Purpose |
| --- | --- |
| `@wow-addon/diagnostics` | Editor-neutral source ranges and diagnostics |
| `@wow-addon/addon-metadata` | TOC and AddOn metadata contracts, client variants, preserved conditions |
| `@wow-addon/toc-parser` | TOC parsing, retained source order and parse diagnostics |
| `@wow-addon/global-registry` | Provider-neutral global declarations, consolidation and scope conflicts |
| `@wow-addon/toc-metadata-adapter` | The official AddOn metadata → global declaration translation |
| `@wow-addon/lua-analysis` | Optional Lua 5.1 syntax and conservative lexical-global analysis, with a pinned MIT backend |
| `@wow-addon/xml-parser` | Optional XML 1.0 syntax, namespace-aware names and decoded-value provenance, with pinned backends |
| `@wow-addon/xml-analysis` | Optional explicit-policy frame candidates, unresolved references and mapped inline bodies |

The core contains **no dependencies on VS Code, LuaLS or Continue**. Dependency boundaries are enforced in source and CI.

The five original core packages retain their dependency rules. The separately approved Lua extension depends on registry/diagnostics and exactly `luaparse@0.3.1`; providers need no TOC-adapter import. The approved XML extension depends on diagnostics and exactly `saxes@6.0.0` / `xmlchars@2.2.0`. See [the Lua profile and limits](docs/DESIGN-LUA-ANALYSIS.md) and [XML migration and limits](docs/MIGRATION-v0.4-to-v0.5.md).

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

v0.3.0 adds separate environment schema 1 and caller-owned logical/variant identity contracts. v0.3.1–0.3.3 provide explicit-policy selection, provenance and conservative evaluation. v0.3.4 composes them into a resolved view: known active names, selected declaration origins and active-only scope conflicts. Static APIs retain their behavior. Metadata remains schema 2; the original 30 beta exports are preserved (52 at core freeze, 56 with approved Lua profiles), and no built-in WoW-loader policy is inferred. See [core migration](docs/MIGRATION-v0.2-to-v0.3.md), [Lua migration](docs/MIGRATION-v0.3-to-v0.4.md), [selection](docs/DESIGN-v0.3.1.md), [provenance](docs/DESIGN-v0.3.2.md), [evaluation](docs/DESIGN-v0.3.3.md) and [resolution design](docs/DESIGN-v0.3.4.md). For optional read-only installed-AddOn checks, see [local corpus testing](docs/LOCAL-CORPUS-TESTING.md). The [pre-freeze review](docs/PRE-FREEZE-REVIEW.md), [surface inventory](docs/PUBLIC-SURFACE.md) and [detailed plan](docs/EXECUTION-v0.3.5.md) record acceptance and remaining actual Lua/XML work.

The [v0.3.5 acceptance record](docs/RELEASE-READINESS-v0.3.5.md) maps the integrated five-package core freeze to implementation, review and CI gates. v0.4.0 adds three approved Lua beta exports (55 at that milestone), retaining metadata/environment/result schemas. `analyzeLua(text, sourcePath, { addonId })` returns declarations/diagnostics without exposing a backend AST or executing Lua. Direct chunk bindings differ from runtime-unknown flow/function assignments; dynamic environment access stays incomplete. This does not complete the broader three-parser project goal.

v0.4.1 adds the explicitly approved [corpus profile](docs/DESIGN-LUA-CORPUS-PROFILE.md). `profile: 'corpus'` selects larger fixed limits, and `allowShebang: true` enables equal-width header preprocessing. Both are opt-in. The local `--lua-input-profile corpus-files` preset also labels byte-preserving transport for BOM-free invalid UTF-8; it does not infer intended Unicode or execute source. Direct SDK callers own process/stack/heap/deadline supervision. That milestone had 56 beta exports; core schemas and the pinned Lua backend remain unchanged.

v0.5.0 implements the explicitly approved XML A–F syntax increment. `parseXml(text, sourcePath)` returns schema 1 with flat preorder elements, original-order text, namespace-aware names and decoded-value mappings to original UTF-16 ranges. DTDs and XML 1.1 are rejected; failures return empty projections and fixed diagnostics. Namespace constraints are enabled by default; the SDK alone permits explicit `{ namespaceAware: false }`. No source is executed or referenced file fetched. The seven-package surface has 65 beta exports (14 runtime and 51 type-only). The local `--xml-analysis` opt-in uses strict UTF-8 with BOM retention, bounded reads and a supervised worker; aggregate syntax verdicts remain separate from blocked work. See [XML migration](docs/MIGRATION-v0.4-to-v0.5.md) for limits and remaining acceptance boundaries.

v0.6.0 adds the approved explicit-policy XML fact provider. `analyzeXml(text, sourcePath, {addonId,policy})` returns candidate frames, unknown declarations, unresolved Script/Include references and inline chunk/handler bodies mapped to original source. It adds eight beta exports (73 overall across eight packages), depending only on xml-parser, diagnostics and global-registry. The provider itself does not invoke Lua analysis or traverse references. See [migration](docs/MIGRATION-v0.5-to-v0.6.md) and [what a profile means](docs/XML-PROVIDER-PROFILES.md).

v0.7.0 implements approved inline Lua A–E: explicit chunk/function-body contexts in `analyzeLua`, `mapXmlValueRanges` with disjoint original-source sidecars, and opt-in supervised corpus composition under a separate context profile. Parameters are explicit locals; handler signatures are never inferred. Existing 73 exports remain; five additive beta exports bring the eight-package surface to 78 (16 runtime, 62 type-only). See [migration and runnable example](docs/MIGRATION-v0.6-to-v0.7.md). Actual installed inline-context acceptance remains separate from the earlier XML provider inventory; selected-source traversal is still open.

## Non-goals (v0.7.0)

This release does **not**:

- Interpret Blizzard FrameXML semantics or prove the Classic Era runtime dialect from an XML/Lua grammar profile.
- Infer active XML globals or resolve the actual loader reference graph. Unknown frame candidates and three syntax parsers do not establish full AddOn parsing or active-source reachability.
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
| `0.4.x` | Approved Lua syntax/provider analysis and actual local corpus tests |
| `0.5.0` | Approved XML syntax and original-source decoded mappings; opt-in read-only corpus transport |
| `0.6.0` | Approved explicit-policy XML fact provider and mapped inline bodies |
| `0.7.0` | Explicit inline Lua contexts, disjoint source mapping and opt-in corpus composition |
| Later analysis/adapters | Selected-source reference graph, remaining XML domains and LuaLS integration |
| `1.0.0` | **Consumer API Stability**, SemVer guarantees |

An architectural freeze in `0.3.5` **is not** a promise of stable public APIs. See [API Policy](docs/API-POLICY.md) and [v0.3.5 roadmap](docs/ROADMAP-v0.3.5.md).

## Contributing and licensing

The repository root is marked `"private": true` in `package.json` **only to prevent accidental npm publication of the monorepo root**. The GitHub repository is public; this field does not control GitHub visibility.

The SDK source code is distributed under the [MIT License](LICENSE). Each independently publishable workspace includes an identical MIT `LICENSE` in its npm tarball and declares `"license": "MIT"`. Please read [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md), and [Licensing and Third-Party Content](docs/LICENSING-AND-THIRD-PARTY.md).

*World of Warcraft* and related names are trademarks of Blizzard Entertainment. This independent community project is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment.
