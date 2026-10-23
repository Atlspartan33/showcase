// Offline play (only active over https). App code: network-first with a 3 s timeout so updates land but weak
// Wi-Fi falls back to the cache. The pinned three.js / Rapier CDN files are precached and cache-first.
// Only successful responses are ever stored, so a CDN hiccup can't get stuck in the cache.
const CACHE = 'chain-reaction-v3';
const CDN = 'https://cdn.jsdelivr.net/npm/';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'js/main.js', 'js/pieces.js', 'js/physics.js', 'js/levels.js',
  'js/render.js', 'js/audio.js', 'js/science.js', 'js/fx3d.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  CDN + 'three@0.160.0/build/three.module.js',
  CDN + 'three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js',
  CDN + 'three@0.160.0/examples/jsm/environments/RoomEnvironment.js',
  CDN + '@dimforge/rapier2d-compat@0.14.0/rapier.es.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('chain-reaction-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function store(e, res) {
  if (res && res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy))); }
  return res;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => store(e, res))));
    return;
  }
  const net = fetch(e.request).then(res => store(e, res));
  const timeout = new Promise(res => setTimeout(res, 3000));
  e.respondWith(Promise.race([net.catch(() => null), timeout])
    .then(res => (res && res.ok) ? res : caches.match(e.request).then(hit => hit || net)));
});
