# XML provider facts and inline-source projection — decision proposal

Status: **proposed, not approved or implemented**. Prepared after the user's explicit merge approval for #25 and #27 on 2026-11-17. Existing XML A–F, Lua A–E and corpus-profile A–E approvals remain binding. This document requests only the new A–D choices below; it grants no merge, tag, publication or installation rights.

## Observed gap and next deliverable

Integrated source `3c99b3342bc81f3529fe10cdb422ddd9f7f3d586` has seven packages and 65 beta exports. `packages/xml-parser/src/index.ts` returns XML syntax, elements, attributes, text and decoded maps. It does not produce frame declarations, Script/Include facts or a joined inline body. `analyzeLua` accepts a standalone chunk and has no XML handler parameter/context contract. Passing an event handler directly to it could misinterpret implicit locals or reject a handler's varargs. A wrapper string would introduce synthetic source positions. Neither workaround is accepted by this proposal.

The next small implementation is a **pure, explicit-policy XML fact provider**: candidate frames, literal candidate declarations with unknown activation, unresolved file references and mapped inline bodies labelled chunk/handler. It does not yet analyze those bodies as Lua or traverse references. Subsequent handler-aware Lua analysis and selected-source traversal are separately specified steps, not hidden implementation details or claims of completion.

The existing aggregate run at implementation `947e559` gives 434 TOC / 5,242 Lua / 1,199 XML syntax verdicts and zero read/backend/invariant/resource blocks. It still exits 1 / fullParsing=false. A new provider must retain those distinctions, known diagnostics and the missing traversal/handler work.

## A — One optional semantic package; preserve syntax and core contracts

Propose `@wow-addon/xml-analysis` as an eighth, optional leaf. Its only internal dependencies/references are `xml-parser`, `diagnostics` and `global-registry`, at the exact shared SDK version. No new third-party dependency, reverse import or filesystem/process/network/editor API enters any SDK package. The five core packages, existing syntax package and Lua package keep their current APIs and edges.

An approved implementation would advance all eight workspaces/internal ranges together to source 0.6.0, retaining beta status and existing 65 exports. It adds exactly **eight root exports: one function and seven interfaces** (73 total; 15 runtime, 58 type-only). Root exports remain exactly types/default. Proposed new tarball: package.json, LICENSE, dist/index.js and dist/index.d.ts. Private implementation helpers must either compile into that single index or be explicitly added to the reviewed packlist before implementation; no wildcard payload is accepted. Existing backend artifacts, licenses and unrelated lock resolutions stay exact.

Alternative: extend xml-parser with registry/provider semantics. Rejected recommendation because it changes the approved syntax-only boundary and makes syntax consumers acquire semantic dependencies. Tooling-only private extraction avoids a public API but cannot deliver the reusable SDK provider requested by #11. The optional leaf keeps both uses available.

## B — Exact caller policy and candidate semantics

No built-in WoW widget list, namespace alias, schema validation or game-loader table is introduced. The caller supplies expanded-name selectors. Matching is case-sensitive on `(namespaceUri, localName)`; null means no namespace. Prefix spelling alone never matches a different URI. Parsing always enforces the approved namespace-aware XML profile; the provider offers no namespace-off option.

Each policy list is dense, has at most 128 selectors and has no duplicates. Selectors require nonempty localName without a colon; namespaceUri is null or a nonempty string. All six role lists are pairwise disjoint. Empty lists are valid except roots, which must be nonempty. Matching only consumes documented own fields; malformed policy/input yields XUI0001 and no facts. Extra caller fields are not copied or evaluated as policy. Caller getters are code, not sandboxed input.

The document root must match roots. Otherwise return complete=false / XUI0004 and no facts. Under a recognized root:

