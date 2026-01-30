"""
Application FastAPI principale pour Santé Rurale
"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.routers import auth, encounters, reports, tenants, attachments, admin, references, feedback, gdpr, stats
from app.routers import patients_simple as patients
from app.routers import medicaments, stock, fournisseurs, bons_commande

# Créer l'application FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description="API pour le système de gestion des soins de santé ruraux en zones rurales",
    version="1.0.0",
)

# Configuration CORS - DOIT être ajouté AVANT les exception handlers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",  # Permet tous les ports localhost en dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers pour s'assurer que les CORS headers sont toujours présents
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Gère les exceptions HTTP et s'assure que les CORS headers sont présents"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Gère les erreurs de validation"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Gère toutes les autres exceptions non gérées"""
    print(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )

# Inclure les routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patients.router, prefix=settings.API_V1_STR)
app.include_router(encounters.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(tenants.router)  # Déjà préfixé avec /api/tenants dans le router
app.include_router(attachments.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(references.router, prefix=settings.API_V1_STR)
app.include_router(feedback.router, prefix=settings.API_V1_STR)
# Inventory/Pharmacy routers
app.include_router(medicaments.router, prefix=settings.API_V1_STR)
app.include_router(stock.router, prefix=settings.API_V1_STR)
app.include_router(fournisseurs.router, prefix=settings.API_V1_STR)
app.include_router(bons_commande.router, prefix=settings.API_V1_STR)
# GDPR/RGPD compliance router
app.include_router(gdpr.router, prefix=settings.API_V1_STR)
# Public statistics router
app.include_router(stats.router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """
    Endpoint racine
    """
    return {
        "message": "Bienvenue sur l'API Santé Rurale",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.head("/api/health")
@app.get("/api/health")
@app.head("/health")
@app.get("/health")
async def health_check():
    """
    Endpoint de vérification de santé (HEAD + GET pour offline-first)
    """
    return {"status": "healthy"}
