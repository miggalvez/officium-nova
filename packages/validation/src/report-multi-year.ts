import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isRecord } from './schemas/common.js';

export const CANDIDATE_UNADJUDICATED_LIMIT = 10;

export type YearStatus = 'exploratory' | 'candidate' | 'gated';

export interface MultiYearManifest {
  readonly schemaVersion: 1;
  readonly years: readonly YearStatusEntry[];
}

export interface YearStatusEntry {
  readonly year: number;
  readonly status: YearStatus;
  readonly owner: string;
  readonly promotionWindow: string;
  readonly followUp: string;
  readonly policies: readonly PolicyYearStatus[];
}

export interface PolicyYearStatus {
  readonly policy: string;
  readonly slug: string;
  readonly ledger: string;
  readonly sidecar: string;
  readonly unadjudicated: number;
  readonly noThrowFailures: number;
  readonly schemaFailures: number;
}

export interface MultiYearReport {
  readonly manifest: MultiYearManifest;
  readonly errors: readonly string[];
  readonly table: readonly ReportRow[];
}

export interface ReportRow {
  readonly year: number;
  readonly status: YearStatus;
  readonly policy: string;
  readonly unadjudicated: number;
  readonly noThrowFailures: number;
  readonly schemaFailures: number;
}

export async function loadMultiYearReport(options: {
  readonly manifestPath?: string;
} = {}): Promise<MultiYearReport> {
  const manifestPath = options.manifestPath ?? defaultManifestPath();
  const repoRoot = resolve(dirname(manifestPath), '../../../..');
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const manifest = parseManifest(parsed);
  const errors = [
    ...validateManifest(manifest),
    ...await validateReferencedFiles(manifest, repoRoot)
  ];
  const table = manifest.years.flatMap((year) =>
    year.policies.map((policy) => ({
      year: year.year,
      status: year.status,
      policy: policy.policy,
      unadjudicated: policy.unadjudicated,
      noThrowFailures: policy.noThrowFailures,
      schemaFailures: policy.schemaFailures
    }))
  );

  return {
    manifest,
    errors,
    table
  };
}

export function formatMultiYearTable(rows: readonly ReportRow[]): string {
  const header = 'Year | Status | Policy | Unadj | No-throw | Schema';
  const divider = '---: | --- | --- | ---: | ---: | ---:';
  const body = rows.map((row) =>
    [
      row.year,
      row.status,
      row.policy,
      row.unadjudicated,
      row.noThrowFailures,
      row.schemaFailures
    ].join(' | ')
  );
  return [header, divider, ...body].join('\n');
}

function parseManifest(value: unknown): MultiYearManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.years)) {
    throw new Error('multi-year manifest must have schemaVersion 1 and a years array');
  }

  return {
    schemaVersion: 1,
    years: value.years.map(parseYearStatus)
  };
}

function parseYearStatus(value: unknown): YearStatusEntry {
  if (!isRecord(value)) {
    throw new Error('multi-year year entry must be an object');
  }
  const status = parseStatus(value.status);
  if (!Array.isArray(value.policies)) {
    throw new Error('multi-year year entry must include policies');
  }

  return {
    year: parseInteger(value.year, 'year'),
    status,
    owner: parseString(value.owner, 'owner'),
    promotionWindow: parseString(value.promotionWindow, 'promotionWindow'),
    followUp: parseString(value.followUp, 'followUp'),
    policies: value.policies.map(parsePolicyYearStatus)
  };
}

function parsePolicyYearStatus(value: unknown): PolicyYearStatus {
  if (!isRecord(value)) {
    throw new Error('multi-year policy entry must be an object');
  }
  return {
    policy: parseString(value.policy, 'policy'),
    slug: parseString(value.slug, 'slug'),
    ledger: parseString(value.ledger, 'ledger'),
    sidecar: parseString(value.sidecar, 'sidecar'),
    unadjudicated: parseInteger(value.unadjudicated, 'unadjudicated'),
    noThrowFailures: parseInteger(value.noThrowFailures, 'noThrowFailures'),
    schemaFailures: parseInteger(value.schemaFailures, 'schemaFailures')
  };
}

