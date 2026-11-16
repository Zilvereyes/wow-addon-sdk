# Synthetic client evidence for TOC selection

The explicit-policy selector can be implemented under the user's v0.3.1 approval. A built-in WoW loader policy still needs independent evidence. This staging-only generator prepares eight authored scenarios without asserting their winners or modifying a game installation.

```powershell
# Parent directory must already exist; output directory must be new.
# Replace the Interface argument with select(4, GetBuildInfo()) from the target client.
node scripts/create-toc-selection-probe.mjs '<new-staging-directory>' '<Interface-version>'
```

Generation refuses existing directories, missing parents and every resolved path beneath an `AddOns` directory, including junction/symlink aliases. It has no install, overwrite, delete, enabling or game-launch action. Partial staging is left intact without a ready manifest. The final `probe.ready.json` lists relative file paths, byte lengths and SHA-256 hashes. Each scenario carries the SDK MIT license. Tests use disposable authored fixtures, not installed AddOn source.

| Scenario | Candidate suffixes | Question |
| --- | --- | --- |
| EraAll | Vanilla, Classic, unsuffixed | Which candidate wins when all three exist? |
| EraFamily | Classic, unsuffixed | Does this client prefer the family variant? |
| EraSpecific | Vanilla, unsuffixed | Does this client prefer the concrete variant? |
| MainlineAll | Standard, Mainline, unsuffixed | What is the ordering of concrete/family forms? |
| MainlineFamily | Mainline, unsuffixed | Does this client prefer this family variant? |
| Unsuffixed | unsuffixed | Control: can the probe load at all? |
| FutureFallback | SDKFuture, unsuffixed | How does the loader handle an unfamiliar suffix? |
| Headings | unsuffixed with two nonempty hash headings | Does loading continue past the headings? |

The 16 TOCs point to 16 distinct marker Lua files. A loaded marker prints one `SDK_TOC_PROBE|schema=1|case=...|variant=...` line with client build/Interface/project information and the result of reading its own dotted custom metadata key. It adds no persistent variables, frame hooks, network messages or settings changes. The metadata accessor is documented in [Blizzard's generated API documentation](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/AddOnsDocumentation.lua); that API signature alone does not establish suffix precedence or Classic client behavior.

## Separate manual runtime evidence

No client run or installation has been performed by this work. Copying probe folders into an installation and enabling them requires a separate explicit user decision. Run only in a suitable test environment after checking the ready manifest and confirming the current Interface version. Preserve existing AddOns and avoid replacing folders with the same names.

For an approved manual run, record the manifest digest, exact client product/version/build/Interface, game mode, enabled probe folders, emitted markers and any load errors. The unsuffixed control must load; an absent marker alone does not distinguish a precedence rule from a disabled/outdated/erroring AddOn. Multiple markers for one case or a failed control are unresolved evidence. Restart the client between any approved fixture changes so cached TOC discovery cannot be confused with a fresh load. Retain observation and inference separately.

The generator and its outputs are covered by Node integration checks: deterministic manifests/hashes, matching TOC/marker references, expected cases, output refusal and no AddOns writes. Native Lua syntax validation is not available in the current local toolchain; no Lua execution or game-loader conformance is claimed. The corpus parser deliberately retains two TOC0001 errors for the Headings case, making it useful for the remaining comment-policy investigation.
