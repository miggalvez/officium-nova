# Rubrical Sources

This document is the project's canonical index of the external rubrical source families referenced by Officium Novum.

Use it together with [Phase 2 Rubrical Engine Design](./phase-2-rubrical-engine-design.md) §19.1:

1. Ordo Recitandi
2. Governing rubrical books
3. Legacy Divinum Officium Perl output

The main Divinum Officium source hub for these materials is [Rubrics of the Roman Breviary](https://www.divinumofficium.com/www/horas/Help/rubrics.html).

## Coverage On The Divinum Officium Rubrics Page

The Divinum Officium rubrics index currently exposes these families directly:

- `1960` — under the `Rubrics 1960` section on the rubrics index
- `1911 / Divino Afflatu` — under `Tridentine & Divino Afflatu`, specifically `Additiones ad normam Divino Afflatu (St. Pius X)`
- `1955` — as the standalone [Reductions to Simpler Form 1955 (Cum Nostra Hac Aetate)](https://www.divinumofficium.com/www/horas/Help/Rubrics/1955.txt)
- `Tridentine` — under `Rubrics after the Council of Trent`
- `Monastic 1963` — under `Monastic Breviary 1963`

The rubrics index does not currently provide separate dedicated sections for the Cistercian or Dominican families used in `Tabulae/data.txt`.

## Project Mapping

| Policy / Ordo Family | Repo Version Handles | Primary Rubrical References | Current Status |
|---|---|---|---|
| `divino-afflatu` | `Divino Afflatu - 1939`, `Divino Afflatu - 1954` | [Rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) → `Tridentine & Divino Afflatu`; `Additiones ad normam Divino Afflatu (St. Pius X)`; `English Divino Afflatu Rubrics` on the same page | Implemented |
| `reduced-1955` | `Reduced - 1955` | [Reductions to Simpler Form 1955](https://www.divinumofficium.com/www/horas/Help/Rubrics/1955.txt) and the [rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) | Implemented |
| `rubrics-1960` | `Rubrics 1960 - 1960`, `Rubrics 1960 - 2020 USA` | [Rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) → `Rubrics 1960`, including `Rubricarum Instructum`, `General Rubrics`, `Rubrics of Breviarium Romanum`, `Tables of Feasts`, and `1960 Roman Calendar` | Implemented |
| `tridentine-1570` | `Tridentine - 1570`, `Tridentine - 1888`, `Tridentine - 1906` | [Rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) → `Rubrics after the Council of Trent` | Deferred by scope |
| `monastic-tridentine` / `monastic-divino` / `monastic-1963` | `Monastic Tridentinum 1617`, `Monastic Divino 1930`, `Monastic - 1963`, `Monastic - 1963 - Barroux` | [Rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) → `Monastic Breviary 1963`; earlier monastic families remain repo-tracked but not yet implemented | Deferred by scope |
| `cistercian-1951` / `cistercian-altovadense` | `Monastic Tridentinum Cisterciensis 1951`, `Monastic Tridentinum Cisterciensis Altovadensis` | No dedicated section on the Divinum Officium rubrics index; source collection must be handled separately when implementation begins | Deferred by scope |
| `dominican-1962` | `Ordo Praedicatorum - 1962` | No dedicated section on the Divinum Officium rubrics index; source collection must be handled separately when implementation begins | Deferred by scope |

## Direct Document Links (Active Policies)

Direct pointers to the governing texts most often cited during Phase 3 divergence adjudication (see [ADR-011](./adr/011-phase-3-divergence-adjudication.md)). The upstream [rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) remains authoritative; this section is a convenience cache scoped to currently implemented policies.

**Fetch fallbacks.** The live host returns `403` to automated fetches. Two workarounds:

- GitHub raw mirror: replace `https://www.divinumofficium.com/www/horas/Help/` with `https://raw.githubusercontent.com/DivinumOfficium/divinum-officium/master/web/www/horas/Help/` (keep the remaining path segments identical).
- Local copies: the same files live in the `upstream/` submodule at `upstream/web/www/horas/Help/` when the submodule is initialized (`git submodule update --init`).

### `rubrics-1960`

- [Rubricarum Instructum](https://www.divinumofficium.com/www/horas/Help/Rubrics/Rubricarum%20Instructum.html) — the 1960 motu proprio itself
- [General Rubrics](https://www.divinumofficium.com/www/horas/Help/Rubrics/General%20Rubrics.html) — primary citation target for precedence, commemoration, and occurrence rules
- [Rubrics of Breviarium Romanum](https://www.divinumofficium.com/www/horas/Help/Rubrics/Breviary%201960.html) — Hour-by-Hour rubrics
- [Tables of Feasts](https://www.divinumofficium.com/www/horas/Help/Rubrics/Tables%201960.txt)
- [Variationes in Breviario et Missali Romano](https://www.divinumofficium.com/www/horas/Help/Rubrics/Variationes1960.html)

### `divino-afflatu`

*Additiones ad normam Divino Afflatu* (St. Pius X), nine Latin sections:

- [I. Ratio](https://www.divinumofficium.com/www/horas/Help/Rubrics/N1.txt) · [II. Praecedentia](https://www.divinumofficium.com/www/horas/Help/Rubrics/N2.txt) · [III. Octavas](https://www.divinumofficium.com/www/horas/Help/Rubrics/N3.txt) · [IV. Occurentia accidentalis](https://www.divinumofficium.com/www/horas/Help/Rubrics/N4.txt) · [V. Occurentia perpetua](https://www.divinumofficium.com/www/horas/Help/Rubrics/N5.txt) · [VI. Concurrentia](https://www.divinumofficium.com/www/horas/Help/Rubrics/N6.txt) · [VII. Commemorationes](https://www.divinumofficium.com/www/horas/Help/Rubrics/N7.txt) · [VIII. Conclusiones](https://www.divinumofficium.com/www/horas/Help/Rubrics/N8.txt) · [IX. Locales](https://www.divinumofficium.com/www/horas/Help/Rubrics/N9.txt)

Compiled and supporting:

- [All sections composed](https://www.divinumofficium.com/www/horas/Help/Rubrics/rubrics.txt)
- [Tabellae festorum](https://www.divinumofficium.com/www/horas/Help/Rubrics/Tabellae.txt) · [Notanda in praecedentes tabellas](https://www.divinumofficium.com/www/horas/Help/Rubrics/Notanda.txt)
- [English Divino Afflatu Rubrics (PDF)](https://www.divinumofficium.com/www/horas/Help/Rubrics/EnglishDORubrics.pdf) — convenient first-pass reference; cite the Latin sections above for dispositive citations

### `reduced-1955`

- [Cum Nostra Hac Aetate (1955 reductions)](https://www.divinumofficium.com/www/horas/Help/Rubrics/1955.txt) — the entire governing text

## Secondary Cross-Check Sources

These sources can help find mistakes or fill practical test matrices, but they
do not outrank the source hierarchy above. Use them as corroborating evidence,
not as the sole basis for adjudicating a divergence.

### `1962ordo.today`

- Source: [1962 Ordo](https://1962ordo.today/)
- Scope: `rubrics-1960` / 1962 Roman liturgical books only.
- Useful fields: daily Mass/Office selection, class, color,
  commemorations, occurrence/concurrence notes, and practical Breviary
  guidance.
- Limits: not applicable to `divino-afflatu` or `reduced-1955`; may include
  United States, SSPX, local, votive, or pastoral notes that must not be folded
  into the general Roman fixture surface unless explicitly modeled.
- Fixture home:
  [`packages/rubrical-engine/test/fixtures/external/1962ordo-today`](../packages/rubrical-engine/test/fixtures/external/1962ordo-today/README.md).

## Maintenance Notes

- When policy support changes, update this file, [README.md](../README.md), and [AGENTS.md](../AGENTS.md) together.
- When a new policy is implemented, add its direct-links subsection above. The upstream [rubrics index](https://www.divinumofficium.com/www/horas/Help/rubrics.html) remains authoritative; if it gains new documents for a policy we already ship, refresh the matching subsection.
- The authoritative repo mapping from `VersionHandle` to policy family is [`packages/rubrical-engine/src/version/policy-map.ts`](../packages/rubrical-engine/src/version/policy-map.ts).
- This file is a source index, not an adjudication shortcut. Divergence resolution still requires citations from the governing rubrical text or an Ordo source, not just a link to the index page.
- Secondary cross-check sources may be cited for investigation context, but an
  `engine-bug`, `perl-bug`, or `ordo-ambiguous` adjudication still needs the
  governing rubrical text, a published Ordo Recitandi, an in-repo ADR, or a
  dispositive corpus line per ADR-011.
