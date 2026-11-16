# v0.3.5 Architectural Freeze roadmap

The [v0.3.5 milestone epic](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) is the authoritative delivery checklist. [Design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6) records decisions for environment-aware selection and provenance.

**Goal:** Deliver at least a v0.3.5-ready SDK under the [execution goal](GOAL-v0.3.5.md), with release publication subject to explicit sign-off.

**Verified prerequisite:** PR #5 was merged into main on 2026-11-16 as `44b138d5152bb2e43ae43afa793e3613d11b6de5`. Its reviewed head was `7fe976a`; all eight push/PR matrix jobs passed. This is infrastructure completion, not a v0.3.x release.

**Current increment:** v0.3.2 [condition provenance](DESIGN-v0.3.2.md) is integrated through PR #17 as `ff6656e`, following v0.3.1 selection in PR #16. Its 95 local tests and supported final-head CI passed; issue #7 maintains post-merge evidence. Next are conservative condition evaluation and resolved registry composition. A built-in WoW loader policy remains a separate verified-data task. See the [detailed execution plan](EXECUTION-v0.3.5.md), [migration notes](MIGRATION-v0.2-to-v0.3.md), [repository review](REVIEW-2026-11-16.md) and [measured local corpus baseline](LOCAL-CORPUS-TESTING.md). Lua/XML are inventoried, not yet parsed; the authored [syntax fixture catalog](../tests/fixtures/README.md) prepares their later acceptance tests.

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
