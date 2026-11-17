# Changelog

Changes are recorded by release. This project is in pre-1.0 development.

## [Unreleased]

### Corpus tooling follow-up (issue #26; SDK contracts unchanged)

- Add per-file TOC discovery/read/parser/invariant accounting and Lua invariant/discovery counters. Stage all TOC/Lua projection metrics until validation completes, so malformed late records cannot retain parsed, diagnostic, declaration or activation credit.
- Replace TOC stat-then-readFileSync with a bounded read-only descriptor helper, exact bigint identity/times, growth/replacement detection, final pathname checks and deterministic descriptor cleanup. Use nonblocking open where supported to reject FIFO substitution.
- Add isolated real-SDK projection/read-error integration cases and native file-race tests. The Linux FIFO case has a bounded child and is explicitly skipped on Windows; supported-platform acceptance is recorded with exact CI evidence in the focused PR. Public SDK packages, versions, APIs and payloads are unchanged.

### v0.5.0 XML syntax and original provenance (source version; not published)

- Add the approved optional xml-parser package with nine beta exports (65 overall), exact saxes 6.0.0 / xmlchars 2.2.0 pins and complete retained notices. Preserve all six earlier API contracts/reports and 82 unrelated external lock records.
- Parse XML 1.0 with default namespace constraints into independent flat elements, ordered attributes/text and decoded values mapped to original BOM/line-ending/UTF-16 spans. Reject DTD/XML 1.1, malformed input and fixed resource-limit violations without exposing prefix projections or executing source.
- Add fixed supervised XML workers and explicit read-only --xml-analysis corpus support, separating actual verdicts from transport/resource/worker blocks and checking original sources/mappings/hash equality.
- Verify 296 tests plus architecture, dependencies, snapshots, strict API Extractor, backend/license hashes and actual seven-package payloads. Actual XML corpus: all 1,199 files receive verdicts, 1,146 accepts / 53 explained syntax/namespace rejections, zero blocked files or invariant failures and unchanged hashes. The full command remains failed; XML providers, inline Lua and selected-source traversal remain open in #11. See the dated XML review and PR #25 for exact-head supported CI/review acceptance.

### v0.4.1 opt-in Lua corpus profile (source version; not published)

- Add the approved LuaAnalysisProfile beta type and readonly profile/allowShebang options, preserving the bounded default and original five core APIs. Total: 56 beta exports, no new dependency or schema.
- Add fixed larger input/node/depth limits, explicit equal-width hashbang handling, supervised parser thread with 8 MiB stack and separate corpus deadline/heap/output budgets.
- Add explicit corpus-files CLI transport with strict UTF-8 first, BOM-guarded byte preservation, decode counters, failed-coverage accounting and unchanged original files. Dynamic uncertainty and absent XML/reference integration remain visible.
- Add focused input/node/loader/type/default/transport/worker regressions and native small-budget thread heap-exhaustion cleanup. Final corpus/CI evidence is linked from #11 and the implementation PR.

### v0.4.0 actual Lua syntax/provider preview (source version; not published)

- Add the approved optional lua-analysis package with three beta exports (55 overall), internal syntax/provider separation and the exact reviewed MIT luaparse 0.3.1 dependency. Existing five core runtime dependency directions and API shapes remain unchanged.
- Parse the explicit Lua 5.1/BOM/UTF-16/resource profile without executing input. Extract exact lexical assignments/functions, exclude locals/members, copy inherited restrictions and retain unknown flow/dynamic-environment behavior.
- Correct two verified backend Lua 5.1 defects using token-based equal-width parse adaptation: optional break semicolons and multiline literal-call chaining. Preserve negative grammar guards, original source positions and unchanged upstream source/license bytes.
- Validate inherited conditions, initialize lexer token state between inputs and correct backend loop-header scope annotations in a bounded source-order walk. Seven review regression groups cover fresh-process error determinism and lexical scope boundaries.
- Add API/catalog/scope/resource/ownership/real-provider-composition tests, bounded persistent worker supervision and opt-in private corpus reporting. All 207 integrated tests and strict architecture/API/hash/package gates pass locally; final supported CI is recorded in the implementation PR.
- Actual corpus: 5,242 Lua files considered, 5,105 syntax accepts / one explicit-profile rejection, 136 encoding/budget blocks and zero worker/read/backend failures. All failures remain visible. XML/reference graph and overall three-parser acceptance remain open.
- Extend exact distribution assertions to five unchanged four-file core payloads plus the new six-file Lua payload; validate its sole external pin and installed backend source/license hashes. Preserve all existing third-party resolutions while adding the one approved dependency.

