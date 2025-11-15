/**
 * Service Worker pour Santé Rurale PWA
 *
 * Fonctionnalités:
 * - Cache des assets statiques (CSS, JS, images, fonts)
 * - Cache des pages HTML pour navigation offline
 * - Stratégie Network First pour les requêtes API
 * - Mise à jour automatique du cache
 */

const CACHE_NAME = 'sante-rurale-v1';
const STATIC_CACHE = 'sante-rurale-static-v1';
const API_CACHE = 'sante-rurale-api-v1';

// Fichiers à mettre en cache lors de l'installation
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo.png',
  '/offline.html'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Cache statique ouvert');
        // Ajouter les assets statiques au cache (sans bloquer si certains échouent)
        return cache.addAll(STATIC_ASSETS.filter(url => url !== '/offline.html'))
          .catch((err) => {
            console.warn('[SW] Certains assets n\'ont pas pu être mis en cache:', err);
            return Promise.resolve();
          });
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        // Forcer l'activation immédiate
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Supprimer les anciens caches
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name !== CACHE_NAME &&
                     name !== STATIC_CACHE &&
                     name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Suppression ancien cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation terminée');
        // Prendre le contrôle immédiatement
        return self.clients.claim();
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }

  // Stratégie pour les requêtes API (Network First)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Stratégie pour les assets statiques (Cache First)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Stratégie pour les pages HTML (Network First avec fallback)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Par défaut: Network First
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Stratégie Cache First: Chercher d'abord dans le cache
 */
async function cacheFirstStrategy(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Retourner depuis le cache
      console.log('[SW] Cache hit:', request.url);

      // Mise à jour en arrière-plan
      fetchAndCache(request, STATIC_CACHE).catch(() => {});

      return cachedResponse;
    }

    // Si pas en cache, fetch et mettre en cache
    console.log('[SW] Cache miss:', request.url);
    const response = await fetch(request);

    if (response.ok) {
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }

    return response;
  } catch (error) {
    console.error('[SW] Erreur cache first:', error);
    return fetch(request);
  }
}

/**
 * Stratégie Network First: Réseau d'abord, cache en fallback
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Mettre en cache les réponses réussies
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

/**
 * Stratégie Network First avec page offline en fallback
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Retourner une page offline si disponible
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }

    // Dernière option: réponse basique
    return new Response(
      '<h1>Mode hors ligne</h1><p>Veuillez vous reconnecter à Internet.</p>',
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

/**
 * Fetch et mettre en cache
 */
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }

  return response;
}

/**
 * Vérifier si l'URL est un asset statique
 */
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.ico'
  ];

  return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * Écouter les messages du client
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

console.log('[SW] Service Worker chargé');
