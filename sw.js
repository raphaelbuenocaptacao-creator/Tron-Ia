const CACHE_PREFIX = 'nova-ia-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v7-raster-safe`;
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

const SHELL_PATHS = new Set(STATIC_ASSETS.map(asset => new URL(asset, self.location.href).pathname));
const PRIVATE_PATH_RE = /\/(api|auth|login|logout|admin|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;
const SENSITIVE_QUERY_KEYS = new Set([
  'token','access_token','refresh_token','password','passwd','secret','session','auth',
  'authorization','api_key','apikey','key','code','credential','credentials'
]);

function hasSensitiveQuery(url) {
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())) return true;
  }
  return false;
}

function isPrivateRequest(request, url) {
  if (request.method !== 'GET') return true;
  if (request.headers.has('authorization') || request.headers.has('cookie')) return true;
  if (request.headers.has('range') || request.headers.has('if-range')) return true;
  if (url.origin !== self.location.origin) return true;
  if (hasSensitiveQuery(url)) return true;
  return PRIVATE_PATH_RE.test(url.pathname);
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.status === 206 || response.type !== 'basic' || response.redirected) return false;
  if (response.headers.has('content-range')) return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  if (cacheControl.includes('private') || cacheControl.includes('no-store')) return false;
  if (response.headers.has('set-cookie')) return false;
  return true;
}

function isShellAsset(url) {
  return !url.search && SHELL_PATHS.has(url.pathname);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const asset of STATIC_ASSETS) {
      try {
        const request = new Request(asset, { cache: 'reload', credentials: 'omit', redirect: 'error' });
        const response = await fetch(request);
        if (isCacheableResponse(response)) await cache.put(request, response.clone());
      } catch (error) {
        console.warn('[NOVA PWA] precache skipped:', asset, error);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPrivateRequest(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store', redirect: 'error' });
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (!isShellAsset(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request, { cache: 'no-store', credentials: 'omit', redirect: 'error' });
    if (isCacheableResponse(response)) await cache.put(request, response.clone());
    return response;
  })());
});
