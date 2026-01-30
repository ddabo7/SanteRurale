"""
Router pour le dashboard administrateur
Accessible uniquement aux utilisateurs avec role='admin'
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.database import get_db
from app.security import get_current_user
from app.models.base_models import User

router = APIRouter(prefix="/admin", tags=["admin"])


# ===========================================================================
# MODELS
# ===========================================================================

class TenantStats(BaseModel):
    id: str
    name: str
    created_at: datetime
    total_users: int
    total_patients: int
    total_encounters: int
    plan_name: str
    plan_code: str
    subscription_status: str
    monthly_revenue: float


class GlobalStats(BaseModel):
    # Tenants (Organisations)
    total_tenants: int
    active_tenants: int  # avec au moins 1 consultation ce mois
    new_tenants_this_month: int

    # Sites (Centres de santé)
    total_sites: int
    active_sites: int

    # Abonnements
    total_free_plan: int
    total_starter_plan: int
    total_pro_plan: int
    total_enterprise_plan: int

    # Revenus
    mrr: float  # Monthly Recurring Revenue
    arr: float  # Annual Recurring Revenue

    # Utilisation
    total_users: int
    total_patients: int
    total_encounters: int
    total_storage_bytes: int  # En bytes pour un affichage flexible

    # Top tenants
    top_tenants: list[TenantStats]


class RevenueByMonth(BaseModel):
    month: str  # YYYY-MM
    revenue: float
    new_subscriptions: int


# ===========================================================================
# MIDDLEWARE: Vérifier que l'utilisateur est admin
# ===========================================================================

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur a le rôle admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Accès réservé aux administrateurs"
        )
    return current_user


# ===========================================================================
# GET GLOBAL STATS
# ===========================================================================

@router.get("/stats", response_model=GlobalStats)
async def get_global_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Retourne les statistiques globales de la plateforme"""

    # Statistiques des tenants
    # Note: encounters n'a pas de tenant_id, on joint via users
    tenant_stats_query = text("""
        SELECT
            COUNT(DISTINCT t.id) as total_tenants,
            COUNT(DISTINCT CASE
                WHEN t.created_at >= DATE_TRUNC('month', CURRENT_DATE)
                THEN t.id
            END) as new_tenants_this_month,
            COUNT(DISTINCT CASE
                WHEN e.created_at >= DATE_TRUNC('month', CURRENT_DATE)
                THEN t.id
            END) as active_tenants
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN encounters e ON e.user_id = u.id
    """)

    result = await db.execute(tenant_stats_query)
    tenant_stats = result.fetchone()

    # Répartition par plan
    plan_distribution_query = text("""
        SELECT
            p.code,
            COUNT(DISTINCT t.id) as count
        FROM tenants t
        JOIN subscriptions s ON s.tenant_id = t.id
        JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'active'
        GROUP BY p.code
    """)

    result = await db.execute(plan_distribution_query)
    plan_rows = result.fetchall()

    plan_counts = {row.code: row.count for row in plan_rows}

    # Revenus (MRR et ARR)
    revenue_query = text("""
        SELECT
            COALESCE(SUM(p.price_monthly), 0) as mrr
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'active'
    """)

    result = await db.execute(revenue_query)
    revenue_row = result.fetchone()
    mrr = float(revenue_row.mrr) if revenue_row else 0.0

    # Utilisation globale
    # Note: patients et encounters n'ont pas de tenant_id, on joint via users/sites
    usage_query = text("""
        SELECT
            COUNT(DISTINCT u.id) as total_users,
            COUNT(DISTINCT p.id) as total_patients,
            COUNT(DISTINCT e.id) as total_encounters
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN patients p ON p.site_id IN (SELECT s.id FROM sites s JOIN districts d ON s.district_id = d.id)
        LEFT JOIN encounters e ON e.user_id = u.id
    """)

    result = await db.execute(usage_query)
    usage_row = result.fetchone()

    # Stockage total
    storage_query = text("""
        SELECT COALESCE(SUM(a.size_bytes), 0) as total_bytes
        FROM attachments a
        WHERE a.uploaded = true
    """)

    result = await db.execute(storage_query)
    storage_row = result.fetchone()
    total_storage_bytes = int(storage_row.total_bytes) if storage_row else 0

    # Sites (centres de santé)
    sites_query = text("""
        SELECT
            COUNT(*) as total_sites,
            COUNT(CASE WHEN actif = true THEN 1 END) as active_sites
        FROM sites
    """)

    result = await db.execute(sites_query)
    sites_row = result.fetchone()
    total_sites = int(sites_row.total_sites) if sites_row else 0
    active_sites = int(sites_row.active_sites) if sites_row else 0

    # Top 10 tenants les plus actifs
    # Note: patients appartiennent au site, on joint via users.site_id
    top_tenants_query = text("""
        SELECT
            t.id,
            t.name,
            t.created_at,
            COUNT(DISTINCT u.id) as total_users,
            COUNT(DISTINCT p.id) as total_patients,
            COUNT(DISTINCT e.id) as total_encounters,
            pl.name as plan_name,
            pl.code as plan_code,
            s.status as subscription_status,
            pl.price_monthly as monthly_revenue
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN patients p ON p.site_id = u.site_id
        LEFT JOIN encounters e ON e.user_id = u.id
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plans pl ON pl.id = s.plan_id
        WHERE s.status = 'active'
        GROUP BY t.id, t.name, t.created_at, pl.name, pl.code, s.status, pl.price_monthly
        ORDER BY total_encounters DESC
        LIMIT 10
    """)

    result = await db.execute(top_tenants_query)
    top_tenant_rows = result.fetchall()

    top_tenants = [
        TenantStats(
            id=str(row.id),
            name=row.name,
            created_at=row.created_at,
            total_users=row.total_users,
            total_patients=row.total_patients,
            total_encounters=row.total_encounters,
            plan_name=row.plan_name or "Aucun",
            plan_code=row.plan_code or "none",
            subscription_status=row.subscription_status or "inactive",
            monthly_revenue=float(row.monthly_revenue or 0)
        )
        for row in top_tenant_rows
    ]

    return GlobalStats(
        total_tenants=tenant_stats.total_tenants,
        active_tenants=tenant_stats.active_tenants or 0,
        new_tenants_this_month=tenant_stats.new_tenants_this_month or 0,
        total_sites=total_sites,
        active_sites=active_sites,
        total_free_plan=plan_counts.get('free', 0),
        total_starter_plan=plan_counts.get('starter', 0),
        total_pro_plan=plan_counts.get('pro', 0),
        total_enterprise_plan=plan_counts.get('enterprise', 0),
        mrr=mrr,
        arr=mrr * 12,
        total_users=usage_row.total_users,
        total_patients=usage_row.total_patients,
        total_encounters=usage_row.total_encounters,
        total_storage_bytes=total_storage_bytes,
        top_tenants=top_tenants
    )


