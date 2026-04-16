import type { Celebration } from './ordo.js';
import type { HourName } from './ordo.js';

export type SlotName =
  | 'invitatory'
  | 'hymn'
  | 'psalmody'
  | 'chapter'
  | 'responsory'
  | 'versicle'
  | 'antiphon-ad-benedictus'
  | 'antiphon-ad-magnificat'
  | 'antiphon-ad-nunc-dimittis'
  | 'oration'
  | 'lectio-brevis'
  | 'commemoration-antiphons'
  | 'commemoration-versicles'
  | 'commemoration-orations'
  | 'suffragium'
  | 'preces'
  | 'final-antiphon-bvm'
  | 'doxology-variant'
  | 'conclusion';

export interface TextReference {
  readonly path: string;
  readonly section: string;
  readonly selector?: string;
}

export interface PsalmAssignment {
  readonly psalmRef: TextReference;
  readonly antiphonRef?: TextReference;
}

export interface HymnOverrideMeta {
  readonly mode: 'merge' | 'shift';
  readonly hymnKey: string;
  readonly source: 'overlay';
}

export type SlotContent =
  | {
      readonly kind: 'single-ref';
      readonly ref: TextReference;
      readonly hymnOverride?: HymnOverrideMeta;
    }
  | { readonly kind: 'ordered-refs'; readonly refs: readonly TextReference[] }
  | { readonly kind: 'psalmody'; readonly psalms: readonly PsalmAssignment[] }
  | { readonly kind: 'empty' };

/**
 * Hour-scoped directives emitted by the structurer for Phase 3 to apply to
 * the resolved text. Psalter-selection outcomes are NOT encoded here — they
 * live on `HourRuleSet.psalterScheme`.
 */
export type HourDirective =
  | 'omit-gloria-patri'
  | 'omit-alleluia'
  | 'add-alleluia'
  | 'add-versicle-alleluia'
  | 'preces-dominicales'
  | 'preces-feriales'
  | 'omit-suffragium'
  | 'short-chapter-only'
  | 'genuflection-at-oration'
  | 'dirge-vespers'
  | 'dirge-lauds';

export type ComplineSource =
  | { readonly kind: 'vespers-winner'; readonly celebration: Celebration }
  | { readonly kind: 'ordinary' }
  | { readonly kind: 'triduum-special'; readonly dayName: string };

export interface HourStructure {
  readonly hour: HourName;
  /**
   * Compline-only: the concurrence-derived source for the day. `undefined`
   * for other Hours.
   */
  readonly source?: ComplineSource;
  readonly slots: Readonly<Partial<Record<SlotName, SlotContent>>>;
  readonly directives: readonly HourDirective[];
}
