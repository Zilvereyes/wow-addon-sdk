# Project review coverage index — 2026-11-18

Inventory snapshot: **e0fd1a1e5e128a14f714cbe8fa72355dd93647db**, exactly **235 tracked files**. This new index is outside that snapshot and its count. Each 40-character identifier below is the Git SHA-1 **blob object ID** returned by `git ls-tree -r` for that commit, not a checkout-byte SHA-256. Git normalization, including CRLF PowerShell checkout policy, does not change these committed blob IDs.

This is an audit index and dependency plan. It records bounded static inspection and attributed historical evidence; it does not certify all files reviewed, a clean corpus, client conformance, release readiness or the broader goal complete. Preparation read tracked project files/Git metadata only and wrote this file only. No tests, builds, generating gates, scans, installed inputs, private profiles/evidence or untracked documents/workflows were opened or run. The parent owns live CI/corpus conclusions and integration.

## Evidence meanings and limits

- **S01–S18:** this independent current-snapshot infrastructure pass, limited to the source lens/anchors below. Working-tree equality to the inventory commit was checked for all 23 S/T paths using `git diff --name-only e0fd1a1 -- <explicit paths>` (empty). This is bounded static review, not comprehensive behavioral acceptance.
- **T1–T5:** current control/fixture inspection, including sampled assertions and ownership paths. These are not claims that every test was independently reviewed or executed.
- **H68=:** same path and blob verified equal to **eac072fa33c09715356d0b05aefd26580138a9f4** (68-file tree). Only this equality carries the historical per-file review in [REVIEW-2026-11-16.md](REVIEW-2026-11-16.md#scope-and-evidence). That record's later milestone appendices are not an all-current-files audit.
- **M07=:** same path/blob verified equal to **07b79a88150804be87b3d9c041bc7f2ff23e531f**, the reviewed inline/corpus base explicitly identified in [the graph proposal review packet](REVIEW-SELECTED-SOURCE-GRAPH-PROPOSAL.md). Applied only to concrete categories/files covered by [inline acceptance, Deliverable and contracts / Project-file review and fixes](REVIEW-INLINE-LUA-v0.7.0.md): package source/manifests/references/Extractor configs/reports/licenses, baselines, named gate/worker/example/test changes and manifest/lock changes. This carries its **recorded milestone scope**, not a new individual review or later runtime acceptance. Equality alone is never review evidence: 180 current files equal that 187-file tree, but only 87 receive this tag.
- **GE recorded:** named engine/resolver/CLI/native-budget files or authored controls in [engine checkpoint](REVIEW-SELECTED-SOURCE-ENGINE.md#implementation-and-invariants), including its Review corrections section.
- **GA recorded:** four named parser/validator modules and analysis test in [analysis checkpoint](REVIEW-SELECTED-SOURCE-ANALYSIS.md#implemented-boundary).
- **GN recorded:** named native/Windows/helper modules, native/transport tests and helper contract/pin in [native checkpoint](REVIEW-SELECTED-SOURCE-NATIVE.md#implemented-boundary) and its Workbench checkpoint.
- **GI recorded:** named lexical/context/selection modules and tests in [implementation stages 1–2](IMPLEMENTATION-SELECTED-SOURCE-GRAPH.md).
- **GC recorded:** named native/budget/engine/cache-pressure correction files/tests in [corpus correction table and parent verification](REVIEW-SELECTED-SOURCE-CORPUS.md#measured-retention-pressure-and-bounded-correction).
- The five **G… recorded** tags identify concrete recorded scope only. No historical/source equality or exact-current acceptance is inferred for them; verify the corresponding change range/evidence before closing a row. Reading a review record does not mean its own accuracy has been audited.
- **U:** no concrete attributable per-file static review selected in the original matrix. Supplemental lenses below are recorded separately without rewriting that baseline accounting. This means evidence remains unbound in the original row, not that nobody has ever reviewed the file. Merely inventorying/hashing/reading a file never promotes it to reviewed.

Priorities **P1/P2/P3** rank remaining review work, not defect severity. **Q1–Q4** name the remaining action/deliverable below; every row remains in a queue even when historical/bounded evidence exists.

## Current bounded source/control lenses

| Evidence | Exact path and source anchors | Actual lens |
| --- | --- | --- |
| S01 | `scripts/run-tests.mjs:11–42` | discovery, empty-suite refusal, child exits; symlink policy unconfirmed |
| S02 | `scripts/check-architecture.mjs:63–72;130–133` | dependency/reference boundaries; basename candidate is not a full-CI bypass |
| S03 | `scripts/check-public-exports.mjs:29–47;51–134` | root conditions, license equality, backend entry/byte provenance |
| S04 | `scripts/check-package-contents.mjs:12–35;44–57` | actual dry-run listing, versions, exact payloads, fixed npm invocation |
| S05 | `scripts/check-api-snapshots.mjs:16–52` | compiled/baseline equality, export forms/counts and beta/runtime split |
| S06 | `scripts/run-api-extractor.mjs:56–84;137–160` | all-config strict preflight before CLI; process failures |
| S07 | `scripts/Test-WoWAddonCore.ps1:11–32` | locked install, sequential gates, native exits; no installed invocation |
| S08 | `scripts/create-toc-selection-probe.mjs:40–87` | canonical parent, AddOns rejection, new/exclusive writes; no deletion |
| S09 | `.dependency-cruiser.cjs:1–27` | secondary DAG/import-boundary rules; resolver coverage remains a queue item |
| S10 | `.gitattributes:1–4` | LF baseline and CRLF PowerShell checkout policy |
| S11 | `.gitignore:1–end` | generated/private-output exclusions; no private files inspected |
| S12 | `.github/workflows/ci.yml:1–51` | four-job OS/Node matrix and separate strict/package gates; no live-job credit |
| S13 | `package.json:7–33` | workspace/scripts/engines topology; dependency provenance remains Q1 |
| S14 | `tsconfig.json:1–29` | root build references; exact reference targets remain Q1 |
| S15 | `packages/lua-analysis/tsconfig.json:1–17` | compiler envelope, source scope and approved references |
| S16 | `packages/xml-parser/tsconfig.json:1–23` | compiler envelope, source scope and diagnostics reference |
| S17 | `packages/diagnostics/package.json:1–17` | root-only distribution metadata and MIT declaration |
| S18 | `examples/inspect-toc.mjs:1–34` | authored single-file example and error exits; no invocation |
| T1 | `tests/hardening.test.mjs:12–29` | empty discovery and failure propagation controls; sampled static inspection, not execution |
| T2 | `tests/gate-hardening.test.mjs:14–68;71–182` | copied fixture ownership, strict-config/backend negative controls; sampled static inspection, not execution |
| T3 | `tests/package-contents.test.mjs:12–57` | exact listing, license/path/duplicate controls; sampled static inspection, not execution |
| T4 | `tests/review-regressions.test.mjs:45–end` | sampled architecture/export/API fixture and assertion paths; sampled static inspection, not execution |
| T5 | `tests/toc-selection-probe.test.mjs:13–103` | authored output/refusal/junction controls; sampled static inspection, not execution |

No current product defect was established by these lenses. Two deferred synthetic controls are useful: the architecture audit compares tsconfig-reference basenames (S02), while full CI builds first and catches a missing redirected project; discovery ignores symlink test entries (S01), but current tracked scripts/tests/packages have no symlink modes. Neither is a demonstrated current full-CI bypass. Use isolated authored fixtures after competing live work ends, preserve positive controls, and distinguish standalone-gate limitations from product failures. The reviewed probe writer uses a canonical parent, new directory, exclusive writes and ready-manifest-last; no deletion path was found in its source.

## Reconciled totals

| Inventory grouping | Files |
| --- | ---: |
| Root files outside .github | 10 |
| .github | 1 |
| api | 8 |
| docs | 60 |
| examples | 11 |
| packages | 51 |
| scripts | 36 |
| tests | 58 |
| **Total** | **235** |

Evidence tags overlap: S=18, T=5, H68=31, M07=87, G-recorded=35. A disjoint accounting using first applicable S → T → H68 → M07 → G → U is **18 + 5 + 27 + 55 + 35 + 95 = 235**. Queue partition: **Q1=75, Q2=30, Q3=69, Q4=61; total235**. None is a count of fully audited files.

## Dependency-ordered review actions

| Queue | Deliverable / dependency | Failure cases to inspect | Measurable closure |
| --- | --- | --- | --- |
| Q1 — package/core/lock/config/gates (75) | Current source-to-contract/package matrix; exact installed/locked dependency provenance; all eight manifests, project references/configs/reports and gate negative controls. Include S-pass conclusions, without treating them as complete closure. First reconcile terminal exact-head CI and preserve live-run stability. | Actual reference target differs despite matching basename; stale/incremental outputs; omitted type contracts/tests; unapproved exports/dependencies/loader redirects; license/notice/payload leakage or missing bytes; core semantics/provenance/ownership regressions. | Every Q1 row has an individual review note or verified carry-forward scope plus current-delta review. Recorded synthetic failures distinguish each gate from protection supplied by build/other gates. After source changes, parent runs fresh full/strict/package acceptance on that exact source; no generating gates overlap. |
| Q2 — tooling lifecycle/validators/helper (30) | Ownership/lifetime and trust-boundary matrix after Q1 contracts: reader, worker/thread/client paths, independent projections, native/helper protocol and shared budgets. Bind GE/GA/GN/GI/GC records to exact source ranges. | Getter/iterator reuse, coherent forged/omitted facts, partial-credit leaks, late replies, kill versus actual reap, duplicate successor, failed reservation cleanup, replacement races, stale paths/snapshots and exposed private identities. | Every lifecycle and publication branch links to source anchors and authored acceptance controls; current deltas are independently reviewed. Preserve fixed approved ceilings/helper bytes/path policy. Run necessary focused controls only after live corpus work ends. |
| Q3 — tests/type fixtures/examples (69) | Test-discovery/contract-inclusion map and authored-fixture license/ownership map, following Q1/Q2 behavior. S18/T lenses are starting evidence. | Tests not discovered/compiled, skipped or assertion-free controls, implementation-mirroring checks, false-green child failures, unsafe recursive cleanup/symlink traversal, source execution in parser fixtures, example claims exceeding observed behavior. | Every test/contract/catalog row is mapped to the actual runner/compiler and intended requirement; exact/one-over and failure/valid recovery controls are identified. Missing controls are reproduced before fixes. Temp cleanup targets are resolved and contained before deletion. |
| Q4 — docs/evidence/proposals/status (61) | Current capability/approval/domain matrix after technical acceptance, with each historical report retained at its own source. Reconcile public aggregate schemas without opening private ledgers. | Old planned states described as current; tests/static review/live corpus conflated; found files counted as parsed; historical CI transferred to new bytes; selected-graph coverage erasing inventory findings; unsupported client/handler/domain or completion claims. | All Q4 rows have accuracy/disposition notes. Counts and source identities reconcile with actual terminal evidence; remaining handler/font/animation/binding/client-policy decisions stay explicit. Refresh ROADMAP current-graph pointer after terminal evidence, not while a run is live. |

Code/core gates establish their named build, API, architecture, dependency, package and authored-test properties. Static review supplies source reasoning within its scope. A live installed run supplies only its observed, policy-bound parsing/integrity/coverage result; exit1, missing contexts, unsupported domains and existing diagnostics remain failures/limits. None substitutes for the other layers, and this index adds no permission or durable rule.

## Per-file matrix

The final column identifies the remaining queue action above, not a completed review. Exact repository paths are case-sensitive inventory labels.

| Exact repository path | Git blob SHA-1 | Classification / priority | Actual evidence | Remaining action |
| --- | --- | --- | --- | --- |
| `.dependency-cruiser.cjs` | `487ae6a5f0b97ad12ff440622dba6373b72db12b` | root config/P1 | S09; M07= | Q1 |
| `.gitattributes` | `2de0b2c92fcd090229380520f9f913eb21d616f8` | root config/P1 | S10; H68= | Q1 |
| `.github/workflows/ci.yml` | `d6330e20d3192f3b8d39fa6c2a12f65ab6e7262d` | root config/P1 | S12; M07= | Q1 |
| `.gitignore` | `b066214a7784b9d5b8e589b7d95b4aa06890dd33` | root config/P1 | S11; H68= | Q1 |
| `CHANGELOG.md` | `486dccfb82a7c26db5de1aeb4f35848892d1bba1` | document/P3 | U | Q4 |
| `CONTRIBUTING.md` | `5b4bae5b748b816ac74e949430b6759f463c3436` | document/P3 | U | Q4 |
| `LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | H68= | Q1 |
| `README.md` | `4ec6d6acaebe41631651c509155d2588e9ffbfb2` | document/P3 | U | Q4 |
| `api/baselines/addon-metadata.d.ts` | `2dfa86d0ecf259df209e51b2a216a2290e96843f` | API baseline/P2 | M07= | Q1 |
| `api/baselines/diagnostics.d.ts` | `d698f78175878fa807f4b1b36e530d4994b6a99c` | API baseline/P2 | H68=; M07= | Q1 |
| `api/baselines/global-registry.d.ts` | `23606702f1d0bb072658e7cf4b4bb636eb01e84f` | API baseline/P2 | M07= | Q1 |
| `api/baselines/lua-analysis.d.ts` | `ec1b9dd6205ae756dc1b65196d5b0fb1176e5224` | API baseline/P2 | M07= | Q1 |
| `api/baselines/toc-metadata-adapter.d.ts` | `31d264386f9dec4f1fcab148c94caa89f6f9bb30` | API baseline/P2 | M07= | Q1 |
| `api/baselines/toc-parser.d.ts` | `6d97f8f74dd900440306b7d6a1f03c43f433dd24` | API baseline/P2 | H68=; M07= | Q1 |
| `api/baselines/xml-analysis.d.ts` | `5087b3553e339f3b54894096789059f57cc9ec8c` | API baseline/P2 | M07= | Q1 |
| `api/baselines/xml-parser.d.ts` | `581031e4e0f34ac4b8d5daa89a373d1eb1f4255f` | API baseline/P2 | M07= | Q1 |
| `docs/API-POLICY.md` | `51ba4f66dce15b49e59c9463a480f898b28390e4` | document/P3 | U | Q4 |
| `docs/ARCHITECTURE.md` | `12447731eaccbd4cce97471902e232e26b372f4a` | document/P3 | U | Q4 |
| `docs/DESIGN-LUA-ANALYSIS.md` | `5527060fdc48c3463c55e7cd52467b98f4cd3b9c` | document/P3 | U | Q4 |
| `docs/DESIGN-LUA-CORPUS-PROFILE.md` | `dd6f98a1eb131b044932b6000381ffc789a2baac` | document/P3 | U | Q4 |
| `docs/DESIGN-v0.3.0.md` | `c37bfb42abddd16e97b2aae75fbfa7c79253a30c` | document/P3 | U | Q4 |
| `docs/DESIGN-v0.3.1.md` | `93883f51503d4ad319f690d012594241140341c0` | document/P3 | U | Q4 |
| `docs/DESIGN-v0.3.2.md` | `c0397c88ab51afb8ccf4b1019b1220e5c9ff98d9` | document/P3 | U | Q4 |
| `docs/DESIGN-v0.3.3.md` | `e5ecc03a5d7733210467157101b77c3cd1318fa3` | document/P3 | U | Q4 |
| `docs/DESIGN-v0.3.4.md` | `1ebb27389c6ee381f70ad4fe6e0e1a7adaf5377b` | document/P3 | U | Q4 |
| `docs/DIAGNOSTIC-CODES.md` | `688f838288f03ea16ea7d7b38f52cf77f11e69e2` | document/P3 | M07= | Q4 |
| `docs/EXECUTION-v0.3.5.md` | `b7eac57fa97225c37da2efa3e4879afb1dded15d` | document/P3 | U | Q4 |
| `docs/GOAL-v0.3.5.md` | `04d50d98c35de29a7ec3a28b1cad10e7b60c8162` | document/P3 | U | Q4 |
| `docs/IMPLEMENTATION-SELECTED-SOURCE-GRAPH.md` | `d18e39e123b7ccda2e89c0b7766bb8ba719a8934` | document/P3 | U | Q4 |
| `docs/LICENSING-AND-THIRD-PARTY.md` | `9c1e4774c33d723d0ee2e1c3e79fb731cdb364b3` | document/P3 | U | Q4 |
| `docs/LOCAL-CORPUS-TESTING.md` | `cf38d9208a11d9c8de0cc1f4b434658bde1b577d` | document/P3 | U | Q4 |
| `docs/MIGRATION-v0.1-to-v0.2.md` | `129d438d20580efa184393c62d76557e50106cb6` | document/P3 | H68= | Q4 |
| `docs/MIGRATION-v0.2-to-v0.3.md` | `b20af37ffcb8a3edaa77fa31b44b7db682c38488` | document/P3 | U | Q4 |
| `docs/MIGRATION-v0.3-to-v0.4.md` | `b0ea7baefeea962f0b36c81e93f05034020ea88f` | document/P3 | U | Q4 |
| `docs/MIGRATION-v0.4-to-v0.5.md` | `d9d116cda7827f1e43dcd6390c88b0159b788d5a` | document/P3 | U | Q4 |
| `docs/MIGRATION-v0.5-to-v0.6.md` | `afb6a533c4314d3df1c3d9f607b3113a9cf2e0e7` | document/P3 | U | Q4 |
| `docs/MIGRATION-v0.6-to-v0.7.md` | `6b704a2cd421dce001a566ad2431963c536fba70` | document/P3 | M07= | Q4 |
| `docs/PLAN-CORPUS-ACCOUNTING.md` | `c79b8a03543c5b19d484bb658d06f4923bd66214` | document/P3 | U | Q4 |
| `docs/PRE-FREEZE-REVIEW.md` | `7dfda4f843a85666c8229aba8a4478c59886bf1b` | document/P3 | U | Q4 |
| `docs/PROPOSAL-INLINE-LUA.md` | `57ff0303b7d90653982e92ef62c2afc40ca835b6` | document/P3 | U | Q4 |
| `docs/PROPOSAL-SELECTED-SOURCE-GRAPH.md` | `0a09603509463f8d92d8a1a15fe8f7e8c13c3562` | document/P3 | U | Q4 |
| `docs/PROPOSAL-XML-PROVIDER.md` | `e9a767f5e8c87f525b14b19d51f14d3c7ecd61a9` | document/P3 | U | Q4 |
| `docs/PROPOSAL-XML-SYNTAX.md` | `1f3ecaa211a22bc66768cac79a7c3ef3fbe733b0` | document/P3 | U | Q4 |
| `docs/PUBLIC-SURFACE.md` | `82f352dff59db8d0e9cd0c2a697c689793eb245e` | document/P3 | U | Q4 |
| `docs/RELEASE-READINESS-v0.3.5.md` | `0bfd1cd6676eb047ab5a59deb80a783b93ac58f2` | document/P3 | U | Q4 |
| `docs/REVIEW-2026-11-16.md` | `d98ac127b881f782de54fb0248d0f43d210677d0` | document/P3 | U | Q4 |
| `docs/REVIEW-CORPUS-ACCOUNTING.md` | `2efedea70ce58d741dbade7bcabc754706e2ef1e` | document/P3 | U | Q4 |
| `docs/REVIEW-FOLLOWUP.md` | `8c9a08011ec0c99f5344ada91d87393880e15190` | document/P3 | H68= | Q4 |
| `docs/REVIEW-HANDLER-CONTEXT-EVIDENCE.md` | `178dfbed7d06b8401947ca8fc4f08338e690d097` | document/P3 | U | Q4 |
| `docs/REVIEW-INLINE-LUA-CORPUS.md` | `294f1ecbc16699ba5611bc4417535f6395a378a3` | document/P3 | U | Q4 |
| `docs/REVIEW-INLINE-LUA-PROPOSAL.md` | `6aaa2ae237ee399102972b8954c9be20adcafee0` | document/P3 | U | Q4 |
| `docs/REVIEW-INLINE-LUA-v0.7.0.md` | `6353ee05312db1850e21f6a5583906e13a002f98` | document/P3 | U | Q4 |
| `docs/REVIEW-LUA-CORPUS-v0.4.1.md` | `571633a046ba86bcdbb422fe2b33738bc1c7082d` | document/P3 | U | Q4 |
| `docs/REVIEW-LUA-v0.4.0.md` | `82bd8d42421b2207771e9ce3672a910990d584c4` | document/P3 | U | Q4 |
| `docs/REVIEW-SELECTED-SOURCE-ANALYSIS.md` | `fb13c0141a1b1671f2eae103e832b1307040ae16` | document/P3 | U | Q4 |
| `docs/REVIEW-SELECTED-SOURCE-CORPUS.md` | `dbb7e8163822aa55e03d01ef16154cef2cf9f691` | document/P3 | U | Q4 |
| `docs/REVIEW-SELECTED-SOURCE-ENGINE.md` | `0ea878aef81b30386cf459aef0f60131c7f42112` | document/P3 | U | Q4 |
| `docs/REVIEW-SELECTED-SOURCE-GRAPH-INDEPENDENT.md` | `e677f523854c88327d561d4848c8c54414121be7` | document/P3 | U | Q4 |
| `docs/REVIEW-SELECTED-SOURCE-GRAPH-PROPOSAL.md` | `5e696314edc10095cf09be98c3e52054b8f64b5a` | document/P3 | U | Q4 |
| `docs/REVIEW-SELECTED-SOURCE-NATIVE.md` | `1d860042dc890c3e5ecdd2f4ef2a3babf3e49af2` | document/P3 | U | Q4 |
| `docs/REVIEW-TRIAGE-2026-11-15.md` | `a7806b207506bb68033f36871c94bd6f5eec60c3` | document/P3 | H68= | Q4 |
| `docs/REVIEW-XML-PROVIDER-v0.6.0.md` | `de421992d73ca2d85bb6fe4b6aaa5bd55e6cbe27` | document/P3 | U | Q4 |
| `docs/REVIEW-XML-v0.5.0.md` | `b0d16a8d887819b14b87ba5b134be15a6a41500e` | document/P3 | U | Q4 |
| `docs/ROADMAP-v0.3.5.md` | `2cd60ebec943085446ed22b29a0c88b28d6c686d` | document/P3 | U | Q4 |
| `docs/TOC-SELECTION-CLIENT-PROBE.md` | `57890023798a46fc245292b5dab9c86dacd0ff27` | document/P3 | U | Q4 |
| `docs/XML-PROVIDER-PROFILES.md` | `ebc96fdfbd55d094c87c99c599137eace7db85aa` | document/P3 | U | Q4 |
| `docs/evidence/corpus-accounting-2026-11-17.json` | `190a24c703c76097aa7aab8dc2c6fb65e5c6fe71` | aggregate evidence/P2 | U | Q4 |
| `docs/evidence/inline-lua-corpus-2026-11-17.json` | `1071624522bad04cf0cdeffbbe4290715c426a12` | aggregate evidence/P2 | U | Q4 |
| `docs/evidence/selected-source-graph-baseline-2026-11-18.json` | `a6d73a262341d4564f3ae613dc821e6251a80f90` | aggregate evidence/P2 | U | Q4 |
| `docs/proposals/inline-lua-characterization.mjs` | `6f11e7733a7eb8530b6f7f1e2f4cd24191caa4cb` | proposal fixture/P2 | U | Q4 |
| `docs/proposals/inline-lua-contract.ts` | `02776d6c9c1f2856dc459c700053eb072a8c5fd7` | proposal fixture/P2 | U | Q4 |
| `docs/proposals/selected-source-graph-characterization.mjs` | `453480d0e579cabfb9cb072db8eed1fc96abb106` | proposal fixture/P2 | U | Q4 |
| `docs/proposals/selected-source-graph-contract.ts` | `29cf525fbabc8b5d28f0faf263247f89f330c56a` | proposal fixture/P2 | U | Q4 |
| `docs/proposals/selected-source-graph-profile.json` | `3ebc3e1a0968f74d9a6408896f59e893844072c4` | proposal fixture/P2 | U | Q4 |
| `docs/workbench/selected-source-path.contract.json` | `51e22f22fbbf2548f6c8831a2d946fdda43dc0b6` | helper contract/P1 | GN recorded | Q2 |
| `docs/workbench/selected-source-path.registration.json` | `12cdbfdb63fb76e6b27646f1b90445f9cbee738b` | helper contract/P1 | GN recorded | Q2 |
| `examples/ZilverUI/ZilverUI_Mainline.toc` | `521bcb1fc7d019b7f61ba302f66222cdfee37534` | example/P2 | H68= | Q3 |
| `examples/classic-era-condition-profile.json` | `83084c048c3146ea577fd3f6f2b2d72eba0ff461` | example/P2 | U | Q3 |
| `examples/classic-era-resolution-profile.json` | `a9cefa30d8e67892d778a2ec994a74b4aa0d07d9` | example/P2 | U | Q3 |
| `examples/classic-era-selection-profile.json` | `3fd2dea881a50eddb76f1c66c55fb12a8501373f` | example/P2 | U | Q3 |
| `examples/inspect-toc.mjs` | `c4ee9aabba5a445a6ad8d4c3308c7e59c5cd6678` | example/P2 | S18; H68= | Q3 |
| `examples/xml-inline-lua-profile.json` | `5efc2dbb96fd5e91175dba11bbcd738ca84accf4` | example/P2 | M07= | Q3 |
| `examples/xml-inline-lua/Example.toc` | `f00bafffd4ec0ce1c2a38be3487b64d610d7d9eb` | example/P2 | M07= | Q3 |
| `examples/xml-inline-lua/Example.xml` | `fa43d2e69b4fb44395f028e6e54bfd58a2d019e2` | example/P2 | M07= | Q3 |
| `examples/xml-provider-profile.json` | `b84db158ca23327e372685b1bf26d154c985e3fd` | example/P2 | U | Q3 |
| `examples/xml-provider/Example.toc` | `840059a707ba1939f50c8e439508f24182000aa2` | example/P2 | U | Q3 |
| `examples/xml-provider/Example.xml` | `014c7a808b061871cac3f905a72c06a96747d455` | example/P2 | U | Q3 |
| `package-lock.json` | `f7f4ff04f6b87d7c7cb7ef23c5420dc7ecbc2c7a` | lock/P1 | M07= | Q1 |
| `package.json` | `38d7bcce8c38fc363875e4e0752802abf6687487` | root config/P1 | S13; M07= | Q1 |
| `packages/addon-metadata/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | H68=; M07= | Q1 |
| `packages/addon-metadata/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | H68=; M07= | Q1 |
| `packages/addon-metadata/etc/addon-metadata.api.md` | `3756f0329b94caa97c718a531ac5cbe4a1eff2ee` | API report/P2 | M07= | Q1 |
| `packages/addon-metadata/package.json` | `afc822c2319f37fa137e299850e19ccbb131dd0b` | package config/P1 | M07= | Q1 |
| `packages/addon-metadata/src/index.ts` | `6085612d096f69bec18ff52f76f79162de13896f` | SDK source/P1 | M07= | Q1 |
| `packages/addon-metadata/tsconfig.json` | `24cdd8ce38ece2fd445d4e09b3a7c275a57ba519` | package config/P1 | H68=; M07= | Q1 |
| `packages/diagnostics/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | H68=; M07= | Q1 |
| `packages/diagnostics/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | H68=; M07= | Q1 |
| `packages/diagnostics/etc/diagnostics.api.md` | `42780e0d9e495923af803e4acb7751d2efb095da` | API report/P2 | H68=; M07= | Q1 |
| `packages/diagnostics/package.json` | `2159a7842aa13320f6f91c49dcb045c3fca35507` | package config/P1 | S17; M07= | Q1 |
| `packages/diagnostics/src/index.ts` | `d72282596a54276bc45c9f3ca7a29ac19a23197f` | SDK source/P1 | H68=; M07= | Q1 |
| `packages/diagnostics/tsconfig.json` | `d92d283ec41f4356ce977f7cd94560fb8e495b40` | package config/P1 | H68=; M07= | Q1 |
| `packages/global-registry/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | H68=; M07= | Q1 |
| `packages/global-registry/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | H68=; M07= | Q1 |
| `packages/global-registry/etc/global-registry.api.md` | `3ba095818378ce0959500bcca7682af72d23c8a8` | API report/P2 | M07= | Q1 |
| `packages/global-registry/package.json` | `fd280f3eba0fc57f1a91c31e48dca20d3cd56f83` | package config/P1 | M07= | Q1 |
| `packages/global-registry/src/index.ts` | `c37c4838c78abb2f706103b07acd679a504d25b9` | SDK source/P1 | M07= | Q1 |
| `packages/global-registry/tsconfig.json` | `24cdd8ce38ece2fd445d4e09b3a7c275a57ba519` | package config/P1 | H68=; M07= | Q1 |
| `packages/lua-analysis/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | M07= | Q1 |
| `packages/lua-analysis/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | M07= | Q1 |
| `packages/lua-analysis/etc/lua-analysis.api.md` | `dcbf65a9ec9bbd1485caa05f40e11b4652b431df` | API report/P2 | M07= | Q1 |
| `packages/lua-analysis/package.json` | `228d90cfc514ed08e32a4b61a1c5fc84c6284fa5` | package config/P1 | M07= | Q1 |
| `packages/lua-analysis/src/backend.d.ts` | `57eaff1cec77d637b2fc0090f6fbadb5f2a6597a` | SDK source/P1 | M07= | Q1 |
| `packages/lua-analysis/src/index.ts` | `1505376c6aafa74056b507ee5712ecdccb599a5f` | SDK source/P1 | M07= | Q1 |
| `packages/lua-analysis/src/syntax.ts` | `cd6b15ae5b7600bc37fb236df7a00c1baf50467c` | SDK source/P1 | M07= | Q1 |
| `packages/lua-analysis/tsconfig.json` | `900c9c5ba32aee825d06dad0c96143fc478462ec` | package config/P1 | S15; M07= | Q1 |
| `packages/toc-metadata-adapter/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | H68=; M07= | Q1 |
| `packages/toc-metadata-adapter/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | H68=; M07= | Q1 |
| `packages/toc-metadata-adapter/etc/toc-metadata-adapter.api.md` | `d6b6b6c6efeeb1329f08a27952c3aa3e59137121` | API report/P2 | M07= | Q1 |
| `packages/toc-metadata-adapter/package.json` | `aa68abe052835f433ce938503eb5ee8689edec9f` | package config/P1 | M07= | Q1 |
| `packages/toc-metadata-adapter/src/index.ts` | `be049c96d0f4838dfa83a21a8c22d28ff0ad6f0e` | SDK source/P1 | M07= | Q1 |
| `packages/toc-metadata-adapter/tsconfig.json` | `b9e78b19e8d036e1238c0e44a1140c0f61b8c4f5` | package config/P1 | H68=; M07= | Q1 |
| `packages/toc-parser/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | H68=; M07= | Q1 |
| `packages/toc-parser/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | H68=; M07= | Q1 |
| `packages/toc-parser/etc/toc-parser.api.md` | `992007336e02cdc18a31c0cbcf6ef7c5164677f1` | API report/P2 | H68=; M07= | Q1 |
| `packages/toc-parser/package.json` | `bd6ab83a07922c692be207a752e01f5871ecef2d` | package config/P1 | M07= | Q1 |
| `packages/toc-parser/src/index.ts` | `a98a59cfd852dfa71d9d8de4be2a0abb9557af85` | SDK source/P1 | M07= | Q1 |
| `packages/toc-parser/tsconfig.json` | `8f2a6f2f8b6a2df6405532ab03042219aefbed30` | package config/P1 | H68=; M07= | Q1 |
| `packages/xml-analysis/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | M07= | Q1 |
| `packages/xml-analysis/api-extractor.json` | `4ce1631ff05af31aea0ad26aec644c711eaf4319` | package config/P1 | M07= | Q1 |
| `packages/xml-analysis/etc/xml-analysis.api.md` | `6cb7760c6eeeaaf7a8a372248a98a5ad26624942` | API report/P2 | M07= | Q1 |
| `packages/xml-analysis/package.json` | `bb52bcaa75a07d269e82804616ea4604e36896d3` | package config/P1 | M07= | Q1 |
| `packages/xml-analysis/src/index.ts` | `030904e00031dd884a934761c009f4251bbc6082` | SDK source/P1 | M07= | Q1 |
| `packages/xml-analysis/tsconfig.json` | `0ca80809de6291db1a15eff8d4c4a4b7d736d6e5` | package config/P1 | M07= | Q1 |
| `packages/xml-parser/LICENSE` | `409c2d2099cc23990e7dee061de67b3cda9d9556` | license/P2 | M07= | Q1 |
| `packages/xml-parser/THIRD-PARTY-NOTICES.txt` | `8b6d3af17032529b32bf64a2a96c821ee8c2c0ce` | license/P2 | M07= | Q1 |
| `packages/xml-parser/api-extractor.json` | `fdbeb7c5f4dd980bc8ce05a7845d5287d445b066` | package config/P1 | M07= | Q1 |
| `packages/xml-parser/etc/xml-parser.api.md` | `0fcd7c7bd800d41b1cc4c96a0b32e8ad6802efc3` | API report/P2 | M07= | Q1 |
| `packages/xml-parser/package.json` | `319b3ec58c130d5d994aec8b6598073d0a7460ba` | package config/P1 | M07= | Q1 |
| `packages/xml-parser/src/index.ts` | `d3c261ded6aaad19a9de9c77ecb9c0ee25d9f328` | SDK source/P1 | M07= | Q1 |
| `packages/xml-parser/tsconfig.json` | `24cdd8ce38ece2fd445d4e09b3a7c275a57ba519` | package config/P1 | S16; M07= | Q1 |
| `scripts/Inspect-SelectedSourcePath.ps1` | `9a7922e6ad8edfae5624d65afb324ca1ec684841` | gate/writer/P2 | GN recorded | Q2 |
| `scripts/Test-WoWAddonCore.ps1` | `5ee57c86882f175a3b2013083e9057a3e68acf5e` | gate/writer/P2 | S07 | Q1 |
| `scripts/check-api-snapshots.mjs` | `26842d5afd9155c3d1ac2bef5c0514b61277717d` | gate/writer/P2 | S05; M07= | Q1 |
| `scripts/check-architecture.mjs` | `519485c03c332d1c082083a19ce4694f52405448` | gate/writer/P2 | S02; M07= | Q1 |
| `scripts/check-package-contents.mjs` | `215d9b2f651e906558b2f5b2f37d42b4bbe9d27d` | gate/writer/P2 | S04; M07= | Q1 |
| `scripts/check-public-exports.mjs` | `f38728a48bddb517ec86feced006fb82325f4447` | gate/writer/P2 | S03; M07= | Q1 |
| `scripts/create-toc-selection-probe.mjs` | `bb75689f3865623966370754f6800020a5f86771` | gate/writer/P2 | S08 | Q1 |
| `scripts/inspect-addon-corpus.mjs` | `c3812ea4fa1e21288a1dad05564073b0002e0aa5` | tooling/P1 | M07= | Q2 |
| `scripts/inspect-selected-addon-sources.mjs` | `52263e217836c861679ff8821194ddd6442d20d3` | tooling/P1 | GE recorded | Q2 |
| `scripts/lua-analysis-worker.mjs` | `8c4fa9a5b9eec98e9a03869c0a4c6b3b08a16576` | tooling/P1 | U | Q2 |
| `scripts/lua-corpus-worker.mjs` | `63aff3d83d8e6669f6e59c32eb5fcc203ab91bd6` | tooling/P1 | U | Q2 |
| `scripts/lua-parser-thread-client.mjs` | `1fadcdc74f7ffe691df320502925a081ed4aa3ff` | tooling/P1 | U | Q2 |
| `scripts/lua-parser-thread.mjs` | `5d65be4aaa66178c6e8869c5368cd115f6213d68` | tooling/P1 | U | Q2 |
| `scripts/lua-worker-client.mjs` | `510650e5d03ebe9ccd7ff19824e5e11f98c76ae0` | tooling/P1 | U | Q2 |
| `scripts/read-bounded-file.mjs` | `3be6c44c9f42db75d62306dca6d962843dfcd67e` | tooling/P1 | U | Q2 |
| `scripts/run-api-extractor.mjs` | `edda1102d363b40af92a9bce4619047c21116d15` | gate/writer/P2 | S06; M07= | Q1 |
| `scripts/run-tests.mjs` | `c9b5875bf05a9e98a4ba4df23eafdebb6c4bc03b` | gate/writer/P2 | S01 | Q1 |
| `scripts/selected-source-accounting.mjs` | `121a08b3b9f528d2389ea7b83a990399b38d513a` | tooling/P1 | GE recorded | Q2 |
| `scripts/selected-source-analysis-client.mjs` | `b589749356d4cd8b1263909923b136c9fdf80c99` | tooling/P1 | GA recorded | Q2 |
| `scripts/selected-source-analysis-worker.mjs` | `76cba005a3238e57b3bab508931284bb3f076555` | tooling/P1 | GA recorded | Q2 |
| `scripts/selected-source-analysis.mjs` | `31e3698617bc0891c89b300008acf959c2927c41` | tooling/P1 | GA recorded | Q2 |
| `scripts/selected-source-budget.mjs` | `a5f00aca27284858862ea6b7b63f9ba16b2fd3fb` | tooling/P1 | GC recorded | Q2 |
| `scripts/selected-source-context.mjs` | `5586fb894b03c13808bed95797ae2572b3b5d25b` | tooling/P1 | GI recorded | Q2 |
| `scripts/selected-source-engine.mjs` | `8915965d218d4d4bbfc214531147f718b44cf730` | tooling/P1 | GC recorded | Q2 |
| `scripts/selected-source-graph.mjs` | `045bc550109f2e400703395c513cd866ca1830d1` | tooling/P1 | GE recorded | Q2 |
| `scripts/selected-source-host.mjs` | `d256e55b7f8cb7c6b918b490833518bc70ef7fd6` | tooling/P1 | GE recorded | Q2 |
| `scripts/selected-source-native.mjs` | `45118e8e3a0c9855d48aad067199458fe7b62b0c` | tooling/P1 | GC recorded | Q2 |
| `scripts/selected-source-profile.mjs` | `c0477d3ec1d33526f3f268152a390cd6e87a9ba6` | tooling/P1 | GI recorded | Q2 |
| `scripts/selected-source-resolution.mjs` | `f9a3107c5f3e64b4270cd751152dce89261d0d35` | tooling/P1 | GE recorded | Q2 |
| `scripts/selected-source-selection.mjs` | `da856dba0c89cdd89b2e4b564995c6047cb7fe8c` | tooling/P1 | GI recorded | Q2 |
| `scripts/selected-source-syntax-validation.mjs` | `c6d145d92df5ffa1d094a69212b7a00b8d716e1f` | tooling/P1 | GA recorded | Q2 |
| `scripts/selected-source-windows.mjs` | `b2d7de6a95cf5d123278e73ef2d8fd92b4ae476b` | tooling/P1 | GN recorded | Q2 |
| `scripts/xml-analysis-worker.mjs` | `bdd6424f95a45a8e092958fa839a6ba915a78025` | tooling/P1 | M07= | Q2 |
| `scripts/xml-inline-lua-validation.mjs` | `ccb8dd900cdd33cde544546d06af123206aad67a` | tooling/P1 | U | Q2 |
| `scripts/xml-provider-validation.mjs` | `2fec1a2df801c66b5f72764e19574d197bedc860` | tooling/P1 | U | Q2 |
| `scripts/xml-worker-client.mjs` | `336e9927b8a8934810e1640ef5cb92931e8d992c` | tooling/P1 | M07= | Q2 |
| `tests/bounded-file-read.test.mjs` | `9263520d3c895cbd7013fbf7531de9446f75d3cd` | test/P2 | U | Q3 |
| `tests/contracts/lua-analysis.ts` | `9be16f177e7c46b8e59c436d07620bbb95c84a12` | type contract/P2 | U | Q3 |
| `tests/contracts/v030.ts` | `47d76858effb8cd50149e5d5ad4d854ff1d39d32` | type contract/P2 | U | Q3 |
| `tests/contracts/v031.ts` | `5e69960b2166622dcc9e4e939f748566b658c5f3` | type contract/P2 | U | Q3 |
| `tests/contracts/v032.ts` | `bd5d371b2e0e556956358bb42c0dd743ca19ec39` | type contract/P2 | U | Q3 |
| `tests/contracts/v033.ts` | `acfde7a1a06c22d7336007a988df3e9bd9d4ee4a` | type contract/P2 | U | Q3 |
| `tests/contracts/v034.ts` | `ac4fb34265edf40ea514dc0c37d1fabe0a727eea` | type contract/P2 | U | Q3 |
| `tests/contracts/xml-analysis.ts` | `3dc08bac40637ea7e59d6c675b16afd088e1cd32` | type contract/P2 | U | Q3 |
| `tests/contracts/xml-parser.ts` | `48429d88518eede6442701d0e61725df05b17ae4` | type contract/P2 | U | Q3 |
| `tests/contracts/xml-source-mapping.ts` | `f0ca10f03c36c8dd65ef1a2b54f7231fa716b521` | type contract/P2 | U | Q3 |
| `tests/core.test.mjs` | `190e61fe81cdf7ccecc4ea473209c65e525c827f` | test/P2 | H68= | Q3 |
| `tests/corpus-accounting.test.mjs` | `022cf5fd4fe783e1f8a32e6c92f2b8ef95535006` | test/P2 | U | Q3 |
| `tests/corpus-input-races.test.mjs` | `1b281cd373960898a109e56cca73c218117334c9` | test/P2 | M07= | Q3 |
| `tests/corpus.test.mjs` | `3ea816274eef9aab72d9e300a866670165d369e4` | test/P2 | U | Q3 |
| `tests/fixtures/README.md` | `cffac2b46618411f9759da9c40112bcb4a7683e1` | fixture/P2 | U | Q3 |
| `tests/fixtures/lua-xml-syntax.json` | `a242e2d3b7638c79892e1d648e40bf13a5f39df0` | fixture/P2 | U | Q3 |
| `tests/gate-hardening.test.mjs` | `d1d25196390b27c601c0616d1f7675c4ead9e474` | test/P2 | T2; M07= | Q3 |
| `tests/hardening.test.mjs` | `ed38f05dcd3b16e0c9a51f0b4f69f5017cb4212b` | test/P2 | T1; H68= | Q3 |
| `tests/lua-analysis.test.mjs` | `626404182309f8a4628a3206b93bbe64764c3c7f` | test/P2 | M07= | Q3 |
| `tests/lua-corpus-profile.test.mjs` | `1576171e90e68f0c9022453d9f50c4efdb9295b4` | test/P2 | M07= | Q3 |
| `tests/lua-entry-context.test.mjs` | `ddb621440ffc80a55098b66f9a1557780409d7fa` | test/P2 | M07= | Q3 |
| `tests/lua-worker.test.mjs` | `ad4fc068011d472fa5f6e91681ffb7bef597bb47` | test/P2 | U | Q3 |
| `tests/package-contents.test.mjs` | `420068a73e934835f1579c7071a4d7fa3331174c` | test/P2 | T3 | Q3 |
| `tests/review-regressions.test.mjs` | `f51ed01153ccea33795c5c576676bededda3987d` | test/P2 | T4 | Q3 |
| `tests/selected-source-accounting.test.mjs` | `3152c5757f66e344b1a660b45f8f69511783a030` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-analysis.test.mjs` | `f0cccc8787c3577f3f642d8bda8de12628bf1c8a` | test/P2 | GA recorded | Q3 |
| `tests/selected-source-cache-pressure.test.mjs` | `ee863f4bee3f32efe35e3b08f3e8e64be1dd4a92` | test/P2 | GC recorded | Q3 |
| `tests/selected-source-cli.test.mjs` | `666f32ecb8e9f732a83ead774d0df4a109a76ac7` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-context.test.mjs` | `b370f0b5b6fc53fe90e837a92848719d784ddae6` | test/P2 | GI recorded | Q3 |
| `tests/selected-source-engine-fixtures.mjs` | `4aa806e35a7af5c2d3f3e2c21cc3b8df1a4f813d` | fixture/P2 | GE recorded | Q3 |
| `tests/selected-source-engine.test.mjs` | `b792901a65ee709d9952c4dd1c9a0b2807a3ea3f` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-graph.test.mjs` | `4799d5880d5e770a1c8318abb8a6b68cb4a95fbb` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-host.test.mjs` | `4c9ec96bdaa39f1600b7a8eb4c86b1c4c07fd29a` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-native-retention.test.mjs` | `cde6307b1fbcc1e2d7eca57dcf0fea637fb1d196` | test/P2 | GC recorded | Q3 |
| `tests/selected-source-native.test.mjs` | `9c3877c759e1abeae579dc5a38803f8de86cb8c9` | test/P2 | GN recorded | Q3 |
| `tests/selected-source-profile.test.mjs` | `44e9edc3da8789a0e0ece7027bfe948a1fc754c4` | test/P2 | GI recorded | Q3 |
| `tests/selected-source-resolution.test.mjs` | `4b685087f80a23c4120b230a29f39f6ec020b1d1` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-retention.test.mjs` | `b0e5a685948749c08856b4b041b6b6fae2ffce14` | test/P2 | GE recorded | Q3 |
| `tests/selected-source-selection.test.mjs` | `fccb41dce839d6ffa227b1e7cc85892a17980d0d` | test/P2 | GI recorded | Q3 |
| `tests/selected-source-windows.test.mjs` | `4cfc1d62bb325f7f1d65cb8eb0fa52de573ad2e0` | test/P2 | GN recorded | Q3 |
| `tests/toc-corpus-fidelity.test.mjs` | `47c3681a68909b74e8f3bd4fc521230d0ecf39ca` | test/P2 | U | Q3 |
| `tests/toc-selection-probe.test.mjs` | `6e12b7fa7270df18fa6f821be98678170b3f9f03` | test/P2 | T5 | Q3 |
| `tests/v020.test.mjs` | `323c1d3e9929096a2a1680277a97c2b580635d8c` | test/P2 | H68= | Q3 |
| `tests/v030.test.mjs` | `e442a64f7a0f358f2d4de867dd0a62b63327e40c` | test/P2 | U | Q3 |
| `tests/v031.test.mjs` | `f7cd510c03055a1a54dceaf113aebd03208a853d` | test/P2 | U | Q3 |
| `tests/v032.test.mjs` | `c609230c72924feac8a1ecbe7333793ead57e4aa` | test/P2 | U | Q3 |
| `tests/v033.test.mjs` | `ff269c91df898371db88901f81df1596c7a24c64` | test/P2 | U | Q3 |
| `tests/v034.test.mjs` | `bb5ed7174fc320b0a93dc834ff4d8fe914657eb2` | test/P2 | U | Q3 |
| `tests/xml-analysis-backend.test.mjs` | `ee5992328dda663c67e5c8bf78b237ee87d1525e` | test/P2 | M07= | Q3 |
| `tests/xml-analysis.test.mjs` | `847f9c7ecde10e286784c90f526764e6ec5393d9` | test/P2 | M07= | Q3 |
| `tests/xml-corpus.test.mjs` | `4b9d402f1b6deea4c59924fa9ecca6607cbdb27e` | test/P2 | U | Q3 |
| `tests/xml-inline-lua-corpus.test.mjs` | `5d0a428ea3e8a6e106af256a0e0c8e73a853f890` | test/P2 | M07= | Q3 |
| `tests/xml-inline-lua-validation.test.mjs` | `57d62f276f8709903c1a3f1eb5c68f117706c784` | test/P2 | M07= | Q3 |
| `tests/xml-inline-lua-worker.test.mjs` | `fef501525b98dc9d7eda3450dbbe03fe09f92ad3` | test/P2 | M07= | Q3 |
| `tests/xml-parser.test.mjs` | `92bd3dc4c52f795cc1816864cb33dc5b431872d4` | test/P2 | U | Q3 |
| `tests/xml-provider-corpus.test.mjs` | `58a0d1e31019a181c72c00f8b269674ab14f2209` | test/P2 | U | Q3 |
| `tests/xml-source-mapping.test.mjs` | `3afea7ff699c2531298ed300de2133459fd27b6e` | test/P2 | M07= | Q3 |
| `tests/xml-worker.test.mjs` | `8c5549a774540134c9af6da5383c31a25aa13260` | test/P2 | U | Q3 |
| `tsconfig.json` | `98f57d02ae5994b1f57e650e7b5b065799a8cc74` | root config/P1 | S14 | Q1 |

## Inventory/hash verification recipe

Run this read-only PowerShell check from the repository root. It validates only this index, not product behavior. The commit is pinned so adding this index does not change its 235-row denominator.

```powershell
$coverageCommit = 'e0fd1a1e5e128a14f714cbe8fa72355dd93647db'
$coverageOld = 'eac072fa33c09715356d0b05aefd26580138a9f4'
$coverageInline = '07b79a88150804be87b3d9c041bc7f2ff23e531f'
$coverageTrees = @{}
foreach ($coveragePin in @($coverageCommit, $coverageOld, $coverageInline)) {
    $coverageMap = @{}
    git ls-tree -r $coveragePin | ForEach-Object {
        if ($_ -notmatch '^100644 blob ([0-9a-f]{40})\t(.+)$') { throw 'Unexpected inventory mode or entry' }
        $coverageMap[$Matches[2]] = $Matches[1]
    }
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read pinned tree' }
    $coverageTrees[$coveragePin] = $coverageMap
}
$coverageTree = $coverageTrees[$coverageCommit]
$coverageRows = @(Get-Content -LiteralPath 'docs/REVIEW-COVERAGE-2026-11-18.md' | ForEach-Object {
    if ($_ -match '^\| `([^`]+)` \| `([0-9a-f]{40})` \| ([^|]+) \| ([^|]+) \| (Q[1-4]) \|$') {
        [pscustomobject]@{ Path=$Matches[1]; Blob=$Matches[2]; Evidence=$Matches[4]; Queue=$Matches[5] }
    }
})
if ($coverageTree.Count -ne 235 -or $coverageRows.Count -ne 235) { throw 'Inventory count mismatch' }
if (@($coverageRows.Path | Sort-Object -Unique).Count -ne 235) { throw 'Duplicate matrix path' }
foreach ($coverageRow in $coverageRows) {
    if (-not $coverageTree.ContainsKey($coverageRow.Path) -or $coverageTree[$coverageRow.Path] -cne $coverageRow.Blob) { throw ('Path/blob mismatch: ' + $coverageRow.Path) }
    foreach ($coverageCarry in @(@('H68=', $coverageOld), @('M07=', $coverageInline))) {
        if ($coverageRow.Evidence.Contains($coverageCarry[0])) {
            $coverageHistorical = $coverageTrees[$coverageCarry[1]][$coverageRow.Path]
            if ($coverageHistorical -cne $coverageRow.Blob) { throw ('Invalid historical carry: ' + $coverageRow.Path) }
        }
    }
}
$coverageExpected = @{ Q1=75; Q2=30; Q3=69; Q4=61 }
foreach ($coverageQueue in $coverageExpected.Keys) {
    if (@($coverageRows | Where-Object Queue -eq $coverageQueue).Count -ne $coverageExpected[$coverageQueue]) { throw 'Queue count mismatch' }
}
if (@($coverageRows | Where-Object Evidence -match 'H68=').Count -ne 31 -or
    @($coverageRows | Where-Object Evidence -match 'M07=').Count -ne 87) { throw 'Historical tag count mismatch' }
[pscustomobject]@{ Rows=$coverageRows.Count; OriginalTree=$coverageTrees[$coverageOld].Count;
    InlineTree=$coverageTrees[$coverageInline].Count; Q1=75; Q2=30; Q3=69; Q4=61; H68=31; M07=87 } | ConvertTo-Json -Compress
# Expected Rows235, OriginalTree68, InlineTree187 and the counts above.
# Equality alone does not prove review.
```

Author self-check: parsed the emitted matrix back against all pinned tree entries; checked unique paths, all 235 blob IDs, queue totals, both historical equalities and stated evidence-tag/disjoint counts. Parent independently repeated the three-tree/path/blob/history/queue reconciliation successfully. The index itself has not run repository code or inherited live-run success.

## Additional parallel reviews of the pinned source

These supplemental scopes do not change the original S/T/H/M/G/U accounting or convert a row to comprehensively audited. Their source identities are the matching rows above at e0fd1a1. Later fixes have their own regressions and need new-head gates; findings in an old source remain attributed to that source.

- **Package/contract review:** full reads of all eight package manifests/tsconfigs/Extractor configs, all eight declaration baselines and API reports; root package.json/tsconfig/DAG/CI; five architecture/API/export/package/Extractor gate scripts; API-POLICY, PUBLIC-SURFACE, LICENSING-AND-THIRD-PARTY and XML notices; addon-metadata, diagnostics and global-registry root source modules. No actionable current boundary/contract defect established. Approved acyclic edges, exact0.7.0internal pins,78beta exports, root-only targets and backend pins agree. Lockfile inspection covers root/workspaces/links/three backend records only; changelog inspection covers current0.7.0section only. Installed backend manifest/runtime/license hash inspection is not substantive third-party code review or actual loader execution. Full lock semantics and remaining source modules stay queued.
- **Worker/lifecycle review:** standalone Lua/XML clients/workers, Lua corpus/parser-thread client/thread, bounded reader, graph analyzer client/worker/host, Windows inspector/fixed helper; targeted corpus CLI, graph engine/native/analysis and adjacent worker/reader/race/Windows tests. One reproduced graph close/reap deadline gap: acknowledgement exactly at/after deadline can beat its overdue timer. Standalone close behavior and native/installed operation are not certified by this static pass.
- **Projection review:** complete selected-source-analysis, xml-provider-validation and xml-inline-lua-validation scripts and Lua API source; targeted XML provider/map implementation and adjacent authored tests. One reproduced direct Lua addonId getter reread gap; no further actionable binding/range/mapping/cardinality finding established in that scope. Exhaustive Lua lexical completeness, whole XML parser implementation, lifecycle/native and installed behavior remain distinct work.

The [correction record](REVIEW-SELECTED-SOURCE-CORPUS.md#parallel-review-corrections-after-the-recorded-run) binds both findings and the independently reproduced native/cache seam to exact files, negative/ordinary controls and measured outcomes. Reviews did not run installed sources or grant new contract/release rights. No summed reviewer count substitutes for this file-by-file queue.

Further disjoint source/control lenses at the same pinned source:

- **Five core implementations:** complete addon-metadata, diagnostics, global-registry, toc-metadata-adapter and toc-parser root TypeScript sources; targeted v020/v031–v034/core/TOC-fidelity controls and design records. No actionable current defect established. Duplicates, original source/order, exact variant association, copied selected projections, conservative unknown/invalid states and numeric/source validation were reviewed. Legacy registry/source reference retention and caller-owned native getter behavior are explicitly intentional contracts; the Lua requester correction does not silently change these older APIs. Nonempty TOC-heading policy stays in issue10. Supporting tests were sampled, not exhaustively reviewed or executed.
- **XML syntax implementation:** complete packages/xml-parser/src/index.ts, tests/xml-parser.test.mjs, tests/contracts/xml-parser.ts and tests/xml-corpus.test.mjs; XML catalog/provenance vectors and targeted syntax/migration contract sections. No actionable finding established in UTF16/entity/CRLF/BOM mappings, owned namespace projection, exact caps or no-prefix failure. Partial local saxes entity/position source inspection confirms the pinned artifact hash; it is not a full dependency audit. Lua catalog vectors and XML provider/worker implementation remain separate scopes.
- **Q3 inclusion/safety batch:** all nine type contracts, engine fixture helper, both fixture catalog files, ten declarative examples, and complete bounded-file-read/core/corpus-input-races/lua-corpus-profile/lua-entry-context/TOC-fidelity/v020 runnable tests:29full Q3 paths. Nine additional runnable callers were inspected only for compiler/catalog inclusion. All46tracked runnable files at e0fd1a1 match normal runner discovery; all nine contracts have explicit no-emit compiler callers. An assert identifier in every runnable file is inventory evidence only. Fully reviewed mutations remain in authored temporary roots; no live AddOn write target was found. These lexical cleanup controls do not establish an adversarially immutable temporary root. Intentional synthetic TOC incompleteness is not a product defect.

The inclusion batch alone leaves40of69Q3paths for complete review; the XML lens above separately supplies full xml-parser/xml-corpus tests, reducing that combined remaining set to38. No test execution or new live acceptance comes from these static counts. Contract mutation, catalog-ID uniqueness and cleanup sentinel scenarios are optional proposed controls, not reproduced current defects. Remaining Q1/Q2/Q4 queues and newly added files require their own follow-up; this index remains an attributed plan, not closure of the overall audit.

## Follow-up review at 9180a62

- **Selected-source and corpus tests.** Full static review covered the accounting, analysis, CLI, context, engine, graph, host, native, native retention, profile, resolution, selection and Windows tests, plus corpus and corpus accounting. The cache eviction assertion reproduced a fixture that fit entirely in its configured budget. The revised test demonstrates a reread and unchanged parser invocation count. The CLI test timeout can trigger temporary fixture cleanup before its child closes. Review that close path separately with a test-owned fake child.
- **Lua and XML tests.** Full static review covered Lua analysis and worker tests, XML analysis/backend/source mapping and worker tests, inline Lua worker/validation/corpus and provider corpus tests. Follow up on two specific assertions: observe attempted opens in the provider inventory test with an authored canary, and capture Lua backend defaults before the first SDK import and call. These are test coverage findings.
- **Current documentation.** Two passes inspected 27 tracked status and contract documents. The README, roadmap and architecture now point to the implemented reference graph and separate installed acceptance evidence. The plan retains the historical approval and verification records. Further passes should keep the older milestone wording explicitly dated.

These scoped reviews leave the original index attribution intact. Newly introduced and changed files require evidence tied to their own commits.
