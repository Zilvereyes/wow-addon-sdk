# Proposal for bounded parser launcher reuse

Status: proposed for an authored prototype and review. The runtime follows [the approved graph contract](PROPOSAL-SELECTED-SOURCE-GRAPH.md) and its [corpus Lua amendment](REVIEW-SELECTED-SOURCE-ANALYSIS.md#approved-corpus-lua-launcher-lifetime). [PR #30](https://github.com/Zilvereyes/wow-addon-sdk/pull/30) tracks the work.

## Dependency and measured problem

Stage 7 needs the original full 100-group Windows replay with four selected profiles, a 900-second operation limit, final read-only integrity and reconciled source and diagnostic counts. The full replay on `e5931e2` reached 342 submissions and 339 replies. Two XML requests timed out before the global deadline and one timed out at it. The same three sources returned all 12 replies in the subsequent isolated checks. The earlier replay on `6c7d7d5` reached 838 submissions and 835 replies. [Current replay](https://github.com/Zilvereyes/wow-addon-sdk/pull/30) · [Earlier receipt](evidence/selected-source-windows-helper-v102-corpus-2026-11-18.json) · [Isolated phase results](REVIEW-SELECTED-SOURCE-ANALYSIS.md#follow-up-on-the-three-xml-timeouts)

The supervisor closes an idle corpus Lua launcher at a language switch and starts a process for each TOC or XML. The larger authored Windows comparison measured 10,856 ms from spawn to first worker marker across nine processes and 1,558 ms for six XML parent validations. The sample does not establish installed throughput. [Measurements](REVIEW-SELECTED-SOURCE-ANALYSIS.md#larger-authored-phase-comparison)

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
