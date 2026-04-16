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

export interface StructureLaudsInput {
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

export interface StructureLaudsResult {
  readonly hour: HourStructure;
  readonly warnings: readonly RubricalWarning[];
}

export function structureLauds(input: StructureLaudsInput): StructureLaudsResult {
  const applied = applyRuleSet({ hour: 'lauds', ...input });
  const directives = directivesFromPolicy({ hour: 'lauds', ...input });

  return {
    hour: {
      hour: 'lauds',
      slots: applied.slots,
      directives
    },
    warnings: applied.warnings
  };
}
