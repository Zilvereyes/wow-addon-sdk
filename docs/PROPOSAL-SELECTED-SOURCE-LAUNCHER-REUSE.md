# Proposal for bounded parser launcher reuse

The isolated authored comparison was approved and has Windows prototype measurements. Production lifecycle adoption is a separate decision. [PR #30](https://github.com/Zilvereyes/wow-addon-sdk/pull/30) tracks the work. The runtime follows [the approved graph contract](PROPOSAL-SELECTED-SOURCE-GRAPH.md) and its [corpus Lua amendment](REVIEW-SELECTED-SOURCE-ANALYSIS.md#approved-corpus-lua-launcher-lifetime).

## Dependency and measured problem

Stage 7 needs the original full 100-group Windows replay with four selected profiles, a 900-second operation limit, final read-only integrity and reconciled source and diagnostic counts. The full replay on `7d4ab84` reached 185 submissions and 156 validated replies, with 27 TOC, one Lua and one XML timeout. All six isolated calls on three of the TOC timeout sources subsequently returned matching replies. Previous full runs encountered XML timeouts as well. [Full replay and TOC isolation](REVIEW-SELECTED-SOURCE-CORPUS.md#full-replay-with-batched-windows-attributes-and-bounded-xml-indexing) · [Isolated XML phase results](REVIEW-SELECTED-SOURCE-ANALYSIS.md#follow-up-on-the-three-xml-timeouts)

The supervisor closes an idle corpus Lua launcher at a language switch and starts a process for each TOC or XML. The larger authored Windows comparison measured 10,856 ms from spawn to first worker marker across nine processes and 1,558 ms for six XML parent validations. The sample does not establish installed throughput. [Measurements](REVIEW-SELECTED-SOURCE-ANALYSIS.md#larger-authored-phase-comparison)

The authored stock-process baseline now crosses rotation in grouped and mixed orders. Use those same inputs and compare each full reply, burst first reply, call 32, first reply after rotation and acknowledged close against the prototype. The widest stock one-shot startup-to-first-byte interval approached the ordinary 10-second call cap. Report durations for each series and the range even when process counts agree. [Rotation measurements](REVIEW-SELECTED-SOURCE-ANALYSIS.md#stock-process-timing-across-lua-rotation)

## Candidate lifecycle

Keep one fixed corpus Lua launcher and one fixed TOC/XML launcher. Both may be live. One request and one parser thread may run at a time across them. Lua retains the existing 32-request lifetime, fresh thread, 2,048 MiB launcher flag and 8 MiB thread stack setting. The new launcher uses a fixed 256 MiB old-generation flag and handles at most 32 combined TOC/XML requests, each in a fresh Worker with empty `execArgv`. The prototype should measure Node's default Worker stack setting and test the accepted-input envelope, especially for deep XML. Both launchers join the thread before frame emission. Bounded Lua first retires both launchers and uses its existing exclusive one-shot process.

The proposal raises the live parser child ceiling from one to two. The two process flags sum to 2,304 MiB of configured old-generation limits. The active thread adds an isolate. Measure effective Worker heaps, peak child memory and combined process memory before proposing production adoption.

Retain the existing operation deadline and per-call clamp. TOC/XML keep 10 seconds and 32 MiB output, corpus Lua 60 seconds and 128 MiB, and bounded Lua 10 seconds and 32 MiB. Retain wire fields, receipt semantics, independent source-bound projection, ordering, duplicates, UTF-16 spans, unknown conditions, and public SDK contracts.

The 32nd reply waits for its launcher to close cleanly. Any worker fault, unsolicited idle output or close violation retires both launchers. Replacement requires both acknowledged closes. Fault retirement and shutdown share one absolute reap deadline of at most 10 seconds across both children, subject to the applicable remaining cleanup budget. One request ID sequence spans both launchers. Requests are never retried automatically.

## Alternatives

1. Retain the current exclusive lifecycle. This preserves one live child and the current startup behavior.
2. Keep idle Lua during one-shot TOC/XML. This saves Lua restarts, adds a second live child and still requires a new process per TOC/XML file.
3. Share the existing Lua launcher for all languages. The 2,048 MiB launcher flag experimentally overrides the effective heap of a Worker requesting 256 MiB, so this fails the existing TOC/XML memory constraint.
4. Use a neutral launcher without a Node old-generation flag, with separate Worker caps. The authored Windows probe distinguished the caps in this setup. Launcher memory under framing and projection pressure would need an independently enforceable bound.

The isolated authored prerequisite on Windows Node 24.22.3 matched XML depth 255/256, the resource result at 257, wide XML with source maps, and duplicate TOC rows with the default 4 MiB Worker stack. Its five one-shot Worker comparisons incurred 87–209 ms of additional elapsed time. The mixed-workload prototype should compare split launchers and Lua-only retention with the current exclusive lifecycle. Compare savings from removed process starts with the cost of fresh thread starts. Evaluate Windows and Ubuntu with Node 22 and 24. [Stack and timing observations](REVIEW-SELECTED-SOURCE-ANALYSIS.md#authored-single-thread-stack-prerequisite)

## Prototype and acceptance

1. Use temporary authored inputs under the current limits. Compare alternating TOC, Lua and XML, Lua and TOC/XML bursts crossing 32 requests, larger XML projections, deep XML, UTF-16 source spans, duplicate and unknown conditions, and real syntax errors. Require identical full replies and API receipts by source. Measure spawn counts, per-language time, effective heaps and process memory on Windows and Ubuntu with Node 22 and 24.
2. Verify both rotation boundaries, the two-child ceiling, one active parser, thread exit before emission, invalid IDs, late and idle output, deadline and output-limit behavior, and an unreaped process while the other closes. Require the existing fixed failure classes, no partial projection and no replacement while either child remains unacknowledged.
3. Review those results before a production change. If separately approved, scope implementation to `scripts/selected-source-analysis-client.mjs`, `scripts/selected-source-analysis-worker.mjs` and their integration tests. Run build, architecture, dependencies, API baselines, strict API Extractor, exports, licenses and package contents, with the full supported CI matrix on the reviewed revision.
4. Re-run the full local corpus with the original selection, limits and profiles. Record discovered, submitted, parsed, skipped, diagnostic and invariant counts by language, including separately classified transport failures. Verify source integrity after all reads. Keep Stage 7 open if the operation reaches its deadline or if acceptance evidence is incomplete.

## Isolated prototype results

The fixture runner at [`a3d3b05`](https://github.com/Zilvereyes/wow-addon-sdk/tree/a3d3b0545d0f3984eda718cec01a93330f26c73a/tests/fixtures/launcher-reuse-prototype) applies the proposed worker and supervisor patch to a temporary copy of the `5bb1917` runtime. Its sources are authored fixtures. The [experiment CI matrix](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44326124063) passed the comparison fixture, ten fault controls, memory observation and project gates on Windows and Ubuntu with Node 22 and 24. Every workload pair returned the same 66 validated responses per model and recorded 37 stock and four candidate starts.

| CI platform | Stock time | Candidate time | Sampled stock RSS | Sampled candidate RSS |
| --- | ---: | ---: | ---: | ---: |
| Windows Node 22.23.4 | 7,348 ms | 6,118 ms | 65,892 KiB | 119,700 KiB |
| Windows Node 24.22.2 | 4,902 ms | 3,847 ms | 74,876 KiB | 158,748 KiB |
| Ubuntu Node 22.23.4 | 4,719 ms | 4,563 ms | 85,936 KiB | 174,168 KiB |
| Ubuntu Node 24.22.2 | 2,969 ms | 3,236 ms | 89,920 KiB | 207,772 KiB |

On Windows Node 24.22.3, host session 86822 ran the full stock–candidate–candidate–stock comparison and exited 0. Across 264 calls all full responses and API receipts matched by source. The workload contained 33 Lua, 16 TOC and 17 XML inputs in each series. It covered duplicate declarations and references, an inherited unknown condition, astral UTF-16 positions, malformed Lua and XML, deep XML and an XML projection with 240 references and 32 inline Lua calls. A preliminary stock smoke run encountered a TOC timeout before its first reply.

| Series | Elapsed | Child starts and acknowledged closes | Maximum live children |
| --- | ---: | ---: | ---: |
| Stock 1 | 104,628 ms | 37 | 1 |
| Candidate 1 | 27,633 ms | 4 | 2 |
| Candidate 2 | 13,790 ms | 4 | 2 |
| Stock 2 | 26,819 ms | 37 | 1 |

The candidate closed each pool at call 32 before crediting the reply. Call 33 started a replacement. The device produced widely different timings at equal work. The counts establish the reduced number of starts in this fixture. They do not establish full-corpus throughput.

The separate Windows memory observation exited 0 with six identical full responses per model, including an accepted 2,066,065-byte XML reply, accepted depth 256 and the expected XML depth-limit diagnostic at 257. It verified distinct fresh parser thread IDs and confirmed each thread joined before its frame. Effective V8 heap limits observed in the candidate were 2,240 MiB for Lua and 448 MiB for TOC/XML, including V8 overhead. Stack settings were 8 and 4 MiB. Peak sampled combined child RSS was 74,604 KiB for stock and 147,160 KiB for the candidate using the most recent sample from each live child. This is a sampled observation for this authored input.

Ten fault controls passed on Windows Node 24.22.3. They cover invalid IDs, adjacent trailing output, oversized output, exact call deadlines, late idle output during a pending sibling request, blocked replacement, bounded Lua exclusivity, nonzero graceful exit and a shared reap deadline that is not renewed after a fault. The first boundary control used a non-clean mock close while expecting clean closure. The corrected control uses exit 0 and a separate control asserts rejection for a nonzero graceful exit.

The isolated candidate also passed three existing authored native CLI controls after the Windows helper registration was included in the scratch copy. They verify complete TOC, Lua and XML analysis with matching source bytes, an honest incomplete aggregate and fixed failure text at an exhausted resource budget. These controls cover the native host composition used for the approved local experiment.

The two earlier installed runs supply an order proxy for estimating process starts. The private first-read ledgers each reconciled with submission counts and all recorded rejected paths at their respective submission indices. For the 185-call prefix on `7d4ab84`, the proxy models 102 stock starts and seven candidate starts in the clean case. Forcing both candidate pools to retire at each recorded rejection gives 34. The 342-call prefix on `e5931e2` models 155 stock starts and 12 or 14 candidate starts under those same assumptions. The proxy records no observed child starts and fixes the prefix and rejection positions across models.

Before a production decision, review the reply boundary and memory tradeoff. The stock supervisor waits for the one-shot TOC/XML child to close before crediting its frame. The candidate validates a complete frame during a continuing process lifetime. Later idle output retires both retained processes. If it arrives after a result was delivered, that result has already been credited. The prototype verifies an internal shared 10-second close schedule. An integrated host must propagate any tighter applicable cleanup allowance. The isolated read-only replay returned 309 parser replies before the graph failed native source and directory integrity. The subsequent diagnostic replay recorded zero native failure events before reaching the operation deadline. [Current diagnostic replay](REVIEW-SELECTED-SOURCE-CORPUS.md#full-diagnostic-replay-with-the-isolated-launcher-prototype) Full Stage 7 acceptance still requires evidence from the integrated build and the original local corpus traversal through final integrity.

## Integrated authored comparison

The maintainer benchmark uses the same selected-source graph, native file port, profiles, SDK build and 900-second operation limit for both launchers. The split variant is copied into a temporary directory from the pinned prototype patch at `a3d3b0545d0f3984eda718cec01a93330f26c73a`. The graph and its shared budget use the same implementation in both modes. The fixture creates its own AddOns tree and accepts no source path argument. [Benchmark](proposals/measure-selected-source-integration.mjs)

From a built checkout with the pinned prototype commit available locally, run `node docs/proposals/measure-selected-source-integration.mjs --smoke` for one short pair and `node docs/proposals/measure-selected-source-integration.mjs --ab` for the four-group workload. With no arguments, the benchmark uses stock, split, split, stock order. The larger workload selects four of eight TOC candidates and reaches 49 standalone Lua files, including a first burst of 34, and 12 XML files with 24 inline bodies. Duplicate TOC file references reuse the same analysis. The benchmark checks the complete reply digest and aggregate equality, exact source counts, read-only first opens and rereads, successful directory verification and unchanged source bytes. Unknown XML declaration activation remains visible in the expected `incomplete` policy status.

The initial four-group attempt on Windows Node 26.13.1 (host session 6751) stopped at the first stock aggregate assertion, exit 1. A smaller run (80505) identified one failed TOC worker call, with both source and all three directory fingerprints matching. The next stock smoke on Windows Node 24.22.3 (38557) completed all six source analyses and matched all integrity checks. Its six inline declarations had unknown activation. That exposed an incorrect expected `passed` value in the harness; the assertion now expects `incomplete` with the exact unknown count.

The corrected Windows Node 24.22.3 smoke pair (13894) exited 0 on SDK merge commit `18189b78782e2f70203e4f62273d55bb939d0915` with this authored harness. Both modes accounted for 2 TOC, 1 standalone Lua and 3 XML files, plus 6 mapped inline Lua bodies, with zero worker or invariant failures. Each mode opened and verified all six sources read-only and matched all three directory fingerprints. The graph completed and published the same aggregate, including the six unknown activation outcomes.

| Measured phase | Stock | Split prototype |
|---|---:|---:|
| Complete graph wall time | 54,050 ms | 19,149 ms |
| TOC analyzer calls | 13,127 ms | 4,757 ms |
| Lua analyzer calls | 5,842 ms | 3,323 ms |
| XML analyzer calls | 16,270 ms | 2,294 ms |
| Final source and directory verification | 694 ms | 402 ms |

The overall time includes host setup, graph work, reply digesting and publication. This single pair establishes equivalent completed work in the short fixture. Timing on the local Windows host varied between runs, and the smoke pair is too small to predict installed throughput or launcher memory. Production launcher adoption and Classic Era acceptance remain open in [#11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11).

The four-group Windows Node 24.22.3 pair (`--ab`, host session 26509) exited 0. Both variants returned the same reply digest and aggregate with 8 TOC, 49 standalone Lua and 12 XML syntax verdicts, and 24 mapped inline bodies. No source request failed or was skipped before a syntax verdict. The 69 source fingerprints and 9 directory fingerprints matched for each variant. All 24 unknown XML declaration activations remained visible, so the aggregate returned `incomplete`. The first Lua burst crossed the 32-request rotation boundary.

| Measured phase | Stock | Split prototype |
|---|---:|---:|
| Complete graph wall time | 103,571 ms | 71,603 ms |
| TOC analyzer calls | 18,363 ms | 8,171 ms |
| Lua analyzer calls | 36,063 ms | 41,090 ms |
| XML analyzer calls | 36,548 ms | 8,877 ms |
| Final source and directory verification | 3,768 ms | 3,476 ms |

The observed wall-time reduction was 30.9%. The split variant spent more time in standalone Lua calls, which already reuse a launcher in the stock implementation. This single A/B pair provides evidence of a complete authored traversal with integrity checks. A counterbalanced run can test repeatability. The installed workload remains open and launcher adoption still requires a production design decision.
