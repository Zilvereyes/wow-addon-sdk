# v0.3.5 Architectural Freeze roadmap

The [v0.3.5 milestone epic](https://github.com/Zilvereyes/wow-addon-sdk/issues/7) is the authoritative delivery checklist. [Design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6) records decisions for environment-aware selection and provenance.

**Goal:** Deliver at least a v0.3.5-ready SDK under the [execution goal](GOAL-v0.3.5.md), with release publication subject to explicit sign-off.

**Verified prerequisite:** PR #5 was merged into main on 2026-11-16 as `44b138d5152bb2e43ae43afa793e3613d11b6de5`. Its reviewed head was `7fe976a`; all eight push/PR matrix jobs passed. This is infrastructure completion, not a v0.3.x release.

**Current increment:** v0.3.0 is in design review. See [environment and identity proposal](DESIGN-v0.3.0.md); its four decisions are proposed, not approved or implemented.

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

**Fixtures:** CI uses synthetic test data. A local read-only Classic Era check may use `C:\Games\World of Warcraft\_classic_era_\Interface\AddOns\`; never commit Blizzard client extracts or third-party AddOn files without rights.
