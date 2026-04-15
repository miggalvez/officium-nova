import { describe, expect, it } from 'vitest';

import {
  asVersionHandle,
  defaultResolveRank,
  extractOfficeSubstitution
} from '../../src/index.js';
import type { ResolvedVersion, RubricalPolicy } from '../../src/index.js';

describe('extractOfficeSubstitution', () => {
  it('normalizes Tempora targets to canonical Tempora paths', () => {
    const result = extractOfficeSubstitution(
      [{ kind: 'transfer', dateKey: '01-02', target: 'Tempora/Nat2-0' }],
      '01-02',
      makeVersion('rubrics-1960')
    );

    expect(result.officeSubstitution?.path).toBe('Tempora/Nat2-0');
    expect(result.warnings).toEqual([]);
  });

  it('normalizes bare MM-DD targets to canonical Sancti paths', () => {
    const result = extractOfficeSubstitution(
      [{ kind: 'transfer', dateKey: '01-26', target: '01-25' }],
      '01-26',
      makeVersion('rubrics-1960')
    );

    expect(result.officeSubstitution?.path).toBe('Sancti/01-25');
    expect(result.warnings).toEqual([]);
  });

  it('keeps only the primary target and warns when alternates are present', () => {
    const result = extractOfficeSubstitution(
      [
        {
          kind: 'transfer',
          dateKey: '01-10',
          target: '01-09',
          alternates: ['01-15']
        }
      ],
      '01-10',
      makeVersion('rubrics-1960')
    );

    expect(result.officeSubstitution?.path).toBe('Sancti/01-09');
    expect(result.warnings).toEqual([
      {
        code: 'overlay-alternates-deferred',
        message: 'Transfer alternates are deferred to Phase 2e transfer computation.',
        severity: 'info',
        context: {
          dateKey: '01-10',
          primary: '01-09',
          alternates: '01-15'
        }
      }
    ]);
  });
});

function makeVersion(policyName: RubricalPolicy['name']): ResolvedVersion {
  return {
    handle: asVersionHandle('Test Version'),
    kalendar: 'test',
    transfer: 'test',
    stransfer: 'test',
    policy: {
      name: policyName,
      resolveRank: defaultResolveRank
    }
  };
}
