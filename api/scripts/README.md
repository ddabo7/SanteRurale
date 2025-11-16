# 🔐 Scripts d'Administration - Santé Rurale

Ce dossier contient des scripts CLI pour les tâches administratives sensibles qui **NE DOIVENT PAS** être exposées via l'API.

## ⚠️ SÉCURITÉ

**IMPORTANT**: Ces scripts doivent UNIQUEMENT être exécutés par l'administrateur système directement sur le serveur. Ils ne sont pas accessibles via l'API web.

---

## 📜 Scripts Disponibles

### `delete_all_users.py` - Supprimer tous les utilisateurs

⚠️ **ATTENTION: Script DESTRUCTIF et IRRÉVERSIBLE!**

Supprime TOUS les utilisateurs de la base de données. Utilisez ce script uniquement pour nettoyer une base de données de test ou réinitialiser complètement le système.

#### Usage

```bash
# Depuis le répertoire api/
python scripts/delete_all_users.py
```

#### En production (Docker)

```bash
# Sur le serveur de production
cd /opt/santerurale
docker exec -it sante_api_prod python scripts/delete_all_users.py
```

#### Fonctionnalités

- ✅ Liste tous les utilisateurs avant suppression
- ✅ Demande double confirmation (très importante!)
- ✅ Affiche le nombre d'utilisateurs supprimés
- ✅ Suggère les prochaines étapes après suppression

#### ⚠️ Précautions

1. **FAITES UN BACKUP** de la base de données avant d'exécuter ce script
2. Assurez-vous que vous voulez **vraiment** supprimer tous les utilisateurs
3. Cette opération est **IRRÉVERSIBLE**
4. Tapez exactement `SUPPRIMER TOUT` pour confirmer la suppression

---

### `create_admin.py` - Créer un compte administrateur

Crée un compte utilisateur avec le rôle `admin` qui a accès au dashboard administrateur global.

#### Usage

```bash
# Depuis le répertoire api/
python scripts/create_admin.py <email> <password> <nom> [prenom] [telephone]
```

#### Exemples

```bash
# Créer un admin avec email, password et nom uniquement
python scripts/create_admin.py admin@santerurale.io "MySecurePass123!" "Dabo"

# Créer un admin avec prénom
python scripts/create_admin.py admin@santerurale.io "MySecurePass123!" "Dabo" "Djibril"

# Créer un admin avec téléphone
python scripts/create_admin.py admin@santerurale.io "MySecurePass123!" "Dabo" "Djibril" "+33612345678"
```

#### En production (Docker)

```bash
# Se connecter au serveur de production
ssh user@serveur-production

# Exécuter le script dans le container API
cd /opt/santerurale
docker exec -it sante_api_prod python scripts/create_admin.py \
    admin@santerurale.io \
    "MySecurePass123!" \
    "Dabo" \
    "Djibril"
```

#### Exigences du mot de passe

- Au moins 8 caractères
- Au moins 1 majuscule
- Au moins 1 chiffre
- Au moins 1 caractère spécial (!@#$%^&*)

#### Fonctionnalités

- ✅ Vérifie que l'email n'existe pas déjà
- ✅ Valide le format du mot de passe
- ✅ Hash le mot de passe de manière sécurisée (bcrypt)
- ✅ Marque l'email comme vérifié automatiquement
- ✅ Active le compte automatiquement
- ✅ Demande confirmation avant création
- ✅ Affiche un récapitulatif après création

---

## 🔒 Rôles Protégés

Les rôles suivants **NE PEUVENT PAS** être créés via l'API `/auth/signup`:

- `admin` - Administrateur global de la plateforme
- `super_admin` - Super administrateur (réservé futur)
- `system` - Compte système (réservé)

Pour créer des comptes avec ces rôles, vous DEVEZ utiliser le script `create_admin.py`.

---

## 🛡️ Bonnes Pratiques de Sécurité

1. **Ne jamais** commiter de mots de passe dans le code
2. **Ne jamais** partager les identifiants admin par email non chiffré
3. **Toujours** utiliser un gestionnaire de mots de passe (1Password, Bitwarden, etc.)
4. **Activer** l'authentification à deux facteurs (2FA) quand disponible
5. **Changer** les mots de passe par défaut immédiatement
6. **Limiter** le nombre de comptes admin au strict minimum
7. **Auditer** régulièrement les accès admin

---

## 📝 Logs et Audit

Lors de la création d'un admin, le script affiche:
- ✅ Confirmation de création
- ID de l'utilisateur
- Email
- Nom complet
- Rôle
- Statut de vérification

**Important**: Notez ces informations dans un endroit sécurisé.

---

## ❓ Dépannage

### Erreur: "Un utilisateur avec cet email existe déjà"

Un compte avec cet email existe déjà. Vérifiez avec:

```bash
docker exec -it sante_api_prod python -c "
from app.models import User
from app.database import get_db
# ... requête pour lister les users
"
```

### Erreur: "Aucun site disponible"

Vous devez d'abord créer un site dans la base de données avant de créer des admins.

### Erreur: Module not found

Assurez-vous d'exécuter le script depuis le répertoire `api/`:

```bash
cd api/
python scripts/create_admin.py ...
```

---

## 📚 Ressources

- [Documentation FastAPI](https://fastapi.tiangolo.com)
- [Bcrypt Password Hashing](https://pypi.org/project/bcrypt/)
- [OWASP Password Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
