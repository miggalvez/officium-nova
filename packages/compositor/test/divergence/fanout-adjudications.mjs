import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const DIVERGENCE_DIR = THIS_DIR;
const ADJUDICATIONS_FILE = resolve(DIVERGENCE_DIR, 'adjudications.json');
const LEDGER_FILES = [
  'divino-afflatu-2024.md',
  'reduced-1955-2024.md',
  'rubrics-1960-2024.md'
].map((name) => resolve(DIVERGENCE_DIR, name));

const args = new Set(process.argv.slice(2));
const write = args.has('--write');

const adjudications = loadJson(ADJUDICATIONS_FILE);
const rows = LEDGER_FILES.flatMap(loadLedgerRows);

let additions = 0;

for (const [rowKey, source] of Object.entries(adjudications)) {
  void rowKey;
  const matches = rows.filter(
    (row) =>
      row.policy === source.policy &&
      normalizeKeyInput(row.firstExpected) === normalizeKeyInput(source.firstExpected) &&
      normalizeKeyInput(row.firstActual) === normalizeKeyInput(source.firstActual)
  );

  for (const row of matches) {
    const nextKey = computeRowKey(row);
    if (adjudications[nextKey]) {
      continue;
    }

    adjudications[nextKey] = {
      ...source,
      policy: row.policy,
      date: row.date,
      hour: row.hour,
      firstExpected: row.firstExpected,
      firstActual: row.firstActual
    };
    additions += 1;
  }
}

if (write && additions > 0) {
  writeFileSync(
    ADJUDICATIONS_FILE,
    `${JSON.stringify(sortObject(adjudications), null, 2)}\n`
  );
}

console.log(
  `${write ? 'Wrote' : 'Would write'} ${additions} adjudication entr${additions === 1 ? 'y' : 'ies'}`
);

function loadJson(path) {
  if (!existsSync(path)) {
    return {};
  }
  const raw = readFileSync(path, 'utf8').trim();
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function loadLedgerRows(path) {
  const text = readFileSync(path, 'utf8');
  const policy = readPolicy(text, path);
  return text
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*2024-\d{2}-\d{2}\s+\|/u.test(line))
    .map((line) => parseLedgerRow(line, policy))
    .filter(Boolean);
}

function readPolicy(text, path) {
  if (path.endsWith('divino-afflatu-2024.md')) {
    return 'Divino Afflatu - 1954';
  }
  if (path.endsWith('reduced-1955-2024.md')) {
    return 'Reduced - 1955';
  }
  if (path.endsWith('rubrics-1960-2024.md')) {
    return 'Rubrics 1960 - 1960';
  }

  const match = text.match(/for `([^`]+)`\./u);
  if (!match?.[1]) {
    throw new Error(`Could not infer policy from ${path}`);
  }
  return match[1];
}

function parseLedgerRow(line, policy) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

  if (cells.length < 8) {
    return undefined;
  }

  return {
    policy,
    date: cells[0],
    hour: cells[1],
    firstExpected: markdownCellToText(cells[6]),
    firstActual: markdownCellToText(cells[7])
  };
}

function markdownCellToText(value) {
  return value.replace(/<br\/>/gu, '\n').replace(/\\\|/gu, '|');
}

function computeRowKey({ policy, date, hour, firstExpected, firstActual }) {
  const digest = createHash('sha256')
    .update(`${normalizeKeyInput(firstExpected)}\u0000${normalizeKeyInput(firstActual)}`)
    .digest('hex')
    .slice(0, 8);
  return `${policy}/${date}/${hour}/${digest}`;
}

function normalizeKeyInput(value) {
  if (value === null || value === undefined) {
    return '__null__';
  }
  return String(value).replace(/\s+/gu, ' ').trim();
}

function sortObject(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}
