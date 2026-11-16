# Local AddOn corpus testing

The runner reads an explicitly supplied local directory. It discovers every TOC variant, including library/test manifests; it does not infer which are loaded by the client. Default mode inventories Lua/XML. The explicit `--lua-analysis` flag invokes the actual Lua SDK parser/provider in a bounded worker; XML remains unimplemented. No input code is executed, written back, copied or uploaded from that directory.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>'
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>' --lua-analysis
# Full-parser acceptance must still fail while XML is unimplemented:
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>' --require-all-parsers
```

`scripts/Test-WoWAddonCore.ps1 -AddOnsPath '<directory>'` first runs the SDK gates and then this optional local check. `-SkipInstall` reuses the current installation. Node 22+ and PowerShell 7 are required for that wrapper; CI uses Node 22/24 and npm 10.9.2.

## What is checked

1. Enumerate deterministically; skip file/directory links and junctions, reporting incomplete coverage.
2. Read regular `.toc` files only, case-insensitive extension matching. Do not follow paths referenced inside TOCs.
3. Parse via the public `parseToc()` API, retain every variant and count diagnostics by code/severity.
4. Assert metadata schema 2, exact TOC identity, JSON roundtrip and bounds/order of all source references, including conditions and related diagnostics.
   The v0.3.2 adapter check also verifies derived declaration JSON, absence of empty provenance, exact descriptor fields and independent copies of condition values/ranges; it leaves the parser-reference visit counter unchanged.
5. Emit aggregate JSON only: no absolute/relative paths, AddOn names, source text, variable names or diagnostic messages.
6. Distinguish a passing TOC smoke test from full parsing. `parsed.lua` and `parsed.xml` remain zero and `fullParsing` remains false.

Limits default to 100,000 visited entries, 8 MiB per TOC and depth 64. Override the first two with positive safe integers using `--max-entries N` and `--max-file-bytes N`. A limit, read failure or invariant failure produces incomplete coverage and nonzero exit; it cannot silently pass. Run against a stable installation without simultaneous file changes. Enumeration is bounded, but this is not a hostile-filesystem sandbox or a game loader emulator.

| Exit | Meaning |
| --- | --- |
| 0 | All discovered TOCs processed; no parser errors or incomplete coverage. Warnings may remain. Lua/XML still unimplemented. |
| 1 | Parser errors, invariant/read failures, incomplete coverage, zero parsed TOCs, invalid root, or requested parsers unavailable |
| 2 | Invalid command-line arguments |

Synthetic tests cover BOM/mixed endings/Unicode, multiple variants, source privacy, no execution, unchanged file content, malformed TOCs, links, empty/missing roots and limits. CI uses only authored temporary fixtures. A smoke test is not an independent correctness oracle for every parsed declaration; targeted regressions remain necessary.

## Measured baseline: 2026-11-16

The local installed Classic Era corpus contained 101 top-level AddOn directories and 12,714 visited entries:

| Measurement | Result |
| --- | --- |
| TOC files parsed | 434 / 434 |
| Lua files inventoried / parsed | 5,242 / 0 |
| XML files inventoried / parsed | 1,199 / 0 |
| Source references checked | 51,673 |
| SavedVariable declarations retained | 347 |
| Skipped links / oversized TOCs | 0 / 0 |
| TOC0001 errors / TOC0004 warnings | 194 / 12 |
| Exit/status | 1 / failed due to parser diagnostics |

No parser crash, JSON or range assertion failed. Of the 194 malformed-directive diagnostics, 193 concern bare `##` lines or human section headings without colons; one concerns a dotted custom directive name. These are **compatibility candidates**, not proof that the installed AddOns are broken. Investigate them with independent synthetic examples and documented syntax before changing parser behavior. Do not waive errors or rewrite third-party manifests to make the run green.

Only aggregate counts are suitable for the public issue/PR. Keep the installation path and any detailed local source inspection private. The follow-up plan separates TOC fidelity, Lua syntax, XML syntax, reference traversal and loader/runtime behavior.

## Focused TOC fidelity follow-up: 2026-11-16

The next isolated patch recognizes empty hash-only separators as comments and permits dotted names in the custom `X-` namespace. It retains strict errors for nonempty double-hash annotations, malformed conditions and dotted ordinary directive names. The local library's producer/consumer pair independently demonstrated use of a dotted custom metadata key; the tests use newly authored `X-Fixture-2.7` examples rather than copied library content.

| Measurement | Original baseline | Focused fix |
| --- | --- | --- |
| TOCs processed | 434 | 434 |
| Source references checked | 51,673 | 51,501 |
| SavedVariable declarations | 347 | 347 |
| TOC0001 errors | 194 | 19 |
| TOC0004 warnings | 12 | 12 |
| Skipped links / oversized TOCs | 0 / 0 | 0 / 0 |
| Exit/status | 1 / failed | 1 / failed |

The changed source-reference count reflects removed error diagnostics for comments and the newly retained custom directive; the runner traverses references in both entries and diagnostics, so this count is not a unique-source total. All range/JSON invariants still passed. Lua/XML inventory and unimplemented parser status remain unchanged.

