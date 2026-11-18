# Selected-source corpus acceptance — failed baseline

Actual read-only CLI source: **40d59d1c2e4c4100ac59e3cd96ca44876b64d834**, tree9a7adecfb3d3b51400b26536e739fea31a3c8fe3. [Original implementation/controls](REVIEW-SELECTED-SOURCE-ENGINE.md) and [approved contract](PROPOSAL-SELECTED-SOURCE-GRAPH.md). The local selected Classic Era AddOns root and technical profiles stay private. No installed source, identities, paths, individual hashes or full diagnostics are published.

The assistant prepared explicit associations from immediate-folder metadata:101directories,100groups with227regular immediate TOC candidates, one folder without candidates, zero linked/unsupported folders. Preparation opened zero source-content files. The caller environment and suffix policy reuse the existing Classic Era example (Vanilla, Classic, unsuffixed); the previously validated private XML vocabulary and partial handler-context profile are unchanged. The graph token table is empty: no implicit Family/Game substitution, dependency autoload or generic handler context is invented. These are caller-policy assumptions, not evidence of actual game activation.

## Measured CLI baseline

Parent Windows host session **37909**, Node26.13.1, ran:

```text
node scripts/inspect-selected-addon-sources.mjs <explicit-local-root> --graph-profile <private-graph> --resolution-profile <private-resolution> --xml-provider-profile <private-xml> --xml-inline-lua-profile <private-inline> --lua-input-profile corpus-files
```

Actual result: **exit1 / failed / completeUnderPolicy=false**,336217milliseconds,3788stdout bytes, zero stderr bytes. [Exact public-safe CLI aggregate](evidence/selected-source-graph-baseline-2026-11-18.json) passes a separate parent reconciliation: JSON roundtrip, unique-file/candidate/reference/inline partitions, fixed wire fields and no private identities/path/message fields. Reconciliation exits0; that checks the report's consistency, not corpus success.

| Language | Metadata found | Eligible unique source files | Source requests | Completed requests | Failed requests | Final integrity-accepted syntax verdicts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TOC |434|9|9|9|0|0|
| Lua |5242|316|316|315|1|0|
| XML |1199|85|85|85|0|0|

Metadata discovery completes over12714entries with no skipped links/unrepresentable entries. Five groups reach selection;95never invoke selection. The227candidate rows partition as5selected,4non-selected and218undecided. The graph retains409independently validated analysis records from410submitted requests,892occurrences and401references. A whole-operation **SGRAPH0005 resource failure** stops before final integrity verification: all provisional syntax/API/diagnostic semantic credit is withdrawn and all100groups are blocked. The actual empty core is complete; tool-level resolution is not. There are zero final matching-integrity counts, not proof that inputs changed or that no parsing was attempted.

The CLI does not expose the specific exhausted counter. Actual API-invocation credit is zero after the integrity withdrawal; the operational request/analysis-record counts above are separately observed facts. No found-file count is relabeled as parsed coverage. `fullParsing` and `clientConformance` remain false. Historical all-inventory syntax/provider/inline results remain at their original commits and are not erased by this selected-profile failure.

## Independent native retention correction under investigation

Source review separately found that native boolean verification discarded fresh directory snapshots and source read-result objects while leaving their record/string retention charged. This is distinct from cumulative directory-entry/read work, which must remain charged. A synthetic17-case reproduction on40d59d1 exits1 (three controls pass,14regressions fail): four unchanged directory verifications add12records/592string units; four unchanged source verifications add8records/256units. Lower-limit cases admit one full verification and then reject later identical work solely because discarded temporaries accumulate.

The native correction releases only discarded verification state and failed, uninstalled scan snapshots; issued cache snapshots and externally handed-off copies stay charged. Read/probe reservations, cumulative directory-entry work, path/reparse checks and all approved ceilings/deadlines are unchanged. Parent focused host6744 runs native-retention/native/host tests sequentially:35total/34pass/oneLinux-onlyskip/zero failures, exit0. Additional failure-path review, full gates and exact-head CI belong to the resulting committed correction. This correction is not claimed to explain the baseline resource failure: its final verification stage had not started.

## Measured retention pressure and bounded correction

A second actual run used the same full100-group/227-candidate profile and unchanged ceilings, with the native cleanup correction but the original engine/budget. Parent host21177 completed exit1 after337040milliseconds. Its eight-runtime-file snapshot digest is bcbfc4f647cf8bc45b6d707d054916fe2a2d18221aa3589ba5d887c40400ea33. A private observer retained the existing budget exception's fixed `limit` field without changing the ledger or its decisions. At denial, `retainedRecords` was exactly1000000, textCacheBytes24123992, retainedStringUnits28230885, directoryEntries12714 and readBytes11987055. After cache cleanup, retainedRecords fell to768128. The observed exhausted ceiling is therefore retained records, not elapsed time, directory work or read bytes. This identifies the diagnostic snapshot's failure; it does not retroactively instrument the first CLI run.

The read-only diagnostic adapter allowed only read descriptors within the selected lexical/canonical root and retained first/last input hashes privately. There were410actual source opens and no rereads because final integrity was never reached. This proves no completed integrity comparison; it is not corpus acceptance or a claim that every input remained stable. No per-file hashes or original diagnostics are published.

Source review found that cache insertion evicted stale text/line maps, but subsequent permanent result copies and event reservations could fail while disposable cache entries still occupied retention. The correction provides one trusted internal reclamation callback per atomic ledger reservation. It evicts only unpinned text entries, retries the reservation once and never restarts an external projection or consumes getters twice. Active request text stays pinned through actual parser calls and independent reply validation. Once traversal ends, all text is discarded before native integrity rereads allocate their temporary snapshots. Existing cumulative work, profile limits, path checks, helper bytes/deadlines, parser defaults, API contracts and publication rules are unchanged.

| Deliverable / dependencies | Files | Failure scenarios and measurable acceptance |
| --- | --- | --- |
| Disposable native verification state; requires issued source/directory snapshots | scripts/selected-source-native.mjs; tests/selected-source-native-retention.test.mjs | Repeated unchanged/changed verification, failed scan/publication, expired attribute work and exact local/shared budgets. Temporary charges return to their previous values; issued copies/caches and actual work remain charged.27 focused cases pass. |
| Pressure reclamation; requires the existing shared ledger and validated engine cache | scripts/selected-source-budget.mjs; selected-source-engine.mjs; tests/selected-source-cache-pressure.test.mjs | Same full authored GraphResult under lower record/string caps; insufficient permanent output and simultaneously live input/reply still fail closed. Getter-once, deadline, invalid-count, insufficient/throwing reclamation and rollback controls. No source-content reread or semantic reordering merely to reclaim inactive entries. |
| Integration and full local gates | Existing engine/retention/graph/native/host/accounting tests; package scripts | Fresh focused regression results, then check:all, strict API Extractor and actual licensed package contents, serialized against one source snapshot. Final results belong to the resulting commit and PR evidence. |
| Exact-head supported CI and actual installed corpus | PR30 and issue11; aggregate evidence only | Windows/Ubuntu × Node22/24 jobs must verify the new head. Then rerun the full100-group request; preserve failures/incomplete status, actual per-language parsing/integrity counts and private hash evidence. Previous green CI does not cover this correction. |

