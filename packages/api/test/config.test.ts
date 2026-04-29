import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadApiConfig, resolveContentVersion } from '../src/config.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TEST_DIR, '..');
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, '../..');

describe('config', () => {
  it('defaults corpusPath to the repository upstream corpus independently of cwd', () => {
    const config = loadApiConfig({});

    expect(config.corpusPath).toBe(resolve(REPOSITORY_ROOT, 'upstream/web/www'));
  });

  it('parses logger configuration explicitly', () => {
    expect(loadApiConfig({ OFFICIUM_API_LOGGER: 'true' }).logger).toBe(true);
    expect(loadApiConfig({ OFFICIUM_API_LOGGER: '0' }).logger).toBe(false);
    expect(() => loadApiConfig({ OFFICIUM_API_LOGGER: 'yes' })).toThrow(
      'Invalid OFFICIUM_API_LOGGER: yes'
    );
  });

  it('derives contentVersion from deployment metadata when explicit value is absent', () => {
    expect(resolveContentVersion({
      RAILWAY_GIT_COMMIT_SHA: '924d8a2f9adbf5cde9a14254535455a74ed7530f'
    })).toBe('git:924d8a2f9adb');
    expect(resolveContentVersion({
      VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890'
    })).toBe('git:abcdef123456');
    expect(resolveContentVersion({
      RAILWAY_DEPLOYMENT_ID: 'f2769e63-c3ca-4bfa-9809-d3feb5c6884a'
    })).toBe('deploy:f2769e63-c3ca-4bfa-9809-d3feb5c6884a');
  });

  it('keeps explicit contentVersion ahead of deployment metadata', () => {
    expect(resolveContentVersion({
      OFFICIUM_CONTENT_VERSION: 'ordo-2026-04-29',
      RAILWAY_GIT_COMMIT_SHA: '924d8a2f9adbf5cde9a14254535455a74ed7530f'
    })).toBe('ordo-2026-04-29');
  });
});
