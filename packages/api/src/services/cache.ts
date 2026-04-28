import { createHash } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HourName, VersionHandle } from '@officium-novum/rubrical-engine';

import type { OfficeHourResponse } from './dto.js';
import type { PublicLanguageTag } from './language-map.js';
import type { TextOrthographyProfile } from './orthography-profile.js';

export const DETERMINISTIC_CACHE_CONTROL =
  'public, max-age=86400, stale-while-revalidate=604800';

export interface CanonicalOfficeKey {
  readonly route: 'office';
  readonly apiVersion: 'v1';
  readonly date: string;
  readonly hour: HourName;
  readonly version: VersionHandle;
  readonly languages: readonly PublicLanguageTag[];
  readonly langfb?: PublicLanguageTag;
  readonly orthography: TextOrthographyProfile;
  readonly joinLaudsToMatins: boolean;
  readonly strict: boolean;
  readonly contentVersion: string;
}

export function buildCanonicalOfficeKey(input: {
  readonly date: string;
  readonly hour: HourName;
  readonly version: VersionHandle;
  readonly languages: readonly PublicLanguageTag[];
  readonly langfb?: PublicLanguageTag;
  readonly orthography: TextOrthographyProfile;
  readonly joinLaudsToMatins: boolean;
  readonly strict: boolean;
  readonly contentVersion: string;
}): CanonicalOfficeKey {
  return {
    route: 'office',
    apiVersion: 'v1',
    date: input.date,
    hour: input.hour,
    version: input.version,
    languages: input.languages,
    ...(input.langfb ? { langfb: input.langfb } : {}),
    orthography: input.orthography,
    joinLaudsToMatins: input.joinLaudsToMatins,
    strict: input.strict,
    contentVersion: input.contentVersion
  };
}

export function officeResponseCacheKey(response: OfficeHourResponse): CanonicalOfficeKey {
  return buildCanonicalOfficeKey({
    date: response.request.date,
    hour: response.request.hour,
    version: response.request.version,
    languages: response.request.languages,
    langfb: response.request.langfb,
    orthography: response.request.orthography,
    joinLaudsToMatins: response.request.joinLaudsToMatins,
    strict: response.request.strict,
    contentVersion: response.meta.contentVersion
  });
}

export function canonicalOfficePath(key: CanonicalOfficeKey): string {
  const params = new URLSearchParams();
  params.set('version', key.version);
  params.set('lang', key.languages.join(','));
  if (key.langfb) {
    params.set('langfb', key.langfb);
  }
  params.set('orthography', key.orthography);
  params.set('joinLaudsToMatins', String(key.joinLaudsToMatins));
  params.set('strict', String(key.strict));
  return `/api/v1/office/${key.date}/${key.hour}?${params.toString()}`;
}

export function stableJsonHash(value: unknown): string {
  return hashString(stableJsonStringify(value));
}

export function buildDeterministicEtag(input: {
  readonly key: CanonicalOfficeKey;
  readonly body: unknown;
}): string {
  const requestHash = stableJsonHash(input.key);
  const bodyHash = stableJsonHash(input.body);
  return `"v1:${etagSegment(input.key.contentVersion)}:${requestHash}:${bodyHash}"`;
}

export function applyCacheHeaders(reply: FastifyReply, etag: string): void {
  reply.header('Cache-Control', DETERMINISTIC_CACHE_CONTROL);
  reply.header('ETag', etag);
}

export function requestMatchesEtag(request: FastifyRequest, etag: string): boolean {
  const header = request.headers['if-none-match'];
  if (!header) {
    return false;
  }

  const values: readonly string[] = Array.isArray(header) ? header : [header];
  return values.some((value: string) =>
    value
      .split(',')
      .map((candidate: string) => candidate.trim())
      .some((candidate: string) => candidate === '*' || candidate === etag)
  );
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(toStableJson(value));
}

function toStableJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : toStableJson(item)));
  }

  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, toStableJson(child)])
  );
}

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('base64url').slice(0, 24);
}

function etagSegment(value: string): string {
  return encodeURIComponent(value).replaceAll('%', '~');
}
