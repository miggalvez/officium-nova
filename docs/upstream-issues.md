# Upstream Perl Issues

This document tracks divergences between Officium Novum and the legacy
Divinum Officium Perl renderer that are classified as `perl-bug` under
the adjudication protocol in [ADR-011](./adr/011-phase-3-divergence-adjudication.md).

## Protocol

Every entry below represents an adjudicated `perl-bug` family from
`packages/compositor/test/divergence/adjudications.json` — i.e., a set
of stable divergence rows where Officium Novum matches the primary
source (Ordo Recitandi, governing rubrical book, or the live corpus file
itself) and the legacy Perl renderer diverges.

Each entry must cite:

- The affected date / Hour / policy row keys.
- The primary source establishing the expected behaviour.
- A brief reproduction recipe using the `compare:phase-3-perl` harness.

These entries are intended as upstream bug reports; if the Divinum
Officium project accepts and fixes any of them, remove the corresponding
entry here and re-run the adjudication harness.

## Current entries

### 2026-04-19 — Divino Afflatu opening rubric prose is dropped by the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under `Divino Afflatu - 1954`, the compositor emits opening
rubric prose such as `Deinde, clara voce, dicitur Versus:` and
`Secus absolute incipiuntur, ut sequitur:` because those lines are
present verbatim in the upstream Latin corpus. The legacy Perl
comparison surface drops them and advances directly to the next visible
text, which creates shallow divergences across Matins, Lauds, Prime,
Terce, Sext, None, and Vespers.

**Primary source.**
`upstream/web/www/horas/Latin/Psalterium/Common/Rubricae.txt:50-65`

Relevant sections:
- `Secus absolute Parvum`
- `Clara voce`
- `Secus absolute`

These sections explicitly contain the rubric sentences that the
compositor preserves.

**Reproduction.**
Run:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Divino Afflatu - 1954"
```

Then inspect the first divergent rows in
`packages/compositor/test/divergence/divino-afflatu-2024.md`. The Perl
side shows `_` or jumps to `Nocturnus I`, while the compositor shows the
source-backed rubric prose from `Common/Rubricae.txt`.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Divino Afflatu - 1954 | 2024-01-01 | Matins | `919de480` |
| Divino Afflatu - 1954 | 2024-01-01 | Lauds | `371d9deb` |
| Divino Afflatu - 1954 | 2024-01-01 | Prime | `919de480` |
| Divino Afflatu - 1954 | 2024-01-01 | Terce | `919de480` |
| Divino Afflatu - 1954 | 2024-01-01 | Sext | `919de480` |
| Divino Afflatu - 1954 | 2024-01-01 | None | `919de480` |
| Divino Afflatu - 1954 | 2024-01-01 | Vespers | `919de480` |
| Divino Afflatu - 1954 | 2024-01-06 | Matins | `f8b9b84f` |
| Divino Afflatu - 1954 | 2024-01-06 | Lauds | `371d9deb` |
| Divino Afflatu - 1954 | 2024-01-06 | Prime | `919de480` |
| Divino Afflatu - 1954 | 2024-01-06 | Terce | `919de480` |
| Divino Afflatu - 1954 | 2024-01-06 | Sext | `919de480` |
| Divino Afflatu - 1954 | 2024-01-06 | None | `919de480` |
| Divino Afflatu - 1954 | 2024-01-06 | Vespers | `919de480` |
| Divino Afflatu - 1954 | 2024-01-07 | Matins | `919de480` |
| Divino Afflatu - 1954 | 2024-01-07 | Lauds | `371d9deb` |
| Divino Afflatu - 1954 | 2024-01-07 | Prime | `919de480` |
| Divino Afflatu - 1954 | 2024-01-07 | Terce | `919de480` |
| Divino Afflatu - 1954 | 2024-01-07 | Sext | `919de480` |
| Divino Afflatu - 1954 | 2024-01-07 | None | `919de480` |
| Divino Afflatu - 1954 | 2024-01-07 | Vespers | `919de480` |
| Divino Afflatu - 1954 | 2024-01-13 | Matins | `919de480` |
| Divino Afflatu - 1954 | 2024-01-13 | Lauds | `371d9deb` |
| Divino Afflatu - 1954 | 2024-01-13 | Prime | `919de480` |
| Divino Afflatu - 1954 | 2024-01-13 | Terce | `919de480` |
| Divino Afflatu - 1954 | 2024-01-13 | Sext | `919de480` |
| Divino Afflatu - 1954 | 2024-01-13 | None | `919de480` |
| Divino Afflatu - 1954 | 2024-01-13 | Vespers | `919de480` |
| Divino Afflatu - 1954 | 2024-01-14 | Matins | `919de480` |
| Divino Afflatu - 1954 | 2024-01-14 | Lauds | `371d9deb` |
| Divino Afflatu - 1954 | 2024-01-14 | Prime | `919de480` |
| Divino Afflatu - 1954 | 2024-01-14 | Terce | `919de480` |
| Divino Afflatu - 1954 | 2024-01-14 | Sext | `919de480` |
| Divino Afflatu - 1954 | 2024-01-14 | None | `919de480` |
| Divino Afflatu - 1954 | 2024-01-14 | Vespers | `919de480` |

### 2026-04-19 — Rubrics 1960 January fallback-hymn doxology substitution is dropped by the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under `Rubrics 1960 - 1960`, the January Roman minor Hours
correctly substitute the Christmas, Epiphany, or Holy Family doxology
when the office falls back to the generic `Prima Special` or
`Minor Special` hymn. The compositor now emits those source-backed
stanzas, but the legacy Perl comparison surface still shows the default
fallback closes (`Deo Patri sit glória,` / `Præsta, Pater piíssime,`),
creating stable January divergences at Prime / Terce / Sext / None.

**Primary source.**

- `upstream/web/www/horas/Latin/Sancti/01-06.txt:4-8`
- `upstream/web/www/horas/Latin/Tempora/Epi1-0.txt:56-67`
- `upstream/web/www/horas/Latin/Psalterium/Doxologies.txt:1-20`
- `upstream/web/www/horas/Latin/Psalterium/Special/Prima Special.txt:100-109`
- `upstream/web/www/horas/Latin/Psalterium/Special/Minor Special.txt:664-672`
- `docs/phase-2-rubrical-engine-design.md:1469`

These sources together establish that:

- Epiphany carries `Doxology=Epi`.
- Holy Family provides its own local `[Doxology]`.
- the fallback hymns still carry the default doxology stanza and
  therefore require substitution.
- the Roman Phase 2/3 design explicitly expects hymn resolution to
  apply `celebrationRules.doxologyVariant` when present.

**Reproduction.**
Run:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Rubrics 1960 - 1960"
```

