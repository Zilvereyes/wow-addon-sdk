# Supervised graph analysis checkpoint

This implements the parser portion of approved graph stage4 over fc2cb8e1de4194b84aa3e76b44988d01fa973b00. [A–F approval](https://github.com/Zilvereyes/wow-addon-sdk/pull/30#issuecomment-6957138420) remains binding. The private host analysis port now makes actual SDK calls; iterative traversal/cache/occurrence accounting, shared graph budgets, resolver publication, CLI and installed graph acceptance remain separate dependencies. No SDK package, public API, manifest, dependency, lockfile, PowerShell helper or CI workflow changes.

## Implemented boundary

- `scripts/selected-source-analysis-client.mjs`: the original fixed one-request child used literal arguments, disabled the shell, scrubbed Node execution overrides, applied named heap/deadline/output presets and the remaining-operation deadline, and required fatal UTF-8 decoding, exact correlated framing and bounded close before replacement. See the approved corpus Lua launcher amendment below.
- `scripts/selected-source-analysis-worker.mjs`: actual parseToc/parseXml/analyzeLua/analyzeXml/mapXmlValueRanges calls; direct invoked/returned counters live around each API call. Corpus Lua uses the actual API wrapper in a2048MiB/8MiB-stack parser thread. XML remains256MiB/10seconds/32MiB-output; bounded Lua128MiB/10seconds/32MiB-output; corpus Lua2048MiB/60seconds/128MiB-output. TOC uses the256MiB/10second/32MiB projection transport. These are supervised tooling limits, not a hard synchronous main-process CPU sandbox.
- `scripts/selected-source-analysis.mjs`: bounded own-cell request snapshots and independent whole-result checks. TOC selection facts, ordered duplicate files/SavedVariables, source paths, suffix/client metadata, condition grammar and six diagnostic codes are bound to original effective lines. The condition regex deliberately matches the parser's exact non-Unicode ignore-case grammar. Failed-call receipts must be a possible language-specific/interleaved API prefix. They may confirm a direct failed attempt, never a fabricated syntax verdict. Internal SDK subcalls are not additional direct-call credit.
- `scripts/selected-source-syntax-validation.mjs`: source/range/decoded-span checks derived from the existing inventory checker, strengthened for the graph boundary with exact rejection diagnostics, original lexical construct coverage, preorder/parent association, complete attributes/text, expanded names/namespace bindings, entity decoding and normalization. Literal text cannot masquerade as an undecoded entity-bearing filename.
- Existing private provider/inline validators accept an explicit expected requester ID and ordered inherited conditions. Their omitted-argument legacy default remains exactly corpus-xml with no inherited conditions. Foreign condition sources must equal the independently supplied validated TOC projection; they are not treated as XML-owned ranges. Inline contexts remain explicit, missing handlers remain skipped, unknown activation is preserved, and original disjoint maps are checked independently. Copied descriptor/value/source records count against the inline per-file cap; provider descriptor/value charging follows its existing SDK record cap. Standalone corpus Lua does not inherit the inline-only50,000-declaration cap.

Each child is reaped before a successful result is returned. GraphAnalysis has the approved shape; its inline rows do not leak internal decoded-path transport fields. A failure anywhere in whole-result validation publishes no prefix. Returned private errors use fixed messages. Full graph retention/time/read accounting must still be composed with the native host before enabling installed inputs.

## Regression and review evidence

`tests/selected-source-analysis.test.mjs` uses authored strings only. It exercises actual TOC/Lua/XML/provider/inline/map APIs, corpus-thread execution,50,001 corpus declarations, duplicate entries, requesting AddOn and exact inherited conditions, conditional/unknown activation, missing contexts, split-identifier original maps, real syntax rejection, legacy-default rejection, coherent late projection corruption, invalid array lengths, exact/over-limit inherited-copy accounting, failed-call sequencing, process crash/late output/framing/UTF8/caps, fixed executable arguments, startup deadlines and unreaped-child ownership.

The two explicitly delegated reviewers inspected source/contracts without executing project code, editing, further delegation or reading installed/private/foreign inputs. Their P2 findings were source-binding, missing diagnostics, Unicode regex drift, copied-condition charging, invalid array lengths, expanded XML names/decoding and impossible failure receipts. Parent retained authored controls and hostile mutations for the corrections. Both final correction reviews found no remaining actionable material issue in this scoped boundary. Static review and parent execution are separate evidence; exact commit and supported CI belong to the [PR30 acceptance record](https://github.com/Zilvereyes/wow-addon-sdk/pull/30).

Parent focused runs first exposed a null-prototype expected-condition snapshot mismatch and incorrect authored fixture assumptions (namespace policy and top-level Lua varargs). Corrected actual controls pass. A subsequent coherent TOC target/restriction mutation was explicitly reproduced red before its source-derived correction. Later focused execution of parser plus legacy-inline tests, host41603, exits0 with24tests before the final exact-regex/control addition; final full evidence must supersede that snapshot.

First broad parent host93361 exits1:469total/464pass/onefailure/4Linux-onlyskips. The failure was the existing native lower-retention test waiting for stock PowerShell startup under parallel load, yielding graph-native-attributes before the intended graph-native-budget assertion. The lower-retention-only assertion now uses controlled attributes; real stock-helper/junction/reparse tests remain native. No production deadline was increased. That failed mixed snapshot is not final acceptance. The final gate first verifies the unchanged registered PowerShell bytes, then runs check:all, strict api:extractor and check:packages sequentially; its terminal result and exact-head supported CI are recorded in PR30.

The next broad host25920 also exits1:472total/465pass/threefailures/4skips. All parser regressions pass; native link, source-integrity and empty-source tests instead fail at stock PowerShell startup (graph-native-attributes). This exposes shared-host scheduling pressure rather than the intended native assertions. `scripts/run-tests.mjs` now serializes test files on Windows using the supported Node test-concurrency flag; Ubuntu keeps its existing scheduling. Every test and fixed production deadline remains enabled. Existing discovery/failure-propagation checks exercise this runner as well. Fresh full/native acceptance must follow this scheduling correction; neither failed run is relabelled green.

At committed parser source c86d33813b25a2ec2be14d84a2901cf0bc411ce1, parent serialized full host51592 still exits1:472total/467pass/onefailure/4skips, all19 parser cases pass. The native root/intermediate/final-link fixture instead fails during helper initialization before its expected link verdict. Exact-head push44179071928 is4/4success and PR44179084559 is3/4success; failed Windows24 job134378253088 has the same helper-availability class near10.22seconds (472/467/onefail/4skips). All8logs were inspected; seven passing jobs have all required gates, while the failed job does not reach strict Extractor or package checks. PR merge18790831226a285a2188cf30854b6764caec55f3 has exact main7b01bd0/c86d338 parents and head-identical treeead0c2acd1e0a85cb6ad6ccdb15fc8a4c1f95770. These failed original results remain history, not clean acceptance or an unchanged retry loop. Timing and the transport timer support a deadline explanation; the adapter deliberately suppresses inner errors, so this is not claimed as a proved PowerShell syntax defect.

The user explicitly approved [the concrete A–D deadline amendment](https://github.com/Zilvereyes/wow-addon-sdk/pull/30#issuecomment-6961659940). Windows inspect now has a fixed maximum/default30seconds, including startup and replacement and clamped to remaining operation time. Both close and replacement reaping retain a separate10second maximum (or the smaller remaining inspect/lowered test budget). An unreaped child stays owned and cannot gain a successor; there is no automatic retry. The original PS bytes/registration, argv, path rules, overall15minute graph limit and all Lua/XML presets remain unchanged. Trusted timer injection is only a deterministic test seam, never profile data.

Four new authored transport cases verify29,999/30,000 and remaining11,999/12,000 boundaries, independent10second close and replacement caps, no duplicate child after expiry, a timely9second close retaining21seconds for startup/response, and late close acknowledgements arriving before overdue timer callbacks. Both reap paths recheck absolute monotonic deadlines after acknowledgement. Independent review caught the replacement wait initially sharing the30second deadline; parent reproduced it red, then corrected it and retained the legitimate29,999 response control. The first reap test also needed a deterministic clock/cleanup correction; its hung fake-only host45138 was explicitly interrupted and exited1, not reported as a pass. Corrected final focused transport execution exits0 with13cases. The subsequent73-case/all-gate host15513 exits0 (72pass/oneLinux-onlyskip) before the final late-acknowledgement correction; the final correction has its own red/green regression and exact-head CI requirement. Intermediate host63975 runs the72-case selection/native/parser/discovery subset and all build/architecture/dependency/API/export/strict/payload gates, final exit0; final corrected-snapshot targeted/all-gate evidence and new exact-head supported CI are recorded in PR30. No new whole local-suite success is inferred from the targeted run.

Final corrected runtime/test snapshot, parent host67720: `node --test --test-concurrency=1 tests/selected-source-analysis.test.mjs tests/selected-source-context.test.mjs tests/selected-source-native.test.mjs tests/selected-source-profile.test.mjs tests/selected-source-selection.test.mjs tests/selected-source-windows.test.mjs tests/hardening.test.mjs`, exit0,74total/73pass/oneLinux-onlyskip/zero failures. This includes actual native helpers and all19 parser/four new deadline regressions. Final static absolute-deadline review finds no remaining material finding. Exact new commit and full supported CI, including fresh build/architecture/dependencies/API/strict Extractor/exports/licensed-payload checks, remain attributed to the PR acceptance record after push.

## Next dependency and limits

Compose this validated port with context/selection and native file ports in an iterative engine. Implement complete analysis/cache keys, source and occurrence identities, duplicate/cycle order, guard sidecars, shared retained/read/time budgets and late shared-source invalidation before exact resolver origins/publication. Then implement the four-profile CLI and allowlisted aggregate, followed by safe installed graph acceptance. Keep the historical434TOC/5,242Lua/1,199XML/654inline verdicts and685missing contexts attributed to their original commit; no installed graph input was read here. No fullParsing/clientConformance, completed full graph, merge, tag, publication or installation write is claimed.

PowerShell Workbench is used only to gate unchanged registered bytes before native regression execution. No new PS artifact exists. The sealed native Codex Security scan remains evidence for its old5489ef5..fc2cb8e range, not this parser delta. The two scoped independent reviews cover the current parser boundary; no additional formal scan or configured MegaLinter run is claimed.

## Approved corpus Lua launcher lifetime

The launcher handles up to 32 consecutive corpus Lua requests. It creates and reaps a fresh parser thread for each file with the existing heap and stack settings. The same request and reply fields, API receipts, verification, output and deadline limits apply. A switch to another parser closes the idle launcher before starting the next child.

Intermediate replies are accepted after independent frame validation while the launcher remains alive. Adjacent extra bytes invalidate the pending frame. Later bytes observed while idle retire the launcher. Later bytes during a subsequent request must match that request's ID and framing. The 32nd reply and verified failure receipts wait for clean process close. A fault retires the process, and `exit` alone does not unlock replacement. No automatic retry is performed. The one-request TOC, XML and bounded Lua transports keep their close-and-validate path.

The authored Windows comparison against `0d9b9fe` matched all 40 complete replies and API receipts. Both candidate launchers closed with exit 0, with the first closing before request 33. Medians for one declaration were 656.2 ms before the change and 176.2 ms afterward. Medians for 3,000 declarations were 1,870 ms and 992 ms. This is a supervised authored comparison. Installed throughput depends on the actual mix and order of Lua, TOC and XML and on graph retention.

The first Windows Node 26.13.1 integration run exited 0 with 64 passes and no skips. It covered analyzer projections and close deadlines, worker imports, CLI and graph integration. The expanded launcher suite then exited 0 with 12 passes and no skips. It includes a real 33-request run proving clean rotation, the separate handle lifetime between `exit` and `close`, and exact correlated failure and recovery controls.

```powershell
node --test --test-concurrency=1 tests/selected-source-corpus-launcher.test.mjs
```

## Worker initialization by language

The worker imports a small shared receipt module. The TOC and standalone Lua branches initialize their own SDK APIs. The XML branch loads its syntax, provider, inline Lua and composition modules before any SDK invocation can earn receipt credit. The parent retains the full independent result validators. The existing process, fresh-thread and reap limits still apply.

On base `bc061bb`, the tightened import tests exited 1 with four failing cases. TOC and Lua could not initialize when the XML composition or parent validator import was blocked. The XML success case also observed the unnecessary parent validator import. The corrected tests block those imports on each relevant branch and require a real SDK result and receipt. For a missing XML composition module, an initialization exception or an absent named export, the XML test requires an empty response and checks that an instrumented `parseXml` was never invoked.

An isolated Windows Node 24.22.3 comparison (host 53180, exit 0) used the original worker and the implemented worker under the same supervisor. Both worker copies used the same absolute module targets. Three alternating runs per mode matched all 177 candidate replies and API receipts. Each 34-file Lua burst used two child processes and each 25-request mixed workload used 15. The Lua burst median was 7,016.0 ms before and 6,684.1 ms after. The mixed median was 24,957.1 ms before and 16,147.1 ms after. These are small authored samples under variable Windows host load. Installed throughput still requires a separate full run.

## Language switching on Windows

The authored supervisor benchmark used 13 Lua files, three TOCs and three XML files on Windows Node 24.22.3 at `5f50238`. It compared grouped and alternating input with the same requests, two series per order in grouped–mixed–mixed–grouped order. All 76 validated responses matched by authored source, including full SDK replies and API receipts. Every process closed successfully before the next process started. [Runnable benchmark](proposals/selected-source-language-switch-benchmark.mjs)

```powershell
node docs/proposals/selected-source-language-switch-benchmark.mjs
```

| Series | Requests | Lua launchers | One-shot processes | Total |
| --- | ---: | ---: | ---: | ---: |
| Grouped 1 | 19 | 1 | 6 | 4,044 ms |
| Mixed 1 | 19 | 4 | 6 | 15,063 ms |
| Mixed 2 | 19 | 4 | 6 | 42,094 ms |
| Grouped 2 | 19 | 1 | 6 | 11,679 ms |

The mixed runs recorded six switch-related launcher retirements through acknowledged close at 18–264 ms. Three extra launchers per mixed series had to reach first output. The TOC and XML one-shot timings also varied across series. An earlier longer authored attempt exited 1 on a one-shot deadline. A separate eight-request observation exited 0, with bare Node startup and close at 1,667 and 2,603 ms. These observations establish the extra process starts and bound the samples above. Installed timing and the causal wall-clock cost of a new launcher policy remain open.

The checked-in benchmark path reran successfully on the same runtime sources. Grouped totals were 2,374 and 2,495 ms, while mixed totals were 2,617 and 2,729 ms. Launcher counts and all reply bytes matched the earlier observation. Switch retirements completed in 13–14 ms in these two mixed series. These lower times show how strongly the first series varied with host conditions.

The next private observer records actual language transitions and launcher starts under the existing policy. It reports only counts and phase timings. This will establish the frequency of this cost in the installed request and show whether the next review should focus on Lua launcher lifetime or one-shot startup. A change to the approved process lifetime or concurrency requires a separate design decision. Stage 7 still requires the original full request, final integrity and policy-bound accounting.

### Stock process timing across Lua rotation

On Windows Node 24.22.3 (session 50049, exit 0), the authored benchmark used the stock parser port from `f5aef05a567a2404583507e8ef672767b0cf5345`. The extended mode ran grouped, mixed, mixed, grouped with 47 identical Lua inputs by source across series and three TOCs and three XML files in each series. In the mixed order three four-file Lua bursts preceded the final 35-file burst. Each order crossed the 32-file lifetime. The original 19-request mode also passed all four series.

```powershell
node docs/proposals/selected-source-language-switch-benchmark.mjs --rotation
```

| Series | Total | Lua process starts | TOC/XML process starts | Lua call 32 | First Lua call after rotation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Grouped 1 | 13,709 ms | 2 | 6 | 168 ms | 383 ms |
| Mixed 1 | 13,174 ms | 5 | 6 | 211 ms | 384 ms |
| Mixed 2 | 25,552 ms | 5 | 6 | 138 ms | 418 ms |
| Grouped 2 | 24,417 ms | 2 | 6 | 196 ms | 586 ms |

All 212 validated replies and API receipts matched by source against the first series. Each of 38 started processes produced a first response and closed cleanly before the next process started. Lua burst first replies took 295–1,461 ms. The spawn-to-first-byte interval for one-shot TOC/XML calls was 290–8,809 ms. The maximum occurred during a grouped TOC call. Overall times varied substantially even across repeated series with identical requests and process counts. Compare cold first replies, replies after rotation, and verified process close in the same timed workload before judging a different lifecycle. These observations use authored files under the current lifecycle. Full installed-corpus acceptance remains open.

## Larger authored phase comparison

Windows Node 24.22.3 at `d6941a7b33101e64a3f0ba0de66f73bb4003641b`. The stock and temporary instrumented supervisors produced 14 identical full replies and API receipts across six Lua, six XML and two TOC inputs. Lua inputs ranged from 58,459 to 235,821 bytes. Three XML inputs had 420 Includes each and produced 1,102,216-byte replies. Three had 48 inline scripts each. All 144 inline Lua calls and original-range maps were observed.

| Phase | Events | Sum |
| --- | ---: | ---: |
| Spawn to first worker marker | 9 | 10,856 ms |
| Spawn to first response frame | 9 | 16,229 ms |
| Standalone Lua analysis | 6 | 431 ms |
| XML syntax / policy analysis | 6 each | 431 / 741 ms |
| XML inline Lua analysis / range mapping | 144 each | 282 / 123 ms |
| XML parent JSON decoding / projection validation | 6 each | 109 / 1,558 ms |

The first two rows overlap. The worker marker follows static imports. An initial trace lost one Worker stderr event. Synchronous diagnostic writes restored exact event counts. The combined corrected probe exited 1 after completing the equality check because a 100 ms synthetic timeout also limited close. A follow-up used 100 ms of per-call time and the normal close budget. It exited 0 and confirmed `graph-analysis-timeout`, `graph-analysis-invariant`, `graph-analysis-exit` and `graph-analysis-output-limit`. All four controls confirmed close and returned no call receipt. The three XML failures in the installed replay remain unclassified.

A separate V8 heap probe exited 0 on the same Node build. Without a launcher old-generation flag, Workers requesting 256 and 2,048 MiB showed effective heap limits of 448 and 2,240 MiB. With `--max-old-space-size=256`, both showed 448 MiB. With `--max-old-space-size=2048`, both showed 2,240 MiB. `Worker.resourceLimits` still reported the requested values in all cases. These V8 heap statistics include overhead and measure no process RSS. [Launcher reuse proposal](PROPOSAL-SELECTED-SOURCE-LAUNCHER-REUSE.md)

## Lua projection field check

The graph and inline validators check the exact own enumerable field set by key count and membership. Lua projections choose the expected declaration fields and activation once per association. Both the wire and retained-copy validation still check source spelling and ranges, inherited conditions, activation and receipts.

An authored comparison on Windows Node 24.22.3 used actual SDK Lua projections with 2,000 and 12,000 declarations. After three warmup calls per implementation, 14 alternating calls per implementation measured only the projection validator. The upper middle observation fell from 19.57 to 5.29 ms and from 158.25 to 48.79 ms respectively. Both validators returned identical results and rejected the same four authored mutations. Host session 54018 exited 0. This measures one validator invocation and gives no estimate for complete corpus throughput.

The Windows Node 24.22.3 focused run (host session 91245) exited 0 with 43 passes. It covered the graph analyzer and engine, legacy inline validation and the inline worker. The new regression accepts reordered properties and rejects a non-enumerable required key with an extra enumerable key or a relocated range. Exact-head supported CI and the installed corpus checkpoint are tracked in [PR #30](https://github.com/Zilvereyes/wow-addon-sdk/pull/30).

## Follow-up on the three XML timeouts

A private Windows Node 24.22.3 check used the three source identities recorded by the timed-out full run on `e5931e268307592ada3927d169a6ec7beb279a86`. It verified their original bytes through the same native read port, used the approved XML and inline profiles, inferred the requester from the containing AddOn and supplied empty inherited conditions. Each source ran twice in both the stock analyzer and a temporary phase-instrumented copy. The two passes alternated ordering. All 12 one-shot calls returned, all six pairs matched in their full projections and receipts, and all three sources passed the final native reread. The command exited 0. Local command result is `c5d74e`.

| Observed phase | Range across six instrumented calls |
| --- | ---: |
| Spawn to first Node marker | 115–261 ms |
| Spawn to first worker module marker | 119–267 ms |
| SDK imports | 41–94 ms |
| `parseXml` / `analyzeXml` | 12–41 / 12–72 ms |
| Spawn to first frame | 202–571 ms |
| Parent projection validation | 7–95 ms |
| Complete instrumented call | 225–758 ms |

Stock calls took 271–661 ms. The two spawn intervals overlap. This isolates the same bytes and parser settings under an available host. The original inherited conditions and remaining graph budget may differ. Two rejections in the full graph occurred before the global deadline and the third at the deadline. The isolated timings do not determine the cause of those earlier rejections. [Full run and CI](https://github.com/Zilvereyes/wow-addon-sdk/pull/30)

## Authored single-thread stack prerequisite

A separate Windows Node 24.22.3 check used the existing 256 MiB old-generation process flag. Each temporary candidate process handled one authored request in one fresh Worker with empty `execArgv`, a 256 MiB old-generation request and the default stack. The Worker had to exit cleanly before its reply was framed. It reported a 4 MiB stack and 448 MiB effective V8 heap limit across all five launches. Effective heap includes V8 overhead.

All five candidate replies matched the stock one-shot results and receipts, including XML depth 255 and 256 with inline Lua, depth 257 returning `XML0003`, a 380-reference XML with UTF-16/entity coverage, and duplicate TOC rows. The command exited 0 (local run `6be70e`). The threaded variant took 87–209 ms longer per pair in these one-shot comparisons. This includes starting and joining a thread in a newly spawned process. Testing reuse across a mixed workload, memory and the remaining platform matrix belongs to the proposed prototype. [Prototype acceptance](PROPOSAL-SELECTED-SOURCE-LAUNCHER-REUSE.md#prototype-and-acceptance)

## Bounded XML source line indexing

`mapXmlValueRanges` now indexes raw line ends only through the enclosing source span. Each previous line end determines the following line start using the original CR, LF or CRLF separator. The decoded index remains available for the entire value. Independent source correspondence and whole-batch failure still apply to every mapping. A required range beyond the enclosing line fails even if that later text has the same spelling.

An authored Windows Node 24.22.3 comparison transpiled the baseline and final candidate from the same source revision, `517ca349ef173c85861f2fccb0e1bea4b4f60b72`. Each timing used six alternating bursts of mapper calls on complete SDK provider outputs after a warmup. All mapping results matched exactly. Host session 5011 exited 0.

| Authored XML | UTF-16 units | Mapper calls per burst | Baseline median | Candidate median |
| --- | ---: | ---: | ---: | ---: |
| Scripts early, long trailing comment | 830,426 | 140 | 3071.20 ms | 10.71 ms |
| Scripts distributed across the XML | 577,259 | 140 | 3035.92 ms | 1815.65 ms |
| Scripts after 170,000 line breaks | 170,510 | 12 | 338.88 ms | 202.93 ms |
| Single-line XML | 404,006 | 100 | 1359.17 ms | 206.93 ms |

Earlier two-table alternatives were sensitive to dense line breaks or single-line inputs. The selected implementation stores only line ends and bounds the raw index. The measurements cover mapper calls, including validation of original source spelling. The full selected AddOn graph has its own acceptance requirement. [Current graph and CI](https://github.com/Zilvereyes/wow-addon-sdk/pull/30)

The Windows Node 24.22.3 build (`tsc -b --pretty false`) and focused mapper, XML provider, inline Lua and graph analyzer suite exited 0 (host session 7281, 60 passed). The added regression covers a partial UTF-16 surrogate span and literal U+2028 before CRLF. A relocated span pointing to the same text on a later line fails atomically.
