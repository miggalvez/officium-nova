import { describe, expect, it } from 'vitest';

import { extractDirge } from '../../src/index.js';

describe('extractDirge', () => {
  it('matches Lauds on today against the union of all dirge buckets', () => {
    const result = extractDirge(
      [{ kind: 'dirge', dirgeNumber: 3, dates: ['11-03'] }],
      '11-03',
      '11-04'
    );

    expect(result).toEqual({
      dirgeAtLauds: {
        source: 3,
        matchedDateKey: '11-03'
      }
    });
  });

  it('matches Vespers on next day against the union of all dirge buckets', () => {
    const result = extractDirge(
      [{ kind: 'dirge', dirgeNumber: 3, dates: ['11-03'] }],
      '11-02',
      '11-03'
    );

    expect(result).toEqual({
      dirgeAtVespers: {
        source: 3,
        matchedDateKey: '11-03'
      }
    });
  });

  it('can produce both Lauds and Vespers attachments on one civil date', () => {
    const result = extractDirge(
      [{ kind: 'dirge', dirgeNumber: 3, dates: ['11-03', '11-04'] }],
      '11-03',
      '11-04'
    );

    expect(result).toEqual({
      dirgeAtLauds: {
        source: 3,
        matchedDateKey: '11-03'
      },
      dirgeAtVespers: {
        source: 3,
        matchedDateKey: '11-04'
      }
    });
  });

  it('uses first-match tie-break when multiple dirge buckets contain the same date', () => {
    const result = extractDirge(
      [
        { kind: 'dirge', dirgeNumber: 1, dates: ['11-03'] },
        { kind: 'dirge', dirgeNumber: 3, dates: ['11-03'] }
      ],
      '11-03',
      '11-03'
    );

    expect(result).toEqual({
      dirgeAtLauds: {
        source: 1,
        matchedDateKey: '11-03'
      },
      dirgeAtVespers: {
        source: 1,
        matchedDateKey: '11-03'
      }
    });
  });

  it('returns empty result when no dirge dates match', () => {
    const result = extractDirge(
      [{ kind: 'dirge', dirgeNumber: 2, dates: ['03-03'] }],
      '03-02',
      '03-04'
    );

    expect(result).toEqual({});
  });
});
