import {
  dayOfWeek,
  formatIsoDate,
  normalizeDateInput,
  type CalendarDate
} from '../internal/date.js';
import { canonicalContentDir, resolveOfficeDefinition } from '../internal/content.js';
import { normalizeRank } from '../sanctoral/rank-normalizer.js';
import type {
  DateInput,
  OfficeTextIndex,
  TemporalContext,
  TemporalSubstitutionTable
} from '../types/model.js';
import type { ResolvedVersion, VersionRegistry } from '../types/version.js';

import { dayNameForDate, weekStemForDate } from './day-name.js';
import { liturgicalSeasonForDate } from './season.js';

export function buildTemporalContext(
  input: DateInput | CalendarDate,
  version: ResolvedVersion,
  corpus: OfficeTextIndex,
  options: {
    readonly registry?: VersionRegistry;
    readonly temporalSubstitutions?: TemporalSubstitutionTable;
  } = {}
): TemporalContext {
  const date = normalizeDateInput(input);
  const weekday = dayOfWeek(date);
  const weekStem = weekStemForDate(date);
  const dayName = dayNameForDate(date);
  const season = liturgicalSeasonForDate(date);
  const naturalPath = `${canonicalContentDir('Tempora', version)}/${dayName}`;
  const canonicalPath = resolveTemporalSubstitution(
    naturalPath,
    version,
    options.temporalSubstitutions
  );
  const definition = resolveOfficeDefinition(corpus, canonicalPath, {
    date,
    dayOfWeek: weekday,
    season,
    version
  });

  return {
    date: formatIsoDate(date),
    dayOfWeek: weekday,
    weekStem,
    dayName,
    season,
    feastRef: definition.feastRef,
    rank: normalizeRank(definition.rawRank, version.policy, {
      date: formatIsoDate(date),
      feastPath: definition.feastRef.path,
      source: 'temporal',
      version: version.handle,
      season
    })
  };
}

function resolveTemporalSubstitution(
  naturalPath: string,
  version: ResolvedVersion,
  temporalSubstitutions: TemporalSubstitutionTable | undefined
): string {
  if (!temporalSubstitutions) {
    return naturalPath;
  }

  const entry = temporalSubstitutions.get(version.transfer)?.get(naturalPath);
  if (!entry || entry.target === 'XXXXX' || entry.target.endsWith('r')) {
    return naturalPath;
  }

  return entry.target;
}
