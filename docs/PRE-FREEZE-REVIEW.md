# Pre-freeze review and acceptance checklist

This record addresses the user's eight-point review on 2026-11-16. It is an audit checkpoint, not a release or a claim that actual Lua/XML parsing is complete. Integrated baseline: PR #20 / `e3a477b`, source version 0.3.4, 142 tests and 51 beta exports. Its [PR CI](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/43887568879) and [main CI](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/43888991644) each passed all four supported jobs. Copilot found no open issues; its formal review state is COMMENTED, not an independent human approval.

## Disposition of the eight points

| Point | Finding, action and remaining acceptance |
| --- | --- |
| 1. Integration protection | Confirmed main was unprotected with no rulesets. The user selected the solo model: PRs, four required CI checks, chat sign-off rather than another GitHub reviewer. Protection is now configured and read back; details below. |
| 2. Real provider evidence | Synthetic provider batches prove resolver association/copy/conflict behavior only. Keep every export beta. Actual Lua parser/provider and XML parser/provider/reference graph remain open in #11 and must run before the overall project goal is complete. Do not call inventory or a temporary candidate spike SDK integration. |
| 3. Evaluator placement | Retain the approved five-package graph for this checkpoint. Providers can produce GlobalDeclaration/ConditionDescriptor using registry/diagnostics only; the external orchestrator calls evaluation/resolution in the adapter leaf. Providers are not required to import that leaf. Its TOC-specific name is an acknowledged reuse concern. Reassess a neutral orchestration package after an actual second provider demonstrates its needs; a move changes imports/package boundaries and requires an explicit design decision. No relocation is smuggled into this review. |
| 4. Anonymous rule | Add exported beta ConditionEvaluationRule at the user's request, with precisely the former readonly providerId/name/field/operator/valueComparison fields. ConditionEvaluationPolicy.rules references it. Positive/negative type checks demonstrate the absent export, reusable structural compatibility and unchanged readonly/operation restrictions. No runtime or JSON behavior changes. |
| 5. Closed unions | Document exhaustive-switch breakage explicitly in API policy/migration. Keep approved unions; future new members require deliberate API review and migration. Do not pretend that beta or additive runtime behavior guarantees source compatibility. |
| 6. Public surface | Review all 52 proposed exports by name and consumer purpose in PUBLIC-SURFACE.md. Retain the required original 30 plus approved additions and the requested rule; type-only contracts count separately from runtime functions. No speculative helper exports. |
| 7. Lua dependency | The pinned MIT luaparse characterization adds no SDK dependency. Existing core forbids external runtime imports; using or vendoring a parser requires a separate parser-boundary/license/dependency decision. Vendoring does not erase license or maintenance obligations. Native Lua/Classic Era dialect conformance remains unverified. |
| 8. Remaining TOC errors | Re-inspected every current error. All 19 are nonempty double-hash section headings rejected by the strict parser. Classify as unsupported heading/recovery syntax, not proven defective AddOn input or a proven game-loader bug. Retain exit 1, synthetic regressions and issue #10 pending a reviewed recovery policy/client evidence. Per-occurrence disposition below. |

## Configured solo-owner branch protection

