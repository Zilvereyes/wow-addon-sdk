# Actual inline Lua corpus characterization — 2026-11-17

This is **partial-context inventory evidence**, not complete Classic Era handler or loader acceptance. Source implementation: `ab36b2809824400429479f71244d7354a47b8c82`, [PR #29](https://github.com/Zilvereyes/wow-addon-sdk/pull/29). The approved read-only local AddOns directory is retained privately. No input code is executed, followed or modified. [Public-safe aggregate](evidence/inline-lua-corpus-2026-11-17.json) contains counts and fixed codes only, without installed names, paths, namespace identities, bodies, individual hashes or complete diagnostics.

## Explicit context selection and evidence

The existing private provider vocabulary is unchanged. The assistant prepared and explicitly selected a separate partial context profile; no user-authored JSON was required. It selects **seven handler kinds / 16 exact expanded-name entries**. The remaining **25 kinds / 39 entries** have no context and cannot silently fall back to chunk analysis.

The static reference is the independently maintained [Wowless Classic Era XML table](https://github.com/wowless/wowless/blob/c695caab195f06367aec63b9c7ac86241b1f390d/data/products/wow_classic_era/xml.yaml), git blob `dbde4d73e7a42c94432c11286ebd7c004604d980`. Its explicit parameter entries inform OnClick, OnEnter, OnEvent, OnLeave, OnUpdate, PreClick and PostClick. The pinned [compiler source](https://github.com/wowless/wowless/blob/c695caab195f06367aec63b9c7ac86241b1f390d/wowless/modules/xmleval.lua), blob `d034d0cfb3e41b6e70a6020c8dbf4decdc153515`, distinguishes explicit parameters from a generic fallback; that fallback is **not selected** for the unresolved handlers. The [script-type list](https://github.com/wowless/wowless/blob/c695caab195f06367aec63b9c7ac86241b1f390d/data/products/wow_classic_era/scripttypes.yaml), blob `4d83558e8d8c1e66ce87ef01d386d869ad59bd75`, corroborates names only. These are primary sources for the emulator's model, not installed-client engine proof. All reference bytes were checked against Git blob identities; none were executed or copied into the SDK/CI.

Fourteen independently authored checks exercise each selected context's parameter locality, vararg permission, actual provider → Lua → mapper composition and missing-context disposition. Each selected body exposes only the authored Public global with unknown activation; an adjacent unselected handler remains skipped/incomplete. `npm run build` and the private context checker exit0 on ab36b28, Windows Node26.13.1. This deliberately limited caller policy does not certify game signatures or extend the SDK with a built-in handler table.

## Actual commands and results

Parent Windows host session **97095**, terminal **exit1 / incomplete / fullParsing=false**, Node26.13.1:

```text
node scripts/inspect-addon-corpus.mjs <explicit-local-AddOns> --max-file-bytes 134217728 --lua-analysis --lua-input-profile corpus-files --xml-analysis --xml-provider-profile <prepared-private-provider> --xml-inline-lua-profile <prepared-private-contexts>
```

| Stage | Found / attempted | Actual verdicts or dispositions |
| --- | ---: | --- |
| TOC files | 434 / 434 | 434 syntax verdicts; existing TOC diagnostics retained |
| Standalone Lua files | 5,242 / 5,242 | 5,241 accepted / one existing Lua5.1 rejection; 1,531 incomplete lexical projections |
| XML files | 1,199 / 1,199 | 1,146 accepted / 53 XML0002 syntax rejections |
| XML provider | 1,146 eligible | 1,146 validated: 1,116 complete under vocabulary / 30 incomplete roots |
| Extracted inline bodies | 1,339 | 654 eligible / attempted / syntax-accepted / mapping-validated; 685 skipped for missing context |
| Accepted inline lexical analysis | 654 | 640 complete / 14 incomplete; 42 LUA0004 diagnostics |
| Inline provenance | 3 declaration occurrences | 45 declaration/diagnostic queries, 45 original parts, 90 checked decoded/original source references |

Standalone `parsed.lua=5242` excludes all inline bodies. Inline bodies are never credited merely because they were extracted. Three inline declarations are occurrences with inventory association, not active globals or selected-TOC resolver participation.

All stages have **zero read, worker, backend, invariant, encoding and resource failures** in the corrected expanded run. XML syntax/provider checks cover 281,315 / 31,727 source references and 85,212 / 12,714 decoded mappings respectively. XML's own integrity reread checks all 1,199 inputs and finds no changes. A separate private bounded SHA256 ledger taken immediately before/after the expanded run checks **all 6,875 TOC/Lua/XML files**, all matching, zero changed. The parent ledger/reconciliation session **60378** exits0 and verifies disjoint counters, profile identity, output privacy and JSON roundtrip. Profiles and identifying ledgers remain private.

An earlier completed attempt, host session2052, used the generic default 8 MiB byte cap and therefore produced only 5,235 standalone Lua verdicts with seven oversized skips. It already produced the same 654 inline verdicts, but is not full standalone coverage. That attempt is preserved as failed/incomplete evidence. Only after it terminated was the command rerun with the previously approved explicit 128 MiB transport cap; no duplicate run was launched on timeout. The seven skips disappear in the corrected result without changing parser grammar or the Lua corpus profile.

## Verification and remaining dependencies

No SDK, test, package, dependency, version, public API or worker configuration changes are needed for this evidence increment. The actual tested code is exactly ab36b28, whose [PR CI44125730013](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44125730013) and [push CI44125716555](https://github.com/Zilvereyes/wow-addon-sdk/actions/runs/44125716555) each passed all four supported Windows/Ubuntu × Node22/24 jobs. Ubuntu407pass/0skip; Windows404pass/three Linux-only FIFO skips. All eight logs confirm build, architecture/dependencies, API78beta, exports, strict eight-report Extractor and exact licensed package payloads. A documentation follow-up head requires its own CI; it cannot borrow the old head identity. The earlier bounded risk assessment remains attributed to the immutable runtime patch ab36b28.

The broader goal remains incomplete. Next work is ordered as follows:

Subsequent preparation is recorded in [remaining handler evidence](REVIEW-HANDLER-CONTEXT-EVIDENCE.md) and the [unapproved selected-source graph proposal](PROPOSAL-SELECTED-SOURCE-GRAPH.md). The historical classification adds no new installed parser verdicts or chosen contexts; the original counts above remain unchanged.

1. **Context evidence:** classify the 25 unresolved handler kinds, including exact parameter names and variadic permission. Inspect only necessary primary static sources; distinguish explicit evidence, assumptions, conflicts and missing evidence. Extend a private caller profile only with a documented basis. Keep every missing body visible and preserve exact namespace matching. Measure coverage by body counts, never by handler-name inventory alone.
2. **Authored context acceptance:** for each newly selected context, exercise parameter/capture/shadow behavior, positive/negative varargs, dynamic-environment shadowing and disjoint original mapping. Run actual composition and preserve failure/recovery controls; never copy installed bodies into fixtures. Then repeat relevant read-only affected-input acceptance with before/after integrity.
3. **Selected-source graph proposal:** before choosing new loader semantics, prepare a concrete tooling/adaptor design with API/profile/result schemas, supported separators/case behavior, root containment, missing/ambiguous paths, links, cycles, duplicate load occurrences, conditions, deterministic order and budgets. Reuse existing selected-TOC identities/fileEntries and resolver associations; preserve original path spelling separately from filesystem identity. New package/public/game semantic choices require their own decision.
4. **Graph implementation after approval:** authored selected/non-selected TOCs, relative XML Include/Script edges, duplicate/cyclic/escaping paths and safe-read failure regressions; no third-party execution. Keep discovered inventory, reachable sources, actual parser verdicts, skips and graph diagnostics separate. Bound resource/worker/byte costs and commit no partial aggregate prefix after corruption.
5. **Composed acceptance:** feed only selected reachable provider origins into the existing environment resolver, preserving duplicate/source/condition provenance. Cover independent Classic/Retail environments and prove non-selected sources contribute no globals. Keep candidate frames, runtime-unknown Lua and unsupported XML domains honest.
6. **Full acceptance:** execute the complete read-only corpus, explain remaining TOC/Lua/XML diagnostics and uncovered handler/animation/font/binding domains, then require fresh exact-head supported CI, API/architecture/dependency/license/payload checks. `--require-all-parsers` remains failed until actual capability and diagnostic acceptance exist. Merge, tags and publication remain separately authorized.
