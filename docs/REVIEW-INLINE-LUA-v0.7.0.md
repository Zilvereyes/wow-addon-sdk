# Inline Lua implementation acceptance — 2026-11-17

Target: approved [A–E](PROPOSAL-INLINE-LUA.md), [user decision](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6952532068), stacked [PR #29](https://github.com/Zilvereyes/wow-addon-sdk/pull/29). Source baseline d760358191c82940eaba59d21ea6698815761ec5; implementation is the subsequent PR commit, not the earlier proposal-only CI. PR #28 remains independently frozen at 580ed8b and unmerged. No merge/tag/publication is authorized by this record.

## Deliverable and contracts

- A: `LuaAnalysisContext` and optional context, explicit lexical parameters/varargs, unchanged default chunks and unknown function-body globals. Files: Lua index/syntax, declaration baseline/report and context/ownership/type regressions.
- B: `mapXmlValueRanges` and three sidecar types in XML-analysis only. Validate owned bounded inputs, preserve disjoint/comment gaps, duplicate queries, entities, normalized values, exact paths and UTF-16 exclusive ends. Core declaration source stays decoded. Files: XML index, declaration baseline/report, mapper/backend/contract regressions.
- C: opt-in context profile, supervised XML-worker composition, independently verified sidecars, atomic per-file accounting and bounded source reads. Files: corpus inspector, XML worker/client, inline validation helper, authored profile/example, worker/corpus/corruption/race regressions.
- D/E: all eight manifests/internal ranges advance to 0.7.0; five additive beta exports give 78 = 16 runtime + 62 types. Preserve 73 prior exports, five core boundaries, backend pins, 84 external lock records and payload contracts. Update gates, reports, migration, diagnostics and examples; inspect supported exact-head CI before acceptance.

## Reproductions and focused verification

Parent-executed on Windows Node26.13.1, original d760358 plus the reviewed implementation working tree. Red results precede fixes; no installed input was used. Logs remain private scratch artifacts; commands and outcomes are public evidence.

| Requirement / reproduced deficiency | Executed evidence | Result |
| --- | --- | --- |
| Context semantics, owned conditions, old defaults, mapper and XML provider boundaries | `node --test tests/lua-entry-context.test.mjs tests/lua-analysis.test.mjs tests/lua-corpus-profile.test.mjs tests/xml-source-mapping.test.mjs tests/xml-analysis.test.mjs tests/xml-analysis-backend.test.mjs` | Exit0, 101 pass. Baseline context: 1 pass / 11 fail; mapper/provider: 18 pass / 15 fail. |
| Manifest/backend/strict Extractor fail-closed gates | `node --test tests/gate-hardening.test.mjs` | Exit0, eight groups. Baseline positive control passed and five negative groups failed. |
| Worker composition, profile/default envelope, accounting and bounded reader races | `node --test tests/corpus-input-races.test.mjs tests/xml-inline-lua-corpus.test.mjs tests/xml-inline-lua-worker.test.mjs` | Exit0, 15 pass / two Linux-only FIFO skips. Baseline composition three failures; reader races two failures plus two Windows skips. |
| Independent rejection of coherent relocated declarations and unexpected diagnostic messages; exact inline record cap | `node --test tests/xml-inline-lua-validation.test.mjs` | Exit0, five pass. Four controlled negative cases failed before correction. Actual SDK composition accepts exactly 50,000 inline records and rejects one over atomically. |
| Reviewed API generation | `npm run api:extractor:local` | Exit0, eight packages; only Lua/XML-analysis reports changed. This generation is not strict acceptance. |
| Runnable authored example | `node scripts/inspect-addon-corpus.mjs examples/xml-inline-lua --xml-analysis --xml-provider-profile examples/xml-provider-profile.json --xml-inline-lua-profile examples/xml-inline-lua-profile.json` | Exit0: two bodies attempted/accepted/lexically complete, two declarations, two mapped queries/three original parts, zero missing contexts/technical failures, one matching XML integrity check. FullParsing=false and no selected-provider participation. |

Local Node26 is supplemental evidence. Supported acceptance requires Windows/Ubuntu × Node22/24 on the exact new PR head; old d760358/580ed8b CI does not cover these changes. Integrated gate and CI identities are appended to this record/PR once observed.

Final integrated working-tree acceptance on this implementation (before its commit): `npm run check:all`, host session51738, exit0, **407 tests / 404 pass / zero failures / three Linux-only FIFO skips**. Build, eight-package architecture, dependency-cruiser (28 modules/33 edges), declaration baselines (78 beta:16 runtime/62 types), exports and backend/license checks pass. `npm run api:extractor`, session10073, exit0 for all eight canonical reports. `npm run check:packages`, session44389, exit0 with five four-file core payloads, six-file Lua, five-file XML syntax and four-file XML provider, all including LICENSE. CI results must still be bound to the final new head rather than inferred from this local run.

## Project-file review and fixes

Read-only passes covered all five core source trees and their contract/version regressions, Lua/XML parser/provider source and fixtures, manifests/project references/Extractor configs/baselines/reports, gates/CI/licenses/notices and examples/normative/status documentation. Parent reviewed integrated changes and ran the focused reproductions. Generated artifacts are compared mechanically; review is not a guarantee that every possible issue is absent.

Confirmed fixes: numeric own-cell Lua condition copying prevents iterator-injected caller objects; XML option arrays reserve aggregate budget before cell getters; prefixed names with null namespace fail closed; Lua/XML descriptors detect replacement races; independently mapped inline declarations must spell their name in decoded source and diagnostics must use fixed messages. Gate reproductions reject alternative dependency fields, redirected backend entries and disabled/redirected/noncanonical Extractor reports before execution.

Mapping retains existing CRLF endpoint canonicalization. Separate raw contributions survive even where a decoded CRLF boundary collapses. The new inline 50,000-record budget covers analyses/sidecars including copied condition value cells; existing provider value mappings are separately budgeted provider records. Exact/over-cap regression exercises the actual new inline output.

## Remaining acceptance and next dependency

At this implementation checkpoint no installed inline-context run had been performed. Subsequent [actual partial-context characterization on ab36b28](REVIEW-INLINE-LUA-CORPUS.md) supersedes that not-run boundary: 654 bodies actually analyzed/mapped, 685 missing contexts, all 6,875 standalone inputs parsed and unchanged, exit1/incomplete. It does not complete handler/loader acceptance. Earlier provider inventory at 580ed8b extracted 37 chunks/1,302 handlers but parsed none as Lua. Context preparation remains the assistant's technical work; the user need not author JSON.

Selected-source reference traversal, remaining handler/animation/font/binding domains, provider participation in selected-TOC resolution, and diagnostic acceptance remain open in [issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11). The broader v0.3.5/parsing goal is incomplete. Installed sources remain read-only and private; CI uses authored fixtures. Optional unavailable plugin scans are not claimed as passed project gates.
