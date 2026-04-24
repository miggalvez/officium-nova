# 1962ordo.today External Cross-Check Fixtures

This directory is reserved for normalized fixtures extracted from
[1962ordo.today](https://1962ordo.today/).

## Scope

Use this source only as a secondary cross-check for `rubrics-1960` /
1962 Roman liturgical-book behavior. It is useful for checking daily Mass and
Office selection, class, color, commemorations, occurrence/concurrence notes,
and practical Breviary guidance.

It is not a primary Ordo Recitandi corpus, and it does not apply to
`divino-afflatu` or `reduced-1955`.

## Capture Rules

- Store one normalized JSON file per year when extraction begins.
- Include source URL, retrieval date, and extractor version in every fixture.
- Keep general Roman fields separate from United States, SSPX, local, votive,
  and pastoral reminder notes.
- Compare only stable fields that map to `DayOfficeSummary` semantics.
- Use these fixtures to find candidate regressions; adjudication still requires
  the governing rubrical text, a published Ordo Recitandi, an in-repo ADR, or a
  dispositive corpus line per ADR-011.

## Suggested Fixture Shape

```json
{
  "source": "1962ordo.today",
  "sourceUrl": "https://1962ordo.today/?date=20240101",
  "retrievedAt": "2026-04-24",
  "policy": "rubrics-1960",
  "scope": "secondary-cross-check",
  "dates": [
    {
      "date": "2024-01-01",
      "generalRoman": {
        "celebrationTitle": "",
        "class": "",
        "color": "",
        "commemorations": []
      },
      "officeNotes": [],
      "massNotes": [],
      "excludedLocalNotes": []
    }
  ]
}
```
