import { assembleCandidates } from '../candidates/assemble.js';
import { buildOverlay } from '../directorium/overlay.js';
import { resolveOfficeDefinition } from '../internal/content.js';
import {
  addDays,
  dayOfWeek,
  formatIsoDate,
  normalizeDateInput,
  sanctoralDateKey,
  type CalendarDate
} from '../internal/date.js';
import { resolveOccurrence, type TransferFlag } from '../occurrence/resolver.js';
import { normalizeRank } from '../sanctoral/rank-normalizer.js';
import { sanctoralCandidates } from '../sanctoral/kalendarium-lookup.js';
import { buildTemporalContext } from '../temporal/context.js';
import { dayNameForDate, weekStemForDate } from '../temporal/day-name.js';
import { liturgicalSeasonForDate } from '../temporal/season.js';
import type { RubricalWarning } from '../types/directorium.js';
import type {
  Candidate,
  KalendariumTable,
  OfficeTextIndex,
  TemporalContext,
  TemporalSubstitutionTable
} from '../types/model.js';
import type { RubricalPolicy } from '../types/policy.js';
import type { ResolvedVersion, VersionRegistry } from '../types/version.js';

import type { ScriptureTransferTable } from '../directorium/tables/scripture-transfer-table.js';
import type { YearTransferTable } from '../directorium/tables/year-transfer-table.js';
import {
  computeTransferTarget,
  type Transfer,
  type TransferReason,
  type TransferRejection
} from './compute.js';
import { reconcileTransfer } from './reconcile.js';

export interface YearTransferMap {
  readonly transfers: readonly Transfer[];
  readonly rejections: readonly TransferRejection[];
  transfersInto(date: string): readonly Transfer[];
  transfersOutOf(date: string): readonly Transfer[];
  rejectionsOutOf(date: string): readonly TransferRejection[];
  warningsOn(date: string): readonly RubricalWarning[];
}

interface PreviewEntry {
  readonly date: CalendarDate;
  readonly isoDate: string;
  readonly temporal: TemporalContext;
  readonly overlay: ReturnType<typeof buildOverlay>['overlay'];
  readonly candidates: readonly Candidate[];
  readonly transferQueue: readonly TransferFlag[];
}

interface TemporalPreviewBuildResult {
  readonly temporal: TemporalContext;
  readonly warnings: readonly RubricalWarning[];
}

interface SanctoralPreviewBuildResult {
  readonly candidates: ReturnType<typeof sanctoralCandidates>;
  readonly warnings: readonly RubricalWarning[];
}

