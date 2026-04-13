# Divinum Officium — Option A Architecture Plan

**Option A is the right move.**

The upstream repository remains active, and its real asset is not the CGI shell but the liturgical data and rules encoded in the existing project. The current repository keeps the Office and Mass data under `web/www/horas/` and `web/www/missa/`, and the project was updated as recently as April 5, 2026.

Treat the current Perl app as the **authoritative engine** for now, and build a modern system around it.

---

## 1. Core principle

Build three layers:


| Layer                   | Role                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **Legacy engine layer** | The existing Perl code continues to calculate results.                                                |
| **Modern API layer**    | A TypeScript service calls the Perl engine, normalizes the output, and exposes stable JSON endpoints. |
| **Modern web frontend** | A Next.js app consumes the API and renders a clean, mobile-friendly site.                             |


That gives you a new house without bulldozing the chapel first.

---

## 2. High-level system diagram

```
Browser / Mobile Web
        |
        v
    Next.js Frontend
        |
        v
 TypeScript API Gateway
 (NestJS or Fastify)
        |
   -------------------
   |        |        |
   v        v        v
Perl runner Cache   Postgres
(wrapper)   Redis   preferences/audit
   |
   v
Divinum Officium source data
(web/www/horas, web/www/missa, etc.)
```

---

## 3. What each piece does

### Frontend: Next.js

Use Next.js for:

- Server-rendered pages
- SEO-friendly daily pages
- Shareable URLs for each day, hour, and Mass
- User preferences stored in cookies or account profile
- Fast mobile experience
- Static caching where possible

### API: NestJS or Fastify

- **Fastify** — leaner and faster
- **NestJS** — more structure and long-term maintainability

For this project, **NestJS is slightly favored**, because the domain will get complex: rubrics, variants, language settings, commemorations, user preferences, maybe admin tooling later.

### Legacy adapter

This is the key piece.

The adapter does not “understand liturgy” at first. It simply:

- Invokes the Perl engine with parameters
- Captures HTML or text output
- Extracts structured fields
- Returns normalized JSON

Later, you can replace pieces of this adapter with native TypeScript logic one by one.

### Database

Use **PostgreSQL** only for **new application data**, not as the first home for all the old liturgical content.

Store things like:

- User preferences
- Bookmarks/favorites
- Saved settings
- Generated cache metadata
- Audit logs for admin tools
- Import versions
- Optional future editorial workflow

Do not start by manually stuffing the whole breviary into relational tables. That is a fine way to spend six months creating sorrow.

### Cache

Use **Redis** for:

- Daily office results by date/version/language/hour
- Calendar computations
- Heavy comparison views
- Common public pages

A lot of liturgical output is deterministic. Cache is your friend.

---

## 4. API route sketch

Design the API as **versioned JSON**.

### Calendar and day routes

```
GET /api/v1/calendar/day?date=2026-04-06&version=1960&lang=en
GET /api/v1/calendar/month?year=2026&month=4&version=1960&lang=en
GET /api/v1/calendar/range?start=2026-04-01&end=2026-04-15&version=1960&lang=en
```

**Return:**

- Liturgical day name
- Rank/class
- Season
- Color
- Commemorations
- Feria/sanctal/temporal flags
- Links to Office and Mass variants
- Whether first vespers/second vespers apply
- Fasting/abstinence notes if relevant

### Office routes

```
GET /api/v1/office/day?date=2026-04-06&version=1960&lang=en
GET /api/v1/office/hour?date=2026-04-06&hour=lauds&version=1960&lang=en
GET /api/v1/office/hour?date=2026-04-06&hour=vespers&version=1960&lang=la
GET /api/v1/office/compare?date=2026-04-06&hour=lauds&left=la&right=en&version=1960
```

**Return structured sections**, not just blobs:

- Title
- Invitatory
- Hymn
- Antiphons
- Psalms
- Chapter
- Responsory
- Versicle
- Canticle
- Collect
- Commemorations
- Conclusion

### Mass routes

```
GET /api/v1/mass/day?date=2026-04-06&version=1960&lang=en
GET /api/v1/mass/propers?date=2026-04-06&version=1960&lang=la
GET /api/v1/mass/readings?date=2026-04-06&version=1960&lang=en
```

**Return:**

