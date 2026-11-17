# Remaining handler-context evidence — 2026-11-17

Baseline: PR #29 /07b79a8, runtime ab36b28. This static comparison **does not select new contexts or extend installed parsing coverage**. [The actual partial run](REVIEW-INLINE-LUA-CORPUS.md) remains654inline verdicts/mappings,685missing-context skips and14incomplete lexical bodies, exit1/incomplete. Seven selected handler kinds remain explicit caller assumptions;25kinds remain deferred. No user-authored JSON is required.

## Sources and what they prove

The pinned [Wowless Classic Era XML model](https://github.com/wowless/wowless/blob/c695caab195f06367aec63b9c7ac86241b1f390d/data/products/wow_classic_era/xml.yaml) supplies the seven selected kinds' explicit parameter rows. Its [XML evaluator](https://github.com/wowless/wowless/blob/c695caab195f06367aec63b9c7ac86241b1f390d/wowless/modules/xmleval.lua) otherwise uses a generic self/varargs fallback. That fallback is not a complete parameter table and is not selected.

An independent primary source for a **historical model** is [whoahq/whoa](https://github.com/whoahq/whoa/tree/6923b07f6c6d3d923a20c9d866c7fcb3da443b17), whose repository describes an unofficial client implementation circa2010. Its [CSimpleFrame XML path](https://github.com/whoahq/whoa/blob/6923b07f6c6d3d923a20c9d866c7fcb3da443b17/src/ui/simple/CSimpleFrame.cpp) initializes a non-variadic self-only wrapper, then obtains per-handler overrides. The selected [Button](https://github.com/whoahq/whoa/blob/6923b07f6c6d3d923a20c9d866c7fcb3da443b17/src/ui/simple/CSimpleButton.cpp), [EditBox](https://github.com/whoahq/whoa/blob/6923b07f6c6d3d923a20c9d866c7fcb3da443b17/src/ui/simple/CSimpleEditBox.cpp), [ScrollFrame](https://github.com/whoahq/whoa/blob/6923b07f6c6d3d923a20c9d866c7fcb3da443b17/src/ui/simple/CSimpleScrollFrame.cpp) and [Slider](https://github.com/whoahq/whoa/blob/6923b07f6c6d3d923a20c9d866c7fcb3da443b17/src/ui/simple/CSimpleSlider.cpp) branches provide additional overrides.

Exact Git blob checks before static inspection: Frame1e69a0cdc1f104c16f1ffca9d5c314366c330386; Buttona657ad8d4a140e84a19bbfe763a4a6299631cb71; EditBox09a7b8b86a74dce802ec3d90b78ac0b1eca136e0; ScrollFrame0a3883c1d3c00f3eb4a351ad56290128b2d2e8e2; Slider4bfbe8fa1fccdd7fb30f12134d4b7bbf7acd9db7. The private static extractor found a historical candidate for all25deferred kinds and selected **zero** for a new run. This is reviewed source extraction, not compilation or execution of third-party code, and not installed-client evidence.

## Private classification and public reference controls

The full25-row installed-vocabulary comparison stays private. Public examples below are controls drawn from the pinned reference classes, not a published installed-handler inventory. Their historical wrappers are non-variadic. `default` means the historical caller's self-only initialization, not an inferred universal game rule. No new contexts are selected.

| Handler | Historical parameters | Source branch/basis |
| --- | --- | --- |
| OnCursorChanged | self, x, y, w, h | EditBox explicit |
| OnLoad | self | Frame default |
| OnMouseDown | self, button | Frame explicit |
| OnSizeChanged | self, w, h | Frame explicit |

## Counterexamples and remaining decision/evidence

Two independently authored SDK comparisons exercise the consequence without copying third-party bodies: a self-only variadic model can misclassify assignment to `button` as a global when an explicit button parameter exists; it can also accept root varargs that a non-variadic historical wrapper rejects. [Existing-API characterization](proposals/selected-source-graph-characterization.mjs) tests both supplied contexts directly. Passing either context proves the SDK honors that input, not which context the current game supplies.

The older implementation's per-handler lookup also does not justify changing the current provider's exact expanded-name/case policy. Callback function parameter names, XML wrapper locals and handler invocation timing are separate questions. A modern client API example or a schema-listed name alone cannot establish all three.

Next evidence must bind each candidate to the intended Classic Era version and distinguish explicit XML wrapper locals/vararg permission from callback argument descriptions. Conflicting or missing evidence stays visible; a documented exploratory caller model, if later chosen, must remain labelled as such and cannot certify the client. No generic fallback, version interpolation, case normalization or new corpus success is inferred here. The independent selected-source graph design can proceed to review without hiding those685skipped bodies or closing the broader goal.
