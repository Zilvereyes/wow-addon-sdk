# Stable diagnostics codes (v0.2.0)

| Code | Severity | Meaning |
| --- | --- | --- |
| `TOC0001` | error | Malformed TOC metadata directive |
| `TOC0002` | warning | Duplicate SavedVariable name |
| `TOC0003` | warning | Invalid Lua 5.1 identifier |
| `TOC0004` | warning | Empty list entry |
| `TOC0005` | warning | TOC line exceeds the effective client limit |
| `TOC0006` | warning | File path begins with whitespace |
| `SV0001` | warning | Account/character scope clash for same addon ID |

Treat codes as stable identifiers, not display strings. Diagnostics messages are English for v0.2 but may be localized by downstream adapters.

Empty lines containing two or more hashes and optional trailing whitespace are comments, not `TOC0001`. Dotted custom names such as `X-Fixture-2.7-Module` are accepted in the `X-` namespace. Nonempty double-hash annotations without valid metadata syntax retain `TOC0001` in the focused corpus fix; malformed/unknown header conditions remain errors and never expose unconditional globals.

## v0.3.1 selection issues

These codes are emitted in `TocSelectionIssue`, which has a source array and permits environment-only issues without source. They do not change shared `Diagnostic` or parser diagnostics.

| Code | Result | Meaning |
| --- | --- | --- |
| `TOCSEL0001` | invalid | Invalid environment/policy/schema/logical AddOn input |
| `TOCSEL0002` | invalid | Invalid candidate identity/metadata projection/source, or duplicate exact variant ID |
| `TOCSEL0003` | ambiguous | Multiple candidates at the best available priority |
| `TOCSEL0004` | unresolved | Environment knowledge or policy applicability cannot be established |

`no-match` is a normal result with no issue. `selected` returns one exact variant ID. Source lists and issue ordering are deterministic; result references do not alias the input.

## v0.3.3 condition-evaluation issues

`ConditionEvaluationIssue` retains a source array and fixed messages without changing shared Diagnostic or parser codes. Availability is derived under an explicit caller policy and is distinct from static ActivationState.

| Code | Meaning |
| --- | --- |
| `CONDEVAL0001` | Invalid environment/policy shape, schema or rule configuration |
| `CONDEVAL0002` | Invalid/contradictory declaration/descriptor projection or unavailable static provenance |
| `CONDEVAL0003` | Unsupported provider/name under the explicit policy |
| `CONDEVAL0004` | Missing/empty arguments for a supported rule |
| `CONDEVAL0005` | Unknown client context or missing/unsupported required environment field |
| `CONDEVAL0006` | A supported condition excludes the declaration under the explicit policy |

A structurally valid false condition can make the overall conservative AND inactive while retaining issues for other unknown conditions. Invalid projections and unresolved static activation remain unknown. Neither raw annotation spelling nor an unsupported provider/name supplies implicit truth. Returned provenance is copied and canonical; no policy/argument values are echoed into messages.

## v0.3.4 resolution issues

Root/group failures use `GlobalResolutionIssue`; source selections retain TOCSEL issues and selected declaration evaluations retain CONDEVAL issues. SV0001 is computed only from known-active selected declaration copies under logical AddOn IDs.

| Code | Meaning |
| --- | --- |
| `RESOLVE0001` | Invalid/unknown root context, condition policy or input-list shape |
| `RESOLVE0002` | Invalid/duplicate AddOn input or malformed selected metadata projection |
| `RESOLVE0003` | Invalid provider association, batch shape or selected provider projection |

These fixed messages do not echo policy/argument values. Root issue sources and optional logical IDs preserve available provenance without fabrication. `complete=false` can retain independently known active names; unknown/unselected sources never contribute active globals. A known no-match is a normal empty selection. Result completeness concerns consumed projections/availability rather than parser diagnostic cleanliness.

## v0.4.0 Lua analysis

| Code | Severity | Meaning |
| --- | --- | --- |
| `LUA0001` | error | Invalid caller text/path/options/inherited-condition projection |
| `LUA0002` | error | Rejected by the explicit Lua 5.1/ASCII/BOM profile |
| `LUA0003` | error | Input/node/depth or parser stack resource limit |
| `LUA0004` | warning | Dynamic environment/code access outside the supported lexical projection |
| `LUA0005` | error | Backend failure or unavailable validated AST projection |

