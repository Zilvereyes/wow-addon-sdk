# Native selected-source file-port acceptance

This is the stage3 file-port slice over5489ef58f18f579e82decdf0c551d1dd86aa8cc6 under the already approved graph A–F contract. It does not implement analyzeSelectedSources, parser/worker receipts, graph traversal, resolver-origin publication or the CLI. SDK0.7.0/eight packages/78beta exports remain unchanged. Exact source commit and supported CI conclusions belong to PR30 after commit/push; previous-head CI is not transferred.

## Implemented boundary

- scripts/selected-source-native.mjs closes over an explicitly supplied absolute local root and an owned prepared context. URI/UNC/device/drive-relative roots fail preflight. Ancestor identities, canonical containment, every matched component and source identity are checked before/after reads. Root, intermediate and final links/reparse points are rejected.
- Directory enumeration uses bounded native iteration, strict UTF-8 decoding and retained snapshots. ASCII-fold collisions are ambiguous under the approved portable rule, even if one spelling is exact; exact policy additionally requires the exact spelling. No Unicode normalization/case folding or arbitrary first-match choice occurs. Source labels retain actual matched native separators/spelling, and hardlinks retain separate path identities.
- Cached directory state is checked before content opening; final directory verification re-enumerates and compares its original fingerprint. Source verification checks exact path identity/stat/content fingerprints. Changed sources/directories invalidate their original private snapshots. A full engine must still invalidate every group sharing that input before publication.
- Reads use the existing O_RDONLY bounded descriptor helper. Fixed byte envelopes are TOC8MiB, XML4MiB and Lua4MiB bounded/128MiB corpus transport envelopes; actual parser character limits remain separate. Initial-size-tightened payload plus sentinel is reserved before source I/O. Verified successful returned read counts permit refund; failed/unknown reads retain the reservation, including observed growth bytes. Native entry/depth/read/retained-record/string/time limits are applied; graph-wide source/analysis/reference/cache/occurrence accounting remains stage4/5 work.
- scripts/selected-source-windows.mjs launches the fixed absolute stock Windows PowerShell5.1 runtime and fixed helper with NoProfile/NonInteractive/File, literal stdin data, no shell and no execution-policy override. Strict UTF-8/correlated JSON, one pending request,128rows/1MiB frames, monotonic remaining deadlines, startup/late-response rejection and bounded reap failure are enforced. An unreaped child remains owned; no replacement starts before actual close. A close timeout reports failure rather than claiming the process reaped.
- scripts/Inspect-SelectedSourcePath.ps1 reads only IO.File.GetAttributes and returns booleans; paths/exceptions are never echoed. Missing/failed attribute inspection is closed. It does not read or execute Lua/XML. Production Ubuntu uses native metadata; the stock-Windows test is explicitly skipped there.

This is the approved stable-installation adapter, not an atomic hostile-filesystem sandbox. Portable APIs cannot atomically bind every ancestor while opening on both platforms. The authored intermediate-replacement-at-open test opens then rejects the changed descriptor before any source bytes are read, closes it once and returns no fingerprint. Do not describe that evidence as an atomic no-open guarantee.

## PowerShell Workbench checkpoint

The owning Workbench archive was searched first (no existing matching component). The single inseparable script has no executable member dependencies or functions; its complete command/variable/stream/control-flow contract is [recorded](workbench/selected-source-path.contract.json). A draft0.1.0 was registered, reviewed/resolved1.0.0 followed, then immutable revision1.0.1 normalized the checkout to the repository's existing CRLF requirement. No cache/archive records were rewritten.

