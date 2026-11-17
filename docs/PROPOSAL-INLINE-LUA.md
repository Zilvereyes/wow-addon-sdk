# Inline Lua context and original XML provenance — decision proposal

Status: **A–E approved by the user on 2026-11-17 and implemented on the review branch; final acceptance is tracked in PR #29**. The explicit answer “godkendt” to the A–E question, followed by annotation “ja”, is recorded in [the decision](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6952532068). The approved XML provider A–D remains a separate increment in [PR #28](https://github.com/Zilvereyes/wow-addon-sdk/pull/28), frozen at580ed8b. Neither approval grants merge/tag/publication rights. Source0.7.0 retains eight packages with78 beta exports. The concrete contract below retains its proposal rationale; [migration](MIGRATION-v0.6-to-v0.7.md) describes implemented behavior and limits.

## Observed gap and measurable outcome

The [actual XML-provider inventory](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6951837363) validates1,146 projections and extracts37 chunks/1,302 handlers, but executes **zero inline Lua parses**. Its exit1/fullParsing=false also preserves53 XML syntax rejects,30 unsupported-root projections, known TOC findings and excluded domains. These counts are not a loader-selected graph or complete game vocabulary.

Current analyzeLua treats its input as a standalone chunk: authored self=1; Out=2 produces two unconditional declarations, and return ... is accepted. A handler with an explicit local self and non-variadic signature needs different scope/grammar and unknown activation. XML-decoded bodies can join an identifier across comments, CDATA and entities; their Lua coordinates cannot be labelled original XML coordinates. SourceReference represents one interval, not a list of contributing spans.

Deliver the next vertical slice: context-aware Lua parsing plus a bounded original-source mapper and opt-in worker/corpus composition. Preserve the five core packages, all existing defaults, exact source identities, occurrence order/duplicates, beta status and zero-based UTF-16 exclusive-end positions. Never execute source. No reference traversal, built-in handler signatures or certified game schema is added.

## A — Explicit Lua entry context; preserve old callers

Add one beta root type in lua-analysis and one optional field on the existing LuaAnalysisOptions:

~~~ts
export type LuaAnalysisContext =
  | { readonly kind: 'chunk' }
  | {
      readonly kind: 'function-body';
      readonly parameters: readonly string[];
      readonly variadic: boolean;
    };
// Additional field on LuaAnalysisOptions:
readonly context?: LuaAnalysisContext;
~~~

The [standalone contract fixture](proposals/inline-lua-contract.ts) declares proposed types locally; compiling it does not claim current SDK feature exports.

Omitted context and explicit chunk preserve today's syntax, BOM/hashbang, scope, diagnostics, resource profiles and activation rules. Chunk does not consume parameter/variadic fields. Extra caller fields are ignored, never spread or copied. A function-body requires both explicit fields; parameters is a dense own-numeric-cell array of at most128 Lua5.1 ASCII identifiers, excluding reserved words and ... . Duplicates are allowed as parameter grammar allows; every supplied cell counts toward the limit, and no duplicate is returned as a declaration. At most16Ki UTF-16 units are consumed by context strings. Invalid context => existing LUA0001; context exhaustion => LUA0003; no declarations. Snapshot documented own fields without invoking array iterators; context getter/projection exceptions fail closed. Existing conditions/default validation behavior is preserved, not broadly refactored.

Parameters are local from entry, including captured references in nested functions. Ordinary local declarations, method self, initializer order and loop/repeat scopes retain the existing corrected behavior. No self, this, event, arg, arg1 or other host name is inferred. Every function-body global occurrence has activationState unknown, including direct assignments/function declarations. Existing inherited conditions remain copied provenance.

Root ... requires variadic:true. A nested function has its own declared vararg permission; it does not inherit the enclosing permission. The implementation must skip nested function subtrees when checking root varargs, including nested VarargLiteral parameter nodes. A whole-call syntax failure returns no declarations. Comments/string literals containing dots do not count. Return/break grammar is unchanged.

Function-body is grammar input, not a file-loader input: reject a leading BOM/hashbang as LUA0002 and reject allowShebang:true with function-body as LUA0001. BOM characters in valid strings retain ordinary string handling. Chunk's existing optional leading BOM/hashbang behavior is unchanged. Both bounded/corpus profiles retain their current limits; callers still own heap/stack/time supervision. Native Lua compiler-local limits and WoW runtime compatibility are not inferred.

Implementation recommendation: parse the original body with the existing Chunk backend, seed the existing scope annotation, enforce nearest-function root-vararg permission and override function-body activation. Do not insert a function wrapper, synthetic parameters, nodes or source positions. Pinned luaparse0.3.1 already creates independent nested function contexts. The existing parser adaptations for Lua5.1 defects remain intact.

