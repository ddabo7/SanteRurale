# ============================================================================
# WORKFLOW OBLIGATOIRE DE DÉVELOPPEMENT ET DÉPLOIEMENT
# ============================================================================
# ⚠️ CE WORKFLOW DOIT TOUJOURS ÊTRE SUIVI DANS CET ORDRE EXACT
# ============================================================================

## 📋 WORKFLOW COMPLET

### 1️⃣ DÉVELOPPEMENT LOCAL (OBLIGATOIRE)
```bash
./deploy.sh dev
```
**Action:** Démarre l'environnement de développement complet
**Objectif:** Tester toutes les fonctionnalités sur http://localhost:5173
**Durée:** Autant de temps que nécessaire pour tester
**Validation:** ✅ Interface web fonctionne correctement
              ✅ Toutes les fonctionnalités testées manuellement
              ✅ Pas d'erreurs dans la console

### 2️⃣ TESTS AUTOMATISÉS (OBLIGATOIRE)
```bash
./deploy.sh test
```
**Action:** Lance tous les tests automatiques
**Objectif:** Valider que le code est prêt pour la production
**Tests effectués:**
  - ✅ Syntaxe Python
  - ✅ Build frontend
  - ✅ Variables d'environnement
  - ✅ Démarrage des containers
  - ✅ Health check API
**Si ça échoue:** NE PAS DÉPLOYER, corriger les erreurs d'abord

### 3️⃣ DÉPLOIEMENT PRODUCTION (OBLIGATOIRE)
```bash
./deploy.sh prod-remote
```
**Action:** Déploie sur le VPS Hostinger (72.61.107.217)
**Ce qui se passe automatiquement:**
  1. Confirme que tu veux déployer
  2. Lance les tests une dernière fois
  3. Push le code sur GitHub
  4. Se connecte au serveur via SSH
  5. Pull le code sur le serveur
  6. Build et déploie avec Docker
  7. Vérifie que tout fonctionne

## ⛔ RÈGLES ABSOLUES

1. **JAMAIS** déployer en prod sans avoir testé localement d'abord
2. **JAMAIS** sauter l'étape des tests (`./deploy.sh test`)
3. **TOUJOURS** vérifier l'interface web en local avant de déployer
4. **TOUJOURS** suivre l'ordre: dev → test → prod-remote

## 🚨 SI UN PROBLÈME SURVIENT

### En DEV
- Corriger le code
- Relancer `./deploy.sh dev`
- Tester à nouveau

### En TEST
- Corriger les erreurs
- Relancer `./deploy.sh dev` pour tester
- Relancer `./deploy.sh test`
- NE PAS déployer tant que les tests ne passent pas

### En PROD
- Si le déploiement échoue, les changements ne sont PAS appliqués
- Corriger localement
- Recommencer le workflow complet

## 📝 CHECKLIST AVANT DÉPLOIEMENT PROD

- [ ] `./deploy.sh dev` exécuté et interface testée
- [ ] Toutes les fonctionnalités testées manuellement
- [ ] Aucune erreur dans la console navigateur
- [ ] `./deploy.sh test` exécuté et TOUS les tests passés
- [ ] Code commité et prêt à être pushé
- [ ] Prêt à déployer avec `./deploy.sh prod-remote`

## 🎯 RÉSUMÉ EN 3 ÉTAPES

```
1. ./deploy.sh dev     → Tester l'interface web localement
2. ./deploy.sh test    → Valider automatiquement tout le code
3. ./deploy.sh prod-remote → Déployer sur le serveur VPS
```

⚠️ NE JAMAIS SAUTER UNE ÉTAPE ⚠️
