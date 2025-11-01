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
    APP_NAME: str = "Santé Rurale Mali API"
    DEBUG: bool = True
    API_V1_STR: str = "/api"

    # Configuration CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
    ]

    # Configuration Email
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_HOST_USER: str = "crosssecmar@gmail.com"
    EMAIL_HOST_PASSWORD: str = "myrh iucx pjrh rboe"
    EMAIL_FROM: str = "noreply@sante-rurale.ml"
    EMAIL_FROM_NAME: str = "Santé Rurale Mali"

    # URLs de l'application
    FRONTEND_URL: str = "http://localhost:5173"

    # Configuration Celery
    CELERY_BROKER_URL: str = "redis://:redis_pwd@redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://:redis_pwd@redis:6379/2"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