Never increase preset ceilings, silently narrow the request, reinterpret unknown tokens/contexts or claim release readiness merely to obtain a green result. Root-ancestor attribute batching is a deferred performance idea, not an implemented change or demonstrated cure. A synthetically passing retention correction is not proof that the full installed output fits its approved ceilings.

## Parent correction verification

The completed authored cache-pressure suite was also run against isolated copies of the five original40d59d1 ledger/engine/graph/resolution/accounting modules, with only import locations redirected to the existing SDK/fixtures: exit1,12total/fivepass/sevenfail. Both stale-cache success requirements fail after actual parser calls. The active-input denial control already passes on the baseline. Initial isolated-copy attempts had module-identity/package-resolution setup failures; those are not counted as product regressions.

Parent host43041 then ran `npm run check:all`, `npm run api:extractor` and `npm run check:packages` sequentially, all exit0, Windows Node26.13.1/npm12.2.0:558total/554pass/fourLinux-onlyskips/zero failures. Build, eight-package acyclic architecture/dependencies,78beta baselines/exports, all eight strict API Extractors and actual licensed payloads pass. This full-suite snapshot used a Set to pin the one serially loaded source. A final source review replaced that extra uncharged container with a scalar alias of the existing owned cache key; selection and DFS loads are awaited serially. Parent host87953 freshly exercises that final representation with `node --test --test-concurrency=1 tests/selected-source-cache-pressure.test.mjs tests/selected-source-engine.test.mjs tests/selected-source-retention.test.mjs`:23pass/zero failures/skips, exit0. Exact final-head full-suite CI remains a distinct required check.

The new native retention suite independently passes27cases; the neighboring composed graph/native/host/accounting/engine/retention command on host14180 passes43cases with one Linux-only skip, exit0. An independent source review checked reservation-only retry, getter consumption, cleanup ownership, active-text lifetime, unchanged native/path/helper/cap checks and pre-integrity eviction. It reported no actionable finding within that delta. This is a bounded source review, not a new sealed security scan or whole-project audit.

The unchanged PowerShell helper retains SHA256 ae058c154e3d17debcd3e4843eeb122495d0dd6f81d9a8e54fa23aa614a2c9c6 and the previously repeated exact-source Workbench gate. Optional WinRecoveryProjectLinter0.1.1 doctor/scan each exit2: at that inventory snapshot only five of225files (three TOC/two PowerShell) were checked; JS/TS/Markdown/JSON/YAML/XML lacked the plugin's pinned runtime libraries. Its six TOC-example findings and one existing Write-Host warning are not canonical gate passes or an audit of the220unchecked files. Missing runtime/token limitations were handed to the authorized plugin-maintenance chat; no plugin installation/configuration was performed.

## Exact correction-head CI and full-request outcome

Correction source **e0fd1a1e5e128a14f714cbe8fa72355dd93647db**, tree2fbd98f82fbb9782f3aa48acf48a181fc6e82d6e, has all eight supported jobs complete/success, attempt1: [push44212060916](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44212060916) and [PR44212067498](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44212067498), each4/4. Parent inspected all eight downloaded logs:558tests each, Ubuntu557pass/oneWindows-onlyskip, Windows554pass/fourLinux-onlyskips, zero failures. Every build/architecture/dependency/API78beta/export/strict8Extractor/actual licensed-payload gate passes. PR synthetic merge43329939d3ad3f5e265015a87c8977bb06317e9a has exactmain7b01bd0/e0fd1a1 parents and head-equal tree2fbd98f8. Push job IDs:134492626612,134492626885,134492626963,134492627026; PR job IDs:134492646961,134492647412,134492647419,134492647554.

The same full100-group/227-candidate request then ran through actual `analyzeSelectedSources` with the composed native host and the same private read-only observer/profiles. Parent host14785 terminates **exit1 after900211milliseconds**, source snapshot digest8e642dc42a6d0e91be0abad30786a8776cc2350bb41edbc0cfadbb1ec02d12f5. All eight recorded runtime-file hashes match this correction source. There are798submitted analysis requests and801unique read-only source opens (36TOC/595Lua/170XML), compared with410submitted requests in the original baseline. These are operational observations, not completed-parser or final-syntax counts.

Retained-record denials occur at378362/501124/504557milliseconds despite inactive-cache reclamation; active validation state remains charged. The unchanged operation budget then expires: the API rejects without a retainable graph aggregate. After final cache cleanup, retainedRecords=851532, retainedStringUnits=20525103, textCacheBytes=0 and cumulative readBytes=20371625. There are no source rereads or matching before/after comparisons. No final syntax/API/resolution credit is published; per-language parser-completion and diagnostic totals are unavailable, not invented zeros. [The public-safe execution receipt](evidence/selected-source-operation-failure-2026-11-18.json) is explicitly **not** a graph aggregate. FullParsing/clientConformance and stage7 acceptance remain false/incomplete.

The first new denial has506source nodes but505submitted analyses, so the next source has not yet reached its analysis submission. The observer does not capture the allocating call site. At this recorded e0fd1a1 snapshot, native ledger reservations do not receive the engine's reclamation callback. The authored reproduction below separately establishes that boundary defect; it does not establish the installed run's allocating call site or explain its full elapsed time. Keep genuine simultaneously live input/result costs charged. The [235-file pinned review index](REVIEW-COVERAGE-2026-11-18.md) separately identifies bounded/historical static evidence and remaining audit queues; green gates and this failed corpus attempt do not complete that audit.

## Parallel review corrections after the recorded run

| Reproduced defect | Exact files / regression | Measured evidence and resulting behavior |
| --- | --- | --- |
| Native reservations cannot reclaim inactive engine cache | scripts/selected-source-budget.mjs; selected-source-engine.mjs; tests/selected-source-native-cache-pressure.test.mjs | Authored actual native/composed SDK graph: cap2733, permanent output437records. Before final read2732records/120124text-cache bytes; fingerprint fits at2733, result/buffer handoff fails before the next SDK call. Same-cap compact-comment control passes. Initial focused test exits1 solely on expected-success assertion. Scoped default reclamation makes the complete original graph pass; final five-case suite also checks single retry, getter/cell ownership, invalid/conflicting attachment, stale same-callback detach, quota denial and cleanup. |
| Graph analyzer accepts late close acknowledgement | scripts/selected-source-analysis-client.mjs; tests/selected-source-analysis-close.test.mjs | Deterministic owned fake child/clock:9999ms passes,10000/10001ms fail to reject on baseline (onepass/twofail). Post-ack monotonic check makes all three pass. Existing10second reap cap, fixed child targeting and failure labels remain unchanged; no real child is required for the race. |
| Direct Lua API rereads validated requester | packages/lua-analysis/src/index.ts; tests/lua-option-ownership.test.mjs | Actual SDK baseline seven cases: four controls pass/three fail. Valid first addonId followed by undefined/object emits invalid identities; a later throwing getter escapes after parsing. Snapshot the initially validated string once, preserving invalid preflight order. After build all seven pass, retaining duplicates and exact BOM/astral/CRLF UTF16 ranges. Selected-source requests already own requester strings; this direct API defect is not attributed as the corpus timeout's cause. |

