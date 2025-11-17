"""
Configuration de l'application
"""
from pydantic_settings import BaseSettings
from pydantic import PostgresDsn


class Settings(BaseSettings):
    """Configuration de l'application"""

    # Configuration de la base de données
    DATABASE_URL: PostgresDsn = "postgresql+asyncpg://sante:sante_pwd@localhost:5432/sante_rurale"

    # Configuration JWT
    SECRET_KEY: str = "votre-cle-secrete-super-longue-et-aleatoire-changez-moi-en-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Configuration de l'application
    APP_NAME: str = "Santé Rurale API"
    DEBUG: bool = True
    API_V1_STR: str = "/api"

    # Configuration CORS
    # Peut être surchargé par ALLOWED_ORIGINS dans .env (séparé par des virgules)
    ALLOWED_ORIGINS: str | None = None

    @property
    def CORS_ORIGINS(self) -> list[str]:
        """Retourne la liste des origines CORS autorisées"""
        if self.ALLOWED_ORIGINS:
            # Si ALLOWED_ORIGINS est défini dans .env, l'utiliser
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
        # Sinon, utiliser les valeurs par défaut pour le développement
        return [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5175",
            "http://127.0.0.1:3000",
        ]

    # Configuration Email (Hostinger)
    EMAIL_HOST: str = "smtp.hostinger.com"
    EMAIL_PORT: int = 465
    EMAIL_HOST_USER: str = "no-reply@santerurale.io"
    EMAIL_HOST_PASSWORD: str = ""  # Défini dans .env en production
    EMAIL_FROM: str = "no-reply@santerurale.io"
    EMAIL_FROM_NAME: str = "Santé Rurale"

    # URLs de l'application
    FRONTEND_URL: str = "http://localhost:5173"

    # Configuration Celery
    CELERY_BROKER_URL: str = "redis://:redis_pwd@redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://:redis_pwd@redis:6379/2"

    # Configuration SaaS Multi-Tenant (nouveau)
    ENVIRONMENT: str = "development"  # development, staging, production
    STRIPE_ENABLED: bool = False
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    SENTRY_DSN: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
