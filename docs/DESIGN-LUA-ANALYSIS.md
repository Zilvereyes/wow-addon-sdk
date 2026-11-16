# Lua analysis: approved A–E implementation

The user explicitly approved [proposal A–E](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6920153516) in [decision 6920213019](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6920213019). The v0.3 design record is closed as delivered; this implementation and real-corpus evidence continue in #11. Do not request this approval again. Source milestone: v0.4.0 preview, following the verified five-package v0.3.5 core at `0cee5c9`.

## Boundary and public surface

Add one optional package, `@wow-addon/lua-analysis`, with separate internal syntax and lexical-provider modules. It imports diagnostics, global-registry and exactly luaparse 0.3.1. It has no metadata/parser/TOC-adapter dependency, filesystem access, networking, editor integration or Lua execution. The original five core packages gain no third-party runtime dependency or changed import direction. An external caller associates provider results with exact selected TOC variants through the existing ProviderDeclarationSet contract.

Three beta exports bring the total to 55 (13 runtime values/functions, 42 type-only contracts):

| Export | Contract |
| --- | --- |
| LuaAnalysisOptions | Exact nonempty caller addonId, optional readonly inherited ConditionDescriptor array |
| LuaAnalysisResult | Literal schema 1, complete, readonly declarations and diagnostics; no backend AST |
| analyzeLua | Analyze original text/path/options without input execution |

Metadata/environment/resolved-registry schemas remain 2/1/1. All workspace source versions/internal ranges advance together to 0.4.0; existing third-party resolutions remain exact and one approved backend is added. All existing exports remain beta. The internal syntax module has implementation declarations, but is not exposed by the package's root-only exports map or API report.

## Syntax and source profile

- Explicit Lua 5.1, ASCII identifiers, lexical scopes, original ranges and uninterpreted string values (`encodingMode=none`). No inferred Blizzard extensions or LuaJIT/later-language features.
- One leading BOM is accepted with an offset map; original CR, LF, CRLF and UTF-16 columns remain intact. A second/interior BOM is subject to grammar rejection. Shebang preprocessing inherited from the backend is explicitly rejected by this profile.
- Every backend AST node's range must be inside the original body; its BOM prefix is added when producing public sources. Diagnostic locations are zero-width points in original text, including EOF. A point inside CRLF is anchored at the start of that line break.
- The public function accepts strings. File decoding belongs to tooling: strict UTF-8, retaining BOM, without replacement decoding or legacy-encoding guesses. This is an explicit input profile, not a claim about all Classic Era source encodings.
- Invalid options/source/text, invalid syntax or resource/backend failure returns complete=false and no declarations. Invalid caller arguments with no usable source path retain an empty file string at the start-of-input diagnostic; no substitute filename is invented.

