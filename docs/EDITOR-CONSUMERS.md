# Zilvereyes WoW TOC integration

[Zilvereyes WoW TOC 0.5.0](https://github.com/Zilvereyes/vscode-wow-toc/commit/1282e2ca9ca3776ec32c4366cc145548f8a8c194) builds its SDK bundle from version `0.7.0`, revision `7b01bd0511fbe651d1234848f73140c9d012c2a9`. The extension records this revision in [sdk-source.json](https://github.com/Zilvereyes/vscode-wow-toc/blob/1282e2ca9ca3776ec32c4366cc145548f8a8c194/sdk-source.json).

| SDK API | How the editor uses it |
| --- | --- |
| `@wow-addon/toc-parser.parseToc` | Reads an explicitly selected manifest. The editor evaluates supported conditions and expands supported path variables using the workspace client and optional text locale. |
| `@wow-addon/xml-analysis.analyzeXml` | Provides `Include` and `Script` targets and their source ranges. The editor walks reachable XML and checks paths on disk. It uses the decoded `target.value` for lookup and `target.source.range` for the warning in VS Code. |
| `@wow-addon/toc-metadata-adapter.toGlobalDeclarations` | Provides SavedVariables declarations. The editor writes unconditional declarations to an editor-only Lua file for LuaLS and refreshes it when the selected TOC is saved. |

The editor owns the file layout, game policy and diagnostic lifecycle. The SDK supplies parsing and source ranges through its public beta API. The [VS Code test](https://github.com/Zilvereyes/vscode-wow-toc/blob/1282e2ca9ca3776ec32c4366cc145548f8a8c194/tests/client-aware-xml-editor.cjs) switches between Classic Era and Retail in one workspace and verifies that Problems reflects the newly selected client.

See the extension's [build instructions](https://github.com/Zilvereyes/vscode-wow-toc/blob/1282e2ca9ca3776ec32c4366cc145548f8a8c194/README.md#sdk-dependency) to reproduce the pinned build.
