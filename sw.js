const CACHE_NAME = 'nova-ia-shell-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './icon-512-maskable.svg'
];

const PRIVATE_PATH_RE = /\/(api|auth|login|logout|admin|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;

function isPrivateRequest(request) {
  if (request.method !== 'GET') return true;
  if (request.headers.has('authorization') || request.headers.has('cookie')) return true;
  const url = new URL(request.url);
  return url.origin !== self.location.origin || PRIVATE_PATH_RE.test(url.pathname);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (isPrivateRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  const url = new URL(request.url);
  const path = `.${url.pathname}`;
  const isShellAsset = STATIC_ASSETS.some(asset => asset === path || (asset === './' && url.pathname.endsWith('/')));
  if (!isShellAsset) return;

  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request))
  );
});
