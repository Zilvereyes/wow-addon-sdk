# Authored Lua/XML syntax fixtures

`lua-xml-syntax.json` is test input for the actual parser work tracked in [issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11). It contains 24 Lua and 27 XML cases. All source strings were independently authored for this project. No installed AddOn source is included.

The catalog does not implement, invoke or prove an SDK Lua/XML parser. It is not yet consumed by the SDK test runner. Future parser tests must read every row, call the real public parser and assert the recorded outcome. They must fail if a language, row or required capability is skipped. Catalog/schema/range checks alone cannot satisfy three-parser acceptance.

## Meaning of the expectations

Lua `syntax` refers to the [Lua 5.1 language specification](https://www.lua.org/manual/5.1/manual.html#2). Cases exercise strings/comments, declarations, tables, arithmetic, blocks, functions, varargs and rejection of selected later-version constructs. For example, `goto` is an identifier in Lua 5.1; a goto statement is not part of that grammar. These expectations do not claim Classic Era host/dialect verification, inferred global availability or runtime safety. L13 must only be parsed; its ordinary function call is never invoked.

XML uses three separate axes:

- `wellFormed` follows [XML 1.0 fifth edition](https://www.w3.org/TR/xml/). This alone permits colon-containing names without namespace processing.
- `namespaceWellFormed` additionally follows [Namespaces in XML 1.0 third edition](https://www.w3.org/TR/xml-names/). Null means that malformed XML already prevents a complete namespace verdict. X10/X11/X24/X25 deliberately separate these axes.
- `profile` specifies the proposed SDK DTD prohibition. A document may be well-formed XML and still fail this explicit input policy. DTD rejection must occur before any external reference resolution or custom entity expansion. A DOCTYPE-looking string inside CDATA is ordinary text, as demonstrated by X07.

The XML cases establish no WoW UI schema, frame inheritance, client loading order or XSD validation. Attribute/default-namespace handling must be tested independently from element namespaces. Any recovered/partial tree must retain diagnostics and incomplete status.

## Original source spans

`spans` are selected independently calculated reference points. `offsets` are zero-based UTF-16 code-unit offsets with an exclusive end; `start`/`end` are zero-based `[line, UTF-16 column]` positions, also end-exclusive. CRLF is one line break; lone CR and LF also start a new line. Original source text is never normalized before checking these spans. Raw slices must equal `raw` exactly.

L10 and X05 distinguish UTF-16 columns from Unicode code points and UTF-8 byte offsets. X27 distinguishes the raw numeric-entity span from its decoded two-code-unit value. Future inline-Lua mapping must use a complete decoded-to-raw map; a single example entity span is not evidence that that mapping is implemented.

## Scope of independent checks

Use non-executing oracles with their runtime/version/policy recorded. XML checks should cover both ordinary well-formedness and namespaces; DTDs and external resolution stay disabled. Lua checks must explicitly target 5.1. An unavailable oracle remains unavailable rather than being replaced by source execution or a different language version.

The larger acceptance matrix in [issue #11](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6917397547) also requires scope/provider extraction, malformed recovery, byte/node/depth limits, include traversal, environment resolution and stable installed-corpus counts. This syntax catalog is one prerequisite of that full outcome.

## Independent check record: 2026-11-16

All 27 XML cases matched their expected outcomes in both non-executing checks:

| Oracle | Expected acceptance / rejection | Runtime and policy |
| --- | --- | --- |
| PowerShell Workbench XML adapter | 15 / 12 | Python 3.13.17, Expat 2.8.5; ordinary well-formedness, DTD/entities prohibited, no namespace processing |
| .NET XmlReader | 11 / 16 | .NET 10.0.15; namespaces checked, DtdProcessing.Prohibit, XmlResolver=null, ValidationType.None, document/entity character caps |

The four additional namespace rejections are X10/X11/X24/X25. Both checks reject the three DTD-policy cases before any external resolution; they do not independently establish those documents' unrestricted DTD validity. Five selected raw UTF-16 slices and line/column spans were also checked against the literal source strings. No fixture source was executed.

The Workbench worker matched its published catalog SHA-256 `961f1f6dc4b4f4b24c0c295f6cf847e735715e29184bf8ab842f33c32065da42`. These external checks were run locally on synthetic data; no new SDK or CI dependency is introduced. Lua 5.1 oracle execution remains unavailable because lua/luac is not installed. The 24 Lua expectations derive from the specified grammar and still require executable parser verification.
