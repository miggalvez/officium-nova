export interface TextOrthographyProfileInput {
  readonly value: string;
  readonly version: string;
  readonly language: string;
}

/**
 * Apply the public version-display text profile without mutating the composed
 * source text. This mirrors the legacy Perl `spell_var` display pass for
 * Latin 1960 handles and the existing public quote-marker cleanup.
 */
export function applyTextOrthographyProfile(input: TextOrthographyProfileInput): string {
  const publicValue = applyPublicSourceDisplayProfile(input.value);
  if (input.language !== 'Latin' || !input.version.startsWith('Rubrics 1960 - ')) {
    return publicValue;
  }

  return publicValue
    .replaceAll('J', 'I')
    .replaceAll('j', 'i')
    .replaceAll('H-Iesu', 'H-Jesu')
    .replaceAll('er eúmdem', 'er eúndem');
}

export function applyPublicSourceDisplayProfile(value: string): string {
  return normalizeFlexMarkers(stripSourceQuoteMarkers(value));
}

export function stripSourceQuoteMarkers(value: string): string {
  return value
    .replace(/«\s*Pater Noster\s*»/gu, 'Pater Noster')
    .replace(/«\s*Et ne nos indúcas in tentatiónem:\s*»/gu, 'Et ne nos indúcas in tentatiónem:')
    .replace(/«\s*Our Father\s*»/gu, 'Our Father')
    .replace(/«\s*And lead us not into temptation:\s*»/gu, 'And lead us not into temptation:');
}

function normalizeFlexMarkers(value: string): string {
  return value.replace(/:\s*‡\s*([^*]+?)\s*\*\s*/gu, ': * $1 ');
}
