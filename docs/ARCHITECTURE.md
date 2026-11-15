# Arkitektur – WoW AddOn SDK v0.2.0

## Afhængighedsregler

```text
@wow-addon/diagnostics                  # independent
      ↑                 ↑
addon-metadata      global-registry      # siblings: no mutual dependencies
      ↑                 ↑
  toc-parser            |                # never imports registry
      \                 /
       toc-metadata-adapter              # official bridge, imports metadata+registry+diagnostics
```

`toc-parser` bruger `diagnostics` og `addon-metadata`. Registry bruger kun `diagnostics`. `toc-metadata-adapter` oversætter metadata til `GlobalDeclaration[]` og kan kalde `buildGlobalRegistry` som convenience.

Arkitekturen beskyttes af:

1. `scripts/check-architecture.mjs` – scanner TypeScript AST-imports, manifest og tsconfig-references, forhindrer cykler/ulovlige afhængigheder. Kører også offline med installeret TypeScript.
2. `.dependency-cruiser.cjs` – sekundært graph-audit, kræver installeret dependency-cruiser.
3. `scripts/check-api-snapshots.mjs` – fail-closed sammenligning af kompileret API-kontrakt mod committed `.d.ts` baselines.
4. `packages/*/api-extractor.json` – fremtidig API Extractor-review med tracked rapporter; kræver første online-bootstrap.

## Syntaks, semantik, registry

`parseToc(text, path)` returnerer en AST-lignende `entries`-liste, `AddOnMetadata` og parse-diagnostics. `AddOnMetadata.savedVariableDeclarations` bevarer oprindelse og `InlineCondition[]`.

`toGlobalDeclarations([metadata])` producerer globale SavedVariables med `activationState: 'unconditional' | 'conditional'`. Der forsøges **ikke** klientbetingelsesevaluering. Forbrugere kan selv levere `activationState: 'unknown'` til `buildGlobalRegistry`.

Registry deduplikerer ved `name` for lookup, men bevarer alle deklarationer med `source`, `addonId`, `kind` og `scope`. `addonId` fra TOC-adapteren er TOC-stien, så forskellige klientvarianter ikke fejlagtigt får samme ID før aktiv-TOC-valg er implementeret. Registry advarer `SV0001` ved uforenelige SavedVariables-scopes inden for samme `addonId`.

`listGlobals()` eksponerer kun ubetingede globals. Vælg `includeConditional` eller `includeUnknown` eksplicit, når det er sikkert for forbrugeren.

## Diagnostics og positioner

`SourceRange = {start:{line,column},end:{line,column}}`. Positioner er 0-baserede UTF-16-kodeenheder, slutposition er eksklusiv. `Diagnostic.code` er stabil, mens `message` må lokaliseres. Koden definerer ikke VS Code CodeActions, QuickFixes eller editorafhængigheder.

## Roadmap

- **0.2.0:** diagnostics, global-registry, toc-metadata-adapter, arkitekturgates og API snapshots.
- **0.3.0:** conditions normalization og evaluation, klient-/TOC resolution.
- **0.3.5:** Architectural Stability – reviewed API reports, migration docs, dependency- og export-audit.
- **0.4.0:** LuaLS adapter efter contract freeze.
- **0.5.x:** XML/Lua parser, Reference Graph.
- **1.0.0:** Consumer Stability – eksplicitte kompatibilitetsgarantier; major-version ved breaking changes.

## JavaScript/TypeScript ABI

`addon-metadata` er JSON-serialiserbar, men `SourceRange` JSON-struktur er ændret i v0.2.0. `METADATA_SCHEMA_VERSION = 2` identificerer det nye serialiserede SourceRange-format. Payloads fra v0.1 kræver migration til det nye format.
