# Arkitektur – WoW AddOn SDK v0.3.0

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
4. `packages/*/api-extractor.json` og `packages/*/etc/*.api.md` – obligatorisk strict API Extractor i CI, med versionerede rapporter. Lokal regenerering kræver eksplicit review.
5. `scripts/check-public-exports.mjs` – kontrollerer package-exports og identiske MIT-licenser i alle fem publishable workspaces.
6. `scripts/check-package-contents.mjs` – afviser manglende/uventede filer i npm's faktiske dry-run-liste.

v0.3.0 tilføjer fire beta-kontrakter i `addon-metadata`: separat environment-schema 1, klientmiljø samt logisk og præcis TOC-variantidentitet. Metadata-schema 2 og parser/registry-adfærd bevares. Se [migration](MIGRATION-v0.2-to-v0.3.md).

Den valgfrie `scripts/inspect-addon-corpus.mjs` er lokal tooling uden for core. Den læser TOC-filer, kontrollerer kildepositioner og viser aggregerede diagnostics; Lua/XML optælles som endnu ikke implementerede parsere. Den tilføjer ingen filesystem-afhængighed til SDK-pakkerne.

## Syntaks, semantik, registry

`parseToc(text, path)` returnerer en AST-lignende `entries`-liste, `AddOnMetadata` og parse-diagnostics. `AddOnMetadata.savedVariableDeclarations` bevarer oprindelse og `InlineCondition[]`.

`toGlobalDeclarations([metadata])` producerer globale SavedVariables med `activationState: 'unconditional' | 'conditional'`. Der forsøges **ikke** klientbetingelsesevaluering. Forbrugere kan selv levere `activationState: 'unknown'` til `buildGlobalRegistry`.

Registry deduplikerer ved `name` for lookup, men bevarer alle deklarationer med `source`, `addonId`, `kind` og `scope`. `addonId` fra TOC-adapteren er TOC-stien, så forskellige klientvarianter ikke fejlagtigt får samme ID før aktiv-TOC-valg er implementeret. Registry advarer `SV0001` ved uforenelige SavedVariables-scopes inden for samme `addonId`.

`listGlobals()` eksponerer kun ubetingede globals. Vælg `includeConditional` eller `includeUnknown` eksplicit, når det er sikkert for forbrugeren.

## Diagnostics og positioner

`SourceRange = {start:{line,column},end:{line,column}}`. Positioner er 0-baserede UTF-16-kodeenheder, slutposition er eksklusiv. `Diagnostic.code` er stabil, mens `message` må lokaliseres. Koden definerer ikke VS Code CodeActions, QuickFixes eller editorafhængigheder.

## Roadmap

- **0.2.0:** diagnostics, global-registry, toc-metadata-adapter, arkitekturgates og API snapshots.
- **0.3.0:** client environment og logisk AddOn-identitet.
- **0.3.1:** aktiv TOC-variantvalg før condition evaluation.
- **0.3.2:** provider-neutral condition provenance.
- **0.3.3:** tri-state condition evaluation uden mutation.
- **0.3.4:** resolved global availability uden læk fra ikke-valgte TOC-varianter.
- **0.3.5:** Architectural Freeze – reviewed API, migrations, release- og licensing-gates. Se [roadmap](ROADMAP-v0.3.5.md).
- **0.4.0:** LuaLS adapter efter contract freeze.
- **0.5.x:** XML/Lua parser, Reference Graph.
- **1.0.0:** Consumer Stability – eksplicitte kompatibilitetsgarantier; major-version ved breaking changes.

## JavaScript/TypeScript ABI

`addon-metadata` er JSON-serialiserbar, men `SourceRange` JSON-struktur er ændret i v0.2.0. `METADATA_SCHEMA_VERSION = 2` identificerer det nye serialiserede SourceRange-format. Payloads fra v0.1 kræver migration til det nye format.
