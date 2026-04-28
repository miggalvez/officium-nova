import {
  enumIncludes,
  isRecord,
  isString,
  result,
  type ValidationResult
} from './common.js';
import { validateCitation, type Citation } from './citation.schema.js';

export const ADJUDICATION_CLASSIFICATIONS = [
  'parser-bug',
  'engine-bug',
  'compositor-bug',
  'api-bug',
  'corpus-bug',
  'perl-bug',
  'ordo-ambiguous',
  'source-ambiguous',
  'rendering-difference',
  'report-invalid',
  'duplicate'
] as const;

export type AdjudicationClassification =
  (typeof ADJUDICATION_CLASSIFICATIONS)[number];

export const ADJUDICATION_STATUSES = [
  'adjudicated',
  'unadjudicated',
  'stale',
  'duplicate'
] as const;

export type AdjudicationStatus = (typeof ADJUDICATION_STATUSES)[number];

export const OWNER_PACKAGES = [
  'parser',
  'rubrical-engine',
  'compositor',
  'api',
  'validation',
  'docs',
  'upstream'
] as const;

export type OwnerPackage = (typeof OWNER_PACKAGES)[number];

export interface AdjudicationEntry {
  readonly key: string;
  readonly package: OwnerPackage;
  readonly classification: AdjudicationClassification;
  readonly status: AdjudicationStatus;
  readonly citation: Citation;
  readonly summary: string;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const CITATION_REQUIRED: readonly AdjudicationClassification[] = [
  'parser-bug',
  'engine-bug',
  'compositor-bug',
  'api-bug',
  'corpus-bug',
  'perl-bug',
  'ordo-ambiguous',
  'source-ambiguous'
];

export function validateAdjudicationEntry(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return result(['adjudication entry must be an object']);
  }

  for (const key of ['key', 'summary', 'notes', 'createdAt', 'updatedAt'] as const) {
    if (!isString(value[key])) {
      errors.push(`${key} must be a string`);
    }
  }

  if (!enumIncludes(OWNER_PACKAGES, value.package)) {
    errors.push('package must be a recognized owner package');
  }

  if (!enumIncludes(ADJUDICATION_CLASSIFICATIONS, value.classification)) {
    errors.push('classification must be recognized');
  }

  if (!enumIncludes(ADJUDICATION_STATUSES, value.status)) {
    errors.push('status must be recognized');
  }

  const requireSource =
    enumIncludes(ADJUDICATION_CLASSIFICATIONS, value.classification) &&
    CITATION_REQUIRED.includes(value.classification);
  const citation = validateCitation(value.citation, { requireSource });
  errors.push(...citation.errors.map((error) => `citation: ${error}`));

  return result(errors);
}