The actual corpus exposed two pinned-backend defects within the approved Lua 5.1 grammar. The [manual grammar](https://www.lua.org/manual/5.1/manual.html#8) permits one optional semicolon after terminal break; the [reference parser](https://www.lua.org/source/5.1/lparser.c.html) consumes it and compares function-call ambiguity against the preceding token's ending line. The backend misses the former and uses a multiline string token's starting line for the latter. A lexical prepass replaces only the optional break semicolon and internal string line-break/escape units needed for a same-line following call with equal-width spaces in a parse-only copy. It never erases real inter-token newlines, relaxes terminal statements, treats literal/comment text as code or changes original data. Literal values and backend locations are private/unused; public sources derive from original offsets/text. This fixes supported grammar without vendoring, changing upstream hashes or enabling a later Lua dialect.

The prepass finishes an empty backend parse before resetting its cursor for the current input. This initializes token/lookahead state that the standalone lexer otherwise retains between calls. Lexical exceptions retain an in-range current-input offset; when a backend error instead references its stale parser token, the diagnostic anchors at the current unread span after whitespace. Fresh-process and call-order tests require identical classifications/source points. Error messages never expose backend text.

## Lexical provider semantics

Recognize non-local identifier targets of assignments and plain global function declarations. Preserve each occurrence in lexical source order. Do not create declarations from reads, locals, parameters, loop variables, local function names, table constructor keys, member/index writes or method declarations. A later local does not erase an earlier global occurrence.

Scope annotations are recomputed from the bounded AST in source order. Lua 5.1 loop variables enter scope in the body, after numeric bounds/step or generic iterator expressions; the pinned backend incorrectly includes those expressions in their scope. Initializers see earlier bindings, recursive local functions see their own binding, method bodies have local self, branch scopes remain separate and repeat-body locals remain visible in its condition. Inherited options.conditions is validated before use just like an own property.

Output kind is lua-global, with no invented SavedVariable scope. A TOC SavedVariable and a Lua assignment to the same name remain two independent declarations with distinct source/provider origins. The caller supplies addonId; the environment resolver may later copy it under a logical AddOn ID while retaining originalAddonId.

Direct chunk bindings have static unconditional activation, or conditional when inherited restrictions exist. Bindings under other flow/block/function contexts stay unknown. These flags describe the supported lexical projection and assumed file association; they do not prove runtime execution, value, initialization success or persistence. Ordinary calls are not executed or modeled as a whole-program mutation graph.

References to non-local `_G`, getfenv, setfenv, load, loadstring, dofile or require identify unsupported dynamic environment/code access. They make this file's projection incomplete and all supported returned bindings unknown. Local shadowing of these names is respected. This is deliberately conservative, including environment references/aliases; it does not claim to detect every possible environment mutation through arbitrary external calls.

Inherited descriptors retain provider/name/value order/raw/source without interpretation. Every output declaration, descriptor, values array, source, range and position is copied independently from inputs, siblings and other calls. Unknown extra input fields are not copied. TypeScript readonly does not freeze output at runtime; supplied native getters remain caller code.

`complete` means syntax plus this supported lexical projection. A supported control-flow assignment can have unknown static activation while analysis complete remains true. An environment resolver still treats that availability as unknown/incomplete. Unsupported dynamic access makes analysis complete false; syntax/resource errors expose no accepted prefix declarations.

## Resource and process boundaries

The pure API rejects text above 1 Mi UTF-16 code units before building a line index or invoking the backend. It limits construction to 50,000 nodes and accepted AST depth to 256, handles parser stack exhaustion and validates ASTs iteratively before the bounded scope walk. It does not provide a hard CPU/memory sandbox. Caller-owned path/metadata objects and a trusted JavaScript process remain outside that guarantee.

The opt-in corpus runner uses one persistent trusted Node child: 128 MiB old-generation heap, 1 MiB stack, ten seconds per request, 32 MiB output bound and exact request IDs. Timeout, crash, malformed protocol and unavailable backend remain explicit failures; a failed child is replaced for the next independent file. Children are reaped on completion. No input controls the executable, worker path, process flags or cadence. NODE_OPTIONS/test-context/coverage environment hooks are omitted from the child. These controls supervise the parser; they are not an adversarial JavaScript security sandbox.

Local files are read only after directory/profile validation. Lua reads are bounded by the generic byte limit and a fixed 4 MiB pre-read ceiling implied by the 1 Mi-code-unit UTF-8 profile; decoded length is checked again before submitting to a worker. Fresh file type/size/mtime checks detect ordinary concurrent changes. This is a stable local-tree workflow, not a hostile filesystem race boundary.

## Corpus accounting and privacy

`--lua-analysis` explicitly enables the available Lua parser/provider. Default TOC mode reports Lua as disabled, XML as unimplemented and zero parsed Lua files. `fullParsing` remains false and `--require-all-parsers` still fails while XML is unavailable.

The Lua report separates considered/submitted/completed requests, accepted/rejected syntax, unsupported projections, encoding/input/resource/worker/read/backend failures, declaration activation, source-reference visits and byte counts. `parsed.lua` counts completed syntax verdicts, including syntax rejection; it excludes encoding/resource/backend/worker failures. These exclusions remain visible failed/incomplete coverage, not silent eligibility waivers.

Output contains aggregate counts/code histograms only. No installed source, AST, global names, file paths or profile values are published. Existing TOC diagnostics/failures remain. The optional composed resolution profile still receives TOC metadata only: `resolvedProviderParticipation=false` explicitly separates independent Lua analysis from real filesystem graph/selected-source reachability, which remains future work.

## Dependency, license and distribution evidence

The actual npm luaparse 0.3.1 tarball was downloaded with scripts disabled before installation. Its manifest declares MIT, no runtime dependencies and test/version scripts only. Tarball integrity is `sha512-b21h2bFEbtGXmVqguHogbyrMAA0wOHyp9u/rx+w6Yc9pW1t9YjhGUsp87lYcp7pFRqSWN/PhFkrdIqKEUzRjjQ==`.

Its parser SHA-256 is `1c70940a6e46be63c84c285036925715f110bf06cbf058922372fb5c9d060b27`; LICENSE SHA-256 is `bedf97319fd3fb51c22dc5a44daf603ca4b2515ae75cae8ac677fb6bd40ec34e`. Both exactly match the previously characterized pinned upstream bytes. The installed-artifact gate checks name/version/license, absence of runtime dependencies/install hooks and both hashes. The dependency retains its original author's MIT notice; it is not vendored or relicensed as SDK source. This is provenance/license validation, not a vulnerability-database clearance.

The five core npm payloads retain their exact four files. The new package permits exactly six: LICENSE, package.json, dist/index.js, dist/index.d.ts, dist/syntax.js and dist/syntax.d.ts. The extra pair is the private implementation module. No backend archive, source maps, tests, private corpus files or game assets are allowed. Root-only exports, identical SDK MIT licenses, six reviewed API baselines/reports and supported Node 22/24 × Ubuntu/Windows CI remain mandatory.

## Acceptance evidence and remaining work

Before implementation, all 38 Lua checks failed on the absent package/API. All 24 authored syntax cases, both Lua golden spans and binding/scope/flow/ownership/resource/real-TOC composition checks now pass. Six worker checks first failed on the absent client and now pass; five corpus cases first failed on the absent flag and now pass. Two additional architecture regressions exposed missing external-manifest/version checks, which are fixed without changing core permissions.

After the corpus fidelity fixes, all 207 integrated tests, strict API Extractor and exact package/hash/license gates pass locally. The [actual corpus record](LOCAL-CORPUS-TESTING.md#actual-v040-lua-parsingprovider-run) accounts for all 5,242 files, including 5,106 syntax verdicts and 136 explicitly blocked files; the overall run retains exit 1. Exact pushed-head review/CI evidence is tracked in #11 and the implementation PR. The previous candidate characterization and these SDK tests share a backend; they do not constitute an independent native Lua or Classic Era grammar oracle. Native lua/luac remains unavailable. XML syntax/provider, decoded inline-Lua mapping, reference graph and whole-corpus selected provider resolution remain separate deliverables; the overall goal stays active.

Primary references checked 2026-11-16: [Lua 5.1 manual](https://www.lua.org/manual/5.1/manual.html), [pinned upstream interface/encoding/scoping options](https://raw.githubusercontent.com/fstirlitz/luaparse/fa4ba476841b9ca4891848dfe96e42336f54f932/README.md), [pinned manifest](https://raw.githubusercontent.com/fstirlitz/luaparse/fa4ba476841b9ca4891848dfe96e42336f54f932/package.json). Profile choices and static-availability assumptions above are SDK design decisions, not inferred WoW-loader rules.