- Title
- Class/rank
- Color
- Station church if applicable
- Introit
- Collect
- Epistle
- Gradual/tract/alleluia
- Gospel
- Offertory
- Secret
- Communion
- Postcommunion
- Commemorations
- Proper preface if any

### Metadata routes

```
GET /api/v1/meta/versions
GET /api/v1/meta/languages
GET /api/v1/meta/hours
GET /api/v1/meta/calendar-options
```

This lets the frontend build menus without hardcoding every option.

### Preference routes

```
GET /api/v1/me/preferences
PUT /api/v1/me/preferences
```

**Fields might include:**

- Preferred version
- Preferred language
- Parallel language
- Default hour
- Font size
- Dark mode
- Show rubrical notes
- Show chant notation later

### Admin/import routes

```
POST /api/v1/admin/import/run
GET /api/v1/admin/import/status
GET /api/v1/admin/cache/status
POST /api/v1/admin/cache/refresh
```

These are for later, but worth planning now.

---

## 5. Frontend route sketch

Make the public URLs **human and stable**.

```
/
/today
/calendar
/calendar/2026/04
/office/2026-04-06
/office/2026-04-06/lauds
/office/2026-04-06/vespers
/mass/2026-04-06
/settings
/about
/help
```

**Optional richer routes:**

```
/office/2026-04-06/lauds?lang=la&parallel=en&version=1960
/mass/2026-04-06?lang=en&version=tridentine-1910
```

### Frontend components

Break the UI into:

- Day header
- Calendar badge block
- Office section renderer
- Psalm block
- Reading block
- Collect block
- Commemoration block
- Parallel text viewer
- Version/language selector
- Rubrics toggle
- “Go to today” navigator

---

## 6. Data model sketch

For Option A, use a **hybrid model**.

### A. Source-of-truth liturgical content

Still **file-based**, imported from the existing repo.

The repo’s content is already organized by Office and Mass data directories, so preserve that as the canonical editorial source at first.

### B. Structured database tables for modern app behavior

#### `liturgical_versions`


| Column      | Notes                             |
| ----------- | --------------------------------- |
| id          |                                   |
| slug        | e.g. `"1960"`, `"divino-afflatu"` |
| name        |                                   |
| description |                                   |
| is_active   |                                   |


#### `languages`


| Column    | Notes                  |
| --------- | ---------------------- |
| id        |                        |
| code      | `en`, `la`, `es`, `fr` |
| name      |                        |
| is_active |                        |


#### `calendar_days`


| Column             | Notes |
| ------------------ | ----- |
| id                 |       |
| date               |       |
| version_id         |       |
| season             |       |
| week_of_season     |       |
| day_name           |       |
| rank               |       |
| class_name         |       |
| color              |       |
| temporal_code      |       |
| sanctoral_code     |       |
| has_first_vespers  |       |
| has_second_vespers |       |
| fasting_note       |       |
| abstinence_note    |       |
| raw_engine_hash    |       |


#### `offices`


| Column          | Notes                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| id              |                                                                            |
| date            |                                                                            |
| version_id      |                                                                            |
| language_id     |                                                                            |
| hour            | `matins`, `lauds`, `prime`, `terce`, `sext`, `none`, `vespers`, `compline` |
| title           |                                                                            |
| subtitle        |                                                                            |
| raw_engine_hash |                                                                            |
| normalized_json |                                                                            |
| rendered_html   |                                                                            |


#### `masses`


| Column          | Notes |
| --------------- | ----- |
| id              |       |
| date            |       |
| version_id      |       |
| language_id     |       |
| title           |       |
| rank            |       |
| color           |       |
| normalized_json |       |
| rendered_html   |       |
| raw_engine_hash |       |


#### `commemorations`


| Column      | Notes             |
| ----------- | ----------------- |
| id          |                   |
| parent_type | `office` | `mass` |
| parent_id   |                   |
| order_index |                   |
| title       |                   |
| collect     |                   |
| summary     |                   |


#### `users`


| Column           | Notes |
| ---------------- | ----- |
| id               |       |
| email_or_auth_id |       |
| created_at       |       |


#### `user_preferences`


| Column               | Notes |
| -------------------- | ----- |
| id                   |       |
| user_id              |       |
| default_version_id   |       |
| default_language_id  |       |
| parallel_language_id |       |
| default_hour         |       |
| theme                |       |
| font_scale           |       |
| show_rubrics         |       |


