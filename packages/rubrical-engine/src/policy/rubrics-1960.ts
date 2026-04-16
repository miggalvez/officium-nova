import {
  PRECEDENCE_1960_BY_CLASS,
  type ClassSymbol1960
} from '../occurrence/tables/precedence-1960.js';
import { buildCelebrationRuleSet as defaultBuildCelebrationRuleSet } from '../rules/evaluate.js';
import { rubrics1960ResolveRank } from '../sanctoral/rank-normalizer.js';
import { walkTransferTargetDate } from '../transfer/compute.js';
import type {
  Candidate,
  FeastReference,
  TemporalContext
} from '../types/model.js';
import type {
  PrecedenceRow,
  RubricalPolicy
} from '../types/policy.js';

const TRIDUUM_KEYS = new Set(['Quad6-4', 'Quad6-5', 'Quad6-6']);
const HOLY_WEEK_MON_WED_KEYS = new Set(['Quad6-1', 'Quad6-2', 'Quad6-3']);
const PRIVILEGED_TEMPORAL_CLASSES = new Set<ClassSymbol1960>([
  'I-privilegiata-sundays',
  'I-privilegiata-ash-wednesday',
  'I-privilegiata-holy-week-feria',
  'I-privilegiata-christmas-vigil',
  'I-privilegiata-rogation-monday'
]);

const FEASTS_OF_THE_LORD = new Set<string>([
  'Sancti/01-00',
  'Sancti/01-01',
  'Sancti/01-06',
  'Sancti/01-13',
  'Sancti/02-02',
  'Sancti/07-01',
  'Sancti/08-06',
  'Sancti/09-14',
  'Sancti/10-DU',
  'Sancti/11-09',
  'Sancti/11-18',
  'Sancti/12-24',
  'Sancti/12-24s',
  'Sancti/12-24so',
  'Sancti/12-25',
  'Tempora/Epi1-0',
  'Tempora/Nat2-0',
  'Tempora/Nat2-0r',
  'Tempora/Pent02-5'
]);

const HOLY_WEEK_KEYS = new Set([
  'Quad6-0',
  'Quad6-1',
  'Quad6-2',
  'Quad6-3',
  'Quad6-4',
  'Quad6-5',
  'Quad6-6'
]);

const CHRISTMAS_RELATED_TRANSFER_PATHS = new Set([
  'Sancti/12-25',
  'Tempora/Nat25',
  'Tempora/Nat26',
  'Tempora/Nat27',
  'Tempora/Nat28',
  'Tempora/Nat29',
  'Tempora/Nat30',
  'Tempora/Nat31',
  'Tempora/Nat01'
]);

export const rubrics1960Policy: RubricalPolicy = {
  name: 'rubrics-1960',
  resolveRank: rubrics1960ResolveRank,
  precedenceRow(classSymbol: string): PrecedenceRow {
    const row = PRECEDENCE_1960_BY_CLASS.get(classSymbol as ClassSymbol1960);
    if (!row) {
      throw new Error(`Unknown Rubrics 1960 class symbol: ${classSymbol}`);
    }
    return row;
  },
  applySeasonPreemption(candidates: readonly Candidate[], temporal: TemporalContext) {
    if (!isTriduum(temporal)) {
      return {
        kept: [...candidates],
        suppressed: []
      };
    }

    const kept: Candidate[] = [];
    const suppressed: Array<{ readonly candidate: Candidate; readonly reason: string }> = [];

    for (const candidate of candidates) {
      if (candidate.source === 'temporal') {
        kept.push(candidate);
        continue;
      }
      suppressed.push({
        candidate,
        reason:
          'Sacred Triduum cannot be impeded; competing offices are omitted for the year.'
      });
    }

    return { kept, suppressed };
  },
  compareCandidates(a: Candidate, b: Candidate): number {
    const privilegedOverride = comparePrivilegedTemporal(a, b);
    if (privilegedOverride !== null) {
      return privilegedOverride;
    }

    if (a.rank.weight !== b.rank.weight) {
      return b.rank.weight - a.rank.weight;
    }

    const sourceOrder = sourceTieBreakOrder(a.source) - sourceTieBreakOrder(b.source);
    if (sourceOrder !== 0) {
      return sourceOrder;
    }

    return a.feastRef.path.localeCompare(b.feastRef.path);
  },
  isPrivilegedFeria(temporal: TemporalContext): boolean {
    return (
      temporal.dayName === 'Quadp3-3' ||
      HOLY_WEEK_MON_WED_KEYS.has(temporal.dayName) ||
      temporal.dayName === 'Pasc5-1' ||
      temporal.date.endsWith('-12-24')
    );
  },
  buildCelebrationRuleSet(feastFile, commemorations, context) {
    return defaultBuildCelebrationRuleSet(feastFile, commemorations, context);
  },
  transferTarget(
    candidate,
    fromDate,
    until,
    dayContext,
    overlayFor,
    occupantOn
  ) {
    return walkTransferTargetDate({
      impeded: candidate,
      fromDate,
      until,
      dayContext,
      overlayFor,
      occupantOn,
      compareCandidates: rubrics1960Policy.compareCandidates,
      forbidsTransferInto: forbidsTransferInto1960
    });
  },
  octavesEnabled(_feastRef: FeastReference): null {
    return null;
  }
};

