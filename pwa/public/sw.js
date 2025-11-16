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

  // Ignorer les requêtes non-HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Stratégie pour les requêtes API
  if (url.pathname.startsWith('/api/')) {
    // Stale-While-Revalidate pour les requêtes GET (données qui peuvent être un peu périmées)
    if (request.method === 'GET' && (
      url.pathname.includes('/patients') ||
      url.pathname.includes('/encounters') ||
      url.pathname.includes('/plans')
    )) {
      event.respondWith(safeHandler(request, () => staleWhileRevalidate(request)));
      return;
    }
    // Network First pour les autres API (POST, PUT, DELETE)
    event.respondWith(safeHandler(request, () => networkFirstStrategy(request)));
    return;
  }

  // Stratégie pour les assets statiques (Cache First)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(safeHandler(request, () => cacheFirstStrategy(request)));
    return;
  }

  // Stratégie pour les pages HTML (Network First avec fallback)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(safeHandler(request, () => networkFirstWithOfflineFallback(request)));
    return;
  }

  // Par défaut: Network First
  event.respondWith(safeHandler(request, () => networkFirstStrategy(request)));
});

/**
 * Safe Handler: Wrapper pour capturer toutes les erreurs et toujours retourner une réponse
 */
async function safeHandler(request, handler) {
  try {
    const response = await handler();
    return response;
  } catch (error) {
    console.error('[SW] Erreur dans le handler:', error);
    // Si l'erreur provient d'une stratégie, faire un fetch direct sans cache
    try {
      return await fetch(request);
    } catch (fetchError) {
      console.error('[SW] Fetch direct échoué également:', fetchError);
      // Retourner une réponse d'erreur appropriée
      return new Response(
        JSON.stringify({ error: 'Service temporairement indisponible' }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}

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
 * Stratégie Stale-While-Revalidate
 * Retourne immédiatement la version en cache (même périmée)
 * Puis met à jour le cache en arrière-plan
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);

  // Fetch en arrière-plan pour mettre à jour le cache
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      // Mettre à jour le cache avec la nouvelle réponse
      await cache.put(request, networkResponse.clone());
      console.log('[SW] SWR: Cache mis à jour:', request.url);
    }
    return networkResponse;
  }).catch(() => {
    console.warn('[SW] SWR: Échec réseau (cache utilisé):', request.url);
    return null;
  });

  // Si on a une réponse en cache, la retourner immédiatement
  if (cachedResponse) {
    console.log('[SW] SWR: Retour cache (+ update background):', request.url);
    return cachedResponse;
  }

  // Sinon, attendre la réponse réseau
  console.log('[SW] SWR: Pas de cache, attente réseau:', request.url);
  const networkResponse = await fetchPromise;

  if (networkResponse && networkResponse.ok) {
    return networkResponse;
  }

  // Si tout échoue, retourner une réponse d'erreur
  return new Response(
    JSON.stringify({ error: 'Données non disponibles offline' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
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

/**
 * Background Sync API - Synchronisation en arrière-plan
 * Permet de synchroniser les données même quand l'app est fermée
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync event:', event.tag);

  if (event.tag === 'sync-outbox') {
    event.waitUntil(syncOutbox());
  }
});

/**
 * Synchronise les opérations en attente dans l'outbox
 */
async function syncOutbox() {
  try {
    console.log('[SW] Démarrage Background Sync...');

    // Ouvrir IndexedDB pour récupérer les opérations en attente
    const db = await openIndexedDB();
    const pendingOps = await getPendingOperations(db);

    if (pendingOps.length === 0) {
      console.log('[SW] Aucune opération en attente');
      return;
    }

    console.log(`[SW] ${pendingOps.length} opérations à synchroniser`);

    // Notifier tous les clients que la sync démarre
    await notifyClients({ type: 'SYNC_STARTED', count: pendingOps.length });

    // Déclencher la synchronisation via l'API
    // On utilise fetch pour appeler un endpoint qui déclenchera le sync
    const response = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (response.ok) {
      console.log('[SW] Background Sync réussi');
      await notifyClients({ type: 'SYNC_SUCCESS', count: pendingOps.length });
    } else {
      console.error('[SW] Background Sync échoué:', response.status);
      await notifyClients({ type: 'SYNC_FAILED', error: 'Erreur serveur' });
      // Re-throw pour que le browser réessaye plus tard
      throw new Error('Sync failed');
    }
  } catch (error) {
    console.error('[SW] Erreur Background Sync:', error);
    await notifyClients({ type: 'SYNC_FAILED', error: error.message });
    // Re-throw pour que le browser réessaye plus tard
    throw error;
  }
}

/**
 * Ouvre la base de données IndexedDB
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SanteRurale', 2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Récupère les opérations en attente depuis IndexedDB
 */
function getPendingOperations(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['outbox'], 'readonly');
    const store = transaction.objectStore('outbox');
    const index = store.index('processed');
    const request = index.getAll(0); // processed = 0 (false)

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Notifie tous les clients (onglets ouverts)
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage(message);
  });
}

console.log('[SW] Service Worker chargé avec Background Sync');