All error results contain zero declarations, including an otherwise valid prefix before a syntax failure. Dynamic-environment warnings retain supported occurrences with static unknown activation and complete=false. Supported flow/function assignments can independently be unknown without a warning; analysis completeness is not runtime availability. Messages are fixed and do not echo raw source/backend errors. Original UTF-16 source points/ranges are retained; invalid API arguments without a usable path retain an empty file string rather than a fabricated filename. Tooling encoding/worker/read/input preflight failures have separate aggregate reasons and are not counted as completed syntax verdicts.

## v0.5.0 XML syntax

| Code | Severity | Meaning |
| --- | --- | --- |
| `XML0001` | error | Invalid caller text/path/options projection |
| `XML0002` | error | Invalid XML 1.0 syntax or enabled namespace constraints |
| `XML0003` | error | Fixed input/record/depth/decoded-output or parser stack resource limit |
| `XML0004` | error | DTD or XML declaration version forbidden by the XML 1.0 profile |
| `XML0005` | error | Backend failure or unavailable validated source/value projection |

Every XML error returns `complete=false`, `elements=[]` and `text=[]`, even when an earlier prefix was valid. Fixed messages never echo source text or backend error strings. The exact supplied path is preserved when usable; invalid paths retain an empty diagnostic file. Positions use original zero-based UTF-16 coordinates and exclusive ends; a point inside a CRLF is anchored at its CR. No diagnostic means syntax/provenance completeness, with no schema, FrameXML, global-declaration or loader-reachability guarantee.

In corpus tooling, `XML0002` and `XML0004` are completed rejected syntax/profile verdicts. `XML0003`, `XML0001` and `XML0005` are blocked resource/backend work and do not increment `parsed.xml`; transport encoding, read, worker and invariant failures also remain separate from syntax verdicts. The aggregate `profileRejected` counter is a subset of `rejected`. Full parsing remains false until the XML provider and loader reference graph exist. See [XML migration](MIGRATION-v0.4-to-v0.5.md).

## v0.6.0 XML facts

| Code | Severity | Meaning |
| --- | --- | --- |
| `XUI0001` | error | Invalid caller text/path/policy/condition projection |
| `XUI0002` | error | Unusable syntax backend projection or provider backend failure |
| `XUI0003` | error | Provider option/output resource limit |
| `XUI0004` | warning | Unknown root or ambiguous recognized construct under explicit policy |

XML syntax/profile errors retain their XML codes and owned source records. XUI0001–3 return empty fact arrays. XUI0004 preserves independently extracted facts with complete=false, for example invalid virtual spelling, missing Include target, empty file target or nested elements inside recognized inline code. Expected virtual templates, inherits and unresolved `$parent` names remain retained facts without manufactured globals. Messages are fixed and private backend/option strings never enter them.

Provider corpus validation requires each ambiguous element's exact warning source before committing any fact/map/diagnostic credit. Malformed projections are invariant failures; read, encoding, worker, resource and syntax rejection remain separate dispositions. Inline body facts are not Lua syntax verdicts. [Provider migration](MIGRATION-v0.5-to-v0.6.md) records the complete boundaries.

## v0.7.0 explicit inline contexts and mapping

No diagnostic codes are added. Invalid Lua context/parameters or function-body `allowShebang:true` produce LUA0001; forbidden function-body BOM/hashbang and unavailable root varargs produce LUA0002. Context budget failures produce LUA0003. Existing chunk defaults and fixed message identities remain unchanged.

`mapXmlValueRanges` uses XUI0001 for invalid source/value/query projections and XUI0003 for bounded input/output failure. It returns no mapping prefix on failure. An over-limit path has an empty diagnostic file rather than a truncated identity; an in-budget path is retained on cumulative budget failure. Original and decoded coordinates follow zero-based UTF-16/exclusive-end conventions, including existing CRLF canonicalization. See [mapping and failure examples](MIGRATION-v0.6-to-v0.7.md).

Corpus inline diagnostics retain decoded sources and independently checked original-source sidecars. Missing context is a skip/incomplete disposition, not a fabricated syntax error. Syntax verdicts, lexical incompleteness and technical failures remain separate.
