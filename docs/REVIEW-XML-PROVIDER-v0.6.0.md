# XML provider acceptance: 2026-11-17

The user explicitly approved [provider A–D](PROPOSAL-XML-PROVIDER.md): optional xml-analysis, eight beta exports, exact caller vocabulary, unknown frame candidates, unresolved references and mapped inline bodies. Implementation proceeds in [PR #28](https://github.com/Zilvereyes/wow-addon-sdk/pull/28). This document records executed local evidence; the PR records the exact pushed head and its final supported CI/review. Merge, tag and publication are separate authorizations.

## Delivered contract and affected surfaces

| Requirement | Delivery and acceptance |
| --- | --- |
| Optional pure semantic leaf | packages/xml-analysis imports only xml-parser/diagnostics/global-registry; original five core edges and all seven earlier APIs/reports stay unchanged. No new external package; all 84 existing external lock records compare equal after locked regeneration/install. |
| Eight approved beta exports | Seven readonly interfaces and analyzeXml; shared source0.6.0, 73 beta root exports (15 runtime / 58 type-only). New reviewed declaration baseline/report; AST export counts and beta tags are enforced alongside exact baselines. |
| Explicit caller vocabulary | Exact namespace/local name matching, disjoint six-role policy, direct-root references and structural handlers; unqualified attribute roles only. No game schema or fallback is inferred. |
| Conservative facts | Duplicate/string-key names retained; every emitted declaration has unknown activation. Virtual, inherits and `$parent` remain unresolved. Real XML/TOC/Lua synthetic composition excludes nonselected associations and does not activate selected unknown candidates. |
| Original mapped bodies | Direct-child text/CDATA join without invented whitespace; comments/PIs and raw gaps retain disjoint maps. Independent golden offsets, CR/LF/CRLF, BOM, astral entities, exact paths and empty/self-closing bodies are tested. No inline Lua syntax/execution is claimed. |
| Bounded owned projections | Numeric own-cell option snapshots ignore caller iterators; getters/extra fields never become hidden policy. Options/string/value-cell/output caps are tested, including empty strings. Conditions/maps/positions/sources are independently copied. |
| Fail-closed errors | Invalid options, malformed syntax projections and resources discard facts. Syntax errors retain XML codes. XUI0004 retains independent facts with incomplete status; warning sources must cover each ambiguous construct. Backend parent/source/value inconsistencies cannot manufacture facts. |
| Opt-in supervised corpus path | Explicit bounded schema1 policy profile; fixed worker executable/no shell/256MiB/10sec/32MiB preset; parser-only behavior retained. Correlation/envelope failures, crashes, deadlines, output limits and cleanup are exercised. |
| Honest metrics and integrity | Separate syntax/provider counters and disjoint per-file dispositions. Whole-result/map/warning validation plus matching source-integrity reread precedes provider credit. Late invalid XML syntax maps/diagnostics also receive no prefix metrics. |
| Distribution | Four-file new payload (package.json, LICENSE, dist/index.js/index.d.ts); exact eight-package payload checks and preserved license/backend hashes. No source, fixtures, backend archives or game assets enter packages. |

## Parent-executed local evidence

Runtime: Windows, Node 26.13.1 / npm 12.2.0. Supported Node22/24 runtime evidence is tracked separately in exact-head CI. Host sessions are actual finite process references, not detached CPJ job IDs.

| Command / session | Actual result |
| --- | --- |
| node --test tests/xml-analysis.test.mjs before implementation | exit1, approved analyzeXml export absent; intended red baseline |
| npm install --package-lock-only --ignore-scripts --no-audit --no-fund; npm ci --ignore-scripts --no-audit --no-fund; npm run build — 10582 | exit0; 84 prior external lock records unchanged |
| node --test tests/xml-analysis.test.mjs tests/xml-analysis-backend.test.mjs | exit0 / 18 initial groups, before added review regressions |
| SDK/backend/provider/worker focused run — 20047 | exit0 / 43 groups; valid original maps, malformed seams and worker/corpus failures |
| warning-source regression against previous validator | exit1; invalid projections wrongly retained ordinary failed status/credit instead of invariant-blocked incomplete; corrected targeted run exit0 / two groups |
| late invalid XML diagnostic/map regressions | exit1 / two intended failures (XML0002 prefix histogram1 and mapping prefix2); corrected targeted run exit0 / two groups |
| final npm run check:all — 89235 | **exit0 / 350 total, 349 pass, zero fail, one Linux-only FIFO skip**, plus build, eight-package architecture, dependency audit (28 modules/33 edges), baselines/beta surface and exports/hash/license checks |
| npm run api:extractor; npm run check:packages — 25001 | **exit0**, strict eight-package reports and exact actual payloads |
| authored CLI example | **exit0**, one TOC verdict / one XML verdict / zero Lua verdicts; one frame/declaration/reference/chunk/handler, zero provider blocks/diagnostics, integrity checked1/matching1. fullParsing=false. |

The first local API report generation failed because the new etc directory did not exist; creating the intended directory and regenerating produced the report, then strict extraction passed. That failed attempt is not acceptance evidence. The first filtered warning test command matched no named case; only the corrected filter's actual red/green result is counted above.

Final tested working-copy SHA-256 identities (line-ending conversion can change bytes; GitHub CI binds the committed tree):

- packages/xml-analysis/src/index.ts: `2957c73449218d71efa4585057a74e5d4344f81f8382da7e56c06cc455b8dc8a`
- scripts/inspect-addon-corpus.mjs: `cf29e03509235ff6a8eb704543cd398b90f12491c344cfe41ba9b99f2da3c140`
- scripts/xml-provider-validation.mjs: `d465ad9552e633117fa507683d4fcc7cbeac93904872f80635e8605a4b544393`

## Review findings and corrections

Independent read-only source reviews found caller-defined array iterators overriding numeric cells, position spreads copying extra backend fields, and incomplete immediate-parent validation. Parent-owned iterator/backend regressions failed against the previous build; numeric snapshots, explicit position copies and ancestry/text checks corrected them. The final suite exercises all fixes, output independence and valid-call recovery.

The corpus review found warning checks could accept a dropped/moved diagnostic when several elements were ambiguous. Exact expected/received source sets now validate each construct. Root review also found pre-existing XML syntax validation incremented source/map/diagnostic metrics before the final invalid item; transactional local metrics now prevent that prefix credit. Authored isolated wrappers demonstrated both defects, with no SDK installation/package junction or game-source modification.

These reviews are bounded static analysis plus the explicitly executed tests, not a claim of comprehensive vulnerability-database clearance or game-loader conformance. Optional PowerShell Workbench native checks and MegaLinter were not run: no PowerShell source changed, and no existing MegaLinter setup/runtime was available. No system software was installed merely to invoke another tool.

## Actual corpus and next acceptance

**The installed XML provider run is not run in this increment.** The user chose synthetic tests/CI while a local policy is prepared, then clarified that technical profile preparation belongs to the assistant using the already authorized read-only AddOns directory. No user-authored JSON is needed. [Plain-language guidance and a runnable authored example](XML-PROVIDER-PROFILES.md) make the distinction concrete.

The [older combined installed syntax evidence](evidence/corpus-accounting-2026-11-17.json) remains attributed to implementation947e559: 434 TOC / 5,242 Lua / 1,199 XML verdicts, known syntax/TOC/dynamic findings and failed fullParsing=false. It is not relabelled as new provider acceptance. No third-party source, private path, individual installed hash or full local diagnostic is uploaded.

After exact-head supported CI/review and separately authorized integration, prepare a narrow documented local vocabulary from read-only observed XML names/namespaces, then execute an explicitly selected policy and retain aggregate per-file verdict/block/skip/diagnostic/invariant/integrity evidence. Observation of a name is not proof of loader behavior. Handler-aware Lua and selected-source filesystem traversal remain separate later contracts under #11; the overall goal is open.
