# Migration: source v0.6.0 to v0.7.0

The user approved inline Lua A–E in PR #29 on2026-11-17. This source increment adds explicit Lua entry contexts, original-XML source mapping and opt-in inline corpus composition. It is not an npm release. The same eight packages and internal edges remain;84 external lock records and all backend pins/notices stay unchanged.

The five new beta exports are LuaAnalysisContext (lua-analysis), and mapXmlValueRanges, XmlMappedSourcePart, XmlSourceMapping, XmlSourceMappingResult (xml-analysis). Total78 =16 runtime +62 type-only. LuaAnalysisOptions gains optional context; all other pre-existing API shapes/schemas/defaults remain. The five frozen core packages retain their existing contracts.

## Lua context

~~~ts
const result = analyzeLua('self=1; event=2; Out=3', 'decoded:example:0', {
  addonId: 'example',
  context: { kind: 'function-body', parameters: ['self', 'event'], variadic: false },
});
// Only Out is a declaration; its activation is unknown.
~~~

Omitted context and explicit {kind:'chunk'} preserve old file behavior. Explicit function bodies seed local parameters, including captures; they never infer self/event/legacy host names. Every function-body global has unknown activation. Duplicate parameters are allowed and every cell is charged. Nested functions retain their own vararg rules; root ... requires variadic:true. There is no synthetic function wrapper, AST exposure or code execution.

A function-body leading BOM/hashbang is LUA0002; allowShebang:true with that context is LUA0001. Valid quoted BOM characters remain ordinary text. Chunk's optional leading BOM/hashbang policy and bounded/corpus resource profiles are unchanged.

Context consumes at most128 dense own parameter cells and16Ki UTF-16 context string units, including kind/duplicates. Parameters must be Lua5.1 ASCII identifiers excluding reserved words. Own documented snapshots ignore extra fields and custom array iterators. Context input/resource failures are LUA0001/LUA0003 with no declarations. Existing inherited condition strings now copy numeric cells rather than undocumented iterators, correcting a reproduced ownership defect without a new option/schema.

## Original source parts

Analyze decoded text with an explicit decoded identity. Keep that result in decoded coordinates, then map its declaration/diagnostic ranges through the original XmlValue:

~~~ts
import { analyzeLua } from '@wow-addon/lua-analysis';
import { mapXmlValueRanges } from '@wow-addon/xml-analysis';

const decoded = analyzeLua(body.value, 'decoded:example:0', {
  addonId: 'example',
  context: { kind: 'function-body', parameters: ['self'], variadic: true },
});
const ranges = [
  ...decoded.declarations.map(d => d.source.range),
  ...decoded.diagnostics.map(d => d.source.range),
];
const original = mapXmlValueRanges(originalXml, originalPath, body, ranges);
if (!original.complete) throw new Error('Original source mapping failed');
// Bind original.mappings to the decoded occurrences by index.
// Do not rewrite a disjoint declaration.source to an enclosing XML range.
~~~

Original XML content is required. The mapper verifies identities/bounds, literal spellings, XML1.0 entity characters, normalization, contiguous decoded coverage and ordered non-overlapping original spans. It does not parse XML, prove schema ownership or interpret omitted raw gaps. All arrays/fields are bounded documented own snapshots before validation/emission.

Literal intersections clip by UTF-16 offset; entity/normalized intersections retain their complete raw span. A split identifier such as Pub + comment + lic returns two original parts. Query duplicates and mapping boundaries remain distinct. Inherited condition sources already refer to their own original files and are not remapped.

Points inside literals map exactly. An interior astral entity point retains the whole entity span. Seams prefer the next contribution; EOF prefers the last contribution end, excluding trailing gaps. Empty values use their enclosing start as an anchor. Decoded ranges use the existing Lua CRLF canonicalization: a per-part boundary between decoded CR and LF can collapse to the break start, while both original entity parts remain retained. No synthetic interior CRLF column is invented.

