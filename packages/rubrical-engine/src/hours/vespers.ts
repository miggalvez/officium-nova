import type { RubricalWarning } from '../types/directorium.js';
import type { DirectoriumOverlay } from '../types/directorium.js';
import type { HourStructure } from '../types/hour-structure.js';
import type { OfficeTextIndex, TemporalContext } from '../types/model.js';
import type { Celebration, Commemoration } from '../types/ordo.js';
import type { RubricalPolicy } from '../types/policy.js';
import type {
  CelebrationRuleSet,
  HourRuleSet
} from '../types/rule-set.js';
import type { ResolvedVersion } from '../types/version.js';

import { applyRuleSet, directivesFromPolicy } from './apply-rule-set.js';
import type { OrdinariumSkeleton } from './skeleton.js';

export interface StructureVespersInput {
  readonly skeleton: OrdinariumSkeleton;
  readonly celebration: Celebration;
  readonly commemorations: readonly Commemoration[];
  readonly celebrationRules: CelebrationRuleSet;
  readonly hourRules: HourRuleSet;
  readonly temporal: TemporalContext;
  readonly policy: RubricalPolicy;
  readonly corpus: OfficeTextIndex;
  readonly overlay?: DirectoriumOverlay;
  readonly version?: ResolvedVersion;
}

export interface StructureVespersResult {
  readonly hour: HourStructure;
  readonly warnings: readonly RubricalWarning[];
}

/**
 * Structures Vespers for the winning celebration on the Vespers boundary.
 *
 * Concurrence resolution (§13, Phase 2f) decides whether today's Second
 * Vespers or tomorrow's First Vespers governs. The engine selects the
 * winning {@link Celebration} and its commemorations before calling this
 * function, so the uniform §16 signature is preserved.
 */
export function structureVespers(input: StructureVespersInput): StructureVespersResult {
  type InternalVespersInput = StructureVespersInput & {
    readonly __vespersSide?: 'first' | 'second';
  };
  const applied = applyRuleSet({ hour: 'vespers', ...(input as InternalVespersInput) });
  const directives = directivesFromPolicy({ hour: 'vespers', ...input });

  return {
    hour: {
      hour: 'vespers',
      slots: applied.slots,
      directives
    },
    warnings: applied.warnings
  };
}
