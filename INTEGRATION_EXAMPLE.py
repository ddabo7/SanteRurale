"""
Exemple d'intégration complète des middleware et monitoring dans main.py

Ce fichier montre comment intégrer tous les éléments créés :
- Rate limiting
- Security headers
- Sentry error tracking
- Prometheus metrics

À copier/adapter dans api/app/main.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Imports des middleware et monitoring
from app.middleware import (
    configure_rate_limiting,
    configure_security_headers,
    CORSSecurityMiddleware,
)
from app.monitoring import configure_sentry, configure_prometheus


def create_application() -> FastAPI:
    """
    Créer et configurer l'application FastAPI avec tous les middleware de production
    """

    # 1. Initialiser Sentry EN PREMIER (pour capturer toutes les erreurs)
    if settings.SENTRY_DSN:
        configure_sentry(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,  # 10% des transactions
            enable_tracing=True,
        )
        print(f"✅ Sentry initialized for {settings.ENVIRONMENT}")
    else:
        print("⚠️  Sentry DSN not configured - error tracking disabled")

    # 2. Créer l'application
    app = FastAPI(
        title="Santé Rurale API",
        description="API pour la gestion de santé en zones rurales à connectivité limitée",
        version="1.0.0",
        docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    )

    # 3. Configurer CORS (AVANT les autres middleware)
    cors_config = CORSSecurityMiddleware.get_cors_config(settings.ENVIRONMENT)
    app.add_middleware(CORSMiddleware, **cors_config)
    print(f"✅ CORS configured for {settings.ENVIRONMENT}")

    # 4. Configurer les security headers
    configure_security_headers(app, environment=settings.ENVIRONMENT)
    print("✅ Security headers configured")

    # 5. Configurer le rate limiting
    configure_rate_limiting(app)
    print("✅ Rate limiting configured")

    # 6. Configurer Prometheus
    configure_prometheus(app, enable_default_metrics=True)
    print("✅ Prometheus metrics configured on /metrics")

    # 7. Inclure les routers
    from app.routers import auth, users, patients, encounters, reports

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(users.router, prefix="/api/users", tags=["users"])
    app.include_router(patients.router, prefix="/api/patients", tags=["patients"])
    app.include_router(encounters.router, prefix="/api/encounters", tags=["encounters"])
    app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

    # 8. Health check endpoint (sans auth ni rate limiting)
    @app.get("/health", tags=["health"])
    async def health_check():
        """Health check endpoint pour les load balancers"""
        return {
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
            "version": "1.0.0",
        }

    # 9. Endpoint pour les métriques système détaillées
    from app.monitoring.prometheus_config import add_health_metrics_endpoint
    add_health_metrics_endpoint(app)

    return app


# Créer l'instance de l'application
app = create_application()


# ============================================================================
# Exemples d'utilisation dans les routes
# ============================================================================

"""
# Dans app/routers/patients.py

from app.monitoring.sentry_config import capture_exception, set_user_context, add_breadcrumb
from app.monitoring.prometheus_config import metrics_collector
import time

@router.post("/", response_model=PatientResponse)
async def create_patient(
    patient: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Ajouter le contexte utilisateur pour Sentry
    set_user_context(
        user_id=str(current_user.id),
        role=current_user.role.code
    )

    # 2. Ajouter une breadcrumb
    add_breadcrumb(
        "Creating patient",
        category="database",
        patient_nom=patient.nom
    )

    start_time = time.time()

    try:
        # 3. Créer le patient
        new_patient = Patient(**patient.dict())
        db.add(new_patient)
        await db.commit()
        await db.refresh(new_patient)

        # 4. Enregistrer les métriques de succès
        duration = time.time() - start_time
        metrics_collector.record_database_query(
            table="patients",
            operation="INSERT",
            duration=duration
        )

        return new_patient

    except Exception as e:
        # 5. Capturer l'erreur dans Sentry
        capture_exception(
            e,
            user_id=str(current_user.id),
            operation="create_patient",
            patient_nom=patient.nom
        )

        # 6. Enregistrer la métrique d'échec
        metrics_collector.record_database_query(
            table="patients",
            operation="INSERT_FAILED",
            duration=time.time() - start_time
        )

        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la création du patient"
        )
"""


# ============================================================================
# Exemple de synchronisation avec métriques
# ============================================================================

"""
# Dans app/routers/sync.py

from app.monitoring.sentry_config import capture_message, set_context
from app.monitoring.prometheus_config import metrics_collector, track_time
import time

@router.post("/sync")
async def sync_data(
    sync_request: SyncRequest,
    current_user: User = Depends(get_current_user),
):
    start_time = time.time()

    try:
        # 1. Définir le contexte de sync pour Sentry
        set_context("sync", {
            "operation": sync_request.operation_type,
            "items_count": len(sync_request.items),
            "user_id": str(current_user.id),
        })

        # 2. Effectuer la synchronisation
        result = await perform_sync(sync_request)

        # 3. Enregistrer les métriques de succès
        duration = time.time() - start_time
        metrics_collector.record_sync_operation(
            operation_type=sync_request.operation_type,
            status="success",
            duration=duration
        )

        # 4. Alerter si la sync prend trop de temps
        if duration > 5.0:
            capture_message(
                f"Slow sync operation: {duration:.2f}s",
                level="warning",
                operation=sync_request.operation_type,
                items_count=len(sync_request.items)
            )

        return result

    except Exception as e:
        duration = time.time() - start_time

        # Enregistrer l'échec
        metrics_collector.record_sync_operation(
            operation_type=sync_request.operation_type,
            status="failure",
            duration=duration
        )

        capture_exception(
            e,
            operation="sync",
            sync_type=sync_request.operation_type
        )

        raise
"""


# ============================================================================
# Configuration des variables d'environnement
# ============================================================================

"""
# Dans .env (développement)
ENVIRONMENT=development
SENTRY_DSN=  # Laisser vide en dev ou utiliser un projet de test

# Dans .env (production)
ENVIRONMENT=production
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Rate Limiting (optionnel - valeurs par défaut dans le code)
RATE_LIMIT_DEFAULT_LIMIT=100
RATE_LIMIT_DEFAULT_WINDOW=60

# CORS (automatique selon ENVIRONMENT)
# Production: Seulement les domaines spécifiques
# Development: localhost autorisé
"""


# ============================================================================
# Tester les endpoints
# ============================================================================

"""
# 1. Démarrer l'API
docker-compose up -d

# 2. Vérifier le health check
curl http://localhost:8000/health

# 3. Vérifier les métriques Prometheus
curl http://localhost:8000/metrics

# 4. Tester le rate limiting
for i in {1..10}; do
    curl -X POST http://localhost:8000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"wrong"}'
done

# Après 5 tentatives, devrait retourner 429 Too Many Requests

# 5. Vérifier les security headers
curl -I https://votre-domaine.com/

# Devrait afficher:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
"""


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting Santé Rurale API with full monitoring...")
    print(f"   Environment: {settings.ENVIRONMENT}")
    print(f"   Sentry: {'✅ Enabled' if settings.SENTRY_DSN else '❌ Disabled'}")
    print(f"   Metrics: ✅ Available at /metrics")
    print(f"   Health: ✅ Available at /health")
    print()

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
    )
