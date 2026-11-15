# WoW AddOn SDK

A modular, editor-agnostic TypeScript SDK for World of Warcraft AddOn development.

WoW AddOn SDK provides reusable libraries for parsing AddOn TOC files, modeling metadata, managing global symbol declarations, and generating structured diagnostics.

The project separates syntax parsing, semantic modeling, static analysis, and editor integrations into independent, testable components.

## Architecture

```text
packages/
├── diagnostics/
├── addon-metadata/
├── toc-parser/
├── global-registry/
└── toc-metadata-adapter/
```

The architecture is designed to support future extensions, including XML and Lua parsing, dependency and reference graphs, Lua Language Server integration, VS Code extensions, and AI-assisted development tools.

## Design Principles

- Editor-independent core libraries
- Strict package dependency boundaries
- Provider-agnostic global symbol registry
- Stable, versioned TypeScript contracts
- Source-aware diagnostics with UTF-16 ranges
- Support for WoW client variants and conditional metadata
- Automated testing and architecture validation

## Development Status

Pre-1.0 — Active development

The initial implementation covers TOC parsing, AddOn metadata, and SavedVariables handling.

Version 0.2.0 introduces shared diagnostics, a generalized global registry, and a dedicated TOC metadata adapter.

Planned milestones include condition evaluation, API contract stabilization, LuaLS integration, and XML/Lua reference analysis.

## License

Licensed under the MIT License. See [LICENSE](LICENSE).

## Disclaimer

World of Warcraft and Warcraft are trademarks of Blizzard Entertainment.

This is an independent community project and is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment.
