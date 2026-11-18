# Detailed execution plan: core freeze and TOC/Lua/XML tests

## Goal and current boundary

Deliver the v0.3.5 core described by [issue #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7), then deliver actual TOC + Lua + XML parsing against an opt-in local Classic Era corpus. These are two measurable outcomes. v0.3.5 does not itself promise Lua/XML parsers. Package versions are milestones, not evidence of completion or publication.

The v0.3.0 environment/identity decisions A–D were approved in [issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6913838520). Subsequent recorded approvals cover selection, conditions, resolved views and the optional Lua package. Apply the [goal's session authorization update](GOAL-v0.3.5.md#session-authorization-update-2026-11-16): routine implementation, fixes/tests/docs, GitHub maintenance and reviewed green integration of approved increments proceed without repeated permission requests. Material new contracts, tags, publishing and game changes retain their separate decision gates. No third-party AddOn sources enter GitHub or CI.

## 1. Recover and establish v0.3.0

1. Read the handoff and referenced chats; verify approvals against issue #6 and current source. Fetch GitHub before relying on old PR status. Preserve the starting checkout and unrelated edits.
2. Branch from the proposed v0.3.0 documentation on verified merged hardening. Reconstruct interrupted cloud edits locally; do not claim those edits were pushed.
3. Run the existing 38 tests and architecture/API/export gates. Investigate failures separately from new-code failures. Normalize stale working-copy license line endings to the repository LF policy without weakening byte equality.
4. Add typecheck fixtures for required schema/client/family, optional unknowns, readonly fields and explicit nullable suffix. Demonstrate absent-export failures before implementing.
5. Add exactly four beta exports to metadata; retain schema 2, the previous declarations and static adapter behavior.
6. Test Mainline/Vanilla/Classic/unsuffixed variants, supplied shared identity, mixed path separators, case and Unicode, plus JSON roundtrip. Document caller-owned validation and shallow readonly.
7. Review the generated declaration diff and API Extractor report; regenerate only the affected approved API. Bump all five workspace manifests and internal ranges together, preserving dependency lock resolutions.
8. Correct PowerShell install/version checks; add strict API and package gates plus optional local corpus invocation. Check native exit codes at every boundary.
9. Add actual npm pack listing assertions: exact five names/versions, four allowed files each, LICENSE presence, no extra payloads. Cover npm 10 array and npm 12 record formats. Keep root exports/license audit separately.
10. Run locked install, integrated checks, strict Extractor, package gate and PowerShell parsing. Record supported-platform matrix results from the exact pushed SHA.
11. Publish the focused implementation PR and update #8/#7 with evidence. Keep #8 open until its review/integration criteria are met. No merge or release is implied.

## 2. Establish and triage the real corpus

1. Add a read-only Node runner outside core packages. Require the directory argument; bound entry count, byte count and depth; skip links/junctions; never execute source or follow TOC file references.
2. Test synthetic clean/malformed/Unicode manifests, limits, missing roots, links, determinism, unchanged source content and output privacy.
3. Parse every discovered TOC, check source-range invariants and JSON roundtrip. Record diagnostic histograms, processed counts and incomplete reasons. Inventory Lua/XML explicitly as unimplemented.
4. Run on the installed Classic Era directory locally. Publicly record only [aggregate results](LOCAL-CORPUS-TESTING.md). Keep the failed exit for existing diagnostic findings.
5. Reduce bare/double-hash headings and dotted custom keys to independently authored fixtures. Verify syntax using primary source examples and, where loader precedence cannot be proven from source, a small user-run in-game probe. Distinguish parser restrictions from malformed input.
6. Fix each demonstrated TOC fidelity defect in a separate focused change with exact ranges, recovery and regression tests. Retain rejection of malformed conditional SavedVariables headers; no unconditional leaks.
7. Re-run the same stable corpus and compare histograms. Every remaining diagnostic class needs a reason; neither suppress errors globally nor count Lua/XML inventory as parsing.

## 3. v0.3.1: deterministic TOC selection

1. Inventory observed suffixes and same-AddOn combinations without uploading names or files. Separate exact game type, family, mode and unsuffixed fallback.
2. The user approved an explicit caller-policy seam in [issue #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6916678035). Honor the supplied priority list, including unsuffixed placement. A built-in game precedence table is deferred until verified evidence exists. Unknown/future suffixes do not silently become fallback TOCs.
3. [PR #16](https://github.com/Zilvereyes/wow-addon-sdk/pull/16) implements five approved exports with selected/no-match/unresolved/ambiguous/invalid outcomes and source-bearing issues. Its final head `bd87481` passed 84 local tests and all four supported PR CI jobs. It was merged after explicit user approval as `fdb8d69`; all four post-merge main CI jobs passed. Subsequent condition contracts retain their recorded decisions.
4. Validate schema, non-empty identity, consistent source keys and contradictory known client/family combinations at the semantic boundary. Do not normalize original provenance or silently repair inputs.
5. Test Vanilla vs Classic vs unsuffixed; Standard vs Mainline; expansion clients; absent candidates; unknown environment/suffix; contradictory fields; duplicates and input permutations. Equal priority stays ambiguous rather than filesystem-order selection.
6. Show that losing variants remain inspectable and repeated selections do not mutate input. The proof that non-selected variants contribute no resolved globals belongs to the v0.3.4 composition step; selecting an ID alone does not change static registry visibility.
7. Update snapshots, migration and diagnostics after approved API additions; run all gates and the local TOC corpus.

## 4. v0.3.2: provider-neutral condition provenance

1. Trace each condition from parser directive/file/SavedVariable to the current adapter loss point. Preserve raw spelling/value, order and complete UTF-16 source reference.
2. Implement the [approved v0.3.2 design](DESIGN-v0.3.2.md): one provider-neutral descriptor, optional declaration field, independent adapter copies and explicit absence/wire compatibility. The user approved A–D in [issue #6, comment 6917507563](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6917507563). Do not turn parsing types into registry dependencies or request the same approval again.
3. Author synthetic TOC and future Lua/XML provider records for one symbol. Test duplicates, multiple conditions, casing, malformed/unknown descriptors and JSON roundtrip.
4. Retain old static `activationState` and `listGlobals` behavior. Add provenance without assuming truth. Review report/baseline changes and verify architecture.

## 5. v0.3.3: conservative condition evaluation

1. Implement the [approved explicit-policy evaluator](DESIGN-v0.3.3.md), with provider/name/field/include-exclude/casing rules declared by the caller. A built-in WoW condition table remains pending verified behavior. Define opaque game types/locales independently from project IDs and known game modes.
2. The user approved A–E, including the conservative AND truth table, unknown/malformed behavior, diagnostic/source contract and five additive exports in [issue #6, comment 6918223915](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6918223915). Do not request the same decision again.
3. Implement a pure evaluator after the failing truth-table tests. Return active/inactive/unknown with source and reason; perform no filesystem/network/runtime calls.
4. Test true/false/unknown, empty and malformed arguments, unsupported modes, multiple conditions, contradictory environments and two simultaneous evaluations of frozen input.
5. Keep source records immutable through resolution; update API/migration/diagnostic docs and all gates.

## 6. v0.3.4: resolved globals

1. Implement the [approved v0.3.4 design](DESIGN-v0.3.4.md), recorded in [issue #6, comment 6919012067](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6919012067). It composes selection → condition evaluation → a derived activeGlobals/entry view while keeping declaration-time activation and existing static callers unchanged. Do not request A–E again.
2. Use logical AddOn identity for selected coexisting declarations; retain exact per-variant source IDs as provenance. Non-selected TOCs contribute nothing.
3. Test scope conflicts in one active AddOn, mutually exclusive variants, symbols with TOC/Lua/XML origins, source ordering, conditional exclusions and unknown diagnostics.
4. Resolve the same immutable inputs for Retail and Classic independently. Assert no mutation, no cached environment leakage and deterministic ordering.
5. Run synthetic vertical integration and local TOC smoke checks; do not infer in-game runtime success from static analysis.

## 7. v0.3.5: freeze acceptance

1. Review every export/tag, schema migration, diagnostic and package edge. Preserve five approved acyclic core packages and beta policy.
2. Update architecture, migration, examples, changelog and detailed capability table from implemented behavior. Remove stale proposal/approval statements.
3. Validate locked dependencies, strict API reports, exact tarball listing/licenses and exclusion of assets. Check clean install on Ubuntu/Windows × Node 22/24 on one final SHA.
4. Re-run corpus after relevant parser/resolver changes and retain honest diagnostics/coverage. Record remaining upstream/unsupported cases as issues with synthetic reproductions.
5. Address the user's [pre-freeze review](PRE-FREEZE-REVIEW.md), including the [complete public surface inventory](PUBLIC-SURFACE.md), named rule, union compatibility, evaluator placement and every remaining corpus error. The user selected solo-owner PR protection with four required checks and chat sign-off. Routine green integration/core verification retains the recorded authorization; later tag/publication approval must be concrete. Architectural freeze is not v1 API stability.
6. Create a release-readiness record mapping each #7 checkbox to test/CI evidence. Keep actual second-provider evidence and the full three-parser project goal explicitly open; all exports stay beta.

## 8. After freeze: actual Lua and XML parsing

| Step | Deliverable and required tests |
| --- | --- |
| 8.1 Parser design | Lua A–E approved in #6 comment 6920213019 and implemented in the separate lua-analysis package. Existing registry/diagnostics/core edges stay unchanged. XML remains a separate grammar/provider/dependency decision. |
| 8.2 Lua syntax | Actual Lua 5.1 backend/profile with internal AST, public declarations/diagnostics and original offsets; the approved API deliberately does not expose backend AST. All 24 catalog cases, golden spans, scopes, malformed/resource cases and independently authored backend-fidelity regressions run through the SDK. Never execute Lua. Final supported CI and corpus evidence stay explicit. |
| 8.3 Lua provider | Actual assignments/function declarations with local/parameter/shadow exclusion, copied inherited restrictions, runtime-unknown flow and dynamic-environment incompleteness. Real parser output composes with TOC records through existing neutral contracts in tests. Keep installed-source graph association separate. |
| 8.4 XML syntax | Follow the [approved XML A–F contract and file-level acceptance plan](PROPOSAL-XML-SYNTAX.md). The user approved its package/dialect/source-map decision on 2026-11-17; implementation acceptance is tracked in REVIEW-XML-v0.5.0.md. Pure parse API for XML declaration, namespaces, comments, CDATA, attributes, entity handling and fail-closed malformed recovery with exact ranges; reject DTDs and external resolution, bound resources. |
| 8.5 XML provider | Extract frame names, Script/Include edges and inline Lua spans. Keep `$parent`, virtual templates and inherited names unresolved until reference-graph rules exist. Test source offset mapping across CDATA and entities. |
| 8.6 Filesystem graph | Separate opt-in adapter resolves references relative to the containing file; explicitly handle separators, case, variables, missing files, root escape, cycles and limits. Preserve original text. Never follow arbitrary paths or load runtime assets. |
| 8.7 Shared registry | Map providers into approved descriptor/declaration contracts and use the environment resolver. Test duplicate names, independent origins, conditions, selected TOCs and deterministic load order. |
| 8.8 Real-corpus acceptance | Wire actual parsers into the same local runner. Require parsed count = eligible discovered count per language, zero unreported skips, range invariants, determinism and an explained diagnostic baseline. `--require-all-parsers` becomes green only after all three exist and run. |
| 8.9 CI and distribution | Authored synthetic fixtures only. Pin licensed parser dependencies, preserve package boundaries, commit reviewed APIs and migration docs, pass supported CI matrix. Do not publish installed AddOn source. |

## Tracking and review cadence

Each coherent step carries failing reproduction (when practical), minimal implementation, focused verification, diff inspection and broad integration evidence. GitHub #6 stores decisions, #7 stores milestone evidence, #8 stores v0.3.0 delivery; follow-up issues track TOC fidelity and Lua/XML acceptance. Reuse a matching issue before creating one. A local failure is recorded as a failure; an unavailable optional plugin is not counted as a passed gate.

Historical boundary after PR #23: core v0.3.5 and approved Lua increments are integrated; source 0.4.1 has 56 beta exports and 221 tests. The opt-in Lua corpus profile gives all 5,242 files syntax verdicts with one explained rejection, zero codec/resource blocks and explicit dynamic incompleteness. XML SDK count remains zero. The XML proposal is review-ready context, not an approval or implementation; do not treat its dependency/package/surface expectations as assertions about the current six-package build.

Current XML increment: A–F was approved on 2026-11-17. Source 0.5.0 adds an optional XML syntax/provenance package; [the review](REVIEW-XML-v0.5.0.md) records fresh gates and actual XML verdicts. Steps 8.5–8.8 remain open. Follow the latest explicit authorization boundary: merge, tags and publication each need their own user approval.

The independent issue #26 follow-up is integrated through PR #27 after PR #25, following explicit user approval on 2026-11-17: [plan](PLAN-CORPUS-ACCOUNTING.md), [acceptance](REVIEW-CORPUS-ACCOUNTING.md), and [aggregate evidence](evidence/corpus-accounting-2026-11-17.json). Main `3c99b3342bc81f3529fe10cdb422ddd9f7f3d586` has fresh 4/4 supported CI, 311 total tests (Ubuntu 311 pass; Windows 310 pass / one Linux-only skip), strict API and actual package gates. It adds precise per-file TOC/Lua accounting and bounded TOC reads without changing SDK contracts. The attributed implementation corpus run gives every discovered TOC/Lua/XML file a syntax verdict (434 / 5,242 / 1,199), zero resource/read/backend/invariant blocks and 6,875 matching source hashes. Its exit remains failed for known diagnostics, dynamic Lua incompleteness and absent XML provider/loader graph. Do not treat this verdict count as completion of steps 8.5–8.8.

XML provider A–D was explicitly approved on 2026-11-17 and implemented as source0.6.0 in PR #28 at580ed8b: an optional semantic leaf with eight beta exports, explicit caller vocabulary, unknown frame candidates, unresolved references and exact mapped bodies. Supported CI and review are complete; separate merge authorization remains pending. [Migration](MIGRATION-v0.5-to-v0.6.md) and [profile explanation](XML-PROVIDER-PROFILES.md) describe the boundaries.

The assistant subsequently prepared/selected the local caller profile and executed [actual provider inventory acceptance](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6951837363) on580ed8b:1,146 projections validated,1,116 complete under policy/30 incomplete,53 XML syntax rejections, zero technical blocks and1,199 matching XML hashes. The37 chunks/1,302 handlers are extracted, not Lua-parsed. Exit1/fullParsing=false and excluded domains remain explicit. No user-authored JSON was required.

Current dependency: [inline Lua A–E](PROPOSAL-INLINE-LUA.md) was explicitly [approved](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6952532068) and is implemented for review in PR #29. It adds explicit function context, disjoint original-source mapping, opt-in worker/corpus composition and five beta exports/shared source0.7.0 without a new package edge/core contract. Follow [implementation acceptance](REVIEW-INLINE-LUA-v0.7.0.md); the earlier proposal review remains historical. Selected-source traversal remains subsequent work. Integration, tag and publication remain separately authorized actions.

Next acceptance sequence: (1) verify A–E focused regressions, eight-package build/dependency/API/license/payload gates and exact-head Windows/Ubuntu × Node22/24 CI; (2) prepare a concrete local context profile with signature evidence, explicit unsupported cases and no user-authored JSON requirement; (3) execute a read-only installed inline pass, retaining per-body verdicts/skips and aggregate source/mapping checks; (4) propose selected-source graph rules before implementing new loader semantics; (5) compose selected TOC/Lua/XML providers and evaluate remaining domains/diagnostics. Each step must retain its own commit, observed failure cases and measured acceptance; syntax counts alone cannot close the broader goal.

Subsequent evidence on ab36b28: A–E has both4/4supported CI runs and a validated immutable runtime-patch risk assessment. [Actual partial-context corpus characterization](REVIEW-INLINE-LUA-CORPUS.md) parses all434TOC/5,242Lua/1,199XML files plus654inline bodies, retains685missing contexts/14incomplete inline lexical results, zero technical blocks and6,875matching hashes. Exit1/incomplete persists. The linked record details the remaining context-evidence, graph-design, authored failure, resolver and final acceptance steps; no version bump or inventory count closes them.

Next review surface: [selected-source graph A–F](PROPOSAL-SELECTED-SOURCE-GRAPH.md), unapproved/unimplemented, on a separate proposal branch based on07b79a8. It specifies tooling/profile/types, path/identity/conditions/occurrences/publication, native Windows attribute inspection, budgets and measurable acceptance. [The review packet](REVIEW-SELECTED-SOURCE-GRAPH-PROPOSAL.md) separates current12-case/type/source evidence from future graph tests and supplies two independent review scopes. [Historical candidates for all25deferred handler kinds](REVIEW-HANDLER-CONTEXT-EVIDENCE.md) are classified but not selected as modern signatures;685missing-body coverage remains open. Preserve both implementation PR heads and request only genuinely new design/delegation decisions.

Later user-authorized integration merges PR #28 asfe86732cd8fbfc401f523d00595f0795b7631cc8 and PR #29 as7b01bd0511fbe651d1234848f73140c9d012c2a9. PR29's required main-history update28c59eb and final merge preserve the reviewed07b79a8 tree; exact supported post-merge evidence is linked from [#11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11). [Independent graph reviews](REVIEW-SELECTED-SOURCE-GRAPH-INDEPENDENT.md) are complete atcbf5ac9 with a correction rechecked at4b88c2f: original guard issues now have an explicit owned sidecar even with no declarations; the current authored characterization has13cases/five negative type assertions. Native graph/helper/publication/aggregate behavior remains unimplemented and A–F needs its own decision. No new corpus run, release or game write is inferred.
