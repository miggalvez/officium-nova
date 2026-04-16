import { describe, expect, it } from 'vitest';

import {
  rubrics1960Policy,
  type Candidate,
  type ClassSymbol1960,
  type TemporalContext
} from '../../src/index.js';

describe('rubrics1960Policy.resolveRank', () => {
  it('normalizes representative corpus ranks into 1960 classes', () => {
    const firstClass = rubrics1960Policy.resolveRank(
      { name: 'Duplex I classis', classWeight: 6.5 },
      context('2024-08-15', 'Sancti/08-15', 'sanctoral')
    );
    const secondClass = rubrics1960Policy.resolveRank(
      { name: 'Duplex II classis', classWeight: 5.1 },
      context('2024-09-14', 'Sancti/09-14', 'sanctoral')
    );
    const thirdClass = rubrics1960Policy.resolveRank(
      { name: 'Duplex', classWeight: 3 },
      context('2024-10-07', 'Sancti/10-07', 'sanctoral')
    );
    const fourthClass = rubrics1960Policy.resolveRank(
      { name: 'Simplex', classWeight: 1.1 },
      context('2024-10-11', 'Sancti/10-11', 'sanctoral')
    );
    const septemberEmber = rubrics1960Policy.resolveRank(
      { name: 'Feria', classWeight: 1 },
      context('2024-09-18', 'Tempora/Pent17-3', 'temporal', 'time-after-pentecost')
    );

    expect(firstClass.classSymbol).toBe('I');
    expect(secondClass.classSymbol).toBe('II');
    expect(thirdClass.classSymbol).toBe('III');
    expect(fourthClass.classSymbol).toBe('IV');
    expect(septemberEmber.classSymbol).toBe('II-ember-day');
  });

  it('assigns privileged temporal classes for Triduum and privileged feriae', () => {
    const triduum = rubrics1960Policy.resolveRank(
      { name: 'Feria privilegiata', classWeight: 7 },
      context('2024-03-29', 'Tempora/Quad6-5', 'temporal', 'passiontide')
    );
    const ashWednesday = rubrics1960Policy.resolveRank(
      { name: 'Feria privilegiata', classWeight: 7 },
      context('2024-02-14', 'Tempora/Quadp3-3', 'temporal', 'septuagesima')
    );
    const privilegedSunday = rubrics1960Policy.resolveRank(
      { name: 'Semiduplex I classis', classWeight: 6.9 },
      context('2024-03-24', 'Tempora/Quad6-0', 'temporal', 'passiontide')
    );

    expect(triduum.classSymbol).toBe('I-privilegiata-triduum');
    expect(ashWednesday.classSymbol).toBe('I-privilegiata-ash-wednesday');
    expect(privilegedSunday.classSymbol).toBe('I-privilegiata-sundays');
  });
});

describe('rubrics1960Policy.applySeasonPreemption', () => {
  it('suppresses all sanctoral candidates in the Sacred Triduum', () => {
    const temporalContext = temporal('2024-03-29', 'Quad6-5', 'passiontide');
    const candidates = [
      candidate('Tempora/Quad6-5', 'temporal', 'I-privilegiata-triduum'),
      candidate('Sancti/03-25', 'sanctoral', 'I'),
      candidate('Sancti/03-19', 'sanctoral', 'I')
    ] as const;

    const preempted = rubrics1960Policy.applySeasonPreemption(candidates, temporalContext);

    expect(preempted.kept.map((entry) => entry.feastRef.path)).toEqual(['Tempora/Quad6-5']);
    expect(preempted.suppressed.map((entry) => entry.candidate.feastRef.path)).toEqual([
      'Sancti/03-25',
      'Sancti/03-19'
    ]);
  });

  it('leaves candidates untouched outside the Triduum', () => {
    const temporalContext = temporal('2024-04-14', 'Pasc2-0', 'eastertide');
    const candidates = [
      candidate('Tempora/Pasc2-0', 'temporal', 'II'),
      candidate('Sancti/04-14', 'sanctoral', 'I')
    ] as const;

    const preempted = rubrics1960Policy.applySeasonPreemption(candidates, temporalContext);

    expect(preempted.kept).toEqual(candidates);
    expect(preempted.suppressed).toEqual([]);
  });
});