- A matching frame element anywhere below that root is a candidate. Preserve preorder, element index, whole-element source and optional unqualified name/virtual/inherits attribute values. Namespaced lookalike attributes do not count. Unknown vocabulary is not inferred as a frame; these are facts under the supplied vocabulary, not proof of game schema conformance.
- A nonempty name without `$` may produce a `kind:'frame'` declaration only when virtual is absent or exactly `false`. Keep the decoded spelling exactly, without trimming, path normalization, deduplication or ASCII-identifier filtering. All such declarations have activationState **unknown**, caller addonId and copied inherited conditions. This means a *candidate for a string-key global*, not a valid bare Lua identifier or evidence that the frame is instantiated. `listGlobals()` therefore does not expose it by default.
- Exactly `virtual='true'` produces a retained template candidate and no global declaration. Other virtual values produce XUI0004 and no declaration. Empty names and names containing `$` remain unresolved candidates with no declaration. Do not expand `$parent`, choose an ancestor, instantiate a template, resolve inherits or manufacture globals for descendants.
- Matching Include and Script elements are recognized only as direct children of the recognized root. Their unqualified file attribute yields an unresolved reference fact, including its decoded value and original map. The provider never resolves separators, variables, URLs, absolute paths, missing targets or duplicates. A missing Include file or any empty present file target yields XUI0004; an empty present target is retained for diagnosis. No reference is opened.
- A Script without file yields a chunk body only when it has no child elements; a child element yields XUI0004 and no body. Script with file yields its reference; non-whitespace text or child elements additionally yields XUI0004, without an inline body. This avoids silently choosing an execution model for ambiguous source.
- A handler matches handlerElements only when its parent matches handlerContainers and its grandparent is a matched frame candidate. A handler file attribute or nested element yields XUI0004 and no inline body. Other matching names at other locations are ignored under this explicit structural policy. An absent/empty body remains an empty mapped body.

XUI0004 is a warning for an unsupported/ambiguous recognized construct and makes complete=false while retaining independent valid facts from that document. Unknown `$parent`, inherits and correctly marked virtual templates are expected retained facts, not malformed XML and not automatically diagnostics. complete=true means complete extraction **under this policy**, never resolved globals, complete game semantics, handler parsing, reachability or successful execution.

Existing syntax diagnostics pass through with copied source records. Syntax failure returns complete=false and empty provider arrays. XUI0002 is a fixed error for an unusable syntax-backend projection; XUI0003 is a fixed resource error. Input/backend/resource failures fail closed for the whole provider call; no valid-prefix facts escape. No exceptions or private backend objects/messages leak through returned diagnostics.

## C — Eight explicit beta exports and exact mapped bodies

All interface fields are readonly; output ownership is deep per call, including conditions, mappings, nested names and sources. Readonly types do not imply runtime freezing. SourceReference retains its existing shape. Proposed declarations (imports below reuse existing public types and are not additional exports):

```ts
import type { Diagnostic, SourceReference } from '@wow-addon/diagnostics';
import type { ConditionDescriptor, GlobalDeclaration } from '@wow-addon/global-registry';
import type { XmlValue } from '@wow-addon/xml-parser';

export interface XmlElementSelector {
  readonly namespaceUri: string | null;
  readonly localName: string;
}
export interface XmlAnalysisPolicy {
  readonly roots: readonly XmlElementSelector[];
  readonly frameElements: readonly XmlElementSelector[];
  readonly includeElements: readonly XmlElementSelector[];
  readonly scriptElements: readonly XmlElementSelector[];
  readonly handlerContainers: readonly XmlElementSelector[];
  readonly handlerElements: readonly XmlElementSelector[];
}
export interface XmlAnalysisOptions {
  readonly addonId: string;
  readonly policy: XmlAnalysisPolicy;
  readonly conditions?: readonly ConditionDescriptor[];
}
export interface XmlFrameCandidate {
  readonly elementIndex: number;
  readonly name: XmlValue | null;
  readonly virtual: XmlValue | null;
  readonly inherits: XmlValue | null;
  readonly source: SourceReference;
  readonly declarationIndex: number | null;
}
export interface XmlFileReference {
  readonly elementIndex: number;
  readonly kind: 'include' | 'script';
  readonly target: XmlValue;
  readonly source: SourceReference;
}
export interface XmlInlineScript {
  readonly elementIndex: number;
  readonly kind: 'chunk' | 'handler';
  readonly body: XmlValue;
  readonly source: SourceReference;
}
export interface XmlAnalysisResult {
  readonly schemaVersion: 1;
  readonly complete: boolean;
  readonly frames: readonly XmlFrameCandidate[];
  readonly references: readonly XmlFileReference[];
  readonly scripts: readonly XmlInlineScript[];
  readonly declarations: readonly GlobalDeclaration[];
  readonly diagnostics: readonly Diagnostic[];
}
export function analyzeXml(
  content: string, sourcePath: string, options: XmlAnalysisOptions
): XmlAnalysisResult;
```

