import { describe, expect, it } from 'vitest';

import {
  selectPsalmodyRoman1960,
  type Celebration,
  type CelebrationRuleSet,
  type HourRuleSet,
  type LiturgicalSeason,
  type TemporalContext
} from '../../src/index.js';

function temporal(
  isoDate: string,
  dayName: string,
  season: LiturgicalSeason,
  dayOfWeek: number
): TemporalContext {
  return {
    date: isoDate,
    dayOfWeek,
    weekStem: dayName.split('-', 1)[0] ?? dayName,
    dayName,
    season,
    feastRef: { path: `Tempora/${dayName}`, id: `Tempora/${dayName}`, title: dayName },
    rank: { name: 'IV', classSymbol: 'IV', weight: 400 }
  };
}

function celebration(path: string): Celebration {
  return {
    feastRef: { path, id: path, title: path.split('/').at(-1) ?? path },
    rank: { name: 'IV', classSymbol: 'IV', weight: 400 },
    source: 'temporal'
  };
}

function baseCelebrationRules(): CelebrationRuleSet {
  return {
    matins: { lessonCount: 9, nocturns: 3, rubricGate: 'always' },
    hasFirstVespers: true,
    hasSecondVespers: true,
    lessonSources: [],
    lessonSetAlternates: [],
    festumDomini: false,
    conclusionMode: 'separate',
    antiphonScheme: 'default',
    omitCommemoration: false,
    noSuffragium: false,
    quorumFestum: false,
    commemoratio3: false,
    unaAntiphona: false,
    unmapped: [],
    hourScopedDirectives: []
  };
}

function hourRules(
  hour: HourRuleSet['hour'],
  overrides: Partial<HourRuleSet> = {}
): HourRuleSet {
  return {
    hour,
    omit: [],
    psalterScheme: 'ferial',
    psalmOverrides: [],
    minorHoursSineAntiphona: false,
    minorHoursFerialPsalter: false,
    ...overrides
  };
}

describe('selectPsalmodyRoman1960', () => {
  it('routes Sunday Vespers to Day0 Vespera section', () => {
    const refs = selectPsalmodyRoman1960({
      hour: 'vespers',
      celebration: celebration('Tempora/Pent03-0'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('vespers'),
      temporal: temporal('2024-06-09', 'Pent03-0', 'time-after-pentecost', 0)
    });

    expect(refs).toHaveLength(1);
    expect(refs[0]?.psalmRef.section).toBe('Day0 Vespera');
    expect(refs[0]?.psalmRef.path).toContain('Psalmi major');
  });

  it('emits Laudes I on festive days and Laudes II on penitential ferias', () => {
    const festive = selectPsalmodyRoman1960({
      hour: 'lauds',
      celebration: celebration('Tempora/Pent03-0'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('lauds'),
      temporal: temporal('2024-06-09', 'Pent03-0', 'time-after-pentecost', 0)
    });
    expect(festive[0]?.psalmRef.section).toBe('Day0 Laudes1');

    const penitential = selectPsalmodyRoman1960({
      hour: 'lauds',
      celebration: celebration('Tempora/Quad2-1'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('lauds'),
      temporal: temporal('2024-02-26', 'Quad2-1', 'lent', 1)
    });
    expect(penitential[0]?.psalmRef.section).toBe('Day1 Laudes2');
  });

  it('selects proper feast psalmody when psalterScheme is proper', () => {
    const refs = selectPsalmodyRoman1960({
      hour: 'vespers',
      celebration: celebration('Sancti/08-15'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('vespers', { psalterScheme: 'proper' }),
      temporal: temporal('2024-08-15', 'Pent13-4', 'time-after-pentecost', 4)
    });

    expect(refs[0]?.psalmRef.path).toBe('horas/Latin/Sancti/08-15');
    expect(refs[0]?.psalmRef.section).toBe('Psalmi Vespera');
  });

  it('uses Sunday distribution on a weekday when psalterScheme is dominica (Codex P1 #4)', () => {
    // Assumption (2024-08-15) is a Thursday but its [Rule] says `Psalmi Dominica`.
    const refs = selectPsalmodyRoman1960({
      hour: 'vespers',
      celebration: celebration('Sancti/08-15'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('vespers', { psalterScheme: 'dominica' }),
      temporal: temporal('2024-08-15', 'Pent13-4', 'time-after-pentecost', 4)
    });

    expect(refs[0]?.psalmRef.section).toBe('Day0 Vespera');
  });

  it('psalm overrides emit per-psalm Psalmorum refs (Codex P1 #5)', () => {
    const refs = selectPsalmodyRoman1960({
      hour: 'vespers',
      celebration: celebration('Sancti/10-02'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('vespers', {
        psalmOverrides: [{ key: 'Psalm5 Vespera', value: '116' }]
      }),
      temporal: temporal('2024-10-02', 'Pent19-3', 'time-after-pentecost', 3)
    });

    expect(refs).toHaveLength(1);
    expect(refs[0]?.psalmRef.path).toBe(
      'horas/Latin/Psalterium/Psalmorum/Psalm116'
    );
    expect(refs[0]?.psalmRef.selector).toBe('116');
  });

  it('routes a minor hour (Sext) to Psalmi minor with weekday selector', () => {
    const refs = selectPsalmodyRoman1960({
      hour: 'sext',
      celebration: celebration('Tempora/Pent03-2'),
      celebrationRules: baseCelebrationRules(),
      hourRules: hourRules('sext'),
      temporal: temporal('2024-06-11', 'Pent03-2', 'time-after-pentecost', 2)
    });

    expect(refs[0]?.psalmRef.section).toBe('Sexta');
    expect(refs[0]?.psalmRef.selector).toBe('Feria III');
  });
});
