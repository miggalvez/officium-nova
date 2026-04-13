# Divinum Officium — Option A (tightened v2)

This document supersedes the exploratory detail in `architecture-option-a.md` with **stricter boundaries** so the first implementation does not paint you into a corner.

**Unchanged premise:** The asset is the liturgical data and rules in [DivinumOfficium/divinum-officium](https://github.com/DivinumOfficium/divinum-officium) (e.g. `web/www/horas/`, `web/www/missa/`). The Perl codebase remains the **authoritative engine** until native modules replace it under the same contracts.

---

## 1. Core principle (unchanged)

Three layers:

| Layer | Role |
|--------|------|
| **Legacy engine** | Existing Perl computes results from file-backed data. |
| **Modern API** | TypeScript calls Perl, normalizes output, exposes **stable versioned JSON**. |
| **Modern web** | Next.js consumes only that JSON and human URLs — **no Perl, paths, or CGI quirks** in the client. |

---

## 2. v2 tightening: one deployable “core” first

**Do not** split `api` and `legacy-engine` into separate network services in v1.

Run the **TypeScript API and Perl runtime in the same deployable unit** (one container image or one process group) with a fixed working directory and known layout of upstream files. That avoids encoding assumptions, path drift, and extra failure modes before you need horizontal scaling.

Split later only if operations or security demand it.

**Diagram (v2):**

```
Browser
   → Next.js
   → API (NestJS or Fastify)  ──► Redis (materialized responses)
   │         │
   │         └──► Postgres (accounts, prefs, audit — not breviary rows)
   │
   └──► Perl + upstream tree (same unit as API process)
```

Optional edge: **Caddy** (or equivalent) in front of Next + API as in v1.

---

## 3. Canonical request: richer than `date + version + lang`

A plain civil `date` is **not** sufficient for “what do I pray **now**?” (first/second Vespers, vigils, time zones, optional calendars). Treat these as **first-class** in the API design from day one.

### 3.1 `CelebrationContext` (conceptual)

Define a single normalized object used internally for:

- invoking the legacy engine,
- computing **cache keys**,
- regression fixtures.

Minimum fields to plan for (v1 can implement a subset, but the **shape** should not change):

| Field | Purpose |
|--------|---------|
| `civilDate` | ISO date for URL-friendly pages. |
| `instant` | Optional: `now` or explicit `zonedDateTime` for “today” resolution. |
| `timeZone` | IANA id for `/today` and evening boundaries. |
| `version` | Rubrical edition / calendar profile (slug from meta). |
| `primaryLang`, `parallelLang` | Display languages. |
| `officeHour` | Only for hour endpoints. |
| `options` | Extensible bag: local calendar, votive paths, rubrics toggles, comparison mode — **versioned** so old cache entries do not collide. |

### 3.2 Resolver vs content endpoints

- **Resolver:** Given `instant` + `timeZone` + `version` (+ options), return the **liturgical day** and flags the UI needs (e.g. first vs second Vespers, fast/abstinence hints). This can initially delegate entirely to Perl output you parse or to a thin native layer later.
- **Content:** `calendar/day`, `office/hour`, `mass/day` use a **resolved** context (either client passes `civilDate` after calling resolver, or server accepts `instant` and resolves once).

Stable URLs like `/office/2026-04-06/lauds` remain; **`/today`** uses the resolver.

---

## 4. Cache keys: hash the canonical request

Do **not** hand-assemble keys like `office:1960:en:2026-04-06:lauds` as the long-term contract.

**v2 rule:** Serialize `CelebrationContext` (minus secrets) to a **canonical JSON** (sorted keys), then `cacheKey = sha256(canonical)` or a prefixed short hash. Store human-readable metadata beside the key in Redis for debugging.

Deterministic liturgical output → cache is still your friend; the key must survive when you add one more option flag.

---

## 5. Postgres: application and audit only

**Postgres holds:**

- Users / auth ids (if any)
- **User preferences** (defaults for version, language, theme, etc.)
- Bookmarks
- **Import / deployment metadata** (upstream **git commit** pinned at build or sync time)
- **Audit** rows for admin actions

**Postgres does not** store the breviary or Mass as normalized “content tables” in v1/v2. Avoid `offices` / `masses` tables full of `normalized_json` / `rendered_html` as if they were domain entities — that duplicates the engine and complicates invalidation.

**Where materialized liturgy lives:**

- **Redis:** hot responses keyed by request hash (see §4).
- **Optional:** append-only **snapshot** store (could be Postgres **jsonb** or object storage) for regression audits, each row tagged with `sourceCommit` + `requestHash` — explicitly **not** the live source of truth.

---

## 6. Legacy adapter: explicit risk budget

The adapter:

1. Invokes Perl with parameters matching what the upstream expects.
2. Captures **HTML or text** as emitted today.
3. Maps output into **stable JSON sections** for the API.

**v2 rules:**

- Treat **HTML parsing as temporary**. If the upstream offers or can be wrapped to emit a more stable boundary (structured dump, intermediate representation), prefer that **before** you invest in a giant DOM parser.
- **Snapshot tests:** for each supported `version` × `lang` × representative `hour`, store **golden JSON** (or normalized canonical strings) keyed by **request hash** and **pinned upstream commit**.
- The adapter does not need to “understand liturgy” semantically at first, but it **must** be **test-locked** so refactors do not silently change meaning.

Later, native TypeScript implements the **same** `OfficeAdapter` / `MassAdapter` interface; Perl stays behind the interface until parity is proven.

---

## 7. API surface (trimmed to v2 essentials)

Keep **versioned JSON** (`/api/v1/...`). Add explicitly:

| Area | Notes |
|------|--------|
| `GET /api/v1/calendar/resolve` | `instant`, `timeZone`, `version`, optional `options` → liturgical day + navigation hints. |
| `GET /api/v1/calendar/day` | By `civilDate` + `version` + `lang` + `options` (aligned with resolver output). |
| `GET /api/v1/office/hour` | Uses full context; parallel/compare via `options`. |
| `GET /api/v1/mass/day` | Same. |
| `GET /api/v1/meta/*` | Versions, languages, hours — unchanged idea. |
| `GET/PUT /api/v1/me/preferences` | Unchanged; defaults feed resolver/content. |

Admin/cache/import routes stay **behind auth** and can ship after the public read path is solid.

---

## 8. Frontend (unchanged intent, one constraint)

Human URLs (`/today`, `/calendar/...`, `/office/.../lauds`, `/mass/...`) stay.

**Constraint:** The client only ever sees **dates, versions, languages, hours, sections, metadata** — never Perl parameters or repo paths. `/today` calls **resolve** then navigates or fetches content.

---

## 9. Migration phases (same order, sharper edges)

| Phase | Focus |
|--------|--------|
| **1** | API + adapter + Next.js + Redis + prefs; **no** native liturgical logic beyond glue. **One** deployable core with Perl inside. |
| **2** | Native **calendar/day metadata** first (biggest navigation win, smaller than full Office). |
| **3** | One hour end-to-end: **Compline** first, then Lauds/Vespers, little hours, **Matins last**. |
| **4** | Mass propers and readings pipeline. |
| **5** | Editorial/admin; diff vs legacy; optional split of Perl to separate service **only if needed**. |

---

## 10. Validation (non-negotiable)

- Regression harness: same **canonical request** (hash), compare **legacy-normalized JSON** vs **new engine JSON** per section.
- Corpus: ordinary days, Sundays, octaves, vigils, Ember days, Holy Week, All Souls, messy commemorations, leap years, rubrical boundaries — **pinned to a specific upstream commit** for reproducibility; refresh corpus when you bump the pin intentionally.

---

## 11. Deployment (v2)

- **Services in v1:** `frontend` (Next.js), `api` (includes **embedded** Perl + data tree), `redis`, `postgres`, reverse proxy.
- Health: `/health/live`, `/health/ready` (ready = can read data + run one cheap Perl smoke call if applicable).
- Warm-cache jobs for “today” / “tomorrow” after resolver behavior is defined.

---

## 12. Recommended first sprint (v2)

1. `CelebrationContext` + **canonical serialization** + **cache key hash** (even if Redis is minimal).
2. `GET /api/v1/calendar/resolve` (can thin-wrap Perl at first).
3. `GET /api/v1/office/hour` with full context + Redis cache.
4. `GET /api/v1/mass/day` (or `propers`) — smallest Mass slice that proves the adapter.
5. Next.js **`/today`** using resolver + one office view.
6. **Regression harness** + **golden fixtures** pinned to one upstream **commit**.

(Item 6 is explicit so tests are not deferred until after the parser ossifies.)

---

## 13. Open decisions (track explicitly)

- Whether the upstream Perl path exposes anything **more stable than HTML** for the adapter (investigate early in sprint 1).
- Exact **v1** surface of `options` (which toggles are real vs placeholder).
- Whether public site uses **accounts** or **cookie-only** prefs in phase 1.

---

## Relationship to v1 doc

`architecture-option-a.md` remains a **brain dump** and checklist. **Implement against this v2 doc** for boundaries: deployment shape, canonical request, cache strategy, Postgres scope, and adapter risk.
