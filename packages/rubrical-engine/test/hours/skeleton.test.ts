import { describe, expect, it } from 'vitest';

import {
  OrdinariumSkeletonCache,
  asVersionHandle,
  buildVersionRegistry,
  loadOrdinariumSkeleton,
  resolveVersion
} from '../../src/index.js';
import { VERSION_POLICY } from '../../src/version/policy-map.js';
import { TestOfficeTextIndex } from '../helpers.js';

// Mirrors the real upstream Ordinarium/Laudes.txt structure: combined
// headings (`#Capitulum Hymnus Versus`) rather than separate `#Hymnus`
// markers for every slot. The legacy format is the one the engine must
// survive in production.
const ORDINARIUM_LAUDES = `
#Incipit
$Pater noster

#Psalmi

#Capitulum Hymnus Versus

#Canticum: Benedictus

#Preces Feriales

#Oratio

#Suffragium

#Conclusio
`.trim();

function buildFixture(): ReturnType<typeof makeEnv> {
  return makeEnv();
}

function makeEnv() {
  const corpus = new TestOfficeTextIndex();
  corpus.add('horas/Ordinarium/Laudes.txt', ORDINARIUM_LAUDES);
  const registry = buildVersionRegistry([
    {
      version: 'Rubrics 1960 - 1960',
      kalendar: '1960',
      transfer: '1960',
      stransfer: '1960'
    }
  ]);
  const version = resolveVersion(
    asVersionHandle('Rubrics 1960 - 1960'),
    registry,
    VERSION_POLICY
  );
  return { corpus, version };
}

describe('loadOrdinariumSkeleton', () => {
  it('maps Laudes section headers to SlotName values in order', () => {
    const { corpus, version } = buildFixture();
    const skeleton = loadOrdinariumSkeleton('lauds', version, corpus);

    expect(skeleton.hour).toBe('lauds');
    expect(skeleton.sourcePath).toBe('horas/Ordinarium/Laudes.txt');
    const names = skeleton.slots.map((slot) => slot.name);
    expect(names).toContain('hymn');
    expect(names).toContain('psalmody');
    expect(names).toContain('chapter');
    expect(names).toContain('antiphon-ad-benedictus');
    expect(names).toContain('preces');
    expect(names).toContain('oration');
    expect(names).toContain('suffragium');
    expect(names).toContain('conclusion');
  });

  it('throws when the Ordinarium file is missing', () => {
    const { version } = buildFixture();
    const emptyCorpus = new TestOfficeTextIndex();
    expect(() => loadOrdinariumSkeleton('lauds', version, emptyCorpus)).toThrow(
      /Ordinarium file not found/u
    );
  });
});

describe('omission-conditional detection (regression — Codex P1 follow-up)', () => {
  it('captures the `(sed rubrica 196 omittuntur)` rubric following #Antiphona finalis', () => {
    const corpus = new TestOfficeTextIndex();
    corpus.add(
      'horas/Ordinarium/Laudes.txt',
      [
        '#Hymnus',
        '',
        '#Psalmi',
        '',
        '#Antiphona finalis',
        '(sed rubrica 196 aut rubrica 1955 aut rubrica cisterciensis omittuntur)',
        '',
        '#Conclusio'
      ].join('\n')
    );
    const registry = buildVersionRegistry([
      {
        version: 'Rubrics 1960 - 1960',
        kalendar: '1960',
        transfer: '1960',
        stransfer: '1960'
      }
    ]);
    const version = resolveVersion(
      asVersionHandle('Rubrics 1960 - 1960'),
      registry,
      VERSION_POLICY
    );

    const skeleton = loadOrdinariumSkeleton('lauds', version, corpus);
    const finalAnt = skeleton.slots.find((slot) => slot.name === 'final-antiphon-bvm');
    expect(finalAnt?.omissionCondition).toBeDefined();
    expect(finalAnt?.omissionCondition?.instruction).toBe('omittuntur');
  });
});

describe('mapHeaderToSlots (regression — Codex P1 #1)', () => {
  it('expands combined headings like "Capitulum Hymnus Versus" into three slots', async () => {
    const { mapHeaderToSlots } = await import('../../src/hours/skeleton.js');
    expect(mapHeaderToSlots('Capitulum Hymnus Versus')).toEqual(['chapter', 'hymn', 'versicle']);
    expect(mapHeaderToSlots('Capitulum Responsorium Hymnus Versus')).toEqual([
      'chapter',
      'responsory',
      'hymn',
      'versicle'
    ]);
    expect(mapHeaderToSlots('Capitulum Versus')).toEqual(['chapter', 'versicle']);
  });

  it('keeps canticle headings as single antiphon slots', async () => {
    const { mapHeaderToSlots } = await import('../../src/hours/skeleton.js');
    expect(mapHeaderToSlots('Canticum: Benedictus')).toEqual(['antiphon-ad-benedictus']);
    expect(mapHeaderToSlots('Canticum: Magnificat')).toEqual(['antiphon-ad-magnificat']);
    expect(mapHeaderToSlots('Canticum: Nunc dimittis')).toEqual(['antiphon-ad-nunc-dimittis']);
  });
});

describe('OrdinariumSkeletonCache', () => {
  it('returns the same skeleton identity for repeated calls', () => {
    const { corpus, version } = buildFixture();
    const cache = new OrdinariumSkeletonCache();

    const first = cache.get('lauds', version, corpus);
    const second = cache.get('lauds', version, corpus);
    expect(first).toBe(second);
  });

  it('getOrEmpty returns a missing flag and empty slots when file is absent', () => {
    const { version } = buildFixture();
    const cache = new OrdinariumSkeletonCache();
    const emptyCorpus = new TestOfficeTextIndex();

    const result = cache.getOrEmpty('lauds', version, emptyCorpus);
    expect(result.missing).toBe(true);
    expect(result.skeleton.slots).toHaveLength(0);
  });
});
