# Guide de démarrage - Santé Rurale Mali

## Système de validation d'email et réinitialisation de mot de passe

### Fonctionnalités implémentées

✅ **Inscription avec validation d'email**
- Lors de l'inscription, un email de vérification est envoyé automatiquement
- Le compte n'est actif qu'après validation de l'email
- Lien de vérification valide pendant 24 heures

✅ **Récupération de mot de passe**
- Envoi d'un email avec lien de réinitialisation
- Lien valide pendant 1 heure
- Nouveau mot de passe sécurisé avec validation

---

## Lancement de l'application

### 1. Démarrer le backend (API FastAPI)

```bash
# Aller dans le dossier api
cd "/Users/djibrildabo/Documents/Santé Rurale/api"

# Activer l'environnement virtuel Python (si nécessaire)
source venv/bin/activate   # Sur Mac/Linux
# ou
venv\Scripts\activate      # Sur Windows

# Installer les dépendances (si ce n'est pas déjà fait)
pip install -r requirements.txt

# Lancer le serveur API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Le backend sera accessible sur **http://localhost:8000**

### 2. Démarrer le frontend (PWA React)

Ouvrir un **nouveau terminal** et exécuter :

```bash
# Aller dans le dossier pwa
cd "/Users/djibrildabo/Documents/Santé Rurale/pwa"

# Installer les dépendances (si ce n'est pas déjà fait)
npm install

# Lancer l'application en mode développement
npm run dev
```

Le frontend sera accessible sur **http://localhost:5173**

---

## Test du système

### Test de l'inscription avec validation d'email

1. Accédez à http://localhost:5173/signup
2. Remplissez le formulaire d'inscription
3. Un email sera envoyé à votre adresse (vérifiez votre boîte de réception et spam)
4. Cliquez sur le lien dans l'email pour vérifier votre compte
5. Vous serez redirigé vers la page de connexion
6. Connectez-vous avec vos identifiants

### Test de la réinitialisation de mot de passe

1. Accédez à http://localhost:5173/forgot-password
2. Entrez votre email
3. Un email sera envoyé avec un lien de réinitialisation
4. Cliquez sur le lien dans l'email
5. Entrez votre nouveau mot de passe
6. Vous serez redirigé vers la page de connexion
7. Connectez-vous avec votre nouveau mot de passe

---

## Comptes de test

Les comptes suivants sont déjà vérifiés et utilisables immédiatement :

### 👑 Administrateur
- Email : `admin@cscom-koulikoro.ml`
- Mot de passe : `Admin2024!`

### 👨‍⚕️ Médecin
- Email : `dr.traore@cscom-koulikoro.ml`
- Mot de passe : `Medecin2024!`

### 👩‍⚕️ Major
- Email : `major.kone@cscom-koulikoro.ml`
- Mot de passe : `Major2024!`

### 🩺 Soignant
- Email : `soignant.coulibaly@cscom-koulikoro.ml`
- Mot de passe : `Soignant2024!`

---

## Configuration email

Le système utilise Gmail SMTP pour l'envoi des emails :
- **Host** : smtp.gmail.com
- **Port** : 587
- **TLS** : Activé
- **Email** : crosssecmar@gmail.com

Les emails sont envoyés via le backend FastAPI pour des raisons de sécurité.

---

## Structure du système

```
Santé Rurale/
├── api/                          # Backend FastAPI
│   ├── app/
│   │   ├── services/
│   │   │   └── email.py         # Service d'envoi d'emails
│   │   ├── routers/
│   │   │   └── auth.py          # Endpoints d'authentification
│   │   └── ...
│   └── ...
│
└── pwa/                          # Frontend React PWA
    ├── src/
    │   ├── services/
    │   │   └── mockAuth.ts      # Service d'authentification
    │   ├── pages/
    │   │   ├── SignupPage.tsx   # Page d'inscription
    │   │   ├── LoginPage.tsx    # Page de connexion
    │   │   ├── ForgotPasswordPage.tsx         # Mot de passe oublié
    │   │   ├── EmailVerificationPage.tsx      # Vérification email
    │   │   └── ResetPasswordPage.tsx          # Réinitialisation
    │   └── ...
    └── ...
```

---

## Dépannage

### Les emails ne sont pas envoyés

1. Vérifiez que le backend est bien démarré sur le port 8000
2. Vérifiez la console du backend pour les erreurs SMTP
3. Vérifiez que les identifiants email sont corrects dans `api/app/services/email.py`

### Le lien de vérification ne fonctionne pas

1. Vérifiez que le token est bien présent dans l'URL (paramètre `?token=...`)
2. Vérifiez que le lien n'a pas expiré (24h pour la vérification, 1h pour le reset)
3. Vérifiez la console du navigateur pour les erreurs

### Impossible de se connecter après inscription

1. Assurez-vous d'avoir cliqué sur le lien de vérification dans l'email
2. Le message "Veuillez vérifier votre email avant de vous connecter" indique que l'email n'est pas encore vérifié
3. Vérifiez votre boîte de réception et dossier spam

---

## Autres commandes utiles

### Frontend

```bash
# Build pour la production
npm run build

# Prévisualiser le build de production
npm run preview

# Vérifier les types TypeScript
npm run type-check

# Lancer les tests
npm test
```

### Backend

```bash
# Voir les logs en temps réel
tail -f logs/app.log

# Lancer les migrations de base de données
alembic upgrade head

# Créer une nouvelle migration
alembic revision --autogenerate -m "description"
```

---

## Support

Pour toute question ou problème, vérifiez :
1. Que le backend ET le frontend sont bien démarrés
2. Les logs du backend pour les erreurs d'envoi d'email
3. La console du navigateur pour les erreurs frontend
