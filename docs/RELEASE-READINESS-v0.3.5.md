# v0.3.5 core architectural-freeze acceptance

Scope: five existing editor-neutral packages, their approved dependency graph, documented beta contracts and verification/distribution gates. Source version 0.3.5 is an unpublished development milestone. This record does not authorize a Git tag/npm release or declare consumer API stability. Final exact-head matrix/review/integration results are maintained in [PR #21](https://github.com/Zilvereyes/wow-addon-sdk/pull/21) and [epic #7](https://github.com/Zilvereyes/wow-addon-sdk/issues/7); pending evidence must remain pending there.

## Requirement-to-evidence mapping

| #7 acceptance | Implementation / review evidence | Executable gate |
| --- | --- | --- |
| Five acyclic packages | diagnostics is independent; metadata and registry import diagnostics only; parser imports metadata/diagnostics; adapter imports metadata/registry/diagnostics. No editor, filesystem, network or third-party runtime import in core. | check:architecture audits source AST, manifests, references and cycles; check:deps independently audits import graph |
| Environment and source identity | Client environment schema 1; caller logical IDs, exact variant tuple/path/suffix/source; no implicit normalization or guessed game rules | v030/v031 contracts and behavior tests; wrong/unknown context, Unicode, tuple collisions, duplicate variants and exact fallback cases |
| Select before evaluating | One exact selected variant per logical group; no non-selected declaration output; no-match is a normal empty answer | v031/v034 selector/resolver tests and composed corpus CLI regressions |
| Neutral provenance | Registry descriptors retain provider/name/values/raw/source without TOC grammar imports; adapter copies conditions; resolver retains exact provider/variant/original identity | v032/v034 tests for order, duplicates, missing legacy provenance, nested ranges and independent copies |
| Conservative evaluation | Explicit data-only rules, include/exclude and exact/ASCII comparisons; OR arguments and conservative AND; unknown never activates | v033 tests cover all nine truth cells, empty/malformed/unknown conditions, modes, provider isolation and copied issues |
| Coexisting declarations only | Known-active selected records under logical AddOn IDs feed SV0001; static activation flags remain unchanged; invalid groups excluded; known partial answers explicit | v034 tests cover selected/non-selected scopes, providers, inactive/unknown, duplicate groups and frozen independent resolutions |
| Complete public surface review | 52 beta exports by name and consumer purpose: 12 runtime values/functions, 40 type-only contracts. Original 30 retained. One requested named rule replaces an anonymous structural type without runtime change. | compiled snapshots, strict Extractor; source AST/name/inventory review in PUBLIC-SURFACE.md |
| Compatibility and ownership | Metadata schema 2 unchanged; environment/result schemas 1/1; policies remain schema 1. Static registry retains caller references; new evaluator/resolver outputs are copied. Closed-union extension risks documented. | v020–v034 regressions and positive/negative TS fixtures; five API baselines/reports |
| Migration, diagnostics and examples | Architecture, API policy, diagnostic catalog, 0.2→0.3 migration, caller policy examples and static/resolved distinctions reflect implemented behavior | reviewed docs and examples; CLI profile/JSON/source/privacy assertions |
| Distribution and licensing | All five versions/internal ranges advance together to 0.3.5; third-party lock records unchanged. One root entry per package. MIT licenses identical; no game source/assets or accidental generated files. | npm ci; check:exports; check:packages rejects anything outside LICENSE/package.json/dist/index.js/dist/index.d.ts for each workspace |
| Supported reproducible checks | npm pinned 10.9.2 in CI; Node 22/24 on Ubuntu 24.04 and Windows; ignore install scripts. Exact final SHA must pass all four jobs. | check:all, strict api:extractor, check:packages on all four jobs; links/results in #21/#7 |
| Integration protection | User selected solo-owner model; main requires PRs and all four exact Actions checks on an up-to-date branch, enforced for admins, no force/deletion/bypass | configured protection read back from GitHub; recheck at integration; chat authorization remains distinct from a GitHub approving review |

## Implemented capability boundaries

| Capability | Status and limit |
| --- | --- |
| TOC syntax/metadata | Implemented; original order, duplicate/raw paths and zero-based UTF-16 end-exclusive sources retained. Existing strict parsing rejects nonempty double-hash headings. No blanket clean-corpus claim. |
| Selection and condition meaning | Implemented under explicit caller policies. Built-in WoW loader/suffix/condition tables remain deferred until verified client evidence exists. |
| Static global registry | Implemented, same listing/coexistence behavior; conditional opt-in does not select a source. |
| Derived global resolution | Implemented; activeGlobals differs from static flags and complete concerns consumed projections/availability, not parse cleanliness or filesystem reachability. |
| Multiple provider batches | Contract and synthetic integration implemented. A real Lua/XML provider is not proved by authored batches. The producer needs only registry/diagnostics; orchestration remains in the adapter leaf. |
| Lua/XML syntax/provider | Not implemented by the SDK. Authored catalog and external candidate/oracle characterization are preparatory evidence only. |
| Filesystem reference graph | Not implemented. The local corpus runner discovers files without loading manifest references or executing Lua. |
| Game/runtime conformance | Not established by static checks or authored profiles. No game writes, client probe installation or runtime source execution performed. |

The measured local corpus is still 434 parsed TOCs, 5,242 Lua / 1,199 XML files inventoried and **zero SDK-parsed Lua/XML files**. Resolution under the authored profile gives 100 groups / 227 candidates, 98 selected / two no-matches and 160 selected active declarations/names. The run retains 19 errors / 12 warnings and exit 1. [Each remaining error is triaged](PRE-FREEZE-REVIEW.md#per-occurrence-toc-triage); #10 remains open. Synthetic data covers nonempty conditions and multi-provider behavior absent from that corpus projection.

## Change and distribution review

v0.3.0–v0.3.4 added the explicitly approved environment/identity, selector, descriptor, evaluator and resolver contracts. The pre-freeze review names ConditionEvaluationRule without changing the old inline rule fields, policy JSON or emitted adapter runtime. v0.3.5 adds no further public contract, schema or runtime behavior. All five workspace manifests/internal ranges and the corresponding lock records advance together; third-party records stay exact. Expected npm contents are verified, but no byte-identical tarball-build claim is made.

The freeze establishes the **existing core dependency rules**. It does not prohibit separately reviewed future parser/provider packages or promise that the orchestration package's name/placement is optimal for every future consumer. Actual second-provider integration must test that boundary before new dependencies are accepted. It also does not convert beta literal unions into indefinitely extensible stable wire formats.

## Remaining project and release work

1. Verify this PR's final-head supported matrix and independent review, then integrate under the recorded authorization and protection. Record post-merge main CI and source ancestry in #7. A review recommendation in COMMENTED state is not a human GitHub approval.
2. Keep #7's tag/publication item open until an explicit release decision. No tag, GitHub release or npm publish is performed by this change.
3. Continue the broader project goal through #11: implement the [approved Lua A–E boundary](https://github.com/Zilvereyes/wow-addon-sdk/issues/6#issuecomment-6920213019), then the separately reviewed XML parsing/provider and bounded reference graph. Run every eligible local file with explicit diagnostics/skips and exact source ranges. Do not request Lua A–E again.
4. Resolve #10 under an explicit tested heading/recovery policy without leaking malformed conditional SavedVariables. No silent waiver for green corpus output.

Do not mark the overall goal complete at this core milestone. `--require-all-parsers` must continue failing until actual TOC, Lua and XML parsers are implemented and invoked.

## Local candidate verification

After the synchronized 0.3.5 version/internal-range change, locked npm ci, check:all (142/142 tests), strict API Extractor and check:packages all exit 0. Architecture/dependency/API/export/license gates pass for all five packages. All 86 node_modules lock records, including five workspace links and 81 third-party records, match the integrated v0.3.4 baseline exactly. This is local candidate evidence; the PR records the exact final SHA and supported CI/review before acceptance/integration.
