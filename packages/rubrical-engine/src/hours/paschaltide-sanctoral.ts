import type { TemporalContext } from '../types/model.js';
import type { Celebration } from '../types/ordo.js';
import type { ResolvedVersion } from '../types/version.js';

interface PaschaltideSanctoralContext {
  readonly celebration: Celebration;
  readonly temporal: TemporalContext;
}

interface VersionedPaschaltideSanctoralContext extends PaschaltideSanctoralContext {
  readonly version?: Pick<ResolvedVersion, 'handle'>;
}

export function thirdClassSanctoralWeekdayInPaschaltide1960(
  input: PaschaltideSanctoralContext
): boolean {
  return (
    input.celebration.source === 'sanctoral' &&
    input.celebration.rank.classSymbol === 'III' &&
    isPaschaltideSeason(input.temporal.season) &&
    input.temporal.dayOfWeek !== 0
  );
}

export function thirdClassSanctoralWeekdayInPaschaltide(
  input: VersionedPaschaltideSanctoralContext
): boolean {
  return (
    input.version?.handle.includes('1960') === true &&
    thirdClassSanctoralWeekdayInPaschaltide1960(input)
  );
}

function isPaschaltideSeason(season: TemporalContext['season']): boolean {
  return season === 'eastertide' || season === 'ascensiontide';
}
