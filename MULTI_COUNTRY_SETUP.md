# Configuration Multi-Pays - Santé Rurale

Guide pour adapter l'application Santé Rurale à différents contextes géographiques.

---

## 🌍 Vue d'ensemble

Santé Rurale est conçu pour être facilement adaptable à différents pays et contextes. Le système de configuration permet de personnaliser :

- **Nomenclature administrative** (Régions, Districts, Sites)
- **Langues** et traductions
- **Formats** (téléphone, devise, fuseau horaire)
- **Intégrations** (DHIS2, systèmes nationaux)
- **Branding** (nom, couleurs, logo)

---

## ⚙️ Configuration de Base

### 1. Choisir la région de déploiement

Éditer le fichier `.env` :

```bash
# Pour le Mali (par défaut)
VITE_DEPLOYMENT_REGION=mali

# Pour le Sénégal
VITE_DEPLOYMENT_REGION=senegal

# Pour le Burkina Faso
VITE_DEPLOYMENT_REGION=burkina

# Configuration générique
VITE_DEPLOYMENT_REGION=generic
```

### 2. Configurations disponibles

Les configurations suivantes sont pré-définies dans [`pwa/src/config/regions.ts`](pwa/src/config/regions.ts) :

| Pays | Code | Langues | Divisions | Devise | DHIS2 |
|------|------|---------|-----------|--------|-------|
| **Mali** | `mali` | Français, Bambara | Région › District › CSCOM | XOF | ✅ |
| **Sénégal** | `senegal` | Français, Wolof | Région › Département › Poste de santé | XOF | ✅ |
| **Burkina Faso** | `burkina` | Français, Mooré | Région › Province › CSPS | XOF | ✅ |
| **Niger** | `niger` | Français, Haoussa | Région › Département › Case de santé | XOF | ✅ |
| **Générique** | `generic` | Français, Anglais | Région › District › Centre de santé | USD | ❌ |

---

## 🆕 Ajouter un Nouveau Pays

### Étape 1 : Créer la configuration

Éditer [`pwa/src/config/regions.ts`](pwa/src/config/regions.ts) :

```typescript
export const REGION_CONFIGS: Record<string, RegionConfig> = {
  // ... configurations existantes ...

  // Nouvelle configuration pour la Côte d'Ivoire
  'cotedivoire': {
    country: 'Côte d\'Ivoire',
    countryCode: 'CI',
    languages: ['fr'],
    defaultLanguage: 'fr',
    divisions: {
      level1: 'District Sanitaire',
      level2: 'Aire de Santé',
      level3: 'ESPC' // Établissement Sanitaire de Premier Contact
    },
    phoneFormat: '+225 XX XX XX XX XX',
    phoneExample: '+225 07 12 34 56 78',
    dhis2: {
      enabled: true,
      endpoint: process.env.VITE_DHIS2_ENDPOINT,
      orgUnitLevel: 3
    },
    currency: 'XOF',
    timezone: 'Africa/Abidjan'
  }
}
```

### Étape 2 : Configurer l'environnement

Créer un fichier `.env.cotedivoire` :

```bash
VITE_DEPLOYMENT_REGION=cotedivoire
VITE_API_URL=https://api.sante-ci.health
VITE_DHIS2_ENDPOINT=https://dhis2.sante.gouv.ci
VITE_ENABLE_DHIS2_EXPORT=true
```

### Étape 3 : Créer les données de base

Créer un script de seed spécifique [`api/scripts/seed_cotedivoire.py`](api/scripts/seed_cotedivoire.py) :

```python
BASE_DATA = {
    "regions": [
        {"nom": "District d'Abidjan", "code": "ABJ"},
        {"nom": "District de Yamoussoukro", "code": "YAM"},
        # ... autres districts
    ],
    "districts": {
        "District d'Abidjan": [
            {"nom": "Aire de Santé Cocody", "code": "ABJ-COC"},
            # ... autres aires
        ]
    },
    "sites": {
        "Aire de Santé Cocody": [
            {
                "nom": "ESPC Cocody Centre",
                "type": "espc",
                "village": "Cocody",
                "telephone": "+225 07 12 34 56 78"
            }
        ]
    }
}
```

### Étape 4 : Build et déploiement

```bash
# Build avec la config Côte d'Ivoire
cp .env.cotedivoire .env
npm run build

# Déployer
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🌐 Traductions et Langues

### Ajouter une nouvelle langue

1. **Créer le fichier de traduction** :

```typescript
// pwa/src/i18n/bm.ts (Bambara)
export const bm = {
  common: {
    save: "Mara",
    cancel: "Dabila",
    delete: "Bɔ",
    edit: "Yɛlɛma",
    search: "Ɲini"
  },
  patients: {
    title: "Banabagatɔw",
    add: "Banabagatɔ kura fara",
    // ... autres traductions
  }
}
```

2. **Configurer i18n** :

```typescript
// pwa/src/i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { fr } from './fr'
import { bm } from './bm'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      bm: { translation: bm }
    },
    lng: 'fr',
    fallbackLng: 'fr'
  })
