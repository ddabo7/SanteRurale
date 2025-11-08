# Migration vers une authentification sécurisée avec cookies HttpOnly

## ⚠️ Problème de sécurité identifié

L'application stockait les JWT tokens (access_token et refresh_token) dans le **localStorage**, ce qui est une vulnérabilité de sécurité majeure :

- ❌ **Vulnérable aux attaques XSS** : Tout script malveillant peut accéder au localStorage
- ❌ **Tokens exposés** : Les tokens sont lisibles dans les Dev Tools
- ❌ **Pas de protection** : Aucune protection contre le vol de tokens

## ✅ Solution implémentée : Cookies HttpOnly

Les tokens JWT sont maintenant stockés dans des **cookies HttpOnly sécurisés** :

- ✅ **Protection XSS** : JavaScript ne peut pas accéder aux cookies HttpOnly
- ✅ **Cookies sécurisés** : HTTPS uniquement en production (secure flag)
- ✅ **SameSite** : Protection contre les attaques CSRF
- ✅ **Expiration automatique** : max-age configuré pour chaque type de token

### Configuration des cookies (Backend)

```python
# /api/app/routers/auth.py
COOKIE_SECURE = False  # En développement (localhost sans HTTPS)
COOKIE_SECURE = True   # En production (avec HTTPS)
COOKIE_HTTPONLY = True  # JavaScript ne peut pas accéder
COOKIE_SAMESITE = "lax"  # Protection CSRF
COOKIE_MAX_AGE_ACCESS = 3600  # 1 heure
COOKIE_MAX_AGE_REFRESH = 2592000  # 30 jours
```

## 🔧 Modifications apportées

### Backend (✅ Complété)

1. **`/api/app/routers/auth.py`**
   - ✅ Ajout de `Response` dans les imports
   - ✅ Configuration des cookies sécurisés
   - ✅ Modification de `/auth/login` pour définir les cookies
   - ✅ Ajout de `/auth/logout` pour supprimer les cookies

2. **`/api/app/security.py`**
   - ✅ Modification de `get_current_user()` pour lire le token depuis les cookies
   - ✅ Fallback vers le header Authorization pour rétrocompatibilité
   - ✅ Suppression des logs de debug

### Frontend (❌ À faire)

**IMPORTANT** : Le frontend doit être modifié pour ne plus utiliser localStorage

#### 1. AuthContext (`/pwa/src/contexts/AuthContext.tsx`)

**À SUPPRIMER** :
```typescript
// ❌ SUPPRIMER toutes ces lignes
localStorage.setItem('access_token', access_token)
localStorage.setItem('refresh_token', refresh_token)
localStorage.setItem('user', JSON.stringify(normalizedUser))
localStorage.removeItem('access_token')
localStorage.removeItem('refresh_token')
localStorage.removeItem('user')
const legacyToken = localStorage.getItem('access_token')
```

**À GARDER** :
- Stocker uniquement les informations utilisateur dans IndexedDB (PAS les tokens)
- Les cookies HttpOnly sont automatiquement envoyés avec chaque requête

#### 2. authService (`/pwa/src/services/authService.ts`)

**À MODIFIER** :
```typescript
// ❌ AVANT
const accessToken = localStorage.getItem('access_token')
headers: {
  'Authorization': `Bearer ${accessToken}`,
}

// ✅ APRÈS - Les cookies sont automatiquement envoyés
headers: {
  'Content-Type': 'application/json',
},
credentials: 'include',  // Important ! Envoie les cookies
```

#### 3. SubscriptionPage (`/pwa/src/pages/SubscriptionPage.tsx`)

**À MODIFIER** :
```typescript
// ❌ SUPPRIMER
const accessToken = localStorage.getItem('access_token')

// ✅ AJOUTER credentials: 'include'
const response = await fetch(`${API_BASE_URL}/endpoint`, {
  credentials: 'include',  // Envoie automatiquement les cookies
  headers: {
    'Content-Type': 'application/json',
  }
})
```

## 📋 Plan de migration Frontend

### Étape 1 : Nettoyer AuthContext
```typescript
// Supprimer toutes les références à localStorage pour les tokens
// Garder uniquement le stockage dans IndexedDB pour les données utilisateur (sans tokens)

const login = async (email: string, password: string) => {
  const response = await authService.login(email, password)

  // ❌ NE PLUS FAIRE ÇA
  // localStorage.setItem('access_token', response.access_token)

  // ✅ FAIRE ÇA
  // Les cookies sont automatiquement définis par le serveur
  setUser(response.user)

  // Sauvegarder dans IndexedDB (sans les tokens)
  await db.user_session.add({
    user_id: response.user.id,
    email: response.user.email,
    // ... autres données utilisateur
    // PAS de access_token ni refresh_token
  })
}
```

### Étape 2 : Modifier authService
```typescript
updateProfile: async (data) => {
  // ❌ NE PLUS FAIRE ÇA
  // const accessToken = localStorage.getItem('access_token')

  // ✅ FAIRE ÇA
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: 'PATCH',
    credentials: 'include',  // Envoie automatiquement les cookies
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return await response.json()
}
```

### Étape 3 : Ajouter credentials: 'include' partout
```typescript
// Dans TOUTES les requêtes fetch(), ajouter :
credentials: 'include'
```

### Étape 4 : Modifier logout
```typescript
const logout = async () => {
  // Appeler l'endpoint logout du backend
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  // ❌ NE PLUS FAIRE ÇA
  // localStorage.removeItem('access_token')

  // ✅ FAIRE ÇA
  setUser(null)
  await db.user_session.clear()
}
```

### Étape 5 : Nettoyer le code legacy
```bash
# Rechercher et supprimer tous les usages de :
grep -r "localStorage.getItem('access_token')" pwa/src/
grep -r "localStorage.setItem('access_token')" pwa/src/
grep -r "localStorage.removeItem('access_token')" pwa/src/
```

## 🎯 Avantages de cette approche

1. **Sécurité renforcée** : Les tokens ne sont plus accessibles au JavaScript
2. **Protection XSS** : Les cookies HttpOnly protègent contre les scripts malveillants
3. **Simplicité** : Plus besoin de gérer manuellement les headers Authorization
4. **Automatique** : Les cookies sont automatiquement envoyés avec chaque requête

## ⚡ Migration progressive

Le backend actuel supporte **les deux méthodes** :
1. ✅ Cookies HttpOnly (nouvelle méthode sécurisée)
2. ✅ Header Authorization (ancienne méthode pour rétrocompatibilité)

Cela permet de migrer progressivement le frontend sans casser l'application.

## 🚀 Prochaines étapes

1. ✅ Backend modifié (fait)
2. ❌ Modifier AuthContext pour supprimer localStorage
3. ❌ Modifier authService pour utiliser credentials: 'include'
4. ❌ Ajouter credentials: 'include' dans toutes les requêtes
5. ❌ Tester la connexion/déconnexion
6. ❌ Supprimer la rétrocompatibilité du backend une fois la migration complète

## 📝 Notes importantes

- En développement (localhost), `secure=False` pour fonctionner sans HTTPS
- En production, `secure=True` pour forcer HTTPS
- Les cookies sont définis avec `SameSite=lax` pour un bon équilibre sécurité/UX
- Les tokens expirent automatiquement (1h pour access, 30j pour refresh)
