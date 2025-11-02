# Guide Synchronisation Offline-First - Santé Rurale

Guide complet de l'architecture et du fonctionnement de la synchronisation offline-first.

## 📋 Table des Matières
1. [Architecture](#architecture)
2. [Fonctionnement](#fonctionnement)
3. [Composants](#composants)
4. [Utilisation](#utilisation)
5. [Tests](#tests)
6. [Dépannage](#dépannage)

---

## Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────┐
│                   Application PWA                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐           ┌──────────────┐        │
│  │   UI/Pages  │────────▶│  API Service  │        │
│  └─────────────┘           └──────┬───────┘        │
│                                    │                 │
│                           ┌────────▼────────┐       │
│                           │  Sync Service   │       │
│                           └────────┬────────┘       │
│                                    │                 │
│                    ┌───────────────┼────────┐       │
│                    │               │        │       │
│            ┌───────▼──────┐ ┌─────▼────┐  │       │
│            │  IndexedDB   │ │  Outbox  │  │       │
│            │   (Dexie)    │ │  Queue   │  │       │
│            └──────────────┘ └──────────┘  │       │
│                                            │       │
└────────────────────────────────────────────┼───────┘
                                             │
                                    ┌────────▼────────┐
                                    │  FastAPI Backend│
                                    │   PostgreSQL    │
                                    └─────────────────┘
```

### Stratégie Offline-First

1. **Écriture locale immédiate** (Optimistic UI)
   - Toutes les créations/modifications sont d'abord sauvegardées localement
   - L'interface se met à jour instantanément
   - Meilleure expérience utilisateur

2. **Outbox Pattern**
   - Les opérations sont ajoutées à une queue (outbox)
   - Chaque opération a une clé d'idempotence
   - Garantit qu'une opération n'est exécutée qu'une seule fois

3. **Synchronisation bidirectionnelle**
   - **Push**: Envoi des modifications locales vers le serveur
   - **Pull**: Récupération des données du serveur
   - Automatique en arrière-plan

4. **Gestion des conflits**
   - Utilisation de numéros de version
   - Le serveur fait autorité en cas de conflit

---

## Fonctionnement

### 1. Création d'une Donnée (Exemple: Consultation)

```typescript
// 1. Création locale immédiate
const encounter = {
  id: uuidv4(), // ID temporaire
  patient_id: patientId,
  date: '2025-11-02',
  motif: 'Fièvre',
  _synced: false, // Marquer comme non synchronisé
}

// 2. Sauvegarde dans IndexedDB
await db.encounters.add(encounter)

// 3. Ajout à l'outbox
await db.addToOutbox('create', 'encounter', encounter)

// 4. Synchronisation automatique en arrière-plan
// Si online, l'opération est envoyée au serveur
// Si offline, elle reste dans la queue
```

### 2. Synchronisation Automatique

Le service de synchronisation s'exécute:
- **Toutes les 2 minutes** (configurable)
- **Lors du retour en ligne** (détection automatique)
- **Manuellement** via le bouton de sync

```typescript
// Cycle de synchronisation
async sync() {
  1. Vérifier la connectivité
  2. Récupérer les opérations en attente (outbox)
  3. Pour chaque opération:
     - Envoyer au serveur avec idempotency key
     - Mettre à jour l'ID local si nécessaire
     - Marquer comme _synced: true
     - Supprimer de l'outbox
  4. Récupérer les nouvelles données du serveur
  5. Mettre à jour IndexedDB
}
```

### 3. Détection de Connectivité

```typescript
// Écoute des événements navigateur
window.addEventListener('online', handleOnline)
window.addEventListener('offline', handleOffline)

// Vérification active
await fetch('/api/health', { timeout: 3000 })
```

---

## Composants

### 1. Base de Données (db/index.ts)

**IndexedDB avec Dexie**:
- `patients` - Patients
- `encounters` - Consultations
- `conditions` - Diagnostics
- `medication_requests` - Prescriptions
- `procedures` - Actes médicaux
- `references` - Références
- `outbox` - Queue de synchronisation
- `sync_meta` - Métadonnées de sync

**Méthodes clés**:
```typescript
// Recherche locale
db.searchPatients(query)

// Ajout à l'outbox
db.addToOutbox(operation, entity, payload)

// Opérations en attente
db.getPendingOperations()

// Compte non synchronisés
db.getUnsyncedCount()
```

### 2. Service de Synchronisation (services/syncService.ts)

**SyncService**:
- Gère la synchronisation bidirectionnelle
- Traite les opérations de l'outbox
- Récupère les données du serveur
- Gère les erreurs et les retries

**ConnectivityMonitor**:
- Surveille la connectivité réseau
- Notifie les changements online/offline
- Vérifie la connectivité réelle (ping API)

### 3. Hooks React (hooks/useSync.ts)

```typescript
// Surveiller le statut
const status = useSyncStatus()
// { isOnline, isSyncing, lastSync, pendingOperations }

// Connectivité
const isOnline = useOnlineStatus()

// Déclencher une sync
const { sync, isSyncing } = useSync()
await sync()
```

### 4. Contexte Global (contexts/SyncContext.tsx)

Fournit l'état de synchronisation à toute l'application:

```typescript
<SyncProvider>
  <App />
</SyncProvider>

// Dans les composants
const { isOnline, isSyncing, forceSync } = useSync()
```

### 5. Composant UI (components/SyncIndicator.tsx)

Indicateur visuel en bas à droite:
- ✅ Point vert = En ligne
- 🟠 Point orange = Hors ligne
- ⏳ Spinner = Synchronisation en cours
- 🔢 Badge = Nombre d'opérations en attente

---

## Utilisation

### Dans un Composant

```typescript
import { offlineWrite } from '../services/syncService'
import { db } from '../db'
import { v4 as uuidv4 } from 'uuid'

// Créer une consultation offline-first
const createEncounter = async (data) => {
  const encounter = {
    id: uuidv4(),
    ...data,
    _synced: false,
    created_at: new Date().toISOString(),
  }

  await offlineWrite(
    'create',
    'encounter',
    encounter,
    async () => {
      // Écriture locale
      await db.encounters.add(encounter)
    }
  )

  // L'interface est mise à jour immédiatement
  // La sync se fait en arrière-plan
}
```

### Lecture des Données

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

// Lecture réactive depuis IndexedDB
const patients = useLiveQuery(
  () => db.patients
    .where('site_id')
    .equals(currentSite)
    .toArray()
)

// Toujours à jour, même offline
```

### Forcer une Synchronisation

```typescript
import { useSync } from '../contexts/SyncContext'

const MyComponent = () => {
  const { forceSync, isSyncing } = useSync()

  return (
    <button
      onClick={forceSync}
      disabled={isSyncing}
    >
      {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
    </button>
  )
}
```

---

## Tests

### Test 1: Mode Offline Complet

1. Ouvrir l'application en ligne
2. Ouvrir DevTools → Network → Offline
3. Créer un nouveau patient
4. Créer une consultation
5. Vérifier que tout fonctionne localement
6. Revenir Online
7. Attendre la synchronisation automatique
8. Vérifier que les données sont sur le serveur

### Test 2: Connectivité Intermittente

1. Créer plusieurs enregistrements
2. Couper/Rétablir la connexion plusieurs fois
3. Vérifier que toutes les données finissent par se synchroniser
4. Vérifier qu'il n'y a pas de doublons

### Test 3: Synchronisation sur Plusieurs Appareils

1. Se connecter sur 2 appareils différents
2. Créer des données sur l'appareil 1
3. Synchroniser
4. Vérifier sur l'appareil 2 après sync
5. Les données doivent apparaître

### Commandes de Debug

```javascript
// Dans la console du navigateur

// Voir les données locales
await db.patients.toArray()
await db.encounters.toArray()

// Voir l'outbox
await db.outbox.where('processed').equals(0).toArray()

// Voir les éléments non synchronisés
await db.getUnsyncedCount()

// Forcer une synchronisation
await syncService.forceSync()

// Statut de synchronisation
await syncService.getStatus()

// Vider toutes les données
await db.clearAllData()
```

---

## Dépannage

### Problème: Les données ne se synchronisent pas

**Vérifications**:
1. Vérifier la connectivité
   ```javascript
   console.log(navigator.onLine)
   await connectivityMonitor.checkConnectivity()
   ```

2. Vérifier l'outbox
   ```javascript
   const pending = await db.getPendingOperations()
   console.log('Operations en attente:', pending)
   ```

3. Vérifier les erreurs
   ```javascript
   const ops = await db.outbox.toArray()
   ops.forEach(op => {
     if (op.last_error) {
       console.error('Operation failed:', op.entity, op.last_error)
     }
   })
   ```

4. Forcer la synchronisation
   ```javascript
   const result = await syncService.forceSync()
   console.log('Sync result:', result)
   ```

### Problème: Erreurs d'authentification

Si les tokens JWT sont expirés:
1. Le système renouvelle automatiquement le token
2. Si le refresh échoue, l'utilisateur est déconnecté
3. Les données restent en local
4. Reconnexion → sync automatique

### Problème: Données en double

Causes possibles:
- Opération sans idempotency key
- Retry sans vérification
- Bug dans le serveur

**Solution**:
```javascript
// Nettoyer les doublons (exemple pour consultations)
const encounters = await db.encounters.toArray()
const grouped = encounters.reduce((acc, e) => {
  const key = `${e.patient_id}_${e.date}_${e.motif}`
  if (!acc[key] || e.created_at > acc[key].created_at) {
    acc[key] = e
  }
  return acc
}, {})

// Supprimer les doublons
const toKeep = Object.values(grouped)
await db.encounters.clear()
await db.encounters.bulkAdd(toKeep)
```

### Problème: Quota dépassé (IndexedDB plein)

```javascript
// Vérifier la taille
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate()
  console.log('Usage:', estimate.usage / 1024 / 1024, 'MB')
  console.log('Quota:', estimate.quota / 1024 / 1024, 'MB')
}

// Nettoyer les anciennes opérations
await db.cleanupOldOperations()

// Supprimer les pièces jointes anciennes
await db.attachments
  .where('created_at')
  .below(oneYearAgo)
  .delete()
```

---

## Performance

### Optimisations Implémentées

1. **Indexes sur IndexedDB**
   - Recherches rapides par nom, téléphone, village
   - Index composites pour queries complexes

2. **Lazy Loading**
   - Chargement à la demande des détails
   - Pagination des listes

3. **Batch Operations**
   - Groupement des opérations de sync
   - Réduction des requêtes réseau

4. **Caching Intelligent**
   - Données fraîchement synchronisées gardées en cache
   - Invalidation automatique

### Métriques à Surveiller

- **Temps de sync**: Devrait être < 10s pour 1000 enregistrements
- **Taille IndexedDB**: Alerte si > 80% du quota
- **Opérations en attente**: Alerte si > 100

---

## Évolutions Futures

### Court terme
- [ ] Compression des données avant sync
- [ ] Delta sync (seulement les changements)
- [ ] Résolution automatique de certains conflits

### Moyen terme
- [ ] Sync des pièces jointes
- [ ] Sync sélective par type de données
- [ ] Background sync avec Service Workers

### Long terme
- [ ] CRDTs pour résolution de conflits
- [ ] P2P sync entre appareils locaux
- [ ] Sync différentielle optimisée

---

## Ressources

- [Dexie.js Documentation](https://dexie.org/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Offline-First Patterns](https://offlinefirst.org/)
- [Service Workers](https://developers.google.com/web/fundamentals/primers/service-workers)

---

**Dernière mise à jour**: 2 Novembre 2025
**Version**: 1.0.0
