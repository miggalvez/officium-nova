# ADR-004: Cache Transfer Computation at Year Granularity in Phase 2e

- **Status:** accepted
- **Date:** 2026-04-16
- **Related:** [Phase 2 Rubrical Engine Design §14, §18 (Phase 2e)](../phase-2-rubrical-engine-design.md)

## Context

Phase 2e moves transfer handling from a deferred queue to concrete, date-targeted
results. Determining a transfer target for an impeded feast is not purely local:

- A feast can move only onto a date that is not already occupied by equal/higher
  competitors.
- Whether a target date is free can depend on other transfers already assigned.
- Overlay transfer tables can override rule-computed targets.

Computing this naively per `resolveDayOfficeSummary(date)` call causes unstable
or circular behavior: day `D` may depend on day `D+N`, which may in turn depend
on previously transferred items.

## Options Considered

### Option 1 — Eager global precompute for large date ranges

Precompute transfers for multi-year ranges at startup.

- Pro: Fast runtime lookups once warmed.
- Pro: Avoids per-call recursion.
- Con: High startup cost and unnecessary work for unrequested years.
- Con: Harder to bound memory in long-lived processes.

### Option 2 — Lazy per-call transfer computation

Compute transfers only when `resolveDayOfficeSummary(date)` is called.

- Pro: Minimal upfront work.
- Pro: Conceptually simple call path.
- Con: Cross-date dependencies make correctness fragile.
- Con: Repeated recomputation across adjacent requests.
- Con: Difficult to guarantee termination without ad-hoc memoization.

### Option 3 — Year-granular materialization with engine cache

On first request for a `(version, year)`, build a `YearTransferMap` by scanning
the civil year, collecting transfer-eligible losers, computing/reconciling
targets, and indexing `transfersInto`/`transfersOutOf`; cache that map on the
engine instance.

- Pro: Correct handling of cross-date dependencies inside a bounded unit.
- Pro: Deterministic results for repeated lookups in the same year.
- Pro: Amortizes expensive work across all requests in that year.
- Con: Cold-start cost on first request of each year.
- Con: Requires fallback handling for sparse/missing upstream files.

## Decision

Use **Option 3**. Phase 2e introduces `YearTransferMap` and caches one map per
`(version.handle, year)` on the engine instance.

Each map is built once, then reused for all day resolutions in that year. The
engine consumes `transfersInto(date)` to inject `source: 'transferred-in'`
candidates and `warningsOn(date)` to surface transfer diagnostics as data.

## Consequences

- Positive: Transfer behavior is stable and reproducible per `(version, year)`.
- Positive: Overlay reconciliation is centralized and warning emission is
  consistent.
- Positive: Transfer lookups during day resolution are O(1)-style map reads.
- Negative: First resolution in a new year is heavier than subsequent calls.
- Negative: Memory grows with number of distinct years resolved per engine.
- Follow-up: Phase 2f+ can reuse the same year-map cache keying strategy for
  concurrence/hour-level cross-date concerns if needed.

## Notes

- Implementation entry point:
  `packages/rubrical-engine/src/transfer/year-map.ts`
- Cache host:
  `packages/rubrical-engine/src/engine.ts`