Then inspect the January Prime / Terce / Sext / None rows in
`packages/compositor/test/divergence/rubrics-1960-2024.md`. The Perl
side shows the default fallback doxology line, while the compositor
shows the source-backed January substitution.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Rubrics 1960 - 1960 | 2024-01-01 | Prime | `c52cc2ef` |
| Rubrics 1960 - 1960 | 2024-01-01 | Terce | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-01 | Sext | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-01 | None | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-06 | Prime | `c52cc2ef` |
| Rubrics 1960 - 1960 | 2024-01-06 | Terce | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-06 | Sext | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-06 | None | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-07 | Prime | `6b019b6f` |
| Rubrics 1960 - 1960 | 2024-01-07 | Terce | `274511e7` |
| Rubrics 1960 - 1960 | 2024-01-07 | Sext | `274511e7` |
| Rubrics 1960 - 1960 | 2024-01-07 | None | `274511e7` |
| Rubrics 1960 - 1960 | 2024-01-13 | Prime | `c52cc2ef` |
| Rubrics 1960 - 1960 | 2024-01-13 | Terce | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-13 | Sext | `318cf47a` |
| Rubrics 1960 - 1960 | 2024-01-13 | None | `318cf47a` |

### 2026-04-19 — Reduced 1955 January minor Hours fall back to weekday psalter antiphons in the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under `Reduced - 1955`, the January `1` and `13`
minor-Hour rows are now source-backed on the Officium Novum side: the
winning office files explicitly carry `Antiphonas Horas`, so the lead
minor-Hour antiphons come from the office's own `Ant Laudes` selectors.
The legacy Perl comparison surface instead falls back to the weekday
psalter antiphons (`Ínnocens mánibus`, `Illuminátio mea`, `Exaltáre`,
etc.).

**Primary source.**

- `upstream/web/www/horas/Latin/Sancti/01-01.txt:7-20`
- `upstream/web/www/horas/Latin/Sancti/12-25.txt:1-6`
- `upstream/web/www/horas/Latin/Sancti/01-13.txt:1-20`
- `upstream/web/www/horas/Latin/Sancti/01-06.txt:4-20`
- `upstream/web/www/horas/Help/Rubrics/1955.txt:141-147`
- `docs/file-format-specification.md:638`

These sources establish that:

- Jan `1` remains a Christmas-octave office via `ex Sancti/12-25`.
- Jan `13` is said "as at present on the Octave of the Epiphany" and
  inherits Epiphany via `ex Sancti/01-06`.