### v0.3.5 core architectural-freeze candidate (source version; not published)

- Advance all five workspaces/internal ranges and root/lock records to 0.3.5 without changing any of the 81 third-party dependency records.
- Map every core milestone criterion to reviewed source/contracts, regression tests, supported-platform gates and distribution evidence in the release-readiness record. Retain the five acyclic core boundaries and 52 beta exports.
- Keep actual Lua/XML parsing/providers/reference graph, built-in client policy verification and remaining strict-heading recovery explicit follow-ups. No tag, npm publication, consumer stability or clean full-corpus result is claimed.

### Pre-freeze review checkpoint

- Name and export the existing policy rule as beta `ConditionEvaluationRule` at the user's request (52 total exports); preserve structural fields, readonly restrictions, policy JSON and runtime behavior.
- Record every export's consumer purpose, exhaustive-union compatibility risks, evaluator placement rationale and remaining real-provider/dialect evidence. Correct stale static-vs-resolved wording.
- Record the user-selected solo-owner protection: PRs, four up-to-date required GitHub Actions checks and administrator enforcement; chat sign-off is distinct from a GitHub approving review.
- Classify all 19 remaining corpus errors as unsupported nonempty heading syntax, retain failures and extend authored strict-heading regressions without copying installed sources. No v0.3.5 freeze, source version bump, parser dependency or release publication is claimed by this checkpoint.

### v0.3.4 composed resolved globals (source version; not published)

- Add the six approved resolver contracts/function in the existing adapter leaf (51 beta exports total), with independent resolved-result schema 1 and unchanged metadata/environment schemas 2/1.
- Select exact TOC variants before consuming their metadata/provider declarations. Preserve logical/variant/provider/original identity and deep provenance copies; expose known active names separately from unchanged static activation flags.
- Retain selected inactive/unknown entries and explicit partial completeness. Validate root/association/selected projections, exclude invalid groups and emit SV0001 only for known-active coexisting declarations under logical IDs.
- Add type/identity/selection/provider/conflict/mutation/invalid-shape regressions and a bounded opt-in composed corpus profile. Retain original TOC errors and Lua/XML parser absence.

### v0.3.3 conservative condition evaluation (source version; not published)

- Add the approved neutral ResolvedAvailability type and four adapter exports for explicit-policy condition evaluation (45 beta exports total). Preserve five package boundaries and metadata/environment schemas 2/1.
- Match provider/name pairs and caller-defined include/exclude comparisons, OR arguments within each rule and combine valid conditional outcomes with conservative AND. Unknown/empty/malformed provenance never activates; structural invalidity and unknown static activation take precedence.
- Return fixed issue codes/reasons and independent canonical source copies without mutating static registry records or interpreting raw syntax. No built-in WoW condition table is introduced.
- Add type/truth-table/validation/mutation/provider-isolation regressions and optional bounded condition-profile corpus checks. Unknown outcomes remain visible and fail that opt-in check; counts do not establish resolved visibility.

### v0.3.2 condition provenance (source version; not published)

- Add the approved provider-neutral `ConditionDescriptor` beta export and optional readonly `GlobalDeclaration.conditions` field (40 exports total). Keep metadata schema 2, environment schema 1 and the existing five dependency boundaries.
- Preserve TOC condition provider identity, name/value order, raw spelling and exact UTF-16 source spans in independent adapter copies. Empty lists omit the new property; legacy declarations without provenance remain accepted.
- Keep static activation/listing, TOC-path identity, registry reference retention and SV0001 behavior unchanged. Missing/empty provenance never establishes condition truth.
- Add type, range, duplicate, mutation-isolation, opaque-provider and malformed-header regressions. The read-only corpus runner verifies adapter-copy/JSON invariants and reports only aggregate declaration/descriptor counts.

### v0.3.1 explicit-policy selection (source version; not published)

- Add the approved pure `selectTocVariant` seam and four beta contracts in `toc-metadata-adapter` (39 exports total). Apply caller-supplied versioned priorities and exact optional applicability constraints without inventing a built-in game-loader policy.
- Validate identity/source projections, exact unsuffixed fallback, unknown environments, invalid records and duplicate IDs; report canonical ambiguity/unresolved issues without mutating inputs or static registry behavior.
- Add type contracts and behavior regressions for permutation invariance, case/Unicode/paths, malformed policies/sources, sparse lists, exact constraints and copied issue provenance. Metadata remains schema 2; environment remains schema 1.
- Add opt-in aggregate corpus selection profiles for immediate-folder TOCs, with configuration limits and source-read gating. The example policy selects 98 of 100 local groups without hiding existing TOC diagnostics or claiming game-loader conformance.

