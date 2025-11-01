"""
Application FastAPI principale pour Santé Rurale Mali
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth

# Créer l'application FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description="API pour le système de gestion des soins de santé ruraux au Mali",
    version="1.0.0",
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",  # Permet tous les ports localhost en dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routers
app.include_router(auth.router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """
    Endpoint racine
    """
    return {
        "message": "Bienvenue sur l'API Santé Rurale Mali",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """
    Endpoint de vérification de santé
    """
    return {"status": "healthy"}
