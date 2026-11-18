# Zilvereyes WoW TOC integration

[Zilvereyes WoW TOC 0.5.0](https://github.com/Zilvereyes/vscode-wow-toc/commit/1282e2ca9ca3776ec32c4366cc145548f8a8c194) builds its SDK bundle from version `0.7.0`, revision `7b01bd0511fbe651d1234848f73140c9d012c2a9`. The extension records this revision in [sdk-source.json](https://github.com/Zilvereyes/vscode-wow-toc/blob/1282e2ca9ca3776ec32c4366cc145548f8a8c194/sdk-source.json).

| SDK API | How the editor uses it |
| --- | --- |
| `@wow-addon/toc-parser.parseToc` | Reads an explicitly selected manifest. The editor evaluates supported conditions and expands supported path variables using the workspace client and optional text locale. |
| `@wow-addon/xml-analysis.analyzeXml` | Provides `Include` and `Script` targets and their source ranges. The editor walks reachable XML and checks paths on disk. It uses the decoded `target.value` for lookup and `target.source.range` for the warning in VS Code. |
| `@wow-addon/toc-metadata-adapter.toGlobalDeclarations` | Provides SavedVariables declarations. The editor writes unconditional declarations to an editor-only Lua file for LuaLS and refreshes it when the selected TOC is saved. |

The editor owns the file layout, game policy and diagnostic lifecycle. The SDK supplies parsing and source ranges through its public beta API. The [VS Code test](https://github.com/Zilvereyes/vscode-wow-toc/blob/1282e2ca9ca3776ec32c4366cc145548f8a8c194/tests/client-aware-xml-editor.cjs) switches between Classic Era and Retail in one workspace and verifies that Problems reflects the newly selected client.

See the extension's [build instructions](https://github.com/Zilvereyes/vscode-wow-toc/blob/1282e2ca9ca3776ec32c4366cc145548f8a8c194/README.md#sdk-dependency) to reproduce the pinned build.

## VS Code 0.6.0 desktop verification

A disposable Windows extension-development profile ran the exact [0.6.0 editor revision](https://github.com/Zilvereyes/vscode-wow-toc/commit/542c6f53151379743c1bdcc77bf034dc9184d1fc) with VS Code 1.146.0. The archived extension reused the previously verified bundle for identical [SDK 0.7.0 pin](https://github.com/Zilvereyes/vscode-wow-toc/blob/542c6f53151379743c1bdcc77bf034dc9184d1fc/sdk-source.json) `7b01bd0511fbe651d1234848f73140c9d012c2a9`, bundle SHA-256 `dcc87965f8fa64ee5210cf00ce456ebc5b62a55fd9e4efce17e58564a4f87f3d`. The separate [Windows and Ubuntu editor CI jobs](https://github.com/Zilvereyes/vscode-wow-toc/actions/runs/44278382066) freshly built that pin. Host session 10411 exited 0 in the local desktop probe.

The authored Classic Era manifest selected one XML file with an existing Include, a missing Include after an astral character, and a Script whose exact lookup raised an injected `EACCES`. A separate XML entry had an unknown client condition. VS Code produced one `WOWTOC001` warning on the raw entity-encoded missing Include attribute value, at zero-based UTF-16 line 1, columns 29–46 with an exclusive end. The lower-level report recorded the blocked Script as `unverifiable` and the existing Include as `found`. The unknown-condition entry produced no warning and no target lookup. This was a disposable authored workspace with an injected permission error. [Editor contract and pin](https://github.com/Zilvereyes/vscode-wow-toc/blob/542c6f53151379743c1bdcc77bf034dc9184d1fc/xml-references.cjs)
