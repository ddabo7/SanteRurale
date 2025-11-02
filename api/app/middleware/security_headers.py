"""
Middleware pour ajouter les headers de sécurité HTTP
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware pour ajouter les headers de sécurité recommandés
    """

    def __init__(
        self,
        app,
        hsts_max_age: int = 31536000,  # 1 an
        csp_directives: dict = None,
        enable_permissions_policy: bool = True,
    ):
        super().__init__(app)
        self.hsts_max_age = hsts_max_age
        self.csp_directives = csp_directives or self._get_default_csp()
        self.enable_permissions_policy = enable_permissions_policy

    def _get_default_csp(self) -> dict:
        """
        Configuration Content-Security-Policy par défaut
        """
        return {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
            "font-src": ["'self'", "data:"],
            "connect-src": ["'self'", "https://api.sentry.io"],
            "frame-ancestors": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
        }

    def _build_csp_header(self) -> str:
        """
        Construire la valeur du header CSP
        """
        directives = []
        for directive, sources in self.csp_directives.items():
            sources_str = " ".join(sources)
            directives.append(f"{directive} {sources_str}")

        return "; ".join(directives)

    async def dispatch(self, request: Request, call_next):
        """
        Ajouter les headers de sécurité à chaque réponse
        """
        response: Response = await call_next(request)

        # 1. Strict-Transport-Security (HSTS)
        # Force HTTPS pour toutes les requêtes futures
        if request.url.scheme == "https":
            response.headers[
                "Strict-Transport-Security"
            ] = f"max-age={self.hsts_max_age}; includeSubDomains; preload"

        # 2. X-Content-Type-Options
        # Empêche le navigateur de deviner le MIME type
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 3. X-Frame-Options
        # Empêche le clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # 4. X-XSS-Protection
        # Protection XSS (legacy, mais toujours utile)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # 5. Content-Security-Policy
        # Politique de sécurité du contenu
        response.headers["Content-Security-Policy"] = self._build_csp_header()

        # 6. Referrer-Policy
        # Contrôle les informations envoyées dans le header Referer
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 7. Permissions-Policy (anciennement Feature-Policy)
        # Contrôle les fonctionnalités du navigateur
        if self.enable_permissions_policy:
            permissions = [
                "geolocation=(self)",  # Autoriser geolocation pour la même origine
                "microphone=()",  # Désactiver le micro
                "camera=(self)",  # Autoriser la caméra pour la même origine
                "payment=()",  # Désactiver payment API
                "usb=()",  # Désactiver USB
                "magnetometer=()",  # Désactiver magnetometer
            ]
            response.headers["Permissions-Policy"] = ", ".join(permissions)

        # 8. X-Permitted-Cross-Domain-Policies
        # Contrôle l'accès aux données par Flash/PDF
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # 9. Cross-Origin-Embedder-Policy
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"

        # 10. Cross-Origin-Opener-Policy
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

        # 11. Cross-Origin-Resource-Policy
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        # 12. Cache-Control pour les réponses sensibles
        if request.url.path.startswith("/api/auth") or request.url.path.startswith(
            "/api/users"
        ):
            response.headers[
                "Cache-Control"
            ] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"

        return response


def configure_security_headers(app, environment: str = "production"):
    """
    Configurer les headers de sécurité selon l'environnement

    Args:
        app: Application FastAPI
        environment: "production" ou "development"
    """
    if environment == "production":
        # Configuration stricte pour la production
        app.add_middleware(
            SecurityHeadersMiddleware,
            hsts_max_age=31536000,  # 1 an
            csp_directives={
                "default-src": ["'self'"],
                "script-src": ["'self'"],
                "style-src": ["'self'", "'unsafe-inline'"],  # Tailwind nécessite unsafe-inline
                "img-src": ["'self'", "data:", "https:"],
                "font-src": ["'self'", "data:"],
                "connect-src": ["'self'", "https://api.sentry.io"],
                "frame-ancestors": ["'none'"],
                "base-uri": ["'self'"],
                "form-action": ["'self'"],
                "upgrade-insecure-requests": [],
            },
            enable_permissions_policy=True,
        )
    else:
        # Configuration plus permissive pour le développement
        app.add_middleware(
            SecurityHeadersMiddleware,
            hsts_max_age=0,  # Pas de HSTS en dev
            csp_directives={
                "default-src": ["'self'"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                "style-src": ["'self'", "'unsafe-inline'"],
                "img-src": ["'self'", "data:", "https:", "http:"],
                "font-src": ["'self'", "data:"],
                "connect-src": [
                    "'self'",
                    "ws://localhost:*",
                    "http://localhost:*",
                    "https://api.sentry.io",
                ],
                "frame-ancestors": ["'none'"],
                "base-uri": ["'self'"],
                "form-action": ["'self'"],
            },
            enable_permissions_policy=False,
        )


class CORSSecurityMiddleware:
    """
    Configuration CORS sécurisée

    Note: FastAPI a déjà CORSMiddleware, mais cette classe
    fournit une configuration recommandée pour la sécurité
    """

    @staticmethod
    def get_cors_config(environment: str = "production") -> dict:
        """
        Obtenir la configuration CORS recommandée

        Returns:
            Dict de configuration pour CORSMiddleware
        """
        if environment == "production":
            return {
                "allow_origins": [
                    "https://votre-domaine.com",
                    "https://app.votre-domaine.com",
                ],
                "allow_credentials": True,
                "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                "allow_headers": ["Authorization", "Content-Type", "X-Request-ID"],
                "expose_headers": [
                    "X-RateLimit-Limit",
                    "X-RateLimit-Remaining",
                    "X-RateLimit-Reset",
                ],
                "max_age": 600,  # 10 minutes
            }
        else:
            # Plus permissif en développement
            return {
                "allow_origins": [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:5173",
                ],
                "allow_credentials": True,
                "allow_methods": ["*"],
                "allow_headers": ["*"],
                "max_age": 600,
            }
