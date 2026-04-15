import { assembleCandidates, pickNaiveWinner } from './candidates/assemble.js';
import { buildOverlay } from './directorium/overlay.js';
import { resolveOfficeDefinition } from './internal/content.js';
import { normalizeDateInput } from './internal/date.js';
import { normalizeRank } from './sanctoral/rank-normalizer.js';
import { buildTemporalContext } from './temporal/context.js';
import { sanctoralCandidates } from './sanctoral/kalendarium-lookup.js';
import { describeVersion, resolveVersion } from './version/resolver.js';
import { VERSION_POLICY } from './version/policy-map.js';

import type {
  DayOfficeSummary,
  RubricalEngine,
  RubricalEngineConfig
} from './types/model.js';
import type { ResolvedVersion } from './types/version.js';

export function createRubricalEngine(config: RubricalEngineConfig): RubricalEngine {
  const version = resolveConfiguredVersion(config);

  return {
    version,
    resolveDayOfficeSummary(date): DayOfficeSummary {
      const calendarDate = normalizeDateInput(date);
      const temporal = buildTemporalContext(calendarDate, version, config.corpus);
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
        resolveOverlayCandidate: (path, source) => {
          const definition = resolveOfficeDefinition(config.corpus, path, {
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
      });
      const overlay = hasOverlayDirectives(overlayResult.overlay)
        ? overlayResult.overlay
        : undefined;
      const warnings = [...overlayResult.warnings, ...assembled.warnings];

      return {
        date: temporal.date,
        version: describeVersion(version),
        temporal,
        ...(overlay ? { overlay } : {}),
        warnings,
        candidates: assembled.candidates,
        winner: pickNaiveWinner(assembled.candidates)
      };
    }
  };
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
