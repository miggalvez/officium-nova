# Officium Novum

A modernization of the [Divinum Officium](https://github.com/DivinumOfficium/divinum-officium) project — the community-maintained application that generates the traditional Roman Breviary and Missal texts.

Officium Novum decouples the liturgical data, rubrical logic, and presentation into discrete, testable layers while preserving the project's editorial integrity and the existing source texts in version-controlled, human-readable files.

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
- **Composition Engine** — resolves text references from the `DayOfficeSummary` against a Phase-1-resolved text index, expands deferred node kinds (`psalmInclude`, `psalmRef`, `macroRef`, `formulaRef`), flattens seasonal conditionals, applies `HourDirective` post-transforms, and emits a format-agnostic `ComposedHour` tree of typed `Section`s with per-language `ComposedRun[]` lines. Phase 3 also carries the live Perl comparison harness used to enumerate and burn down output divergences.
- **API** — stateless, read-only JSON API (`GET /api/v1/office/{date}/{hour}`) with aggressive HTTP caching.
- **Frontend** — lightweight SPA consuming the API, with offline support via service worker caching.

The source `.txt` files remain the single source of truth, edited via standard Git workflows (diffs, blame, pull requests).

## Rubrical Systems

| System | Governing Documents | Key Characteristics |
|---|---|---|
| **Divino Afflatu (1911)** | *Rubricae Generales Breviarii* (1911) | Full semidouble/double ranking, most commemorations, pre-1955 Holy Week |
| **Simplified Rubrics (1955)** | *Cum Nostra* (1955) | Reduced vigils, simplified octave system, revised Holy Week |
| **1960 Rubrics** | *Rubricarum Instructum* (1960) | Four-class ranking, further reduction of commemorations |

See [Rubrical Sources](docs/rubrical-sources.md) for the canonical project mapping from ordo families to repo `VersionHandle`s, Divinum Officium source links, and deferred families.

## Repository Structure

```
officium-novum/
├── packages/
│   ├── parser/            # @officium-novum/parser — reads .txt files, emits typed objects
│   ├── rubrical-engine/   # @officium-novum/rubrical-engine — Phase 2 implementation
│   └── compositor/        # @officium-novum/compositor — Phase 3 implementation
├── upstream/          # Divinum Officium as a Git submodule (source texts + legacy Perl app)
├── docs/              # Specifications and design documents
│   ├── divinum-officium-modernization-spec.md
│   ├── file-format-specification.md
│   ├── phase-2-rubrical-engine-design.md
│   ├── phase-2g-beta-matins-corpus-inventory.md
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
- [Rubrical Sources](docs/rubrical-sources.md) — canonical source index for the 1911 / 1955 / 1960 families plus the deferred Tridentine / monastic / Cistercian / Dominican families
- [Phase 2 Rubrical Engine Design](docs/phase-2-rubrical-engine-design.md) — detailed design for the rubrical engine: pipeline stages, version/policy model, occurrence/concurrence/transfer/commemoration algorithms, Matins planning, and the top-level API
- [Phase 2g-β Matins Corpus Inventory](docs/phase-2g-beta-matins-corpus-inventory.md) — focused inventory and notes for the Matins-structuring corpus work
- [Architecture Decision Records](docs/adr/) — implementation ADRs for version binding, rule evaluation, transfer caching, concurrence previews, and hour-structuring architecture

## Status

| Phase | State |
|---|---|
| **1 — Parser** | Complete |
| **2 — Rubrical Engine** (Roman: 1911 / 1955 / 1960) | Complete |
| **2 — Non-Roman families** (Tridentine, Monastic, Cistercian, Dominican) | Deferred by design — explicit `UnsupportedPolicyError` stubs |
| **3 — Composition Engine** | In progress — end-to-end hour composition and the live Perl comparison harness are shipped; remaining work is slot-order/fallback parity (especially hymns and canticle material), fully liturgical preces/suffragium/dirge substitutions, Matins commemorations, and Ordo-backed divergence adjudication |
| **4 — API** | Not started |
| **5 — Frontend** | Not started |

**Validation.** Per design §19.1, the authority order is Ordo Recitandi → governing rubrical books (1911 / 1955 / 1960) → legacy Divinum Officium Perl output. Perl is a comparison target, not an oracle. Divergence ledgers live in `packages/rubrical-engine/test/divergence/` and `packages/compositor/test/divergence/`. Workspace validation currently passes with `pnpm -r typecheck` and `pnpm -r test` (parser + rubrical-engine + compositor), and the Phase 3 live comparison harness is available at `pnpm -C packages/compositor compare:phase-3-perl`. Recent Phase 3 work closed the broad parser/composition gap around wrapper material, conditionalized keyed psalter data, and Compline special-source fallbacks; the remaining compare rows are now narrower slot-order/fallback and liturgical-substitution issues rather than missing openings.

See [CHANGELOG.md](CHANGELOG.md) for the sub-phase implementation log, and [`docs/adr/`](docs/adr/) for architectural decisions.

## License

[GPL-3.0](LICENSE), consistent with the upstream Divinum Officium project.
