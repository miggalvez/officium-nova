import type { RubricalWarning } from '../types/directorium.js';
import type { DirectoriumOverlay } from '../types/directorium.js';
import type { HourStructure } from '../types/hour-structure.js';
import type { OfficeTextIndex, TemporalContext } from '../types/model.js';
import type { Celebration, Commemoration, HourName } from '../types/ordo.js';
import type { RubricalPolicy } from '../types/policy.js';
import type {
  CelebrationRuleSet,
  HourRuleSet
} from '../types/rule-set.js';
import type { ResolvedVersion } from '../types/version.js';

import { applyRuleSet, directivesFromPolicy } from './apply-rule-set.js';
import type { OrdinariumSkeleton } from './skeleton.js';

export interface StructureMinorHourInput {
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

export interface StructureMinorHourResult {
  readonly hour: HourStructure;
  readonly warnings: readonly RubricalWarning[];
}

export function structurePrime(input: StructureMinorHourInput): StructureMinorHourResult {
  return structureMinorHour('prime', input);
}

export function structureTerce(input: StructureMinorHourInput): StructureMinorHourResult {
  return structureMinorHour('terce', input);
}

export function structureSext(input: StructureMinorHourInput): StructureMinorHourResult {
  return structureMinorHour('sext', input);
}

export function structureNone(input: StructureMinorHourInput): StructureMinorHourResult {
  return structureMinorHour('none', input);
}

function structureMinorHour(
  hour: HourName,
  input: StructureMinorHourInput
): StructureMinorHourResult {
  const applied = applyRuleSet({ hour, ...input });
  const directives = directivesFromPolicy({ hour, ...input });

  return {
    hour: {
      hour,
      slots: applied.slots,
      directives
    },
    warnings: applied.warnings
  };
}
