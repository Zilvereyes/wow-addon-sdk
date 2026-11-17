# Migration from v0.4 to v0.5

v0.5.0 is an unpublished source milestone implementing XML A–F, approved by the user on 2026-11-17 ([#11 decision](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6947486320), [#6 coordination](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6947485801)). The five core packages and Lua extension preserve existing contracts, source identity, duplicate origins, beta status and schemas. All seven workspace versions/internal ranges advance together. Release readiness, local corpus acceptance and CI at a particular commit require their own recorded evidence.

The new optional `@wow-addon/xml-parser` depends only on SDK diagnostics and exact `saxes@6.0.0` / `xmlchars@2.2.0`. Existing packages gain no dependency. Nine new beta exports bring the source surface to 65 (14 runtime functions/values and 51 types); all 56 previous exports remain. Backend objects are private.

```typescript
import { parseXml } from '@wow-addon/xml-parser';

const result = parseXml(
  '<Ui xmlns="urn:authored"><Frame name="Demo&amp;More">Hello&#33;</Frame></Ui>',
  'Example/Frames.xml'
);
if (result.complete) {
  console.log(result.elements[1].attributes[0].value.value); // Demo&More
  console.log(result.text[0].value.value); // Hello!
}
```

The grammar is an XML 1.0 fifth-edition document with namespace constraints enabled by default. The only public option is readonly `namespaceAware?: boolean`; explicit `false` disables namespace enforcement for direct callers and retains qualified spelling as the local name with null prefix/namespace. This choice does not establish a WoW loader dialect. DTDs and XML 1.1 are rejected. Parsing never executes embedded Lua/XML, fetches external entities or follows included files. Only XML syntax, names, attributes and text are projected; there is no schema or FrameXML interpretation.

`XmlParseResult` has independent `schemaVersion: 1`, `complete`, `elements`, `text` and `diagnostics`. Elements form a flat preorder list with `parentIndex`, original name/open/whole ranges and nullable `closeSource` for self-closing elements. Attribute order and text order retain original source order. Text distinguishes ordinary text from CDATA; comments and processing instructions are accepted syntax without public projection. All records are owned per call and typed readonly; no runtime freeze is installed.

Names preserve original qualified spelling plus local/prefix/namespace data. Attribute and text `XmlValue` records contain a decoded string, original source and ordered `XmlMappedSpan[]`. Every mapping covers an end-exclusive interval in decoded UTF-16 units and an original source span. Literal spans map by equal-width offset; entity or normalization overlaps map to their whole original span. Predefined/numeric entities decode, CRLF/CR text line endings normalize to LF, and literal attribute whitespace normalizes to spaces. Numeric character references retain their decoded character rather than undergoing literal whitespace normalization. CDATA does not expand entity-looking text, and its value source excludes the delimiters. Attribute value sources exclude quotes while attribute sources include them.

Original paths are preserved exactly. All source positions remain zero-based UTF-16 line/column pairs with exclusive ends. A leading BOM remains part of original coordinates; astral characters occupy two units. CRLF is one line break, and diagnostic points inside it anchor at CR. Shared metadata schema 2, environment schema 1 and resolved-view schema 1 do not change.

Every failure empties both projections, including any previously valid prefix. All five fixed error codes have severity error: `XML0001` invalid input, `XML0002` syntax/namespace rejection, `XML0003` resource limit, `XML0004` forbidden DTD/version profile and `XML0005` backend/projection failure. Messages never copy source/backend errors. Invalid API paths use an empty diagnostic file rather than inventing a filename. See [diagnostic codes](DIAGNOSTIC-CODES.md).

The public API has fixed limits: 1 Mi UTF-16 input units before indexing, 50,000 combined element/attribute/text/mapping records, element depth 256 and 2 Mi aggregate decoded UTF-16 units. Callers cannot raise these budgets. Direct SDK callers own process, heap, stack and deadline supervision; passing JavaScript objects with native getters is caller code rather than sandboxed input. Only the documented own option is consumed, once.

The local read-only runner adds explicit XML opt-in:

```powershell
npm run test:corpus -- '<local-AddOns-directory>' --lua-analysis --xml-analysis
```

XML transport is strict UTF-8 with BOM retained; no byte-preserving fallback or namespace-disable flag exists. Reads are bounded to 4 Mi bytes and the caller's generic byte cap, then to the SDK UTF-16 cap. A separate supervised child uses a 256 MiB old-space setting, a 10-second request deadline and a 32 MiB output cap. The runner verifies JSON round trips, original source ranges/raw slices, decoded mapping coverage and before/after SHA-256 equality without publishing source hashes or private paths.

The aggregate XML report separates discovered, attempted, submitted and completed work; accepted/rejected verdicts; profile/resource/encoding rejections; read/worker/backend/invariant failures; checked source/mapping counts; and integrity matching/changed/read-failure counts. `profileRejected` is a subset of `rejected`. Syntax and profile rejections count as actually parsed files but fail the corpus check. Encoding/read/worker/backend/resource/invariant failures are incomplete blocked coverage and never stand in for parsing. `unimplementedParsers` is now empty; disabled syntax parsers appear in `disabledParsers`, including XML unless explicitly enabled. This changes the earlier v0.4 corpus-report classification of XML as unimplemented.

The XML global-declaration provider and loader reference graph remain unimplemented. `resolvedProviderParticipation=false`, `fullParsing=false` and explicit `missingFullParsingCapabilities` retain that boundary. Even with all three syntax parsers enabled, `--require-all-parsers` fails with `missing-full-parsing-capabilities`; opt-in flags cannot waive the remaining project goal. No XML file count or source version establishes selected-file reachability, runtime availability or full three-language acceptance. Exact commit/job evidence belongs in dated project records.

The retained third-party notices and exact source/license pins are documented in [licensing](LICENSING-AND-THIRD-PARTY.md). New parser API and dependency boundaries require reviewed source audits, snapshots, strict API Extractor, package contents and the supported Windows/Ubuntu × Node 22/24 CI. Historical green runs are not acceptance evidence for this new source milestone. Tags, package publication and merge remain separate authorized actions.
