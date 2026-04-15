import { describe, expect, it } from 'vitest';

import {
  asVersionHandle,
  buildVersionRegistry,
  buildYearTransferTable,
  defaultResolveRank
} from '../../src/index.js';
import type { ResolvedVersion } from '../../src/index.js';

describe('buildYearTransferTable / lookup', () => {
  it('uses leap companion files for January lookups in leap years', () => {
    const table = buildYearTransferTable([
      {
        yearKey: 'f',
        entries: [
          {
            kind: 'transfer',
            dateKey: '01-08',
            target: 'Tempora/Main'
          }
        ]
      },
      {
        yearKey: 'g',
        entries: [
          {
            kind: 'transfer',
            dateKey: '01-08',
            target: 'Tempora/Companion'
          }
        ]
      },
      {
        yearKey: '331',
        entries: []
      },
      {
        yearKey: '401',
        entries: []
      }
    ]);

    const levels = table.lookup({
      date: { year: 2024, month: 1, day: 8 },
      version: testVersion(),
      registry: buildVersionRegistry([
        {
          version: 'Test Version',
          kalendar: 'test',
          transfer: 'TEST',
          stransfer: 'TEST'
        }
      ])
    });

    expect(levels).toHaveLength(1);
    expect(levels[0]?.entries).toEqual([
      {
        kind: 'transfer',
        dateKey: '01-08',
        target: 'Tempora/Companion'
      }
    ]);
  });

  it('rejects mixed wildcard and named handle inputs', () => {
    expect(() =>
      buildYearTransferTable([
        {
          yearKey: 'a',
          entries: []
        },
        {
          handle: 'DA',
          yearKey: 'a',
          entries: []
        }
      ])
    ).toThrow(/Cannot mix wildcard and named transfer handles/u);
  });
});

function testVersion(): ResolvedVersion {
  return {
    handle: asVersionHandle('Test Version'),
    kalendar: 'test',
    transfer: 'TEST',
    stransfer: 'TEST',
    policy: {
      name: 'rubrics-1960',
      resolveRank: defaultResolveRank
    }
  };
}
