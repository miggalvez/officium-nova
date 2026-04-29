/* Officium Novum demo service worker.
 * Strategy: build-specific app shell precache + stale-while-revalidate for /api/v1.
 */

const APP_SHELL_VERSION = __OFFICIUM_APP_SHELL_VERSION__;
const APP_SHELL_CACHE = `app-shell-${APP_SHELL_VERSION}`;
const API_CACHE = 'api-runtime-v1';
const APP_SHELL_ASSETS = __OFFICIUM_APP_SHELL_ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith('app-shell-') && key !== APP_SHELL_CACHE) ||
              (key.startsWith('api-runtime-') && key !== API_CACHE)
          )
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (APP_SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache-week') {
    return;
  }
  const urls = Array.isArray(data.urls) ? data.urls.filter((u) => typeof u === 'string') : [];
  const replyPort = event.ports[0];
  event.waitUntil(
    prefetch(urls)
      .then((result) => {
        replyPort?.postMessage({ type: 'cache-week-result', ok: result.failed === 0, ...result });
      })
      .catch((error) => {
        replyPort?.postMessage({
          type: 'cache-week-result',
          ok: false,
          cached: 0,
          failed: urls.length,
          message: error instanceof Error ? error.message : 'Unknown cache error'
        });
      })
  );
});

async function prefetch(urls) {
  const cache = await caches.open(API_CACHE);
  let cached = 0;
  let failed = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response.clone());
          cached += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    })
  );
  return { cached, failed };
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (err) {
    const cache = await caches.open(APP_SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    const indexFallback = await cache.match('/index.html');
    if (indexFallback) {
      return indexFallback;
    }
    throw err;
  }
}
