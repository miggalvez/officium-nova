# ADR-006: Ordinarium skeleton cache keyed on `(version.handle, hour)`

- **Status:** accepted
- **Date:** 2026-04-16
- **Deciders:** Phase 2g-α implementation pass
- **Related:** `docs/phase-2-rubrical-engine-design.md` §16.1, `packages/rubrical-engine/src/hours/skeleton.ts`

## Context

Each Hour structurer in Phase 2g (`structureLauds`, `structureVespers`,
`structurePrime`, etc.) starts from an **Ordinarium skeleton** — the ordered
list of slots (`hymn`, `psalmody`, `chapter`, …) parsed from the shared
`horas/Ordinarium/<Hour>.txt` file. Parsing produces the same output every
time: the file is immutable across a corpus load, and the mapping from
section headers to `SlotName` values is deterministic.

Engines call `resolveDayOfficeSummary` repeatedly — once per date, often across
whole liturgical years (e.g. the Phase 2c/2d/2e/2f integration suites).
Re-parsing the Ordinarium on every call means:

- Re-running the parser pipeline on a ~100-line file.
- Re-walking `__preamble` TextContent entries to find `heading` markers.
- Re-allocating the `readonly` slot arrays.

The cost is small per call but non-trivial when multiplied across hundreds of
dates × seven Hours. More importantly, the skeleton is a pure function of
`(version, hour)` — caching it does not introduce staleness.

## Options Considered

### Option A — No cache; reparse per call

*Each `resolveDayOfficeSummary` re-walks the Ordinarium file.*

- Pro: simplest to reason about — no shared state.
- Con: wastes cycles on an invariant structure.
- Con: measurable slowdown on range queries and snapshot suites.

### Option B — Module-level cache

*Static `Map` in `skeleton.ts`; entries keyed on `${versionHandle}::${hour}`.*

- Pro: universal; every engine benefits.
- Con: cache outlives engine instances — test isolation problems, pollution
  across reloads.
- Con: surprising ownership: a file imported for its types also hoards state.

### Option C — Per-engine `OrdinariumSkeletonCache` instance

*The engine instance owns one `Map<string, OrdinariumSkeleton>`; `hours/skeleton.ts`
exports the class but not a shared singleton.*

- Pro: cache lifetime matches engine lifetime.
- Con: each engine pays the first-miss cost independently.
- Pro: no global state; tests and long-running services can instantiate
  multiple engines without crosstalk.

## Decision

**Option C.** `OrdinariumSkeletonCache` is instantiated inside
`createRubricalEngine` and keyed on `${version.handle}::${hour}`. All seven
non-Matins Hour structurers go through `skeletonCache.get(...)` (or
`getOrEmpty` for tolerance when the Ordinarium file is absent from the
corpus, e.g. in unit test fixtures).

This matches the precedent set by ADR-004 (per-engine year-transfer-map
cache) and ADR-005 (per-engine day-preview cache): state that is deterministic
under the engine's configuration lives on the engine, not in module globals.

## Consequences

- Positive: Phase 2g-α integration suite stays under the 240s ceiling of
  earlier phases; reuse across the seven Hours amortises the parse.
- Positive: instantiating a second engine (e.g. to cross-check 1960 vs. 1955
  outputs) does not see a stale cache from the first.
- Negative: first call per `(version, hour)` still pays the parse cost. For a
  single-day query that is seven misses on the first call, zero thereafter —
  acceptable.
- Follow-up: Matins (Phase 2g-β) gains an entry for `matins` using the same
  cache, no API change required.
- Revisit triggers: if a future policy mutates the Ordinarium per date (none
  currently do); if the skeleton grows date-dependent slots (none currently
  do); if we move to a pull-based streaming parse where caching is moot.

## Notes

- `getOrEmpty` returns a frozen empty skeleton plus a `missing` flag when the
  corpus does not contain the requested Ordinarium file. The engine treats
  this as a `hour-skeleton-missing` warning rather than a throw, so test
  fixtures that seed only the feast and psalter files continue to resolve.
- The cache is explicitly not exposed through `summary` — consumers have no
  reason to care about the skeleton directly; they consume the derived
  `HourStructure`.
