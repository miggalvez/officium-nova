# ADR-003: Non-1960 Occurrence Hooks Throw `UnsupportedPolicyError` in Phase 2c

- **Status:** accepted
- **Date:** 2026-04-15
- **Related:** [Phase 2 Rubrical Engine Design §11, §18 (Phase 2c and 2h)](../phase-2-rubrical-engine-design.md)

## Context

Phase 2c adds real occurrence resolution for the 1960 rubrics. That requires
new `RubricalPolicy` hooks (`precedenceRow`, `applySeasonPreemption`,
`compareCandidates`, `isPrivilegedFeria`, `octavesEnabled`) so the resolver can
stay policy-agnostic.

Only `rubrics-1960` is implemented in Phase 2c. The other policy families
(`divino-afflatu`, `reduced-1955`, monastic variants, etc.) are explicitly
deferred to Phase 2h by design §18.

We still need clear runtime behavior for engines bound to non-1960 versions in
the interim.

## Options Considered

### Option 1 — Keep new policy hooks required and throw at runtime for non-1960

Implement all new methods on every policy object now; non-1960 methods throw a
typed `UnsupportedPolicyError` with policy + feature information.

- Pro: Keeps `RubricalPolicy` structurally complete and avoids optional-call
  branching in the resolver.
- Pro: Fails loudly and specifically when unsupported behavior is exercised.
- Pro: Preserves compile-time pressure to implement all hooks for Phase 2h.
- Con: Non-1960 engines construct successfully but fail at resolution time.

### Option 2 — Make new policy hooks optional

Mark occurrence hooks optional and have resolver/engine guard each call.

- Pro: Non-1960 policies can omit unimplemented methods without throwing.
- Pro: Smaller short-term policy stubs.
- Con: Spreads `undefined` checks across resolver call-sites.
- Con: Weakens the policy contract and makes Phase 2h omissions easier to miss.
- Con: Produces less precise runtime diagnostics unless each missing hook is
  independently checked.

## Decision

Use **Option 1**: keep the expanded `RubricalPolicy` interface required and use
`UnsupportedPolicyError`-throwing stubs for non-1960 policies during Phase 2c.

This preserves one strict policy contract while making Phase 2c scope
boundaries explicit. Engines for non-1960 versions remain constructible (useful
for registry and overlay coverage), but occurrence resolution fails immediately
with a clear, typed message indicating which feature is deferred.

## Consequences

- Positive: `resolveOccurrence` remains simple and does not branch on optional
  hooks.
- Positive: Phase 2h implementation work is obvious: replace throwing stubs with
  real policy behavior.
- Positive: Test coverage can assert explicit failure mode for non-1960
  versions.
- Negative: Callers invoking day resolution on non-1960 versions before Phase 2h
  get a runtime exception by design.
- Follow-up work: implement full non-1960 occurrence policies in Phase 2h and
  retire the throwing stubs.
- Revisit trigger: if a future phase requires partial-resolution behavior for
  unsupported policies rather than fail-fast behavior.

## Notes

- Implementation helpers: `packages/rubrical-engine/src/policy/_shared/unsupported-occurrence.ts`
- Policy wiring: `packages/rubrical-engine/src/version/policy-map.ts`
