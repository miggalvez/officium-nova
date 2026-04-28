import {
  enumIncludes,
  isArrayOfStrings,
  isBoolean,
  isNullableString,
  isRecord,
  isString,
  result,
  type ValidationResult
} from './common.js';
import {
  ADJUDICATION_CLASSIFICATIONS,
  OWNER_PACKAGES
} from './adjudication.schema.js';
import { validateCitation } from './citation.schema.js';

export const SUBMISSION_CHANNELS = [
  'email',
  'github-issue',
  'demo-button',
  'maintainer'
] as const;

export const REVIEWER_KINDS = [
  'clergy',
  'religious',
  'scholar',
  'trained-lay',
  'maintainer',
  'anonymous'
] as const;

export const REPORT_STATUSES = [
  'submitted',
  'triaged',
  'reproducing',
  'adjudicating',
  'implemented',
  'closed'
] as const;

export const REPORT_RESOLUTIONS = [
  'accepted',
  'rejected',
  'duplicate',
  'not-reproducible',
  'external-consultation-needed',
  'out-of-scope'
] as const;

export const FIXTURE_STATUSES = ['none', 'pending', 'landed'] as const;

export const DISAGREEMENT_SCOPES = [
  'feast',
  'commemoration',
  'psalter',
  'lesson',
  'antiphon',
  'hymn',
  'versicle',
  'rubric',
  'color',
  'dto',
  'cache',
  'other'
] as const;

export function validateReviewerReport(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return result(['reviewer report must be an object']);
  }

  if (value.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }
  if (!isString(value.id) || !/^rr-\d{4}-\d{4}$/u.test(value.id)) {
    errors.push('id must match rr-YYYY-NNNN');
  }
  if (!isString(value.submittedAt)) {
    errors.push('submittedAt must be a string');
  }
  if (!enumIncludes(SUBMISSION_CHANNELS, value.submittedVia)) {
    errors.push('submittedVia must be recognized');
  }

  validateReviewer(value.reviewer, errors);
  validateRequest(value.request, errors);
  validateDisagreement(value.disagreement, errors);
  validateTriage(value.triage, errors);

  const citation = validateCitation(value.citation);
  errors.push(...citation.errors.map((error) => `citation: ${error}`));

  return result(errors);
}

function validateReviewer(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('reviewer must be an object');
    return;
  }
  if (!enumIncludes(REVIEWER_KINDS, value.reviewerKind)) {
    errors.push('reviewer.reviewerKind must be recognized');
  }
  if (value.attribution !== 'anonymous' && value.attribution !== 'public-name-opt-in') {
    errors.push('reviewer.attribution must be recognized');
  }
  if (!isNullableString(value.publicName)) {
    errors.push('reviewer.publicName must be a string or null');
  }
}

function validateRequest(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('request must be an object');
    return;
  }
  for (const key of ['date', 'version', 'hour', 'orthography', 'apiVersion', 'apiPath'] as const) {
    if (!isString(value[key])) {
      errors.push(`request.${key} must be a string`);
    }
  }
  if (!isArrayOfStrings(value.languages)) {
    errors.push('request.languages must be an array of strings');
  }
  if (!isNullableString(value.langfb)) {
    errors.push('request.langfb must be a string or null');
  }
  if (!isBoolean(value.strict)) {
    errors.push('request.strict must be a boolean');
  }
}

function validateDisagreement(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('disagreement must be an object');
    return;
  }
  if (!enumIncludes(DISAGREEMENT_SCOPES, value.scope)) {
    errors.push('disagreement.scope must be recognized');
  }
  if (!isString(value.expected)) {
    errors.push('disagreement.expected must be a string');
  }
  if (!isString(value.actual)) {
    errors.push('disagreement.actual must be a string');
  }
}

function validateTriage(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('triage must be an object');
    return;
  }
  if (!enumIncludes(REPORT_STATUSES, value.status)) {
    errors.push('triage.status must be recognized');
  }
  if (
    value.resolution !== null &&
    !enumIncludes(REPORT_RESOLUTIONS, value.resolution)
  ) {
    errors.push('triage.resolution must be recognized or null');
  }
  if (
    value.classification !== null &&
    !enumIncludes(ADJUDICATION_CLASSIFICATIONS, value.classification)
  ) {
    errors.push('triage.classification must be recognized or null');
  }
  if (!enumIncludes(FIXTURE_STATUSES, value.fixtureStatus)) {
    errors.push('triage.fixtureStatus must be recognized');
  }
  if (
    value.ownerPackage !== null &&
    !enumIncludes(OWNER_PACKAGES, value.ownerPackage)
  ) {
    errors.push('triage.ownerPackage must be recognized or null');
  }
  for (const key of ['duplicateOf', 'decidedBy', 'decidedAt', 'publicSummary'] as const) {
    if (!isNullableString(value[key])) {
      errors.push(`triage.${key} must be a string or null`);
    }
  }
}
