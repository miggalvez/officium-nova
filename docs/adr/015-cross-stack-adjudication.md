# ADR-015: Cross-stack validation and reviewer feedback adjudication

- **Status:** accepted
- **Date:** 2026-04-28
- **Deciders:** Phase 5 validation implementation
- **Related:** [Phase 5 validation strategy](../phase-5-validation-strategy-reviewer-feedback-loop.md), [Phase 2 rubrical engine design](../phase-2-rubrical-engine-design.md), [Phase 3 composition engine design](../phase-3-composition-engine-design.md), [Phase 4 API design](../phase-4-API-design.md), [ADR-011](011-phase-3-divergence-adjudication.md), [ADR-014](014-http-api-version-language-contract.md), [Rubrical sources](../rubrical-sources.md)

## Context

Phase 5 changes the validation problem from package-local proof to project-wide
quality control. Phase 1 proves corpus parsing, Phase 2 proves rubrical
decisions, Phase 3 proves Hour composition, and Phase 4 proves the public JSON
contract. A real user, however, receives the result of the whole stack:

```text
Parser -> Rubrical Engine -> Compositor -> API -> client
```

ADR-011 already gives the compositor a durable sidecar protocol for divergence
rows against the legacy Perl renderer. That protocol is intentionally
Perl-aware but not Perl-subordinate: legacy output is a comparison artifact, not
the source of truth. Phase 5 needs the same principle across parser fixtures,
rubrical-engine snapshots, compositor ledgers, API contract tests, cross-stack
E2E snapshots, and reviewer-submitted reports.

Reviewer feedback adds a new kind of evidence. It can identify real liturgical
errors that package tests missed, but it is not itself an authority unless it
records a formal consultation for an otherwise ambiguous case. Without a shared
authority order, citation object, privacy rule, and CI threshold model,
reviewer reports and divergence sidecars could drift into incompatible local
formats.

## Options Considered

### Option A - Keep ADR-011 local to the compositor

*Leave existing package fixtures independent and handle reviewer reports by
maintainer judgment.*

- Pro: No migration pressure on existing sidecars or tests.
- Pro: Fastest path to accepting individual reviewer reports.
- Con: Cross-stack reports would not have a stable schema or owner.
- Con: Citation requirements would vary by package.
- Con: CI could not audit adjudicated rows consistently.

### Option B - Centralize all validation artifacts in one validation package

*Move adjudications, report fixtures, goldens, and audits into
`packages/validation`.*

- Pro: One package owns all Phase 5 checks and schemas.
- Pro: CI wiring is straightforward.
- Con: Package-local tests lose proximity to the code they protect.
- Con: Existing compositor and rubrical-engine workflows would need disruptive
  migrations before Phase 5 can start.
- Con: A central package could become a second owner of package behavior.

### Option C - Shared protocol with package-owned fixtures

*Define one cross-stack adjudication protocol, but leave concrete fixtures and
regression tests in the package that owns the behavior.*

- Pro: Preserves parser, engine, compositor, and API validation boundaries.
- Pro: Lets `packages/validation` own shared schemas, audits, reviewer privacy
  checks, and small cross-stack E2E tests.
- Pro: Extends ADR-011 without forcing immediate migration of every existing
  sidecar entry.
- Con: Requires audits to understand multiple artifact locations.
- Con: Existing sidecars need either migration or explicit migration
  exceptions.

## Decision

Use **Option C: shared protocol with package-owned fixtures**.

Phase 5 defines the authority hierarchy, classification taxonomy, citation
object, reviewer-report privacy rule, package ownership model, and CI threshold
states. The owning package keeps the fixture or regression test that proves its
own behavior. The validation package owns shared schemas, citation audits,
reviewer privacy audits, and small consumer-facing E2E tests that prove the
public route through the whole stack.

### Authority hierarchy

Adjudication authority is ordered as follows:

1. Published Ordo Recitandi for the relevant year, community, and calendar
   scope.
2. Governing rubrical books, including the source families indexed in
   `docs/rubrical-sources.md`.
3. Published breviaries and dispositive source corpus lines, when they directly
   attest the disputed text, structure, or source fact.
4. In-repo ADRs or recorded expert consultations, only where the preceding
   sources are genuinely ambiguous or incomplete.
5. Legacy Perl output, as a comparison artifact only.

No accepted divergence or reviewer report may be resolved by "matching Perl"
alone.

### Classification taxonomy

Every adjudicated row or accepted reviewer report carries exactly one
classification:

