"""
Configuration Sentry pour le tracking des erreurs
"""

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
import logging

logger = logging.getLogger(__name__)


def configure_sentry(
    dsn: str,
    environment: str = "production",
    traces_sample_rate: float = 0.1,
    profiles_sample_rate: float = 0.1,
    enable_tracing: bool = True,
):
    """
    Configurer Sentry pour le tracking des erreurs et la performance

    Args:
        dsn: Sentry DSN (Data Source Name)
        environment: Environnement (production, staging, development)
        traces_sample_rate: Taux d'échantillonnage des traces (0.0 à 1.0)
        profiles_sample_rate: Taux d'échantillonnage des profils (0.0 à 1.0)
        enable_tracing: Activer le tracing de performance

    Example:
        configure_sentry(
            dsn="https://examplePublicKey@o0.ingest.sentry.io/0",
            environment="production",
            traces_sample_rate=0.1  # 10% des transactions
        )
    """
    if not dsn:
        logger.warning("Sentry DSN not configured. Error tracking is disabled.")
        return

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            # Intégrations
            integrations=[
                FastApiIntegration(transaction_style="url"),
                SqlalchemyIntegration(),
                AsyncioIntegration(),
            ],
            # Performance Monitoring
            traces_sample_rate=traces_sample_rate if enable_tracing else 0.0,
            profiles_sample_rate=profiles_sample_rate if enable_tracing else 0.0,
            # Release tracking
            release=None,  # Sera défini via SENTRY_RELEASE env var
            # Options de filtrage
            ignore_errors=[
                KeyboardInterrupt,
                ConnectionError,
                TimeoutError,
            ],
            # PII (Personally Identifiable Information)
            send_default_pii=False,  # Ne pas envoyer les données sensibles
            # Paramètres additionnels
            max_breadcrumbs=50,
            attach_stacktrace=True,
            # Sampling des événements d'erreur (100% par défaut)
            sample_rate=1.0,
            # Avant d'envoyer un événement
            before_send=before_send_handler,
            # Avant d'envoyer une breadcrumb
            before_breadcrumb=before_breadcrumb_handler,
        )

        logger.info(f"Sentry initialized for environment: {environment}")

    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")


def before_send_handler(event, hint):
    """
    Filtrer et modifier les événements avant de les envoyer à Sentry

    Args:
        event: L'événement Sentry
        hint: Informations supplémentaires

    Returns:
        L'événement modifié ou None pour le supprimer
    """
    # Filtrer les erreurs de santé check
    if "request" in event:
        url = event.get("request", {}).get("url", "")
        if "/health" in url or "/metrics" in url:
            return None

    # Supprimer les données sensibles des contextes
    if "request" in event:
        headers = event.get("request", {}).get("headers", {})

        # Masquer les tokens d'authentification
        if "Authorization" in headers:
            headers["Authorization"] = "[Filtered]"

        # Masquer les cookies
        if "Cookie" in headers:
            headers["Cookie"] = "[Filtered]"

    # Supprimer les mots de passe des données POST
    if "request" in event and "data" in event["request"]:
        data = event["request"]["data"]
        if isinstance(data, dict):
            sensitive_keys = ["password", "mot_de_passe", "token", "secret"]
            for key in sensitive_keys:
                if key in data:
                    data[key] = "[Filtered]"

    return event


def before_breadcrumb_handler(crumb, hint):
    """
    Filtrer et modifier les breadcrumbs avant de les enregistrer

    Args:
        crumb: La breadcrumb
        hint: Informations supplémentaires

    Returns:
        La breadcrumb modifiée ou None pour la supprimer
    """
    # Ne pas enregistrer les requêtes de health check
    if crumb.get("category") == "httplib":
        if "/health" in crumb.get("data", {}).get("url", ""):
            return None

    return crumb


def capture_exception(error: Exception, **kwargs):
    """
    Capturer une exception et l'envoyer à Sentry avec contexte

    Args:
        error: L'exception à capturer
        **kwargs: Contexte supplémentaire

    Example:
        try:
            risky_operation()
        except Exception as e:
            capture_exception(e, user_id=user.id, operation="sync")
    """
    with sentry_sdk.push_scope() as scope:
        # Ajouter le contexte
        for key, value in kwargs.items():
            scope.set_tag(key, value)

        # Capturer l'exception
        sentry_sdk.capture_exception(error)


def capture_message(message: str, level: str = "info", **kwargs):
    """
    Capturer un message et l'envoyer à Sentry

    Args:
        message: Le message à capturer
        level: Niveau de gravité (debug, info, warning, error, fatal)
        **kwargs: Contexte supplémentaire

    Example:
        capture_message(
            "Unusual sync pattern detected",
            level="warning",
            patient_count=1000
        )
    """
    with sentry_sdk.push_scope() as scope:
        # Ajouter le contexte
        for key, value in kwargs.items():
            scope.set_tag(key, value)

        # Capturer le message
        sentry_sdk.capture_message(message, level=level)


def set_user_context(user_id: str = None, email: str = None, **kwargs):
    """
    Définir le contexte utilisateur pour les événements Sentry

    Args:
        user_id: ID de l'utilisateur
        email: Email de l'utilisateur (optionnel en production)
        **kwargs: Informations supplémentaires

    Example:
        set_user_context(user_id="123", role="medecin")
    """
    user_data = {"id": user_id}

    # N'inclure l'email que si send_default_pii est activé
    if email and sentry_sdk.Hub.current.client.options.get("send_default_pii"):
        user_data["email"] = email

    user_data.update(kwargs)
    sentry_sdk.set_user(user_data)


def set_context(context_name: str, context_data: dict):
    """
    Définir un contexte personnalisé

    Args:
        context_name: Nom du contexte
        context_data: Données du contexte

    Example:
        set_context("sync", {
            "operation": "pull",
            "items_count": 150,
            "duration_ms": 1250
        })
    """
    sentry_sdk.set_context(context_name, context_data)


def add_breadcrumb(message: str, category: str = "default", level: str = "info", **data):
    """
    Ajouter une breadcrumb pour le contexte d'erreur

    Args:
        message: Message de la breadcrumb
        category: Catégorie
        level: Niveau
        **data: Données supplémentaires

    Example:
        add_breadcrumb(
            "Patient data fetched",
            category="database",
            patient_id="123",
            count=1
        )
    """
    sentry_sdk.add_breadcrumb(
        message=message, category=category, level=level, data=data
    )


class SentryMiddleware:
    """
    Middleware pour ajouter automatiquement le contexte utilisateur
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Ajouter le contexte de la requête
        if scope["type"] == "http":
            with sentry_sdk.push_scope() as sentry_scope:
                # Ajouter les informations de la requête
                sentry_scope.set_tag("path", scope.get("path"))
                sentry_scope.set_tag("method", scope.get("method"))

                # Si l'utilisateur est authentifié, ajouter son contexte
                if "user" in scope:
                    user = scope["user"]
                    set_user_context(
                        user_id=str(user.id),
                        role=user.role.code if hasattr(user, "role") else None,
                    )

                await self.app(scope, receive, send)
        else:
            await self.app(scope, receive, send)