# ===========================================================================
# GET REVENUE BY MONTH (derniers 12 mois)
# ===========================================================================

@router.get("/revenue-by-month", response_model=list[RevenueByMonth])
async def get_revenue_by_month(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Retourne l'évolution des revenus sur les 12 derniers mois"""

    # Générer les 12 derniers mois
    query = text("""
        WITH months AS (
            SELECT
                TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11)), 'YYYY-MM') as month
        )
        SELECT
            m.month,
            COALESCE(SUM(p.price_monthly), 0) as revenue,
            COUNT(DISTINCT s.id) as new_subscriptions
        FROM months m
        LEFT JOIN subscriptions s ON TO_CHAR(s.created_at, 'YYYY-MM') = m.month
        LEFT JOIN plans p ON p.id = s.plan_id
        GROUP BY m.month
        ORDER BY m.month DESC
    """)

    result = await db.execute(query)
    rows = result.fetchall()

    return [
        RevenueByMonth(
            month=row.month,
            revenue=float(row.revenue),
            new_subscriptions=row.new_subscriptions or 0
        )
        for row in rows
    ]


# ===========================================================================
# GET ALL TENANTS (avec pagination)
# ===========================================================================

@router.get("/tenants", response_model=list[TenantStats])
async def list_all_tenants(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Liste tous les tenants avec leurs statistiques"""

    # Note: patients appartiennent au site, on joint via users.site_id
    query = text("""
        SELECT
            t.id,
            t.name,
            t.created_at,
            COUNT(DISTINCT u.id) as total_users,
            COUNT(DISTINCT p.id) as total_patients,
            COUNT(DISTINCT e.id) as total_encounters,
            pl.name as plan_name,
            pl.code as plan_code,
            s.status as subscription_status,
            pl.price_monthly as monthly_revenue
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN patients p ON p.site_id = u.site_id
        LEFT JOIN encounters e ON e.user_id = u.id
        LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
        LEFT JOIN plans pl ON pl.id = s.plan_id
        GROUP BY t.id, t.name, t.created_at, pl.name, pl.code, s.status, pl.price_monthly
        ORDER BY t.created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    result = await db.execute(query, {"limit": limit, "offset": offset})
    rows = result.fetchall()

    return [
        TenantStats(
            id=str(row.id),
            name=row.name,
            created_at=row.created_at,
            total_users=row.total_users,
            total_patients=row.total_patients,
            total_encounters=row.total_encounters,
            plan_name=row.plan_name or "Aucun",
            plan_code=row.plan_code or "none",
            subscription_status=row.subscription_status or "inactive",
            monthly_revenue=float(row.monthly_revenue or 0)
        )
        for row in rows
    ]


# ===========================================================================
# GET USER STATS (Inscriptions et utilisateurs)
# ===========================================================================

class UserRoleStats(BaseModel):
    role: str
    count: int


class UserRegistrationsByMonth(BaseModel):
    month: str
    count: int


class UserStats(BaseModel):
    total_users: int
    active_users: int
    new_users_this_month: int
    new_users_this_week: int
    users_by_role: list[UserRoleStats]
    registrations_by_month: list[UserRegistrationsByMonth]


@router.get("/user-stats", response_model=UserStats)
async def get_user_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Retourne les statistiques détaillées des utilisateurs inscrits"""

    # Total et utilisateurs actifs
    total_query = text("""
        SELECT
            COUNT(*) as total_users,
            COUNT(CASE WHEN actif = true THEN 1 END) as active_users,
            COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month,
            COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as new_this_week
        FROM users
    """)

    result = await db.execute(total_query)
    total_row = result.fetchone()

    # Utilisateurs par rôle
    role_query = text("""
        SELECT
            role,
            COUNT(*) as count
        FROM users
        GROUP BY role
        ORDER BY count DESC
    """)

    result = await db.execute(role_query)
    role_rows = result.fetchall()

    users_by_role = [
        UserRoleStats(role=row.role, count=row.count)
        for row in role_rows
    ]

    # Inscriptions par mois (12 derniers mois)
    monthly_query = text("""
        WITH months AS (
            SELECT generate_series(
                DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
                DATE_TRUNC('month', CURRENT_DATE),
                '1 month'::interval
            ) as month
        )
        SELECT
            TO_CHAR(m.month, 'YYYY-MM') as month,
            COUNT(u.id) as count
        FROM months m
        LEFT JOIN users u ON DATE_TRUNC('month', u.created_at) = m.month
        GROUP BY m.month
        ORDER BY m.month ASC
    """)

    result = await db.execute(monthly_query)
    monthly_rows = result.fetchall()

    registrations_by_month = [
        UserRegistrationsByMonth(month=row.month, count=row.count)
        for row in monthly_rows
    ]

    return UserStats(
        total_users=total_row.total_users or 0,
        active_users=total_row.active_users or 0,
        new_users_this_month=total_row.new_this_month or 0,
        new_users_this_week=total_row.new_this_week or 0,
        users_by_role=users_by_role,
        registrations_by_month=registrations_by_month
    )
