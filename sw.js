const CACHE_NAME = 'nova-ia-shell-v3-safe';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './icon-512-maskable.svg'
];

const PRIVATE_PATH_RE = /\/(api|auth|login|logout|admin|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;
const SENSITIVE_QUERY_KEYS = new Set([
  'token','access_token','refresh_token','password','secret','session','auth',
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
  if (url.origin !== self.location.origin) return true;
  if (hasSensitiveQuery(url)) return true;
  return PRIVATE_PATH_RE.test(url.pathname);
}

function isShellAsset(url) {
  if (url.search) return false;
  const path = `.${url.pathname}`;
  return STATIC_ASSETS.some(asset => asset === path || (asset === './' && url.pathname.endsWith('/')));
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPrivateRequest(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  if (!isShellAsset(url)) return;

  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request, { cache: 'no-cache' }).then(response => {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
