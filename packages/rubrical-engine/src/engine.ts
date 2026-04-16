import { detectVigil } from './candidates/vigil-detection.js';
import { assembleCandidates } from './candidates/assemble.js';
import { buildOverlay } from './directorium/overlay.js';
import { resolveOfficeDefinition, resolveOfficeFile } from './internal/content.js';
import { formatIsoDate, normalizeDateInput } from './internal/date.js';
import { resolveOccurrence } from './occurrence/resolver.js';
import { normalizeRank } from './sanctoral/rank-normalizer.js';
import { buildTemporalContext } from './temporal/context.js';
import { sanctoralCandidates } from './sanctoral/kalendarium-lookup.js';
import { buildYearTransferMap } from './transfer/year-map.js';
import { describeVersion, resolveVersion } from './version/resolver.js';
import { VERSION_POLICY } from './version/policy-map.js';

import type {
  Candidate,
  DayOfficeSummary,
  RubricalEngine,
  RubricalEngineConfig
} from './types/model.js';
import type { ResolvedVersion } from './types/version.js';
import type { Transfer, YearTransferMap } from './transfer/index.js';

export function createRubricalEngine(config: RubricalEngineConfig): RubricalEngine {
  const version = resolveConfiguredVersion(config);
  const yearTransferMapCache = new Map<string, YearTransferMap>();

  return {
    version,
    resolveDayOfficeSummary(date): DayOfficeSummary {
      const calendarDate = normalizeDateInput(date);
      const isoDate = formatIsoDate(calendarDate);
      const temporal = buildTemporalContext(calendarDate, version, config.corpus);
      const yearTransferMap = getYearTransferMap(calendarDate.year);
      const transferredIn = collectTransfersInto(
        isoDate,
        calendarDate.year,
        calendarDate.month,
        calendarDate.day
      );
      const sanctoral = sanctoralCandidates(
        calendarDate,
        version,
        config.versionRegistry,
        config.kalendarium,
        config.corpus
      );
      const overlayResult = buildOverlay({
        date: calendarDate,
        version,
        registry: config.versionRegistry,
        yearTransfers: config.yearTransfers,
        scriptureTransfers: config.scriptureTransfers
      });
      const assembled = assembleCandidates(temporal, sanctoral, {
        overlay: overlayResult.overlay,
        transferredIn: transferredIn.map((transfer) => ({
          ...resolveCandidate(
            transfer.feastRef.path,
            'sanctoral',
            calendarDate,
            temporal,
            version,
            config.corpus
          ),
          source: 'transferred-in',
          transferredFrom: transfer.originalDate
        })),
        detectVigil: (candidate) =>
          detectVigil({
            candidate,
            version,
            corpus: config.corpus
          }),
        resolveOverlayCandidate: (path, source) => {
          return resolveCandidate(path, source, calendarDate, temporal, version, config.corpus);
        }
      });
      const overlay = hasOverlayDirectives(overlayResult.overlay)
        ? overlayResult.overlay
        : undefined;
      const occurrence = resolveOccurrence(assembled.candidates, temporal, version.policy);
      const celebrationFile = resolveOfficeFile(config.corpus, occurrence.celebration.feastRef.path);
      const celebrationRuleEvaluation = version.policy.buildCelebrationRuleSet(
        celebrationFile,
        occurrence.commemorations,
        {
          date: calendarDate,
          dayOfWeek: temporal.dayOfWeek,
          season: temporal.season,
          version,
          dayName: temporal.dayName,
          celebration: occurrence.celebration,
          commemorations: occurrence.commemorations,
          corpus: config.corpus
        }
      );
      const warnings = [
        ...yearTransferMap.warningsOn(isoDate),
        ...overlayResult.warnings,
        ...assembled.warnings,
        ...occurrence.warnings,
        ...celebrationRuleEvaluation.warnings
      ];
      const winner = {
        feastRef: occurrence.celebration.feastRef,
        rank: occurrence.celebration.rank,
        source: occurrence.celebration.source
      } as const;

      return {
        date: temporal.date,
        version: describeVersion(version),
        temporal,
        ...(overlay ? { overlay } : {}),
        warnings,
        candidates: assembled.candidates,
        celebration: occurrence.celebration,
        celebrationRules: celebrationRuleEvaluation.celebrationRules,
        commemorations: occurrence.commemorations,
        winner
      };
    }
  };

  function getYearTransferMap(year: number): YearTransferMap {
    const key = `${version.handle}::${year}`;
    const cached = yearTransferMapCache.get(key);
    if (cached) {
      return cached;
    }

    const built = buildYearTransferMap({
      year,
      version,
      policy: version.policy,
      corpus: config.corpus,
      versionRegistry: config.versionRegistry,
      kalendarium: config.kalendarium,
      yearTransfers: config.yearTransfers,
      scriptureTransfers: config.scriptureTransfers
    });
    yearTransferMapCache.set(key, built);
    return built;
  }

  function collectTransfersInto(
    date: string,
    year: number,
    month: number,
    day: number
  ): readonly Transfer[] {
    const maps = [getYearTransferMap(year)];
    if (year > 1 && (month < 3 || (month === 3 && day <= 2))) {
      maps.push(getYearTransferMap(year - 1));
    }

    const uniqueByTransfer = new Map<string, Transfer>();
    for (const map of maps) {
      for (const transfer of map.transfersInto(date)) {
        const key = `${transfer.feastRef.path}|${transfer.originalDate}|${transfer.target}`;
        uniqueByTransfer.set(key, transfer);
      }
    }

    return [...uniqueByTransfer.values()];
  }
}

function resolveConfiguredVersion(config: RubricalEngineConfig): ResolvedVersion {
  if (config.policyOverride) {
    const overrideMap = new Map(config.policyMap ?? VERSION_POLICY);
    overrideMap.set(config.version, config.policyOverride);
    return resolveVersion(config.version, config.versionRegistry, overrideMap);
  }

  return resolveVersion(
    config.version,
    config.versionRegistry,
    config.policyMap ?? VERSION_POLICY
  );
}

function hasOverlayDirectives(overlay: {
  readonly officeSubstitution?: unknown;
  readonly dirgeAtVespers?: unknown;
  readonly dirgeAtLauds?: unknown;
  readonly hymnOverride?: unknown;
  readonly scriptureTransfer?: unknown;
}): boolean {
  return (
    Boolean(overlay.officeSubstitution) ||
    Boolean(overlay.dirgeAtVespers) ||
    Boolean(overlay.dirgeAtLauds) ||
    Boolean(overlay.hymnOverride) ||
    Boolean(overlay.scriptureTransfer)
  );
}

function resolveCandidate(
  path: string,
  source: 'temporal' | 'sanctoral',
  calendarDate: ReturnType<typeof normalizeDateInput>,
  temporal: ReturnType<typeof buildTemporalContext>,
  version: ResolvedVersion,
  corpus: RubricalEngineConfig['corpus']
): { readonly feastRef: Candidate['feastRef']; readonly rank: Candidate['rank'] } {
  const definition = resolveOfficeDefinition(corpus, path, {
    date: calendarDate,
    dayOfWeek: temporal.dayOfWeek,
    season: temporal.season,
    version
  });

  return {
    feastRef: definition.feastRef,
    rank: normalizeRank(definition.rawRank, version.policy, {
      date: temporal.date,
      feastPath: definition.feastRef.path,
      source,
      version: version.handle,
      season: temporal.season
    })
  };
}
