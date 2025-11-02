# Changelog - Transition vers version généraliste

## 2 Novembre 2025 - Version Généraliste 1.0.0

### 🌍 Transformation en application multi-pays

L'application "Santé Rurale Mali" a été refactorisée pour devenir **"Santé Rurale"**, une solution généraliste adaptable à n'importe quel contexte géographique.

---

## 🔄 Changements Majeurs

### 1. **Renommage de l'application**

- ✅ **Ancien** : "Santé Rurale Mali" (spécifique au Mali)
- ✅ **Nouveau** : "Santé Rurale" (générique, international)

**Fichiers modifiés** :
- [README.md](README.md) - Documentation principale
- [pwa/src/components/Layout.tsx](pwa/src/components/Layout.tsx:30) - Titre de l'application
- [pwa/package.json](pwa/package.json:4) - Description du package
- [pwa/index.html](pwa/index.html:17) - Title et meta description
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Guide de déploiement
- [OFFLINE_SYNC_GUIDE.md](OFFLINE_SYNC_GUIDE.md) - Guide de synchronisation

### 2. **Documentation mise à jour**

**README.md** :
- Description généraliste : "zones rurales à connectivité limitée"
- Cas d'usage élargis : Afrique, Amérique latine, Asie, camps de réfugiés
- Utilisateurs "de démonstration" au lieu de "de production"
- Remerciements internationaux
- Git repository : `sante-rurale` (sans `-mali`)

**Autres docs** :
- Domaines d'exemple génériques (`votre-domaine.com`)
- Références au Mali transformées en exemples parmi d'autres

### 3. **Système de configuration multi-pays**

#### Nouveau fichier : [pwa/src/config/regions.ts](pwa/src/config/regions.ts)

Configuration complète pour plusieurs pays :

| Pays | Code | Langues | Structure admin | Devise |
|------|------|---------|-----------------|--------|
| Mali | `mali` | FR, Bambara | Région › District › CSCOM | XOF |
| Sénégal | `senegal` | FR, Wolof | Région › Département › Poste | XOF |
| Burkina Faso | `burkina` | FR, Mooré | Région › Province › CSPS | XOF |
| Niger | `niger` | FR, Haoussa | Région › Département › Case | XOF |
| Générique | `generic` | FR, EN | Région › District › Centre | USD |

**Fonctionnalités** :
- Configuration des divisions administratives
- Formats de téléphone locaux
- Langues supportées
- Intégration DHIS2 (optionnel)
- Devise et fuseau horaire

#### Variables d'environnement : [pwa/.env.example](pwa/.env.example)

```bash
VITE_DEPLOYMENT_REGION=mali  # ou senegal, burkina, niger, generic
VITE_COUNTRY_NAME=Mali
VITE_DHIS2_ENDPOINT=https://dhis2.example.org
```

### 4. **Guide de configuration multi-pays**

#### Nouveau document : [MULTI_COUNTRY_SETUP.md](MULTI_COUNTRY_SETUP.md)

Guide complet pour :
- ✅ Configurer un nouveau pays
- ✅ Adapter la nomenclature administrative
- ✅ Ajouter des traductions
- ✅ Personnaliser le branding
- ✅ Intégrer DHIS2 par pays
- ✅ Déployer plusieurs instances

---

## 📝 Utilisation

### Déployer pour le Mali (existant)

```bash
# .env
VITE_DEPLOYMENT_REGION=mali

# L'application utilise automatiquement :
# - Divisions : Région › District › CSCOM
# - Format téléphone : +223 XX XX XX XX
# - DHIS2 Mali
```

### Déployer pour le Sénégal

```bash
# .env
VITE_DEPLOYMENT_REGION=senegal

# L'application s'adapte automatiquement :
# - Divisions : Région › Département › Poste de santé
# - Format téléphone : +221 XX XXX XX XX
# - DHIS2 Sénégal
```

### Ajouter un nouveau pays

Voir le guide détaillé : [MULTI_COUNTRY_SETUP.md](MULTI_COUNTRY_SETUP.md)

---

## 🔍 Détails Techniques

### Hook de configuration

```typescript
import { useRegionConfig } from '@/config/regions'

function MyComponent() {
  const config = useRegionConfig()

  return (
    <div>
      <h1>{config.country}</h1>
      <p>Structure : {config.divisions.level1} › {config.divisions.level2} › {config.divisions.level3}</p>
      <input
        type="tel"
        placeholder={config.phoneExample}
      />
    </div>
  )
}
```

### Configuration dynamique

La configuration est chargée au runtime selon la variable d'environnement `VITE_DEPLOYMENT_REGION`. Pas besoin de recompiler pour changer de pays.

---

## 🎯 Impact

### Avant (Version Mali)

- ❌ Application liée au Mali uniquement
- ❌ Nomenclature fixe (Région › District › CSCOM)
- ❌ Pas de support multi-langues prévu
- ❌ DHIS2 codé en dur pour le Mali
- ❌ Difficile à adapter à d'autres pays

### Après (Version Généraliste)

- ✅ Application internationale
- ✅ Nomenclature configurable par pays
- ✅ Support multi-langues intégré
- ✅ DHIS2 configurable par déploiement
- ✅ Facile à déployer dans n'importe quel pays

---

## 📊 Compatibilité

### Rétrocompatibilité

**Le déploiement Mali existant continue de fonctionner sans modification** :
- Base de données inchangée
- Scripts de seed compatibles
- Utilisateurs existants préservés
- Configuration par défaut : `VITE_DEPLOYMENT_REGION=mali`

### Migration

Aucune migration nécessaire pour les déploiements existants. La configuration Mali est la valeur par défaut.

---

## 🚀 Prochaines Étapes

### Recommandé

1. **Tester la configuration multi-pays** :
   ```bash
   VITE_DEPLOYMENT_REGION=senegal npm run dev
   ```

2. **Créer des données de seed pour d'autres pays** :
   - Copier `api/scripts/seed_base_data.py`
   - Adapter les régions/districts/sites

3. **Ajouter des traductions** :
   - Implémenter i18n (react-i18next)
   - Traduire l'interface en Bambara, Wolof, etc.

4. **Personnaliser le branding** :
   - Logo par pays (optionnel)
   - Couleurs thème par région

### Future

- [ ] Support LOINC/SNOMED international (au-delà de CIM-10)
- [ ] Marketplace de modules par pays
- [ ] SaaS multi-tenant (une instance, plusieurs pays)
- [ ] Mobile apps natives (iOS/Android)

---

## 📞 Contact

Pour questions ou support sur la configuration multi-pays :

- 📧 Email : support@sante-rurale.health
- 💬 GitHub Issues : [github.com/your-org/sante-rurale/issues](https://github.com/your-org/sante-rurale/issues)
- 📖 Documentation : [MULTI_COUNTRY_SETUP.md](MULTI_COUNTRY_SETUP.md)

---

**Auteur** : Équipe Santé Rurale
**Date** : 2 Novembre 2025
**Version** : 1.0.0-generic