Original checkpoint component8966c355-7324-4aba-966f-542309e2581a, version1.0.1, SHA256 **ae058c154e3d17debcd3e4843eeb122495d0dd6f81d9a8e54fa23aa614a2c9c6**. [Original registration pin](https://github.com/Zilvereyes/wow-addon-sdk/blob/dd4da4daef34052f698535bea7d40dd5309fa25b/docs/workbench/selected-source-path.registration.json) contains no private archive/provenance path. The launcher checks these actual checkout bytes before spawning; Git's normalized blob bytes are distinct from the CRLF checkout bytes. Hashes prove integrity, not authorization.

Executed checkpoints, actual exit0:

1. Workbench register/parse/gate for that exact component/version/source; gate passed before native execution and again immediately before the full local suite. Native syntax adapter reports sourceExecutionPerformed=false.
2. Get-PowerShellWorkbenchCodeAnalysis.ps1 on the exact helper in stock PowerShell5.1.19041.7844 and pwsh7.6.10: both parsers pass, zero functions/dynamic commands. Closure review identifies only built-in JSON/strict-mode/object cmdlets, .NET attribute/text/console calls and child-local variables/encodings/preferences.
3. Test-PowerShellWorkbenchAutomaticVariables.ps1 with explicit helper path: Passed=true, no diagnostics. Explicit installed PSScriptAnalyzer1.25.0 reports zero findings. No module installation, configuration/policy change, administrator action or game write occurs.

The exact local archive location stays private. Reproduction uses `python <workbench>/scripts/workbench_components.py gate --archive <local-archive> --component-id 8966c355-7324-4aba-966f-542309e2581a --version 1.0.1 --source scripts/Inspect-SelectedSourcePath.ps1` after registration into that chosen archive. Any script edit requires a new immutable registration/version, both runtime checks and a fresh exact-source gate before execution. CI reuses the reviewed fixed helper and checks its source pin; it does not claim that the optional Workbench installation exists on hosted runners.

## Authored evidence and corrections

Parent command `node --test tests/selected-source-native.test.mjs tests/selected-source-windows.test.mjs` on Windows Node26.13.1: **25total/24pass/oneLinux-onlyskip/zero failures, exit0**. Every source/directory mutation is explicitly authored in guarded temporary fixtures. Cases cover literal argv, malformed/oversized/invalid-UTF8/trailing frames, startup/exit/write errors, one pending request, monotonic deadlines, late startup/reply, withheld close acknowledgement, actual junction attributes, native read-only flags, matched spelling, missing/rooted/ADS paths, cached-directory changes before opening unchanged bytes, source changes, intermediate replacement before any byte read, changed root identity, hardlinks, sentinel growth, depth boundaries and lower entry/read/retention/time limits. Empty directory/source output containers are charged on every handoff; verification requires an issued exact fingerprint before any input I/O. Linux CI must additionally exercise exact-case collisions and invalid-byte entry names; local Windows does not claim those cases passed.

Both explicitly delegated independent reviewers remained read-only. Parent reproduced and corrected: wall-clock deadline arithmetic; unbounded replacement/close waits; bulk attribute timeout misclassification; filenames counted as directory depth; stale time after startup/late-response credit; cached owned-output undercharging, including empty directory and repeated source results/buffers/fingerprints and retained root/cache state. Parent also reproduced an unissued verification opening a source and restricted verification to issued exact snapshots before any I/O/invalidation. Each retained regression first failed for the relevant mechanism and then passed. Final static correction review finds no additional actionable defect; it is not execution certification.

The earlier full host85846 ended exit1 (451total/446pass/onefailure/fourplatformskips): a deterministic clock fixture also launched real PowerShell under a five-second budget and failed during loaded startup. The fixture now uses controlled attribute attestation for that clock case; separate actual stock-runtime/junction tests retain the fixed ten-second production cap. Later empty-source handoff and unissued-verification regressions also changed the runtime/test snapshot. The failed/older run establishes no final acceptance; a fresh complete gate is required on the final source. No unchanged failed command is retried without those corrections.

The final local full command is sequential `npm run check:all`, `npm run api:extractor`, `npm run check:packages`, after the Workbench exact-byte gate. Its actual outcome and exact committed-head Windows/Ubuntu×Node22/24 runs are recorded in PR30. No installed corpus input, full graph acceptance, game-loader conformance, merge, tag or publication is inferred from these file-port tests.

Final local host95658, Windows Node26.13.1: actual final exit0, **453total/449pass/fourplatformskips/zero failures**. Build, eight-package acyclic architecture/dependencies,78beta API baselines/exports, strict eight-report Extractor and actual licensed package contents all pass on the unchanged runtime/test source snapshot (native SHA740f278f5c3e76f56f538b27e81618942bdd28bb9bf983251fb62fbe3db77504; transport SHA7ba5db6d2fd4ef00022590c365f5cd5088db616a258c95461ec45cd7a9046e50). Final documentation updates record that result only. This fresh gate supersedes failed85846 for local acceptance; supported-platform claims still require exact committed-head CI.


## Subsequent approved helper deadline amendment

The ten-second inspect preset and hashes above describe the accepted fc2cb8e native checkpoint. Parser checkpoint c86d338 subsequently retained a native helper startup failure in local full host51592 and Windows24 PR job134378253088; no installed input was read and no failed result gained credit. The user explicitly approved [A–D](https://github.com/Zilvereyes/wow-addon-sdk/pull/30#issuecomment-6961659940): fixed inspect maximum/default30seconds including startup/replacement, clamped to remaining operation time, with independent10second close and replacement reaping. Post-wait absolute deadlines reject late acknowledgements even before an overdue timer callback fires. There is no automatic retry or change to PS bytes/argv/path rules/overall budget/Lua/XML limits. Four deterministic transport regressions and actual native fixtures are required, with final commands and exact-head CI in [the parser record](REVIEW-SELECTED-SOURCE-ANALYSIS.md) and PR30. Historical failures remain failures; the whole graph/corpus goal remains open.

## Windows inspection phases and helper allocation

On runtime `dd4da4d`, the authored Windows Node 24.22.3 profile listed 49 nested directories twice, read 32 Lua sources, then verified every directory and source fingerprint. Both listings and all authored source bytes matched. The observer counts the real stock Windows inspector calls by their native caller. It reports only aggregate numbers.

```powershell
node docs/proposals/selected-source-native-attribute-profile.mjs
```

| Attribute call site | Helper calls | Rows |
| --- | ---: | ---: |
| Root ancestors after bootstrap | 1,925 | 1,925 |
| Cached-directory validation | 577 | 577 |
| Matched path components | 544 | 544 |
| Directory scan boundaries | 196 | 196 |
| Directory entry batches | 98 | 864 |
| Source read boundaries | 128 | 128 |
| Initial root bootstrap | 7 | 7 |

The root walks are a large part of this workload. Each path still receives the approved native attributes and canonical/identity checks in the same order. The helper now constructs its per-request StringBuilder directly through the stock .NET constructor. Its framing, UTF-8 policy, per-request bounds, request validation and attribute API call stay in place.

The initial constructor comparison ran in an isolated authored fixture before Workbench registration. The review used the subsequent comparison with exact-byte gates for both execution artifacts. Each of four Windows Node 24.22.3 series issued 500 singleton and 16 batched requests to the real helper. All 788 rows per series matched, including the explicit missing-path and junction cases. Stock `1.0.1` took 2,370 and 1,971 ms. Registered `1.0.2` took 1,388 and 1,463 ms. These timings measure the authored transport workload.

Workbench component `8966c355-7324-4aba-966f-542309e2581a` version `1.0.2` passed its exact-source gate. `powershell.exe` and `pwsh.exe` both parsed the candidate with exit 0 and the automatic-variable check passed. The contract now records the approved 30-second inspection deadline and the separate 10-second close/reap deadline. The earlier source pin and its historical evidence remain recorded above. [Current source pin](workbench/selected-source-path.registration.json) · [Current helper contract](workbench/selected-source-path.contract.json)

On Windows Node 24.22.3, after gating the checked-out helper, the native, retention, cache-pressure and Windows transport suites passed 64 cases with one Linux-only skip and zero failures. The updated helper also passed the authored directory/source profile. Every phase retained its original call and row count, with 3,475 attribute requests and 4,241 rows overall. The installed corpus will be replayed with the original operation budget and the new helper and registration bytes included in its runtime source identity.

## Batched Windows root attributes

The read-only host now checks the current identity of each root ancestor before and after a grouped attribute request. Missing responses, reparse attributes, identity changes and expired operation time block the read. The canonical root check still follows attribute and identity checks. A subsequent cached-root check compares its current stamp against the pre-inspection stamp before sharing the attribute result. Root chains that exceed the existing 128-row or 1 MiB request limits use individual inspections, selected before a request starts. The grouped requests run through the registered PowerShell helper 1.0.2 and its existing request, close and global deadlines.

On Windows Node 24.22.3, six alternating measurements on seven authored directories reduced each 180-chain test from 1,260 to 180 helper frames. The median fell from 3,426 to 1,592 ms with equal attribute rows (host session 61564, exit 0). A separate test used four alternating pairs of warm native reads and rereads on the same authored fixture. Each 12-pair trial issued 792 attribute rows and 24 read-only source opens. Frames fell from 792 to 264 and the median from 2,741 to 1,624 ms. Bytes and fingerprints matched across the two hosts (session 34028, exit 0).

The focused Windows Node 24.22.3 command `node --test --test-concurrency=1 tests/selected-source-native.test.mjs tests/selected-source-windows.test.mjs tests/selected-source-cli.test.mjs` exited 0 with 38 passes and one Linux-specific skip (session 18508). Three subsequent controls passed with exit 0. They include a stamp change requiring a fresh adjacent inspection, an incomplete batch, reparse and identity failures, the exact deadline, and both serial fallback limits. These checks establish the native boundary and its authored timing. The original 100-group graph still needs its full run and final integrity accounting. [Current exact-head evidence](https://github.com/Zilvereyes/wow-addon-sdk/pull/30)

## Fixed native failure observation

The isolated full trial produced 309 validated parser replies and 309 failed source verifications. The observer could count rejected native calls and false verification results, while the native port itself discarded the underlying check labels. [Trial receipt](REVIEW-SELECTED-SOURCE-CORPUS.md#isolated-launcher-prototype-on-the-full-local-request)

Trusted tooling can now pass an `onFailure` observer when creating the native host. It receives a fixed operation, outcome, error code and check label. The operation identifies directory listing, source read, source verification or directory verification. The outcome distinguishes rejected calls from verification mismatches. The check can distinguish a root-ancestry identity change, a changed root directory stamp, an already invalidated snapshot, file stat changes and fingerprint mismatch. Unexpected OS errors are represented by the fixed native I/O code. Events contain no input paths, file contents, hashes or OS error text. The observer runs only during these failures, and its own exception leaves the operation's result intact. The CLI and its aggregate format retain their existing contracts.

The authored root-change regression first verifies the original source, then changes its temporary directory. The next read reports `root-directory-stamp`. Source verification reports `root-directory-invalidated` without reopening the source, while the root verification reports `directory-fingerprint`. The separate authored access-denied case checks the I/O fallback and the subsequent invalidated-source label. Neither synthetic case identifies the cause of the earlier installed trial.

The two added controls failed as expected on the unmodified `95e2220` native module with exit 1 and two empty observation lists. On Windows Node 24.22.3, `node --test --test-concurrency=1 tests/selected-source-native.test.mjs tests/selected-source-windows.test.mjs tests/selected-source-cli.test.mjs` exited 0 with 41 passes and one Linux-specific skip (host session 35988).

For another authorized installed trial, retain the first fixed record with elapsed time and the number of parser submissions, then aggregate by operation, outcome, code and check. Keep the original 100 groups, 227 candidate rows, selected profiles, read-only guard, parser limits and 900-second ceiling. Reconcile successful source reopens independently of false verification results. A full, integrity-verified aggregate is still required for Stage 7.
