import { describe, expect, it } from 'vitest';

import {
  buildCompline,
  rubrics1960Policy,
  type Celebration,
  type CelebrationRuleSet,
  type ClassSymbol1960,
  type ConcurrenceReason,
  type ConcurrenceResult,
  type DayConcurrencePreview
} from '../../src/index.js';

describe('buildCompline', () => {
  it('uses vespers-winner source for ordinary Sunday concurrence', () => {
    const today = makePreview('2024-06-09', 'I-privilegiata-sundays', {
      path: 'Tempora/Pent03-0',
      source: 'temporal',
      dayName: 'Pent03-0'
    });
    const tomorrow = makePreview('2024-06-10', 'IV', {
      path: 'Tempora/Pent03-1',
      source: 'temporal',
      dayName: 'Pent03-1'
    });
    const concurrence = makeConcurrence('today', today.celebration, 'today-higher-rank');

    const compline = buildCompline({
      concurrence,
      today,
      tomorrow,
      policy: rubrics1960Policy
    });

    expect(compline.hour).toBe('compline');
    expect(compline.source.kind).toBe('vespers-winner');
    expect(compline.directives).toEqual(['preces-dominicales']);
  });

  it('uses ordinary source for a ferial weekday with today as Vespers winner', () => {
    const today = makePreview('2024-11-05', 'IV', {
      path: 'Tempora/Pent24-2',
      source: 'temporal',
      dayName: 'Pent24-2'
    });
    const tomorrow = makePreview('2024-11-06', 'IV', {
      path: 'Tempora/Pent24-3',
      source: 'temporal',
      dayName: 'Pent24-3'
    });
    const concurrence = makeConcurrence('today', today.celebration, 'today-only-has-vespers');

    const compline = buildCompline({
      concurrence,
      today,
      tomorrow,
      policy: rubrics1960Policy
    });

    expect(compline.hour).toBe('compline');
    expect(compline.source.kind).toBe('ordinary');
    expect(compline.directives).toEqual([]);
  });

  it('uses the winner temporal when First Vespers wins on a weekday (Codex P1 #3)', async () => {
    const { TestOfficeTextIndex } = await import('../helpers.js');
    const { loadOrdinariumSkeleton, deriveHourRuleSet } = await import('../../src/index.js');
    const { buildVersionRegistry, resolveVersion, asVersionHandle } = await import(
      '../../src/index.js'
    );
    const { VERSION_POLICY } = await import('../../src/version/policy-map.js');

    const corpus = new TestOfficeTextIndex();
    corpus.add(
      'horas/Ordinarium/Completorium.txt',
      ['#Incipit', '$Confiteor', '', '#Psalmi', '', '#Hymnus', '', '#Canticum: Nunc dimittis', '', '#Oratio', '', '#Conclusio'].join('\n')
    );

    // Saturday evening, concurrence winner is the Sunday celebration.
    const today = makePreview('2024-01-06', 'IV', {
      path: 'Tempora/Sabbato',
      source: 'temporal',
      dayName: 'Nat2-5'
    });
    const sundayCelebration: Celebration = {
      feastRef: { path: 'Tempora/Epi1-0', id: 'Tempora/Epi1-0', title: 'Epi1-0' },
      rank: {
        name: 'I-privilegiata-sundays',
        classSymbol: 'I-privilegiata-sundays',
        weight: 1250
      },
      source: 'temporal'
    };
    const tomorrow: DayConcurrencePreview = {
      ...makePreview('2024-01-07', 'I-privilegiata-sundays', {
        path: 'Tempora/Epi1-0',
        source: 'temporal',
        dayName: 'Epi1-0'
      }),
      temporal: {
        date: '2024-01-07',
        dayOfWeek: 0,
        weekStem: 'Epi1',
        dayName: 'Epi1-0',
        season: 'epiphanytide',
        feastRef: sundayCelebration.feastRef,
        rank: sundayCelebration.rank
      }
    };
    const concurrence = makeConcurrence('tomorrow', sundayCelebration, 'tomorrow-higher-rank');

    const registry = buildVersionRegistry([
      {
        version: 'Rubrics 1960 - 1960',
        kalendar: '1960',
        transfer: '1960',
        stransfer: '1960'
      }
    ]);
    const version = resolveVersion(
      asVersionHandle('Rubrics 1960 - 1960'),
      registry,
      VERSION_POLICY
    );
    const skeleton = loadOrdinariumSkeleton('compline', version, corpus);
    const hourRules = deriveHourRuleSet(sundayCelebration, tomorrow.celebrationRules, 'compline');

    const compline = buildCompline({
      concurrence,
      today,
      tomorrow,
      policy: rubrics1960Policy,
      skeleton,
      celebration: sundayCelebration,
      commemorations: [],
      celebrationRules: tomorrow.celebrationRules,
      hourRules,
      corpus,
      temporal: tomorrow.temporal
    });

    const psalmody = compline.slots.psalmody;
    expect(psalmody?.kind).toBe('psalmody');
    if (psalmody?.kind === 'psalmody') {
      expect(psalmody.psalms[0]?.psalmRef.section).toBe('Compl Day0');
    }
  });

  it('uses triduum-special source and directives on Good Friday', () => {
    const today = makePreview('2024-03-29', 'I-privilegiata-triduum', {
      path: 'Tempora/Quad6-5',
      source: 'temporal',
      dayName: 'Quad6-5'
    });
    const tomorrow = makePreview('2024-03-30', 'I-privilegiata-triduum', {
      path: 'Tempora/Quad6-6',
      source: 'temporal',
      dayName: 'Quad6-6'
    });
    const concurrence = makeConcurrence('today', today.celebration, 'triduum-special');

    const compline = buildCompline({
      concurrence,
      today,
      tomorrow,
      policy: rubrics1960Policy
    });

    expect(compline.hour).toBe('compline');
    expect(compline.source).toEqual({
      kind: 'triduum-special',
      dayName: 'Quad6-5'
    });
    expect(compline.directives).toEqual(['omit-gloria-patri', 'short-chapter-only']);
  });
});