The default reclaimer is trusted internal code attached exclusively for one trace and detached in its finally block before cache/host cleanup. Native reservations may release only inactive engine cache, then retry that atomic reservation once with default fallback explicitly disabled. No native read or caller getter is retried. Idempotent detach cannot remove a later owner's attachment, even when it uses the same callback. No JSON executable/callback, public SDK/schema/package boundary, beta export, helper byte/deadline, parser preset or quota is added or widened. These focused greens require fresh combined/full gates, final diff review and exact new-head CI; e0fd1a1's CI/corpus evidence stays historical for these later corrections.

Next dependency: finish integrated checks and publication of these reviewed corrections, then measure remaining native attribute/analysis work and unnecessary line-index retention before another unchanged full-request attempt. Root-ancestor attribute batching and language-specific/lazy line maps remain unimplemented hypotheses. Corpus acceptance, remaining contexts/domains and the broader per-file audit remain open.

Parent integrated command on host71515 runs Lua ownership, graph close, native-cache, cache-pressure, native-retention and graph-analysis tests sequentially:73pass/zero failures/skips, exit0. Independent final source review checked the post-ack deadline, validated Lua requester scalar, default reclamation's explicit no-fallback retry, stale-detach ownership, active-text lifetime and cleanup, reporting no actionable delta finding. Parent final host53576 then runs `npm run check:all`, `npm run api:extractor`, `npm run check:packages` sequentially, each exit0:573total/569pass/fourLinux-onlyskips/zero failures, eight-package build/acyclic architecture/dependencies,78beta baselines/exports, all eight strict Extractors and exact licensed package contents. No runtime source changed after that checked snapshot. The Lua requester correction is separately committed as41c75c03b32e5be7eecbc0fb661608bd330ad092; exact combined-head supported CI belongs to the final PR acceptance record after push. These later fixes have not yet rerun the installed full request; the recorded e0fd1a1failure remains failed.

## Graph line index correction and profiling

The graph built a second line index for every loaded Lua source. Only TOC and XML reference events use that index to obtain exact original target slices. The Lua parser and reply validator compute their own source locations. The graph now retains Lua text and its cache entry without the unused line offsets. Active-text retention, the native cache reclaimer, TOC/XML reference slices and fixed budgets retain their previous behavior.

The authored regression compares two same-length Lua inputs, one with 2,500 extra comment line breaks. On `553ad6b`, host 35026 exited 1 with 12 passes and one failure. The Lua request boundary showed 2,612 versus 112 retained records and 180,076 versus 160,076 cache bytes. Declaration order, duplicate names and original UTF-16 spans had already passed. The existing eviction tests now use multiline XML for the disposable line map and retain the independent active Lua string-budget denial. The native fixture also checks that the cache shrinks during a successful native read at its cap, before the next SDK request.

On the corrected snapshot, host 24242 ran `node --test --test-concurrency=1 tests/selected-source-cache-pressure.test.mjs tests/selected-source-native-cache-pressure.test.mjs tests/selected-source-engine.test.mjs tests/selected-source-graph.test.mjs` and exited 0 with 30 passes and zero skips or failures. Exact commit matrix evidence is recorded in PR #30. The same full 100-group, 227-candidate corpus request will measure native list/read/verification and analyzer time by language. Windows helper round trips and private hashing are nested observations, so their durations must not be added to total wall time again. Native phase counts and parser requests are distinct from integrity-accepted verdicts. This test requires the original four profiles, the existing Windows helper, and clean tracked source. Any accounting rejection or timeout still fails the run under the existing limits.

The full request on `9180a622415ab69fb1c7fa997555380043fbfdb7` ran the guarded programmatic observer with byte-identical profiles from the preceding attempt. Host 65532, Node 26.13.1, exited 1 after 901,024 ms at the 900,000 ms operation limit. It opened 621 unique inputs read-only (26 TOC, 485 Lua, 110 XML). The analyzer port returned 620 replies and rejected one XML request. The operation returned no aggregate. Final parser verdicts and diagnostics are unavailable, and no integrity reread completed. See [phase counts, timings and quotas](evidence/selected-source-phase-profile-2026-11-18.json).

| Awaited phase | Total seconds | Requests |
| --- | ---: | ---: |
| Lua analysis | 554.5 | 485 |
| XML analysis | 147.6 | 110 |
| TOC analysis | 35.3 | 26 |
| Native directory lookup | 100.6 | 1,710 |
| Native file reads | 52.9 | 621 |

The three analysis methods occupied 737.4 seconds, or 82% of the run. This includes child startup, module loading, parser work, transport and reply validation. The 118.7 seconds spent in 41,490 Windows helper requests are included within native phases. Observer hash update and digest calls used 86 ms inside the reads. At 400 submissions, the ledger retained 745,342 records versus 978,209 in the old diagnostic. The new run retained 784,985 records at its time limit and 769,218 after cleanup. The timings of separate installed runs vary, so this comparison establishes a retention reduction at a shared milestone and cannot establish a speedup or an end-to-end capacity bound.

The same Windows host then ran 16 sequential tiny authored requests through the existing analyzer spawn test port, four each for TOC, bounded Lua, corpus Lua and XML. All replies passed. The observed OS spawn event arrived at 5–19 ms. First output took 219–732 ms for TOC, 230–391 ms for bounded Lua, 291–338 ms for corpus Lua and 193–300 ms for XML. Each request used the current child, worker and validation code. This narrow probe shows measurable per-request work even for tiny inputs. It does not partition module initialization, parser work and serialization, or predict installed-corpus throughput. Capture that partition with authored inputs before changing process lifetime, parser isolation, or native check order.

The cache eviction test previously used a 512-byte limit, enough for the complete authored fixture. The new reread assertion reproduced that gap with exit 1 and one failure. At 256 bytes, host 82068 ran `node --test tests/selected-source-engine.test.mjs` and exited 0 with nine passes. The test now forces and observes a TOC reread while retaining its original five analysis results and single Lua request.

The [push](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44220834304) and [PR](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44220840004) runs for `9180a62` passed all eight Windows/Ubuntu × Node 22/24 jobs. Each log records 574 tests and zero failures, with 573 passes and one skip on Ubuntu and 570 passes and four skips on Windows. Build, architecture, dependencies, 78 beta exports, strict API Extractor and actual package/license checks passed. The synthetic merge `c99273758c13f8befa82337e873d92a4f68eed57` had the exact main and feature parents and the same source tree.

## Language-specific worker initialization

The fixed graph worker now initializes the SDK modules for its request language. The corpus Lua launcher starts its existing isolated thread without importing the parser packages in the launcher. The Lua SDK initializes inside that thread. Before any counted call, the worker loads the selected named API bindings. A required module that cannot resolve, initialize or supply a required binding still stops the child without an analysis reply or API receipt. XML loads its syntax, provider, mapping and inline Lua dependencies before its first API call. The supervisor, one-child request lifecycle, thread settings, quotas and release surface retain their existing contracts.

The authored import tests invoke the real child through the supervisor and observe only its fixed SDK module specifiers. On `73dd5a2` four isolation assertions failed and the three required-module failure controls passed. With the change all seven passed. The 32-test focused run covered those seven tests, graph analysis, close/reap and full authored graph composition with zero failures. The corpus launcher import observer applies to the launcher. The real reply confirms delegate execution while its isolated thread's import list is outside that observer.

A separate Windows Node 26.13.1 probe ran six alternating baseline/current requests per fixture and compared the complete reply and receipts. The baseline scratch copy used the `73dd5a2` worker with imports redirected to the same checkout's canonical artifacts. The candidate used the production worker. All 60 authored replies matched. The measured medians in milliseconds were TOC 232.5 → 228.5, bounded Lua 219 → 177.5, corpus Lua 268.5 → 189, malformed XML 166 → 164 and inline XML 189 → 200. These narrow timings establish an improvement for the measured small Lua requests. They do not establish throughput against the installed set. The next full run uses the same 100 groups, 227 candidates and four byte-identical profiles.

### Full request after worker initialization

On `2b99f2c87cd817a5a78366d57a020bcb949385e0`, the guarded programmatic observer ran the full 100-group, 227-candidate request with byte-identical profiles. Host 49791 on Windows Node 26.13.1 exited 1 in 596,396 ms. All 1,074 analyzer calls returned at the port. The 1,081 read-only opens covered 1,074 unique input paths (36 TOC, 744 Lua and 294 XML). Three paths were reread during traversal and their first/last hashes matched. The run stopped before any final source or directory verification call, with no aggregate. Final verdicts, diagnostics and resolver acceptance therefore remain unavailable. See [the reconciled phase receipt](evidence/selected-source-worker-corpus-2026-11-18.json).

The only observed budget failure was `retainedRecords`. The first recorded denial occurred at 587,013 ms, with 1,000,000 records and 22,868 text cache bytes. At cleanup the cache was empty and the ledger still held 1,000,000 records. Analyzer calls occupied 430.1 s, native lookup and read methods 157.9 s. The Windows helper's 120.1 s are included in native time. Both prior failures stopped at fewer submissions. Differences in host conditions prevent attributing the entire change in wall time to the worker optimization.

### Next retention experiment

An authored in-memory file host ran one TOC and six Lua files with 200 declarations each through the real supervised analyzer. Traversal produced 1,200 origins and composition produced 1,200 resolved names, with exit 0. Before composition the real ledger held 19,599 records. After composition it held 52,141. Independent copy measurements under the current ledger counted 6,223 records for the analyses array, 6,014 for provider batches and 7,201 for origin inputs. The latter two duplicate much of the existing declaration data during traversal. This probe establishes the overlap in that fixture, rather than a per-structure accounting for installed inputs.

Evaluate compact internal occurrence, analysis and declaration indices in `scripts/selected-source-engine.mjs` and materialize separately owned provider and provenance records only where needed by `scripts/selected-source-resolution.mjs`. Before adopting that change, prove equality of the full result, declaration order, duplicate occurrences, exact ranges and disjoint mapping parts against authored baselines. Require corrupt indices, missing records, wrong variant association and mutation of one independently owned result to fail the corresponding controls. Continue charging live copies and preserve the approved one-million-record cap. Verify in the current lower-quota and cache-pressure tests and an authored declaration-heavy fixture. A further full installed run should follow a measured reduction in retained records through both traversal and composition.

All eight Windows/Ubuntu × Node 22/24 jobs passed at `2b99f2c` in the [push](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44224483214) and [PR](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44224489438) workflows. Each log records 581 tests, zero failures, the existing platform skips, architecture and dependency checks, 78 beta exports, strict API Extractor and exact licensed packages. Synthetic merge `5e476f9db9b763aab1ed5e6b0c317fff011f2cf9` has the exact main and runtime parents and matching tree `4107de67c358ec80ccc754acd2ecf715c18d3e18`.

## Compact declaration retention

The traversal now records the occurrence, analysis, variant and batch coordinates for each provider contribution. The validated analyses carry the declarations and inline mappings. Composition checks the coordinates, frame order and complete occurrence coverage before constructing the SDK inputs and separately owned origin records. The approved resource caps and public output contracts continue to apply.

On the Windows host, an authored comparison ran the real supervised analyzer against `11fa611` and the compact implementation. It compared the complete graph values for a mixed-language graph and a graph with 1,200 Lua declarations and one SavedVariable. Both matched, including order, ranges, mappings and origins. The larger graph retained 52,253 records at baseline and 33,041 with the change, a reduction of 19,212 records (36.8%). Under a 47,000-record test cap, the baseline returned `SGRAPH0005` for `retainedRecords` and the candidate returned all 1,201 origins with the same graph as the ample-budget run. Both comparison processes exited 0 after checking the expected outcomes. These measurements cover authored fixtures. Acceptance on the installed corpus requires a separate run with the unchanged profiles and approved caps.

On the candidate that became `3aaf42c`, host 86536 ran `node --test --test-concurrency=1 tests/selected-source-cache-pressure.test.mjs tests/selected-source-resolution.test.mjs tests/selected-source-native-cache-pressure.test.mjs`. All 29 tests passed with exit 0. The cache-pressure controls still require the input to reach the real parser under pressure and enforce failure when the active input and reply cannot both fit. Both CI workflows recorded 582 tests and zero failures per job, with one Ubuntu or four Windows skips. Build, architecture, dependencies, 78 beta exports, strict API Extractor and actual licensed package contents passed. Synthetic PR merge `b487e894efa77aa02366f43ae3479fe0b223b4ae` has the exact main and feature parents and the matching tree `4bfbc9be1b23670a3786a4582c149f07146ccae3`. [Push run](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44228243996) · [PR run](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44228249431)

### Installed request after compact retention

Windows host 12355 ran `3aaf42c` read-only with the same 100 groups, 227 candidate rows and four byte-identical profiles. It reached the 900-second operation deadline and exited 1 in 900,559 ms. The first deadline denial held 679,094 records. It opened 344 distinct inputs read-only. The analyzer port handled 7 TOC, 260 Lua and 77 XML requests, returning 7, 260 and 76 replies respectively. One XML request was rejected at the deadline. The run stopped before source and directory verification and produced no aggregate. Final syntax verdicts, skips, diagnostics and invariant reports are unavailable. [Aggregate phase receipt](evidence/selected-source-compact-corpus-2026-11-18.json)

The parser port consumed 767.4 seconds across 344 calls. Native directory and source methods took 121.3 seconds, including 95.0 seconds of Windows helper work. The previous run processed a larger and different mix of inputs before failing on retention. The elapsed phase measurements leave the cause of the timing variation open, along with whether the compact representation can complete the full run under the retained-record cap.

Before repeating the installed request, compare supervised TOC, Lua and XML calls on fixed authored files, sampling child startup, first output and end-to-end time. Compare those measurements with the previous authored probe and with native phase timing on the same host. Reuse the four profiles and the approved ceilings for the next full acceptance run. Stage 7 still requires the final integrity phase and policy-bound per-language aggregate.

## Single XML provider validation per boundary

An authored Windows probe at `1928ac2` compared the process spawn event, early Node preload and worker entry. Host 97850 exited 0 with 24 authored parser replies matching their corresponding instrumented copies and six bare Node controls. Median spawn events arrived in 7–8 ms. Depending on the fixture, median earliest JavaScript markers arrived in 171–1,238 ms. The bare Node control reached that marker in 445 ms at the median. The measurement establishes variation before worker analysis; it leaves the cause of that variation open.

Source review found a separate repeated workload. The worker verified the provider before calling the inline composer, which verified the same provider again. The same repetition occurred in the client and in the graph's subsequent owned-copy check. Each boundary now verifies the provider once and checks the inline projection within that same invocation. Invalid provider projections still fail, confirmed provider resource denials still suppress inline calls, and the three independent checks remain across the worker, client and graph. The inventory wrappers continue to verify their own inputs.

Windows Node 26.13.1 host 3574 exited 0 after an alternating comparison of 40 complete replies and API receipts across five authored fixtures. The fixtures covered 1,100 frames, inline Lua with disjoint mapping and missing context, an ambiguous frame warning, a provider resource denial, and malformed XML. Each validated-provider request went from two passes to one at each boundary. A provider denial used one pass per boundary and a syntax rejection used zero in both implementations. For the 1,100-frame fixture, summed provider-verifier median time fell from 755.0 to 370.8 ms. The client median was 1,454.3 to 1,105.0 ms and the additional owned-copy verification median was 313.6 to 188.6 ms. Small-fixture client timings varied in both directions. The probe measures the instrumented authored cases. Installed-corpus throughput and full acceptance require the read-only run with final verification.

On Windows host 32523 the focused command below exited 0 with 90 passes, zero failures and zero skips. It covered the independent projection checks, fixed worker boundaries, legacy inventory paths, graph integrity and three standalone TypeScript reference controls.

```powershell
node --test --test-concurrency=1 tests/gate-hardening.test.mjs tests/review-regressions.test.mjs tests/selected-source-analysis.test.mjs tests/selected-source-worker-imports.test.mjs tests/xml-inline-lua-validation.test.mjs tests/xml-worker.test.mjs tests/xml-inline-lua-worker.test.mjs tests/selected-source-graph.test.mjs
```

The eight Windows/Ubuntu × Node 22/24 jobs at `e47a973` each recorded 586 tests and zero failures, with one Ubuntu or four Windows skips. Build, architecture, dependencies, 78 beta exports, strict API Extractor and actual licensed package contents passed. Synthetic PR merge `e239aa77d99860c8d373b1e2384db6cd313c3a46` has the main and feature parents and matching tree `7fe017af20e61faf178bf3dedb7e73a02a08714e`. [Push checks](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44238061388) · [PR checks](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44238067839)

### Installed request after removing repeated XML checks

Windows host 33178 ran `e47a973` with the same 100 groups, 227 candidate rows and four byte-identical profiles. It reached the 900-second operation deadline and exited 1 after 900,396 ms. The 961 read-only opens were distinct inputs: 36 TOC, 692 Lua and 233 XML. The analyzer port returned 36 TOC, 691 Lua and 233 XML replies. Its last Lua request was rejected. Final source and directory verification never started. The run yielded no aggregate, skip counts, final syntax verdicts, diagnostic counts or invariant results. [Aggregate phase receipt](evidence/selected-source-single-provider-corpus-2026-11-18.json)

The analyzer port took 731.8 seconds across the three languages. Native listing and reading took 157.5 seconds, which includes 121.3 seconds of Windows helper work. The first deadline denial held 928,401 records under the 1,000,000 cap. Removing cached source text left 908,188 records. The preceding run on `3aaf42c` stopped after 343 replies. The two runs differ in host timing and how far they reached, so their durations cannot isolate the XML change's effect.

A subsequent comparison of the unchanged private selection profile with the read ledger reconciled the 36 opened TOC files to 36 candidate rows in 23 of the 100 groups. Each of those 23 groups had all its candidate paths opened. These are candidate open counts. The run did not report final group selections or completed traversals. Sizing the remaining work from the elapsed time for the last 100 calls alone would miss the later groups and final integrity phase.

The next authored control should reproduce late-traversal memory pressure. Measure the scopes that retain records from analysis through final verification and composition, including temporary composition input and results. Compare full graphs under reduced test caps and require identical provenance, diagnostics and failures. Use a short fixed Node/TOC/Lua/XML timing probe to characterize the host before committing time to another full run. Keep the four profiles, full request and approved time and record limits in force. Stage 7 still requires the final integrity phase and the per-language aggregate.

### Temporary ordinal lookup retention

The per-group and final ordinal checks allocate a temporary map keyed by each distinct declaration name. Its references and strings were charged permanently, although the published origins retain only numeric indices. `scripts/selected-source-resolution.mjs` now accounts for each successful reservation and releases that map's records and string units when the check exits. Resolution and provenance verification still use the live map while it is charged. The release covers only the map's reservations, including on failure.

An authored Windows comparison used the real supervised analyzer, one TOC and six Lua files containing 1,200 distinct declarations plus one SavedVariable. Host 57034 compared production at `43d37de` with a scratch copy releasing only the temporary maps. The full graph and all 1,201 origins matched. Final retained records fell from 33,041 to 28,235. A 31,500-record test cap rejected the original code for `retainedRecords` and accepted the corrected graph with all outputs intact. The comparison exited 0 after checking the expected results. `tests/selected-source-resolution.test.mjs` now uses that lower cap for its declaration-heavy regression. Full installed peak retention remains to be measured.

