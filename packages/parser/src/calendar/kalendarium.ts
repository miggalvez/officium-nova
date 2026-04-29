import type {
  KalendariumEntry,
  TemporalSubstitutionEntry
} from '../types/calendar.js';

const MONTH_HEADER_REGEX = /^\*.*\*$/u;

export function parseKalendarium(content: string): KalendariumEntry[] {
  const entries: KalendariumEntry[] = [];

  for (const rawLine of content.replace(/\r\n?/gu, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || MONTH_HEADER_REGEX.test(line)) {
      continue;
    }

    const fields = line.split('=');
    const dateKey = fields[0]?.trim();
    const fileRefField = fields[1]?.trim();

    if (!dateKey || !fileRefField) {
      continue;
    }

    if (fileRefField === 'XXXXX') {
      entries.push({
        dateKey,
        fileRef: fileRefField,
        suppressed: true
      });
      continue;
    }

    const refs = fileRefField.split('~').map((value) => value.trim()).filter(Boolean);
    const fileRef = refs[0];
    if (!fileRef) {
      continue;
    }

    const metadata = parseFeastMetadata(fields.slice(2));
    entries.push({
      dateKey,
      fileRef,
      ...metadata.primary,
      alternates: refs.length > 1 ? refs.slice(1) : undefined,
      ...(metadata.alternateTitles.length > 0
        ? { alternateTitles: metadata.alternateTitles }
        : {}),
      ...(metadata.alternateClassWeights.length > 0
        ? { alternateClassWeights: metadata.alternateClassWeights }
        : {}),
      suppressed: false
    });
  }

  return entries;
}

export function parseTemporalSubstitutions(content: string): TemporalSubstitutionEntry[] {
  const entries: TemporalSubstitutionEntry[] = [];

  for (const rawLine of content.replace(/\r\n?/gu, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || MONTH_HEADER_REGEX.test(line)) {
      continue;
    }

    const [assignmentRaw, versionFilterRaw] = line.split(';;', 2);
    const [sourceRaw, targetRaw] = (assignmentRaw ?? '').split('=', 2);
    const source = sourceRaw?.trim();
    const target = targetRaw?.trim();
    if (!source || !target) {
      continue;
    }

    const versionFilter = versionFilterRaw?.trim();
    entries.push({
      source,
      target,
      ...(versionFilter ? { versionFilter } : {})
    });
  }

  return entries;
}

function parseFeastMetadata(fields: readonly string[]): {
  readonly primary: Pick<KalendariumEntry, 'title' | 'classWeight'>;
  readonly alternateTitles: string[];
  readonly alternateClassWeights: number[];
} {
  const titles: string[] = [];
  const classWeights: number[] = [];

  for (let index = 0; index < fields.length; index += 2) {
    const title = fields[index]?.trim();
    const classWeight = parseClassWeight(fields[index + 1]);
    if (title) {
      titles.push(title);
    }
    if (classWeight !== undefined) {
      classWeights.push(classWeight);
    }
  }

  return {
    primary: {
      ...(titles[0] ? { title: titles[0] } : {}),
      ...(classWeights[0] !== undefined ? { classWeight: classWeights[0] } : {})
    },
    alternateTitles: titles.slice(1),
    alternateClassWeights: classWeights.slice(1)
  };
}

function parseClassWeight(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
