"""
Configuration pytest et fixtures partagées
"""

import asyncio
import os
from typing import AsyncGenerator, Generator
from datetime import datetime, timedelta
import uuid as uuid_module

import pytest
from httpx import AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db, Base
from app.models import User, Role, Region, District, Site, Patient
from app.auth import create_access_token, get_password_hash
from app.config import settings


# ============================================================================
# Configuration de la base de données de test
# ============================================================================

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/sante_rurale_test"
TEST_SYNC_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/sante_rurale_test"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Créer un event loop pour toute la session de tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def create_test_database():
    """Créer et supprimer la base de données de test."""
    # Utiliser la connexion synchrone pour créer/supprimer la DB
    engine = create_engine("postgresql://postgres:postgres@localhost:5432/postgres")

    with engine.connect() as conn:
        # Terminer toutes les connexions existantes
        conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sante_rurale_test'"))
        conn.commit()

        # Supprimer si existe
        conn.execute(text("DROP DATABASE IF EXISTS sante_rurale_test"))
        conn.commit()

        # Créer la base
        conn.execute(text("CREATE DATABASE sante_rurale_test"))
        conn.commit()

    engine.dispose()

    yield

    # Cleanup après tous les tests
    engine = create_engine("postgresql://postgres:postgres@localhost:5432/postgres")
    with engine.connect() as conn:
        conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sante_rurale_test'"))
        conn.commit()
        conn.execute(text("DROP DATABASE IF EXISTS sante_rurale_test"))
        conn.commit()
    engine.dispose()


@pytest.fixture(scope="session")
async def test_engine(create_test_database):
    """Créer le moteur de base de données pour les tests."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )

    # Créer toutes les tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Créer une session de base de données pour chaque test."""
    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Créer un client HTTP de test."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ============================================================================
# Fixtures pour les données de test
# ============================================================================

@pytest.fixture
async def test_role(db_session: AsyncSession) -> Role:
    """Créer un rôle de test."""
    role = Role(
        id=uuid_module.uuid4(),
        nom="Test Role",
        code="TEST",
        niveau_acces=1,
        description="Role de test"
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest.fixture
async def admin_role(db_session: AsyncSession) -> Role:
    """Créer un rôle admin."""
    role = Role(
        id=uuid_module.uuid4(),
        nom="Administrateur",
        code="ADMIN",
        niveau_acces=4,
        description="Administrateur système"
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest.fixture
async def medecin_role(db_session: AsyncSession) -> Role:
    """Créer un rôle médecin."""
    role = Role(
        id=uuid_module.uuid4(),
        nom="Médecin",
        code="MEDECIN",
        niveau_acces=3,
        description="Médecin"
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


@pytest.fixture
async def test_region(db_session: AsyncSession) -> Region:
    """Créer une région de test."""
    region = Region(
        id=uuid_module.uuid4(),
        nom="Région Test",
        code="TEST-REG",
        created_at=datetime.utcnow()
    )
    db_session.add(region)
    await db_session.commit()
    await db_session.refresh(region)
    return region


@pytest.fixture
async def test_district(db_session: AsyncSession, test_region: Region) -> District:
    """Créer un district de test."""
    district = District(
        id=uuid_module.uuid4(),
        nom="District Test",
        code="TEST-DIST",
        region_id=test_region.id,
        created_at=datetime.utcnow()
    )
    db_session.add(district)
    await db_session.commit()
    await db_session.refresh(district)
    return district


@pytest.fixture
async def test_site(db_session: AsyncSession, test_district: District) -> Site:
    """Créer un site de test."""
    site = Site(
        id=uuid_module.uuid4(),
        nom="Site Test",
        code="TEST-SITE",
        type_site="CSCOM",
        district_id=test_district.id,
        latitude=12.6392,
        longitude=-8.0029,
        actif=True
    )
    db_session.add(site)
    await db_session.commit()
    await db_session.refresh(site)
    return site


@pytest.fixture
async def test_user(db_session: AsyncSession, test_role: Role, test_site: Site) -> User:
    """Créer un utilisateur de test."""
    user = User(
        id=uuid_module.uuid4(),
        nom="Test",
        prenom="User",
        email="test@example.com",
        telephone="+22312345678",
        mot_de_passe_hash=get_password_hash("testpassword123"),
        role_id=test_role.id,
        site_id=test_site.id,
        actif=True,
        email_verifie=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession, admin_role: Role, test_site: Site) -> User:
    """Créer un utilisateur admin de test."""
    user = User(
        id=uuid_module.uuid4(),
        nom="Admin",
        prenom="Test",
        email="admin@example.com",
        telephone="+22312345679",
        mot_de_passe_hash=get_password_hash("adminpassword123"),
        role_id=admin_role.id,
        site_id=test_site.id,
        actif=True,
        email_verifie=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def medecin_user(db_session: AsyncSession, medecin_role: Role, test_site: Site) -> User:
    """Créer un utilisateur médecin de test."""
    user = User(
        id=uuid_module.uuid4(),
        nom="Médecin",
        prenom="Test",
        email="medecin@example.com",
        telephone="+22312345680",
        mot_de_passe_hash=get_password_hash("medecinpassword123"),
        role_id=medecin_role.id,
        site_id=test_site.id,
        actif=True,
        email_verifie=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_patient(db_session: AsyncSession, test_site: Site) -> Patient:
    """Créer un patient de test."""
    patient = Patient(
        id=uuid_module.uuid4(),
        nom="Patient",
        prenom="Test",
        date_naissance=datetime(1990, 1, 1),
        sexe="M",
        telephone="+22398765432",
        adresse="Adresse Test",
        site_id=test_site.id,
        numero_dossier="TEST-001"
    )
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)
    return patient


# ============================================================================
# Fixtures pour l'authentification
# ============================================================================

@pytest.fixture
def test_user_token(test_user: User) -> str:
    """Générer un token JWT pour l'utilisateur de test."""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest.fixture
def admin_user_token(admin_user: User) -> str:
    """Générer un token JWT pour l'admin de test."""
    return create_access_token(data={"sub": str(admin_user.id)})


@pytest.fixture
def medecin_user_token(medecin_user: User) -> str:
    """Générer un token JWT pour le médecin de test."""
    return create_access_token(data={"sub": str(medecin_user.id)})


@pytest.fixture
def auth_headers(test_user_token: str) -> dict:
    """Headers avec authentification pour les requêtes de test."""
    return {"Authorization": f"Bearer {test_user_token}"}


@pytest.fixture
def admin_auth_headers(admin_user_token: str) -> dict:
    """Headers avec authentification admin pour les requêtes de test."""
    return {"Authorization": f"Bearer {admin_user_token}"}


@pytest.fixture
def medecin_auth_headers(medecin_user_token: str) -> dict:
    """Headers avec authentification médecin pour les requêtes de test."""
    return {"Authorization": f"Bearer {medecin_user_token}"}
