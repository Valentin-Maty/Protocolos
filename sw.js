/* ===== SERVICE WORKER ===== */

const CACHE_NAME = 'tumatch-protocolo-v1.0.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/Inicio.html',
    '/css/variables.css',
    '/css/base.css',
    '/css/components.css',
    '/css/layout.css',
    '/js/utils.js',
    '/js/search.js',
    '/js/modal.js',
    '/js/main.js',
    '/manifest.json',
    // Add other critical assets
];

// Assets to cache on first request
const DYNAMIC_ASSETS_PATTERNS = [
    /\.html$/,
    /\.css$/,
    /\.js$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.svg$/,
    /\.webp$/
];

// Network-first patterns (always try network first)
const NETWORK_FIRST_PATTERNS = [
    /\/api\//,
    /googleapis\.com/,
    /googleusercontent\.com/,
    /youtube\.com/,
    /docs\.google\.com/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Install event');
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(STATIC_CACHE);
                console.log('Service Worker: Caching static assets');
                await cache.addAll(STATIC_ASSETS);
                
                // Force activate new service worker
                self.skipWaiting();
            } catch (error) {
                console.error('Service Worker: Install failed', error);
            }
        })()
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activate event');
    
    event.waitUntil(
        (async () => {
            try {
                // Clean up old caches
                const cacheNames = await caches.keys();
                const deletePromises = cacheNames
                    .filter(name => name.startsWith('tumatch-protocolo-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map(name => {
                        console.log('Service Worker: Deleting old cache', name);
                        return caches.delete(name);
                    });
                
                await Promise.all(deletePromises);
                
                // Take control of all clients
                self.clients.claim();
            } catch (error) {
                console.error('Service Worker: Activation failed', error);
            }
        })()
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extensions
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
    const url = new URL(request.url);
    
    try {
        // Network-first strategy for external APIs
        if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.href))) {
            return await networkFirst(request);
        }
        
        // Cache-first strategy for static assets
        if (STATIC_ASSETS.includes(url.pathname) || url.origin === location.origin) {
            return await cacheFirst(request);
        }
        
        // Network-first with cache fallback for everything else
        return await networkFirst(request);
        
    } catch (error) {
        console.error('Service Worker: Fetch failed', error);
        
        // Return offline fallback if available
        return await getOfflineFallback(request);
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
        // Update cache in background
        updateCacheInBackground(request, cache);
        return cached;
    }
    
    // Not in cache, try network
    const response = await fetch(request);
    
    if (response.ok) {
        cache.put(request, response.clone());
    }
    
    return response;
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok && shouldCache(request)) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        // Network failed, try cache
        const cached = await getCachedResponse(request);
        if (cached) {
            return cached;
        }
        
        throw error;
    }
}

async function updateCacheInBackground(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
    } catch (error) {
        // Silently fail background updates
        console.log('Service Worker: Background update failed', error.message);
    }
}

async function getCachedResponse(request) {
    // Try static cache first
    let cache = await caches.open(STATIC_CACHE);
    let cached = await cache.match(request);
    
    if (cached) return cached;
    
    // Try dynamic cache
    cache = await caches.open(DYNAMIC_CACHE);
    cached = await cache.match(request);
    
    return cached;
}

function shouldCache(request) {
    const url = new URL(request.url);
    
    // Don't cache external APIs
    if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.href))) {
        return false;
    }
    
    // Cache assets that match our patterns
    return DYNAMIC_ASSETS_PATTERNS.some(pattern => pattern.test(url.pathname));
}

async function getOfflineFallback(request) {
    const url = new URL(request.url);
    
    // HTML pages - return cached main page
    if (request.headers.get('accept')?.includes('text/html')) {
        const cached = await getCachedResponse(new Request('/Inicio.html'));
        if (cached) return cached;
    }
    
    // Images - return placeholder or cached version
    if (request.headers.get('accept')?.includes('image')) {
        const cached = await getCachedResponse(request);
        if (cached) return cached;
        
        // Return SVG placeholder
        return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
                <rect width="200" height="150" fill="#f0f0f0"/>
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">
                    Sin conexión
                </text>
            </svg>`,
            {
                headers: {
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'no-cache'
                }
            }
        );
    }
    
    // Return generic offline response
    return new Response('Contenido no disponible sin conexión', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
            'Content-Type': 'text/plain',
        }
    });
}

// Handle background sync
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    // Implement background sync logic here
    // For example, sync user data when connection is restored
    console.log('Service Worker: Performing background sync');
}

// Handle push notifications (if needed in future)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'tumatch-notification',
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Abrir',
                icon: '/icons/icon-open.png'
            },
            {
                action: 'close',
                title: 'Cerrar',
                icon: '/icons/icon-close.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Skip waiting on message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Cleanup function for cache management
async function cleanupCaches() {
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const requests = await dynamicCache.keys();
    
    // Remove old entries if cache is getting too large
    if (requests.length > 50) {
        const oldRequests = requests.slice(0, 10);
        await Promise.all(oldRequests.map(request => dynamicCache.delete(request)));
    }
}

// Run cleanup periodically
setInterval(cleanupCaches, 24 * 60 * 60 * 1000); // Once per day