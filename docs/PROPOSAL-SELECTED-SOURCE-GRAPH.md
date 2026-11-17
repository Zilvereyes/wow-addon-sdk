# Selected-source graph and resolver composition — decision proposal

Status: **A–F proposed, unapproved and unimplemented**. Baseline: source0.7.0, eight packages/78beta exports, PR #29 frozen at `07b79a88150804be87b3d9c041bc7f2ff23e531f`; PR #28 stays580ed8b. Existing Lua/XML/provider/inline approvals remain binding, but do not approve the path, traversal or publication choices below. No merge/tag/publication/game writes are authorized by this proposal.

## Observed gap and evidence boundary

[Actual partial-context evidence](REVIEW-INLINE-LUA-CORPUS.md) gives every discovered434TOC/5242Lua/1199XML file a syntax verdict and analyzes654inline bodies;685bodies still lack context. All6875input hashes match, with zero technical blocks, but no selected-source reference graph or selected-provider participation exists. Inventory association cannot establish that a Lua/XML source belongs to a selected TOC. The pure resolver already accepts exact variant-associated provider batches and preserves order/duplicates; filesystem discovery does not belong in those packages.

This proposal adds a bounded **caller-policy analysis graph**, not a certified Blizzard loader. It preserves the remaining handler/domain/diagnostic work rather than declaring fullParsing from a reachable-file count. [Context evidence](REVIEW-HANDLER-CONTEXT-EVIDENCE.md) explains why generic emulator defaults cannot silently supply all missing signatures. [Locally declared proposed types](proposals/selected-source-graph-contract.ts) and [existing-API characterization](proposals/selected-source-graph-characterization.mjs) are design checks, not graph implementation tests.

## A — Tooling boundary, opt-in command and exact identities

Implement a separate `scripts/inspect-selected-addon-sources.mjs` command plus private graph/host/validation modules. Preserve the existing inventory runner and its flags/counters verbatim. Add no SDK package, package edge, public export, backend dependency, schema change or version bump. Source0.7.0/78beta and all eight payloads remain unchanged. Node filesystem/process/clock work stays in tooling. The new command is unavailable until approval and implementation:

```text
node scripts/inspect-selected-addon-sources.mjs <explicit-local-AddOns> --graph-profile <JSON> --resolution-profile <JSON> --xml-provider-profile <JSON> --xml-inline-lua-profile <JSON> [--lua-input-profile corpus-files]
```

All four profile flags are required, unique, and validated before any source read. The root must be an explicitly chosen local directory; reject network URI/UNC/device root inputs. No worker path, executable, shell command, absolute output destination, environment expansion or callback comes from profiles. Resolution profile reuses the existing environment/selectionPolicy/conditionPolicy shape; no second selection/condition-profile flag is accepted. This prevents conflicting policy contexts. The assistant prepares technical profiles; users need not author JSON.

Graph profile schema1 has exactly `schemaVersion`, `id`, `pathPolicy`, `addons` and optional `limits`. Unknown fields, duplicate logical IDs, sparse arrays, empty groups/candidates and invalid consumed values fail preflight with no source credit. Dense numeric own cells/documented fields are snapshotted once; arbitrary JS getters are caller code, not a sandbox. Each JSON profile is bounded to1MiB; combined consumed profile strings are bounded to1Mi UTF16units. At most1024groups,128candidates/group and10000candidates overall. The authored [profile shape](proposals/selected-source-graph-profile.json) is proposed data, not an executable fixture.

Each AddOn row supplies opaque exact `logicalAddonId`, explicit `directory`, exact `addonBaseName`, and an explicit ordered `tocPaths` list relative to the AddOns root. Only those TOCs are candidate reads. Each must resolve inside its declared directory; nested library/test TOCs are not implicitly candidates. The directory and list are caller associations, not inferred activation or dependency ordering. Candidate suffix metadata comes from the actual parser, then existing `selectTocVariant` applies the explicit policy. No-match/unresolved/ambiguous/invalid selection never opens descendant source text.

No-match remains a normal empty group selection, as in core. If a candidate read/projection is missing, do not remove it and select a fallback: selection is `null`/not-invoked and the group is blocked with a graph issue, rather than a fabricated TOCSEL result. Valid candidate parse diagnostics remain visible; a selected candidate syntax error blocks its group. An unselected candidate diagnostic is not erased or used to manufacture declarations, even if another selected candidate can independently resolve.

