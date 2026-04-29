import { describe, expect, it } from 'vitest';

import {
  parseKalendarium,
  parseTemporalSubstitutions
} from '../../src/calendar/kalendarium.js';
import { loadFixture } from '../fixture-loader.js';

describe('parseKalendarium', () => {
  it('parses entries, alternates, and suppressed feast markers', async () => {
    const content = await loadFixture('kalendarium.txt');
    const parsed = parseKalendarium(content);

    expect(parsed).toEqual([
      {
        dateKey: '01-18',
        fileRef: '01-18r',
        title: 'S Priscae Virginis',
        classWeight: 1,
        alternates: undefined,
        suppressed: false
      },
      {
        dateKey: '01-25',
        fileRef: '01-25r',
        title: 'In Conversione S. Pauli Apostoli',
        classWeight: 4,
        alternates: undefined,
        suppressed: false
      },
      {
        dateKey: '05-06',
        fileRef: 'XXXXX',
        suppressed: true
      },
      {
        dateKey: '07-21',
        fileRef: '07-21r',
        title: 'S. Laurentii',
        classWeight: 3,
        alternates: ['07-21'],
        alternateTitles: ['S. Praxedis'],
        alternateClassWeights: [1],
        suppressed: false
      }
    ]);
  });

  it('parses permanent temporal substitutions', () => {
    expect(
      parseTemporalSubstitutions(
        [
          '#Test tempora',
          'Tempora/Pasc3-2=Tempora/Pasc3-2Feria;;',
          'Tempora/Pent03-1=Tempora/Pent03-1Feria;;1960 Newcal'
        ].join('\n')
      )
    ).toEqual([
      {
        source: 'Tempora/Pasc3-2',
        target: 'Tempora/Pasc3-2Feria'
      },
      {
        source: 'Tempora/Pent03-1',
        target: 'Tempora/Pent03-1Feria',
        versionFilter: '1960 Newcal'
      }
    ]);
  });
});
