import { describe, expect, it } from 'vitest';

import { extractHymnOverride } from '../../src/index.js';

describe('extractHymnOverride', () => {
  it('maps value=1 to merge mode', () => {
    const result = extractHymnOverride(
      [{ kind: 'hymn', dateKey: '05-18', value: '1' }],
      '05-18'
    );

    expect(result.hymnOverride).toEqual({
      hymnKey: '05-18',
      mode: 'merge'
    });
    expect(result.warnings).toEqual([]);
  });

  it('maps value=2 to shift mode', () => {
    const result = extractHymnOverride(
      [{ kind: 'hymn', dateKey: '04-13', value: '2' }],
      '04-13'
    );

    expect(result.hymnOverride).toEqual({
      hymnKey: '04-13',
      mode: 'shift'
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns and returns undefined for unknown values', () => {
    const result = extractHymnOverride(
      [{ kind: 'hymn', dateKey: '05-18', value: '99' }],
      '05-18'
    );

    expect(result.hymnOverride).toBeUndefined();
    expect(result.warnings).toEqual([
      {
        code: 'overlay-invalid-hymn-override',
        message: "Ignoring unknown hymn override value '99' for 05-18.",
        severity: 'warn',
        context: {
          dateKey: '05-18',
          value: '99'
        }
      }
    ]);
  });
});
