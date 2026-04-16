import type { RubricalWarning } from '../types/directorium.js';

import type { Transfer, TransferRejection } from './compute.js';

export interface ReconciledTransferResult {
  readonly transfer: Transfer | TransferRejection;
  readonly warnings: readonly RubricalWarning[];
}

export function reconcileTransfer(params: {
  readonly computed: Transfer | TransferRejection;
  readonly overlayTarget?: string;
}): ReconciledTransferResult {
  const { computed, overlayTarget } = params;
  if (!overlayTarget) {
    return {
      transfer: computed,
      warnings: []
    };
  }

  if (computed.target === null) {
    return {
      transfer: {
        feastRef: computed.feastRef,
        originalDate: computed.originalDate,
        target: overlayTarget,
        source: 'overlay-table',
        reason: 'impeded-by-higher-rank'
      },
      warnings: []
    };
  }

  if (computed.target === overlayTarget) {
    return {
      transfer: {
        ...computed,
        source: 'reconciled'
      },
      warnings: [
        {
          code: 'transfer-rule-agrees-with-overlay',
          message: 'Transfer table and rule-computed transfer target agree.',
          severity: 'info',
          context: {
            feast: computed.feastRef.path,
            fromDate: computed.originalDate,
            target: overlayTarget
          }
        }
      ]
    };
  }

  return {
    transfer: {
      ...computed,
      target: overlayTarget,
      source: 'overlay-table'
    },
    warnings: [
      {
        code: 'transfer-table-overrides-rule',
        message: 'Transfer table target overrides the computed transfer target.',
        severity: 'warn',
        context: {
          feast: computed.feastRef.path,
          fromDate: computed.originalDate,
          computedTarget: computed.target,
          overlayTarget
        }
      }
    ]
  };
}
