import type {
  PsalmAssignment,
  TextReference
} from '../types/hour-structure.js';
import type { Celebration, HourName } from '../types/ordo.js';
import type { TemporalContext } from '../types/model.js';
import type {
  CelebrationRuleSet,
  HourRuleSet,
  PsalmOverride
} from '../types/rule-set.js';

export interface SelectPsalmodyInput {
  readonly hour: HourName;
  readonly celebration: Celebration;
  readonly celebrationRules: CelebrationRuleSet;
  readonly hourRules: HourRuleSet;
  readonly temporal: TemporalContext;
}

const PSALMI_MAJOR = 'horas/Latin/Psalterium/Psalmi/Psalmi major';
const PSALMI_MINOR = 'horas/Latin/Psalterium/Psalmi/Psalmi minor';
const PSALMORUM_ROOT = 'horas/Latin/Psalterium/Psalmorum';

/**
 * Roman 1960 psalter selection per §16.2.
 *
 * Emits {@link TextReference}s keyed into the shared Psalterium data files.
 * The actual psalm numbers live in `Psalterium/Psalmi/Psalmi major.txt` and
 * `Psalmi minor.txt`; this function only names the section (e.g. `Day0 Vespera`
 * for Sunday Vespers). Phase 3 dereferences those sections to text.
 */
export function selectPsalmodyRoman1960(
  params: SelectPsalmodyInput
): readonly PsalmAssignment[] {
  const { hour, hourRules, temporal, celebrationRules } = params;

  const overrides = hourRules.psalmOverrides;
  if (overrides.length > 0) {
    const refs = overrides
      .filter((override) => overrideAppliesToHour(override, hour))
      .map((override) => psalmOverrideReference(override));
    if (refs.length > 0) {
      return refs.map((psalmRef): PsalmAssignment => ({ psalmRef }));
    }
  }

  if (hourRules.psalterScheme === 'proper') {
    return properFeastReferences(params);
  }

  if (hourRules.psalterScheme === 'festal' && !isTemporalCelebration(params)) {
    return festalReferences(params);
  }

  if (hour === 'prime' || hour === 'terce' || hour === 'sext' || hour === 'none') {
    return minorHourReferences(hour, temporal, hourRules);
  }

  if (hour === 'compline') {
    return complineReferences(temporal);
  }

  // §16.2 step 4: `psalterScheme === 'dominica'` (e.g. `Psalmi Dominica` in a
  // feast's [Rule]) forces the Sunday distribution even on a weekday.
  const useSundayPsalmody =
    hourRules.psalterScheme === 'dominica' || isSundayForMajorHour(hour, temporal);

  if (hour === 'lauds') {
    return laudsReferences(temporal, celebrationRules, useSundayPsalmody);
  }

  if (hour === 'vespers') {
    return vespersReferences(temporal, useSundayPsalmody);
  }

  return [];
}

function isSundayForMajorHour(hour: HourName, temporal: TemporalContext): boolean {
  return (hour === 'lauds' || hour === 'vespers') && temporal.dayOfWeek === 0;
}

function laudsReferences(
  temporal: TemporalContext,
  celebrationRules: CelebrationRuleSet,
  useSundayPsalmody: boolean
): readonly PsalmAssignment[] {
  // RI §§170-172: 1960 restores Lauds I (festive) for Sundays and feasts;
  // Lauds II (penitential) remains for penitential ferias.
  const usePenitential = isPenitentialDay(temporal) && !celebrationRules.festumDomini;
  const scheme = usePenitential ? 'Laudes2' : 'Laudes1';
  const weekday = useSundayPsalmody ? 0 : temporal.dayOfWeek;
  const section = `Day${weekday} ${scheme}`;
  return [
    {
      psalmRef: { path: PSALMI_MAJOR, section }
    }
  ];
}

function vespersReferences(
  temporal: TemporalContext,
  useSundayPsalmody: boolean
): readonly PsalmAssignment[] {
  const weekday = useSundayPsalmody ? 0 : temporal.dayOfWeek;
  const section = `Day${weekday} Vespera`;
  return [
    {
      psalmRef: { path: PSALMI_MAJOR, section }
    }
  ];
}

function complineReferences(temporal: TemporalContext): readonly PsalmAssignment[] {
  // Pius X's Compline (1911) varies by day of week; 1960 retains that
  // distribution — the source file stores it as weekday-keyed entries under
  // the shared `Completorium` section in `Psalmi minor.txt`.
  const weekdayKey = WEEKDAY_KEYS[temporal.dayOfWeek] ?? WEEKDAY_KEYS[0];
  return [
    {
      psalmRef: { path: PSALMI_MINOR, section: 'Completorium', selector: weekdayKey }
    }
  ];
}

