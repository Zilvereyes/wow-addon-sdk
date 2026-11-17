# Corpus accounting acceptance: 2026-11-17

Issue [#26](https://github.com/Zilvereyes/wow-addon-sdk/issues/26) is implemented in stacked [PR #27](https://github.com/Zilvereyes/wow-addon-sdk/pull/27), based on the frozen XML PR #25 head `956ae83`. Implementation commit: `947e559ee94e4a82b01a1e0261df2af3fd59f1e3`. SDK packages, versions, 65 beta exports, declaration baselines/reports, dependencies and package payloads are unchanged. The [file-level plan](PLAN-CORPUS-ACCOUNTING.md) records scope and failure cases. Merge remains a separate user decision.

## Verified behavior

| Requirement | Evidence / result |
| --- | --- |
| Count per-file TOC read/parser/invariant outcomes | Real CLI copies with real SDK wrappers distinguish good, syntax-rejected, oversized, failed-read, throwing-parser and invalid-projection cases. Two invalid TOCs increment invariantFailures twice without parsed/derived-metric credit. |
| Validate all Lua output before credit | The old implementation was reproduced with parsed.lua=3 instead of 1 for two bad late declarations plus one valid file. The corrected path gives one verdict, two invariant failures and no partial diagnostic/declaration/activation/source-reference credit. |
| Keep discovery and processing independent | Entry-limit/missing-root/profile failures leave TOC/Lua discovery/completeness false. Existing XML discovery controls and TOC-only failure controls still pass. |
| Bound TOC reading before allocation | Native temporary-file tests cover initial oversize before open, growth before/during read, same-size replacement, final-path replacement, shrink, real I/O errors, close and source preservation. Allocation/read requests stay within initial size plus one and caller cap plus one. |
| Reject FIFO replacement without hanging | O_NONBLOCK where available permits fstat rejection. A separate Linux-native Node child has a five-second kill bound and uses shell:false mkfifo with a two-second bound. Both Ubuntu Node 22/24 jobs actually pass this case; Windows explicitly skips it. |
| Preserve contracts and distribution | Git diff against the base contains no packages/API/manifest/lock change; seven-package build, architecture/dependencies/baselines/exports/license hashes, strict API Extractor and actual npm dry-run payload assertions pass. |
| Preserve installed input | Private before/after streaming SHA-256 checks match all 6,875 eligible source files, zero changed/added/removed/skipped links. Only aggregates are published. |

Parent-owned host execution used Windows, Node 26.13.1 and npm 12.2.0. Focused accounting/bounded-read tests: 15 total, 14 pass, zero fail, one Linux-only skip. Existing corpus regressions: 41 pass. Final `npm run check:all`, host session 44196, exits 0: **311 total / 310 pass / zero fail / one Linux-only skip**, plus build, seven-package architecture, dependency cruise, API baselines and exports. Strict `npm run api:extractor` and actual `npm run check:packages`, session 73167, exit 0 for all seven packages/payloads.

The initial full local run failed one test because the test's fstat wrapper discarded the new bigint option. Forwarding native options corrected the fixture; the focused helper cases and complete suite were rerun. This failed run is development history, not acceptance evidence. Independent read-only reviews checked metric commit ordering and descriptor/resource/replacement paths; the FIFO observation led to a fix and native CI regression. No sealed security scan, immutable filesystem snapshot or protection against every privileged concurrent writer is claimed.

## Supported CI

[PR run 44088709013](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44088709013) passes all four jobs on implementation commit `947e559`. Downloaded logs confirm:

| Job | Test result | Other required gates |
| --- | --- | --- |
| Ubuntu 24.04 / Node 22, job 134057892057 | 311 pass, zero fail/skip; native FIFO passes | Strict API Extractor / package contents pass |
| Ubuntu 24.04 / Node 24, job 134057891874 | 311 pass, zero fail/skip; native FIFO passes | Strict API Extractor / package contents pass |
| Windows / Node 22, job 134057891686 | 310 pass, zero fail, one Linux-only skip | Strict API Extractor / package contents pass |
| Windows / Node 24, job 134057891930 | 310 pass, zero fail, one Linux-only skip | Strict API Extractor / package contents pass |

Final-head evidence after documentation/evidence-only commits and automated review is maintained on PR #27. Earlier green runs do not automatically apply to new heads. No merge/tag/npm publication is performed by these checks.

## Actual combined corpus

Command on the same implementation snapshot:

```text
node scripts/inspect-addon-corpus.mjs <explicit-local-AddOns> --lua-analysis --lua-input-profile corpus-files --xml-analysis --max-file-bytes 134217728 --require-all-parsers
```

The generic byte cap is explicit; it does not increase the approved SDK input/node/depth/decoded limits or select a new transport. The command exits **1**, status **failed**, fullParsing=false. [Privacy-checked aggregate JSON](evidence/corpus-accounting-2026-11-17.json) contains exact counters/runtime/command/snapshot and aggregate integrity only; source paths, names, messages and individual hashes remain private.

| Language | Found / attempted / returned / validated syntax verdicts | Accepted / rejected | Remaining diagnostics |
| --- | ---: | ---: | --- |
| TOC | 434 each | 428 / 6 | TOC0001:19 errors, TOC0004:12 warnings |
| Lua | 5,242 each | 5,241 / 1 | LUA0002:1; LUA0004:6,352 across 1,531 incomplete lexical projections |
| XML | 1,199 each | 1,146 / 53 | XML0002:53; previously classified namespace/multiple-root cases |

All languages report complete discovery, **zero read/backend/invariant/resource failures and zero oversized skips**; Lua/XML also report zero encoding/worker blocks. TOC decoding retains its existing replacement behavior rather than claiming strict codec validation. Source-reference checks: TOC 51,501; Lua 12,989; XML 281,315 with 85,212 decoded mappings. Lua returns 6,636 declaration occurrences, not unique active names. Hash audit: 6,875 checked/matching, zero changed/added/removed, integrity exit 0. Combined parser/integrity host session 32098 reaches terminal exit 1 because the corpus findings remain real, not because integrity failed.

The first combined run used the default generic 8 MiB byte cap and honestly reported seven oversized Lua skips (5,235 verdicts), zero invariant/read/backend failures and matching hashes. That result remains separate; it was not relabeled. The explicit-cap second run supplies all 5,242 Lua verdicts. Neither invocation executes Lua/XML or writes to the installation.

## Remaining work

The accounting/read-bound defect is resolved in the reviewable branch; integration awaits separate authorization in dependency order (#25 before #27). Keep #26 open until integration, with its implementation/acceptance linked. The overall [#11 goal](https://github.com/Zilvereyes/wow-addon-sdk/issues/11) stays open: XML frame/template/Script/Include provider and inline-Lua mapping need a concrete approved contract, followed by read-only selected-source traversal and provider resolution. Existing TOC semantics and all explained syntax/dynamic findings remain visible. No version number or all-file verdict count closes those requirements.
