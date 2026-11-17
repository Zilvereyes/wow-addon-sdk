# Inline-Lua proposal review record — 2026-11-17

Historical proposal checkpoint only. The user subsequently [approved A–E](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6952532068). Current implementation and fresh acceptance are tracked in [the v0.7 review](REVIEW-INLINE-LUA-v0.7.0.md); the unapproved/unimplemented wording below describes only the earlier snapshot.

Scope: [A–E proposal](PROPOSAL-INLINE-LUA.md), authored existing-API characterization, locally declared consumer types and dated status corrections. New context/mapper/worker functionality is **not approved or implemented**. The SDK source baseline is580ed8b42cbe24420346011d64b0ec34fcb32025; proposal head/CI identity is recorded by its focused PR after push. Main remains3c99b33 and XML-provider PR #28 remains frozen/unmerged at580ed8b.

## Evidence obtained

| Check | Command/reference | Actual result / limit |
| --- | --- | --- |
| Existing behavior and mapping seams | npm run build from the preceding XML acceptance, then node docs/proposals/inline-lua-characterization.mjs | Exit0,11 authored cases, Windows Node26.13.1; tests the current API only. No installed input is read and no Lua/XML is executed. |
| Proposed consumer types | node node_modules/typescript/bin/tsc --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --module NodeNext --moduleResolution NodeNext --target ES2022 docs/proposals/inline-lua-contract.ts | Exit0; three @ts-expect-error assertions reject incomplete/wrong context literals. Types/functions are local declarations, not current package exports. |
| Whitespace and source scope | git diff --check; inspect exact staged paths | Exit0 before commit; no SDK/manifest/lock/CI changes intended. Foreign docs/workflows remains untracked and untouched. |
| Primary Lua rules | Lua5.1 manual2.5.9 and reference lparser.c; pinned luaparse0.3.1/current syntax.ts | Parameters are local; varargs belong to the current function. Source inspection supports a wrapper-free approach. No native Lua compiler or game runtime oracle is available. |
| Prior exact-head SDK acceptance | PR #28 / push run44102761508 and PR run44102775393 | Each4/4 supported jobs at580ed8b, strict eight-package/API73beta/export/license/payload gates; historical evidence for unchanged SDK, not future feature acceptance. |
| Actual provider baseline | issue11 comment6951837363 |1,146 validated projections /1,116 complete under explicit local policy /30 incomplete /53 syntax rejected; no inline Lua parses. Does not prove signatures or reference reachability. |
| New proposal-head CI | Focused PR checks after push | Must be inspected on the exact proposed head. Existing350-test SDK suite validates unchanged behavior; the new feature matrix remains proposed. |

Read-only design reviews examine context/backend constraints and disjoint provenance independently. Their source findings are checked against the parent-read backend/contracts and11 executed authored observations. Their recommendations are design evidence, not executed feature tests. Review clarified valid partial-provider eligibility, own-field snapshot consistency and bounded failure identities; those corrections are included in the concrete proposal.

The first private draft of the characterization was run outside the repo, then transferred as a path-independent, output-only authored reproduction under docs/proposals and run again. No third-party source or installed vocabulary is copied into the reproduction.

## Requirement and decision traceability

| Decision | Concrete review surface | Required implementation evidence after approval |
| --- | --- | --- |
| A context | LuaAnalysisContext; optional context; explicit parameters/variadic/prefix/activation rules | Context-specific red/green regressions plus all old chunk/profile/scope/source fixtures. |
| B provenance | Four XML-analysis mapper exports; batch/point/transform/resource rules | Independent golden original intervals, whole-batch fail-closed cases and ownership/performance. |
| C corpus | Explicit local profile, fixed envelope/supervision, body/file disposition counters | Actual API invocation, missing-context/incomplete/rejection/resource distinctions, atomic mapping and hash verification. |
| D acceptance | Authored matrix in proposal | Run each feature vector; never substitute inventory/extraction/characterization or declared types. |
| E delivery | Same eight packages/edges; proposed five exports/78beta/source0.7.0 | Reviewed API/report/version/lock diffs, all supported CI and exact eight payloads/licenses. |

No new context or mapper acceptance is claimed from this proposal. The overall goal remains open for these contracts, selected-source traversal, excluded domains and composed corpus acceptance. Merge #28, this proposal, tags and publishing retain their separate authorization boundaries.
