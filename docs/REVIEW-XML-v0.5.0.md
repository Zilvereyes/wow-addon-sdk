# XML syntax and provenance acceptance: 2026-11-17

The user approved [XML A–F](PROPOSAL-XML-SYNTAX.md) in the active chat ("Godkendt"); [issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6947486320) records the decision. Source milestone 0.5.0 implements that syntax/provenance increment, with seven packages and 65 beta exports. The five core boundaries, all 56 earlier exports, six existing declaration baselines/API reports and all 82 unrelated external lock records are unchanged. Merge, tags and npm publication require separate authorization.

## Deliverable and evidence

| Requirement | Changed surface / dependency | Fresh evidence and result |
| --- | --- | --- |
| Nine approved readonly contracts | `packages/xml-parser`, XML baseline/report; diagnostics plus exact saxes 6.0.0/xmlchars 2.2.0 | Public type fixture and all 27 authored XML catalog vectors; existing contracts unchanged |
| XML grammar/profile, original provenance | `packages/xml-parser/src/index.ts`, `tests/xml-parser.test.mjs` | 45 tests pass, including three golden spans, namespaces, mixed endings/BOM/astral entities, independent decoded maps, ownership, DTD/version failure and exact input/depth/record boundaries |
| Fixed supervised process | XML worker/client and `tests/xml-worker.test.mjs` | 12 tests pass: actual SDK reuse, fixed executable/heap/environment/no shell, deadline/crash/framing/output failure, concurrent-call rejection and deterministic close/reap/replacement |
| Read-only opt-in corpus adapter | corpus runner and `tests/xml-corpus.test.mjs` | Twelve synthetic CLI tests pass; failed syntax/profile verdicts remain distinct from blocked work; byte/unit/codec/resource limits and source integrity are exercised |
| Existing behavior and package boundaries | gate scripts, manifests/references and regression suites | `npm run check:all` exits 0: 296 tests, build, seven-package architecture, dependency cruise (25 modules/25 edges), API baselines and exports/hashes/licenses |
| Reviewed API and actual payload | seven Extractor configs/reports; package gate | Strict `npm run api:extractor` exits 0 for all seven; `npm run check:packages` exits 0: five four-file core payloads, six-file Lua payload and five-file XML payload including original notices |
| Supported platforms | existing Windows/Ubuntu × Node 22/24 workflow | [PR #25 run 44082011246](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44082011246) passes 4/4 jobs on implementation commit `9ddc560d5e53896518e4ae69c8372156deb445ab`; each job logs 289 tests/zero failures plus all gates. Final-head evidence, including later documentation-only commits and review, is maintained on the PR |

These parent-owned host runs used Windows, Node 26.13.1 and npm 12.2.0. Final local `check:all` host session 12472, strict API/package session 60818 and XML corpus session 99312 reached terminal results; no duplicate pending execution was started. The checked snapshot is the source/tests delivered by this change. Original local source SHA-256: parser `89dcf495048d866f50cb62c505ce2d2c28e34141c6dfd32a6ca00e2c43df88d9`; corpus runner `daf45eb60fa3015beac71f88f6f5126100bf486fd70a78975d66af8629d0a475`. Git checkout line-ending conversion can change byte hashes without changing the reviewed source; supported CI uses the committed snapshot.

Earlier red checks are retained as development evidence: missing `parseXml`; inherited option consumption and a getter reached before oversized-input rejection; a wrongly named worker import; missing Extractor report directory; and JavaScript whitespace rejecting valid U+1680/U+FEFF XML names. Each was corrected and the affected tests rerun. No failing check was relabeled as success. The 2 Mi decoded guard is defensive: the approved <=1 Mi raw input/predefined-or-numeric-only profile cannot reach it; no fabricated boundary test is claimed.

## Actual installed corpus: aggregate results

Command: `node scripts/inspect-addon-corpus.mjs <explicit-local-AddOns> --xml-analysis --require-all-parsers`, exit **1**, status **failed**, `fullParsing=false`. This is the actual SDK, not candidate characterization or file inventory. Lua was deliberately disabled in this XML-focused run; its earlier acceptance evidence remains separately dated.

| XML measurement | Result |
| --- | ---: |
| Found / attempted / submitted / completed / syntax verdicts | 1,199 each |
| Input bytes | 1,541,465 |
| Accepted / rejected | 1,146 / 53 |
| Diagnostics | XML0002: 53 |
| Encoding / resource / read / worker / backend / invariant failures | 0 each |
| Skipped links / oversized XML inputs | 0 / 0 |
| Checked source references / decoded mappings | 281,315 / 85,212 |
| Before/after source hashes checked / matching / changed | 1,199 / 1,199 / 0 |

A separate private classification pass called the same SDK with namespace checks explicitly disabled only for the rejected files. All 52 namespace-only cases then passed; one multiple-root document still failed. Private backend classification confirmed the latter reason. All 1,199 hashes matched again; zero unclassified failures, exit 0. This diagnosis does not silently change the corpus CLI's namespace-aware profile, establish game-loader behavior or waive failures. Existing independently authored unbound-prefix/multiple-root catalog cases cover both mechanisms. No installed snippets, names, paths, source hashes or full diagnostics are published.

The run also parsed all 434 TOCs and retained TOC0001:19 errors / TOC0004:12 warnings; Lua found 5,242, parsed zero in this run. Missing XML provider/loader-reference graph and disabled Lua are explicit failure reasons. The earlier full Lua-profile results are not attributed to this new XML run.

## Review and remaining steps

Manual independent security/architecture review found the XML-name issue above, now reproduced and fixed. No confirmed exploitable finding was identified in the reviewed parser/worker paths. This is a bounded manual review, not a completed formal Codex Security scan or vulnerability-database clearance. Source XML cannot choose an executable, heap, resolver or referenced file. Reads use O_RDONLY, bounded buffers and pre/post file checks; the tooling is not a sandbox against concurrent ancestor-junction replacement.

PowerShell scripts were unchanged. PowerShell Workbench XML documentation was consulted; no Workbench TypeScript native-parser gate is claimed (that adapter is unavailable). MegaLinter was not run: no existing project setup/runtime was available, and no system software was installed merely to invoke it. Optional plugin availability does not replace the actual project checks.

1. Require exact final-head supported CI and independent PR review; investigate and fix concrete findings, then rerun affected gates.
2. Present the reviewed PR for the separate merge decision. Do not tag or publish.
3. Prepare the next material design decision for XML frame/template/Script/Include projection and inline Lua using these maps. Specify public API, unresolved `$parent`/virtual/inherited names, namespace policy, compatibility and authored tests before implementation.
4. Design the opt-in filesystem adapter/selected-TOC graph separately: separators/case, variables, missing files, root escape, cycles, deterministic ordering and bounded read-only traversal.
5. Compose provider records with the existing neutral registry/environment contracts, then rerun all three parsers/providers on selected reachable sources. Retain incomplete/failed status for dynamic Lua, unresolved TOC semantics, namespace failures or missing evidence. Issue #11 and the overall goal remain open.

## Review corrections and broader project audit

Copilot review 5938320117 on implementation commit 9ddc560 identified [unterminated reference misclassification](https://github.com/Zilvereyes/wow-addon-sdk/pull/25#discussion_r4599504638). Parent-owned parser/CLI regressions first exited 1: XML0005/backend-block accounting was observed instead of XML0002/syntax rejection. The mapping guard now reports XML0002 for unfinished references at markup or EOF, including a semicolon appearing only in later markup. Both regressions then passed; full check:all passed 293 tests. The actual 1,199-file XML corpus was rerun after the fix: its entire aggregate JSON was identical, including all hashes unchanged, zero blocked/invariant failures and the honest failed exit 1. The earlier private classification is evidence from the original implementation snapshot; no installed source was republished.

Independent broader static review read all 1,324 lines of the five core src/index.ts files, approved selection/evaluation/resolution designs, existing Lua source, all scripts/*.mjs, the sole PowerShell wrapper and CI configuration. No new core semantic defect or AddOns write path was identified. Two gate defects were reproduced with isolated synthetic workspaces: stale internal versions and an extra browser condition redirecting the Lua root export to its private syntax module were accepted. New negative regressions first failed, then passed after requiring exact shared workspace/internal versions and exactly types/default root export keys. The focused gate suite passed 22 tests.

This was a bounded source review, not proof of every project behavior or client-loader conformance. Existing TOC/Lua per-file failure telemetry and the TOC stat/read allocation race remain explicitly open in [issue #26](https://github.com/Zilvereyes/wow-addon-sdk/issues/26), with concrete source explanations and required authored failure tests. The new XML counters do not establish that older-language telemetry is complete.
Copilot follow-up 5938401354 identified a separate discovery-completeness gap: truncated or profile-blocked enumeration could leave XML complete=true with no attempted files. New authored entry/depth/link/root/profile regressions first failed on the old report. The runner now tracks discovery independently, exposes discoveryComplete and requires it for XML completeness. Three additional regression groups pass, including controls proving TOC-only syntax/size failures do not falsely invalidate fully discovered XML. Independent static review found no missing reset/failure path. The actual installed corpus was rerun again: discoveryComplete=true; every earlier counter/integrity result is identical after excluding this additive field; exit 1 remains failed. Final local check:all passes 296 tests. Strict API/package results above cover unchanged SDK/package bytes; exact final-head CI runs all gates again.