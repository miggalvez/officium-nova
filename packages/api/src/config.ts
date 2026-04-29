import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { VersionRegistry } from '@officium-novum/rubrical-engine';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const API_PACKAGE_ROOT = resolve(MODULE_DIR, '..');
const REPOSITORY_ROOT = resolve(API_PACKAGE_ROOT, '../..');

export interface ApiConfig {
  readonly host: string;
  readonly port: number;
  readonly corpusPath: string;
  readonly contentVersion: string;
  readonly logger: boolean;
  readonly versionRegistry?: VersionRegistry;
  readonly loadRuntime?: boolean;
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: env.OFFICIUM_API_HOST ?? (env.PORT ? '0.0.0.0' : '127.0.0.1'),
    port: parsePort(env.OFFICIUM_API_PORT ?? env.PORT),
    corpusPath: env.OFFICIUM_CORPUS_PATH
      ? resolve(env.OFFICIUM_CORPUS_PATH)
      : resolve(REPOSITORY_ROOT, 'upstream/web/www'),
    contentVersion: resolveContentVersion(env),
    logger: parseBoolean(env.OFFICIUM_API_LOGGER)
  };
}

export function resolveContentVersion(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = cleanEnvValue(env.OFFICIUM_CONTENT_VERSION);
  if (explicit) {
    return explicit;
  }

  const commitSha =
    cleanEnvValue(env.RAILWAY_GIT_COMMIT_SHA) ??
    cleanEnvValue(env.VERCEL_GIT_COMMIT_SHA) ??
    cleanEnvValue(env.GIT_COMMIT_SHA) ??
    cleanEnvValue(env.SOURCE_VERSION);
  if (commitSha) {
    return `git:${commitSha.slice(0, 12)}`;
  }

  const deploymentId =
    cleanEnvValue(env.RAILWAY_DEPLOYMENT_ID) ??
    cleanEnvValue(env.VERCEL_DEPLOYMENT_ID);
  if (deploymentId) {
    return `deploy:${deploymentId}`;
  }

  return 'dev';
}

function cleanEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid OFFICIUM_API_PORT/PORT: ${value}`);
  }
  return port;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  if (value === '1' || value.toLowerCase() === 'true') {
    return true;
  }
  if (value === '0' || value.toLowerCase() === 'false') {
    return false;
  }
  throw new Error(`Invalid OFFICIUM_API_LOGGER: ${value}`);
}
