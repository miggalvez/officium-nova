import { describe, expect, it } from 'vitest';

import { computeYearKey, gregorianEaster } from '../../src/index.js';

const TEST_YEARS = [1900, 1920, 1931, 1940, 1954, 1960, 1999, 2000, 2024, 2030];
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

describe('computeYearKey', () => {
  it.each(TEST_YEARS)('matches the Perl-derived oracle for %s', (year) => {
    expect(computeYearKey(year)).toEqual(oracleYearKey(year));
  });

  it('matches fixed known vectors', () => {
    expect(computeYearKey(1960)).toEqual({
      letter: 'b',
      easterKey: '0417',
      isLeap: true,
      leapCompanionLetter: 'c',
      leapCompanionEasterKey: '0418'
    });
    expect(computeYearKey(2024)).toEqual({
      letter: 'f',
      easterKey: '0331',
      isLeap: true,
      leapCompanionLetter: 'g',
      leapCompanionEasterKey: '0401'
    });
    expect(computeYearKey(2000)).toEqual({
      letter: 'a',
      easterKey: '0423',
      isLeap: true,
      leapCompanionLetter: 'b',
      leapCompanionEasterKey: '0424'
    });
  });
});

function oracleYearKey(year: number) {
  const easter = gregorianEaster(year);
  const easterNumber = easter.month * 100 + easter.day;
  const letterIndex =
    (easterNumber - 319 + (easter.month === 4 ? 1 : 0)) % LETTERS.length;
  const letter = LETTERS[letterIndex];
  if (!letter) {
    throw new Error(`Missing letter at index ${letterIndex}`);
  }

  if (!isLeapYear(year)) {
    return {
      letter,
      easterKey: pad4(easterNumber),
      isLeap: false
    };
  }

  let companionEaster = easterNumber + 1;
  if (companionEaster === 332) {
    companionEaster = 401;
  }
  const leapCompanionLetter = LETTERS[(letterIndex + 1) % LETTERS.length];
  if (!leapCompanionLetter) {
    throw new Error(`Missing companion letter at index ${letterIndex + 1}`);
  }

  return {
    letter,
    easterKey: pad4(easterNumber),
    isLeap: true,
    leapCompanionLetter,
    leapCompanionEasterKey: pad4(companionEaster)
  };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function pad4(value: number): string {
  return value.toString().padStart(4, '0');
}