Alternatives: a wrapper complicates trailing comments, delimiter escape, synthetic errors/budgets and offset translation; changing standalone chunk defaults breaks existing callers; guessing handler signatures creates unsupported game semantics. A generic explicit context avoids those changes.

## B — Batch mapper with ordered original source parts

Add exactly four beta exports to xml-analysis: one function and three interfaces. Add no package or dependency edge; xml-analysis already depends on diagnostics/xml-parser and **does not import lua-analysis**. Tooling owns composition.

~~~ts
export interface XmlMappedSourcePart {
  readonly decodedRange: SourceRange;
  readonly kind: 'literal' | 'entity' | 'normalized' | 'anchor';
  readonly source: SourceReference;
}
export interface XmlSourceMapping {
  readonly decodedRange: SourceRange;
  readonly parts: readonly XmlMappedSourcePart[];
}
export interface XmlSourceMappingResult {
  readonly schemaVersion: 1;
  readonly complete: boolean;
  readonly mappings: readonly XmlSourceMapping[];
  readonly diagnostics: readonly Diagnostic[];
}
export function mapXmlValueRanges(
  content: string, sourcePath: string, value: XmlValue,
  ranges: readonly SourceRange[]
): XmlSourceMappingResult;
~~~

content is original XML text, sourcePath its exact caller identity, value an existing mapped decoded value, and ranges are positions within value.value. Original content is necessary: XmlValue shape alone cannot prove source text. Before validation/emission, take one bounded snapshot of documented own fields/own numeric cells, including nested sources/positions and all queries; ignore extra fields and never invoke array iterators. Charge lengths/strings/entries before consuming/copying. Validate and emit only that snapshot; never re-read mutable/getter-backed input records after validation. A changing getter cannot substitute an unvalidated output source. Native getters are caller code, not a sandbox; exceptions fail XUI0001 unless a defined budget was exceeded.

The mapper verifies exact file identities, bounded enclosing/source ranges, dense arrays, safe integer positions, contiguous decoded coverage, ordered non-overlapping raw spans inside the enclosing value, and literal/normalized/entity correspondence. Original gaps are allowed and not interpreted as executable text or proven markup. This is source-map consistency, not XML schema validation or proof that caller records came from a particular parser element.

Literal parts clip to the decoded intersection using UTF-16 offsets and original line endings. Entity/normalized intersections return the entire original mapped span while decodedRange records only the actual intersection. Predefined/numeric XML entities and the existing XmlValue normalization rules are accepted only when original spelling decodes exactly. Numeric entities must be valid XML1.0 characters; do not round astral units to Unicode scalars or invent a location inside entity spelling.

Return one mapping per query in input order, even for duplicate queries; preserve original part order and mapping boundaries. Do not sort/deduplicate occurrences, merge across raw gaps, use an enclosing hull as exact provenance, or collapse parts into an existing declaration.source. The mapper is batch-atomic: an invalid late mapping/query or exhausted budget yields mappings:[], complete:false and one fixed error. Reuse existing XUI0001/“Invalid XML analysis input projection.” and XUI0003/“XML analysis resource limit exceeded.”; no new diagnostic code. Failure anchors at the supplied original file's start, as in analyzeXml. A non-string/empty sourcePath uses its existing empty identity convention. For this new operation, a sourcePath itself longer than1Mi units yields XUI0003 with an empty file identity; never truncate the supplied path or emit an over-budget diagnostic string. A cumulative-budget failure with an individually in-budget sourcePath retains that exact identity. Valid source identities are always preserved exactly. Returned documented fields are deeply owned, not frozen.

Point rules are deliberately explicit:

| Query | Source part |
| --- | --- |
| Point strictly inside a literal | Exact original point; kind anchor |
| Point strictly inside a multi-unit entity | Entire entity span; kind entity, zero-width decodedRange |
| Decoded seam before another contributing span | Right bias to that span's original start; kind anchor |
| EOF of a nonempty value | Last contributing span's original end; kind anchor, excluding trailing gaps |
| Empty/self-closing/comments-only value | value.source.start fallback; kind anchor, not a contributing character |
| Nonempty partial entity/normalized intersection | Whole original mapped span; original part kind |

Decoded position conversion uses the same CR/LF/CRLF convention as analyzeLua. A point inside decoded CRLF has already been canonicalized to its beginning by Lua's current source converter; lost interior precision cannot be reconstructed. Reject columns beyond a line's content, including ambiguous positions inside line terminators. Do not normalize caller source paths.

