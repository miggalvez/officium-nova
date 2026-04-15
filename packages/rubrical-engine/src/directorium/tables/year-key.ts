import { isLeapYear } from '../../internal/date.js';
import { gregorianEaster } from '../../temporal/easter.js';

export interface YearKey {
  /** Sunday-letter file (`a`..`g`). */
  readonly letter: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  /**
   * MMDD of Easter, as a four-digit string like "0412".
   * The filename is `${easterKey}.txt`.
   */
  readonly easterKey: string;
  readonly isLeap: boolean;
  /**
   * In leap years, Jan-Feb lines are pulled from the companion pair.
   */
  readonly leapCompanionLetter?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  readonly leapCompanionEasterKey?: string;
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

export function computeYearKey(year: number): YearKey {
  const easter = gregorianEaster(year);
  const easterNumber = easter.month * 100 + easter.day;
  // Mirrors the Perl formula in Directorium.pm:114-116.
  const letterIndex =
    (easterNumber - 319 + (easter.month === 4 ? 1 : 0)) % LETTERS.length;
  const letter = LETTERS[letterIndex];
  if (!letter) {
    throw new Error(`Unable to compute Sunday letter index for year ${year}.`);
  }

  if (!isLeapYear(year)) {
    return {
      letter,
      easterKey: pad4(easterNumber),
      isLeap: false
    };
  }

  let leapCompanionEaster = easterNumber + 1;
  // Mirrors Directorium.pm:121-122.
  if (leapCompanionEaster === 332) {
    leapCompanionEaster = 401;
  }
  // Perl uses `$letters[$letter - 6]` (Directorium.pm:123), which advances
  // one slot with wrap-around.
  const leapCompanionLetter = LETTERS[(letterIndex + 1) % LETTERS.length];
  if (!leapCompanionLetter) {
    throw new Error(`Unable to compute companion Sunday letter for year ${year}.`);
  }

  return {
    letter,
    easterKey: pad4(easterNumber),
    isLeap: true,
    leapCompanionLetter,
    leapCompanionEasterKey: pad4(leapCompanionEaster)
  };
}

function pad4(value: number): string {
  return value.toString().padStart(4, '0');
}
