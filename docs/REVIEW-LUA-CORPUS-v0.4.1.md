# Lua corpus-profile implementation review

Scope: approved A–E from core/Lua main `3fa9416`, including SDK syntax/provider options, one named beta type, fixed limits/header mapping, the CLI transport/read path, child/thread transports, tests, declarations/reports, all manifests/lock changes and documentation. Unrelated untracked workflow documents and all private/game data are excluded.

## Findings, evidence and disposition

| Requirement / observed gap | Disposition |
| --- | --- |
| No larger profile, explicit loader option or named CLI transport existed | Eight initial requirement groups failed before implementation. Four SDK profile groups, three CLI groups and two initial worker groups now exercise the new behavior; the invalid-argument group already rejected the old unknown flag and is not counted as an initial feature failure. |
| Default behavior could silently widen | Omitted/explicit bounded results remain identical; above-default input/nodes still fail there and pass only with corpus. Hashbang remains strict unless allowShebang:true. Existing default corpus/API/worker cases pass. |
| Inherited options or unknown profiles could evade validation | New own/inherited profile/boolean projection cases return LUA0001 without declarations; the old inherited-condition fix remains. |
| Decoding could guess Unicode or overwrite source | Strict UTF-8 first, explicit BOM-free byte transport only; BOM/limit/privacy/source-byte-preservation cases pass. No game write, source evaluation or inferred locale. |
| A larger worker could fail without cleanup | Real SDK depth/reuse/recovery, per-profile limit rejection, native small-budget isolated heap exhaustion, timeout/crash/protocol/output checks pass and reap before test fixture removal. |
| Replacement could start while the killed child had not closed | The controlled process-boundary test reproduces two launches before first close. Corpus replacements now await close, refuse overlapping restart requests, and respect close during retirement. Native workflow tests separately cover real processes; the deterministic ordering test is not presented as a native OS scheduling proof. |
| Larger limits could be mistaken for achieved coverage | The actual full run on 57b52a3 obtains all 5,242 verdicts (5,241 accept / one reject), with zero codec/budget/worker/read/backend blocks. The residual syntax case and dynamic projections remain visible; no full project completion is claimed. |

The initial local full gate passes 218/218; the added reaping regression brings the complete post-fix gate to **219/219**, with strict API Extractor and exact package/license/hash checks successful. The five core source/API surfaces are unchanged. Lua's declaration/report diff contains only the approved named profile, two readonly options and explanatory budget/loader documentation. Total 56 beta exports: 13 runtime values/functions, 43 type-only contracts. No dependency or schema change.

All 88 third-party/link lock records remain exact. A guarded draft version replacement caught incidental Node engine strings before writing the lock; the final exact-value replacement changes workspace versions/internal ranges only. Installed backend source/license bytes remain pinned. No runtime, global config, service, privilege, account, network or game installation change occurs.

## Process and trust boundaries

Reviewed fixed executable/thread paths and named presets, absence of shell/eval/input-controlled callbacks or worker budgets, stripped preload/test/coverage hooks, exact response IDs/shapes, bounded output, finalizers and error paths. SDK stays pure; only tooling imports Node. The larger child's command-line old-space limit agrees with the parser thread's 2 GiB limit, and stack allocation uses Worker resourceLimits rather than assuming the main Windows stack is larger. These are per-isolate controls, not an RSS/ArrayBuffer/OS-memory or adversarial JavaScript sandbox guarantee.

Internal spawn/thread/path/budget test seams are never derived from corpus input or CLI profile data. Native heap testing uses a small isolated budget and a finite allocation ceiling. Raw source/backend error text does not enter operational output. JSON reports expose counts, not names/paths/profile payloads; source ranges are checked against the exact chosen transport string.

## Evidence limits

Local runtime is Node 26.13.1. Head 57b52a3 passed all four supported PR CI jobs in run 43932625185 with 218 tests, before the lifecycle fix. That run does not substitute for the final-head supported matrix. Copilot review 5925596096 has no active findings (formal COMMENTED) but requested confirmed supported/corpus evidence; final review/CI is maintained in PR #23 and #11.

The whole-corpus result is an exact source-snapshot observation. Post-fix affected-input reanalysis uses a private exact-byte/dependency/native-syntax-gated harness; records contain hashes/statuses/source points only, never installed source text. Parser/profile validity, decoded source provenance and full static availability are separate claims. XML/source mapping/reference traversal and actual selected-source provider composition remain open; no tag/npm publication.