- `Antiphonas Horas` means the office's proper antiphons govern the
  Hours, so the lead antiphon at Prime / Terce / Sext / None stays with
  the office instead of falling back to the weekday psalter.

**Reproduction.**
Run:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Reduced - 1955"
```

Then inspect the January `1` and `13` Prime / Terce / Sext / None rows
in `packages/compositor/test/divergence/reduced-1955-2024.md`. The Perl
side shows weekday psalter antiphons, while the compositor shows the
source-backed office antiphons selected through `Antiphonas Horas`.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Reduced - 1955 | 2024-01-01 | Prime | `52bc4c6c` |
| Reduced - 1955 | 2024-01-01 | Terce | `5f5913ea` |
| Reduced - 1955 | 2024-01-01 | Sext | `9d5ea204` |
| Reduced - 1955 | 2024-01-01 | None | `477e6920` |
| Reduced - 1955 | 2024-01-13 | Prime | `cd271387` |
| Reduced - 1955 | 2024-01-13 | Terce | `766b1f47` |
| Reduced - 1955 | 2024-01-13 | Sext | `ab7f4509` |
| Reduced - 1955 | 2024-01-13 | None | `b32a46de` |

### 2026-04-19 — Rubrics 1960 Jan 6 Vespers is switched to Holy Family in the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under `Rubrics 1960 - 1960`, Jan `6` Vespers should remain
with Epiphany's own antiphons. Officium Novum now keeps
`Ante lucíferum génitus...` because the higher-class Epiphany office
prevails in concurrence. The legacy Perl comparison surface instead
switches to Holy Family's first-Vespers antiphon `Jacob autem...`.

**Primary source.**

- `upstream/web/www/horas/Help/Rubrics/General Rubrics.html:74-82, 465-469`
- `upstream/web/www/horas/Help/Rubrics/Tables 1960.txt:49, 75-79, 118-121`
- `upstream/web/www/horas/Latin/Sancti/01-06.txt:1-18`

These sources establish that Epiphany is a feast of the 1st class while
Holy Family is a feast of the 2nd class, and in concurrence the Vespers
of the higher-class office prevail.

**Reproduction.**
Run:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Rubrics 1960 - 1960"
```

Then inspect the Jan `6` Vespers row in
`packages/compositor/test/divergence/rubrics-1960-2024.md`. The Perl
side shows Holy Family's first-Vespers antiphon, while the compositor
shows Epiphany's own `Ant Vespera` as required by the 1960 concurrence
rules.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Rubrics 1960 - 1960 | 2024-01-06 | Vespers | `3965f59d` |

### 2026-04-19 — Roman Lauds Psalm 99 half-verse structure is flattened by the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under both `Reduced - 1955` and `Rubrics 1960 - 1960`, the
January Roman Lauds rows for Jan `1`, `6`, `7`, and `13` first diverge
at Psalm 99 line `99:3b`. The compositor preserves the corpus
half-verse structure `... ‡ ... * ...` while removing the numeric carry
marker; the Perl comparison surface flattens the same source line to a
single `*` split.

**Primary source.**
`upstream/web/www/horas/Latin/Psalterium/Psalmorum/Psalm99.txt:3-5`

In particular, line `99:3b` explicitly reads:
`Pópulus ejus, et oves páscuæ ejus: ‡ (4a) introíte portas ejus in confessióne, * átria ejus in hymnis: confitémini illi.`

**Reproduction.**
Run either:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Reduced - 1955"
pnpm -C packages/compositor compare:phase-3-perl -- --version "Rubrics 1960 - 1960"
```

Then inspect the January Lauds rows in the corresponding divergence
ledger. Perl shows a flattened `*` split, while the compositor shows the
source-backed `‡ ... *` half-verse structure from `Psalm99.txt`.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Reduced - 1955 | 2024-01-01 | Lauds | `2af868c1` |
| Reduced - 1955 | 2024-01-06 | Lauds | `2af868c1` |
| Reduced - 1955 | 2024-01-07 | Lauds | `2af868c1` |
| Reduced - 1955 | 2024-01-13 | Lauds | `2af868c1` |
| Rubrics 1960 - 1960 | 2024-01-01 | Lauds | `2af868c1` |
| Rubrics 1960 - 1960 | 2024-01-06 | Lauds | `2af868c1` |
| Rubrics 1960 - 1960 | 2024-01-07 | Lauds | `2af868c1` |
| Rubrics 1960 - 1960 | 2024-01-13 | Lauds | `2af868c1` |
| Rubrics 1960 - 1960 | 2024-01-14 | Lauds | `2af868c1` |

### 2026-04-19 — Roman Jan 14 Sunday Prime skips Psalm 53 in the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under both `Reduced - 1955` and `Rubrics 1960 - 1960`,
Jan `14` Prime now first diverges at the opening psalm heading. The
compositor emits the source-backed `Psalmus 53 [1]`, while the Perl
comparison surface skips directly to `Psalmus 117 [1]`.

**Primary source.**
`upstream/web/www/horas/Latin/Psalterium/Psalmi/Psalmi minor.txt:218`

The `Tridentinum` Sunday Prime row explicitly lists:
`53,117,118(1-16),118(17-32)`.

**Reproduction.**
Run either:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Reduced - 1955"
pnpm -C packages/compositor compare:phase-3-perl -- --version "Rubrics 1960 - 1960"
```