function makeConcurrence(
  winner: 'today' | 'tomorrow',
  source: Celebration,
  reason: ConcurrenceReason
): ConcurrenceResult {
  return {
    winner,
    source,
    commemorations: [],
    reason,
    warnings: []
  };
}

function makePreview(
  isoDate: string,
  classSymbol: ClassSymbol1960,
  options: {
    readonly path: string;
    readonly source: Celebration['source'];
    readonly dayName: string;
    readonly hasFirstVespers?: boolean;
    readonly hasSecondVespers?: boolean;
  }
): DayConcurrencePreview {
  const celebration: Celebration = {
    feastRef: {
      path: options.path,
      id: options.path,
      title: options.path
    },
    rank: {
      name: classSymbol,
      classSymbol,
      weight: classWeight(classSymbol)
    },
    source: options.source
  };
  const rules = makeRuleSet(options.hasFirstVespers ?? true, options.hasSecondVespers ?? true);

  return {
    date: isoDate,
    temporal: {
      date: isoDate,
      dayOfWeek: new Date(`${isoDate}T00:00:00Z`).getUTCDay(),
      weekStem: options.dayName.split('-', 1)[0] ?? options.dayName,
      dayName: options.dayName,
      season: options.dayName.startsWith('Quad') ? 'passiontide' : 'time-after-pentecost',
      feastRef: {
        path: options.path,
        id: options.path,
        title: options.path
      },
      rank: celebration.rank
    },
    celebration,
    celebrationRules: rules,
    commemorations: [],
    firstVespersClass: 'totum',
    secondVespersClass: 'totum',
    hasFirstVespers: rules.hasFirstVespers,
    hasSecondVespers: rules.hasSecondVespers
  };
}

function classWeight(classSymbol: ClassSymbol1960): number {
  return (
    {
      'I-privilegiata-triduum': 1300,
      'I-privilegiata-sundays': 1250,
      'I-privilegiata-ash-wednesday': 1240,
      'I-privilegiata-holy-week-feria': 1230,
      'I-privilegiata-christmas-vigil': 1220,
      'I-privilegiata-rogation-monday': 1210,
      'II-ember-day': 850,
      I: 1000,
      II: 800,
      III: 600,
      'IV-lenten-feria': 450,
      IV: 400,
      'commemoration-only': 100
    } satisfies Record<ClassSymbol1960, number>
  )[classSymbol];
}

function makeRuleSet(hasFirstVespers: boolean, hasSecondVespers: boolean): CelebrationRuleSet {
  return {
    matins: {
      lessonCount: 9,
      nocturns: 3,
      rubricGate: 'always'
    },
    hasFirstVespers,
    hasSecondVespers,
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