The first integrated focused run on host 66633 exited 1 with 31 passes and one failed declaration-heavy graph assertion. The logged status did not identify the failing stage. Subsequent authored reproductions using both a bound shared ledger and the ordinary unbound host passed; the bound result retained 28,235 records at 31,500. The assertion now includes aggregate issue codes. The final command on host 55101 exited 0 with 32 passes and no failures or skips on Windows Node 26.13.1.

```powershell
node --test --test-concurrency=1 tests/selected-source-resolution.test.mjs tests/selected-source-cache-pressure.test.mjs tests/selected-source-native-cache-pressure.test.mjs tests/selected-source-graph.test.mjs
```

### Native file and directory handoff retention

The composed native port issued owned directory results and source buffers. The engine copied directory data and decoded source bytes, while the native result reservations remained charged after the engine's last use. The composed host now registers each issued handoff by object identity. The engine releases the matching reservation after directory import or decoding, including when validation rejects the handoff. The native caches and the engine's owned data retain their own charges. Cumulative I/O, descriptor checks, final source/directory verification and the direct file port's caller-owned results retain their existing accounting.

The two handoff controls on Windows against `a931abe` failed with exit 1. During review a further authored control reproduced an ordering problem in the first correction. Releasing an earlier handoff during an in-flight verification changes the native counters while that operation holds a snapshot for its cleanup. That regression failed before the guard with exit 1. The guarded implementation keeps the earlier result charged while the native operation is busy. Release succeeds after verification and is idempotent for that identity.

Host 78093 ran the native cache-pressure, native-retention, native, engine, graph and cache-pressure test files with `node --test --test-concurrency=1`. It exited 0 with 76 tests, 75 passes and one Linux-only skip. The controls compare full graph output, opened paths and the cumulative read/directory counters across identical authored inputs. They also verify release when a handoff is rejected and ensure a second release changes no counters.

A separate Windows authored probe added 1,024 empty, non-source directory entries. It used real supervised TOC, Lua and XML calls on authored inputs, a deterministic clock and a trusted attribute test port. The final ledger fell from 3,518 records with the handoffs retained to 2,470 with normal disposal. The difference was exactly 1,048 records and 22,802 UTF-16 units across two directory and three source handoffs. All graph output, six read-only opens, 2,056 cumulative directory entries and 85,138 read bytes matched. The probe exited 0. The installed evidence remains the earlier full request that stopped before final verification.

The next ownership check follows the engine's validated copies from allocation to publication or rejection. A rejected provisional engine copy and traversal-only cache/index state are distinct from the native handoffs measured here. Use authored malformed, exact-cap and one-over cases to prove each isolated release preserves complete outputs and resource denials, then measure the final resolver on larger authored projections. The approved ceilings and Stage 7 acceptance continue to apply.

### Rejected engine projection retention

A separate authored comparison on `0ef33af` matched the published issue, cumulative work and rejected graph facts for rejection before and after creating each provisional copy. Late rejection of a 300-entry directory retained 302 extra records and 10,415 UTF-16 units. A late source-range rejection of a 300-declaration Lua reply retained 1,511 extra records and 40,331 units. These charges matched separate copies of the discarded projections exactly. The two targeted late-versus-early regression cases failed before the change, exit 1.

The private ledger now runs a trusted synchronous validation step while it still owns the copy's exact allocation tally. If validation or the last publication reservation fails, rollback returns only the discarded copy's charges. Directory validation, owned parser reply validation and failure receipt verification use that boundary. The regression also forces cache reclamation during a copy before rejecting it. Its assertions preserve the independent reclamation and the original reported failure.

Host 73060 repeated the same six-file focused command on Windows. It exited 0 with 79 tests, 78 passes and one Linux-only skip. The two graph rejection fixtures now have identical ledger states whether they reject before or after copying. The scoped rollback test also retains the expected lower balance after an independent reclamation.

### Release traversal lookups before final integrity

Once all selected occurrences have been processed, the engine needs the verified directory fingerprints and their consumers for integrity. The engine's owned directory entry arrays, analysis reuse keys and decoded-text cache serve only traversal. The correction releases those reservations before the first final source verification and also disposes of them on traversal failure. It preserves the native port's own directory snapshots, exact analysis records, consumers and verification order.

The regression comparing authored graphs with and without 128 extra directory rows failed at `dcb72fd` with exit 1. Those rows left 128 records and 5,522 UTF-16 units charged at the first final check. The corrected fixture has the same pre-verification and post-verification retained counters in both cases. An independent late directory-change control still invalidates the affected group after the lookup arrays are discarded. Host 74934 ran the engine, resolver, native cache-pressure, native retention, graph and cache-pressure tests using `node --test --test-concurrency=1`. It exited 0 with 75 passes and no skips or failures.

A separate authored comparison on Windows used real supervised TOC, Lua and XML calls and 1,024 extra directory rows. It compared the full production graph with the `dcb72fd` engine. Both outputs and all five traversal reads matched. The first-verification ledger dropped from 1,706 to 667 records and from 55,742 to 17,848 UTF-16 units. Final retained records dropped from 2,036 to 997. Under a 16,000-record cap, a scoped 14,295-record verification reservation crossed the old limit by one; the corrected run accepted it and produced the same complete output as its control. The comparison exited 0 after checking the expected outcomes. This simulated verification pressure is separate from installed-corpus evidence.

### Final resolver input lifetime

The final SDK call returns owned selections, declarations, conditions and issue sources. Graph tooling now releases its staged resolver input copies after that call and before the graph copies the result. Each input copy reports its exact record and UTF-16 debit after successful validation. Rejected groups retain their prior rollback behavior. The temporary ordinal map now points to the last validated origin for each name, reusing the origin's two indices. The result and origin projections keep their existing order and ownership, including duplicate declarations.

An authored Windows probe used actual SDK TOC and XML calls in process through a memory host. At `73d365b`, 68 groups and 408 analyses held 857,220 records before copying the final SDK result. That result required 163,410 additional records. The copy hit the 1,000,000-record ceiling and rolled back. The staged inputs accounted for 36,177 records and 1,279,010 UTF-16 units. The corrected production resolver returned with 984,453 retained records, all 68 groups eligible and all 10,200 frame origins in order. Each frame still had unknown activation, so SDK resolution remained incomplete. These observations measure retention after traversal under a memory host. The installed traversal and its duration remain unverified on this revision.

The new 1,200-frame regression failed on `73d365b` at the 119,000-record test limit. It now returns identical whole-graph values at 119,000 and 1,000,000 records, including ordered origins. Windows Node 26.13.1 exited 0 with 76 passes and zero failures or skips for the following focused gate.

```powershell
node --test --test-concurrency=1 tests/selected-source-engine.test.mjs tests/selected-source-resolution.test.mjs tests/selected-source-native-cache-pressure.test.mjs tests/selected-source-native-retention.test.mjs tests/selected-source-graph.test.mjs tests/selected-source-cache-pressure.test.mjs
```