function validateManifest(manifest: MultiYearManifest): readonly string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const year of manifest.years) {
    if (year.policies.length === 0) {
      errors.push(`${year.year}: must include at least one policy row`);
    }
    if (year.status !== 'exploratory' && year.promotionWindow.trim() === '') {
      errors.push(`${year.year}: ${year.status} years require a promotion window`);
    }
    if (year.status === 'candidate' && year.followUp.trim() === '') {
      errors.push(`${year.year}: candidate years require a follow-up path to gated`);
    }

    for (const policy of year.policies) {
      const key = `${year.year}/${policy.slug}`;
      if (seen.has(key)) {
        errors.push(`${key}: duplicate policy/year row`);
      }
      seen.add(key);

      if (year.status !== 'exploratory' && policy.noThrowFailures !== 0) {
        errors.push(`${key}: candidate/gated no-throw failures must be 0`);
      }
      if (year.status !== 'exploratory' && policy.schemaFailures !== 0) {
        errors.push(`${key}: candidate/gated schema failures must be 0`);
      }
      if (year.status === 'gated' && policy.unadjudicated !== 0) {
        errors.push(`${key}: gated years require 0 unadjudicated rows`);
      }
      if (
        year.status === 'candidate' &&
        policy.unadjudicated >= CANDIDATE_UNADJUDICATED_LIMIT
      ) {
        errors.push(
          `${key}: candidate years require fewer than ${CANDIDATE_UNADJUDICATED_LIMIT} unadjudicated rows`
        );
      }
    }
  }

  return errors;
}

async function validateReferencedFiles(
  manifest: MultiYearManifest,
  repoRoot: string
): Promise<readonly string[]> {
  const errors: string[] = [];
  const checkedSidecars = new Set<string>();

  for (const year of manifest.years) {
    for (const policy of year.policies) {
      const key = `${year.year}/${policy.slug}`;
      const ledgerPath = resolve(repoRoot, policy.ledger);
      const ledger = await readTextFile(ledgerPath, `${key}: ledger`, errors);
      if (ledger) {
        errors.push(...validateLedgerCounts(policy, ledger, key));
      }

      if (!checkedSidecars.has(policy.sidecar)) {
        checkedSidecars.add(policy.sidecar);
        const sidecarPath = resolve(repoRoot, policy.sidecar);
        const sidecar = await readTextFile(sidecarPath, `${key}: sidecar`, errors);
        if (sidecar && policy.sidecar.endsWith('.json')) {
          try {
            JSON.parse(sidecar);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`${key}: sidecar must be valid JSON: ${message}`);
          }
        }
      }
    }
  }

  return errors;
}

function validateLedgerCounts(
  policy: PolicyYearStatus,
  ledger: string,
  key: string
): readonly string[] {
  if (policy.ledger.endsWith('.json')) {
    return validateJsonLedgerCounts(policy, ledger, key);
  }

  const unadjudicated = extractMarkdownCount(ledger, 'unadjudicated');
  if (unadjudicated === null) {
    return [`${key}: ledger does not expose an unadjudicated count`];
  }
  if (unadjudicated !== policy.unadjudicated) {
    return [
      `${key}: manifest unadjudicated ${policy.unadjudicated} does not match ledger ${unadjudicated}`
    ];
  }
  return [];
}

function validateJsonLedgerCounts(
  policy: PolicyYearStatus,
  ledger: string,
  key: string
): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(ledger) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${key}: ledger must be valid JSON: ${message}`];
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.policies)) {
    return [`${key}: JSON ledger must include a policies array`];
  }
  const row = parsed.policies.find(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.slug === policy.slug
  );
  if (!row) {
    return [`${key}: JSON ledger has no row for ${policy.slug}`];
  }

  const errors: string[] = [];
  for (const countField of [
    'unadjudicated',
    'noThrowFailures',
    'schemaFailures'
  ] as const) {
    if (row[countField] !== policy[countField]) {
      errors.push(
        `${key}: manifest ${countField} ${policy[countField]} does not match ledger ${String(row[countField])}`
      );
    }
  }
  return errors;
}

function extractMarkdownCount(ledger: string, label: string): number | null {
  const match = ledger.match(
    new RegExp('- `' + escapeRegExp(label) + '`: `([^`]+)`', 'u')
  );
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

async function readTextFile(
  filePath: string,
  label: string,
  errors: string[]
): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${label} is not readable: ${message}`);
    return null;
  }
}

function parseStatus(value: unknown): YearStatus {
  if (value === 'exploratory' || value === 'candidate' || value === 'gated') {
    return value;
  }
  throw new Error(`invalid year status: ${String(value)}`);
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function parseInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function defaultManifestPath(): string {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  return resolve(
    repoRoot,
    'packages/validation/fixtures/multi-year/phase-5-years.json'
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = await loadMultiYearReport();
  if (report.errors.length > 0) {
    console.error(report.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(formatMultiYearTable(report.table));
    console.log('multi-year status passed');
  }
}
