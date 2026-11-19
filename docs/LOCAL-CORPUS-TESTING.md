# Local AddOn corpus testing

The inventory runner reads an explicitly supplied local directory. It discovers every TOC variant, including library and test manifests. Client selection is reported when a corresponding policy is supplied. Default mode parses TOC and inventories Lua/XML. The explicit `--lua-analysis` flag runs bounded Lua parsing and provider projection. The separate `--xml-analysis` flag runs XML syntax and provenance parsing. With `--xml-analysis`, request XML provider or inline Lua analysis by supplying the corresponding `--xml-provider-profile` and `--xml-inline-lua-profile` options as described below. Input code remains local and read-only throughout.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>'
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>' --lua-analysis
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>' --xml-analysis
# Full acceptance remains failed until providers/reference traversal and diagnostics are accepted:
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>' --require-all-parsers
```

`scripts/Test-WoWAddonCore.ps1 -AddOnsPath '<directory>'` first runs the SDK gates and then this optional local check. `-SkipInstall` reuses the current installation. Node 22+ and PowerShell 7 are required for that wrapper; CI uses Node 22/24 and npm 10.9.2.

## What the default inventory run checks

1. Enumerate deterministically; skip file/directory links and junctions, reporting incomplete coverage.
2. Read regular `.toc` files with case-insensitive extension matching. TOC references are retained as data.
3. Parse via the public `parseToc()` API, retain every variant and count diagnostics by code/severity.
4. Assert metadata schema 2, exact TOC identity, JSON roundtrip and bounds/order of all source references, including conditions and related diagnostics.
   The v0.3.2 adapter check also verifies derived declaration JSON, absence of empty provenance, exact descriptor fields and independent copies of condition values/ranges; it leaves the parser-reference visit counter unchanged.
5. Emit aggregate JSON only: no absolute/relative paths, AddOn names, source text, variable names or diagnostic messages.
6. Distinguish a passing TOC smoke test from full parsing. `parsed.lua` and `parsed.xml` remain zero unless their respective opt-ins are supplied; `fullParsing` remains false.

Limits default to 100,000 visited entries, 8 MiB per TOC and depth 64. Override the first two with positive safe integers using `--max-entries N` and `--max-file-bytes N`. A limit, read failure or invariant failure produces incomplete coverage and nonzero exit; it cannot silently pass. Run against a stable installation without simultaneous file changes. Enumeration is bounded, but this is not a hostile-filesystem sandbox or a game loader emulator.

| Exit | Meaning |
| --- | --- |
| 0 | All discovered TOCs processed; no parser errors or incomplete coverage. Warnings may remain. Optional Lua/XML analysis runs only when explicitly enabled. |
| 1 | Parser errors, invariant/read failures, incomplete coverage, zero parsed TOCs, invalid root, or requested parsers unavailable |
| 2 | Invalid command-line arguments |

Synthetic tests cover BOM/mixed endings/Unicode, multiple variants, source privacy, no execution, unchanged file content, malformed TOCs, links, empty/missing roots and limits. CI uses only authored temporary fixtures. A smoke test is not an independent correctness oracle for every parsed declaration; targeted regressions remain necessary.

## Selected-source graph

`scripts/inspect-selected-addon-sources.mjs` is the separate runner for explicitly selected manifests and their Lua/XML references. It requires `--graph-profile`, `--resolution-profile`, `--xml-provider-profile` and `--xml-inline-lua-profile`. Its own [contract](PROPOSAL-SELECTED-SOURCE-GRAPH.md) defines traversal, source and directory verification, and aggregate reporting. [Issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11) records installed results and remaining acceptance work.

## Per-file failure accounting

The issue #26 tooling increment adds `tocAnalysis` without changing SDK contracts or the existing top-level `files`, `parsed`, diagnostics and skip fields. `discovered` counts classified regular TOCs, `attempted` counts read attempts, `submitted` counts parser calls and `completed` counts returned parser results. `accepted` and `rejected` count fully validated syntax verdicts; a TOC with warning diagnostics only is accepted, while any error makes it rejected. Read/backend/invariant failures and skipped oversized files never receive `parsed.toc` credit. Input bytes count successful bounded reads, including files whose later projection is rejected by an invariant.

| TOC field | Meaning |
| --- | --- |
| `discoveryComplete` | False when traversal is truncated, unreadable, skipped or blocked by preflight |
| `complete` | Requires complete discovery and no rejected or blocked TOC work |
| `skippedOversized` / `resourceRejected` | Initial file size exceeds the caller's byte cap; no source read or parser call |
| `readFailures` | Failed native read/close, changed file metadata/identity or incomplete bounded snapshot |
| `backendFailures` | Parser call throws before returning a result |
| `invariantFailures` | Returned projection fails schema/source/serialization/adapter validation |

Lua adds `invariantFailures` and `discoveryComplete`. A completed worker response is not automatically a parsed file: every declaration, source and diagnostic must validate before verdict, diagnostic, source-reference, activation or declaration metrics are committed. A malformed late declaration invalidates the whole file's projection rather than retaining earlier credit. TOC-derived metrics are staged the same way. Counts represent occurrences, not unique names.

TOC reads now use a read-only bounded descriptor helper. It allocates at most the initial size plus one sentinel byte, never more than the caller cap plus one; growth cannot enlarge the allocation or native read request. It checks bigint identity/size and nanosecond modification/change times before/after reading and rechecks the final pathname, then closes every owned descriptor. Final-component links and replacements are rejected. Nonblocking open is used where supported so a substituted FIFO can be rejected before a blocking open; the Linux-native case is tested in Ubuntu CI, with an explicit platform skip on Windows. See [Node's file-open constants](https://nodejs.org/api/fs.html#file-open-constants) and the [delivery plan/evidence](PLAN-CORPUS-ACCOUNTING.md).

These checks do not create an immutable filesystem snapshot or protect against every concurrent privileged writer/ancestor-junction change. Run against a stable local installation. TOC decoding remains the existing UTF-8 string conversion with replacement behavior; this tooling fix does not select a new codec policy or claim strict UTF-8 validation for TOCs. Lua's explicit transport/profile and XML's strict transport/profile remain unchanged. None of these observations establishes loader reachability or completes the provider/reference goal.

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

## Approved v0.4.1 corpus-files profile

The user approved [Lua corpus-profile A–E](DESIGN-LUA-CORPUS-PROFILE.md). The standard run above remains the bounded baseline. The expanded run is explicit:

```powershell
node scripts/inspect-addon-corpus.mjs '<AddOns-directory>' --lua-analysis --lua-input-profile corpus-files --max-file-bytes 33554432 --condition-profile examples/classic-era-condition-profile.json --resolution-profile examples/classic-era-resolution-profile.json
```

The complete run on source snapshot `57b52a3` considered/submitted/completed **all 5,242 Lua files** and obtained **5,242 syntax verdicts: 5,241 accepted / one rejected**. All 136 previous encoding/input/byte/node/depth/stack blocks are gone under this opt-in profile: zero skipped oversized Lua, encoding, resource, worker, read or backend failures. This does not change the standard profile or claim every input has valid syntax.

Transport counts are **5,238 strict UTF-8 / four explicitly byte-preserving**. Read input bytes total 485,315,420. There are 6,636 declaration occurrences: 1,830 static unconditional, zero inherited conditional and 4,806 unknown. Dynamic environment/code access leaves **1,531** lexical projections incomplete, with LUA0004 ×6,352; the remaining syntax diagnostic is LUA0002 ×1. Lua source-reference visits total 12,989. Byte transport does not assert intended Unicode or an editor's guessed columns.

The run still has all 434 TOCs, 51,501 TOC source-reference visits, 347 adapter declarations, zero actual condition descriptors, 19 TOC0001 errors and 12 TOC0004 warnings. Composed resolution stays TOC-only: 100 groups / 227 candidates / 98 selected / two no-matches / 160 active names, no resolution issues. Lua graph participation remains false; XML remains 1,199 inventoried / zero SDK-parsed. Exit remains **1**, status failed, fullParsing=false.

A subsequent corpus-only lifecycle fix makes replacement await failed-child close before starting a successor. A deterministic process-boundary regression failed with two launches before close and passes after the fix; native worker/heap/deadline checks are separate evidence. The full run above had zero worker failures and describes the earlier exact source snapshot.

Post-fix reanalysis on `4fab3ab` considered the 136 previously blocked files plus the old shebang rejection: **137 attempts, 136 syntax accepts, one syntax reject, zero resource/backend/worker failures**. The old shebang rejection now accepts. The remaining reject comes from one of the four byte-transferred inputs: a vararg expression in a non-variadic function. This is invalid under the approved Lua 5.1 profile, consistent with [the reference parser's current-function vararg check](https://www.lua.org/source/5.1/lparser.c.html#simpleexp) and [manual §2.5.9](https://www.lua.org/manual/5.1/manual.html#2.5.9). It is not a remaining codec failure or an SDK false rejection; installed client loading/reachability was not tested. Independently authored positive/negative vararg cases and a byte-transport CLI rejection case exercise the distinction and preserve zero declaration leakage.

The private ledger verifies **125 prior hashes**. Twelve previously unread files had no historical hashes: seven generic-byte skips and five derived input pre-read skips. Their hashes establish new current baselines only. A separate post-run read verifies all **137 current hashes**, with unchanged installed bytes. No source text or identifying ledger is committed. The first audit attempts exposed missing Worker permission and incomplete assumptions about absent historical hashes; they are failed tooling attempts, not parser verdicts or extra corpus coverage. Corrected exact-byte/native-syntax-gated audit exit is **0**; the full-corpus exit remains **1** for the explicitly recorded syntax/TOC/dynamic limitations.

## Approved v0.5.0 XML syntax analysis

The user approved XML A–F on 2026-11-17. `--xml-analysis` now calls the actual optional SDK parser through a fixed supervised worker. It strictly decodes bounded UTF-8 with BOM retained, validates namespace-aware XML 1.0, rejects DTD/XML 1.1, checks source/raw-slice/decoded-map invariants and reports aggregate before/after source integrity. XML never executes or selects files to follow.

`xmlAnalysis` separates discovered/attempted/submitted/completed, accepted/rejected, profile/resource/encoding rejection, read/worker/backend/invariant failures and source/mapping checks. `profileRejected` is a subset of rejected. Only accepted or syntax/profile-rejected documents increment `parsed.xml`; blocked work never counts as a parse verdict. Disabled parsers are now listed separately from missing providers/reference capabilities. Both syntax opt-ins can run together, but fullParsing remains false and --require-all-parsers still fails until those capabilities and diagnostic acceptance exist.

The fresh XML-focused run produced 1,199 actual verdicts (1,146 accepted, 53 XML0002 rejections), zero codec/resource/read/worker/backend/invariant blocks and all 1,199 source hashes unchanged. It checked 281,315 original source references and 85,212 decoded mappings. Private classification explained 52 namespace-only cases and one multiple-root document without waiving either. The full command exited 1, retaining existing TOC errors, disabled Lua and missing provider/reference work. See [exact commands, snapshot and remaining acceptance](REVIEW-XML-v0.5.0.md). Older Lua/candidate results above remain historical evidence for their respective snapshots.

## Approved v0.6.0 XML fact provider

The user approved provider A–D on 2026-11-17. [Profiles explained in Danish](XML-PROVIDER-PROFILES.md) describes the configuration without requiring the user to author JSON. The caller supplies an explicit `{schemaVersion:1,policy}` file; there is no automatic installed vocabulary or namespace fallback. The profile read is bounded to 1 MiB and validated before source discovery. Repeated/missing/invalid profiles and a provider flag without `--xml-analysis` fail explicitly.

Authored runnable example:

```powershell
node scripts/inspect-addon-corpus.mjs examples/xml-provider --xml-analysis --xml-provider-profile examples/xml-provider-profile.json
```

The optional worker provider stage processes the same original XML text under namespace-aware syntax. It returns candidate frames/declarations, unresolved Include/Script references and mapped chunk/handler bodies. The fixed identity `corpus-xml` is labelled caller-owned inventory association; resolvedProviderParticipation=false. No selected-TOC resolver participation, path traversal or Lua body parsing is inferred. Source comments, entities, CDATA and gaps retain exact decoded/raw maps.

`xmlProvider` is omitted by default. Requested runs expose:

| Field | Meaning |
| --- | --- |
| requested / discoveryComplete / complete | Explicit opt-in and independent discovery/projection acceptance |
| discovered / attempted | Found XML files and file-processing attempts |
| submitted / completed | Combined worker request/response envelopes; syntax-rejected requests may still complete |
| eligible / projectionAttempted | Syntax-accepted files / worker-reported provider-stage attempts |
| validated | Whole provider results that pass invariant checks; excludes resource/backend/invariant blocks |
| projectionComplete / projectionIncomplete | Validated extractions under policy, split by complete flag |
| rejectedBeforeProjection | Completed XML syntax/profile rejections; no provider parse credit |
| blocked / skippedOversized | Remaining disjoint per-file dispositions |
| readFailures / encodingRejected / inputLimitRejected / workerFailures / backendFailures / invariantFailures / resourceRejected | Distinct failure causes; overlapping causes are not summed as disjoint files |
| frameCandidates / declarations / references / inlineChunks / inlineHandlers | Fact occurrences, preserving duplicates; no unique active-name or parsed-Lua claim |
| checkedSourceReferences / checkedDecodedMappings / diagnosticsByCode / inputBytes | Validated aggregate provenance, diagnostics and bytes actually read |

For fully traversed requested runs, discovered = rejectedBeforeProjection + validated + blocked + skippedOversized. validated = projectionComplete + projectionIncomplete. Preflight/discovery failures keep completeness false; zero validated inputs cannot pass provider acceptance. `parsed.xml` remains syntax verdicts and is never incremented again for provider facts. Inline bodies never increment parsed.lua.

The CLI validates the full provider projection against original syntax, maps and exact warning sources before committing any metrics. It then requires the bounded source-integrity reread to match. Late malformed declarations/maps/warnings or changed sources leave no provider fact/verdict/diagnostic prefix credit. XML syntax source/map/diagnostic credit is also staged until the entire syntax result validates; native read/worker/resource outcomes remain separate.

Provider mode reports missing `xml-inline-lua-analysis` and `loader-reference-graph` capabilities; parser-only capability reporting stays unchanged. `--require-all-parsers` therefore continues to fail honestly. A passing authored inventory run with fullParsing=false proves only this requested fact projection, not game loading or all-provider acceptance.

At the initial provider implementation checkpoint, the installed provider run was not run. That checkpoint is superseded by [the actual provider inventory on 580ed8b](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6951837363): 1,146 validated projections, 1,116 complete under policy / 30 incomplete, 53 syntax rejections and 1,199 matching XML hashes. Exit1/fullParsing=false remains explicit. This earlier run parsed zero inline Lua bodies. Historical syntax/corpus counts retain their original snapshots.

## Approved v0.7.0 inline Lua composition

The user approved A–E in [issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6952532068). Add `--xml-inline-lua-profile` only with `--xml-analysis` and `--xml-provider-profile`. The separate schema-1 context profile explicitly supplies chunk context and exact namespace/name handler contexts; no handler signature is inferred. The assistant can prepare the technical file. The authored example and all field/limit details are in [the migration](MIGRATION-v0.6-to-v0.7.md).

`xmlInlineLua` reports body discovery, attempts, actual accepted/rejected Lua verdicts, missing-context skips, lexical incompleteness, mapping checks and separate resource/backend/worker/invariant failures. Standalone `parsed.lua` remains standalone file verdicts; inline bodies never inflate it. Syntax-rejected XML produces zero body attempts. Valid partial XUI0004 provider results can retain independent scripts; unsupported roots cannot invent bodies. Missing context makes acceptance incomplete.

Inline analysis, declarations, diagnostics, copied conditions/value cells, mapping queries and parts share a 50,000-record per-file inline budget. There are also 5,000-body and 1 Mi decoded UTF-16 per-file caps. Existing provider value mappings retain their separate provider budget. No partial inline metric prefix survives a failed whole-file source/sidecar validation or mismatching integrity reread. Decoded IDs are synthetic inventory identities; original XML references remain separate disjoint sidecars.

Lua and XML transport now share the bounded read-only descriptor helper, including identity/timestamp validation and final pathname checks. Native replacement races and Linux FIFO substitution have isolated authored regressions. Worker heap/deadline/output limits remain 256 MiB / 10 seconds / 32 MiB for XML composition. Full parsing remains false until selected-source traversal, remaining domains and diagnostic acceptance exist. The initial implementation checkpoint had no installed context-profile run. That boundary is superseded by [actual partial-context evidence on ab36b28](REVIEW-INLINE-LUA-CORPUS.md): 654 actual inline verdicts/mappings, 685 missing-context skips, 14 incomplete lexical bodies and zero technical blocks. All 6,875 standalone text inputs received syntax verdicts and matched before/after integrity. Exit1/incomplete/fullParsing=false remains explicit; this is not complete handler or loader acceptance.
