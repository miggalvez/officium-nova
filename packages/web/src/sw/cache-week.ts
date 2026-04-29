import { buildOfficeHourUrl } from '../api/url';
import type { HourName, PublicLanguageTag, TextOrthographyProfile } from '../api/types';
import { getEnvironment } from '../app/env';

export interface CacheWeekInput {
  readonly start: string;
  readonly version: string;
  readonly languages: readonly PublicLanguageTag[];
  readonly orthography: TextOrthographyProfile;
  readonly hours?: readonly HourName[];
}

const DEFAULT_HOURS: readonly HourName[] = ['lauds', 'vespers', 'compline'];
const API_CACHE = 'api-runtime-v1';

interface CacheWeekResult {
  readonly ok: boolean;
  readonly cached: number;
  readonly failed: number;
  readonly message?: string;
}

export async function cacheWeek(
  input: CacheWeekInput
): Promise<{ urls: readonly string[]; cached: number; failed: number }> {
  const env = getEnvironment();
  const hours = input.hours ?? DEFAULT_HOURS;
  const urls: string[] = [];
  for (let day = 0; day < 7; day += 1) {
    const date = addDays(input.start, day);
    for (const hour of hours) {
      urls.push(
        buildOfficeHourUrl(env.apiBaseUrl, {
          date,
          hour,
          version: input.version,
          languages: input.languages,
          orthography: input.orthography
        })
      );
    }
  }

  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
    const result = await sendCacheWeekMessage(navigator.serviceWorker.controller, urls);
    if (!result.ok) {
      throw new Error(result.message ?? `Failed to cache ${result.failed} of ${urls.length} URLs.`);
    }
    return { urls, cached: result.cached, failed: result.failed };
  }

  const result = await prefetchInPage(urls);
  if (result.failed > 0) {
    throw new Error(`Failed to cache ${result.failed} of ${urls.length} URLs.`);
  }
  return { urls, cached: result.cached, failed: result.failed };
}

function sendCacheWeekMessage(
  controller: ServiceWorker,
  urls: readonly string[]
): Promise<CacheWeekResult> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('Timed out waiting for cache confirmation.'));
    }, 60_000);

    channel.port1.onmessage = (event: MessageEvent<CacheWeekResult>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    controller.postMessage({ type: 'cache-week', urls }, [channel.port2]);
  });
}

async function prefetchInPage(urls: readonly string[]): Promise<{ cached: number; failed: number }> {
  const cache = typeof caches !== 'undefined' ? await caches.open(API_CACHE) : undefined;
  let cached = 0;
  let failed = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          failed += 1;
          return;
        }
        if (cache) {
          await cache.put(url, response.clone());
        }
        cached += 1;
      } catch {
        failed += 1;
      }
    })
  );
  return { cached, failed };
}

function addDays(start: string, days: number): string {
  const [yearRaw, monthRaw, dayRaw] = start.split('-');
  const date = new Date(
    Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw) + days)
  );
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
