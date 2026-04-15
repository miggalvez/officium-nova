import type { FeastReference, ResolvedRank } from './model.js';

export type HourName =
  | 'matins'
  | 'lauds'
  | 'prime'
  | 'terce'
  | 'sext'
  | 'none'
  | 'vespers'
  | 'compline';

export type LiturgicalColor = 'white' | 'red' | 'green' | 'violet' | 'rose' | 'black';

export type CommemorationReason =
  | 'occurrence-impeded'
  | 'concurrence'
  | 'octave-continuing'
  | 'privileged-feria'
  | 'sunday'
  | 'votive';

export interface Celebration {
  readonly feastRef: FeastReference;
  readonly rank: ResolvedRank;
  readonly source: 'temporal' | 'sanctoral';
}

export interface Commemoration {
  readonly feastRef: FeastReference;
  readonly rank: ResolvedRank;
  readonly reason: CommemorationReason;
  readonly hours: readonly HourName[];
  readonly color?: LiturgicalColor;
}
