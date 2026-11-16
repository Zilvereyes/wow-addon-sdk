# Local AddOn corpus testing

The runner reads an explicitly supplied local directory. It discovers every TOC variant, including library/test manifests; it does not infer which are loaded by the client. Lua/XML files are inventoried but are **not parsed**. Nothing is executed, written back, copied or uploaded from that directory.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>'
# Full-parser acceptance must fail until Lua and XML parsers exist:
npm run test:corpus -- '<local-Classic-Era-AddOns-directory>' --require-all-parsers
```

`scripts/Test-WoWAddonCore.ps1 -AddOnsPath '<directory>'` first runs the SDK gates and then this optional local check. `-SkipInstall` reuses the current installation. Node 22+ and PowerShell 7 are required for that wrapper; CI uses Node 22/24 and npm 10.9.2.

## What is checked

1. Enumerate deterministically; skip file/directory links and junctions, reporting incomplete coverage.
2. Read regular `.toc` files only, case-insensitive extension matching. Do not follow paths referenced inside TOCs.
3. Parse via the public `parseToc()` API, retain every variant and count diagnostics by code/severity.
4. Assert metadata schema 2, exact TOC identity, JSON roundtrip and bounds/order of all source references, including conditions and related diagnostics.
5. Emit aggregate JSON only: no absolute/relative paths, AddOn names, source text, variable names or diagnostic messages.
6. Distinguish a passing TOC smoke test from full parsing. `parsed.lua` and `parsed.xml` remain zero and `fullParsing` remains false.

Limits default to 100,000 visited entries, 8 MiB per TOC and depth 64. Override the first two with positive safe integers using `--max-entries N` and `--max-file-bytes N`. A limit, read failure or invariant failure produces incomplete coverage and nonzero exit; it cannot silently pass. Run against a stable installation without simultaneous file changes. Enumeration is bounded, but this is not a hostile-filesystem sandbox or a game loader emulator.

| Exit | Meaning |
| --- | --- |
| 0 | All discovered TOCs processed; no parser errors or incomplete coverage. Warnings may remain. Lua/XML still unimplemented. |
| 1 | Parser errors, invariant/read failures, incomplete coverage, zero parsed TOCs, invalid root, or requested parsers unavailable |
| 2 | Invalid command-line arguments |

Synthetic tests cover BOM/mixed endings/Unicode, multiple variants, source privacy, no execution, unchanged file content, malformed TOCs, links, empty/missing roots and limits. CI uses only authored temporary fixtures. A smoke test is not an independent correctness oracle for every parsed declaration; targeted regressions remain necessary.

## Measured baseline: 2026-11-16

The local installed Classic Era corpus contained 101 top-level AddOn directories and 12,714 visited entries:

| Measurement | Result |
| --- | --- |
| TOC files parsed | 434 / 434 |
| Lua files inventoried / parsed | 5,242 / 0 |
| XML files inventoried / parsed | 1,199 / 0 |
| Source references checked | 51,673 |
| SavedVariable declarations retained | 347 |
| Skipped links / oversized TOCs | 0 / 0 |
| TOC0001 errors / TOC0004 warnings | 194 / 12 |
| Exit/status | 1 / failed due to parser diagnostics |

No parser crash, JSON or range assertion failed. Of the 194 malformed-directive diagnostics, 193 concern bare `##` lines or human section headings without colons; one concerns a dotted custom directive name. These are **compatibility candidates**, not proof that the installed AddOns are broken. Investigate them with independent synthetic examples and documented syntax before changing parser behavior. Do not waive errors or rewrite third-party manifests to make the run green.

Only aggregate counts are suitable for the public issue/PR. Keep the installation path and any detailed local source inspection private. The follow-up plan separates TOC fidelity, Lua syntax, XML syntax, reference traversal and loader/runtime behavior.