Before repeating the unchanged full installed request, measure supervised Lua on small and larger authored inputs. Separate worker startup and imports, parsing, transport and the two reply-validation passes. Require equal responses and call receipts before using an optimization on the installed corpus. The approved runtime and retention limits still apply.

### Full installed request with corpus Lua launcher reuse

The read-only observer ran `d64ce3b98d0025e0b11e95e74a814dfd74e61e44` on Windows Node 26.13.1 with the same four profile files, 100 groups, 227 candidate paths and the same budgets. Host session 48773 exited 1 in 902,667 ms. The first deadline denial held 874,778 records and 40,189,019 UTF-16 units. The operation opened 939 files read-only and reached a candidate open in 23 groups. [Phase receipt](evidence/selected-source-reused-launcher-corpus-2026-11-18.json)

| Language | Read-only opens | Submitted | Port replies | Port rejections | Phase seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| TOC | 36 | 36 | 36 | 0 | 52.0 |
| Lua | 679 | 679 | 678 | 1 | 339.6 |
| XML | 224 | 224 | 224 | 0 | 341.6 |

The deadline arrived before final source or directory verification. There was no aggregate, final syntax verdict set, skip count, diagnostics count or invariant result. The table records traversal activity at the supervised port. The private observer reconciled all four profile bytes and the hashes of 13 runtime files, plus the count of recorded read-only opens.

The earlier `e47a973` operation submitted 961 requests in 900,396 ms. Its Lua phase took 548.6 s over 692 submissions and XML took 154.9 s over 233 submissions. In the new run Lua took less elapsed time and XML took more elapsed time. The whole run reached fewer requests. These separate runs used the same profiles under varying host load and reached different input sequences. Time the supervised XML path on authored fixtures, separating start, parsing, provider work, inline composition and reply validation, before changing another lifecycle or repeating the installed request.

### Supervised XML timing on authored inputs

Windows Node 26.13.1 ran seven samples per fixture through an instrumented copy of the `d64ce3b` worker under the normal supervisor. Every complete result and API receipt matched the corresponding production response. The process exited 0. Times below are individual medians in milliseconds.

| Authored fixture | Spawn to worker entry | SDK imports | XML syntax | Provider | Inline composition | Reply and close | Parent decoding and validation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 frames, 1 script | 2591.1 | 192.8 | 7.0 | 7.1 | 39.1 | 184.6 | 1.7 |
| 500 frames, 1 script | 1649.1 | 172.1 | 123.0 | 156.8 | 230.3 | 177.3 | 289.5 |
| 250 frames, 25 scripts | 3181.4 | 132.3 | 28.2 | 95.0 | 211.3 | 244.5 | 138.8 |

Spawn to worker entry was the largest measured phase for all three inputs. The larger fixtures also showed substantive parent validation work. One additional check cloned and revalidated the reply separately. That measurement took 2.5, 422.7 and 254.9 ms respectively and excluded the graph's own metered copy. The phase comparison is authored timing under observed host load. It leaves the split between bare Node startup and worker initialization open. Compare bare Node and the exact XML worker using the supported Windows runtimes before proposing another process lifetime change.

### Retention by owner and the CLI XML tree lifetime

