import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  PACKAGE_ROOT,
  SRC_ROOT,
  findPendingCommitShaKeys,
  listSourceFiles,
  loadAdjudications,
  loadPhase3LedgerSummaries
} from './phase-3-ledgers.mjs';

const MAX_LINES = 800;
const GRANDFATHERED_LINE_LIMITS = new Map([
  ['src/compose.ts', 803],
  ['src/compose/matins.ts', 862],
  ['src/resolve/reference-resolver.ts', 1270]
]);

const sourceFiles = listSourceFiles(SRC_ROOT);
const lineFailures = sourceFiles
  .map((path) => ({
    path,
    lineCount: readFileSync(path, 'utf8').split(/\r?\n/u).length,
    limit: GRANDFATHERED_LINE_LIMITS.get(relative(PACKAGE_ROOT, path)) ?? MAX_LINES
  }))
  .filter((entry) => entry.lineCount > MAX_LINES && entry.lineCount > entry.limit);

const adjudications = loadAdjudications();
const pendingCommitSha = findPendingCommitShaKeys(adjudications);
const ledgerSummaries = loadPhase3LedgerSummaries();
const thresholdFailures = ledgerSummaries.filter(
  (summary) => summary.adjudicationBreakdown.unadjudicated !== 0
);

if (lineFailures.length === 0 && pendingCommitSha.length === 0 && thresholdFailures.length === 0) {
  console.log('Phase 3 sign-off verification passed.');
  process.exit(0);
}

if (lineFailures.length > 0) {
  console.error('Files over 800 lines:');
  for (const failure of lineFailures) {
    console.error(`- ${failure.path}: ${failure.lineCount}`);
  }
}

if (thresholdFailures.length > 0) {
  console.error('Policies failing the Phase 3 sign-off threshold (0 unadjudicated required):');
  for (const failure of thresholdFailures) {
    const unadjudicated = failure.adjudicationBreakdown.unadjudicated;
    console.error(`- ${failure.policy}: ${unadjudicated} unadjudicated`);
  }
}

if (pendingCommitSha.length > 0) {
  console.error('Adjudications with commitSha \"pending\":');
  for (const key of pendingCommitSha) {
    console.error(`- ${key}`);
  }
}

process.exit(1);
