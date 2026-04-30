import { describe, expect, it } from 'vitest';

import {
  asVersionHandle,
  thirdClassSanctoralWeekdayInPaschaltide,
  type Celebration,
  type LiturgicalSeason,
  type TemporalContext
} from '../../src/index.js';

const baseCelebration: Celebration = {
  feastRef: { path: 'Sancti/04-29', id: 'Sancti/04-29', title: 'S. Petri Martyris' },
  rank: { name: 'III. classis', classSymbol: 'III', weight: 600 },
  source: 'sanctoral'
};

const baseTemporal: TemporalContext = {
  date: '2026-04-29',
  dayOfWeek: 3,
  weekStem: 'Pasc3',
  dayName: 'Pasc3-3',
  season: 'eastertide',
  feastRef: { path: 'Tempora/Pasc3-3Feria', id: 'Tempora/Pasc3-3Feria', title: 'Feria' },
  rank: { name: 'Feria', classSymbol: 'IV', weight: 200 }
};

describe('thirdClassSanctoralWeekdayInPaschaltide', () => {
  it('applies to 1960 third-class sanctoral offices on Paschaltide weekdays', () => {
    expect(
      thirdClassSanctoralWeekdayInPaschaltide({
        celebration: baseCelebration,
        temporal: baseTemporal,
        version: { handle: asVersionHandle('Rubrics 1960 - 1960') }
      })
    ).toBe(true);
  });

  it('does not apply outside the 1960 third-class sanctoral Paschaltide weekday family', () => {
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly celebration?: Celebration;
      readonly temporal?: TemporalContext;
      readonly handle?: string;
    }> = [
      {
        name: 'non-1960 handles',
        handle: 'Reduced - 1955'
      },
      {
        name: 'Sundays',
        temporal: { ...baseTemporal, dayOfWeek: 0, dayName: 'Pasc3-0' }
      },
      {
        name: 'non-Paschaltide days',
        temporal: { ...baseTemporal, season: 'time-after-pentecost' satisfies LiturgicalSeason }
      },
      {
        name: 'temporal offices',
        celebration: { ...baseCelebration, source: 'temporal' }
      },
      {
        name: 'higher-class sanctoral offices',
        celebration: {
          ...baseCelebration,
          rank: { name: 'II. classis', classSymbol: 'II', weight: 800 }
        }
      },
      {
        name: 'lower-class sanctoral offices',
        celebration: {
          ...baseCelebration,
          rank: { name: 'IV. classis', classSymbol: 'IV', weight: 300 }
        }
      }
    ];

    for (const testCase of cases) {
      expect(
        thirdClassSanctoralWeekdayInPaschaltide({
          celebration: testCase.celebration ?? baseCelebration,
          temporal: testCase.temporal ?? baseTemporal,
          version: {
            handle: asVersionHandle(testCase.handle ?? 'Rubrics 1960 - 1960')
          }
        }),
        testCase.name
      ).toBe(false);
    }
  });
});
