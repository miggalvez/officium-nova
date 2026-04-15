import { describe, expect, it } from 'vitest';

import {
  asVersionHandle,
  buildOverlay,
  buildScriptureTransferTable,
  buildVersionRegistry,
  buildYearTransferTable,
  computeYearKey,
  defaultResolveRank
} from '../../src/index.js';
import type { ResolvedVersion } from '../../src/index.js';

describe('buildOverlay', () => {
  it('combines all four overlay extractors and falls back along transferBase when needed', () => {
    const date = { year: 2025, month: 5, day: 18 } as const;
    const yearKey = computeYearKey(date.year);

    const overlay = buildOverlay({
      date,
      version: childVersion(),
      registry: registry(),
      yearTransfers: buildYearTransferTable([
        {
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'transfer',
              dateKey: '05-18',
              target: 'Tempora/Nat2-0',
              versionFilter: 'BASE'
            },
            {
              kind: 'dirge',
              dirgeNumber: 3,
              dates: ['05-18'],
              versionFilter: 'BASE'
            },
            {
              kind: 'hymn',
              dateKey: '05-18',
              value: '1',
              versionFilter: 'BASE'
            }
          ]
        }
      ]),
      scriptureTransfers: buildScriptureTransferTable([
        {
          yearKey: yearKey.letter,
          entries: [
            {
              dateKey: '05-18',
              target: 'Pasc6-5',
              operation: 'R',
              versionFilter: 'BASE'
            }
          ]
        }
      ])
    });

    expect(overlay.overlay).toEqual({
      officeSubstitution: {
        path: 'Tempora/Nat2-0',
        id: 'Tempora/Nat2-0',
        title: 'Nat2-0'
      },
      dirgeAtLauds: {
        source: 3,
        matchedDateKey: '05-18'
      },
      hymnOverride: {
        hymnKey: '05-18',
        mode: 'merge'
      },
      scriptureTransfer: {
        dateKey: '05-18',
        target: 'Pasc6-5',
        operation: 'R',
        versionFilter: 'BASE'
      }
    });
    expect(overlay.warnings).toEqual([]);
  });

  it('prefers child-level filtered entries over parent-level entries', () => {
    const date = { year: 2025, month: 5, day: 18 } as const;
    const yearKey = computeYearKey(date.year);

    const overlay = buildOverlay({
      date,
      version: childVersion(),
      registry: registry(),
      yearTransfers: buildYearTransferTable([
        {
          handle: 'CHILD',
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'transfer',
              dateKey: '05-18',
              target: 'Tempora/Child',
              versionFilter: 'CHILD'
            }
          ]
        },
        {
          handle: 'BASE',
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'transfer',
              dateKey: '05-18',
              target: 'Tempora/Base',
              versionFilter: 'BASE'
            }
          ]
        }
      ]),
      scriptureTransfers: buildScriptureTransferTable([])
    });

    expect(overlay.overlay.officeSubstitution?.path).toBe('Tempora/Child');
  });

  it('falls back to base handle when child-level filters exclude all candidates', () => {
    const date = { year: 2025, month: 5, day: 18 } as const;
    const yearKey = computeYearKey(date.year);

    const overlay = buildOverlay({
      date,
      version: childVersion(),
      registry: registry(),
      yearTransfers: buildYearTransferTable([
        {
          handle: 'CHILD',
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'transfer',
              dateKey: '05-18',
              target: 'Tempora/Child',
              versionFilter: 'NONMATCH'
            },
            {
              kind: 'hymn',
              dateKey: '05-18',
              value: '1',
              versionFilter: 'NONMATCH'
            },
            {
              kind: 'dirge',
              dirgeNumber: 3,
              dates: ['05-18'],
              versionFilter: 'NONMATCH'
            }
          ]
        },
        {
          handle: 'BASE',
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'transfer',
              dateKey: '05-18',
              target: 'Tempora/Base',
              versionFilter: 'BASE'
            }
          ]
        }
      ]),
      scriptureTransfers: buildScriptureTransferTable([])
    });

    expect(overlay.overlay.officeSubstitution?.path).toBe('Tempora/Base');
  });

  it('applies bisextile remap for Feb 25 in leap years (St. Matthias shift)', () => {
    const date = { year: 2024, month: 2, day: 25 } as const;
    const yearKey = computeYearKey(date.year);

    const overlay = buildOverlay({
      date,
      version: childVersion(),
      registry: registry(),
      yearTransfers: buildYearTransferTable([
        {
          handle: 'CHILD',
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'transfer',
              dateKey: '02-24',
              target: '02-24r',
              versionFilter: 'CHILD'
            }
          ]
        }
      ]),
      scriptureTransfers: buildScriptureTransferTable([])
    });

    expect(overlay.overlay.officeSubstitution?.path).toBe('Sancti/02-24r');
  });

  it('uses deterministic source tie-break when multiple dirge buckets match', () => {
    const date = { year: 2025, month: 11, day: 3 } as const;
    const yearKey = computeYearKey(date.year);

    const overlay = buildOverlay({
      date,
      version: childVersion(),
      registry: registry(),
      yearTransfers: buildYearTransferTable([
        {
          handle: 'CHILD',
          yearKey: yearKey.letter,
          entries: [
            {
              kind: 'dirge',
              dirgeNumber: 1,
              dates: ['11-03', '11-04'],
              versionFilter: 'CHILD'
            },
            {
              kind: 'dirge',
              dirgeNumber: 3,
              dates: ['11-03', '11-04'],
              versionFilter: 'CHILD'
            }
          ]
        }
      ]),
      scriptureTransfers: buildScriptureTransferTable([])
    });

    expect(overlay.overlay.dirgeAtLauds).toEqual({
      source: 1,
      matchedDateKey: '11-03'
    });
    expect(overlay.overlay.dirgeAtVespers).toEqual({
      source: 1,
      matchedDateKey: '11-04'
    });
  });
});

function childVersion(): ResolvedVersion {
  return {
    handle: asVersionHandle('Child'),
    kalendar: 'test',
    transfer: 'CHILD',
    stransfer: 'CHILD',
    transferBase: asVersionHandle('Base'),
    policy: {
      name: 'rubrics-1960',
      resolveRank: defaultResolveRank
    }
  };
}

function registry() {
  return buildVersionRegistry([
    {
      version: 'Child',
      kalendar: 'test',
      transfer: 'CHILD',
      stransfer: 'CHILD',
      transferBase: 'Base'
    },
    {
      version: 'Base',
      kalendar: 'test',
      transfer: 'BASE',
      stransfer: 'BASE'
    }
  ]);
}
