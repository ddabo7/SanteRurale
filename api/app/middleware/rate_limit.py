"""
Middleware de rate limiting pour protéger l'API contre les abus
"""

import time
from typing import Dict, Tuple
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitExceeded(HTTPException):
    """Exception levée quand la limite de requêtes est dépassée"""

    def __init__(self, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Retry after {retry_after} seconds",
            headers={"Retry-After": str(retry_after)},
        )


class InMemoryRateLimiter:
    """
    Rate limiter en mémoire avec algorithme de sliding window

    Note: Pour la production avec plusieurs instances, utiliser Redis
    """

    def __init__(self):
        # Structure: {identifier: [(timestamp, count), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 3600  # Nettoyage toutes les heures
        self.last_cleanup = time.time()

    def _cleanup_old_entries(self):
        """Nettoyer les anciennes entrées pour libérer la mémoire"""
        current_time = time.time()

        if current_time - self.last_cleanup > self.cleanup_interval:
            cutoff_time = current_time - 3600  # Garder seulement 1h d'historique

            for identifier in list(self.requests.keys()):
                self.requests[identifier] = [
                    (ts, count)
                    for ts, count in self.requests[identifier]
                    if ts > cutoff_time
                ]

                if not self.requests[identifier]:
                    del self.requests[identifier]

            self.last_cleanup = current_time

    def is_allowed(
        self, identifier: str, limit: int, window: int
    ) -> Tuple[bool, int]:
        """
        Vérifier si une requête est autorisée

        Args:
            identifier: Identifiant unique (IP, user_id, etc.)
            limit: Nombre maximum de requêtes
            window: Fenêtre de temps en secondes

        Returns:
            Tuple (is_allowed, retry_after_seconds)
        """
        self._cleanup_old_entries()

        current_time = time.time()
        window_start = current_time - window

        # Filtrer les requêtes dans la fenêtre actuelle
        recent_requests = [
            (ts, count)
            for ts, count in self.requests[identifier]
            if ts > window_start
        ]

        # Compter le nombre total de requêtes
        total_requests = sum(count for _, count in recent_requests)

        if total_requests >= limit:
            # Calculer le temps d'attente avant la prochaine requête autorisée
            if recent_requests:
                oldest_request_time = min(ts for ts, _ in recent_requests)
                retry_after = int(window - (current_time - oldest_request_time)) + 1
            else:
                retry_after = window

            return False, retry_after

        # Ajouter la requête actuelle
        recent_requests.append((current_time, 1))
        self.requests[identifier] = recent_requests

        return True, 0

    def reset(self, identifier: str):
        """Réinitialiser les compteurs pour un identifiant"""
        if identifier in self.requests:
            del self.requests[identifier]


# Instance globale du rate limiter
rate_limiter = InMemoryRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware FastAPI pour le rate limiting
    """

    def __init__(
        self,
        app,
        default_limit: int = 100,
        default_window: int = 60,
        by_endpoint: Dict[str, Tuple[int, int]] = None,
    ):
        """
        Args:
            app: Application FastAPI
            default_limit: Limite par défaut (requêtes)
            default_window: Fenêtre par défaut (secondes)
            by_endpoint: Limites spécifiques par endpoint
                Format: {"/api/auth/login": (5, 60)}  # 5 req/min
        """
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self.by_endpoint = by_endpoint or {}

    def _get_identifier(self, request: Request) -> str:
        """
        Obtenir un identifiant unique pour la requête

        Utilise l'ID utilisateur si authentifié, sinon l'IP
        """
        # Si authentifié, utiliser l'user_id
        if hasattr(request.state, "user") and request.state.user:
            return f"user:{request.state.user.id}"

        # Sinon utiliser l'IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"

        return f"ip:{ip}"

    def _get_limits_for_path(self, path: str) -> Tuple[int, int]:
        """
        Obtenir les limites (limit, window) pour un chemin donné
        """
        # Vérifier les endpoints spécifiques
        for endpoint_path, (limit, window) in self.by_endpoint.items():
            if path.startswith(endpoint_path):
                return limit, window

        # Retourner les limites par défaut
        return self.default_limit, self.default_window

    async def dispatch(self, request: Request, call_next):
        """
        Traiter la requête avec rate limiting
        """
        # Ne pas rate limiter les endpoints de health check
        if request.url.path in ["/health", "/api/health"]:
            return await call_next(request)

        # Obtenir l'identifiant et les limites
        identifier = self._get_identifier(request)
        limit, window = self._get_limits_for_path(request.url.path)

        # Vérifier la limite
        is_allowed, retry_after = rate_limiter.is_allowed(identifier, limit, window)

        if not is_allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Window": str(window),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # Traiter la requête
        response = await call_next(request)

        # Ajouter les headers de rate limit
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Window"] = str(window)

        return response


def configure_rate_limiting(app):
    """
    Configurer le rate limiting pour l'application

    Limites recommandées:
    - Login: 5 requêtes / minute
    - Registration: 3 requêtes / heure
    - API générale: 100 requêtes / minute
    - Upload de fichiers: 10 requêtes / heure
    """
    app.add_middleware(
        RateLimitMiddleware,
        default_limit=100,  # 100 requêtes par minute par défaut
        default_window=60,
        by_endpoint={
            "/api/auth/login": (5, 60),  # 5 tentatives de login par minute
            "/api/auth/register": (3, 3600),  # 3 inscriptions par heure
            "/api/auth/verify-email": (10, 3600),  # 10 vérifications par heure
            "/api/auth/reset-password": (3, 3600),  # 3 reset par heure
            "/api/upload": (10, 3600),  # 10 uploads par heure
        },
    )


# Décorateur pour rate limiting sur des routes spécifiques
def rate_limit(limit: int, window: int):
    """
    Décorateur pour appliquer un rate limit spécifique à une route

    Usage:
        @app.post("/api/sensitive")
        @rate_limit(limit=10, window=3600)
        async def sensitive_endpoint():
            ...
    """

    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            identifier = f"ip:{request.client.host if request.client else 'unknown'}"
            is_allowed, retry_after = rate_limiter.is_allowed(
                identifier, limit, window
            )

            if not is_allowed:
                raise RateLimitExceeded(retry_after)

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator
