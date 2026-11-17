# WoW AddOn SDK — minimum v0.3.5 goal

Deliver at least **v0.3.5 Architectural Freeze**: an editor-neutral SDK that selects the correct TOC for an explicit client environment, preserves every declaration's source provenance, evaluates supported conditions conservatively, and resolves globals without contributions from non-selected variants. The starting baseline was v0.2.0; repository hardening PR #5 is merged at `44b138d5152bb2e43ae43afa793e3613d11b6de5`. Check issue #7 for the current integrated baseline and delivery evidence. A version number alone does not satisfy this goal.

Use [roadmap issue #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7), [design issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6), and [docs/ROADMAP-v0.3.5.md](ROADMAP-v0.3.5.md) as the verified entry points. Recheck repository instructions, current heads, approvals and CI before acting; discover the relevant code and supported tools rather than assuming a local Windows checkout is available.

Deliver independently reviewed increments: v0.3.0 environment/identity contracts; v0.3.1 deterministic TOC selection; v0.3.2 provider-neutral condition provenance; v0.3.3 pure tri-state evaluation; v0.3.4 resolved registry integration; v0.3.5 architecture, migration and distribution acceptance. Routine implementation choices are autonomous. Public contract, identity, schema and game-semantics decisions remain subject to the explicit design approvals recorded in issue #6. Verify actual client suffix/condition behavior before encoding it.

Preserve five acyclic package boundaries, the existing 30 exports and their beta status, UTF-16 end-exclusive ranges, original paths, duplicate declarations and static registry behavior. Add reviewed beta exports as needed. Unknown conditions remain unknown. CI fixtures are authored synthetic data.

Verify through three distinct passes: focused requirement/regression tests; integrated build, architecture, dependency and strict API checks; final Ubuntu/Windows × Node 22/24 CI and actual package-content assertions for all five workspaces. Include LICENSE and exclude game assets. Resolve findings and rerun affected checks.

Deliver focused PRs, reviewed API reports, migration guidance, diagnostic documentation and an evidence-backed release-readiness record linked from issue #7. Apply the session authorization update below to routine reviewed green integration and verification of the requested core milestone. Tagging and npm publication remain explicit decisions. No scheduler or unattended execution is created by this document.

Delivering the minimum v0.3.5-ready SDK is your /goal; continue autonomously within these recorded approvals until the acceptance criteria pass or a specific decision or unavailable capability blocks progress.

## Session authorization update: 2026-11-16

The user clarified: **“[ Fuld adgang ] = Godkendelse af diverse ting.”** They also explicitly approved merge of PR #16 and implementation of v0.3.2 A–D. In this project's scope, that instruction is treated as standing authorization for routine implementation, verification, GitHub maintenance and reviewed green integration of approved increments, without repeated permission requests. PR #17 integration proceeded under that interpretation. This records the user's instruction and its project-scoped application; the app access setting alone is not the source of authority.

Keep material new semantic/dialect/schema decisions explicit in #6. Tagging/publication and changes to the installed game remain separate from routine SDK work. Do not request the already-recorded v0.3.0–v0.3.4 approvals again; v0.3.3 A–E are in comment 6918223915 and v0.3.4 A–E in comment 6919012067.

The user subsequently selected the solo-owner branch-protection model: PRs and all four supported CI checks on an up-to-date branch, enforced for administrators, with chat sign-off rather than a separate GitHub approving reviewer. The [pre-freeze review](PRE-FREEZE-REVIEW.md) records the configured checks and outstanding acceptance. The original minimum milestone does not end the broader goal: actual TOC/Lua/XML parsing/provider/reference tests against the opt-in local corpus must still be delivered, and beta status remains in force.

Core v0.3.5 is integrated through PR #21 / `0cee5c9`, with 4/4 supported post-merge jobs. The user explicitly approved [Lua analysis A–E](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6920213019): one optional package, pinned reviewed MIT backend, explicit Lua 5.1/UTF-16/resource profile, conservative lexical provider and three beta exports. Its [implementation design](DESIGN-LUA-ANALYSIS.md) continues under #11. Do not request this approval again. Closing the delivered v0.3 design record does not close the broader parser goal or authorize tag/npm publication.

Lua analysis is integrated through PR #22 / `3fa9416`, with 207 tests and 4/4 post-merge supported CI. The user subsequently approved [Lua corpus-profile A–E](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6925438729): one additive type/options, explicit larger fixed profile, opt-in hashbang/byte transport and supervised read-only corpus run. [The approved implementation contract](DESIGN-LUA-CORPUS-PROFILE.md) preserves the bounded default. Do not ask again. XML A–F was subsequently approved on 2026-11-17 in [the decision record](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6947486320); the full three-parser/provider/reference goal stays open.

## Current authorization boundary: 2026-11-17

The active user instructions require separate authorization for merge, tags and package publication. This supersedes the historical routine-integration interpretation above. XML A–F approval authorizes its implementation, tests, read-only corpus work and GitHub PR maintenance. It does not authorize those separate actions. Preserve unrelated work and keep the broader provider/reference goal open. See [XML acceptance](REVIEW-XML-v0.5.0.md).

On 2026-11-17 the user explicitly approved the selected instruction “Godkend merge af begge og fortsæt” for PR #25 and #27. Both were merged in dependency order after fresh supported CI, as `c0c825d` and `3c99b33`. This approval applies to those two merges and continuation within the existing project scope; it does not grant tag/publication/deployment rights or approve new XML provider/handler/graph contracts. [The next provider A–D proposal](PROPOSAL-XML-PROVIDER.md) remains a decision request, not an implemented contract.
