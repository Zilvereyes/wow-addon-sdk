# Migration from v0.3 to v0.4

For v0.4.1, the approved [corpus profile](DESIGN-LUA-CORPUS-PROFILE.md) adds LuaAnalysisProfile plus optional readonly profile and allowShebang fields. Existing calls keep the bounded default. Selecting corpus changes fixed budgets, not Lua grammar or activation semantics; selecting allowShebang explicitly permits only the initial loader header. Local byte transport is an independent CLI preset, not automatic SDK string decoding. One new type brings the current surface to 56 beta exports; the v0.4.0 inventory below remains historical.

v0.4.0 is an unpublished preview of the [approved optional Lua analysis package](DESIGN-LUA-ANALYSIS.md). The five core packages retain their source APIs, schemas and dependency directions. All six workspace versions/internal ranges advance together; all existing third-party lock records remain exact. The only new runtime dependency is luaparse 0.3.1 in lua-analysis, with reviewed artifact/license hashes. No dependency is added to diagnostics, registry, metadata, TOC parser or TOC adapter.

Three new beta exports bring the surface to 55. No raw backend AST becomes public:

```ts
import { analyzeLua } from '@wow-addon/lua-analysis';

const result = analyzeLua('DB = DB or {}; local hidden = {}', 'Example/Code.lua', {
  addonId: 'caller/source-association',
});
console.log(result.complete, result.declarations, result.diagnostics);
```

Use the exact caller identity; do not infer a source's active TOC or file reachability from this function. Output kind is lua-global, without a SavedVariable scope. A Lua assignment and a TOC SavedVariable for the same name remain independent origins. Once reachability is established externally, pass these declarations in a ProviderDeclarationSet associated with the selected variant and call the existing resolver. The provider itself imports no TOC adapter.

Direct chunk bindings are statically unconditional, or conditional when copied inherited descriptors are supplied. Flow/function/block assignments remain unknown. Dynamic global environment/code access makes this lexical projection incomplete and all returned supported bindings unknown. Analysis complete is not a runtime or value guarantee; a supported unknown-flow declaration can coexist with complete=true and later make environment resolution incomplete. Do not use all returned names as active globals.

The profile is explicit Lua 5.1/ASCII identifiers, one leading BOM and original UTF-16 source spans, with no source execution or decoded literal-value interpretation. Token-based parse-only adaptation corrects two pinned-backend Lua 5.1 defects while retaining source offsets and upstream bytes; original file text is never changed. Invalid syntax/resource/input results contain zero declarations. Limits and worker controls are documented in the design. Classic Era host extensions remain unverified.

`LuaAnalysisOptions`, declaration conditions and public result collections are readonly contracts. Returned declared/source/condition data is independently copied; no runtime freeze is installed. Invalid path arguments retain an empty diagnostic file rather than a substitute filename. Fixed diagnostics do not echo input/backend error text.

For the optional local runner:

```powershell
npm run test:corpus -- '<local-AddOns-directory>' --lua-analysis
```

Default TOC mode now lists Lua under disabledParsers and XML under unimplementedParsers. Enabling Lua adds aggregate counters and actual syntax verdicts; encoding/resource/worker failures remain failed/incomplete coverage and are not counted as parsed. TOC composed resolution still receives no filesystem-derived Lua provider association; resolvedProviderParticipation=false makes that explicit. XML/reference graph and full three-parser acceptance remain open. Tag/npm publication is separate from these source versions.