Limits: original content and decoded value each <=1Mi UTF-16 units; mappings <=50,000; queries <=50,000; consumed source-path strings <=1Mi units total. Cap **combined output mapping + part records at50,000**, counting every query and every emitted part/anchor, and emitted source-file string units at1Mi (charge every occurrence, including duplicates, before copying). Validate lengths before traversal and charge each emitted record before allocation/copy. Index source/decoded lines once, mappings once, then binary-search queries plus actual intersections; never scan all mappings for every query. Input/projection exceptions fail closed. There is no filesystem/network call or parser invocation in this operation.

The original decoded LuaAnalysisResult remains distinct, using an explicit caller-owned decoded identity such as decoded:authored:0. Tooling attaches declaration/diagnostic origin sidecars by occurrence index. It does not recursively remap inherited condition sources, which may already refer to another file. Mapping complete and Lua lexical/syntax complete are separate: a valid syntax rejection can have a successfully mapped diagnostic, and LUA0004 can retain correctly mapped unknown declarations. Registry participation remains deferred; a disjoint origin is never passed as a fabricated contiguous original GlobalDeclaration.source.

## C — Explicit opt-in inline corpus composition

Add --xml-inline-lua-profile <local-json>, requiring --xml-analysis and --xml-provider-profile. No new default path, game-handler table or automatic signature inference. The proposed exact profile shape is:

~~~json
{
  "schemaVersion": 1,
  "chunkContext": { "kind": "chunk" },
  "handlers": [
    {
      "element": { "namespaceUri": null, "localName": "OnLoad" },
      "context": {
        "kind": "function-body",
        "parameters": ["self"],
        "variadic": false
      }
    }
  ]
}
~~~

This is an authored example/analysis assumption, not a selected Classic Era signature. Handler selectors use exact expanded-name matching, max128, no duplicates; the context must be function-body. Chunk context must be chunk. Validate the entire profile before traversal, snapshot own fields, charge duplicate parameter cells and consumed strings (1Mi cumulative profile units). Reject unknown schema versions/missing documented fields; extra input fields remain ignored and unretained. JSON loading stays bounded/read-only with the existing profile transport. Root/handler vocabulary and signature assumptions remain independent.

Only validated XmlInlineScript bodies are eligible. A valid partial XML-provider result with XUI0004 may retain independent valid bodies: those bodies are analyzed. Its provider incompleteness remains visible and prevents fullParsing; it is not a fatal provider failure. An unknown-root result with no bodies gives zero inline attempts. XML syntax rejection gives rejectedBeforeInline; invalid/fatal input/backend/resource provider projections give blockedFiles, with providerBlockedBeforeInline as a reason subcount, never body parse credit. Missing handler context is skippedMissingContext and incomplete, never guessed as a chunk or counted parsed. A selected body is sent to the actual analyzeLua API with its explicit context and bounded profile; hashbang loading is disabled. Mapping queries include every returned declaration/diagnostic source.range, without remapping inherited conditions. Explicit decoded identities are opaque ordinal IDs; original XML identities remain exact in private provenance.

Extend the fixed trusted XML worker envelope only under the new flag. Parser-only/provider-only envelopes and imports remain unchanged. Worker orchestration can import both optional packages without a new SDK edge. Keep the existing256Mi heap,10-second per-file deadline,32Mi output envelope and trusted fixed worker path; these are supervision, not a sandbox. Additional per-file caps:5,000 bodies;1Mi cumulative decoded body units;50,000 combined returned declaration/diagnostic/condition/value-cell/query/part records. Check before accumulating; a limit yields a fixed resource disposition with no prefix projections. No original Lua/XML is executed or followed as a reference.

Telemetry must distinguish file transport and body syntax/projection/mapping:

