#!/bin/bash
# ===========================================================================
# Script d'initialisation - Santé Rurale
# ===========================================================================
# Ce script configure l'environnement de développement local
# ===========================================================================

set -e  # Arrêter en cas d'erreur

echo "🏥 Santé Rurale - Configuration initiale"
echo "=============================================="
echo ""

# ===========================================================================
# 1. Vérifier Docker
# ===========================================================================
echo "📦 Vérification de Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez l'installer : https://www.docker.com/get-started"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé."
    exit 1
fi

echo "✅ Docker est installé"
echo ""

# ===========================================================================
# 2. Créer le fichier .env s'il n'existe pas
# ===========================================================================
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env pour le développement local..."

    cat > .env << 'EOF'
# Configuration Environnement - Santé Rurale (Développement Local)
APP_NAME=Santé Rurale API
APP_VERSION=1.0.0
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
LOG_FORMAT=json

# Security
SECRET_KEY=dev_secret_key_f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
JWT_ALGORITHM=HS256
JWT_PRIVATE_KEY_PATH=./keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=./keys/jwt-public.pem
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Database
DATABASE_URL=postgresql+asyncpg://sante:sante_pwd@db:5432/sante_rurale
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
DATABASE_ECHO=false

# Redis
REDIS_URL=redis://:redis_pwd@redis:6379/0
REDIS_CACHE_TTL=300
CELERY_BROKER_URL=redis://:redis_pwd@redis:6379/1
CELERY_RESULT_BACKEND=redis://:redis_pwd@redis:6379/2

# S3 / MinIO
S3_ENDPOINT_URL=http://minio:9000
S3_REGION=eu-west-1
S3_BUCKET_NAME=sante-rurale
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
S3_PRESIGNED_URL_EXPIRY=3600
MAX_UPLOAD_SIZE_MB=50

# DHIS2 (instance de test)
DHIS2_BASE_URL=https://play.dhis2.org/2.39.1
DHIS2_USERNAME=admin
DHIS2_PASSWORD=district
DHIS2_TIMEOUT=30

# SMS / Notifications (désactivé en dev)
SMS_PROVIDER=orange
SMS_ENABLED=false
WHATSAPP_ENABLED=false

# Observabilité
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
OTEL_ENABLED=false

# Feature Flags
ENABLE_AUDIT_LOGS=true
ENABLE_RLS=false
ENABLE_FHIR_ENDPOINTS=true
ENABLE_OFFLINE_SYNC=true

# Frontend
VITE_API_URL=http://localhost:8000/v1
VITE_ENVIRONMENT=development

# Docker Compose
POSTGRES_DB=sante_rurale
POSTGRES_USER=sante
POSTGRES_PASSWORD=sante_pwd
REDIS_PASSWORD=redis_pwd
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
EOF

    echo "✅ Fichier .env créé"
else
    echo "✅ Fichier .env existe déjà"
fi
echo ""

# ===========================================================================
# 3. Créer les répertoires nécessaires
# ===========================================================================
echo "📁 Création des répertoires..."
mkdir -p api/keys
mkdir -p logs
mkdir -p backups

echo "✅ Répertoires créés"
echo ""

# ===========================================================================
# 4. Générer les clés JWT (si nécessaire)
# ===========================================================================
if [ ! -f api/keys/jwt-private.pem ]; then
    echo "🔐 Génération des clés JWT pour le développement..."

    # Générer une clé privée RSA 4096 bits
    openssl genrsa -out api/keys/jwt-private.pem 4096 2>/dev/null

    # Extraire la clé publique
    openssl rsa -in api/keys/jwt-private.pem -pubout -out api/keys/jwt-public.pem 2>/dev/null

    echo "✅ Clés JWT générées"
else
    echo "✅ Clés JWT existent déjà"
fi
echo ""

# ===========================================================================
# 5. Lancer Docker Compose
# ===========================================================================
echo "🐳 Lancement des conteneurs Docker..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Attente du démarrage des services (30 secondes)..."
sleep 30

# ===========================================================================
# 6. Vérifier que les services sont prêts
# ===========================================================================
echo ""
echo "🔍 Vérification de l'état des services..."

# Vérifier PostgreSQL
if docker-compose -f docker-compose.dev.yml exec -T db pg_isready -U sante > /dev/null 2>&1; then
    echo "✅ PostgreSQL est prêt"
else
    echo "⚠️  PostgreSQL n'est pas encore prêt (cela peut prendre quelques secondes de plus)"
fi

# Vérifier Redis
if docker-compose -f docker-compose.dev.yml exec -T redis redis-cli -a redis_pwd ping > /dev/null 2>&1; then
    echo "✅ Redis est prêt"
else
    echo "⚠️  Redis n'est pas encore prêt"
fi

echo ""

# ===========================================================================
# 7. Initialiser la base de données
# ===========================================================================
echo "🗄️  Initialisation de la base de données..."

# Attendre que l'API soit prête
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose -f docker-compose.dev.yml exec -T api python -c "import sys; sys.exit(0)" 2>/dev/null; then
        break
    fi
    attempt=$((attempt + 1))
    echo "   Attente de l'API... ($attempt/$max_attempts)"
    sleep 2
done

# Exécuter les migrations Alembic
echo "   Exécution des migrations..."
docker-compose -f docker-compose.dev.yml exec -T api alembic upgrade head || true

echo "✅ Base de données initialisée"
echo ""

# ===========================================================================
# 8. Résumé
# ===========================================================================
echo "=============================================="
echo "✅ Configuration terminée avec succès !"
echo "=============================================="
echo ""
echo "🌐 Accès aux services :"
echo "   - API:           http://localhost:8000"
echo "   - Docs API:      http://localhost:8000/docs"
echo "   - PWA:           http://localhost:5173"
echo "   - MinIO Console: http://localhost:9001"
echo "   - Adminer (DB):  http://localhost:8080"
echo ""
echo "📝 Commandes utiles :"
echo "   - Voir les logs:        docker-compose -f docker-compose.dev.yml logs -f"
echo "   - Arrêter:              docker-compose -f docker-compose.dev.yml down"
echo "   - Redémarrer:           docker-compose -f docker-compose.dev.yml restart"
echo "   - Shell API:            docker-compose -f docker-compose.dev.yml exec api bash"
echo "   - Shell DB:             docker-compose -f docker-compose.dev.yml exec db psql -U sante -d sante_rurale"
echo ""
echo "🎉 Vous pouvez maintenant développer !"
echo ""
