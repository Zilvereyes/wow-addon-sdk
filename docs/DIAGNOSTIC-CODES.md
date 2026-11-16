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
