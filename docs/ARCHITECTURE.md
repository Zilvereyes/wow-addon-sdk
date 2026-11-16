# Arkitektur – WoW AddOn SDK v0.3.x

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

Den valgfrie `scripts/inspect-addon-corpus.mjs` er lokal tooling uden for core. Den læser TOC-filer og kan med `--lua-analysis` kalde den faktiske Lua-parser/provider i en overvåget worker. Kildepositioner og aggregerede diagnostics kontrolleres; XML er stadig ikke implementeret. Den tilføjer ingen filesystem-afhængighed til SDK-pakkerne.

v0.3.1 placerer den rene `selectTocVariant` og fire tilhørende kontrakter i `toc-metadata-adapter`, som allerede er den godkendte semantiske bro. Den bruger eksplicit caller-politik og returnerer et variant-ID med afledte issues; den ændrer ikke statisk metadata eller registry. Ingen ekstra pakker, loader-tabeller, filesystem-adgang eller reverse imports tilføjes. Se [det godkendte design](DESIGN-v0.3.1.md).

## Syntaks, semantik, registry

`parseToc(text, path)` returnerer en AST-lignende `entries`-liste, `AddOnMetadata` og parse-diagnostics. `AddOnMetadata.savedVariableDeclarations` bevarer oprindelse og `InlineCondition[]`.

`toGlobalDeclarations([metadata])` producerer globale SavedVariables med `activationState: 'unconditional' | 'conditional'`. Der forsøges **ikke** klientbetingelsesevaluering. Forbrugere kan selv levere `activationState: 'unknown'` til `buildGlobalRegistry`.

Registry deduplikerer ved `name` for lookup, men bevarer alle deklarationer med `source`, `addonId`, `kind` og `scope`. Den statiske TOC-adapter bruger fortsat TOC-stien som `addonId`. Den separate resolver vælger først variant og bruger logisk AddOn-ID på sine deklarationskopier. Registry advarer `SV0001` ved uforenelige SavedVariables-scopes inden for samme `addonId`; resolveren sender kun kendt aktive kopier til denne kontrol.

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
- **0.4.0:** godkendt Lua-analysepakke med faktisk parser/provider og lokale corpus-tests.
- **0.4.1:** godkendt opt-in Lua-corpusprofil med eksplicit byte-transport, hashbang-behandling og overvågede ressourcegrænser; standardprofilen er uændret.
- **Senere analyse/adapters:** XML-parser/provider, Reference Graph og LuaLS-integration.
- **1.0.0:** Consumer Stability – eksplicitte kompatibilitetsgarantier; major-version ved breaking changes.

## JavaScript/TypeScript ABI

v0.3.2 adds opaque `ConditionDescriptor` records and an optional declaration field inside `global-registry`, using its existing diagnostics dependency only. The TOC adapter supplies independent copies of condition arrays/values/source ranges; registry aggregation preserves supplied objects and never interprets provider grammar or condition truth. Static activation/listing and source identities are unchanged. See [condition design](DESIGN-v0.3.2.md) for absence and ownership semantics.

v0.3.3 keeps the neutral `ResolvedAvailability` type in global-registry and the environment-aware evaluator in the existing adapter leaf. It derives availability under explicit caller comparisons without adding environment state to static records, importing metadata into the registry or creating a new package edge. The [evaluation design](DESIGN-v0.3.3.md) defines unknown/failure handling and conservative combination. v0.3.4 composes this with selection before creating a resolved global view.

v0.3.4's [resolver](DESIGN-v0.3.4.md) lives in that same leaf: select exact source variants, consume selected metadata/associated provider projections, copy declarations under caller logical IDs, evaluate them and derive activeGlobals. Static activation/provenance stays distinct from evaluation. Only known-active copied records feed existing registry conflict checks; no reverse import, filesystem dependency or parser package is added. The new result schema 1 is separate from metadata schema 2.

The [pre-freeze review](PRE-FREEZE-REVIEW.md) records why evaluator/orchestration placement is retained: a provider can produce registry contracts without importing the orchestration leaf. An external caller composes providers and resolver; a neutral orchestration package remains an explicit future design choice. Naming ConditionEvaluationRule changes no edge or runtime behavior. Every export remains beta; [the surface inventory](PUBLIC-SURFACE.md) identifies the 52 core contracts and four approved Lua additions (56 overall).

The approved [v0.4.0 Lua extension](DESIGN-LUA-ANALYSIS.md) now exercises that producer boundary: lua-analysis imports only registry/diagnostics types plus pinned luaparse 0.3.1; it never imports metadata, TOC parser or adapter. The original five-package core graph stays unchanged. Internal syntax and lexical-provider modules are distinct; only three root beta exports are added (55 overall). Actual parsed Lua + TOC declaration composition is tested in the external caller. Real filesystem graph/selected-file reachability and XML remain unimplemented. Source/license hashes and the sole allowed external manifest/import edge are enforced by repository tooling.

The approved [v0.4.1 corpus profile](DESIGN-LUA-CORPUS-PROFILE.md) adds the fourth Lua type and optional fields without a new package edge or dependency. Node child/thread supervision and file transport stay in tooling; the SDK remains pure. [Actual syntax verdicts and remaining limitations](LOCAL-CORPUS-TESTING.md#approved-v041-corpus-files-profile) do not establish selected-source reachability or complete runtime availability. The [proposed XML increment](PROPOSAL-XML-SYNTAX.md) remains unapproved and adds no current package, export or dependency.

`addon-metadata` er JSON-serialiserbar, men `SourceRange` JSON-struktur er ændret i v0.2.0. `METADATA_SCHEMA_VERSION = 2` identificerer det nye serialiserede SourceRange-format. Payloads fra v0.1 kræver migration til det nye format.
