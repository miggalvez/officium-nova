import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const SRC_ROOT = resolve(PACKAGE_ROOT, 'src');
export const DIVERGENCE_ROOT = resolve(PACKAGE_ROOT, 'test/divergence');
export const ADJUDICATIONS_FILE = resolve(DIVERGENCE_ROOT, 'adjudications.json');
export const PHASE3_UNADJUDICATED_THRESHOLD = 10;

export const PHASE3_LEDGER_FILES = [
  { policy: 'Divino Afflatu', filename: 'divino-afflatu-2024.md' },
  { policy: 'Reduced 1955', filename: 'reduced-1955-2024.md' },
  { policy: 'Rubrics 1960', filename: 'rubrics-1960-2024.md' }
];

export function loadPhase3LedgerSummaries() {
  return PHASE3_LEDGER_FILES.map(({ policy, filename }) =>
    parsePhase3Ledger(policy, resolve(DIVERGENCE_ROOT, filename))
  );
}

export function loadAdjudications() {
  return JSON.parse(readFileSync(ADJUDICATIONS_FILE, 'utf8'));
}

export function findPendingCommitShaKeys(adjudications) {
  return Object.entries(adjudications)
    .filter(([, value]) => value && typeof value === 'object' && value.commitSha === 'pending')
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

export function rowsToClearForThreshold(unadjudicatedCount) {
  return Math.max(0, unadjudicatedCount - (PHASE3_UNADJUDICATED_THRESHOLD - 1));
}

export function listSourceFiles(root = SRC_ROOT) {
  const out = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(path));
      continue;
    }

    if (!entry.isFile() || !/\.tsx?$/u.test(entry.name)) {
      continue;
    }

    if (!statSync(path).isFile()) {
      continue;
    }

    out.push(path);
  }

  return out.sort((left, right) => left.localeCompare(right));
}

function parsePhase3Ledger(policy, ledgerPath) {
  const raw = readFileSync(ledgerPath, 'utf8');

  return {
    policy,
    path: ledgerPath,
    bestMatchingPrefix: extractMetric(raw, /- Best matching prefix before divergence: `([^`]+)` lines/u, 'best matching prefix', ledgerPath),
    averageMatchingPrefix: extractMetric(raw, /- Average matching prefix before divergence: `([^`]+)` lines/u, 'average matching prefix', ledgerPath),
    adjudicationBreakdown: {
      unadjudicated: extractBreakdownCount(raw, 'unadjudicated', ledgerPath, true),
      perlBug: extractBreakdownCount(raw, 'perl-bug', ledgerPath, true),
      renderingDifference: extractBreakdownCount(raw, 'rendering-difference', ledgerPath, true),
      engineBug: extractBreakdownCount(raw, 'engine-bug', ledgerPath, false) ?? 0
    }
  };
}

function extractBreakdownCount(raw, label, ledgerPath, required) {
  const match = raw.match(new RegExp('- `' + escapeRegExp(label) + '`: `([^`]+)`', 'u'));
  if (!match) {
    if (required) {
      throw new Error(`Could not find "${label}" in ${ledgerPath}`);
    }

    return null;
  }

  return parseNumericValue(match[1], label, ledgerPath);
}

function extractMetric(raw, pattern, label, ledgerPath) {
  const match = raw.match(pattern);
  if (!match) {
    throw new Error(`Could not find "${label}" in ${ledgerPath}`);
  }

  return parseNumericValue(match[1], label, ledgerPath);
}

function parseNumericValue(value, label, ledgerPath) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not parse numeric value for "${label}" in ${ledgerPath}: ${value}`);
  }

  return parsed;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
