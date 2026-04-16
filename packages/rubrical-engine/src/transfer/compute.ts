import { addDays, formatIsoDate, type CalendarDate } from '../internal/date.js';
import type { DirectoriumOverlay } from '../types/directorium.js';
import type {
  Candidate,
  FeastReference,
  TemporalContext
} from '../types/model.js';
import type { RubricalPolicy } from '../types/policy.js';
import type { ResolvedVersion } from '../types/version.js';

export type TransferReason =
  | 'impeded-by-higher-rank'
  | 'impeded-by-season-preemption'
  | 'overlay-office-substitution';

export interface Transfer {
  readonly feastRef: FeastReference;
  readonly originalDate: string;
  readonly target: string;
  readonly source: 'rule-computed' | 'overlay-table' | 'reconciled';
  readonly reason: TransferReason;
}

export interface TransferRejection {
  readonly feastRef: FeastReference;
  readonly originalDate: string;
  readonly target: null;
  readonly reason: 'perpetually-impeded';
  readonly daysSearched: number;
}

export interface TransferTargetSearchParams {
  readonly impeded: Candidate;
  readonly fromDate: CalendarDate;
  readonly until: CalendarDate;
  readonly dayContext: (date: CalendarDate) => TemporalContext;
  readonly overlayFor: (date: CalendarDate) => DirectoriumOverlay;
  readonly occupantOn: (date: CalendarDate) => readonly Candidate[];
  readonly compareCandidates: RubricalPolicy['compareCandidates'];
  readonly forbidsTransferInto?: (
    impeded: Candidate,
    temporal: TemporalContext
  ) => boolean;
}

export function walkTransferTargetDate(params: TransferTargetSearchParams): CalendarDate | null {
  let current = addDays(params.fromDate, 1);

  while (compareCalendarDate(current, params.until) <= 0) {
    if (current.year > params.fromDate.year + 1) {
      return null;
    }

    const temporal = params.dayContext(current);
    const temporalCandidate: Candidate = {
      feastRef: temporal.feastRef,
      rank: temporal.rank,
      source: 'temporal'
    };
    if (params.compareCandidates(temporalCandidate, params.impeded) <= 0) {
      current = addDays(current, 1);
      continue;
    }

    const occupiedByHigherOrEqualSanctoral = params
      .occupantOn(current)
      .filter((occupant) => occupant.source !== 'temporal')
      .some((occupant) => params.compareCandidates(occupant, params.impeded) <= 0);
    if (occupiedByHigherOrEqualSanctoral) {
      current = addDays(current, 1);
      continue;
    }

    if (params.forbidsTransferInto?.(params.impeded, temporal) ?? false) {
      current = addDays(current, 1);
      continue;
    }

    if (params.overlayFor(current).officeSubstitution) {
      current = addDays(current, 1);
      continue;
    }

    return current;
  }

  return null;
}

export function computeTransferTarget(params: {
  readonly impeded: Candidate;
  readonly fromDate: CalendarDate;
  readonly version: ResolvedVersion;
  readonly policy: RubricalPolicy;
  readonly dayContext: (date: CalendarDate) => TemporalContext;
  readonly overlayFor: (date: CalendarDate) => DirectoriumOverlay;
  readonly occupantOn: (date: CalendarDate) => readonly Candidate[];
  readonly reason?: TransferReason;
  readonly maxDays?: number;
}): Transfer | TransferRejection {
  const maxDays = params.maxDays ?? 60;
  const until = addDays(params.fromDate, maxDays);
  const target = params.policy.transferTarget(
    params.impeded,
    params.fromDate,
    until,
    params.dayContext,
    params.overlayFor,
    params.occupantOn
  );

  void params.version;

  if (target) {
    return {
      feastRef: params.impeded.feastRef,
      originalDate: formatIsoDate(params.fromDate),
      target: formatIsoDate(target),
      source: 'rule-computed',
      reason: params.reason ?? 'impeded-by-higher-rank'
    };
  }

  return {
    feastRef: params.impeded.feastRef,
    originalDate: formatIsoDate(params.fromDate),
    target: null,
    reason: 'perpetually-impeded',
    daysSearched: maxDays
  };
}

function compareCalendarDate(left: CalendarDate, right: CalendarDate): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  if (left.month !== right.month) {
    return left.month - right.month;
  }
  return left.day - right.day;
}
