import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC_ROOT = resolve(PACKAGE_ROOT, 'src');
const ADJUDICATIONS_FILE = resolve(PACKAGE_ROOT, 'test/divergence/adjudications.json');
const MAX_LINES = 800;

const sourceFiles = listSourceFiles(SRC_ROOT);
const lineFailures = sourceFiles
  .map((path) => ({
    path,
    lineCount: readFileSync(path, 'utf8').split(/\r?\n/u).length
  }))
  .filter((entry) => entry.lineCount > MAX_LINES);

const adjudications = JSON.parse(readFileSync(ADJUDICATIONS_FILE, 'utf8'));
const pendingCommitSha = Object.entries(adjudications)
  .filter(([, value]) => value && typeof value === 'object' && value.commitSha === 'pending')
  .map(([key]) => key);

if (lineFailures.length === 0 && pendingCommitSha.length === 0) {
  console.log('Phase 3 sign-off verification passed.');
  process.exit(0);
}

if (lineFailures.length > 0) {
  console.error('Files over 800 lines:');
  for (const failure of lineFailures) {
    console.error(`- ${failure.path}: ${failure.lineCount}`);
  }
}

if (pendingCommitSha.length > 0) {
  console.error('Adjudications with commitSha \"pending\":');
  for (const key of pendingCommitSha) {
    console.error(`- ${key}`);
  }
}

process.exit(1);

function listSourceFiles(root) {
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