- File counts: requested/discoveryComplete, discoveredFiles/attemptedFiles/submittedFiles/completedFiles/validatedFiles, rejectedBeforeInline (completed XML syntax/profile rejection), blockedFiles, skippedFiles and read/worker/backend/invariant/resource/providerBlockedBeforeInline reason subcounts, plus source-integrity counts. Each discovered file has exactly one terminal disposition: validatedFiles, rejectedBeforeInline, blockedFiles or skippedFiles. A valid partial provider envelope can yield a validated inline file with independent bodies while provider completeness stays false.
- Body counts, only from a whole validated file envelope: discoveredBodies, eligibleBodies, skippedMissingContext, attemptedBodies, syntaxAccepted, syntaxRejected, resourceBlockedBodies, backendBlockedBodies, lexicalComplete, lexicalIncomplete, mappingValidated, declarations and diagnosticsByCode. discoveredBodies = eligibleBodies + skippedMissingContext; eligibleBodies = syntaxAccepted + syntaxRejected + resourceBlockedBodies + backendBlockedBodies. lexicalComplete + lexicalIncomplete = syntaxAccepted.
- Mapping totals: queried records, original parts and source-reference/serialization checks. Extracted bodies and submitted counts alone are never parse credit.
- Missing context is not syntax rejection. LUA0002 is a genuine completed syntax rejection with empty declarations; valid fixed LUA0003/LUA0005 results are blocked body resource/backend work with empty declarations; LUA0004 is lexical incompleteness. Independent valid bodies in the same valid file envelope may retain credit. A per-file aggregate limit instead blocks the whole file, exposing no body prefix. Map every valid body diagnostic, including rejection/resource/backend diagnostics; mappingValidated counts successful mapping batches across all four attempted-body dispositions, not syntax acceptance. Each eligible body has exactly one disposition. A malformed Lua/backend projection or invalid late map/envelope blocks the file and gives no body counter/fact prefix.
- Stage semantic/mapping counters per file until independent decoded-range/original-source validation and post-run XML hash matching succeed; invalid late bodies/envelopes/maps retain no earlier semantic prefix. Actual file submitted/completed transport counts remain observable even when projection validation fails.
- Keep XML syntax, XML provider and inline Lua counters separate; parsed.lua remains standalone file syntax verdicts. Inline bodies get their own actual syntax-verdict count. Incomplete/missing domains, reference graph or known errors keep fullParsing=false.

The installed source corpus is unchanged and read-only. A future inline pass requires an explicitly prepared/selected local context profile; current XML vocabulary selection is not a handler signature decision. Publish safe counts only. Binding/animation/font domains and non-selected casing remain separate coverage work. No loader-selected association or active globals are inferred from inventory/chunk-local static activation.

## D — Required authored acceptance examples

The rows below are proposed expected feature behavior, **not tests already passed**. Existing characterization and type-fixture checks are labelled separately in [the review record](REVIEW-INLINE-LUA-PROPOSAL.md).

| Requirement | Authored vector / measurable result |
| --- | --- |
| Backward compatibility | Omitted context == explicit chunk for every current Lua fixture, both profiles and repeated failure/recovery calls; current snapshots unchanged except approved optional field/new type. |
| Parameters/activation | Function-body self,event; self=1; event=2; Out=3 => only Out, unknown. Direct function Public with Nested assignment => both unknown. |
| Captures/shadowing | Parameter p captured by a nested function remains local; nested parameter p does not hide a later root p global. Correct loop/header/repeat/local-initializer order is retained. |
| Varargs | return ... rejects with variadic:false, accepts with true; nested function(...) stays valid under false outer context; nested function() using ... stays invalid under true outer context. |
| Lexical safety | String/comment dots do not trigger checks; root break rejects; method self remains local; require parameter shadows dynamic-environment lookup, unbound require retains LUA0004/unknown. No function is executed. |
| Context projection | Sparse/iterator-hostile/accessor/invalid names/keywords/oversize128+1/string budget/duplicates; malformed/overlimit calls return no declarations and recover next call. |
| Prefixes | Function-body BOM/hashbang reject; allowShebang:true rejects as invalid options; old chunk BOM/hashbang regressions stay green. |
| Split identifier | XML `<Ui><Script>Pub<!--gap-->lic=1</Script></Ui>`: decoded Public source[0,6) maps to raw[12,15),[25,28), preserving the gap. |
| Transforms | `A&amp;B` + CDATA CRLF + comment + D uses the approved independent XML golden intervals; partial entity queries include complete raw entity spelling. |
| Astral UTF-16 | In `<Ui><Script>"&#x1F600;"</Script></Ui>`, decoded[1,3) maps to raw[13,22); either half intersects the same whole entity. Literal astral spans clip by UTF-16 units. |
| Point seams | Every seam/interior/EOF/trailing comment/PI/empty/self-closing/comments-only case matches B's explicit rule; no hull or synthetic suffix positions. |
| Original validation | Wrong path, bounds, raw literal, decoded spelling, invalid numeric entity, gaps in decoded coverage, raw overlaps/reversal, changing getters, inherited/extra fields, hostile iterators and bad late query fail closed or are ignored exactly as specified; no unvalidated source reaches output. |
| Ownership/conditions | Mutating returned parts/positions/arrays cannot alter inputs or another call; foreign inherited-condition source remains byte-for-byte unchanged; duplicate declarations/queries retained. |
| Resource/performance | Exact limit/one over for source/decoded/arrays/strings/output; overlimit sourcePath yields XUI0003/empty file, while an individually in-budget identity remains exact on cumulative-budget failure. Adversarial many queries use bounded indexed work; no partial file/worker prefix survives. |
| CLI/worker | Flag prerequisites, exact schemas/envelopes, missing contexts, mixed accept/reject/incomplete, late corruption, source change, deadline/output/heap and successful next file. |
| Partial-provider eligibility | `<Ui><Frame name="Bad" virtual="invalid"/><Script>Out=1</Script></Ui>` retains provider incomplete/XUI0004, but the independent chunk is attempted once and syntax-accepted/mapped once; unknown-root/no-body input attempts zero. A valid LUA0003 body does not erase independent valid bodies, while an invalid late envelope/map erases all body prefix counters for that file. |
| Actual invocation | Authored XML -> actual provider -> actual context-aware analyzeLua -> mapper -> independent source checks. Assert accepted/rejected/skipped counts and JSON roundtrip separately. |
| Distribution/CI | All eight workspaces, old defaults, acyclic edges, prior external lock records, strict reports, beta exports, licenses and actual payloads; Windows/Ubuntu x Node22/24 on exact implementation head. |