| Classification | Meaning | Fixture owner |
|---|---|---|
| `parser-bug` | Corpus parsing, reference resolution, section identity, or language-block handling is wrong. | `parser` |
| `engine-bug` | Celebration, commemoration, transfer, concurrence, rank, color, or Hour structure is wrong. | `rubrical-engine` |
| `compositor-bug` | The day decision is right, but Hour composition emits wrong text, structure, order, directive, warning, or slot expansion. | `compositor` |
| `api-bug` | Public request handling, DTO shape, language mapping, cache behavior, error model, or serialization is wrong. | `api` or `validation` |
| `corpus-bug` | The source corpus contains an error or inconsistency. | corpus patch or upstream tracking |
| `perl-bug` | Officium Novum matches the primary source; legacy Perl disagrees. | `docs/upstream-issues.md` tracking |
| `ordo-ambiguous` | Ordo and governing books do not decide the case clearly. | ADR or consultation-backed fixture |
| `source-ambiguous` | Corpus or breviary witnesses conflict or are incomplete. | ADR or source-note fixture |
| `rendering-difference` | Surface-only difference with no liturgical effect. | owning package sidecar |
| `report-invalid` | Reviewer report is malformed, unsupported, not reproducible, or contrary to the cited source. | report index |
| `duplicate` | Same issue as an earlier report or row. | report index or sidecar link |

### Citation object

Accepted adjudications use a structured citation object. Package sidecars may
retain older local shapes temporarily, but Phase 5 audits should report which
entries still need migration.

```yaml
citation:
  sourceType: ordo | rubrical-book | breviary | corpus | adr | consultation | reviewer-report | none
  sourceId: null
  edition: null
  publisher: null
  page: null
  section: null
  paragraph: null
  corpusPath: null
  lineStart: null
  lineEnd: null
  adr: null
  reportId: null
  archiveRef: null
  checksum: null
  excerptPolicy: none | brief-public-excerpt | private-only
```

`parser-bug`, `engine-bug`, `compositor-bug`, `api-bug`, `corpus-bug`,
`perl-bug`, `ordo-ambiguous`, and `source-ambiguous` require a non-`none`
citation. `report-invalid` and `duplicate` require a precise reason or link to
the canonical report or row.

### Reviewer privacy rule

Public reviewer reports may be committed only after private identity, contact,
affiliation, and qualification details have been removed unless the reviewer
explicitly opted into public attribution. Private details live outside the
public repository. Public artifacts refer to reviewer reports by stable report
ID.

### Package ownership

- Parser fixtures own parser and source-resolution regressions.
- Rubrical-engine fixtures own celebration, transfer, concurrence,
  commemoration, rank, and Hour-structure regressions.
- Compositor fixtures own Hour assembly, emitted text structure, directives,
  warnings, and composition divergence ledgers.
- API fixtures own public route, DTO, language, cache, ETag, and error-contract
  regressions.
- Validation fixtures own cross-stack consumer-path regressions and shared
  schema/audit checks.
- Documentation owns reviewer report indices, upstream issue tracking, and ADRs
  for ambiguous source decisions.

### CI thresholds

Phase 5 uses three promotion states for year-scale validation:

| State | CI behavior | Threshold |
|---|---|---|
| `exploratory` | Informational only. | May contain unadjudicated rows. |
| `candidate` | Blocks on no-throw and schema failures. | Fewer than 10 unadjudicated rows per policy/year during promotion. |
| `gated` | Blocks normal PRs. | 0 unadjudicated rows for included policies/years. |

The 2024 Roman baseline is already burned down and remains gated at 0
unadjudicated rows. The candidate threshold is only a transition allowance for
new years; it does not relax existing baselines.

## Consequences

- Positive: Phase 5 has one authority model without flattening package
  ownership.
- Positive: Reviewer feedback can become durable fixtures without exposing
  private reviewer data.
- Positive: The validation package can audit schemas and privacy while
  package-local tests keep proving the behavior closest to their code.
- Positive: Existing ADR-011 compositor adjudications remain useful during
  migration.
- Negative: Audits must handle both structured Phase 5 citations and temporary
  legacy sidecar shapes.
- Negative: Maintainers must keep public report IDs, sidecar entries, and
  fixtures linked when a report lands.
- Follow-up work: create `packages/validation` with schemas and audits; add the
  reviewer issue template and public report index; migrate or explicitly
  except existing sidecars; add the small cross-stack E2E matrix.
- Revisit trigger: if future non-Roman families are implemented, each family
  must receive its own source index, reviewer assumptions, and promotion
  thresholds before entering the gated Phase 5 set.

## Notes

This ADR accepts the decisions described in the Phase 5 validation strategy.
Phase 2, Phase 3, and Phase 4 documents remain authoritative for their
package-local validation strategies; this ADR governs the cross-stack protocol
that connects them.