The user chose this model explicitly in chat. GitHub does not allow the PR author to approve their own PR, so the configured required approval count is zero while pull requests themselves remain required. [GitHub required-review rules](https://docs.github.com/en/enterprise-cloud%40latest/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews) and [REST configuration](https://docs.github.com/en/rest/branches/branch-protection) describe that distinction.

- main requires an up-to-date branch and all four exact checks from GitHub Actions app ID 15368: `verify (ubuntu-24.04, 22, bash)`, `verify (ubuntu-24.04, 24, bash)`, `verify (windows-latest, 22, pwsh)`, `verify (windows-latest, 24, pwsh)`.
- Administrator enforcement is enabled; force pushes and deletion are disabled. No bypass actors are configured. Existing merge commits remain permitted.
- GitHub enforces PR/check requirements. Chat sign-off is a recorded project workflow, not a GitHub-enforced approval. Protection is mutable repository configuration, so re-read it before final sign-off rather than relying solely on this document.
- Use the existing project authorization for routine reviewed green integration and verification of the requested core milestone. New material contract decisions and tag/npm release approval must be concrete and explicit. Do not repeatedly request already-recorded A–E decisions.

## Per-occurrence TOC triage

The read-only scan visits the same 12,714 entries and 434 TOCs. Occurrence IDs use deterministic exact-name sorted discovery and source diagnostic order. The private host-local ledger records each file/source span and SHA-256; it is not committed. No installed source text or identifying paths are copied here. The IDs identify this corpus snapshot, not permanent diagnostic codes.

Every row is classified **unsupported nonempty heading syntax; loader conformance unverified**. None contains a colon or a SavedVariables header. This evidence does not authorize treating malformed or unknown conditional declarations as comments.

| Occurrences | Count | Shape class | Authored regression |
| --- | --- | --- | --- |
| F01–F07 | 7 | Section caption with trailing hash decoration; one hyphenated caption repeats | Authored decorated variants in toc-corpus-fidelity.test.mjs |
| F08 | 1 | Short plain section caption | Existing strict-heading case |
| F09 | 1 | Decorated caption with prose/punctuation | Authored prose/decorated variant in toc-corpus-fidelity.test.mjs |
| F10, F12, F14, F16, F18 | 5 | Two-word plain section caption | Existing strict-heading case |
| F11, F13, F15, F17, F19 | 5 | Three-word plain section caption | Existing strict-heading case |

All 19 remain TOC0001 errors. Issue #10 tracks any future recovery choice; no source is modified and no diagnostic waiver is introduced. Independent game-loader evidence is still needed before claiming conformance, even if an explicit permissive parser mode is later approved.

## Ordered remaining acceptance

1. Review the named-rule declaration/API report diff; retain schemas 2/1/1, all current union values, original activation/listing/provenance behavior and third-party lock records.
2. Verify focused contracts and existing evaluator/resolver regressions, then locked install, complete tests, architecture/dependency/export/API checks, strict Extractor and exact package/license assertions.
3. Publish the focused pre-freeze PR and verify its exact final head on Ubuntu/Windows × Node 22/24. Inspect external review findings and required-check protection before integration. Do not infer a human review from Copilot's COMMENTED state.
4. Finish the v0.3.5 readiness record mapping #7's architecture/API/migration/diagnostic/distribution criteria to actual evidence. Advance source versions/internal ranges together only in that release candidate. Re-read protection and verify final-head CI before recording core acceptance; tags/npm release sign-off remains separate.
5. Implement #11's concrete Lua grammar/encoding/BOM/recovery/resource/ownership/provider boundary, [approved A–E in #6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6920213019), in a separate increment after core verification. Do not request that approval again. Verify Classic Era extensions rather than guessing from Lua 5.1; XML remains a later distinct contract.
6. Implement syntax and the minimal real Lua provider, then XML syntax/provider and bounded reference graph, in independently tested slices. Compare actual provider outputs with the existing neutral contracts before promising durable boundary stability for those new packages.
7. Run actual TOC/Lua/XML parsers over the opt-in local corpus; require parsed = eligible discovered counts, explicit skips/failures, source-range invariants and explained diagnostics. Keep the overall goal active until this is real. The current SDK still parses zero Lua/XML files.

This checkpoint deliberately does not declare v0.3.5 freeze complete, alter the five-package graph, select a third-party parser dependency or claim clean installed-corpus parsing.

The subsequent source-version candidate and requirement mapping are in [RELEASE-READINESS-v0.3.5.md](RELEASE-READINESS-v0.3.5.md), within the same focused PR #21. Its final-head evidence is separate from the initial checkpoint results below.

## Local verification for this checkpoint

- The named-rule type fixture failed on the absent export before implementation; the corrected fixture and all 41 evaluator/resolver checks then passed. All six TOC fidelity tests pass with the expanded authored heading cases.
- Locked `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check:all` (142/142), strict `npm run api:extractor` and `npm run check:packages` exit 0. All five packages retain exactly four approved packlist files including byte-identical MIT licenses.
- Source AST audit confirms 52 exports, one beta tag each, original 30 names preserved and exact coverage in PUBLIC-SURFACE.md. Old/new adapter transpilation is byte-identical at runtime; changes are erased type declarations. Only its deliberate API baseline/report change; package versions, lockfile and third-party dependencies are untouched.
- Fresh read-only composed corpus run retains 434 TOCs / 347 adapter declarations, 100 groups / 227 candidates / 98 selected / two no-matches / 160 selected active declarations and unique names. All source-reference/JSON checks pass; the run correctly exits 1 on 19 TOC errors, with 12 warnings and zero parsed Lua/XML files. No skipped links/oversized TOCs.
- Exact pushed-head CI and external review evidence belong in the focused PR and issue #7; local checks are not a substitute for the supported matrix.
