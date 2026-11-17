# Proposed XML syntax increment

Status: **approved by the user on 2026-11-17** ("Godkendt" in the active chat), recorded in [issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6947486320). This document preserves A–F from [the original proposal](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6923154054); the implementation and fresh acceptance evidence are tracked in [the XML review](REVIEW-XML-v0.5.0.md). Existing Lua approvals remain valid.

Historical starting point before approval: main `1bb97e11d0a70da538b438279cb227bbc99da877`, source 0.4.1, six packages, 56 beta exports and 221 tests. PR #23 and post-merge CI 43938710029 pass all four supported jobs. XML SDK parsing remains absent. In the historical proposal below, references to remaining Lua blocks describe the earlier bounded-profile baseline; the approved opt-in Lua profile now yields all 5,242 verdicts with one explained syntax rejection and no encoding/resource blocks.

## Next contract proposal: XML syntax + exact decoded-source provenance (A–F)

**A–F approved; the optional XML syntax package is implemented on the review branch.** This is the next parsing increment after reviewed Lua integration, not completion of the full provider/reference-graph goal. It introduces a new package/dialect/source-map contract, so the goal's explicit contract-decision gate applies. Existing Lua A–E remains approved; the current user instructions require separate merge authorization.

### A — Optional package and audited backend

Add `@wow-addon/xml-parser`, depending on diagnostics and exact `saxes@6.0.0` + `xmlchars@2.2.0` only. The latter is pinned directly as well as in the lockfile; saxes declares ^2.2.0. No existing core/Lua runtime gains a new dependency or reverse edge. Root-only exports, original beta status and reviewed reports remain mandatory. Source milestone v0.5.0; workspace versions/internal ranges advance together while unrelated third-party resolutions remain exact.

The maintainer's [repository](https://github.com/lddubeau/saxes) is archived (2025-12-31). This is an explicit maintained-by-SDK boundary: no assumption of future upstream fixes. Its [v6 source](https://github.com/lddubeau/saxes/tree/211fa0ebec9b628affc09219199639887174bfc3) documents XML/namespace support and does not fetch DTDs or define custom entities automatically. These are candidate properties, not yet demonstrated SDK behavior.