describe('rubrics1960Policy.compareCandidates', () => {
  it('orders by precedence weight descending', () => {
    const first = candidate('Sancti/04-14', 'sanctoral', 'I');
    const second = candidate('Tempora/Pasc2-0', 'temporal', 'II');
    expect(rubrics1960Policy.compareCandidates(first, second)).toBeLessThan(0);
    expect(rubrics1960Policy.compareCandidates(second, first)).toBeGreaterThan(0);
  });

  it('prefers temporal on equal rank as the deterministic tie-break', () => {
    const temporalCandidate = candidate('Tempora/Pasc2-1', 'temporal', 'III');
    const sanctoralCandidate = candidate('Sancti/07-17', 'sanctoral', 'III');
    expect(rubrics1960Policy.compareCandidates(temporalCandidate, sanctoralCandidate)).toBeLessThan(
      0
    );
  });

  it('allows privileged Sunday displacement only for the Dec 8 exception and first-class feasts of the Lord', () => {
    const privilegedSunday = candidate('Tempora/Adv2-0', 'temporal', 'I-privilegiata-sundays');
    const immaculate = candidate('Sancti/12-08', 'sanctoral', 'I');
    const stJoseph = candidate('Sancti/03-19', 'sanctoral', 'I');

    expect(rubrics1960Policy.compareCandidates(privilegedSunday, immaculate)).toBeGreaterThan(0);
    expect(rubrics1960Policy.compareCandidates(privilegedSunday, stJoseph)).toBeLessThan(0);
  });
});

describe('rubrics1960Policy.isPrivilegedFeria', () => {
  it.each([
    ['2024-02-14', 'Quadp3-3', true],
    ['2024-03-25', 'Quad6-1', true],
    ['2024-03-26', 'Quad6-2', true],
    ['2024-03-27', 'Quad6-3', true],
    ['2024-12-24', 'Adv4-2', true],
    ['2024-05-06', 'Pasc5-1', true],
    ['2024-04-14', 'Pasc2-0', false]
  ] as const)('%s (%s) -> %s', (date, dayName, expected) => {
    expect(rubrics1960Policy.isPrivilegedFeria(temporal(date, dayName, season(dayName)))).toBe(
      expected
    );
  });
});

describe('rubrics1960Policy.transferTarget', () => {
  it('walks past Holy Week before selecting the first allowed date', () => {
    const impeded = candidate('Sancti/03-25', 'sanctoral', 'I');
    const fromDate = { year: 2024, month: 3, day: 24 } as const;
    const until = { year: 2024, month: 4, day: 5 } as const;
    const byDate: Readonly<Record<string, TemporalContext>> = {
      '2024-03-25': temporal('2024-03-25', 'Quad6-1', 'passiontide'),
      '2024-03-26': temporal('2024-03-26', 'Quad6-2', 'passiontide'),
      '2024-03-27': temporal('2024-03-27', 'Quad6-3', 'passiontide'),
      '2024-03-28': temporal('2024-03-28', 'Quad6-4', 'passiontide'),
      '2024-03-29': temporal('2024-03-29', 'Quad6-5', 'passiontide'),
      '2024-03-30': temporal('2024-03-30', 'Quad6-6', 'passiontide'),
      '2024-03-31': temporal('2024-03-31', 'Pasc0-0', 'eastertide'),
      '2024-04-01': temporal('2024-04-01', 'Pasc0-1', 'eastertide')
    };

    const target = rubrics1960Policy.transferTarget(
      impeded,
      fromDate,
      until,
      (date) => byDate[toIso(date)] ?? temporal('2024-04-02', 'Pasc0-2', 'eastertide'),
      () => ({}),
      () => []
    );

    expect(target).toEqual({ year: 2024, month: 3, day: 31 });
  });
});

function context(
  date: string,
  feastPath: string,
  source: 'temporal' | 'sanctoral',
  seasonName: TemporalContext['season'] = 'time-after-pentecost'
) {
  return {
    date,
    feastPath,
    source,
    version: 'Rubrics 1960 - 1960',
    season: seasonName
  } as const;
}

function temporal(
  date: string,
  dayName: string,
  seasonName: TemporalContext['season']
): TemporalContext {
  return {
    date,
    dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
    weekStem: dayName.split('-', 1)[0] ?? dayName,
    dayName,
    season: seasonName,
    feastRef: {
      path: `Tempora/${dayName}`,
      id: `Tempora/${dayName}`,
      title: dayName
    },
    rank: rank('II')
  };
}

function candidate(path: string, source: Candidate['source'], classSymbol: ClassSymbol1960): Candidate {
  return {
    feastRef: {
      path,
      id: path,
      title: path
    },
    rank: rank(classSymbol),
    source
  };
}

function rank(classSymbol: ClassSymbol1960) {
  const row = rubrics1960Policy.precedenceRow(classSymbol);
  return {
    name: classSymbol,
    classSymbol,
    weight: row.weight
  } as const;
}

function season(dayName: string): TemporalContext['season'] {
  if (dayName.startsWith('Adv')) {
    return 'advent';
  }
  if (dayName.startsWith('Quadp')) {
    return 'septuagesima';
  }
  if (dayName.startsWith('Quad5') || dayName.startsWith('Quad6')) {
    return 'passiontide';
  }
  if (dayName.startsWith('Quad')) {
    return 'lent';
  }
  if (dayName.startsWith('Pasc')) {
    return 'eastertide';
  }
  return 'time-after-pentecost';
}

function toIso(date: { readonly year: number; readonly month: number; readonly day: number }): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(
    date.day
  ).padStart(2, '0')}`;
}
