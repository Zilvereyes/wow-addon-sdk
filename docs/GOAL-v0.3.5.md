# WoW AddOn SDK — minimum v0.3.5 goal

Deliver at least **v0.3.5 Architectural Freeze**: an editor-neutral SDK that selects the correct TOC for an explicit client environment, preserves every declaration's source provenance, evaluates supported conditions conservatively, and resolves globals without contributions from non-selected variants. The starting baseline was v0.2.0; repository hardening PR #5 is merged at `44b138d5152bb2e43ae43afa793e3613d11b6de5`. Check issue #7 for the current integrated baseline and delivery evidence. A version number alone does not satisfy this goal.

Use [roadmap issue #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7), [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6), and [docs/ROADMAP-v0.3.5.md](ROADMAP-v0.3.5.md) as the verified entry points. Recheck repository instructions, current heads, approvals and CI before acting; discover the relevant code and supported tools rather than assuming a local Windows checkout is available.

Deliver independently reviewed increments: v0.3.0 environment/identity contracts; v0.3.1 deterministic TOC selection; v0.3.2 provider-neutral condition provenance; v0.3.3 pure tri-state evaluation; v0.3.4 resolved registry integration; v0.3.5 architecture, migration and distribution acceptance. Routine implementation choices are autonomous. Public contract, identity, schema and game-semantics decisions remain subject to the explicit design approvals recorded in issue #6. Verify actual client suffix/condition behavior before encoding it.

Preserve five acyclic package boundaries, the existing 30 exports and their beta status, UTF-16 end-exclusive ranges, original paths, duplicate declarations and static registry behavior. Add reviewed beta exports as needed. Unknown conditions remain unknown. CI fixtures are authored synthetic data.

Verify through three distinct passes: focused requirement/regression tests; integrated build, architecture, dependency and strict API checks; final Ubuntu/Windows × Node 22/24 CI and actual package-content assertions for all five workspaces. Include LICENSE and exclude game assets. Resolve findings and rerun affected checks.

Deliver focused PRs, reviewed API reports, migration guidance, diagnostic documentation and an evidence-backed release-readiness record linked from issue #7. Tagging, npm publication, and subsequent PR merges require explicit approval. No scheduler or unattended execution is created by this document.

Delivering the minimum v0.3.5-ready SDK is your /goal; continue autonomously within these recorded approvals until the acceptance criteria pass or a specific decision or unavailable capability blocks progress.