### Client selection evidence tooling

- Add a staging-only generator for eight synthetic TOC-selection/comment scenarios with distinct local Lua markers, MIT licenses and a final hashed manifest. Refuse existing outputs and resolved AddOns paths; installation and runtime observations remain separate user actions.
- Add five integration checks for deterministic generated content, references, input validation and output preservation. No built-in loader policy or runtime conformance is inferred.

### TOC corpus fidelity follow-up

- Recognize empty hash-only separators as comments, preserving original raw text and UTF-16 ranges.
- Accept dotted custom `X-` metadata names while preserving duplicate spelling/value provenance and condition ranges. Ordinary dotted names and malformed annotations remain errors.
- Add six focused regression cases. The same local 434-TOC corpus reduces TOC0001 diagnostics from 194 to 19, with 347 SavedVariable declarations unchanged; the run remains failed on outstanding findings and Lua/XML remain inventory-only.

### v0.3.0 contract foundation (source version; not published)

- Add approved client-environment schema 1, explicit unknown fields, caller-owned logical AddOn identity and exact TOC-variant identity. Preserve metadata schema 2 and the previous 30 beta exports; four additive beta exports bring the total to 34.
- Add positive/negative TypeScript contract tests and runtime compatibility/identity examples.
- Add a bounded read-only local TOC corpus runner with source-range/JSON checks, aggregate-only output and explicit unimplemented Lua/XML status. Record the actual installed-corpus diagnostics rather than declaring a false pass.
- Use locked PowerShell installs, enforce Node 22+, check native exit statuses and run strict API/package gates.
- Assert actual npm dry-run file lists and reject extra assets or missing licenses in all five packages.
- Add migration guidance, complete repository review coverage and a detailed execution plan through v0.3.5 and subsequent TOC/Lua/XML parsing.

### Repository hardening (merged in PR #5)

- Test Node 22 and 24 on both Windows and Linux; retire EOL Node 20.
- Discover tests deterministically and fail if no test files are found.
- Make build explicit in the validation pipeline and audit public package entry points.
- Normalize source line endings and document portable quick-start commands.
- Committed the reviewed npm 10.9.2 lockfile; CI installs reproducibly with `npm ci` on Windows/Ubuntu and Node 22/24.
- Reviewed 30 `@beta` exports, preserved their TSDoc descriptions, and committed five API reports with declaration baselines.
- Made strict API Extractor and npm package validation mandatory CI gates.
- Added identical MIT `LICENSE` files to five publishable workspaces and license-consistency validation.


### Review follow-up

- Fix TOC0001 end positions after recognized header conditions are removed.
- Allow static `import(specifier, options)` without bypassing architecture rules; `require()` retains a single-argument restriction.
- Add six regression tests without changing the public TypeScript API.


### Fixed

- Reject unknown or malformed TOC header conditions instead of exposing globals unconditionally (TOC0001).
- Correct diagnostic spans for trailing empty and whitespace-only CSV cells (TOC0004).
- Detect forbidden TypeScript import type references and reject non-static module loads in architecture checks (ARCH0001).
- Use Node test discovery without shell globbing; add Windows/Node 20 CI coverage.

- Planned: client/TOC selection, condition provenance, tri-state evaluation and resolved global views through [v0.3.5 roadmap #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) and [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6).
- Under review: separating provider `GlobalDeclaration` input from consolidated `GlobalSymbol` output; not yet implemented in the v0.2.0 API.

## [0.2.0] - 2026-11-15

- Added standalone `@wow-addon/diagnostics` package with UTF-16 `SourcePosition` and `SourceRange`.
- Added `@wow-addon/global-registry` and `@wow-addon/toc-metadata-adapter`.
- Renamed/decoupled `savedvariables-registry` as part of the provider-neutral registry design.
- Added stable diagnostic codes and contract migration notes.
- Added source import-boundary audits, dependency-cruiser configuration, API declaration snapshots, tests and CI.
- **Breaking:** `SourceRange` changed from flat coordinates to `{start:{line,column},end:{line,column}}`.

## [0.1.0] - 2026-11-15

- Initial prototype: TOC parser, metadata model and SavedVariables registry.

[Unreleased]: https://github.com/Zilvereyes/wow-addon-sdk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Zilvereyes/wow-addon-sdk/releases/tag/v0.2.0
[0.1.0]: https://github.com/Zilvereyes/wow-addon-sdk/releases/tag/v0.1.0