Every array preserves source order independently. declarationIndex references this result's declaration occurrence; repeated names remain separate. References and bodies retain their parent element index from the syntax projection. The source path is copied byte-for-byte as the supplied JS string; positions remain zero-based UTF-16 with exclusive ends. A frame declaration's source is the original name-value range, including an entity's complete raw spelling when appropriate.

For an inline body, join only the matching element's **direct-child** XmlText values, in original order. Both text and CDATA participate. Comments/PIs contribute no characters; no whitespace is invented across gaps. Preserve existing literal/normalized/entity mappings, shifting decoded intervals by the joined prefix length. body.source encloses the original element content between opening and closing markup, including intervening delimiters/comments; mappings identify the actual contributing spans. For a self-closing/empty element it is zero-width at the end of opening markup. source is the complete element. Do not merge across a raw gap. This can intentionally join `Ab<!--gap-->cd` to `Abcd`; it records XML-decoded body text, without asserting how a game loader evaluates it.

Example authored root policy uses null-namespace Ui / Frame / Include / Script / Scripts / OnLoad. For `<Ui><Script>A&amp;B<![CDATA[\r\nC]]><!--gap-->D</Script></Ui>`, decoded body is `A&B\nCD`. Independent expected UTF-16 map intervals are:

| Decoded interval | Original interval | Kind |
| --- | --- | --- |
| [0,1) | [12,13) (`A`) | literal |
| [1,2) | [13,18) (`&amp;`) | entity |
| [2,3) | [18,19) (`B`) | literal |
| [3,4) | [28,30) (CRLF) | normalized |
| [4,5) | [30,31) (`C`) | literal |
| [5,6) | [44,45) (`D`) | literal |

Here the code fence spells CRLF as `\r\n`; the test fixture will contain the two actual UTF-16 control units. Numeric/astral entities, BOM and mixed source lines require additional independent golden cases. Downstream inline-Lua mapping will map each intersecting nonliteral span whole and preserve disjoint raw spans rather than pretending every token has one equal-width raw range. That downstream API remains a separate decision: SourceReference alone cannot encode every disjoint origin.

Fixed resource proposal: retain XML syntax budgets unchanged; at most 50,000 provider output records total, counting each frame/reference/script/declaration/condition/mapping record **and every copied condition value cell, including empty strings**. Consumed options have a separate 50,000-entry cap counting selectors, conditions and value cells; at most 256 conditions and at most 1,024 values per condition, with array lengths checked before traversal/copying. Also bound consumed option strings (selector fields, addonId and condition projections) to 1 Mi cumulative UTF-16 units before output copying. The at-most-768 policy selectors are validated separately before parsing. Oversize options fail XUI0003, invalid shapes XUI0001. Copied sources/positions contribute fixed bounded structure to their owning counted records. Enforce limits during projection, not after allocating the full result. Existing worker heap/deadline/output limits remain fixed supervision, not a sandbox.

