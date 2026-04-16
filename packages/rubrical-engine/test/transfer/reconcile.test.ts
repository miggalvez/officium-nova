import { describe, expect, it } from 'vitest';

import type { Transfer, TransferRejection } from '../../src/index.js';
import { reconcileTransfer } from '../../src/index.js';

const COMPUTED_TRANSFER: Transfer = {
  feastRef: {
    path: 'Sancti/03-25',
    id: 'Sancti/03-25',
    title: 'Annuntiatio B. Mariæ Virginis'
  },
  originalDate: '2024-03-25',
  target: '2024-04-08',
  source: 'rule-computed',
  reason: 'impeded-by-higher-rank'
};

const REJECTION: TransferRejection = {
  feastRef: COMPUTED_TRANSFER.feastRef,
  originalDate: COMPUTED_TRANSFER.originalDate,
  target: null,
  reason: 'perpetually-impeded',
  daysSearched: 60
};

describe('reconcileTransfer', () => {
  it('marks the transfer as reconciled when overlay and rule target agree', () => {
    const result = reconcileTransfer({
      computed: COMPUTED_TRANSFER,
      overlayTarget: '2024-04-08'
    });

    expect(result.transfer).toEqual({
      ...COMPUTED_TRANSFER,
      source: 'reconciled'
    });
    expect(result.warnings).toEqual([
      {
        code: 'transfer-rule-agrees-with-overlay',
        message: 'Transfer table and rule-computed transfer target agree.',
        severity: 'info',
        context: {
          feast: 'Sancti/03-25',
          fromDate: '2024-03-25',
          target: '2024-04-08'
        }
      }
    ]);
  });

  it('lets overlay override the computed target when they disagree', () => {
    const result = reconcileTransfer({
      computed: COMPUTED_TRANSFER,
      overlayTarget: '2024-04-09'
    });

    expect(result.transfer).toEqual({
      ...COMPUTED_TRANSFER,
      target: '2024-04-09',
      source: 'overlay-table'
    });
    expect(result.warnings).toEqual([
      {
        code: 'transfer-table-overrides-rule',
        message: 'Transfer table target overrides the computed transfer target.',
        severity: 'warn',
        context: {
          feast: 'Sancti/03-25',
          fromDate: '2024-03-25',
          computedTarget: '2024-04-08',
          overlayTarget: '2024-04-09'
        }
      }
    ]);
  });

  it('keeps rule-computed transfer when overlay is silent', () => {
    const result = reconcileTransfer({
      computed: COMPUTED_TRANSFER
    });

    expect(result.transfer).toEqual(COMPUTED_TRANSFER);
    expect(result.warnings).toEqual([]);
  });

  it('keeps perpetually impeded rejection when both sources are silent', () => {
    const result = reconcileTransfer({
      computed: REJECTION
    });

    expect(result.transfer).toEqual(REJECTION);
    expect(result.warnings).toEqual([]);
  });
});