function comparePrivilegedTemporal(a: Candidate, b: Candidate): number | null {
  const temporal = a.source === 'temporal' ? a : b.source === 'temporal' ? b : null;
  if (!temporal) {
    return null;
  }

  const sanctoral = temporal === a ? b : a;
  if (sanctoral.source === 'temporal') {
    return null;
  }

  if (temporal.rank.classSymbol === 'I-privilegiata-triduum') {
    return temporal === a ? -1 : 1;
  }

  if (temporal.rank.classSymbol === 'II-ember-day') {
    // RI (1960) §95 treats Quattuor Tempora ferias as retaining their Office in occurrence.
    // Phase 2c models that by forcing ember ferias ahead of sanctoral competitors.
    return temporal === a ? -1 : 1;
  }

  if (
    temporal.rank.classSymbol === 'IV-lenten-feria' &&
    sanctoral.rank.classSymbol === 'III'
  ) {
    return temporal === a ? -1 : 1;
  }

  if (!PRIVILEGED_TEMPORAL_CLASSES.has(temporal.rank.classSymbol as ClassSymbol1960)) {
    return null;
  }

  // horascommon.pl:397-405 models the 1960 "Festum Domini" displacement on privileged Sundays
  // and includes the Immaculate Conception exception against Advent II.
  if (canDisplacePrivilegedTemporal(sanctoral)) {
    return temporal === a ? 1 : -1;
  }

  return temporal === a ? -1 : 1;
}

function canDisplacePrivilegedTemporal(candidate: Candidate): boolean {
  if (candidate.feastRef.path === 'Sancti/12-08') {
    return true;
  }

  return candidate.rank.classSymbol === 'I' && FEASTS_OF_THE_LORD.has(candidate.feastRef.path);
}

function isTriduum(temporal: TemporalContext): boolean {
  return TRIDUUM_KEYS.has(temporal.dayName);
}

function sourceTieBreakOrder(source: Candidate['source']): number {
  switch (source) {
    case 'temporal':
      return 0;
    case 'sanctoral':
    case 'transferred-in':
      return 1;
    default:
      return 2;
  }
}

function forbidsTransferInto1960(impeded: Candidate, temporal: TemporalContext): boolean {
  // RI §95: no transfers are admitted into Palm Sunday or the feriae of Holy Week.
  if (HOLY_WEEK_KEYS.has(temporal.dayName)) {
    return true;
  }

  // RI §94 (with §95): the Sacred Triduum is absolutely privileged.
  if (TRIDUUM_KEYS.has(temporal.dayName)) {
    return true;
  }

  // RI §95: Ash Wednesday is privileged and does not receive transferred feasts.
  if (temporal.dayName === 'Quadp3-3') {
    return true;
  }

  // RI §95: the Vigil of Christmas (Dec 24) remains a privileged feria.
  if (temporal.date.endsWith('-12-24')) {
    return true;
  }

  // RI §§93, 95: the Christmas octave is restricted; non-Christmas transfers do not land here.
  if (isWithinChristmasOctave(temporal.date) && !isChristmasRelatedTransfer(impeded)) {
    return true;
  }

  return false;
}

function isWithinChristmasOctave(isoDate: string): boolean {
  const monthDay = isoDate.slice(5);
  return (
    monthDay === '12-25' ||
    monthDay === '12-26' ||
    monthDay === '12-27' ||
    monthDay === '12-28' ||
    monthDay === '12-29' ||
    monthDay === '12-30' ||
    monthDay === '12-31' ||
    monthDay === '01-01'
  );
}

function isChristmasRelatedTransfer(candidate: Candidate): boolean {
  return CHRISTMAS_RELATED_TRANSFER_PATHS.has(candidate.feastRef.path);
}
