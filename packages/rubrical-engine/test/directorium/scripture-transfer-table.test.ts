import { describe, expect, it } from 'vitest';

import { buildScriptureTransferTable } from '../../src/index.js';

describe('buildScriptureTransferTable', () => {
  it('rejects mixed wildcard and named handle inputs', () => {
    expect(() =>
      buildScriptureTransferTable([
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
    ).toThrow(/Cannot mix wildcard and named scripture-transfer handles/u);
  });
});
