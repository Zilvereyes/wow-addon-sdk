# Independent selected-source graph reviews and parent reconciliation

2026-11-17. The user explicitly delegated two fresh-context read-only Codex reviewers. Both reviewed PR #30 at **cbf5ac94ce8512c2f7cb768b129fcc50b19fc40e**, base **07b79a88150804be87b3d9c041bc7f2ff23e531f**, with repository code/authored fixtures only. They did not execute project code, inspect installed inputs/private evidence or foreign docs/workflows, edit files or mutate GitHub. The parent owns all executed evidence and corrections. These are independent review contexts, not claims of model diversity or a tested graph.

## Findings and disposition

| Review | Finding / disposition |
| --- | --- |
| Architecture/correctness | P2, medium-confidence contract completeness gap at original type lines192/214–219: guard availability was retained, but the original ConditionEvaluationResult/issues/sources[] had no specified result channel when the target yielded no declarations. Parent confirmed the trigger using actual parseToc/analyzeLua/evaluateGlobalConditions/resolveGlobalRegistry. This is not a runtime graph defect or false-activation finding; no graph exists. |
| File access/failure containment | No actionable material design contradiction found. The explicit stable-installation limitation, path/token/root/case/reparse controls and group-publication boundaries are coherent at design level. Native/runtime behavior remains unverified. Sentinel/failed-read accounting is an implementation obligation; the parent makes the reservation/refund rule explicit rather than claiming a future undercharge as an existing bug. |

The architecture review traced selection and missing candidates, evaluator AND behavior, complete cache association, duplicate/SavedVariables origin order, XML event/disjoint provenance, partial publication and accounting against the approved SDK. The file review covered rooted/device/ADS/reserved/Unicode/case/token inputs, component/ancestor checks, fixed Windows helper constraints, worker lifetime, budgets, late failures and privacy against actual bounded-reader/supervisor/validator code and authored regressions.

## Parent counterexamples and correction

Authored TOC: `Core.lua [AllowLoadGameType vanilla]`; explicit condition policy with no rules; Lua body `-- empty`. Actual guard evaluation is unknown with CONDEVAL0003 and its original TOC condition source. Actual Lua analysis returns zero declarations. The existing core resolver correctly returns complete=true with empty entries/issues because it received no declarations to evaluate. Control body `Out=1` produces a declaration whose core evaluation retains the same unsupported-condition issue and complete=false. This confirms why a separate graph guard result is necessary; core semantics remain unchanged.

The revised [declared tooling types](proposals/selected-source-graph-contract.ts) add one owned original `guardEvaluations` entry per reference and an allowlisted CONDEVAL histogram. [Proposal C](PROPOSAL-SELECTED-SOURCE-GRAPH.md#c--conditions-occurrences-and-deterministic-traversal) preserves availability/reason/original issues/sources, including inactive/declaration-free targets. The [thirteenth existing-API characterization](proposals/selected-source-graph-characterization.mjs) exercises the counterexample and control. A fifth negative type assertion prevents substituting a parser Diagnostic shape for the original guard issue. No guard object is inserted into the SDK registry.

A separate parent fake-I/O probe calls the existing bounded reader with a one-byte payload cap and returns two bytes after simulated growth. The reader rejects with bounded-read-changed and closes its descriptor; the two-byte request is intentional sentinel behavior. [Proposal E](PROPOSAL-SELECTED-SOURCE-GRAPH.md#e--budgets-result-schema-and-honest-counters) now explicitly reserves payload-plus-sentinel bytes before each source/integrity call, counts partial/failed reads, and forbids refunding unknown work from a boolean verdict. It also makes shared-source invalidation across all affected groups explicit. This demonstrates an existing helper's contract; graph-budget enforcement is still unimplemented.

Final parent probe: exit0 on Windows Node26.13.1; unknown guard/empty-core/control outcomes above, one-byte cap/two-byte request/one close, zero installed-input reads/native source writes. A preparatory probe using a non-recognized bracket name was corrected to the actual TOC syntax before this result; that failed preparation is not product-defect or parser-coverage evidence. Private probe location/input ledgers are not published. Final-head declared-type/13-case/CI exits and exact commit identities belong to the PR acceptance record.

## Residual limits and next decision

Neither review proves the future graph, Windows attribute helper, policy/runtime/protocol failure handling, native ancestor races, retained-memory charging, remaining-deadline cancellation, shared-source invalidation, final aggregate/error sanitization or resolver-origin integration. Existing SDK CI does not cover those unimplemented paths. Required authored/native acceptance stays in proposal F; actual installed graph acceptance is not run.

The two reviews are reconciled with one design gap addressed and the file-review obligations retained. Obtain the new A–F design decision before implementation. Existing XML/provider/inline approvals and separately authorized PR28/29 integration do not approve graph semantics, tag/release/publication or writes to the installation.
