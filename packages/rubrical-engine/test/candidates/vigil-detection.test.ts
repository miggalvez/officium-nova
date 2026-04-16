import { describe, expect, it } from 'vitest';

import {
  asVersionHandle,
  detectVigil,
  rubrics1960Policy,
  type Candidate,
  type ResolvedVersion
} from '../../src/index.js';
import { makeTestPolicy } from '../policy-fixture.js';
import { TestOfficeTextIndex } from '../helpers.js';

describe('detectVigil', () => {
  it('detects the Vigil of Christmas from Sancti/12-24', () => {
    const corpus = new TestOfficeTextIndex();
    corpus.add(
      'horas/Latin/Sancti/12-24.txt',
      ['[Rank]', 'In Vigilia Nativitatis Domini;;Duplex I classis;;6.9'].join('\n')
    );
    corpus.add(
      'horas/Latin/Sancti/12-25.txt',
      ['[Officium]', 'In Nativitate Domini', '', '[Rank]', ';;Duplex I classis;;7;;'].join('\n')
    );

    const vigil = detectVigil({
      candidate: candidate('Sancti/12-24', 'In Vigilia Nativitatis Domini'),
      version: version1960(),
      corpus
    });

    expect(vigil?.path).toBe('Sancti/12-25');
  });

  it('does not tag the abolished Vigil of Epiphany under 1960', () => {
    const corpus = new TestOfficeTextIndex();
    corpus.add(
      'horas/Latin/Sancti/01-05.txt',
      ['[Rank]', 'In Vigilia Epiphaniæ;;Semiduplex;;2.9;;'].join('\n')
    );
    corpus.add(
      'horas/Latin/Sancti/01-06.txt',
      ['[Officium]', 'In Epiphania Domini', '', '[Rank]', ';;Duplex I classis;;7;;'].join('\n')
    );

    const vigil = detectVigil({
      candidate: candidate('Sancti/01-05', 'In Vigilia Epiphaniæ'),
      version: version1960(),
      corpus
    });

    expect(vigil).toBeNull();
  });

  it('returns null for an ordinary non-vigil feast', () => {
    const corpus = new TestOfficeTextIndex();
    corpus.add(
      'horas/Latin/Sancti/05-14.txt',
      ['[Officium]', 'S. Bonifatii Martyris', '', '[Rank]', ';;Simplex;;1.1;;'].join('\n')
    );

    const vigil = detectVigil({
      candidate: candidate('Sancti/05-14', 'S. Bonifatii Martyris'),
      version: version1960(),
      corpus
    });

    expect(vigil).toBeNull();
  });

  it.todo('detects the Vigil of Epiphany under pre-1955 rubrics (Phase 2h)');
});

function version1960(): ResolvedVersion {
  return {
    handle: asVersionHandle('Rubrics 1960 - 1960'),
    kalendar: '1960',
    transfer: '1960',
    stransfer: '1960',
    policy: rubrics1960Policy
  };
}

function candidate(path: string, title: string): Candidate {
  return {
    feastRef: {
      path,
      id: path,
      title
    },
    rank: makeTestPolicy('rubrics-1960').resolveRank(
      { name: title, classWeight: 5 },
      {
        date: '2024-01-01',
        feastPath: path,
        source: 'sanctoral',
        version: 'Rubrics 1960 - 1960',
        season: 'christmastide'
      }
    ),
    source: 'sanctoral'
  };
}
