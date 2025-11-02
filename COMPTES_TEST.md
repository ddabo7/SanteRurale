# 🔐 Comptes de Test - Santé Rurale

## 📍 Localisation des données

Les comptes utilisateurs sont stockés dans la **base de données PostgreSQL** :
- **Conteneur Docker** : `sante_db`
- **Base de données** : `sante_rurale`
- **Table** : `users`
- **Volume Docker** : `santerurale_postgres_data`

## 👥 Comptes disponibles

### 👤 Compte 1 - Soignant
- **Email** : `test@example.com`
- **Mot de passe** : `password`
- **Rôle** : Soignant
- **Nom** : Test User
- **Statut** : ✅ Vérifié et actif (pas besoin de vérifier l'email)
- **Créé le** : 2025-10-31

### 👑 Compte 2 - Administrateur
- **Email** : `admin@test.com`
- **Mot de passe** : `password`
- **Rôle** : Admin
- **Nom** : Admin Test
- **Statut** : ✅ Vérifié et actif (pas besoin de vérifier l'email)
- **Créé le** : 2025-10-31

### 👤 Compte 3 - Admin Original (mot de passe inconnu)
- **Email** : `admin@sante-rurale.ml`
- **Rôle** : Admin
- **Nom** : Administrateur Système
- **Statut** : ⚠️ Non vérifié (mot de passe à réinitialiser)

## 🔄 Pour sauvegarder la base de données

```bash
# Créer un backup
docker exec sante_db pg_dump -U sante sante_rurale > backup.sql

# Restaurer depuis un backup
docker exec -i sante_db psql -U sante sante_rurale < backup.sql
```

## 🛠️ Commandes utiles

### Accéder à la base de données
```bash
docker exec -it sante_db psql -U sante -d sante_rurale
```

### Lister tous les utilisateurs
```sql
SELECT email, nom, prenom, role, email_verified, actif FROM users;
```

### Créer un nouvel utilisateur admin manuellement
```sql
-- 1. Via l'API (recommandé)
-- Utiliser l'endpoint POST /api/auth/signup

-- 2. Activer un compte
UPDATE users SET email_verified = true WHERE email = 'votre@email.com';

-- 3. Changer le rôle
UPDATE users SET role = 'admin' WHERE email = 'votre@email.com';
```

## 📝 Notes importantes

- Les mots de passe sont hachés avec **bcrypt** (impossible de les voir en clair)
- Les tokens JWT expirent après **30 minutes** (access token) et **7 jours** (refresh token)
- Les données persistent tant que le volume Docker `santerurale_postgres_data` existe
- Pour réinitialiser complètement : `docker-compose down -v` (⚠️ supprime toutes les données)

## 🌐 URL d'accès

- **Frontend PWA** : http://localhost:5173 (ou 5174, 5175 selon disponibilité)
- **API Backend** : http://localhost:8000
- **API Docs** : http://localhost:8000/docs
- **Adminer (DB UI)** : http://localhost:8080

## 🔑 Règles de mot de passe

Pour créer un nouveau compte, le mot de passe doit contenir :
- Au moins 8 caractères
- Au moins une lettre majuscule
- Au moins une lettre minuscule
- Au moins un chiffre
- Au moins un caractère spécial (!@#$%^&*)

## 📞 Support

En cas de problème :
1. Vérifier que tous les conteneurs Docker tournent : `docker-compose ps`
2. Vérifier les logs de l'API : `docker-compose logs api`
3. Vérifier la connexion à la base : `docker exec -it sante_db psql -U sante -d sante_rurale`
