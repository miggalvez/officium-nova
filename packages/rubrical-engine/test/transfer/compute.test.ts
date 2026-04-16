import { describe, expect, it } from 'vitest';

import {
  asVersionHandle,
  computeTransferTarget,
  walkTransferTargetDate,
  type Candidate,
  type DirectoriumOverlay,
  type ResolvedVersion,
  type RubricalPolicy,
  type TemporalContext
} from '../../src/index.js';
import { makeTestPolicy } from '../policy-fixture.js';

describe('computeTransferTarget', () => {
  it('finds the next free day for a transferable feast', () => {
    const policy = makeSearchPolicy();
    const result = computeTransferTarget({
      impeded: candidate('Sancti/03-25', 1000),
      fromDate: date(2024, 3, 25),
      version: version(policy),
      policy,
      dayContext: temporalByDate({
        '2024-03-26': temporal('2024-03-26', 'Quad6-2', 400)
      }),
      overlayFor: noOverlay,
      occupantOn: () => []
    });

    expect(result).toEqual({
      feastRef: feast('Sancti/03-25'),
      originalDate: '2024-03-25',
      target: '2024-03-26',
      source: 'rule-computed',
      reason: 'impeded-by-higher-rank'
    });
  });

  it('skips the next day when it is blocked by a higher-rank temporal', () => {
    const policy = makeSearchPolicy();
    const result = computeTransferTarget({
      impeded: candidate('Sancti/03-25', 1000),
      fromDate: date(2024, 3, 25),
      version: version(policy),
      policy,
      dayContext: temporalByDate({
        '2024-03-26': temporal('2024-03-26', 'Quad6-2', 1300),
        '2024-03-27': temporal('2024-03-27', 'Quad6-3', 400)
      }),
      overlayFor: noOverlay,
      occupantOn: () => []
    });

    expect(result).toEqual({
      feastRef: feast('Sancti/03-25'),
      originalDate: '2024-03-25',
      target: '2024-03-27',
      source: 'rule-computed',
      reason: 'impeded-by-higher-rank'
    });
  });

  it('skips overlay-substituted dates while searching', () => {
    const policy = makeSearchPolicy();
    const result = computeTransferTarget({
      impeded: candidate('Sancti/03-25', 1000),
      fromDate: date(2024, 3, 25),
      version: version(policy),
      policy,
      dayContext: temporalByDate({
        '2024-03-26': temporal('2024-03-26', 'Quad6-2', 400),
        '2024-03-27': temporal('2024-03-27', 'Quad6-3', 400)
      }),
      overlayFor: (d) =>
        iso(d) === '2024-03-26'
          ? {
              officeSubstitution: feast('Tempora/Nat2-0')
            }
          : {},
      occupantOn: () => []
    });

    expect(result).toEqual({
      feastRef: feast('Sancti/03-25'),
      originalDate: '2024-03-25',
      target: '2024-03-27',
      source: 'rule-computed',
      reason: 'impeded-by-higher-rank'
    });
  });

  it('respects policy gates and walks past Holy Week in 1960-like gating', () => {
    const policy = makeSearchPolicy({
      forbidsTransferInto: (_candidate, temporalContext) =>
        /^Quad6-/u.test(temporalContext.dayName)
    });
    const result = computeTransferTarget({
      impeded: candidate('Sancti/03-25', 1000),
      fromDate: date(2024, 3, 24),
      version: version(policy),
      policy,
      dayContext: temporalByDate({
        '2024-03-25': temporal('2024-03-25', 'Quad6-1', 400),
        '2024-03-26': temporal('2024-03-26', 'Quad6-2', 400),
        '2024-03-27': temporal('2024-03-27', 'Quad6-3', 400),
        '2024-03-28': temporal('2024-03-28', 'Quad6-4', 400),
        '2024-03-29': temporal('2024-03-29', 'Quad6-5', 400),
        '2024-03-30': temporal('2024-03-30', 'Quad6-6', 400),
        '2024-03-31': temporal('2024-03-31', 'Pasc0-0', 1300),
        '2024-04-01': temporal('2024-04-01', 'Pasc0-1', 400)
      }),
      overlayFor: noOverlay,
      occupantOn: () => []
    });

    expect(result).toEqual({
      feastRef: feast('Sancti/03-25'),
      originalDate: '2024-03-24',
      target: '2024-04-01',
      source: 'rule-computed',
      reason: 'impeded-by-higher-rank'
    });
  });

  it('returns perpetually impeded when every day in the search window is blocked', () => {
    const policy = makeSearchPolicy();
    const result = computeTransferTarget({
      impeded: candidate('Sancti/03-25', 1000),
      fromDate: date(2024, 3, 25),
      version: version(policy),
      policy,
      dayContext: () => temporal('2024-03-26', 'Quad6-2', 1300),
      overlayFor: noOverlay,
      occupantOn: () => [],
      maxDays: 60
    });

    expect(result).toEqual({
      feastRef: feast('Sancti/03-25'),
      originalDate: '2024-03-25',
      target: null,
      reason: 'perpetually-impeded',
      daysSearched: 60
    });
  });

  it('caps search length at 60 days by default', () => {
    const policy = makeSearchPolicy();
    const result = computeTransferTarget({
      impeded: candidate('Sancti/03-25', 1000),
      fromDate: date(2024, 3, 25),
      version: version(policy),
      policy,
      dayContext: () => temporal('2024-03-26', 'Quad6-2', 1300),
      overlayFor: noOverlay,
      occupantOn: () => []
    });

    expect(result.target).toBeNull();
    if (result.target === null) {
      expect(result.daysSearched).toBe(60);
    }
  });
});

