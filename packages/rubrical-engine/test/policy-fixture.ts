import type { Rank } from '@officium-nova/parser';

import {
  buildCelebrationRuleSet,
  defaultResolveRank,
  type Candidate,
  type PolicyName,
  type PrecedenceFate,
  type RubricalPolicy,
  type TemporalContext
} from '../src/index.js';

export function makeTestPolicy(
  name: PolicyName,
  options: {
    readonly resolveRank?: RubricalPolicy['resolveRank'];
    readonly defaultFate?: PrecedenceFate;
  } = {}
): RubricalPolicy {
  const resolveRank = options.resolveRank ?? ((raw: Rank) => defaultResolveRank(raw));
  const defaultFate = options.defaultFate ?? 'commemorate';

  return {
    name,
    resolveRank,
    precedenceRow(classSymbol: string) {
      return {
        classSymbol,
        weight: 0,
        citation: 'test fixture',
        decide() {
          return defaultFate;
        }
      };
    },
    applySeasonPreemption(candidates: readonly Candidate[], _temporal: TemporalContext) {
      return {
        kept: [...candidates],
        suppressed: []
      };
    },
    compareCandidates(a: Candidate, b: Candidate): number {
      if (a.rank.weight !== b.rank.weight) {
        return b.rank.weight - a.rank.weight;
      }
      const left = a.source === 'temporal' ? 0 : 1;
      const right = b.source === 'temporal' ? 0 : 1;
      if (left !== right) {
        return left - right;
      }
      return a.feastRef.path.localeCompare(b.feastRef.path);
    },
    isPrivilegedFeria() {
      return false;
    },
    buildCelebrationRuleSet(feastFile, commemorations, context) {
      return buildCelebrationRuleSet(feastFile, commemorations, context);
    },
    transferTarget(_candidate, _fromDate, _until) {
      return null;
    },
    octavesEnabled() {
      return null;
    }
  };
}
