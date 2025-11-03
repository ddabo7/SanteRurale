"""
Middleware pour filtrer automatiquement les requêtes par tenant

Ce middleware intercepte toutes les requêtes SQL et ajoute automatiquement
un filtre WHERE tenant_id = <tenant_actuel> pour isoler les données.
"""
import uuid
from typing import Optional
from fastapi import Request
from sqlalchemy import event
from sqlalchemy.orm import Session
from contextvars import ContextVar

# Context var pour stocker le tenant_id actuel
# Utilisé par les event listeners SQLAlchemy
current_tenant_id: ContextVar[Optional[uuid.UUID]] = ContextVar('current_tenant_id', default=None)


def set_current_tenant(tenant_id: uuid.UUID):
    """Définit le tenant actuel dans le contexte"""
    current_tenant_id.set(tenant_id)


def get_current_tenant_id() -> Optional[uuid.UUID]:
    """Récupère le tenant_id actuel depuis le contexte"""
    return current_tenant_id.get()


def clear_current_tenant():
    """Efface le tenant actuel du contexte"""
    current_tenant_id.set(None)


def configure_tenant_filter(engine):
    """
    Configure les event listeners SQLAlchemy pour filtrer automatiquement par tenant

    IMPORTANT: Ceci doit être appelé AU DÉMARRAGE de l'application, PAS à chaque requête

    Usage dans main.py:
        from app.middleware.tenant_filter import configure_tenant_filter
        configure_tenant_filter(engine)
    """

    @event.listens_for(Session, "do_orm_execute", retval=True)
    def receive_do_orm_execute(orm_execute_state):
        """
        Intercepte toutes les requêtes SELECT et ajoute un filtre tenant_id
        """
        tenant_id = get_current_tenant_id()

        # Si pas de tenant_id dans le contexte, ne rien filtrer
        # (pour les requêtes admin, migrations, etc.)
        if tenant_id is None:
            return orm_execute_state

        # Liste des tables qui doivent être filtrées par tenant
        tenant_scoped_tables = {
            'patients',
            'encounters',
            'encounter_vital_signs',
            'encounter_diagnoses',
            'encounter_prescriptions',
            'encounter_procedures',
            'referrals',
            'reports',
            'users'  # Les utilisateurs aussi sont scopés par tenant
        }

        # Vérifier si la requête concerne une table scopée
        if orm_execute_state.is_select:
            # Récupérer les tables de la requête
            mapper = orm_execute_state.bind_mapper

            if mapper and mapper.local_table.name in tenant_scoped_tables:
                # Ajouter le filtre tenant_id
                orm_execute_state.statement = orm_execute_state.statement.filter_by(
                    tenant_id=tenant_id
                )

        return orm_execute_state


async def tenant_context_middleware(request: Request, call_next):
    """
    Middleware FastAPI pour injecter le tenant_id dans le contexte

    Ce middleware doit être ajouté à l'application FastAPI:

    Usage dans main.py:
        from app.middleware.tenant_filter import tenant_context_middleware
        app.middleware("http")(tenant_context_middleware)
    """
    try:
        # Le tenant_id sera défini par la dépendance get_current_tenant()
        # et stocké dans request.state.tenant_id
        response = await call_next(request)

        # Injecter le tenant_id dans le contexte si disponible
        if hasattr(request.state, 'tenant_id'):
            set_current_tenant(request.state.tenant_id)
        else:
            # Pas de tenant (endpoints publics, login, etc.)
            clear_current_tenant()

        return response
    finally:
        # Toujours nettoyer le contexte après la requête
        clear_current_tenant()


# Alternative plus simple: Query Filter Mixin
class TenantQueryMixin:
    """
    Mixin à ajouter aux modèles pour filtrer automatiquement par tenant

    Usage:
        class Patient(Base, TenantQueryMixin):
            ...

        # Ensuite dans les routes:
        patients = await db.execute(
            Patient.query_for_tenant(tenant_id).where(Patient.nom.like("%search%"))
        )
    """

    @classmethod
    def query_for_tenant(cls, tenant_id: uuid.UUID):
        """Retourne une query filtrée par tenant_id"""
        from sqlalchemy import select
        return select(cls).where(cls.tenant_id == tenant_id)