Inherited conditions use the existing documented projection: nonempty providerId/name/source.file, string raw/values, dense bounded values, safe nonnegative integer source positions with start <= end. Validate/copy only the documented fields; never spread caller records or retain caller arrays/sources. The addonId must be nonempty. Native getters can throw; input-projection exceptions return fixed XUI0001 with no output. Resource-limit and invalid-shape failures are tested independently, including arrays of empty strings.

## D — Dependency-ordered implementation and measurable evidence

| Step / delivery | Write surface | Dependencies and acceptance |
| --- | --- | --- |
| 1. Record decision | This proposal; #11 | Explicit approval of A–D is required. Do not treat its PR, corpus data or this table as approval. |
| 2. Add failing authored contracts | tests/contracts/xml-analysis.ts, tests/xml-analysis.test.mjs | The eight exports are missing for the intended reason; verify readonly fields, imported public types and literal unions. No installed-source fixtures. |
| 3. Add optional package and graph | packages/xml-analysis/{package.json,tsconfig.json,api-extractor.json,LICENSE,src/index.ts}; shared workspace versions/lock/references | Only the three approved internal edges, no new external record; all original seven APIs unchanged. Version and beta-count assertions must reject mismatches. |
| 4. Validate policy and extract facts | New package implementation and authored tests | Exact expanded-name matching, structural rules, no default widget inference, duplicates/source ordering, empty/malformed options and complete recovery after every failure. |
| 5. Join mapped bodies | Same package; independent golden fixtures | Example above, comment/PI gaps, empty/self-closing, mixed text/CDATA, CR/LF/CRLF, predefined/numeric/astral entities, original BOM/UTF-16 paths. Output can be mapped/serialized deterministically without mutating inputs. No Lua syntax count is credited. |
| 6. Prove safe failures and bounds | Unit tests and isolated worker/CLI fixtures | Resource boundaries, malformed syntax/backend projection, inherited conditions and ownership isolation; bad recognized constructs retain independent facts with complete=false. No filesystem/network/process imports in package. |
| 7. Extend gates and docs | architecture/dependency/API/export/package gate scripts, baselines/reports, migration/changelog/public surface | 73 reviewed beta exports, eight exact package payloads/licenses, original 65 exports preserved; negative edge/payload/API regressions. No graph waiver. |
| 8. Add opt-in corpus adapter | scripts/xml-analysis-worker.mjs, xml-worker-client.mjs, inspect-addon-corpus.mjs; tests/xml-corpus.test.mjs | Explicit `--xml-provider-profile <local-json>` requires `--xml-analysis`; no default profile or path discovery. Validate same policy and worker result before atomic credit. Existing parser-only behavior unchanged. |
| 9. Execute supported acceptance | Fresh local gates; exact-head Windows/Ubuntu × Node 22/24 CI; focused PR | check:all, strict API Extractor and actual npm package contents pass; review and fix findings. Present final exact reviewed head for its separate merge decision. |
| 10. Execute actual provider corpus | Read-only selected directory, caller-selected local profile; aggregate evidence only | Discovered/eligible/attempted/completed/validated/blocked/skipped counts; frame/declaration/reference/body facts and diagnostics by code; mapping/range/serialization checks; before/after hashes. Do not publish profile data that reveals installed names/paths. Remain failed/incomplete when required evidence is absent. |

The new xmlProvider report must separately count requested, discoveryComplete, attempted, submitted, completed, validated, projectionComplete, projectionIncomplete, readFailures, backendFailures, invariantFailures, resourceRejected, skippedOversized, frameCandidates, declarations, references, inlineChunks and inlineHandlers, plus diagnosticsByCode and checked map/source totals. requested is a boolean; all *counts* are per file except explicitly named fact/map/diagnostic totals. Syntax parsed.xml retains its syntax-verdict meaning and is not incremented again by provider projection. Source-invariant failure credits no provider verdict/fact/diagnostic metrics. A syntax-rejected file is accounted as rejectedBeforeProjection, a distinct per-file counter, not a provider backend failure or a provider verdict. The report must reconcile discovery = syntax-rejected + provider-validated + blocked/skipped for an otherwise fully traversed requested run; false completeness remains explicit on preflight/discovery failures. Refine exact JSON naming in a test-reviewed tooling plan without changing these accounting meanings.

