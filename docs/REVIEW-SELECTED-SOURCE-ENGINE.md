# Selected-source engine, resolver and CLI checkpoint

This checkpoint implements stages4–6 of the [approved A–F contract](PROPOSAL-SELECTED-SOURCE-GRAPH.md), following parser/transport HEAD02cdaca1395ca912129813b1cbc556a69c03e440. It is private tooling; SDK package contracts, beta exports, schema/source-position rules and package versions are unchanged. PR30 remains draft and unmerged. Local synthetic evidence and exact-head supported CI are separate acceptance layers.

## Implementation and invariants

| Deliverable | Files | Observable requirement and failure controls |
| --- | --- | --- |
| One operation budget | scripts/selected-source-budget.mjs, selected-source-host.mjs; selected-source-native.mjs delta | Native bootstrap, traversal, workers, retention and publication share the same ledger/monotonic deadline. Reserve source payload plus growth probe before opening; refund only successful observed native byte counts. No quota or clock reset between adapters. Budget-denied integrity verification preserves its resource cause. |
| Selected occurrence graph | scripts/selected-source-engine.mjs | Actual candidate TOC parsing/selection, iterative preorder traversal, ancestor cycles versus diamond duplicates, inherited original guards, exact-context analysis reuse, bounded LRU text eviction, owned validated results/receipts and final shared-source/directory invalidation. Unselected descendant content stays unread. |
| Exact resolver inputs | scripts/selected-source-resolution.mjs | Automatic selected SavedVariables precede provider batches. Exact variant/request association, full per-occurrence declaration coverage, ordinal duplicate origins and disjoint XML mapping parts are checked against validated analyses. Block an entire invalid group; preserve independent groups and the untouched actual SDK core result. Valid blocked-group private origins keep null resolution indices. |
| Separate public accounting | scripts/selected-source-accounting.mjs | Fixed allowlisted schema, code histograms, disjoint unique-file verdict/skip partitions, independent request/event/reuse/API counters and separate inline-body metrics. Changed input withdraws semantic/API credit. Unknown declaration-free guards, missing handler contexts and all-no-match selections cannot become successful coverage. |
| Owned private result | scripts/selected-source-graph.mjs | Compose trace, resolver, original diagnostics, origins and the public aggregate. Close/reap the host before resolver publication. If the remaining budget cannot retain a complete result, reject without publishing a group/core prefix or inventing an emergency aggregate. |
| Read-only CLI | scripts/inspect-selected-addon-sources.mjs | Explicit absolute local root and four required bounded strict UTF-8 JSON profiles; optional corpus-files Lua transport. No executable/callback/output destination from profile data. Serialize only aggregate counts. Exit0 means complete policy coverage without faults; exit1 means incomplete/failed analysis; exit2 means invalid preflight. Budget failure without a retainable aggregate emits fixed failure text and exit1. |

Example invocation, using caller-prepared profiles rather than inferred game-loader semantics:

```text
node scripts/inspect-selected-addon-sources.mjs <explicit-absolute-AddOns-root> --graph-profile <graph.json> --resolution-profile <resolution.json> --xml-provider-profile <xml-provider.json> --xml-inline-lua-profile <inline.json> [--lua-input-profile corpus-files]
```

The full graph, original diagnostics and per-source integrity data remain private. Neither `fullParsing` nor `clientConformance` becomes true. Missing paths are reference/candidate failures, never phantom parsed files. A normal empty no-match core remains distinguishable from completed requested coverage.

## Review corrections and focused evidence

Authored regression sources live in tests/selected-source-engine-fixtures.mjs and the engine, retention, resolution, accounting, graph, host and CLI test files. Fixtures are repository-authored or created in a verified temporary directory. No installed AddOn source is included or executed.

Independent static review identified missing retention charges for candidate/event/condition shells. The engine now reserves those shells before allocation; lower-limit controls deny before content/reference retention, with actual-parser positive controls. It also identified coherent provider/sidecar mutation or omission that could evade origin-only checks. Resolver publication now binds XML frame ordinals, complete standalone/inline Lua batch lengths, owner identity and complete occurrence coverage to their independently validated analysis records. Forged and omitted facts block the group; the unchanged authored facts remain the controls.

Parent composed-host testing reproduced resource-denied final verification being reported as a generic read failure. The native adapter now propagates budget failures and the engine records the original resource class while withdrawing its verdict. The exact native boundary control uses eleven payload bytes: allowance23 permits both source reads and integrity rereads (22 actual bytes); allowance22 denies the final payload-plus-probe reservation before opening. File bytes remain unchanged. The shared-clock control denies traversal at a deadline reached after host construction.

Focused parent commands on the uncommitted implementation snapshot:

- `node --test tests/selected-source-engine.test.mjs`, host37626: exit0, nine passed. Actual TOC/Lua/XML/inline workers, guards, cycles, shared changes, caps, failures and receipts.
- `node --test --test-concurrency=1 tests/selected-source-host.test.mjs tests/selected-source-native.test.mjs`, host9862: exit0, 18total/17passed/one Linux-only skip. Subsequent resource-classification assertions and directory-budget propagation are exercised again by final checks below.
- Parent integrated origin/accounting/controller controls initially exposed an incorrect test assumption that XML frame declarations are active globals. The actual core preserves their unknown activation; the control now checks original entry names and the unchanged core semantics.
- The final focused and full-suite results, source identity and supported CI run/job links are recorded in the exact-head PR30 acceptance comment after commit. Earlier green results are not evidence for later source changes.

Before native execution, the unchanged PowerShell helper passed its registered Workbench1.0.1 gate, component8966c355-7324-4aba-966f-542309e2581a. SHA256 remains ae058c154e3d17debcd3e4843eeb122495d0dd6f81d9a8e54fa23aa614a2c9c6. This change adds no PowerShell source or system configuration. Local host is Windows Node26.13.1/npm12.2.0; supported Node22/24 results must come from the exact commit's Windows/Ubuntu CI.

## Remaining acceptance and next actions

1. Complete parent integrated tests and final diff review; run check:all, strict API Extractor and actual package/license checks sequentially. Keep exact commands/exits tied to the resulting source snapshot.
2. Commit only reviewed owned files, update PR30/#11, then inspect push and PR Windows/Ubuntu × Node22/24 job conclusions/logs for that exact head. No automatic merge, tag or publication.
3. Prepare the approved local graph associations and policies from necessary read-only metadata. Preserve uncertainty rather than infer client semantics, suffix activation, dependency autoload or handler parameters.
4. After native/integration acceptance, run the selected-source CLI against the authorized local corpus, retain before/after integrity evidence privately and publish only aggregate counts. Compare with historical all-inventory findings; selecting a smaller graph cannot erase them. This checkpoint has not performed that installed graph run.
5. Continue the remaining project-file audit and domain/diagnostic/context decisions. This bounded engine review does not claim an audit of every repository file or completion of the broader Architectural Freeze/parsing goal.

Optional MegaLinter remains unconfigured/not run; no runtime or system installation was added to invoke it. Historical sealed Codex Security findings apply only to their recorded range, not automatically to this new engine. Current static architecture/file-safety reviews and runtime checks are reported separately.