Parser source identities use the **actual matched root-relative filesystem spelling**, with the host-native separator, as the existing inventory caller does. The host chooses this exact label before invoking an SDK parser; SDK outputs must preserve it unchanged. Raw profile paths and reference target values remain independently retained, with original source ranges/maps; they are never rewritten to this lookup identity. Logical IDs and `tocVariantId=JSON.stringify([logicalAddonId,tocPath])` retain existing exact case/Unicode semantics. No physical absolute path enters SDK source identities or public reports. This is an explicit new tooling identity choice, not normalization inside a core contract.

For each reference retain `rawTarget` (exact original source slice), `targetValue` (the SDK's semantic fileEntry.path or XML target.value), and `expandedTarget` separately. TOC condition annotations can sit inside a path's original source hull; never parse that hull as a cleaned filename or pretend it has XML-style mapping parts. XML target-source/maps come from the target XmlValue, not the enclosing reference element. Retain pointers to the exact originating TOC-entry/provider-reference ordinal and its independently owned analysis; original construct sources and XmlValue mappings remain accessible without fabrication. Token/path interpretation consumes only targetValue.

## B — Portable path policy and read-only host

Required policy fields are `separators:'slash-and-backslash'`, `caseComparison:'exact'|'ascii-insensitive-unique'`, `containment:'addons-root'`, `links:'reject'`, and `variables:{kind:'explicit-tokens',tokens:[{token,replacement}]}`. The recommended authored/local starting case policy is **ascii-insensitive-unique**; it remains a caller assumption. Exact mode is explicit rather than host-inferred.

Reference resolution is relative to the containing source's directory. Both separators are interpreted for lookup; after rejecting rooted inputs, repeated internal separators collapse, `.` is removed and `..` is permitted only while the final target stays within the explicit AddOns root. A trailing separator is a directory-target rejection, never a file fallback. Raw spellings are retained. Cross-AddOn-directory references inside that root are allowed, but retain the requesting logical AddOn/variant association. Metadata Dependencies/OptionalDeps are not recursively followed or used to infer load order. A future dependency-order policy is separate work.

Support caller-owned bracket tokens such as `[Family]` without a built-in game substitution table. Token names match exactly `^\[[A-Za-z][A-Za-z0-9_]*\]$`, at most64UTF16units each,32unique entries. Replacements are nonempty portable literal filename components of at most255UTF16units, with no separator, colon, dollar, brackets, dot-only/parent component or invalid scalar. Expand exact bracket tokens once, including embedded tokens, under the4096unit output budget **before appending**. Replacement values cannot introduce another token, path component or recursive expansion. Unknown/malformed bracket tokens and any dollar code unit are unsupported-variable outcomes with no target content read. Empty token tables are valid and expand nothing. Profile directory/candidate paths are literal lookup inputs, not token expressions. The authored example maps a fictional `[Branch]` token only; actual Family/Game values require an explicitly prepared version/environment-bound caller policy. Raw and expanded targets remain separate; check rooted/drive/device syntax before expansion and containment/portable components again afterwards. No environment variable, URL decoding or frame `$parent` name resolution is performed.

| Input/host case | Required disposition before content read |
| --- | --- |
| Absolute POSIX/rooted Windows path, drive-relative path, UNC/device path or colon/alternate stream | blocked reference; never open |
| Root escape, NUL/U+0001–001F, punctuation `< > : " \| ? *` or component ending in ASCII dot/space | blocked reference; never open |
| Device component CON/PRN/AUX/NUL, COM1–9/LPT1–9 or COM/LPT with superscript¹/²/³, also before an extension | blocked reference using ASCII-insensitive name comparison; never open |
| Any `$` code unit or unknown/malformed bracket token | unsupported-variable; only exact caller-supplied bracket mappings are allowed |
| Percent escape or `#` | ordinary literal filename spelling; never URL-decode or treat as fragment |
| ASCII-insensitive lookup | enumerate each component once; exactly one ASCII-fold-equivalent candidate is required, even when one spelling is exact |
| Case-fold collision | ambiguous; no exact-first preference and no host-dependent winner |
| Non-ASCII characters | compare exactly; no Unicode normalization or Unicode case folding; reject unpaired surrogates and lossily decoded/unrepresentable entries |
| Missing path, directory instead of source, unsupported extension | distinct unresolved/unsupported outcome; no invented default filename |
| Symlink/junction/reparse component | reject the component; do not follow it |

The portable component restrictions deliberately apply on both platforms; they are caller-policy constraints rather than claims that Linux or WoW implements Windows naming. See [Microsoft's filename rules](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file), including reserved superscript device digits. Dot/parent-segment handling occurs before filename-component validation; no path trimming or Unicode rewrite is permitted. Exact mode also requires one unique representable entry, never an arbitrary first match among colliding decoded names.

The trusted native host closes over the authorized root. Check each component, lexical containment and final canonical containment before opening; use the existing bounded read-only descriptor helper with stable bigint identity/times and final pathname checks. Retain private fingerprints for directory/component snapshots as well as first-read source bytes; verify both again before publication. A changed lookup directory cannot retain a stale unique-case decision even when file bytes match. Changed ancestry/identity/content invalidates publication. No input source, referenced asset or profile is written; no Lua/XML or third-party C++ is executed.

**Windows host capability:** Node lstat/symlink checks alone are not a general reparse-attribute attestation. The recommended adapter adds a fixed trusted `scripts/Inspect-SelectedSourcePath.ps1` attribute helper using the already installed system Windows PowerShell5.1 and [File.GetAttributes / ReparsePoint](https://learn.microsoft.com/en-us/dotnet/api/system.io.fileattributes). The current host has that runtime; this proposal installs nothing and requires no administrator action. Use an absolute OS runtime path, `-NoProfile -NonInteractive -File` with a fixed script, and bounded correlated JSON on stdin/stdout; paths are data, never interpolated shell expressions. Respect the existing execution policy: no bypass flag or policy change; an unavailable/blocked helper fails closed. At most128component rows/1MiB per request/output,10second deadline, one request at a time and close/reap before replacement. All reparse attributes, failed inspection and malformed responses fail closed. PowerShell source must pass the applicable Workbench registration/parser/hash checkpoint and targeted native tests before use; unavailable runtime is a reported blocker, not permission to weaken links:'reject'. Ubuntu uses its native lstat/readlink path. Neither adapter adds a dependency to SDK packages.

This is a stable-installation read-only adapter, **not an adversarial-filesystem sandbox**: portable Node APIs do not provide atomic directory-handle-relative traversal on both supported platforms. Recheck ancestors/canonical identity, stop on change and state that limitation; do not claim absolute protection against a hostile concurrently swapped ancestor. Native/fake-host race tests must demonstrate detection at the supported checks. Stronger platform-specific containment would require its own design/dependency decision.

TOC file entries may target Lua/XML; XML Include targets must be XML and external Script targets Lua. Other extensions remain visible as unsupported references, not silently successful skips. Discovery can count metadata for the bounded root, but only explicit TOC candidates and eligible referenced sources are opened as text. Unselected source read-count tests distinguish metadata enumeration from content reads.

## C — Conditions, occurrences and deterministic traversal

Select TOCs **before** traversing their `metadata.fileEntries`. Preserve that list's duplicates/order and every original path/condition/source field. Translate file-entry conditions by the existing adapter's documented descriptor mapping: providerId `@wow-addon/toc-metadata-adapter`, exact name/values/raw/source copies. No new provider grammar or literal-union member is added.

For each reference, first validate the consumed projection/source and charge its budget. Evaluate the inherited AND of path conditions under the existing environment/condition policy using an internal probe that never enters the registry. Then:

- **inactive:** retain an inactive reference; do not interpret/resolve/open its target or descendants;
- **active:** resolve and analyze the target, preserving conditions on declarations rather than erasing them;
- **unknown:** resolve/analyze potential sources for coverage, preserving unknown restrictions; never relabel them active. Invalid root policy fails preflight; valid unsupported conditions stay unknown with CONDEVAL issues.

Traversal is iterative depth-first in caller AddOn order and selected TOC file-entry order. Within XML, merge frame-declaration, external-reference and inline-body events by the existing flat preorder `elementIndex`; retain each event's provider index and each body declaration's decoded order. Child references expand before later sibling events. This defines **analysis/provenance order**, not runtime handler invocation or certified game loading. Frame candidates and function-body globals retain unknown activation. Dynamic Lua references are not scanned as a substitute for a separate approved Lua loader model.

Separate these identities:

1. source node: one exact matched source identity and stable snapshot;
2. analysis record: one source-analysis request under exact source/profile/conditions/context, with separate counters for its actual SDK calls;
3. occurrence: one ordered path through the selected graph, including repeated file/inline references;
4. declaration origin: one declaration in one occurrence, linked to original source and any disjoint XML sidecar.

A repeated reference produces another occurrence and declaration origin even when bytes or an identical analysis result are cached. Identical analysis reuse is labelled `reused`, never counted as a new parser invocation. Cache keys include logical/variant association, exact source identity, selected parser/profile/context and the entire ordered inherited-condition projection. Charge every retained copy; cache eviction/re-read is bounded and cannot change semantic ordering. An ancestor source-path repeat is a cycle; record its edge/ancestor occurrence and stop that expansion. A repeat outside the active ancestor path is an ordinary duplicate. Do not use inode equality alone as a cycle rule: hardlinked paths can have different relative-reference bases.

Every occurrence retains a numeric ordinal, parent occurrence/reference, selected variant, conditions and guard availability. XML inline declarations retain decoded `GlobalDeclaration.source` plus the approved ordered original-XML sidecars. Never replace disjoint parts with a hull or append occurrence IDs to source filenames. Inputs and outputs do not alias each other or another call.

## D — SDK calls, association and partial-result publication

Use actual `parseToc`, `analyzeLua`, `parseXml`, `analyzeXml`, `mapXmlValueRanges`, `evaluateGlobalConditions` and `resolveGlobalRegistry`. Keep direct SDK defaults/backend pins unchanged. Existing Lua worker profiles remain bounded128MiB/10s/32MiB output or corpus2048MiB/60s/128MiB output with its approved parser thread stack; XML composition stays256MiB/10s/32MiB output. Never overlap generating gates or large replacement workers before close/reap acknowledgement.

The private selected-source XML worker may reuse the existing supervisor with a fixed trusted graph-worker path and exact legacy-shaped transport envelope. It supplies the requesting logical addonId and copied inherited conditions to provider and inline Lua calls. Independent graph validators bind those expected values to the same request/body/source, including condition arrays/value cells and warning sources. Current inventory worker/default envelopes and the fixed `corpus-xml` association remain unchanged; its strict validator cannot simply be bypassed for graph mode. Factor reusable validation primitives only with backward-compatibility regressions. No request/profile can choose executable code or worker limits.

Feed provider batches only to the **exact selected tocVariantId**. Use existing provider IDs for Lua/XML; preserve automatic selected SavedVariables, then ordered provider batches/duplicates as the approved resolver specifies. Maintain a separate origin sidecar keyed by input batch/declaration ordinal and resolved entry/declaration ordinal; selected SavedVariables instead carry their selected-TOC declaration ordinal with null provider indices. Use the existing guaranteed first-seen order, validate a complete one-to-one mapping and fail on mismatch. Do not match duplicate origins by name/source alone or modify core declaration/result types.

Publication rules:

- Malformed/changed source, worker/backend/resource/invariant failure, unresolved/blocked/cyclic reference, selected-source syntax rejection or incomplete XML structural provider prevents that AddOn group from entering the resolver. Retain independently validated private graph facts, but no partial group/global prefix can escape through resolution. Independent valid groups may resolve.
- Missing handler context, valid dynamic/lexical incompleteness and unknown conditions remain supported partial observations. They create no fabricated declarations. Independently validated facts may participate with their original unknown/conditional states, but tool-level analysis/resolution completeness remains false. Core result objects are not rewritten to conceal the missing inputs.
- XML syntax rejection yields no provider/inline attempts. Partial XUI0004 provider results can retain independent body-analysis evidence as today, while structural graph publication stays blocked. No generic handler fallback or unknown-root vocabulary is inferred.

The private result includes graph/analysis records, origins and the untouched core resolved result. Public CLI output is a separately built **allowlisted aggregate**, never a JSON dump of those objects: no installed paths, IDs/names, namespace spellings, source text, complete diagnostics or per-file fingerprints. Full graph objects may contain original bodies for local consumers/tests and must stay private.

## E — Budgets, result schema and honest counters

Fixed upper presets (caller `limits` may lower them, never raise them; all numbers positive safe integers):

| Budget | Upper preset and charge rule |
| --- | --- |
| Unique source nodes / source-analysis records | 10000 /50000 |
| Reference occurrences / file-or-inline occurrences | 50000 /50000; repeated copies count |
| Graph depth / directory-discovery depth | 256 /64 |
| Directory entries | 100000 total; cache component listings and charge once per scan |
| Bytes read | 1GiB total including integrity rereads; existing per-language caps still apply |
| Text cache | 128MiB maximum retained bytes; bounded eviction, no semantic deduplication |
| Retained records / strings | 1000000 combined owned nodes/analyses/references/occurrences/declarations/diagnostics/descriptors/value cells/source refs/maps/parts;64Mi UTF16 retained string units |
| Single raw/expanded path | 4096UTF16 units; no truncation or uncharged expansion |
| Whole operation | 15minutes cooperative budget; clamp in-flight worker deadlines to remaining budget, then close/reap |

Per-file TOC reads cap at8MiB; XML at4MiB and1Mi UTF16; Lua at the existing bounded/corpus input limits, with the explicit corpus-files transport needed for larger/byte-preserving input. These are bounded analysis budgets, not a hard synchronous-I/O or CPU sandbox. Charge before graph retention/copy/expansion and bound each read/request by the remaining operation budget. Existing bounded worker-message decoding remains a separate transient allocation limit, not a claim of pre-JSON allocation control. Check monotonic time before I/O/worker requests and throughout bounded traversal/retention loops; late failure retains no resolution publication for the affected group. Zero selected TOC roots is incomplete top-level coverage, even if each no-match is a normal core result; a real selected empty TOC is valid evidence and does not require a fabricated descendant or global.

Private result schema1 contains `completeUnderPolicy`, group selections/publication status, source nodes, actual analysis records, references, occurrences, declaration-origin/decoded-map sidecars, original diagnostics, graph issues and the core resolved result. Tooling issue codes SGRAPH0001–8 denote respectively invalid profile, blocked/unsupported target, missing/ambiguous target, cycle, budget, read/integrity, projection/worker and incomplete-analysis issues. They are **not new SDK Diagnostic codes**. Issues retain available original source arrays privately; invalid input gets no fabricated identity/source. SDK TOC/LUA/XML/XUI/TOCSEL/CONDEVAL/RESOLVE codes remain distinct.

Public aggregate schema1 separately counts found files, explicit candidates, selected/other candidates, eligible source files, unique files with actual syntax verdicts, actual source-analysis requests/completions, reused analyses, reference/occurrence counts and outcomes, expanded-token references/unsupported variables, inactive/unknown guards, missing-context/unsupported skips, diagnostics by code, technical failures and before/after integrity by language. Also count direct tool calls by public API/stage (`parseToc`, `parseXml`, `analyzeLua`, `analyzeXml`, `mapXmlValueRanges`); do not pretend these instrument internal backend calls made inside another SDK API. XML inline analyses count as actual Lua calls but never as standalone parsed files. `found` never means parsed; request/API/reuse/occurrence counts never inflate unique-file syntax counts. Validate all disjoint accounting equations before aggregate credit. Graph/resolution completeness is the conjunction of requested groups, topology, supplied analyses and core evaluation completeness, not a successful core subset alone.

The concrete `SelectedSourceGraphAggregate` in the proposed type fixture is the CLI wire shape; the full private graph result is not serialized. Stage call receipts distinguish invoked/returned direct API calls and must match the validated request/result. Failed/crashed/malformed replies without a valid receipt increment failedRequestsWithUnknownStages, not invented API or syntax credit. Confirm semantic/API/map/diagnostic metrics only after whole-analysis validation and matching source integrity; submitted/completed request counts remain operational observations. Analysis diagnostics count once per validated analysis record, occurrence diagnostics count ordered reused copies separately. For each language, syntaxVerdictFiles equals accepted+rejected unique source files; repeated verdicts under different conditions must agree or become an invariant failure. Missing/unresolved targets are reference outcomes, never phantom eligible files. Overall resolution.complete conjoins coreComplete and all requested graph/analysis coverage, even when an unknown guard has no declarations on which core could report it.

Exit0 means complete requested analysis under the explicit caller policies; exit1 means failed/incomplete coverage or diagnostics and exit2 invalid arguments/preflight. This increment keeps `fullParsing:false` and `clientConformance:false`; complete selected-graph capability is necessary but insufficient for the broader corpus/domain/diagnostic goal. Existing all-inventory evidence is retained separately, so selecting fewer sources cannot erase known findings.

## F — Required tests, alternatives and decision

| Required authored case | Measurable acceptance |
| --- | --- |
| Two environments / selected variants | Actual selector chooses the intended exact candidate; unselected source text is never opened and no unselected provider/global reaches resolution |
| Candidate/profile outcomes | No-match is a normal empty group; all-no-match gives no false coverage success. Ambiguous/invalid/duplicate/missing-candidate/wrong-group/profile cases block descendants without fabricated selection results or fallback |
| Opaque associations | Prototype-like IDs, delimiters, case-distinct/Unicode logical IDs and two environments cannot collide in caches/origin maps; path folding never normalizes identity/context keys |
| Path equivalence | Mixed separators, dot/parent segments inside root, exact Unicode and ASCII folding preserve raw target maps and actual source labels |
| Unsafe/ambiguous paths | Absolute/drive-relative/UNC/device/ADS/root-escape/reserved/link/missing/directory/extension cases have exact distinct dispositions and no unintended content reads |
| Explicit path tokens | Authored whole/embedded bracket mappings, empty/duplicate/case-distinct tables, unknown/malformed tokens, unsafe replacements, non-recursion and exact/over expansion budgets; raw provenance preserved and no implicit Family/Game values |
| Conditional read gates | Active/false/unknown path guards exercise the real evaluator; false paths are unread, unknown paths stay unknown and unsupported conditions remain visible |
| Duplicates / cycles | Two references to one source retain two occurrences/origin copies; a diamond is not a cycle; direct/indirect/alias cycles stop deterministically; hardlinks do not collapse relative bases |
| XML order / inline mapping | Actual XML provider events interleave references/bodies deterministically; entity/comment/CDATA/CRLF/astral mappings preserve all original parts and decoded source identity |
| Conditions and caches | Same source under different condition/context keys is not falsely reused; duplicate descriptors/order remain exact; cache-hit counters never claim new parser calls |
| Partial result publication | Valid groups survive another blocked group; corrupt late source/sidecar/integrity data gives no affected-group resolution prefix; supported missing-context/lexical uncertainty stays visible |
| Real composition / origins | Actual parser outputs feed exact selected-variant batches and existing resolver; SavedVariables and repeated identical provider declarations retain one-to-one origin sidecars, conditions and active-only scope checks |
| Budgets / recovery | Exact/one-over counters, path/string/cache/byte/depth/record caps, worker deadline/output/heap/crash and successful next independent group; no duplicate after timeout or unreaped replacement |
| Privacy / input safety | Native temp-directory race/link tests and fake read ports; no input writes/execution/assets/network; serialized public aggregate contains no installed identities, text or complete diagnostics |
| Distribution | Original78beta, eight API baselines/reports, dependency/license/backend hashes and exact package payloads unchanged; supported Windows/Ubuntu × Node22/24 on final implementation head |

Dependency-ordered delivery after approval:

1. Record A–F and any changed choices in #11/this proposal; freeze #29 and preserve foreign docs/workflows. New approvals do not authorize merge.
2. Add red tests for selection/read gates, raw/lookup identity and condition descriptors using in-memory authored sources and actual SDK APIs.
3. Implement bounded native host/path resolution and the fixed Windows attribute helper; apply PowerShell Workbench's exact-source parser/registration gates and native temp-directory containment/junction/identity/race tests. Never enable Developer Mode/UAC or change filesystem case settings for a test; unavailable native cases are explicit skips, with controlled-host failure regressions retained.
4. Implement iterative graph/occurrence/budget accounting and conditional traversal. Test cycles/duplicates/unknown conditions before adding registry publication.
5. Compose supervised Lua/XML/inline analyses with copied inherited conditions and independently verified sources/maps; preserve existing inventory behavior/regressions.
6. Add exact selected provider batches and validated origin mapping. Test group publication/failure isolation, duplicate order and two-environment resolution.
7. Implement allowlisted aggregate/privacy/disjoint equations; then authored CLI integration with no game installation. Review source diff and every changed requirement.
8. Run focused tests, proportional full gates, strict API/exports/licensing/payload and final supported exact-head CI. Only after source-read safety is verified prepare/select the private graph profile and run actual affected corpus/ledger acceptance. Keep unresolved contexts/domains/diagnostics explicit.

Alternatives considered: putting filesystem orchestration in core would violate approved boundaries; a ninth public package would create unnecessary ABI/dependency decisions; silently extending inventory mode would conflate old counters/association; deduplicating occurrences by filename would lose provenance; exact-first case lookup would vary by host; generic handler signatures would hide missing evidence; publishing partial corrupted groups would allow false active contributions. The recommended design uses a separate opt-in tooling command, exact caller associations, unique ASCII-fold lookup, ordered occurrences and fail-closed group publication with explicit supported uncertainty.

**Decision requested:** approve A–F (including path/identity, condition-read, occurrence/order, publication and budget choices) before implementation, or identify the concrete change needed. Independent architecture and file-safety reviews should examine this contract first. [Review packet](REVIEW-SELECTED-SOURCE-GRAPH-PROPOSAL.md) lists counterexamples and evidence boundaries; passing current SDK CI or locally declared proposed types cannot prove the future graph.
