// Vi-Di-Sef v3 — Service Worker (network-first + push notifications)
const CACHE = 'vidisef-v3-3'

self.addEventListener('install', e => {
    self.skipWaiting()
})

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return
    if (!e.request.url.startsWith(self.location.origin)) return
    if (e.request.url.includes('sw.js')) return
    if (e.request.url.includes('manifest.json')) return

    e.respondWith(
        fetch(e.request)
            .then(r => {
                if (r.ok) {
                    const clone = r.clone()
                    caches.open(CACHE).then(c => c.put(e.request, clone))
                }
                return r
            })
            .catch(() => caches.match(e.request))
    )
})

// ── Push notification click handler ──────────────────────────────────────
self.addEventListener('notificationclick', e => {
    e.notification.close()
    const url = e.notification.data?.url || '/'
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Focus existing window if found
            for (const client of list) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus()
                }
            }
            // Otherwise open new window
            return clients.openWindow(url)
        })
    )
})

// ── Push event (for future server push) ──────────────────────────────────
self.addEventListener('push', e => {
    if (!e.data) return
    try {
        const data = e.data.json()
        e.waitUntil(
            self.registration.showNotification(data.title || 'Vi-Di-Sef', {
                body: data.body || '',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                data: { url: data.url || '/' }
            })
        )
    } catch (err) {
        // Fallback for text data
        e.waitUntil(
            self.registration.showNotification('Vi-Di-Sef', {
                body: e.data.text(),
                icon: '/icon-192.png'
            })
        )
    }
})