export function buildYearTransferMap(params: {
  readonly year: number;
  readonly version: ResolvedVersion;
  readonly policy: RubricalPolicy;
  readonly corpus: OfficeTextIndex;
  readonly versionRegistry: VersionRegistry;
  readonly kalendarium: KalendariumTable;
  readonly yearTransfers: YearTransferTable;
  readonly scriptureTransfers: ScriptureTransferTable;
  readonly temporalSubstitutions?: TemporalSubstitutionTable;
  readonly maxDays?: number;
}): YearTransferMap {
  const maxDays = params.maxDays ?? 60;
  const previewByIsoDate = new Map<string, PreviewEntry>();
  const overlayTargetsByPath = new Map<string, string[]>();
  const transferredOccupantsByDate = new Map<string, Candidate[]>();
  const warningsByDate = new Map<string, RubricalWarning[]>();

  let computingFor: {
    readonly path: string;
    readonly originalDate: string;
  } | null = null;

  const dayContext = (date: CalendarDate): TemporalContext => ensurePreview(date).temporal;
  const overlayFor = (date: CalendarDate): ReturnType<typeof buildOverlay>['overlay'] =>
    ensurePreview(date).overlay;
  const occupantOn = (date: CalendarDate): readonly Candidate[] => {
    const preview = ensurePreview(date);
    const transferred = transferredOccupantsByDate.get(preview.isoDate) ?? [];
    if (!computingFor) {
      return [...preview.candidates, ...transferred];
    }
    const sentinel = computingFor;

    return [...preview.candidates, ...transferred].filter(
      (candidate) =>
        !(
          candidate.source === 'transferred-in' &&
          candidate.feastRef.path === sentinel.path &&
          candidate.transferredFrom === sentinel.originalDate
        )
    );
  };

  const datesInYear: CalendarDate[] = [];
  for (
    let date: CalendarDate = { year: params.year, month: 1, day: 1 };
    date.year === params.year;
    date = addDays(date, 1)
  ) {
    datesInYear.push(date);
    ensurePreview(date);
  }

  const transfers: Transfer[] = [];
  const rejections: TransferRejection[] = [];

  for (const date of datesInYear) {
    const entry = ensurePreview(date);

    for (const flag of entry.transferQueue) {
      const reason = toTransferReason(flag.reason);
      computingFor = {
        path: flag.candidate.feastRef.path,
        originalDate: entry.isoDate
      };
      const computed = computeTransferTarget({
        impeded: flag.candidate,
        fromDate: entry.date,
        version: params.version,
        policy: params.policy,
        dayContext,
        overlayFor,
        occupantOn,
        reason,
        maxDays
      });
      computingFor = null;

      const overlayTarget = lookupOverlayTarget(
        flag.candidate.feastRef.path,
        entry.isoDate,
        maxDays,
        overlayTargetsByPath
      );
      const reconciled = reconcileTransfer({
        computed,
        overlayTarget
      });
      appendWarnings(warningsByDate, entry.isoDate, reconciled.warnings);

      if (reconciled.transfer.target === null) {
        rejections.push(reconciled.transfer);
        appendWarnings(warningsByDate, entry.isoDate, [
          rejectionWarning(reconciled.transfer, maxDays)
        ]);
        continue;
      }

      transfers.push(reconciled.transfer);
      addTransferredOccupant(
        transferredOccupantsByDate,
        reconciled.transfer,
        flag.candidate.rank
      );
    }
  }

  const transfersByTarget = groupTransfersByDate(transfers, (transfer) => transfer.target);
  const transfersByOrigin = groupTransfersByDate(transfers, (transfer) => transfer.originalDate);
  const rejectionsByOrigin = groupRejectionsByDate(rejections);

  return {
    transfers,
    rejections,
    transfersInto(date: string): readonly Transfer[] {
      return transfersByTarget.get(date) ?? [];
    },
    transfersOutOf(date: string): readonly Transfer[] {
      return transfersByOrigin.get(date) ?? [];
    },
    rejectionsOutOf(date: string): readonly TransferRejection[] {
      return rejectionsByOrigin.get(date) ?? [];
    },
    warningsOn(date: string): readonly RubricalWarning[] {
      return warningsByDate.get(date) ?? [];
    }
  };

  function ensurePreview(date: CalendarDate): PreviewEntry {
    const isoDate = formatIsoDate(date);
    const existing = previewByIsoDate.get(isoDate);
    if (existing) {
      return existing;
    }

    const temporalResult = buildTemporalContextWithFallback(
      date,
      params.version,
      params.policy,
      params.corpus,
      params.versionRegistry,
      params.temporalSubstitutions
    );
    appendWarnings(warningsByDate, isoDate, temporalResult.warnings);

    const sanctoralResult = sanctoralCandidatesWithFallback(
      date,
      params.version,
      params.versionRegistry,
      params.kalendarium,
      params.corpus
    );
    appendWarnings(warningsByDate, isoDate, sanctoralResult.warnings);
    const overlayResult = buildOverlay({
      date,
      version: params.version,
      registry: params.versionRegistry,
      yearTransfers: params.yearTransfers,
      scriptureTransfers: params.scriptureTransfers
    });
    const assembled = assembleCandidates(temporalResult.temporal, sanctoralResult.candidates, {
      overlay: overlayResult.overlay,
      resolveOverlayCandidate: (path, source) => {
        const definition = resolveOfficeDefinition(params.corpus, path, {
          date,
          dayOfWeek: temporalResult.temporal.dayOfWeek,
          season: temporalResult.temporal.season,
          version: params.version
        });

        return {
          feastRef: definition.feastRef,
          rank: normalizeRank(definition.rawRank, params.policy, {
            date: temporalResult.temporal.date,
            feastPath: definition.feastRef.path,
            source,
            version: params.version.handle,
            season: temporalResult.temporal.season
          })
        };
      }
    });
    const occurrence = resolveOccurrence(assembled.candidates, temporalResult.temporal, params.policy);

    const preview: PreviewEntry = {
      date,
      isoDate,
      temporal: temporalResult.temporal,
      overlay: overlayResult.overlay,
      candidates: assembled.candidates,
      transferQueue: occurrence.transferQueue
    };
    previewByIsoDate.set(isoDate, preview);
    registerOverlayTarget(overlayTargetsByPath, preview.overlay, preview.date);
    return preview;
  }
}

function buildTemporalContextWithFallback(
  date: CalendarDate,
  version: ResolvedVersion,
  policy: RubricalPolicy,
  corpus: OfficeTextIndex,
  registry: VersionRegistry,
  temporalSubstitutions: TemporalSubstitutionTable | undefined
): TemporalPreviewBuildResult {
  try {
    return {
      temporal: buildTemporalContext(date, version, corpus, {
        registry,
        temporalSubstitutions
      }),
      warnings: []
    };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.startsWith('Corpus file not found for office path: Tempora/')
    ) {
      throw error;
    }

    const isoDate = formatIsoDate(date);
    const dayName = dayNameForDate(date);
    const season = liturgicalSeasonForDate(date);
    const feastPath = `Tempora/${dayName}`;
    const missingPath = extractMissingOfficePath(error.message) ?? feastPath;

    return {
      temporal: {
        date: isoDate,
        dayOfWeek: dayOfWeek(date),
        weekStem: weekStemForDate(date),
        dayName,
        season,
        feastRef: {
          path: feastPath,
          id: feastPath,
          title: dayName
        },
        rank: policy.resolveRank(
          {
            name: 'Feria',
            classWeight: 1
          },
          {
            date: isoDate,
            feastPath,
            source: 'temporal',
            version: version.handle,
            season
          }
        )
      },
      warnings: [
        {
          code: 'rubric-synth-fallback',
          message: 'Year-map synthesized temporal context because a Tempora office file was missing.',
          severity: 'info',
          context: {
            scope: 'temporal-context',
            date: isoDate,
            missingPath
          }
        }
      ]
    };
  }
}

function sanctoralCandidatesWithFallback(
  date: CalendarDate,
  version: ResolvedVersion,
  registry: VersionRegistry,
  kalendarium: KalendariumTable,
  corpus: OfficeTextIndex
): SanctoralPreviewBuildResult {
  try {
    return {
      candidates: sanctoralCandidates(date, version, registry, kalendarium, corpus),
      warnings: []
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Corpus file not found for office path: Sancti/')) {
      const isoDate = formatIsoDate(date);
      const missingPath = extractMissingOfficePath(error.message) ?? 'Sancti/*';
      return {
        candidates: [],
        warnings: [
          {
            code: 'rubric-synth-fallback',
            message:
              'Year-map synthesized empty sanctoral candidates because a Sancti office file was missing.',
            severity: 'info',
            context: {
              scope: 'sanctoral-candidates',
              date: isoDate,
              missingPath,
              cause: 'missing-office-file'
            }
          }
        ]
      };
    }
    if (
      error instanceof Error &&
      error.message.startsWith('No matching [Rank] line found in horas/Latin/Sancti/')
    ) {
      const filePath = extractNoMatchingRankPath(error.message);
      if (filePath && sanctiFileHasRankSection(corpus, filePath)) {
        throw error;
      }

      const isoDate = formatIsoDate(date);
      return {
        candidates: [],
        warnings: [
          {
            code: 'rubric-synth-fallback',
            message:
              'Year-map synthesized empty sanctoral candidates because the resolved Sancti office has no applicable [Rank] section.',
            severity: 'info',
            context: {
              scope: 'sanctoral-candidates',
              date: isoDate,
              missingPath: filePath ?? 'horas/Latin/Sancti/*',
              cause: 'rankless-office'
            }
          }
        ]
      };
    }
    throw error;
  }
}

function extractMissingOfficePath(message: string): string | null {
  const prefix = 'Corpus file not found for office path: ';
  if (!message.startsWith(prefix)) {
    return null;
  }

  const path = message.slice(prefix.length).trim();
  return path.length > 0 ? path : null;
}

function extractNoMatchingRankPath(message: string): string | null {
  const prefix = 'No matching [Rank] line found in ';
  if (!message.startsWith(prefix)) {
    return null;
  }

  const path = message.slice(prefix.length).trim();
  return path.length > 0 ? path : null;
}

function sanctiFileHasRankSection(corpus: OfficeTextIndex, filePath: string): boolean {
  const file = corpus.getFile(filePath);
  if (!file) {
    return true;
  }

  return file.sections.some(
    (section) => section.header === 'Rank' && (section.rank?.length ?? 0) > 0
  );
}