## v0.3.2 adapter-provenance check: 2026-11-16

The same read-only corpus run processed all 434 TOCs and 347 valid adapter declarations. **Zero SavedVariable condition descriptors** occurred in this installed corpus. Therefore the real corpus checks legacy/unconditional compatibility and aggregate copy invariants, while the authored synthetic tests provide the actual nonempty-condition/copy coverage. File/directive conditions are a separate parser capability and are not projected into SavedVariable declarations merely to increase this count.

The 51,501 parser-reference visits, 19 TOC0001 errors, 12 TOC0004 warnings and zero skipped links/oversized TOCs remain unchanged. The optional caller profile still reports 100 groups / 227 candidates: 98 selected, two no-match and zero invalid/unresolved/ambiguous groups. Exit 1 remains for the TOC diagnostics. Lua/XML inventory remains 5,242 / 1,199, with zero parsed in either language.

New `adapterDeclarations` and `conditionDescriptors` counters contain aggregate counts only. The checks do not establish condition truth, in-game loader conformance, Lua/XML parsing or resolved global visibility.

The 19 remaining errors concern nonempty human headings. Primary upstream TOCs show this practice in [Skillet](https://github.com/b-morgan/Skillet/blob/master/Skillet.toc) and [MobInfo3](https://github.com/solocommand/MobInfo3/blob/master/MobInfo2.toc). These source examples establish real author usage; they do not independently prove every client loader rule. Broader comment recovery needs a separate explicit policy and regressions preserving malformed-SavedVariables safety. This focused patch does not claim full TOC conformance.

## Optional v0.3.1 selection profile

```powershell
npm run test:corpus -- '<local-AddOns-directory>' --selection-profile examples/classic-era-selection-profile.json
```

The example is an explicitly supplied caller policy, not a verified built-in WoW-loader table. A profile contains `environment` and `policy` records accepted by `selectTocVariant`. Profile files are limited to 1 MiB. Malformed/unresolved profiles fail before corpus traversal; repeated profile arguments are rejected. The default run omits selection entirely.

The tooling groups only immediate `<AddOns>/<folder>/*.toc` candidates by the exact folder basename and supplies scoped logical IDs. Embedded/nested library manifests stay in the complete TOC parse inventory but are not treated as independent loader AddOns. Unknown filenames are not automatically promoted to unsuffixed fallback. A valid run with no immediate-folder groups fails explicitly; per-group no-match is a normal result.

Only counts of groups/candidates/statuses and issue codes are added to the report. Selected paths/IDs, profile values and source text remain private. The runner asserts candidate JSON is unchanged after selection. Selection never waives existing parse errors or asserts resolved global availability.

On the same measured local corpus, the authored example profile processed **100 groups / 227 immediate-folder candidates**: **98 selected, 2 no-match, 0 unresolved/ambiguous/invalid**. All 434 TOCs were still parsed, including nested manifests, with the existing 19 errors and 12 warnings. Exit remained **1**. These are outcomes under the explicit example policy, not observations of the game loader. Lua/XML remain unparsed.

Directory enumeration checks remaining budget before opening a directory and reads incrementally. An over-budget directory is rejected before processing an unordered subset; incomplete coverage cannot become a successful run.

## Optional v0.3.3 condition profile

```powershell
npm run test:corpus -- '<local-AddOns-directory>' --condition-profile examples/classic-era-condition-profile.json
```

The JSON profile contains `environment` and `policy` accepted by `evaluateGlobalConditions`. The authored example defines caller rules/casing and is not a verified game condition table. Profiles are limited to 1 MiB using bounded reads; malformed/unknown-context profiles fail before source traversal. Repeated/missing profile arguments are rejected. Default runs omit evaluation.

The runner evaluates every valid adapter declaration, retains JSON/input/range invariants and reports `conditionEvaluation` aggregate declaration/availability/issue-code counts only. Unknown results cause `condition-unknown` and nonzero exit; inactive results are valid evaluated outcomes. Original parser errors, incomplete reads and Lua/XML absence remain visible.

On the stable local corpus, all 347 adapter declarations are unconditional and report active under the authored profile, with zero inactive/unknown results or condition issues. There are still zero conditional SavedVariables: synthetic fixtures provide true/false/unknown condition coverage. All 434 TOCs, 51,501 parser-reference visits, 19 errors, 12 warnings and zero skips remain unchanged; exit stays 1. Lua/XML remain inventoried only.

Condition evaluation covers all supplied variants. The optional selection report is a separate inspection, even when both flags are supplied. These counts are not a resolved global list and cannot establish visibility of non-selected TOCs. The v0.3.4 resolver must compose the steps explicitly.

## Optional v0.3.4 composed resolution profile

```powershell
npm run test:corpus -- '<local-AddOns-directory>' --resolution-profile examples/classic-era-resolution-profile.json
```

The bounded JSON contains one environment plus explicit selectionPolicy and conditionPolicy. Both are validated before traversal. Immediate AddOn-folder candidates are passed through the public `resolveGlobalRegistry` API; nested manifests remain parse inventory. This mode supplies no Lua/XML provider records and does not parse those languages.

The runner verifies unchanged inputs, result schema/JSON, unique active names and every returned source range against the original parsed document lengths. It emits group/candidate/selection, selected declaration/availability, active-name, diagnostic and issue-code counts only. Empty immediate-folder groups and incomplete resolution fail explicitly; original TOC errors still fail even when availability is complete.

On the stable corpus: **100 groups / 227 candidates; 98 selected / two no-match; 160 selected declarations / 160 unique known-active globals**, zero inactive/unknown records, root/evaluation issues or scope warnings. All 160 are unconditional; synthetic tests establish conditional/partial/provider behavior. The earlier 347 count covers all parsed adapter declarations, including non-selected/nested manifests, and is not the active set.

All 434 TOCs, 51,501 parser-reference visits, 19 errors / 12 warnings and zero skips remain unchanged. The overall run retains exit 1 and fullParsing=false. Counts are outcomes under the caller's authored policies, not client-loader observations. SDK Lua/XML parsing and reference-graph reachability remain future acceptance work.

## Per-error pre-freeze triage

All 19 current TOC0001 errors were inspected individually in deterministic discovery order. Each is a nonempty double-hash section heading without a colon or SavedVariables header: seven decorated captions, one short plain caption, one decorated prose caption and ten multiword plain captions. They are classified as unsupported heading/recovery syntax; this does not establish defective third-party input or verified client-loader behavior. The [occurrence table](PRE-FREEZE-REVIEW.md#per-occurrence-toc-triage) accounts for all 19; a private host-local ledger retains source positions and file hashes without committing installed content. Authored strict-heading regressions retain rejection and no declaration leakage. Issue #10 remains open, and exit 1 is unchanged.

## Actual v0.4.0 Lua parsing/provider run

The opt-in flag uses the approved [Lua profile](DESIGN-LUA-ANALYSIS.md): strict UTF-8 with BOM retained, at most 1 Mi UTF-16 input units, 50,000 nodes and accepted AST depth 256, plus 128 MiB worker heap, ten-second request deadline and bounded protocol output. The five original core boundaries do not change. No Lua source is executed.

On the same 12,714-entry corpus, every one of **5,242 Lua files** was considered:

| Outcome | Files |
| --- | ---: |
| Syntax accepted by the actual SDK | 5,105 |
| Syntax rejected by explicit profile | 1 |
| Invalid UTF-8 | 4 |
| Input-unit/derived pre-read limit | 71 |
| Generic file byte limit | 7 |
| SDK node/depth/stack resource limit | 54 |
| Worker/read/backend failure | 0 |

There are 5,160 submitted/completed requests and **5,106 completed syntax verdicts**. The 136 encoding/budget-blocked files are not counted as parsed. Resource rejection totals 132 = 71 input-profile + seven oversized + 54 SDK resource failures. This is incomplete coverage, not a silent change of eligibility.

The accepted syntax contains 1,478 files with unsupported dynamic environment/code access, so their lexical projection remains incomplete. The provider returns **6,601 declaration occurrences**: 1,828 static unconditional, zero inherited-conditional and 4,773 unknown. There are 12,403 checked Lua source-reference visits, 364,114,631 input bytes read and no worker timeout/crash. Diagnostics are LUA0002 ×1, LUA0003 ×54 and LUA0004 ×5,747. These are not counts of unique active names or real inherited load restrictions; this pass supplies no graph-derived conditions.

The initial implementation rejected 90 syntax cases. Private per-file triage identified 88 manifestations of a pinned-backend `break;` defect and one multiline literal-call defect, both valid under Lua 5.1 primary grammar/source. Authored positive/negative tests now cover them; a lexer-based, equal-width parse copy corrects the defects without changing installed dependency bytes or original ranges. All 89 false syntax rejections disappear: 88 become accepted and one subsequently reaches the real resource cap. The sole remaining syntax rejection is the explicitly unsupported shebang profile; it is not classified as defective third-party game code.

The bounded private triage ledger retains only filenames/hashes/ranges/statuses, never input text, outside the repository. Its initial 225 blocked/rejected records reconcile with the first aggregate run. New authored cases are independently written; no installed snippets enter tests or GitHub. Both SDK and characterization use the same backend and are not independent native Lua/Classic Era oracles.

All **434 TOCs**, 51,501 TOC reference visits, 19 errors / 12 warnings and zero skipped links remain. Composed TOC resolution still reports 100 groups / 227 candidates / 98 selected / two no-matches / 160 selected active names, with no scope issues. Lua's resolvedProviderParticipation=false explicitly separates these counts: the filesystem graph has not associated Lua with selected TOCs. XML remains 1,199 inventoried / zero parsed. The whole run exits **1**, status incomplete, fullParsing=false; #10/#11 and the overall goal remain open.

After PR #22's inherited-condition, lexer-state and loop-header scope fixes, the entire read-only corpus run was repeated. All aggregate counts above match, including zero worker/read/backend failures and exit 1. Seven authored review regressions demonstrate the corrected cases; unchanged real-corpus totals are not presented as additional coverage.
