# Lua corpus profile: approved A–E

The user explicitly approved [proposal A–E](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6923640054): “Ja, implementér corpusprofil A–E”. The decision is recorded in [#6](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6925438729) and [#11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6925439223). Source increment: v0.4.1. Do not request this approval again. XML A–F remains a separate pending decision.

## Observable contract and compatibility

Add one beta type, `LuaAnalysisProfile = 'bounded' | 'corpus'`, and optional readonly `profile` / `allowShebang` fields on LuaAnalysisOptions. The existing omitted profile is exactly bounded; hashbangs still require explicit allowShebang:true. Invalid own/inherited fields produce LUA0001 with zero declarations. Default diagnostics, byte decoding, lexical scope/activation, conditions/ownership and schemas stay unchanged.

| Budget | bounded (default) | corpus (explicit) |
| --- | ---: | ---: |
| Original UTF-16 input units | 1 Mi | 32 Mi |
| Constructed/visited AST nodes | 50,000 | 4,000,000 |
| Accepted AST depth | 256 | 1,024 |
| Tooling parser old-generation budget | 128 MiB | 2 GiB per V8 isolate |
| Tooling parser stack | 1 MiB child | 8 MiB Worker thread |
| Request deadline | 10 seconds | 60 seconds |
| Protocol output | 32 MiB | 128 MiB |

Input bounds apply before indexing/parsing. Node/depth/native-stack exhaustion remains a resource failure without prefix declarations. The pure SDK creates no processes, imports no Node module and offers no hard CPU/memory sandbox; callers selecting corpus own supervision. A larger profile is not proof every input fits.

The root surface becomes **56 beta exports** (13 runtime values/functions, 43 type-only). Existing 55 exports remain. Only the approved Lua declaration/report changes; the five core APIs, package directions, six-file Lua/four-file core packlists and pinned luaparse bytes/licenses remain. All six workspace versions/internal ranges advance together; third-party/link lock records must stay exact.

## Loader/source behavior

allowShebang:true masks an initial #! line after one optional BOM with equal-width spaces only in the parse copy. Preserve original CR/LF/CRLF and UTF-16 source positions. Header-only text is an empty chunk. Ordinary #, interior headers, repeated BOM, binary chunks and later-language grammar remain unsupported. This is a chosen loader profile; the [reference Lua file loader](https://www.lua.org/source/5.1/lauxlib.c.html) has a broader initial-hash rule. No WoW loader conformance or input execution is inferred.

## Opt-in file transport

`--lua-input-profile corpus-files` requires --lua-analysis and selects corpus + allowShebang:true. Repeated/missing/unknown arguments fail before traversal. Generic byte limits remain independently explicit:

```powershell
node scripts/inspect-addon-corpus.mjs '<AddOns-directory>' --lua-analysis --lua-input-profile corpus-files --max-file-bytes 33554432 --resolution-profile examples/classic-era-resolution-profile.json
```

Strict UTF-8 is attempted first with BOM retained. Only malformed, BOM-free input permits Buffer Latin-1 transport: one byte becomes one U+0000…U+00FF unit. Recognized UTF-8/UTF-16/UTF-32 BOMs cannot use fallback. This is not Windows-1252, a locale guess, interpreted string values or intended Unicode. Source coordinates refer to the exact supplied transport string; byte-mode columns are not claimed to match a Unicode editor's guessed decoding. Report strictUtf8 / bytePreserving decode counts separately and preserve original bytes. See [Node character encodings](https://nodejs.org/api/buffer.html#buffers-and-character-encodings).

The measured default baseline has 5,106 syntax verdicts / 136 blocks. Its four invalid-UTF8 files retain unchanged hashes, no BOM and no zero bytes; the largest resource-blocked file is 20,160,363 bytes. Those measurements justify testing the proposed transport/budgets, not claiming future success. No source enters Git/CI.

## Process lifecycle and failure boundaries

The bounded worker path is unchanged. The corpus child uses one persistent parser Worker thread, fixed module paths, no shell/eval/source-selected arguments, 8 MiB stack and 2 GiB old-generation limits. Inherited preload/test/coverage hooks are omitted. The supervisor correlates exact IDs, rejects malformed replies/overlap, limits output and kills/reaps failed children. Child termination contains its thread; graceful EOF closes and awaits it.

The [Node 22 Worker contract](https://raw.githubusercontent.com/nodejs/node/v22.x/doc/api/worker_threads.md) distinguishes per-isolate heap constraints from native/ArrayBuffer/total-RSS memory and explains command-line heap overrides. The child flag and thread limit deliberately agree at 2 GiB. Only one request runs at a time. Timeout, heap/stack/output failure and crash remain explicit failed coverage; no automatic limit increase or deadline extension. Internal thread/worker overrides exist solely for isolated tests, never corpus source/profile data.

## Ordered acceptance and evidence

1. Demonstrate absent profile/type/options/transport/worker behavior with focused failures; preserve prior successful default checks.
2. Implement the approved type/options, fixed limits and equal-width header mapping. Test above-default input/nodes, hard input cap, original spans and malformed own/inherited fields.
3. Implement explicit CLI transport with BOM guards, byte preservation/privacy and unchanged strict default. Exercise real SDK results and source invariants.
4. Test real deeper SDK parsing, repeated calls, timeout/crash/output/protocol cleanup and native isolated heap exhaustion with a small test-only budget; reap all workers before temporary-file cleanup.
5. Review the one changed public report/baseline, original export retention, exact dependency/license/packlist invariants and supported-platform behavior.
6. Re-run every installed Lua file with the explicit preset; reconcile the original 136 blocks and shebang rejection. Count all remaining failures honestly. Keep dynamic projections, TOC errors, unavailable XML and graph association separate.
7. Complete local gates, exact-head Ubuntu/Windows × Node 22/24 CI and review, fix findings and integrate under existing routine authorization. No release/tag/game write.

Local and final corpus/CI results are recorded in the implementation PR and #11 after execution. XML, selected-source reference traversal and whole-corpus provider composition remain required for the overall goal.