function addTransferredOccupant(
  targets: Map<string, Candidate[]>,
  transfer: Transfer,
  rank: Candidate['rank']
): void {
  const list = targets.get(transfer.target);
  const transferredIn: Candidate = {
    feastRef: transfer.feastRef,
    rank,
    source: 'transferred-in',
    transferredFrom: transfer.originalDate
  };
  if (list) {
    list.push(transferredIn);
    return;
  }
  targets.set(transfer.target, [transferredIn]);
}

function registerOverlayTarget(
  targetsByPath: Map<string, string[]>,
  overlay: ReturnType<typeof buildOverlay>['overlay'],
  date: CalendarDate
): void {
  const transferredIn = extractOverlayTransferredIn(overlay, date);
  if (!transferredIn) {
    return;
  }

  const isoDate = formatIsoDate(date);
  const existing = targetsByPath.get(transferredIn.path);
  if (!existing) {
    targetsByPath.set(transferredIn.path, [isoDate]);
    return;
  }
  if (!existing.includes(isoDate)) {
    existing.push(isoDate);
  }
}

function extractOverlayTransferredIn(
  overlay: ReturnType<typeof buildOverlay>['overlay'],
  date: CalendarDate
): { readonly path: string } | null {
  const substitution = overlay.officeSubstitution;
  if (!substitution) {
    return null;
  }

  const replacementDateKey = extractDateKeyFromPath(substitution.path);
  if (!replacementDateKey) {
    return null;
  }

  if (replacementDateKey === sanctoralDateKey(date)) {
    return null;
  }

  return { path: substitution.path };
}

function extractDateKeyFromPath(path: string): string | null {
  const fileName = path.split('/').at(-1);
  if (!fileName) {
    return null;
  }
  const match = /^(\d{2}-\d{2})/u.exec(fileName);
  const dateKey = match?.[1];
  return dateKey ?? null;
}

function lookupOverlayTarget(
  feastPath: string,
  fromDate: string,
  maxDays: number,
  targetsByPath: ReadonlyMap<string, readonly string[]>
): string | undefined {
  const targets = targetsByPath.get(feastPath);
  if (!targets || targets.length === 0) {
    return undefined;
  }

  const upperBound = formatIsoDate(addDays(normalizeDateInput(fromDate), maxDays));
  return targets.find((targetDate) => targetDate > fromDate && targetDate <= upperBound);
}

function toTransferReason(reason: TransferFlag['reason']): TransferReason {
  switch (reason) {
    case 'impeded-by-higher-rank':
      return 'impeded-by-higher-rank';
    default:
      return 'impeded-by-higher-rank';
  }
}

function appendWarnings(
  warningsByDate: Map<string, RubricalWarning[]>,
  date: string,
  warnings: readonly RubricalWarning[]
): void {
  if (warnings.length === 0) {
    return;
  }

  const existing = warningsByDate.get(date);
  if (existing) {
    existing.push(...warnings);
    return;
  }
  warningsByDate.set(date, [...warnings]);
}

function rejectionWarning(
  rejection: TransferRejection,
  maxDays: number
): RubricalWarning {
  if (rejection.daysSearched >= maxDays) {
    return {
      code: 'transfer-bounded-search-exceeded',
      message: 'Transfer search exceeded the configured day bound.',
      severity: 'warn',
      context: {
        feast: rejection.feastRef.path,
        fromDate: rejection.originalDate,
        daysSearched: String(rejection.daysSearched),
        maxDays: String(maxDays)
      }
    };
  }

  return {
    code: 'transfer-perpetually-impeded',
    message: 'Feast remained perpetually impeded after transfer search.',
    severity: 'warn',
    context: {
      feast: rejection.feastRef.path,
      fromDate: rejection.originalDate,
      daysSearched: String(rejection.daysSearched)
    }
  };
}

function groupTransfersByDate(
  transfers: readonly Transfer[],
  selectDate: (transfer: Transfer) => string
): ReadonlyMap<string, readonly Transfer[]> {
  const grouped = new Map<string, Transfer[]>();
  for (const transfer of transfers) {
    const date = selectDate(transfer);
    const list = grouped.get(date);
    if (list) {
      list.push(transfer);
    } else {
      grouped.set(date, [transfer]);
    }
  }
  return grouped;
}

function groupRejectionsByDate(
  rejections: readonly TransferRejection[]
): ReadonlyMap<string, readonly TransferRejection[]> {
  const grouped = new Map<string, TransferRejection[]>();
  for (const rejection of rejections) {
    const list = grouped.get(rejection.originalDate);
    if (list) {
      list.push(rejection);
    } else {
      grouped.set(rejection.originalDate, [rejection]);
    }
  }
  return grouped;
}