Actual npm artifacts were downloaded with scripts disabled, without installing them into the SDK or executing them:
- saxes integrity `sha512-xAg7SOnEhrm5zI3puOOKyy1OMcMlIJZYNJY7xLBwSze0UjhPLnWfj2GF2EpT0jmzaJKIWKHLsaSSajf35bcYnA==`; saxes.js SHA-256 `d00e2ba27ed7d6ac961d03ff14d6b8c0eb5bf063ed2c996c22c6df06ac121423`.
- xmlchars integrity `sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw==`; its retained MIT LICENSE SHA-256 `45d196313c2647d313cc65ca9b093d2d6974b64d35ee7346f2c60c9d518dff2c`.
- **Packaging defect:** the saxes tarball omits LICENSE. Retain the complete pinned upstream [license/attribution file](https://raw.githubusercontent.com/lddubeau/saxes/211fa0ebec9b628affc09219199639887174bfc3/LICENSE), including both ISC notices and the historical notice, byte-for-byte in the SDK extension's third-party notices and exact pack gate. SHA-256 `0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e`. Keep xmlchars' original MIT notice too. No vendoring, upstream byte patch or claim of vulnerability-database clearance.

Characterize the candidate against every authored XML vector before implementation; stop and report if it cannot meet this contract rather than substituting a different backend silently.

### B — Explicit grammar and failure policy

Parse strings as **XML 1.0 fifth edition**; default additionally enforces **Namespaces 1.0 third edition**. `namespaceAware:false` requests XML well-formedness without namespace constraints, allowing the existing fixture axes to remain distinct. Reject an XML 1.1 declaration instead of silently accepting/ignoring the selected version. Whole documents require one root; this increment does not enable fragments, XSD validation or WoW UI schema/loader semantics.

Reject actual DOCTYPE declarations before custom expansion or any external resolution. DOCTYPE-looking text inside comments, CDATA and processing instructions is not a declaration. Only standard predefined/numeric references are decoded. No resolver/entity callback, URL/file fetch, source execution or DTD-derived default attributes. Do not interpret an XML encoding declaration as authority to re-decode an already supplied JS string.

Syntax, namespace, profile, invalid-input, backend or resource failure returns `complete:false`, fixed source-associated diagnostics and empty element/text projections. Recovery is fail-closed per document; a subsequent valid document must parse independently. No valid-prefix tree is silently presented as complete. These profile failures remain distinct from the generic XML-oracle expectations.

### C — Nine named beta exports, no backend objects

Approved root surface (all fields readonly; zero-based UTF-16, end-exclusive SourceReference):
1. `XmlParseOptions`: optional boolean namespaceAware, default true.
2. `XmlName`: qualifiedName, localName, prefix (string|null), namespaceUri (string|null). In non-namespace mode localName is the full qualified name, prefix/URI null; namespace mode distinguishes unprefixed attributes from default-namespaced elements.
3. `XmlMappedSpan`: decodedStart, decodedEnd, kind (literal|normalized|entity), original source.
4. `XmlValue`: decoded value, enclosing original value source, ordered mapping spans.
5. `XmlAttribute`: name, nameSource, value, complete attribute source.
6. `XmlElement`: name, nameSource, source, openSource, closeSource (null for self-closing), parentIndex (null for root), ordered attributes.
7. `XmlText`: parentIndex, kind (text|cdata), mapped value.
8. `XmlParseResult`: schemaVersion 1, complete, ordered flat elements/text, diagnostics.
9. `parseXml(content, sourcePath, options?)`.

Elements are preorder; parentIndex references an earlier element. Text is original source order. Each call owns independent nested arrays/names/mappings/source records; no backend AST, mutable parser instance or caller extra properties escape. Complete means this syntax/profile/projection only, not frame creation, execution or reachability. Existing metadata/environment/registry schemas stay 2/1/1.

### D — Original text and decoded-source mapping

Keep original BOM, CR/LF/CRLF and UTF-16 columns for every public range. XML-required line-ending/attribute normalization and entity decoding occur only in decoded values. Attribute value sources exclude quotes; CDATA value sources exclude delimiters. Comments/PIs do not become Lua text.

Mapping spans cover decoded values in order: literal spans map by equal-width offset; normalized/entity spans map any overlapping decoded selection to the complete original raw span. Thus &#x1F9EA; maps a decoded two-unit astral value back to the nine-unit raw entity, and CRLF normalization maps one decoded LF to both original units. Coalesce literal runs; never conflate raw range length with decoded string length. This supplies provenance needed by the later inline-Lua provider without executing or inventing a WoW handler environment.

### E — Bounded API and actual-corpus tooling

Fixed initial profile: 1 Mi UTF-16 input units checked before indexing, at most 50,000 emitted element/attribute/text/mapping records in total, nesting depth 256, decoded total at most 2 Mi units. Resource failures expose no prefix projection. Corpus workers have a fixed executable/no shell, 256 MiB old-generation heap, ten-second deadline, 32 MiB protocol output cap and deterministic cleanup. These are supervision controls, not an adversarial JS sandbox.

Metadata-only measurement of the current XML corpus: **1,199 files, 1,541,465 bytes total, largest 49,532 bytes**. This does not prove syntax/decoded size/depth budgets suffice. The actual run must attempt every file, strictly decode UTF-8 with BOM retained, preserve original files and report all parse verdicts, codec/budget/worker failures, source invariants and diagnostics. Never relabel blocked files as successfully parsed or count inventory as parsing. Existing TOC errors and Lua blocks remain; --require-all-parsers cannot pass until full coverage/diagnostic acceptance is demonstrated.

### F — Ordered implementation/acceptance

1. Verify artifact manifests/notices/hashes and characterize all 27 XML vectors without touching SDK dependencies or game input.
2. Add failing public-contract tests for the nine exports plus all XML catalog rows/three XML golden spans; retain well-formedness/namespace/profile axes.
3. Implement bounded strict parse + original range projection; test BOM, mixed endings, Unicode names, duplicate/expanded attributes, malformed tags/comments, XML version, DTD policy and no external IO.
4. Add independently calculated decoded/source maps for entities, astral values, CDATA, mixed text, attribute whitespace and comments/PIs; preserve all original spans.
5. Test document/input isolation, deterministic recovery after errors/resources, prototype-owned options, output ownership and worker deadline/crash/protocol cleanup.
6. Extend architecture/API/export/hash/notice/exact package gates for only this approved optional boundary; preserve old core/Lua APIs and pins.
7. Run actual read-only XML analysis against all 1,199 inputs, reconcile counts and classify every failure privately; commit only authored fixtures and aggregate evidence.
8. Require full local gates, exact-head Ubuntu/Windows × Node 22/24 CI and review, fix findings, then present the exact reviewed head for separate merge authorization.
9. Continue XML frame/Script/Include projection, decoded inline Lua, selected-TOC reference graph and all-provider resolution as explicit remaining #11 work. Do not close #11 or the overall goal on syntax alone.

Primary specifications checked 2026-11-16: [XML 1.0 fifth edition](https://www.w3.org/TR/REC-xml/) and [Namespaces 1.0 third edition](https://www.w3.org/TR/xml-names/). Grammar standard, chosen restricted profile, candidate documentation and actual SDK/corpus evidence remain separate.

## Approved implementation sequence

The following file-level plan elaborates the original F sequence without changing the approved public semantics. Proposed file names are implementation organization, not new package-root exports. Build the syntax/mapping increment before provider or filesystem traversal code. Do not substitute a source scan or inventory for parsing.

| Order / deliverable | Proposed write surface | Dependency and acceptance evidence |
| --- | --- | --- |
| 1. Record the user's A–F decision | This document, issue #11 and the existing decision record | Completed: real user approval is recorded above. Candidate results, goal continuations and green Lua CI were not used as authorization. |
| 2. Characterize the already pinned candidate | Authored XML catalog and private candidate harness only | Existing candidate evidence covers all 27 vectors and all 1,199 installed inputs, but does not prove SDK projection/ranges. Revalidate exact artifact/notices against A before any approved install. Stop on an unmet binding requirement. |
| 3. Demonstrate missing public behavior | `tests/xml-parser.test.mjs`, `tests/contracts/xml-parser.ts` | Nine missing exports/type options fail for the intended absence. Exercise the existing 27 XML catalog rows, three XML golden raw spans, default namespace rules and explicit namespaceAware:false separately from DTD profile rejection. No installed snippets. |
| 4. Add only the approved optional package | `packages/xml-parser/package.json`, `tsconfig.json`, `api-extractor.json`, package LICENSE; root build references/manifests/lock | Pin the two approved external versions and license bytes; preserve every unrelated lock record and original six package edges. Keep backend/parser helpers private. No filesystem, process, editor or network import inside the SDK. |
| 5. Project strict syntax into independent public records | `packages/xml-parser/src/index.ts` and private syntax/range helpers | Validate consumed input projections, snapshot namespaceAware once, bind all returned records to the exact supplied path, and produce ordered elements/text. Every failure empties both projection arrays. A valid call after each error/resource failure must match a fresh independent call. |
| 6. Map decoded values to original text | Private mapping helper plus authored mapping cases | Calculate expected maps independently for astral entities, predefined/numeric references, mixed CR/LF/CRLF, attribute whitespace and CDATA. Literal spans use equal-width offsets; entity/normalized overlaps return whole original spans. Check coverage/order, parent indices, bounds and JSON roundtrip. Comments/PIs do not become inline Lua. |
| 7. Enforce no-prefix resource/profile failures | XML parser tests and private helpers | Exercise exact input cap and over-cap rejection before indexing, total record/decoded limits, depth boundary, XML 1.1 rejection and actual DTD declaration rejection. Test DOCTYPE-like comments/CDATA/PIs as text rather than declarations. No external resolution or custom entity expansion. |
| 8. Supervise actual XML corpus calls | New XML worker/client tooling; `scripts/inspect-addon-corpus.mjs`, `tests/xml-worker.test.mjs`, existing corpus tests | Fixed 256 MiB / ten-second / 32 MiB preset, bounded reads and strict UTF-8; no source-selected executable/path/budget. Test real parser reuse, timeout/crash/protocol/output failures, worker close/reap and immutable input. Preserve current default Lua/TOC report behavior. |
| 9. Extend gates narrowly | `.dependency-cruiser.cjs`, architecture/API/export/package scripts, API baseline/report, gate regression tests | Preserve the original 56 beta exports. Only after approval add the proposed nine (65 total: 14 runtime, 51 type-only). Reject forbidden package/import edges, wrong pins/notices, extra tarball files and missing expected files. Review the actual proposed packlist before accepting it. |
| 10. Verify and integrate the syntax increment | Migration/diagnostic/architecture docs, #11, focused PR | Focused regressions, complete local gates and all four exact-head supported CI jobs; review findings fixed before integration. Attribute candidate, SDK, full-run and affected-run evidence to their actual snapshots. No tag/npm release. |

The current fixture catalog stores XML well-formedness, namespace well-formedness and profile permission independently. A DTD case can be well formed in the general oracle and still correctly fail this restricted SDK profile. The candidate observed one multiple-root rejection in base mode and an additional 52 unbound-prefix rejections in namespace mode. Those measurements guide private classification; they are not a fixed allowlist, future SDK success criterion, permission to disable namespace checking silently or evidence that the game loads/rejects those files.

The actual SDK corpus pass must account for every eligible XML input as an accept, reject or explicit codec/resource/worker/read/backend block. Keep parsed verdicts distinct from blocked inputs and retain a failed/incomplete exit whenever acceptance is missing. In particular, syntax acceptance alone does not resolve Lua dynamic projections, existing TOC errors, XML frames/templates/handlers, selected-source traversal or all-provider resolution. Those remain later steps 8.5–8.8 in the [overall execution plan](EXECUTION-v0.3.5.md).

## Evidence already available; not XML SDK acceptance

- [Authored candidate characterization](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6923429559): all 27 catalog vectors on separate axes. Namespace metadata is incomplete at the candidate's early attribute event and must be projected only after the completed opening-tag event. The forced XML 1.0 option alone does not reject an XML 1.1 declaration; the SDK needs its explicit profile check.
- [Read-only candidate corpus preflight](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6923576417): all 1,199 files, no codec/read/budget/process failures, and matching hashes on reanalysis. Candidate-only execution used the local Node 26 runtime; supported SDK Node 22/24 behavior and decoded-source mapping remain unverified until implementation.
- Historical source `1bb97e1` had no xml-parser package or exports. The proposed surface, dependency pins, worker preset, API reports and package-content expectations in this document were not installed or validated at that historical baseline; see the current review for implemented acceptance.
