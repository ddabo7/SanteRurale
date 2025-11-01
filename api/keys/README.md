# Clés JWT

Ce répertoire contient les clés RSA pour la signature des tokens JWT.

## 🔐 Développement

Les clés sont **générées automatiquement** par le script `setup.sh`.

Si vous devez les générer manuellement :

```bash
# Générer la clé privée RSA 4096 bits
openssl genrsa -out jwt-private.pem 4096

# Extraire la clé publique
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

## ⚠️ Production

**IMPORTANT** : En production, utilisez des clés différentes stockées dans **AWS Secrets Manager** ou équivalent.

**Ne JAMAIS** commiter les clés de production dans Git !

### Génération de clés pour production

```bash
# Générer des clés sécurisées
openssl genrsa -out jwt-private-prod.pem 4096
openssl rsa -in jwt-private-prod.pem -pubout -out jwt-public-prod.pem

# Stocker dans AWS Secrets Manager
aws secretsmanager create-secret \
    --name sante-rurale/prod/jwt-private-key \
    --secret-binary fileb://jwt-private-prod.pem

aws secretsmanager create-secret \
    --name sante-rurale/prod/jwt-public-key \
    --secret-binary fileb://jwt-public-prod.pem

# Supprimer les fichiers locaux
rm jwt-private-prod.pem jwt-public-prod.pem
```

## 📝 Rotation des clés

Les clés JWT doivent être **tournées tous les 6 mois** minimum.

Voir [docs/operations-runbooks.md](../../docs/operations-runbooks.md) pour la procédure de rotation.
