import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIVATE_FIELD_NAMES = [
  'name',
  'contact',
  'affiliation',
  'qualification',
  'consentToAttribution',
  'consentToFollowUp',
  'privateNotes'
] as const;

const SCAN_DIRS = ['packages/validation/test/reviewer-reports'] as const;

interface PrivacyAuditSummary {
  readonly checkedFiles: number;
  readonly errors: readonly string[];
}

export async function auditReviewerPrivacy(): Promise<PrivacyAuditSummary> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const errors: string[] = [];
  let checkedFiles = 0;

  for (const dir of SCAN_DIRS) {
    const files = await listFixtureFiles(resolve(repoRoot, dir));
    for (const file of files) {
      checkedFiles += 1;
      const content = await readFile(file, 'utf8');
      for (const field of PRIVATE_FIELD_NAMES) {
        const pattern = new RegExp(`(^|[\\s"{,])${field}\\s*[:=]`, 'mu');
        if (pattern.test(content)) {
          errors.push(`${file}: public reviewer fixture contains private field ${field}`);
        }
      }
    }
  }

  return {
    checkedFiles,
    errors
  };
}

async function listFixtureFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFixtureFiles(path));
    } else if (['.json', '.md', '.yaml', '.yml'].includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await auditReviewerPrivacy();
  if (summary.errors.length > 0) {
    console.error(summary.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`reviewer privacy audit passed: ${summary.checkedFiles} public fixture files checked`);
  }
}