#### `import_runs`


| Column        | Notes |
| ------------- | ----- |
| id            |       |
| source_commit |       |
| started_at    |       |
| finished_at   |       |
| status        |       |
| notes         |       |


### Cache entries or Redis keys

**Key pattern examples:**

```
office:1960:en:2026-04-06:lauds
mass:1960:la:2026-04-06
calendar:1960:2026-04-06
```

---

## 7. The adapter contract

This is the hinge point.

Define an internal interface like:

```typescript
interface OfficeRequest {
  date: string;
  version: string;
  lang: string;
  hour:
    | "matins"
    | "lauds"
    | "prime"
    | "terce"
    | "sext"
    | "none"
    | "vespers"
    | "compline";
}

interface OfficeResponse {
  title: string;
  metadata: {
    date: string;
    version: string;
    lang: string;
    rank?: string;
    color?: string;
  };
  sections: OfficeSection[];
  rawHtml?: string;
  sourceHash: string;
}
```

At first, the Perl adapter fills this by parsing the legacy output.

Later, a native TypeScript engine can implement the same interface. That lets you swap the engine without breaking the frontend or API.

**That is the whole trick.**

---

## 8. Migration order

### Phase 1: Put a modern shell around the old engine

First build:

- API gateway
- Perl adapter
- Next.js frontend
- Redis cache
- Basic preferences

Do not rewrite liturgical logic yet.

### Phase 2: Migrate the calendar resolver

The first native rewrite should be the **calendar/day metadata** layer, because it unlocks a lot:

- Feast/day identification
- Rank and color
- Whether first vespers applies
- Commemorations list
- Page navigation

**Why first?** It is smaller than full Office rendering and gives immediate structure to the whole app.

### Phase 3: Migrate one Office hour end-to-end

After that, rewrite **Compline** first.

**Why Compline?**

- Comparatively bounded
- Repeated daily structure
- Easier than Matins
- Excellent proving ground for your section model

Then do:

- Lauds
- Vespers
- The little hours
- Finally Matins

**Matins is the dragon. Do not poke the dragon on day one.**

### Phase 4: Migrate Mass propers

Once the Office pipeline is stable, move to Mass:

- Daily metadata
- Propers
- Commemorations
- Readings

### Phase 5: Build editorial/admin tools

Only after the public reading experience works well.

Possible tools:

- Source file explorer
- Diff viewer between source revisions
- Override testing
- Validation against legacy engine
- Side-by-side “legacy vs new output”

---

## 9. Validation strategy

This part matters more than shiny code.

For each migrated endpoint, keep a **regression harness**:

- Same date
- Same version
- Same language
- Compare legacy output vs new engine output
- Flag differences by section

You want **thousands of comparison cases**:

- Ordinary weekdays
- Sundays
- Octaves
- Vigils
- Ember Days
- Holy Week
- All Souls
- Complex commemorations
- Leap years
- Edge rubrical transitions

If you do not build the diff harness, the rewrite will become liturgical improv. That is charming in jazz, not in a breviary.

---

## 10. Deployment sketch

### Services

- **frontend** — Next.js
- **api** — NestJS/Fastify
- **legacy-engine** — existing Perl app or CLI wrapper
- **redis**
- **postgres**
- **caddy**

### Production flow

```
User -> Caddy -> Next.js
                -> API
API -> Redis
API -> Postgres
API -> Perl adapter/service
Perl adapter -> existing source files / legacy logic
```

### Nice operational extras

- Daily warm-cache job for “today” and “tomorrow”
- Import job tied to upstream repo commit hash
- Structured logs
- Health endpoints:
  - `/health/live`
  - `/health/ready`

---

## 11. The main design rule

**Do not let the frontend know anything about Perl, file paths, or old parameter weirdness.**

The frontend should only know:

- Dates
- Versions
- Languages
- Hours
- Sections
- Metadata

That insulation is what buys you a future.

---

## Recommended first sprint

Build these five things first:

1. `GET /api/v1/calendar/day`
2. `GET /api/v1/office/hour`
3. `GET /api/v1/mass/day`
4. A Next.js `/today` page
5. A regression test harness comparing API output to legacy output

That gets you something real, fast, and safe.

---

## Next steps (optional)

- Concrete folder structure for the monorepo or multi-package layout
- Sample TypeScript interfaces for the full API surface and adapter boundaries

