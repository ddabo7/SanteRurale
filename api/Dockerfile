# ===========================================================================
# Dockerfile Multi-stage pour API FastAPI
# ===========================================================================
# Stages:
# - base: Image de base avec Python 3.11
# - development: Pour développement local avec hot reload
# - production: Image optimisée pour production
# ===========================================================================

# ===========================================================================
# Stage: base
# ===========================================================================
FROM python:3.11-slim as base

# Métadonnées
LABEL maintainer="support@sante-rurale.ml"
LABEL description="API Santé Rurale Mali"

# Variables d'environnement Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Créer un utilisateur non-root
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app /app/keys && \
    chown -R appuser:appuser /app

WORKDIR /app

# ===========================================================================
# Stage: development
# ===========================================================================
FROM base as development

# Installer les dépendances Python (dev + prod)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code (sera overridé par volume mount en dev)
COPY --chown=appuser:appuser . .

USER appuser

# Port FastAPI
EXPOSE 8000

# Commande par défaut (peut être overridée dans docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ===========================================================================
# Stage: production
# ===========================================================================
FROM base as production

# Copier uniquement requirements.txt d'abord (pour cache Docker)
COPY requirements.txt .

# Installer uniquement les dépendances de production
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# Copier le code de l'application
COPY --chown=appuser:appuser . .

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Port
EXPOSE 8000

# Lancer avec Gunicorn + Uvicorn workers
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