All example offsets are zero-based UTF-16, ends exclusive; raw golden offsets assume the exact one-line prefix shown and real CRLF where stated.

## E — Dependency-ordered implementation and decision boundary

An approved implementation would advance all eight shared workspace/internal ranges to source0.7.0, retaining beta status. **Five new exports**: LuaAnalysisContext plus mapXmlValueRanges/XmlMappedSourcePart/XmlSourceMapping/XmlSourceMappingResult. Expected total78 =16 runtime +62 type-only. This proposal itself changes **zero SDK exports, versions, lock records or package edges**. Keep all current73 exports, all prior defaults, existing schema1 results and public core contracts.

| Step | Write surface | Prerequisites / acceptance |
| --- | --- | --- |
| 1. Record A–E decision | This proposal; #11; focused PR | User chooses the new contracts; no implementation inferred from old XML approval. Separate merge rights remain separate. |
| 2. Context red regressions | tests/contracts/lua-analysis.ts; tests/lua-analysis.test.mjs; profile tests | Fail for absent context behavior, then prove explicit parameter/vararg/activation/prefix rules and recovery without wrapper positions. |
| 3. Context implementation | packages/lua-analysis/src/{index,syntax}.ts | Snapshot only new context; seed scopes/root-function checks; preserve backend adaptations/default fixtures and old conditions. |
| 4. Mapper red regressions | New tests/xml-source-mapping.test.mjs; contract fixture | Independent golden spans/points, corruption/ownership/late failure/resource/performance, no production implementation used to derive expected offsets. |
| 5. Pure indexed mapper | packages/xml-analysis/src/index.ts | Existing package edges/four-file packlist; no new helper payload or core/interface rewrite. Batch ownership/failure/limits. |
| 6. Real composition/tooling | XML worker/client, corpus runner/validator and authored CLI tests | New explicit profile/envelope only under flag; actual API calls, atomic whole-file credit, zero source writes and no body execution. |
| 7. Public gates/docs | Manifests/lock/internal ranges, baselines/API reports, export gates, docs/examples | Five reviewed exports/78beta, no external resolution changes; strict Extractor, exact packages/licenses and all existing defaults. |
| 8. Final acceptance | Parent-owned checks + exact-head supported CI; focused implementation PR | Focused regression then proportional full build/architecture/deps/API/exports/license/packlist gates, independent review and diff. No automatic merge. |
| 9. Local context preparation/pass | Private explicit profile + approved read-only input; safe #11 evidence | Document signature assumptions and missing contexts first, then actual body verdicts, mapping/integrity/serialization counters; keep honest failed/incomplete status. |
| 10. Subsequent graph | Separate concrete contract/adapter work | Bounded path resolution, selected TOCs/association, cycles/escapes/missing files and composed registry remain open. |

Primary language evidence: the [Lua5.1 manual](https://www.lua.org/manual/5.1/manual.html#2.5.9) makes parameters local and restricts vararg expressions to their own variadic function; [the reference parser](https://www.lua.org/source/5.1/lparser.c.html#simpleexp) checks the current function's flag. Those sources do not supply WoW XML handler signatures. The recommendation is additionally grounded in the pinned backend/current source and authored characterization, not a native compiler or runtime oracle.

The user approved **A–E as one coherent context/mapping/tooling increment**. That approval authorizes implementation/tests/docs/GitHub maintenance under these contracts; it does not authorize merge of #28/this PR, tags, publication, software installation or game writes. Final acceptance requires the actual feature matrix above; earlier proposal-only checks are historical evidence, not implementation success.