```

3. **Utiliser dans les composants** :

```typescript
import { useTranslation } from 'react-i18next'

function PatientList() {
  const { t } = useTranslation()

  return (
    <h1>{t('patients.title')}</h1>
  )
}
```

---

## 📱 Formats Locaux

### Format de téléphone

La validation et le formatage du téléphone s'adaptent automatiquement :

```typescript
import { useRegionConfig } from '@/config/regions'

function PhoneInput() {
  const config = useRegionConfig()

  return (
    <input
      type="tel"
      placeholder={config.phoneExample}
      pattern={config.phoneFormat.replace(/X/g, '\\d')}
    />
  )
}
```

### Format de date et heure

```typescript
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useRegionConfig } from '@/config/regions'

function formatDate(date: Date) {
  const config = useRegionConfig()
  const locale = config.defaultLanguage === 'fr' ? fr : enUS

  return format(date, 'PPP', { locale })
}
```

---

## 🔌 Intégrations DHIS2

### Configuration par pays

Chaque pays peut avoir sa propre instance DHIS2 :

```typescript
// Configuration dans regions.ts
dhis2: {
  enabled: true,
  endpoint: process.env.VITE_DHIS2_ENDPOINT,
  orgUnitLevel: 3 // Niveau organisationnel pour le mapping
}
```

### Variables d'environnement

```bash
# .env.mali
VITE_DHIS2_ENDPOINT=https://dhis2.sante.gov.ml
VITE_DHIS2_USERNAME=admin
VITE_DHIS2_PASSWORD=***

# .env.senegal
VITE_DHIS2_ENDPOINT=https://dhis2.sante.gouv.sn
```

---

## 🎨 Branding Personnalisé

### Nom de l'application

```bash
# .env
VITE_APP_NAME=Santé Rurale Mali
VITE_THEME_COLOR=#10b981
```

### Logo et favicon

Remplacer les fichiers dans `pwa/public/` :

- `favicon.svg` : Icône du navigateur
- `logo.png` : Logo de l'application
- `apple-touch-icon.png` : Icône iOS
- `manifest.json` : Configuration PWA

```json
{
  "name": "Santé Rurale Mali",
  "short_name": "Santé ML",
  "theme_color": "#10b981",
  "icons": [
    {
      "src": "/logo-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

---

## 🧪 Tests Multi-Pays

### Tester plusieurs configurations

```bash
# Test Mali
VITE_DEPLOYMENT_REGION=mali npm run dev

# Test Sénégal
VITE_DEPLOYMENT_REGION=senegal npm run dev

# Test générique
VITE_DEPLOYMENT_REGION=generic npm run dev
```

### Vérification automatique

```typescript
// test/config.test.ts
import { describe, it, expect } from 'vitest'
import { REGION_CONFIGS } from '@/config/regions'

describe('Multi-country configuration', () => {
  it('should have valid phone formats', () => {
    Object.values(REGION_CONFIGS).forEach(config => {
      expect(config.phoneFormat).toMatch(/^\+\d+/)
    })
  })

  it('should have valid timezones', () => {
    Object.values(REGION_CONFIGS).forEach(config => {
      expect(Intl.supportedValuesOf('timeZone')).toContain(config.timezone)
    })
  })
})
```

---

## 📊 Données de Référence

### Import de données nationales

Pour importer les divisions administratives depuis une source externe :

```python
# api/scripts/import_admin_divisions.py
import requests
import json

def import_from_dhis2(country_code: str):
    """Importe les unités organisationnelles depuis DHIS2"""
    dhis2_url = f"https://dhis2.{country_code}/api/organisationUnits"

    response = requests.get(
        dhis2_url,
        auth=(username, password),
        params={'level': 3, 'paging': False}
    )

    for org_unit in response.json()['organisationUnits']:
        # Créer région/district/site correspondant
        ...
```

---

## 🚀 Déploiement Multi-Instance

### Héberger plusieurs pays

**Option 1 : Sous-domaines par pays**

```
https://ml.sante-rurale.health  → Mali
https://sn.sante-rurale.health  → Sénégal
https://bf.sante-rurale.health  → Burkina Faso
```

**Option 2 : Instances séparées**

Chaque pays a son infrastructure dédiée :

```bash
# Serveur Mali
docker-compose -f docker-compose.mali.yml up -d

# Serveur Sénégal
docker-compose -f docker-compose.senegal.yml up -d
```

---

## 📞 Support

Pour ajouter un nouveau pays ou personnaliser une configuration :

- 📧 Email : support@sante-rurale.health
- 💬 GitHub Discussions : [Demande de configuration](https://github.com/your-org/sante-rurale/discussions)
- 📝 Documentation complète : [docs.sante-rurale.health](https://docs.sante-rurale.health)

---

**Dernière mise à jour** : 2 Novembre 2025
**Version** : 1.0.0
