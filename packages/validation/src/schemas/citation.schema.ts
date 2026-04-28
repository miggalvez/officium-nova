import {
  enumIncludes,
  isNullableNumber,
  isNullableString,
  isRecord,
  result,
  type ValidationResult
} from './common.js';

export const CITATION_SOURCE_TYPES = [
  'ordo',
  'rubrical-book',
  'breviary',
  'corpus',
  'adr',
  'consultation',
  'reviewer-report',
  'none'
] as const;

export type CitationSourceType = (typeof CITATION_SOURCE_TYPES)[number];

export const EXCERPT_POLICIES = [
  'none',
  'brief-public-excerpt',
  'private-only'
] as const;

export type ExcerptPolicy = (typeof EXCERPT_POLICIES)[number];

export interface Citation {
  readonly sourceType: CitationSourceType;
  readonly sourceId: string | null;
  readonly edition: string | null;
  readonly publisher: string | null;
  readonly page: number | null;
  readonly section: string | null;
  readonly paragraph: string | null;
  readonly corpusPath: string | null;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
  readonly adr: string | null;
  readonly reportId: string | null;
  readonly archiveRef: string | null;
  readonly checksum: string | null;
  readonly excerptPolicy: ExcerptPolicy;
}

export function validateCitation(
  value: unknown,
  options: { readonly requireSource?: boolean } = {}
): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return result(['citation must be an object']);
  }

  if (!enumIncludes(CITATION_SOURCE_TYPES, value.sourceType)) {
    errors.push('citation.sourceType must be recognized');
  } else if (options.requireSource && value.sourceType === 'none') {
    errors.push('citation.sourceType must not be none');
  }

  for (const key of [
    'sourceId',
    'edition',
    'publisher',
    'section',
    'paragraph',
    'corpusPath',
    'adr',
    'reportId',
    'archiveRef',
    'checksum'
  ] as const) {
    if (!isNullableString(value[key])) {
      errors.push(`citation.${key} must be a string or null`);
    }
  }

  for (const key of ['page', 'lineStart', 'lineEnd'] as const) {
    if (!isNullableNumber(value[key])) {
      errors.push(`citation.${key} must be a number or null`);
    }
  }

  if (!enumIncludes(EXCERPT_POLICIES, value.excerptPolicy)) {
    errors.push('citation.excerptPolicy must be recognized');
  }

  if (value.sourceType === 'ordo' && value.page === null && value.section === null) {
    errors.push('ordo citations require page or section');
  }

  if (value.sourceType === 'corpus') {
    if (!value.corpusPath) {
      errors.push('corpus citations require corpusPath');
    }
    if (value.lineStart === null || value.lineEnd === null) {
      errors.push('corpus citations require lineStart and lineEnd');
    }
  }

  const lineStart = value.lineStart;
  const lineEnd = value.lineEnd;
  if (
    typeof lineStart === 'number' &&
    typeof lineEnd === 'number' &&
    lineEnd < lineStart
  ) {
    errors.push('citation.lineEnd must be greater than or equal to lineStart');
  }

  return result(errors);
}