function minorHourReferences(
  hour: 'prime' | 'terce' | 'sext' | 'none',
  temporal: TemporalContext,
  hourRules: HourRuleSet
): readonly PsalmAssignment[] {
  const hourSection = MINOR_HOUR_SECTION[hour];
  const weekday = hourRules.psalterScheme === 'dominica' ? 0 : temporal.dayOfWeek;
  const weekdayKey = WEEKDAY_KEYS[weekday];
  return [
    {
      psalmRef: {
        path: PSALMI_MINOR,
        section: hourSection,
        selector: weekdayKey
      }
    }
  ];
}

function properFeastReferences(
  params: SelectPsalmodyInput
): readonly PsalmAssignment[] {
  // When the feast carries its own psalmody, reference its per-hour psalm
  // section. Phase 3 resolves the actual psalm numbers.
  const feastPath = `horas/Latin/${params.celebration.feastRef.path}`;
  const section = FEAST_PSALM_SECTION[params.hour] ?? 'Psalmi';
  return [
    {
      psalmRef: { path: feastPath, section }
    }
  ];
}

function festalReferences(
  params: SelectPsalmodyInput
): readonly PsalmAssignment[] {
  // For doubles and I/II-class feasts whose rules route to the Commune festal
  // psalmody. Phase 3 follows `CelebrationRuleSet.comkey` or the feast's `vide`
  // chain to resolve the concrete commune file.
  const comkey = params.celebrationRules.comkey ?? 'C10';
  const commonPath = `horas/Latin/Commune/${comkey}`;
  const section = FEAST_PSALM_SECTION[params.hour] ?? 'Psalmi';
  return [
    {
      psalmRef: { path: commonPath, section }
    }
  ];
}

function psalmOverrideReference(override: PsalmOverride): TextReference {
  // Override values are psalm numbers (or comma-separated lists like "62,66").
  // Phase 3 dereferences them against the per-psalm files at
  // `horas/Latin/Psalterium/Psalmorum/Psalm<N>.txt`. When multiple psalms
  // share one override slot the first number anchors the reference; the
  // `selector` preserves the full directive value so Phase 3 can split.
  const firstNumber = override.value.split(/[,\s]+/u)[0]?.trim() ?? '';
  const normalized = firstNumber.replace(/[^0-9]/gu, '');
  if (normalized.length === 0) {
    return {
      path: PSALMI_MAJOR,
      section: override.key,
      selector: override.value
    };
  }
  return {
    path: `${PSALMORUM_ROOT}/Psalm${normalized}`,
    section: '__preamble',
    selector: override.value
  };
}

function overrideAppliesToHour(override: PsalmOverride, hour: HourName): boolean {
  const key = override.key.toLowerCase();
  return key.includes(hour) || HOUR_ALIASES[hour].some((alias) => key.includes(alias));
}

function isTemporalCelebration(params: SelectPsalmodyInput): boolean {
  return params.celebration.source === 'temporal';
}

function isPenitentialDay(temporal: TemporalContext): boolean {
  return (
    temporal.season === 'lent' ||
    temporal.season === 'passiontide' ||
    temporal.season === 'septuagesima' ||
    temporal.dayName === 'Quadp3-3'
  );
}

const MINOR_HOUR_SECTION: Readonly<Record<'prime' | 'terce' | 'sext' | 'none', string>> = {
  prime: 'Prima',
  terce: 'Tertia',
  sext: 'Sexta',
  none: 'Nona'
};

const WEEKDAY_KEYS: readonly string[] = [
  'Dominica',
  'Feria II',
  'Feria III',
  'Feria IV',
  'Feria V',
  'Feria VI',
  'Sabbato'
];

const FEAST_PSALM_SECTION: Readonly<Partial<Record<HourName, string>>> = {
  lauds: 'Psalmi Laudes',
  vespers: 'Psalmi Vespera',
  prime: 'Psalmi Prima',
  terce: 'Psalmi Tertia',
  sext: 'Psalmi Sexta',
  none: 'Psalmi Nona',
  compline: 'Psalmi Completorium'
};

const HOUR_ALIASES: Readonly<Record<HourName, readonly string[]>> = {
  matins: ['matutinum', 'matins'],
  lauds: ['laudes', 'laud'],
  prime: ['prima', 'prime'],
  terce: ['tertia', 'terce'],
  sext: ['sexta', 'sext'],
  none: ['nona'],
  vespers: ['vespera', 'vespers'],
  compline: ['completorium', 'compline']
};
