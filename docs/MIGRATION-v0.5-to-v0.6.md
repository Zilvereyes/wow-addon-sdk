# v0.5 to v0.6: explicit-policy XML fact provider

The user approved [XML provider A–D](PROPOSAL-XML-PROVIDER.md) on 2026-11-17. Source 0.6.0 adds the optional `@wow-addon/xml-analysis` leaf with eight beta exports; the original seven package APIs and schemas remain unchanged. All eight workspace versions/internal ranges advance together. This source milestone is not a published npm release.

The new package depends only on xml-parser, diagnostics and global-registry. Syntax-only consumers keep `parseXml`. Consumers requesting semantic facts call:

```ts
import { analyzeXml } from '@wow-addon/xml-analysis';

const selector = (localName: string) => ({ namespaceUri: null, localName });
const result = analyzeXml('<Ui><Frame name="Example"/></Ui>', 'Authored.xml', {
  addonId: 'caller-owned-example',
  policy: {
    roots: [selector('Ui')], frameElements: [selector('Frame')],
    includeElements: [selector('Include')], scriptElements: [selector('Script')],
    handlerContainers: [selector('Scripts')], handlerElements: [selector('OnLoad')],
  },
});
// result.frames[0].declarationIndex === 0
// result.declarations[0].activationState === 'unknown'
```

This authored vocabulary is explicit caller policy, not a built-in WoW schema. Match expanded names exactly, with case sensitivity and no namespace fallback. Only unqualified name/virtual/inherits/file attributes receive the documented roles. Include/Script references require direct-root placement; handlers require the documented frame → handler-container → handler structure.

Frames are candidates. Nonempty literal names without `$` and with virtual absent/exactly false produce unknown declarations. Virtual templates and unresolved parent names remain facts; templates are not instantiated, inherits is not resolved and no active globals are invented. Default `listGlobals` omits unknown candidates. Caller association and selection do not turn unknown declarations active. Existing duplicates, original file strings and zero-based UTF-16 exclusive ranges remain intact.

Reference targets preserve spelling/decoded maps; no referenced file is opened. Inline body values join direct-child text and CDATA in source order, with comments/PIs omitted and no invented whitespace. Mappings keep each contributing literal/normalized/entity raw span. Body source encloses the original content, including gaps; do not assume decoded and raw widths agree. Empty/self-closing bodies retain zero-width content provenance. Inline chunks/handlers are **not analyzed as Lua** in this increment. Handler context, parameters/varargs and disjoint downstream Lua token provenance remain a subsequent contract.

Input projections consume documented own fields and numeric array cells, snapshot getters and ignore extra fields/iterators. Returned conditions, maps, positions and sources are independently owned; readonly types do not freeze JavaScript objects. Conditions use the existing provider-neutral contract and do not supply inferred truth.

Existing XML syntax/profile failures pass through with copied diagnostics and empty facts. XUI0001 rejects invalid provider inputs, XUI0002 rejects unusable syntax projections, XUI0003 reports provider resource exhaustion, and XUI0004 warns about an unsupported/ambiguous recognized construct. XUI0004 retains independent facts with complete=false; other provider failures return empty fact arrays and fixed messages. complete describes extraction under the caller vocabulary, never game execution or reachability.

XML syntax limits stay 1 Mi UTF-16 input units / 50,000 syntax records / depth 256 / 2 Mi decoded units. Provider options additionally allow at most 128 selectors per role, 256 inherited conditions, 1,024 values per condition, 50,000 consumed selector/condition/value entries and 1 Mi cumulative option-string units. Provider output permits at most 50,000 fact/declaration/condition/value-cell/mapping records; empty value cells count. Caller heap/deadline supervision remains necessary; the API is not a JS sandbox.

The optional corpus flag `--xml-provider-profile <local-json>` requires `--xml-analysis`. It accepts the exact `{schemaVersion:1,policy}` format and uses a fixed `corpus-xml` inventory identity, with resolvedProviderParticipation=false. It does not connect file facts to selected TOCs. Provider counters are validated and committed atomically only after source-integrity rereads match; syntax verdicts retain their own meaning. See [profiles explained in plain language](XML-PROVIDER-PROFILES.md) and [corpus accounting](LOCAL-CORPUS-TESTING.md).

No actual installed XML provider run is claimed: the user selected synthetic tests/CI for this round and deferred the local run pending a profile. Earlier installed syntax evidence remains tied to its original commit. Selected-source traversal, inline Lua analysis and full composed acceptance remain open in #11. Merge, tags and publication require separate authorization.
