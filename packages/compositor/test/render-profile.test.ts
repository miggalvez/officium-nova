import { describe, expect, it } from 'vitest';

import {
  applyTextOrthographyProfile,
  stripSourceQuoteMarkers
} from '../src/render-profile.js';

describe('render profiles', () => {
  it('applies the Rubrics 1960 Latin display spelling without changing non-Latin text', () => {
    expect(
      applyTextOrthographyProfile({
        value: 'Allelúja. Jesus ejus cujus. H-Iesu. Per eúmdem Christum.',
        version: 'Rubrics 1960 - 1960',
        language: 'Latin'
      })
    ).toBe('Allelúia. Iesus eius cuius. H-Jesu. Per eúndem Christum.');

    expect(
      applyTextOrthographyProfile({
        value: 'Alleluia. Jesus.',
        version: 'Rubrics 1960 - 1960',
        language: 'English'
      })
    ).toBe('Alleluia. Jesus.');
  });

  it('strips source quote markers for public version display', () => {
    expect(stripSourceQuoteMarkers('Examen conscientiæ vel «Pater Noster» totum secreto.')).toBe(
      'Examen conscientiæ vel Pater Noster totum secreto.'
    );
    expect(stripSourceQuoteMarkers('« Pater Noster » dicitur secreto.')).toBe(
      'Pater Noster dicitur secreto.'
    );
    expect(stripSourceQuoteMarkers('«Our Father» is said silently.')).toBe(
      'Our Father is said silently.'
    );
  });

  it('renders flex markers with the public psalm mediation marker shape', () => {
    expect(
      applyTextOrthographyProfile({
        value:
          '4:5 Irascímini, et nolíte peccáre: ‡ quæ dícitis in córdibus vestris, * in cubílibus vestris compungímini.',
        version: 'Rubrics 1960 - 1960',
        language: 'Latin'
      })
    ).toBe(
      '4:5 Irascímini, et nolíte peccáre: * quæ dícitis in córdibus vestris, in cubílibus vestris compungímini.'
    );
  });
});
