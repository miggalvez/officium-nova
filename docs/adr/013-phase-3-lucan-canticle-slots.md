# ADR-013: Lucan canticle structural slots for Lauds, Vespers, and Compline

- **Status:** accepted
- **Date:** 2026-04-22
- **Deciders:** Phase 3 composition engine sign-off
- **Related:** `docs/phase-2-rubrical-engine-design.md`,
  `docs/phase-3-composition-engine-design.md`,
  `packages/rubrical-engine/src/types/hour-structure.ts`,
  `packages/rubrical-engine/src/hours/skeleton.ts`,
  `packages/compositor/src/compose.ts`,
  ADR-011

## Context

The Easter-Octave Vespers frontier exposed a structural gap rather than a
date-specific composition mistake. On `2024-04-01` / `2024-04-02` in both
Roman policies, the composed stream emitted the proper Magnificat
antiphon and then jumped directly to the office collect.

The source-backed comparison expected:

1. the Magnificat antiphon,
2. the full Lucan canticle body (`Canticum B. Mariæ Virginis`,
   `Luc. 1:46-55`, verses, `Glória Patri`),
3. the repeated antiphon,
4. only then the `Dómine, exáudi... / Orémus` oration prelude.

The root cause lived at the Phase 2 / Phase 3 boundary:

- `#Canticum: Magnificat` in `Ordinarium/Vespera.txt` mapped only to
  `antiphon-ad-magnificat`.
- `DayOfficeSummary.hours.vespers.slots` therefore had no typed place to
  carry the Magnificat body itself.
- Phase 3 could not compose the canticle without either hardcoding
  hour-specific control flow or reaching back into the Ordinarium for an
  implicit missing block.

The same structural pattern exists for `#Canticum: Benedictus` at Lauds
and `#Canticum: Nunc dimittis` at Compline, even if those seams are not
yet the live compare frontier.

## Options Considered

### Option A — Teach the existing antiphon slots to emit canticle bodies

Have `antiphon-ad-benedictus` / `antiphon-ad-magnificat` /
`antiphon-ad-nunc-dimittis` compose the antiphon, the canticle body, and
the closing antiphon in one Phase 3-specific branch.

- Pro: No Phase 2 schema change.
- Con: Blurs antiphon-vs-canticle ownership into one overloaded slot.
- Con: Harder for downstream clients to reason about section structure.
- Con: Violates the typed-seam preference that Phase 2 carries structure
  and Phase 3 composes it.

### Option B — Smuggle the Lucan canticle body through `psalmody`

Treat the canticle as a special psalmody segment after the major-hour
antiphon.

- Pro: Reuses existing psalmody composition machinery.
- Con: Semantically wrong: Magnificat/Benedictus/Nunc dimittis are not
  part of the psalmody slot in the Ordinarium skeleton.
- Con: Forces Phase 2 to mutate the major-hour psalmody model to
  represent a later-block seam.

### Option C — Add dedicated Lucan canticle slots

Add `canticle-ad-benedictus`, `canticle-ad-magnificat`, and
`canticle-ad-nunc-dimittis` to `SlotName`, map the three `#Canticum:`
headings to paired antiphon + canticle slots, and let Phase 2 populate
the canticle slots with fixed Psalm231 / Psalm232 / Psalm233 refs.

- Pro: Keeps Phase 2 responsible for structure and Phase 3 for faithful
  composition.
- Pro: Solves the Easter-Octave Vespers seam without date hacks.
- Pro: Gives the same typed lane to Lauds and Compline when their Lucan
  canticle seams become live.
- Con: This is a cross-package schema change and requires coordinated
  code + doc updates.

## Decision

**Option C.**

Phase 2 now exposes explicit Lucan canticle slots:

- `canticle-ad-benedictus` → `horas/Latin/Psalterium/Psalmorum/Psalm231:__preamble`
- `canticle-ad-magnificat` → `horas/Latin/Psalterium/Psalmorum/Psalm232:__preamble`
- `canticle-ad-nunc-dimittis` → `horas/Latin/Psalterium/Psalmorum/Psalm233:__preamble`

The Ordinarium skeleton maps each `#Canticum:` heading to the existing
antiphon slot plus the new canticle slot in order.

Phase 3 composes the canticle slots by:

1. resolving the fixed Lucan canticle text,
2. appending `Glória Patri` through the same deferred-node path used by
   psalmody,
3. splitting the corpus title line into heading + citation,
4. preserving the verse-per-line stream,
5. repeating the sibling canticle antiphon after the canticle body.

## Consequences

- **Positive:** The Easter-Octave Vespers Magnificat/oration seam closes
  at the owning structural layer instead of by special-casing dates.
- **Positive:** The model now has a typed place for the Lucan canticle
  body, which downstream clients can render distinctly from the antiphon
  and the oration block.
- **Positive:** Future Lauds / Compline canticle work can reuse the same
  slot family instead of reopening the schema.
- **Negative:** Phase 2 / Phase 3 docs and the slot/section unions both
  widen.
- **Follow-up:** The next live Vespers family after this fix is the
  shared `Dómine, exáudi oratiónem meam` prelude before the oration.
  This ADR does not decide that boundary; it only restores the missing
  Lucan canticle block.