Then inspect the Jan `14` Prime row in the corresponding divergence
ledger. Perl starts at `Psalmus 117 [1]`, while the compositor surfaces
the source-backed leading Psalm 53 heading from the `Tridentinum` row.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Reduced - 1955 | 2024-01-14 | Prime | `5531f29c` |
| Rubrics 1960 - 1960 | 2024-01-14 | Prime | `5531f29c` |

### 2026-04-19 — Reduced 1955 Jan 14 Sunday psalter antiphon surface is collapsed by the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under `Reduced - 1955`, Jan `14` `Lauds`, `Terce`,
`Sext`, `None`, and `Vespers` now all expose the same source-backed
Sunday psalter surface: full Day0 psalter-major openings at `Lauds` and
`Vespers`, and full keyed Sunday minor-hour antiphons at `Terce`,
`Sext`, and `None`. The legacy Perl render surface abbreviates these to
generic `Ant. Allelúja.` or incipit-only forms such as `Ant. Dixit
Dóminus. ‡`.

**Primary source.**

- `upstream/web/www/horas/Latin/Psalterium/Psalmi/Psalmi major.txt:1-6`
- `upstream/web/www/horas/Latin/Psalterium/Psalmi/Psalmi major.txt:15-20`
- `upstream/web/www/horas/Latin/Psalterium/Psalmi/Psalmi minor.txt:17-19,33-35,49-51,227-231`

These sources establish that the Sunday Day0 Lauds/Vespers wrappers and
the keyed Sunday minor-hour sections carry the full antiphon text that
the compositor now emits.

**Reproduction.**
Run:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Reduced - 1955"
```

Then inspect the Jan `14` `Lauds`, `Terce`, `Sext`, `None`, and
`Vespers` rows in
`packages/compositor/test/divergence/reduced-1955-2024.md`. Perl
abbreviates the Sunday psalter antiphons; the compositor shows the
source-backed full Day0/keyed surface.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Reduced - 1955 | 2024-01-14 | Lauds | `a4224c0e` |
| Reduced - 1955 | 2024-01-14 | Terce | `50fad344` |
| Reduced - 1955 | 2024-01-14 | Sext | `5e2b4bef` |
| Reduced - 1955 | 2024-01-14 | None | `f178bdcc` |
| Reduced - 1955 | 2024-01-14 | Vespers | `557f2156` |

### 2026-04-19 — Rubrics 1960 Jan 14 Vespers gains an unsupported trailing `‡` in the Perl render surface

**Classification.** `perl-bug`

**Summary.** Under `Rubrics 1960 - 1960`, the remaining Jan `14`
`Vespers` opening divergence is punctuation-only. The Day0 Sunday source
antiphon is `Dixit Dóminus * Dómino meo: Sede a dextris meis.` without a
trailing continuation marker. The compositor preserves that corpus text;
the Perl comparison surface appends an unsupported trailing `‡`.

**Primary source.**
`upstream/web/www/horas/Latin/Psalterium/Psalmi/Psalmi major.txt:15-20`

**Reproduction.**
Run:

```bash
pnpm -C packages/compositor compare:phase-3-perl -- --version "Rubrics 1960 - 1960"
```

Then inspect the Jan `14` `Vespers` row in
`packages/compositor/test/divergence/rubrics-1960-2024.md`. Perl adds a
trailing `‡` to the opening antiphon; the compositor preserves the
source-backed Day0 `Vespera` text without that marker.

**Affected stable divergence-row keys.**

| Policy | Date | Hour | Row key suffix |
|---|---|---|---|
| Rubrics 1960 - 1960 | 2024-01-14 | Vespers | `019555e4` |

## See also

- [ADR-011 — Phase 3 divergence adjudication](./adr/011-phase-3-divergence-adjudication.md)
- [ADR-012 — Compline benediction verb disposition](./adr/012-compline-benediction-verb.md)
- [Phase 3 composition engine design §15 — Validation Strategy](./phase-3-composition-engine-design.md)
