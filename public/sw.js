/// <reference lib="webworker" />

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;

// Cache limits
const PAGES_CACHE_MAX = 30;
const ASSETS_CACHE_MAX = 60;
const PAGES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const PRECACHE_URLS = [
  '/offline',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/brand/sublogo.png',
];

// Install: pre-cache offline page and essential assets (no auto skipWaiting)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Message listener: controlled SW updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: route requests by strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API routes — always network
  if (url.pathname.startsWith('/api/')) return;

  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // Next.js static assets — Cache First (immutable, hashed filenames)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Google Fonts — Cache First
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // Static brand/image assets — Cache First
  if (url.pathname.startsWith('/brand/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // HTML pages — Network First with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

// Cache First: check cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      trimCache(cacheName, ASSETS_CACHE_MAX);
    }
    return response;
  } catch {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

// ============================================================================
// Push Notifications
// ============================================================================

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Site do Barral';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});

// ============================================================================
// Caching Strategies
// ============================================================================

// Network First: try network, cache response, fallback to cache then offline page
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE);
      // Store with timestamp header for TTL
      const headers = new Headers(response.headers);
      headers.set('sw-cache-time', Date.now().toString());
      const timedResponse = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, timedResponse);
      trimCache(PAGES_CACHE, PAGES_CACHE_MAX);
    }
    return response;
  } catch {
    // Try cache, but check TTL for pages
    const cached = await caches.match(request);
    if (cached) {
      const cacheTime = parseInt(cached.headers.get('sw-cache-time') || '0', 10);
      if (cacheTime > 0 && Date.now() - cacheTime > PAGES_TTL_MS) {
        // Expired — still serve stale but delete from cache
        const cache = await caches.open(PAGES_CACHE);
        cache.delete(request);
      }
      return cached;
    }

    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Trim cache to max entries (delete oldest first)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Delete oldest entries (first in list)
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}
