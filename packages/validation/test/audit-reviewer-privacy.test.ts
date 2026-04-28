import { describe, expect, it } from 'vitest';

import { findPrivateFieldLeaks } from '../src/audit-reviewer-privacy.js';

describe('reviewer privacy audit', () => {
  it('detects private reviewer fields case-insensitively', () => {
    expect(findPrivateFieldLeaks('PrivateNotes: do not commit')).toContain('privateNotes');
    expect(findPrivateFieldLeaks('"CONTACT": "reviewer@example.test"')).toContain('contact');
  });

  it('does not flag public reviewer schema fields', () => {
    expect(findPrivateFieldLeaks('"publicName": null')).toEqual([]);
  });
});
