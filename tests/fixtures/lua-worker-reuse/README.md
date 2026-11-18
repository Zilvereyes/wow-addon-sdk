# Bounded Lua Worker experiment

This test-only branch compares the fresh corpus-Lua Worker model on SDK `14db9ae` with the isolated candidate in the approved PR #30 experiment. The fixture generates private wrappers around the built SDK and the existing graph supervisor. Run `npm run build`, `node --test tests/fixtures/lua-worker-reuse/*.test.mjs` and `node tests/fixtures/lua-worker-reuse/measure.mjs`. The benchmark uses authored text exclusively.

The candidate handles one request at a time. It retires the Worker on the eighth request or at 4,194,304 cumulative UTF-16 units. An input above that reuse threshold receives a dedicated Worker under the existing per-file limits. The original process supervisor owns deadlines, framing, result validation and launcher rotation. Tests require an acknowledged Worker exit before replacement and before the credit of a rotation or resource result.

The pinned parser keeps its latest adapted input in module state. The candidate bounds that lifetime through the reuse and reap rules. Heap and launcher RSS samples describe the observed workloads and do not prove source erasure. The paired warm timings describe this fixture and do not establish installed corpus performance.