Limits: original/decoded strings each1Mi units, mappings/queries each50,000 cells, consumed/emitted source-file strings each1Mi units, and50,000 combined output mapping/part records. Charge before traversal/copying; any invalid late record or exhaustion returns no mapping prefix. XUI0001 and XUI0003 retain their fixed messages. Invalid/empty source identity uses empty file; a sourcePath itself over1Mi uses XUI0003/empty file, never truncation. Individually in-budget paths remain exact on cumulative-budget failure.

Mapping completeness is independent from Lua syntax/lexical completeness. A syntax rejection can have correctly mapped diagnostics. Returned nested objects are owned, not frozen. Existing SourceReference, Diagnostic and GlobalDeclaration are unchanged; sidecars preserve all original parts.

## Opt-in corpus composition

~~~powershell
node scripts/inspect-addon-corpus.mjs examples/xml-inline-lua --xml-analysis --xml-provider-profile examples/xml-provider-profile.json --xml-inline-lua-profile examples/xml-inline-lua-profile.json
~~~

The new flag requires both prior XML flags and an explicit local context profile. The authored example supplies OnLoad's parameters/variadic permission; it is not a selected Classic Era signature. The assistant can prepare technical settings; users need not author JSON.

Profile format is schema1 with chunkContext:{kind:'chunk'} and at most128 unique exact expanded-name handler entries, each carrying an explicit function-body context. No namespace normalization or default handler table is supplied. Missing contexts are skipped/incomplete and never parsed as chunks. Profile validation precedes source discovery.

Only validated extracted bodies are analyzed. Partial XUI0004 providers may retain independently valid bodies; an unsupported root with no bodies attempts none. XML rejection, fatal provider/transport work, missing context, completed Lua syntax rejection, lexical incompleteness and resource/backend bodies remain distinct.

xmlInlineLua is absent unless requested. It reports file transport/dispositions, body syntax/lexical/mapping counts, original parts, diagnostics and integrity separately from xmlAnalysis/xmlProvider/parsed.lua. For complete discovery:

- discoveredFiles = validatedFiles + rejectedBeforeInline + blockedFiles + skippedFiles.
- discoveredBodies = eligibleBodies + skippedMissingContext.
- eligibleBodies = syntaxAccepted + syntaxRejected + resourceBlockedBodies + backendBlockedBodies.
- lexicalComplete + lexicalIncomplete = syntaxAccepted.

The per-file50,000 combined record limit applies to the new inlineLua returned analyses/sidecars: declarations, diagnostics, copied conditions/value cells when present, queries and original parts. Condition value cells mean ConditionDescriptor.values entries; pre-existing provider XmlValue mapping records stay under their separate provider-stage budget and are not recounted as condition cells. Current inventory composition supplies no inherited conditions. Syntax/provider limits and the32MiB combined wire cap remain unchanged. Exact50,000/one-over inline record tests use actual split-identifier Lua declarations and mapped parts.

The worker retains256MiB heap,10-second per-file deadline,32MiB output cap and a trusted fixed path. Additional inline caps are5,000 bodies and1Mi cumulative decoded units. Semantic/map counts commit only after whole-envelope checks and a matching original-XML reread; invalid late bodies/sidecars discard the whole file prefix. Lua/XML reads now use the same bounded nonblocking identity/path-checked helper as TOC reads, correcting reproduced native replacement races. All fixture mutations occur only in authored temporary directories.

The example can pass its requested inventory analysis while fullParsing remains false: selected-source reference traversal/resolver participation is not implemented. Parsed standalone Lua files remain a separate count; extracted/submitted bodies alone are not syntax verdicts. No source is executed, followed or modified.

See [approved contract/acceptance matrix](PROPOSAL-INLINE-LUA.md), [local corpus guide](LOCAL-CORPUS-TESTING.md) and the focused PR for exact final verification and remaining installed-context/domain/graph coverage.
