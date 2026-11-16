# v0.3.5 Architectural Freeze roadmap

The [v0.3.5 milestone epic](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) is the authoritative delivery checklist. [Design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6) records decisions for environment-aware selection and provenance.

**Goal:** Deliver at least a v0.3.5-ready SDK under the [execution goal](GOAL-v0.3.5.md), with release publication subject to explicit sign-off.

**Verified prerequisite:** PR #5 was merged into main on 2026-11-16 as `44b138d5152bb2e43ae43afa793e3613d11b6de5`. Its reviewed head was `7fe976a`; all eight push/PR matrix jobs passed. This is infrastructure completion, not a v0.3.x release.

**Core accepted:** v0.3.5 is integrated through PR #21 / `0cee5c9`, following v0.3.4 composition. All 142 core tests and four supported final-head/main CI jobs passed. The [pre-freeze review](PRE-FREEZE-REVIEW.md) addresses protection, surface, named rules, union compatibility, placement and TOC errors. Built-in WoW policies remain separate verified-data work. See the [readiness mapping](RELEASE-READINESS-v0.3.5.md), [execution plan](EXECUTION-v0.3.5.md), [core migration](MIGRATION-v0.2-to-v0.3.md) and [measured corpus baseline](LOCAL-CORPUS-TESTING.md).

**Current extension:** approved [Lua A–E](DESIGN-LUA-ANALYSIS.md) adds an actual syntax/provider package without changing core edges. All 207 integrated tests and strict local gates pass; exact-head supported CI/review belongs to its PR/#11. Actual corpus parsing is measured with explicit encoding/budget/dynamic-environment limitations. XML/reference graph remain next. Tag/publication of the verified v0.3.5 cut is a separate decision; the overall goal stays active.

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