Required authored matrix, with actual values calculated independently:

1. One literal frame, repeated names, non-ASCII/string-key names and name entities: exact occurrence/declaration indices and unknown activation.
2. virtual absent/false/true/invalid, empty name, `$parent` at multiple nesting levels, inherited templates: retained raw facts with no fabricated resolved names.
3. Prefix aliases with the same URI match; a wrong/default/no namespace differs; namespaced name/file attributes do not become unqualified ones.
4. Ui roots, foreign roots, disjoint/duplicate/oversize/empty policies and structural Script/Include/handler lookalikes.
5. Missing/empty file, separators, `..`, absolute/URL/variable targets, repeated edges and cycles: preserve only, never read/resolve or treat as active.
6. Inline chunks vs handlers, empty bodies, file-plus-body/nested elements, comments/PIs and adjacent text/CDATA. In particular, `<Script>A<Unexpected/>B</Script>` yields XUI0004 and no body, never a fabricated complete `AB` chunk.
7. Independent decoded/raw golden spans, disjoint contributions, entity astral halves and normalized line breaks; exact JSON roundtrip.
8. Caller conditions, deep-copy isolation, two frozen inputs analyzed concurrently and valid calls after each failed/resource call.
9. Invalid worker outputs, two failed projections, blocked reads/resources and no metric prefix credit or private-message leakage.
10. Real XML + TOC + Lua synthetic composition retains all unknown candidates and contributes no globals from a nonselected TOC association. Selection does not turn unknown XML candidates into active globals.

## Decisions still outside this increment

- Handler-aware Lua entry point: verified implicit locals/parameters/varargs, real handler syntax, no wrapper offset leakage, mapping disjoint decoded token/diagnostic origins and dynamic-context incompleteness. Do not run handler text through the standalone chunk API and claim it is covered.
- A selected-TOC, opt-in read-only filesystem adapter: association, ordering, roots, separators/case, variables, escapes, links, missing targets, cycles, bounded reads and graph-derived conditions/activation. File facts here are not reachable/loaded files.
- A documented Classic Era vocabulary/profile and any built-in game semantics need primary evidence and an explicit decision. A local caller profile is an assumption selected by that caller, not a certified default.
- Full all-provider/environment acceptance and diagnostic triage remain #11 / #10 work. All-syntax verdicts, a provider fact count, source 0.6.0 or green synthetic CI do not complete that goal.

Approval requested: **A** optional xml-analysis boundary/version/surface; **B** explicit-policy candidate/unknown semantics; **C** exact mapped-body API/limits; **D** phased implementation and opt-in corpus acceptance. A–D approval would authorize implementation within this scope, while the separate merge/release and remaining handler/graph decisions above remain explicit.

## Proposal review, 2026-11-17

Independent bounded read-only review found two design gaps: arrays of empty condition values escaped the string-unit budget, and nested elements in file-less Script bodies had no explicit failure rule. Both are corrected above and in the required authored cases; a follow-up source review found no remaining concrete blocker. This is static proposal review, not implementation/runtime acceptance.

The parent compiled the fenced declarations as an in-memory .d.ts using TypeScript `createProgram` with strict NodeNext resolution against existing installed SDK types: exit 0, exactly eight exports, no emitted files. An independent string-slice calculation verifies all six golden raw offsets above, exit 0. `git diff --check` passes. No new package, parser/provider implementation, installed-corpus run, third-party install or native PowerShell change is made by this documentation increment. The implementation/CI/corpus acceptance rows remain future work after explicit A–D approval.
