const CACHE_NAME='nova-ia-v1';
const STATIC_ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./icon-512-maskable.svg'];
const PRIVATE_PATH_RE=/\/(api|auth|login|logout|admin|session|sessions|token|tokens|account|profile|me)(\/|$)/i;
function cacheable(request){if(request.method!=='GET'||request.headers.has('authorization'))return false;const url=new URL(request.url);return url.origin===self.location.origin&&!PRIVATE_PATH_RE.test(url.pathname);}
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC_ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{const r=event.request;if(!cacheable(r))return;if(r.mode==='navigate'){event.respondWith(fetch(r).then(res=>{if(res.ok&&res.type==='basic')caches.open(CACHE_NAME).then(c=>c.put(r,res.clone()));return res;}).catch(()=>caches.match(r).then(hit=>hit||caches.match('./'))));return;}event.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok&&res.type==='basic')caches.open(CACHE_NAME).then(c=>c.put(r,res.clone()));return res;})));});
