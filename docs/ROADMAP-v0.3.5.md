# v0.3.5 Architectural Freeze roadmap

The [v0.3.5 milestone epic](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) is the authoritative delivery checklist. [Design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6) records decisions for environment-aware selection and provenance.

**Goal:** Deliver at least a v0.3.5-ready SDK under the [execution goal](GOAL-v0.3.5.md), with release publication subject to explicit sign-off.

**Verified prerequisite:** PR #5 was merged into main on 2026-11-16 as `44b138d5152bb2e43ae43afa793e3613d11b6de5`. Its reviewed head was `7fe976a`; all eight push/PR matrix jobs passed. This is infrastructure completion, not a v0.3.x release.

**Core accepted:** v0.3.5 is integrated through PR #21 / `0cee5c9`, following v0.3.4 composition. All 142 core tests and four supported final-head/main CI jobs passed. The [pre-freeze review](PRE-FREEZE-REVIEW.md) addresses protection, surface, named rules, union compatibility, placement and TOC errors. Built-in WoW policies remain separate verified-data work. See the [readiness mapping](RELEASE-READINESS-v0.3.5.md), [execution plan](EXECUTION-v0.3.5.md), [core migration](MIGRATION-v0.2-to-v0.3.md) and [measured corpus baseline](LOCAL-CORPUS-TESTING.md).

**Integrated extensions (2026-11-17):** main7b01bd0511fbe651d1234848f73140c9d012c2a9 includes approved Lua, XML syntax/provider and inline Lua contracts through separately authorized PR28/29 integration: source0.7.0/eight packages/78beta exports, with unchanged core boundaries. [Post-merge CI44146167135](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44146167135) passes all four supported jobs (Ubuntu407pass/0skip; Windows404pass/3LinuxFIFOskips), including strict API/distribution gates. Actual local corpus evidence remains incomplete:654inline bodies analyzed,685missing contexts and known syntax/provider findings; see [issue11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11). The earlier207-test Lua-only checkpoint is historical.

**Selected-source graph status (2026-11-19).** [PR #30](https://github.com/Zilvereyes/wow-addon-sdk/pull/30) integrated A–F. The approved [launcher and Worker lifetimes](PROPOSAL-SELECTED-SOURCE-LAUNCHER-REUSE.md) are implemented, including XML reuse in [PR #43](https://github.com/Zilvereyes/wow-addon-sdk/pull/43). [All four supported CI jobs](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44486350631) passed at `e3492f1174558b99a03fa93c2c71b51871794517`. A write-free metadata probe matched 2,019 directory snapshots. The same revision's four-profile parser replay returned 3,553 validated responses before its 900-second deadline, before final source or directory verification. [Latest receipts](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-7004546288) · [Earlier integrity failure](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-7004074611)

Stage 7 remains open. The [authored Lua phase comparison](REVIEW-SELECTED-SOURCE-ANALYSIS.md#lua-phase-checkpoint-at-e3492f1) separated startup, analysis, transport and reply validation. Next, measure the installed distribution of Lua input sizes and warm/cold calls to determine which of these costs account for elapsed time before changing production. The accepted graph, path and integrity contracts govern subsequent runs. Keep the same four profiles, supported CI, time cap and final file/directory checks for installed acceptance. [Ordered checkpoints](IMPLEMENTATION-SELECTED-SOURCE-GRAPH.md) · [Review index](REVIEW-COVERAGE-2026-11-18.md) · [Editor consumer](EDITOR-CONSUMERS.md)

| Version | Independently reviewed delivery |
| --- | --- |
| v0.2.x | PR #5 complete: reproducible CI, committed API reports, MIT license in every npm tarball. |
| v0.3.0 | Versioned client-environment contracts and logical AddOn vs TOC-variant identity. |
| v0.3.1 | Deterministic active TOC selection; explicit suffix precedence, fallbacks and ambiguity diagnostics. |
| v0.3.2 | Provider-neutral condition provenance preserving raw values and UTF-16 source locations. |
| v0.3.3 | Non-mutating condition evaluation with `active`, `inactive`, `unknown` results. |
| v0.3.4 | Resolved globals from selected TOCs and coexisting providers, with no cross-variant leakage. |
| v0.3.5 | Architectural Freeze: reviewed API snapshots, migration notes, test evidence and package/release gates. |

**Invariants:** Keep the five existing package boundaries and no dependencies on VS Code/LuaLS/Continue in core. Select TOC variants before evaluating conditions. Preserve static declaration provenance, and derive environment availability without changing source records. The `@beta` public surface is not SemVer consumer stability; that remains a separate v1.0 decision.

**Fixtures:** CI uses synthetic test data. An opt-in local read-only Classic Era check accepts the caller's AddOns directory; never commit Blizzard client extracts, installation paths or third-party AddOn files without rights.