The supported Windows Node 24.22.3 replay at `9eda570e4c5b809d06b76c849304434f58cc17c9` used the same 100 groups, 227 candidate paths, four profiles and runtime source. Host 58783 exited 1 after 900,975 ms at the operation deadline. It submitted 36 TOC, 739 Lua and 297 XML analyses. The port returned 36, 738 and 296 replies, and 23 groups reached a candidate open. At the first deadline denial it held 999,288 records. Neither final integrity phase started and no aggregate, final syntax verdicts, skips, diagnostics or invariant results were available. [Reconciled result and CI](https://github.com/Zilvereyes/wow-addon-sdk/pull/30#supported-windows-node-24-follow-up)

An isolated Windows comparison used 25 authored groups and 1,000 real SDK replies in process through a memory host. The attribution re-metered the owned analysis rows with the original copier. At reply 1,000 the ledger held 593,010 records. Analyses accounted for 557,829, while references held 8,775, occurrences 2,000, guard evaluations 2,925, the text cache 7,529, analysis keys 1,000, and engine directory entries 1,051. The provider batches held 5,490. Another 6,411 covered node rows and the residual owners. This measures logical reservations in the authored graph.

XML syntax alone accounted for 336,776 records in 250 replies. The CLI only publishes the allowlisted aggregate. Its internal entry point copies and validates the full XML syntax, then retains the verdict and diagnostics after returning the exact reservations for the copied element and text arrays. It preserves provider results, inline Lua and original source spans. The existing private graph entry point retains complete XML trees and returns its original shape. Profiles and parser limits are unchanged.

With the same authored files, the CLI path held 256,734 records at reply 1,000 and 247,088 after integrity, down from 593,010 and 583,364 respectively in the full path. All 1,000 per-file integrity comparisons passed in both measured graphs. Separate regressions use identical SDK replies to check the wire result and read order under a 10,000-record cap, and verify rejection of corrupted syntax in both modes. [Graph regression controls](../tests/selected-source-graph.test.mjs)

The focused Windows Node 24.22.3 command exited 0 with two passes. The lower cap yields a resource failure in the full graph and the same aggregate as the ample-budget full graph in the CLI path. The corrupted XML control withholds XML syntax credit in both paths.

### Full installed replay through the CLI aggregate path

The read-only observer ran `d17bfea5937987c2b199bfec453f543f2cda68c0` on Windows Node 24.22.3, with four byte-identical profiles and the same work ceilings as the prior Node 24 run. The request still covered 100 groups and 227 TOC candidates. Host session 11693 exited 1 in 900,480 ms. It opened 741 distinct files read-only and reached at least one candidate open in 23 groups. The first operation-time denial held 189,636 records and 24,496,470 UTF-16 units. No retention limit denied a reservation. [Reconciled phase receipt](evidence/selected-source-cli-aggregate-corpus-2026-11-18.json)

| Language | Opened | Analyzer submissions | Port replies | Port rejections | Analyzer wall time |
| --- | ---: | ---: | ---: | ---: | ---: |
| TOC | 36 | 36 | 35 | 1 | 33,259 ms |
| Lua | 564 | 564 | 564 | 0 | 423,510 ms |
| XML | 141 | 141 | 141 | 0 | 224,112 ms |

The run ended before final source or directory verification. No aggregate, final verdict counts, skips, diagnostics or invariant totals were issued. The port counts record traversal progress. The observer reconciled all read-only opens, four profile byte comparisons and 13 runtime file hashes. Retention figures came from the shared operation ledger. The receipt contains aggregate operational counts and repository identities.

The earlier Node 24 run reached 1,072 submissions, so these installed measurements cover different prefixes. The authored equal-work comparison gives the direct retention evidence. Profile the remaining wall time on Windows Node 24 with fixed authored cases. Compare bare Node, one-shot TOC/XML, and the transition from an idle corpus Lua launcher to a TOC/XML request. Record startup, launcher close, SDK import, API, serialization, and parent validation times with exact reply/receipt equality before changing implementation. Stage 7 requires the original full input and final integrity verification.

```powershell
node --test --test-name-pattern 'aggregate-only validation' tests/selected-source-graph.test.mjs
```

### Windows root attribute calls and supported-runtime XML timing

The installed replay at `d17bfea` spent 150,186 ms in 44,401 Windows attribute requests. The native code checked the root's attributes as the last step of its ancestor walk and repeated that request immediately while validating the cached root directory stamp. The same overlap was present when verifying cached directories after reading. The focused regression on `0edf24f` exited 1 because an unchanged warm read made four singleton root attribute calls. It requires one call before opening and one afterward.

The native port keeps a fresh root observation within each of those two phases. The cached-root check still takes a fresh bigint `lstat`, rejects symbolic links, checks canonical containment and compares the issued directory stamp. It calls the Windows helper again when the full stamp differs. The regression verifies identical bytes and fingerprints and an exact four root stats. An authored change between observations triggers a fresh attribute check and rejection before another open. Final enumeration and source verification continue to take their own observations.

The Windows Node 24.22.3 comparison (host 40021, exit 0) used the registered stock helper on the same authored directory tree for each implementation. It opened 24 distinct Lua inputs read-only, reread all 24, and verified seven directory fingerprints. The directory results, source bytes and fingerprints, verification verdicts and work counters matched. The first harness attempt used forward-slash directory labels for verification on Windows and failed before comparison. The measured comparison used the exact native directory keys.

| Phase | Baseline helper requests | Corrected helper requests |
| --- | ---: | ---: |
| Bootstrap | 7 | 7 |
| Initial directory listings | 88 | 82 |
| Source reads | 600 | 552 |
| Source integrity rereads | 600 | 552 |
| Directory integrity scans | 88 | 82 |
| Total | 1,383 | 1,275 |

The same host also timed larger authored XML replies on Node 24.22.3. An initial phase run stopped at the stock analyzer deadline. The diagnostic rerun logged each failure stage, ran three samples per case and exited 0. Both stock processes and instrumented processes used the existing supervisor. All nine instrumented replies and their API receipts matched their stock controls. Times below are phase medians in milliseconds. The independent copy/validation probe ran after the supervised response and is outside the supervised total.

| Authored fixture | Worker entry | SDK imports | Syntax | Provider | Inline | Reply and close | Parent decode and validation | Additional copy and validation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 frames, 1 script | 237.4 | 61.9 | 6.2 | 8.1 | 13.0 | 17.5 | 3.0 | 6.3 |
| 500 frames, 1 script | 186.9 | 48.9 | 29.7 | 65.1 | 69.1 | 31.6 | 111.3 | 134.0 |
| 250 frames, 25 scripts | 154.9 | 37.3 | 21.3 | 41.8 | 69.9 | 21.9 | 57.3 | 61.8 |

Worker startup varies across these local attempts. Larger replies add measurable independent validation time. The next authored controls should time larger standalone Lua replies and isolate unused inline-query construction from the range and declaration checks. The native comparison establishes a reduction in helper requests at equal work. The installed corpus gain and Stage 7 remain unverified.

### Installed Lua timing sample

Windows Node 24.22.3 read a deterministic sample from the 564 Lua paths opened by the previous traversal. It took the 16 largest files by prior byte length and 48 evenly spaced positions in the remaining size-ordered list. It used the native file port and the ordinary supervised corpus Lua profile with a fixed diagnostic association and no inherited conditions. Every initial file hash matched the prior traversal. The probe reopened each source for integrity verification.

| Diagnostic run on `6943a8a` | Files with verified syntax | Syntax rejections | Diagnostics | Skips | Supervised median | Maximum |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Stock analyzer, host 49028 | 64 | 0 | 80 `LUA0004` | 0 | 169 ms | 1,168 ms |
| Numeric backend instrumentation, host 16912 | 64 | 0 | 80 `LUA0004` | 0 | 141 ms | 711 ms |

Both probes exited 1 because of the lexical projection warnings. Both recorded 128 read-only opens and 64 matching integrity comparisons. The stock probe used 26,360 ms overall and the instrumented probe used 20,652 ms. These runs had different host timings.

The instrumented worker recorded only the distinct global count and elapsed time of the pinned backend's AST call. All 64 complete timings had at most 42 backend global names. The median AST phase was 13 ms and the maximum was 167 ms. SDK output held at most ten distinct declaration names in one file. The authored quadratic name-table case remains reproducible, but this size-based sample gives no evidence of that scale in the prior traversal prefix. Stage 7 still uses the full reference graph and the original associations and policies.

### Full replay after coalescing adjacent Windows root checks

The full request on `6943a8a43d20079eed7501f5111d27a45172b30a` used the same four profile files, 100 groups, 227 candidate rows and work ceilings as the preceding `d17bfea` run. Windows Node 24.22.3 host 77306 exited 1 after 900,298 ms. It opened 1,989 distinct sources read-only and reached at least one candidate open in 54 groups. All 741 input hashes from the preceding run matched current first reads. The observer compared 13 tracked runtime file hashes with the tested checkout. [Reconciled phase receipt](evidence/selected-source-native-root-corpus-2026-11-18.json)

| Language | Opened | Analyzer submissions | Port replies | Port rejections | Analyzer wall time |
| --- | ---: | ---: | ---: | ---: | ---: |
| TOC | 117 | 117 | 117 | 0 | 35,834 ms |
| Lua | 1,439 | 1,439 | 1,438 | 1 | 407,822 ms |
| XML | 433 | 433 | 433 | 0 | 194,849 ms |

The first time denial held 354,667 of 1,000,000 records and 46,987,414 of 67,108,864 UTF-16 units. Final source and directory verification never started. The aggregate and final parser verdicts, diagnostics, skips and invariant counts are unavailable. List and read calls occupied 249.0 seconds. Within the native phases, the Windows helper spent 160.0 seconds across 70,823 requests. Helper duration overlaps the native wall time and is recorded separately.

The installed replays ran under varying measured conditions. The equal-work synthetic comparison remains the evidence for the Windows change. This observation places standalone Lua at the largest analyzer wall-time share, followed by XML. The 64-file probe found low backend name cardinality. Measure SDK module initialization in fresh Lua parser threads and one-shot TOC/XML processes with authored mixed workloads. Require exact SDK replies and API receipts, and preserve fresh threads, case policies and resource ceilings. Stage 7 requires final integrity checks for the full selected request.
