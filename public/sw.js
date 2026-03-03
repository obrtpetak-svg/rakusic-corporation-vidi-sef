// ═══════════════════════════════════════════════════════
// Vi-Di-Sef v3 — Service Worker
// Strategies: Cache-first for assets, Network-first for pages
// Offline fallback page when network unavailable
// ═══════════════════════════════════════════════════════

const CACHE_STATIC = 'vidisef-static-v5';
const CACHE_PAGES = 'vidisef-pages-v5';
const CACHE_FONTS = 'vidisef-fonts-v1';

// App shell — pre-cache on install for instant offline start
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// ── Install: pre-cache app shell ─────────────────────────────────────────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_STATIC).then(cache => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', e => {
    const keep = [CACHE_STATIC, CACHE_PAGES, CACHE_FONTS];
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: strategy per request type ─────────────────────────────────────
self.addEventListener('fetch', e => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Skip: non-origin, SW itself, API calls, Firestore, analytics
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('sw.js')) return;
    if (url.pathname.startsWith('/api/')) return;

    // Strategy 1: Cache-first for hashed assets (immutable)
    if (url.pathname.startsWith('/assets/')) {
        e.respondWith(cacheFirst(request, CACHE_STATIC));
        return;
    }

    // Strategy 2: Cache-first for Google Fonts
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        e.respondWith(cacheFirst(request, CACHE_FONTS));
        return;
    }

    // Strategy 3: Network-first for pages (HTML)
    e.respondWith(networkFirst(request, CACHE_PAGES));
});

// ── Cache-first: return cached, fall back to network ─────────────────────
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

// ── Network-first: try network, fall back to cache → offline page ────────
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Offline fallback: serve cached index.html for navigation requests
        if (request.mode === 'navigate') {
            const fallback = await caches.match('/index.html');
            if (fallback) return fallback;
        }

        return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline — Vi-Di-Sef</title><style>*{margin:0;font-family:system-ui}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1d23;color:#eee}.c{text-align:center;padding:2rem}.icon{font-size:4rem;margin-bottom:1rem}h1{font-size:1.5rem;margin-bottom:.5rem;color:#D95D08}p{color:#999;max-width:400px}button{margin-top:1.5rem;padding:.75rem 2rem;background:#D95D08;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer}</style></head><body><div class="c"><div class="icon">📡</div><h1>Nema internet veze</h1><p>Provjerite WiFi ili mobilne podatke pa pokušajte ponovo.</p><button onclick="location.reload()">Pokušaj ponovo</button></div></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

// ── Push notification click ──────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

// ── Push event (server push notifications) ───────────────────────────────
self.addEventListener('push', e => {
    if (!e.data) return;
    try {
        const data = e.data.json();
        e.waitUntil(
            self.registration.showNotification(data.title || 'Vi-Di-Sef', {
                body: data.body || '',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                tag: data.tag || 'vidisef-notification',
                renotify: true,
                data: { url: data.url || '/' },
            })
        );
    } catch {
        e.waitUntil(
            self.registration.showNotification('Vi-Di-Sef', {
                body: e.data.text(),
                icon: '/icon-192.png',
            })
        );
    }
});

// ── Background sync (for GPS offline queue) ──────────────────────────────
self.addEventListener('sync', e => {
    if (e.tag === 'gps-sync') {
        e.waitUntil(
            clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'FLUSH_GPS_QUEUE' }));
            })
        );
    }
});

// ── Periodic background sync (if supported) ─────────────────────────────
self.addEventListener('periodicsync', e => {
    if (e.tag === 'gps-keepalive') {
        e.waitUntil(
            clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'GPS_KEEPALIVE' }));
            })
        );
    }
});
