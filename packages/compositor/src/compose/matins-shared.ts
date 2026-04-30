import type { TextIndex } from '@officium-novum/parser';
import type {
  ConditionEvalContext,
  DayOfficeSummary,
  HourDirective,
  TextReference
} from '@officium-novum/rubrical-engine';

import type { ComposeOptions, ComposeWarning } from '../types/composed-hour.js';

export interface MatinsComposeContext {
  readonly corpus: TextIndex;
  readonly summary: DayOfficeSummary;
  readonly options: ComposeOptions;
  readonly directives: readonly HourDirective[];
  readonly context: ConditionEvalContext;
  /**
   * Optional compose-time warning sink — see Phase 3 §3f and
   * {@link ComposeWarning}. The generic `composeSlot` in `compose.ts`
   * passes this in; Matins reuses it for its plan-driven path.
   */
  readonly onWarning?: (warning: ComposeWarning) => void;
}

export function referenceIdentity(reference: TextReference): string {
  return `${reference.path}#${reference.section}${reference.selector ? `:${reference.selector}` : ''}`;
}
