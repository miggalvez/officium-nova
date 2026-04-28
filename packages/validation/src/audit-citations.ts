import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_CLASSIFICATIONS,
  type AdjudicationClassification
} from './schemas/adjudication.schema.js';
import { validateCitation } from './schemas/citation.schema.js';
import { isRecord } from './schemas/common.js';

const REQUIRED_CITATION_CLASSES: readonly AdjudicationClassification[] = [
  'parser-bug',
  'engine-bug',
  'compositor-bug',
  'api-bug',
  'corpus-bug',
  'perl-bug',
  'ordo-ambiguous',
  'source-ambiguous'
];

interface AuditSummary {
  readonly checked: number;
  readonly legacyCitationStrings: number;
  readonly errors: readonly string[];
}

export async function auditCitations(): Promise<AuditSummary> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const sidecarPath = resolve(
    repoRoot,
    'packages/compositor/test/divergence/adjudications.json'
  );
  const raw = await readFile(sidecarPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    return {
      checked: 0,
      legacyCitationStrings: 0,
      errors: ['compositor adjudications sidecar must be an object']
    };
  }

  const errors: string[] = [];
  let checked = 0;
  let legacyCitationStrings = 0;

  for (const [key, value] of Object.entries(parsed)) {
    checked += 1;
    if (!isRecord(value)) {
      errors.push(`${key}: entry must be an object`);
      continue;
    }

    const classification = value.class;
    if (
      typeof classification !== 'string' ||
      !ADJUDICATION_CLASSIFICATIONS.includes(
        classification as AdjudicationClassification
      )
    ) {
      errors.push(`${key}: class must be a Phase 5 classification`);
      continue;
    }

    const requireCitation = REQUIRED_CITATION_CLASSES.includes(
      classification as AdjudicationClassification
    );

    if (typeof value.citation === 'string') {
      legacyCitationStrings += 1;
      if (requireCitation && value.citation.trim().length === 0) {
        errors.push(`${key}: required legacy citation string is empty`);
      }
      continue;
    }

    const citation = validateCitation(value.citation, {
      requireSource: requireCitation
    });
    if (!citation.ok) {
      for (const error of citation.errors) {
        errors.push(`${key}: ${error}`);
      }
    }
  }

  return {
    checked,
    legacyCitationStrings,
    errors
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await auditCitations();
  if (summary.errors.length > 0) {
    console.error(summary.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `citation audit passed: ${summary.checked} adjudications checked (${summary.legacyCitationStrings} legacy citation strings pending structured migration)`
    );
  }
}