function makeSearchPolicy(options: {
  readonly forbidsTransferInto?: (
    candidate: Candidate,
    temporalContext: TemporalContext
  ) => boolean;
} = {}): RubricalPolicy {
  const base = makeTestPolicy('rubrics-1960');
  const compareCandidates: RubricalPolicy['compareCandidates'] = (left, right) => {
    if (left.rank.weight !== right.rank.weight) {
      return right.rank.weight - left.rank.weight;
    }
    const leftSource = left.source === 'temporal' ? 0 : 1;
    const rightSource = right.source === 'temporal' ? 0 : 1;
    if (leftSource !== rightSource) {
      return leftSource - rightSource;
    }
    return left.feastRef.path.localeCompare(right.feastRef.path);
  };

  return {
    ...base,
    compareCandidates,
    transferTarget(candidate, fromDate, until, dayContext, overlayFor, occupantOn) {
      return walkTransferTargetDate({
        impeded: candidate,
        fromDate,
        until,
        dayContext,
        overlayFor,
        occupantOn,
        compareCandidates,
        forbidsTransferInto: options.forbidsTransferInto
      });
    }
  };
}

function version(policy: RubricalPolicy): ResolvedVersion {
  return {
    handle: asVersionHandle('Rubrics 1960 - 1960'),
    kalendar: '1960',
    transfer: '1960',
    stransfer: '1960',
    policy
  };
}

function temporalByDate(
  overrides: Readonly<Record<string, TemporalContext>>
): (d: { readonly year: number; readonly month: number; readonly day: number }) => TemporalContext {
  return (value) => overrides[iso(value)] ?? temporal(iso(value), 'Pasc0-1', 400);
}

function temporal(date: string, dayName: string, weight: number): TemporalContext {
  return {
    date,
    dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
    weekStem: dayName.split('-', 1)[0] ?? dayName,
    dayName,
    season: 'passiontide',
    feastRef: feast(`Tempora/${dayName}`),
    rank: {
      name: dayName,
      classSymbol: dayName,
      weight
    }
  };
}

function candidate(path: string, weight: number): Candidate {
  return {
    feastRef: feast(path),
    rank: {
      name: path,
      classSymbol: path,
      weight
    },
    source: 'sanctoral'
  };
}

function feast(path: string) {
  return {
    path,
    id: path,
    title: path.split('/').at(-1) ?? path
  } as const;
}

function date(year: number, month: number, day: number) {
  return { year, month, day } as const;
}

function iso(input: { readonly year: number; readonly month: number; readonly day: number }): string {
  return `${String(input.year).padStart(4, '0')}-${String(input.month).padStart(2, '0')}-${String(
    input.day
  ).padStart(2, '0')}`;
}

const noOverlay = (): DirectoriumOverlay => ({});
