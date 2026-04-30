import type { KalendariumEntry } from '@officium-novum/parser';

import { canonicalContentDir, resolveOfficeDefinition } from '../internal/content.js';
import { annotateSanctoralCandidate } from '../candidates/metadata.js';
import {
  dayOfWeek,
  formatIsoDate,
  normalizeDateInput,
  sanctoralDateKey,
  type CalendarDate
} from '../internal/date.js';
import { liturgicalSeasonForDate } from '../temporal/season.js';
import { normalizeRank } from './rank-normalizer.js';
import type {
  DateInput,
  KalendariumTable,
  OfficeTextIndex,
  SanctoralCandidate
} from '../types/model.js';
import type {
  ResolvedVersion,
  VersionRegistry,
  VersionRegistryRow
} from '../types/version.js';

export function sanctoralCandidates(
  input: DateInput | CalendarDate,
  version: ResolvedVersion,
  registry: VersionRegistry,
  kalendarium: KalendariumTable,
  corpus: OfficeTextIndex
): readonly SanctoralCandidate[] {
  const date = normalizeDateInput(input);
  const key = sanctoralDateKey(date);
  const season = liturgicalSeasonForDate(date);
  const weekday = dayOfWeek(date);
  const isoDate = formatIsoDate(date);
  const lookup = lookupEntriesForDate(key, version, registry, kalendarium);
  const contentDir = canonicalContentDir('Sancti', version);

  return lookup.entries
    .filter((entry) => !entry.suppressed)
    .flatMap((entry) => {
      const refs = [entry.fileRef, ...(entry.alternates ?? [])];

      return refs.map<SanctoralCandidate>((ref, index) => {
        const metadata = lookup.useEntryMetadata ? kalendariumMetadataAt(entry, index) : {};
        const canonicalPath = `${contentDir}/${ref}`;
        const definition = resolveOfficeDefinition(corpus, canonicalPath, {
          date,
          dayOfWeek: weekday,
          season,
          version
        });

        return annotateSanctoralCandidate({
          dateKey: key,
          feastRef: definition.feastRef,
          rank: normalizeRank(
            {
              ...definition.rawRank,
              ...(metadata.classWeight !== undefined
                ? {
                    classWeight: metadata.classWeight,
                    ...rankNameFromKalendariumClass(metadata.classWeight, version)
                  }
                : {})
            },
            version.policy,
            {
              date: isoDate,
              feastPath: definition.feastRef.path,
              source: 'sanctoral',
              version: version.handle,
              season
            }
          )
        });
      });
    });
}

function kalendariumMetadataAt(
  entry: KalendariumEntry,
  index: number
): { readonly classWeight?: number } {
  if (index === 0) {
    return {
      ...(entry.classWeight !== undefined ? { classWeight: entry.classWeight } : {})
    };
  }

  const alternateIndex = index - 1;
  return {
    ...(entry.alternateClassWeights?.[alternateIndex] !== undefined
      ? { classWeight: entry.alternateClassWeights[alternateIndex] }
      : {})
  };
}

function rankNameFromKalendariumClass(
  classWeight: number,
  version: ResolvedVersion
): { readonly name: string } | {} {
  if (version.policy.name !== 'rubrics-1960') {
    return {};
  }

  if (classWeight >= 6) {
    return { name: 'I. classis' };
  }
  if (classWeight >= 5) {
    return { name: 'II. classis' };
  }
  if (classWeight >= 2) {
    return { name: 'III. classis' };
  }
  return { name: 'IV. classis' };
}

function lookupEntriesForDate(
  dateKey: string,
  version: ResolvedVersion,
  registry: VersionRegistry,
  kalendarium: KalendariumTable
): {
  readonly entries: readonly KalendariumEntry[];
  readonly useEntryMetadata: boolean;
} {
  let current: Pick<ResolvedVersion, 'kalendar' | 'base'> | VersionRegistryRow | undefined = version;
  let inheritedDepth = 0;
  while (current) {
    const table = kalendarium.get(current.kalendar);
    const entries = table?.get(dateKey);
    if (entries) {
      return {
        entries,
        useEntryMetadata: inheritedDepth <= 1
      };
    }

    if (!current.base) {
      return {
        entries: [],
        useEntryMetadata: false
      };
    }

    const baseHandle = current.base;
    current = registry.get(baseHandle);
    inheritedDepth += 1;
    if (!current) {
      throw new Error(`Unknown base version in registry: ${baseHandle}`);
    }
  }

  return {
    entries: [],
    useEntryMetadata: false
  };
}
