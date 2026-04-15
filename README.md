# Officium Nova

A modernization of the [Divinum Officium](https://github.com/DivinumOfficium/divinum-officium) project — the community-maintained application that generates the traditional Roman Breviary and Missal texts.

Officium Nova decouples the liturgical data, rubrical logic, and presentation into discrete, testable layers while preserving the project's editorial integrity and the existing source texts in version-controlled, human-readable files.

## Motivation

The current Divinum Officium architecture — monolithic Perl CGI scripts parsing flat text files and rendering HTML server-side — tightly couples text retrieval, rubrical decisions, and presentation. This makes it difficult to:

- Support alternative output formats (JSON, EPUB, PDF)
- Enable third-party integrations and mobile clients
- Compose multilingual text cleanly
- Host cost-efficiently (every request triggers live filesystem parsing and HTML generation)
- Test rubrical correctness against published *Ordo* data

## Architecture

The modernization replaces the monolithic Perl application with a layered pipeline:

```
Source Texts (.txt)  ──>  Parser  ──>  Rubrical Engine  ──>  Composition Engine  ──>  API  ──>  Clients
     (Git)              (Phase 1)       (Phase 2)             (Phase 3)          (Phase 4)    (Phase 6)
```

- **Parser** — reads the legacy `.txt` files and emits typed, validated objects. Builds an in-memory text index queryable by feast, hour, language, and rubrical system.
- **Rubrical Engine** — the target pure function is `(date, versionHandle) → OrdoEntry`. It encodes the calendar, occurrence, concurrence, and commemoration logic for the supported Breviary versions by resolving each `VersionHandle` to a calendar chain plus a rubrical policy family. No I/O.
- **Composition Engine** — resolves text references from the `OrdoEntry` against the text index, applies inline rubrical modifications, and produces a format-agnostic structured document.
- **API** — stateless, read-only JSON API (`GET /api/v1/office/{date}/{hour}`) with aggressive HTTP caching.
- **Frontend** — lightweight SPA consuming the API, with offline support via service worker caching.

The source `.txt` files remain the single source of truth, edited via standard Git workflows (diffs, blame, pull requests).

## Rubrical Systems

| System | Governing Documents | Key Characteristics |
|---|---|---|
| **Divino Afflatu (1911)** | *Rubricae Generales Breviarii* (1911) | Full semidouble/double ranking, most commemorations, pre-1955 Holy Week |
| **Simplified Rubrics (1955)** | *Cum Nostra* (1955) | Reduced vigils, simplified octave system, revised Holy Week |
| **1960 Rubrics** | *Rubricarum Instructum* (1960) | Four-class ranking, further reduction of commemorations |

## Repository Structure

```
officium-nova/
├── packages/
│   ├── parser/            # @officium-nova/parser — reads .txt files, emits typed objects
│   └── rubrical-engine/   # @officium-nova/rubrical-engine — Phase 2 implementation
├── upstream/          # Divinum Officium as a Git submodule (source texts + legacy Perl app)
├── docs/              # Specifications and design documents
│   ├── divinum-officium-modernization-spec.md
│   ├── file-format-specification.md
│   ├── phase-2-rubrical-engine-design.md
│   └── adr/               # Architecture Decision Records for implementation choices
├── LICENSE            # GPL-3.0
└── pnpm-workspace.yaml
```

## Design Principles

1. **Liturgical correctness is non-negotiable.** Every phase is validated against known-good outputs. One misplaced commemoration is a shipping bug that people will pray incorrectly from.
2. **The texts are a scholarly corpus, not application data.** They remain in version-controlled, human-readable, diffable files.
3. **Incremental delivery.** Each phase produces a usable, standalone artifact.
4. **Separate what changes at different rates.** Texts (editorial, slow), rubrics (essentially fixed), presentation (platform-driven) — three concerns, three modules.
5. **Cost-consciousness.** The new architecture must be cheaper to operate than the current one.

## Documentation

- [Modernization Specification](docs/divinum-officium-modernization-spec.md) — full design document covering all phases, the rubrical engine interface, validation strategy, and migration plan
- [File Format Specification](docs/file-format-specification.md) — detailed specification of the legacy `.txt` file format (section headers, directives, cross-references, language conventions)
- [Phase 2 Rubrical Engine Design](docs/phase-2-rubrical-engine-design.md) — detailed design for the rubrical engine: pipeline stages, version/policy model, occurrence/concurrence/transfer/commemoration algorithms, Matins planning, and the top-level API

## Status

**Phase 1 — Parser (complete).** The `@officium-nova/parser` package parses the full 34,000+ file corpus across 16 languages, resolves cross-references with language fallback, and builds an in-memory text index. All 64 tests pass, including a spot-check validation of 62 representative feast files across languages against resolved snapshots.

Implemented:

- Section splitter, directive parser, condition parser (recursive descent with `aut`/`et`/`nisi` precedence), rank parser, rule parser
- Cross-reference resolver with path resolution, language fallback chains, line selectors, regex substitutions, cycle detection, and preamble merging
- Corpus walker (horas/, missa/, Tabulae/ with rite variant detection), file loader, file cache
- Calendar parsers (Kalendarium, feast transfers, version registry)
- In-memory text index queryable by path and content directory
- Corpus loader with integrated reference resolution

**Phase 2 — Rubrical Engine (in progress).** The detailed design is in [`docs/phase-2-rubrical-engine-design.md`](docs/phase-2-rubrical-engine-design.md). Pipeline: Version Resolver → Temporal/Sanctoral → Directorium Overlay → Candidate Assembly → Occurrence Resolver → Celebration Rule Eval → Transfer Computation → Concurrence → Commemoration Assembly → Hour Structuring. Phase 2 is broken into eight sub-phases (2a–2h) per §18 of the design.

**Phase 2a — Foundations (complete).** The end-to-end deliverable from design §18 is in place: `createRubricalEngine(config).resolveDayOfficeSummary(date)` returns temporal + sanctoral candidates with a naive (highest-raw-rank) winner for every date.

Implemented in 2a:

- `@officium-nova/rubrical-engine` package scaffold with build, typecheck, and Vitest setup
- Version-layer foundations: branded `VersionHandle`, `ResolvedVersion`, `VersionDescriptor`, and immutable `VersionRegistry`
- `data.txt` registry builder and version resolver with four-way error dispatch (unknown / missa-with-hint / missa-without-hint / unbound Breviary)
- Policy binding map covering all 15 Breviary rows in `Tabulae/data.txt` across 10 distinct policy families
- Temporal cycle: Meeus/Jones/Butcher Gregorian computus; `dayNameForDate`/`weekStemForDate` cross-checked against the upstream Perl `getweek` on a 550+ date matrix spanning 2020–2030; `LiturgicalSeason` classifier
- Sanctoral kalendarium lookup that walks the inheritance chain via `ResolvedVersion.base`, replicating upstream `Directorium.pm`'s date-level override semantics and the bisextile Feb 24 remap
- Policy-hookable rank normalization (`defaultResolveRank` for Phase 2a; pluggable for Phase 2c+)
- Conditional evaluation for `aut`/`et`/`nisi` expressions against `rubrica`/`tempore`/`mense`/`die`/`feria` subjects
- Canonical content-dir routing (`Tempora`, `TemporaM`, `TemporaCist`, `TemporaOP`, same for `Sancti`)
- Candidate assembly with equal-rank tie-breaking in favor of the temporal cycle
- `policyOverride` composite pattern: overrides augment the configured policy map rather than replacing it

**Phase 2b — Directorium Overlay (complete).** The per-date `DirectoriumOverlay` is computed from the version's `Transfer`/`Stransfer` tables, surfaced on `DayOfficeSummary` (as `undefined` when empty), and threaded back into candidate assembly with resolved replacement ranks and typed warnings.

Implemented in 2b:

- `DirectoriumOverlay` type: `officeSubstitution?`, `dirgeAtVespers?`, `dirgeAtLauds?`, `hymnOverride?`, `scriptureTransfer?` — the split-Hour dirge shape reflects that `dirge1`/`dirge2`/`dirge3` are a month partition, not an Hour partition (per `Directorium.pm:229-237` and `horas/Help/technical.html`)
- `computeYearKey(year)` — Sunday-letter + Easter-MMDD derivation mirroring Perl's `load_transfer`, including the leap-year companion pair with the `332 → 401` wrap
- `YearTransferTable` / `ScriptureTransferTable` with inheritance-chain lookup via `ResolvedVersion.transferBase`, leap-chunk filtering equivalent to Perl's `load_transfer_file` `regexp`/`regexp2`, and a runtime guard that rejects mixed wildcard/named-handle inputs at construction
- `matchesVersionFilter` — Perl-shape regex match (version name as pattern, filter as string) with a tokenized-substring fallback; agreement with Perl semantics validated on every `(filter × transfer-name)` pair from the live `Tabulae` files
- Dirge extraction as a union scan over all three buckets, keyed on today's sday for Lauds and tomorrow's sday for Vespers — independently, so a single civil date can carry both attachments
- Office-substitution extraction with `Tempora/<path>` and bare-`MM-DD` canonicalization, plus an `overlay-alternates-deferred` info warning when tilde-chained targets are seen (consumed in Phase 2e)
- Candidate-assembly substitution: `resolveOverlayCandidate` callback resolves both `feastRef` and `rank` for the replacement against the corpus, so the substituted candidate carries its own rank rather than inheriting the displaced one; resolver failures surface as `severity: 'error'` warnings and fall back to the displaced rank
- Integration harness that loads every real `Tabulae/Transfer/*.txt` and `Tabulae/Stransfer/*.txt` file and asserts overlay directives for a focused matrix (leap-year companion substitution on 2024-01-08, hymn-merge on 2025-05-18, simultaneous dirge pair on 2025-11-02/2025-11-03, and `~R`/`~B`/`~A` scripture operations)

ADRs for the key architectural decisions so far:

- [`docs/adr/001-version-handle-primary-binding.md`](docs/adr/001-version-handle-primary-binding.md)
- [`docs/adr/002-two-scope-rule-evaluation.md`](docs/adr/002-two-scope-rule-evaluation.md)

213 rubrical-engine tests passing, including live integration suites against upstream `Tabulae/data.txt`, the Perl-oracle day-name matrix, and the `Transfer`/`Stransfer` overlay matrix.

Still pending in Phase 2:

- **2c** — 1960 occurrence with precedence table
- **2d** — Rule evaluation (`CelebrationRuleSet` / `HourRuleSet`, vide/ex chains, paragraph-scoped conditionals)
- **2e** — Transfer computation and vigil handling
- **2f** — Concurrence and Compline
- **2g** — Hour structuring, Matins last
- **2h** — 1911 (Divino Afflatu) and 1955 (Reduced) policies

## License

[GPL-3.0](LICENSE), consistent with the upstream Divinum Officium project.
