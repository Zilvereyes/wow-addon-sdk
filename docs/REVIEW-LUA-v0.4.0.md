# Lua implementation review

Scope: the complete v0.4.0 change from verified core `0cee5c9`, including both runtime TypeScript modules, private backend declarations, manifests/project references/lock, worker/client, corpus runner, six API/distribution gates, new/changed tests, generated API baseline/report and capability/migration/license documentation. Existing five runtime source APIs and declaration baselines are unchanged. The separate untracked workflow-prompt artifacts are not part of this SDK change.

## Findings and disposition

| Finding / concrete trigger | Disposition and evidence |
| --- | --- |
| No SDK Lua parser/provider existed | All 38 initial API/catalog/provider checks failed on the absent package. Three approved beta exports now call the exact reviewed backend; all authored vectors and real parser-output/TOC composition pass. |
| Pinned backend rejects valid terminal break semicolons | Private corpus triage found 88 affected files. Primary Lua 5.1 grammar/reference source confirms validity. Lexer-based equal-width adaptation fixes it; extra semicolons, non-loop break and statements after terminal break remain rejected. |
| Pinned backend misclassifies same-line calls after multiline literal arguments | One real case. Source inspection confirms start-line vs ending-line confusion. Parse-only adaptation retains original offsets and real newline ambiguity; long/escaped-short strings, CRLF, astral text and comment gaps have positive/negative tests. No upstream bytes change. |
| Declared external dependencies/version ranges could escape source-import-only checks | Two new negative cases failed for the intended missing manifest guard. The direct runtime declaration/pin guard now passes alongside old import/type/dynamic-import/cycle regressions, without permitting new core edges. |
| A parser can stall, exhaust its process or return a mismatched response | Six worker tests cover real SDK reuse, syntax recovery, deadline, process exit, output cap, exact correlation/shape and overlapping-request refusal. Fixed executable/flags, bounded heap, no shell, hidden Windows child, stripped preload hooks and final reaping are inspected. |
| File decoding/budgets could be mistaken for grammar verdicts | Five corpus regressions cover strict UTF-8/BOM, source bounds/privacy, source preservation, preflight profiles, byte/input blocks and retained original errors. Blocked/failed files never count as parsed; default Lua-disabled and XML-unimplemented status is explicit. |
| No actual installed-corpus evidence at the initial candidate spike | Actual SDK run now considers all 5,242 Lua files: 5,105 syntax accepts, one explicit shebang-profile rejection and 136 encoding/budget blocks. Zero worker/read/backend failures. 1,478 dynamic-environment projections remain incomplete. Full run remains failed/incomplete; no installed source is committed. |

The successful original 195-test gate was followed by five authored fidelity tests: three failed on the verified backend defects while two negative guard groups passed. The repaired full suite passes **200/200** locally, plus strict Extractor and exact package/hash/license assertions. An early architecture command overlapped npm ci and saw temporarily missing TypeScript; that environment failure is excluded from regression evidence. The new package's initially missing API report directory was created, its three-export report deliberately generated/reviewed, and strict validation then passed.

## Ownership, grammar and architecture checks

Reviewed lexical target/scoping rules against actual backend scope flags: locals/parameters/local function names/member writes are excluded; duplicate assignment/function origins retain source order. Direct source applicability remains distinct from runtime flow; dynamic environment/code references downgrade supported names to unknown rather than activating inferred symbols. Descriptors are copied per declaration/call and never interpreted by the provider. Root error paths expose no accepted prefix declarations or backend/input text.

The grammar adapter uses real token types/ranges with forward-progress/bounds checks. It does not scan literal/comment text as code, enable Lua 5.2, relax terminal statements, execute strings or alter original input. Equal-width parse copies and the independently computed original line index preserve public UTF-16 spans. Backend values/locations are not public API. All original 52 core export names remain; the exact five existing declaration baselines are unchanged. New root surface: 55 beta declarations, 13 runtime values/functions and 42 type-only contracts, with explicit consumer-purpose rows.

New package imports diagnostics/registry types and only its pinned backend; orchestration remains external. Existing 86 node_modules lock records are exact. Three new lock records are the Lua workspace, its link and luaparse 0.3.1. Reviewed npm artifact/source/license hashes match the pinned upstream characterization, with no runtime subdependencies or install lifecycle hook. This is artifact/provenance evidence, not a fresh vulnerability-database scan.

The original five payloads keep exactly LICENSE/package.json/dist/index.js/dist/index.d.ts. Lua adds only the private syntax.js/syntax.d.ts pair, retaining root-only exports and identical SDK MIT licensing; backend license stays in its independently installed dependency. Parser inputs, private diagnostic ledgers, backend archives and game assets are excluded.

## Evidence limits and next acceptance

Local runtime is Node 26.13.1. Exact pushed-head Ubuntu/Windows × Node 22/24 CI and external review must pass before integration; PR/#11 carries that evidence rather than substituting local results. The corpus's remaining resource/encoding blocks are observed limits of the approved profile, not a clean-parsing claim or a reason to relabel files eligible after the fact. The largest blocked file is 20,160,363 bytes; any expanded budget/decoder/loader policy requires a concrete reviewed decision.

The private Workbench triage ran against exact registered SDK/worker/backend byte pins, after a draft gate demonstrably rejected execution and a reviewed gate passed. It retained path/hash/range/status metadata only, outside Git, and reconciled every initial blocked/rejected file. Those immutable records describe the pre-fidelity baseline; they are not a native grammar oracle or an automatic gate on later edited code.

Post-fix verification used newly registered and gated current SDK/worker byte pins. All 143 initially syntax/resource-failed inputs retained identical source hashes. Actual lexer tokens confirmed all 88 optional break terminators. Reanalysis leaves one explicit shebang rejection and 54 resource blocks: all 89 false syntax rejections disappear, with one subsequently reaching the real resource cap. No private ledger or installed source enters the PR.

XML syntax/provider, inline decoded-source mapping, filesystem reachability and whole-corpus selected-provider composition remain unimplemented. Native Lua/Classic Era runtime conformance remains unverified. #10's 19 strict TOC heading errors and #11 remain open; the overall goal is not complete.
