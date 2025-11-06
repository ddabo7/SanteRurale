"""
Configuration pytest simplifiée pour tests multi-tenant
"""
import asyncio
import uuid as uuid_module
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.database import get_db
from app.models.base_models import Base
from app.models import User, Site, Patient
from app.security import create_access_token, hash_password

TEST_DATABASE_URL = "postgresql+asyncpg://sante:sante_pwd@db:5432/sante_rurale"


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Créer une session de base de données pour chaque test"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Créer un client HTTP de test"""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()


@pytest.fixture
async def site(db_session: AsyncSession):
    """Créer un site de test"""
    site = Site(
        id=uuid_module.uuid4(),
        nom="Site de Test",
        code="TEST-SITE",
        type="cscom",
        commune="Test Commune",
        cercle="Test Cercle",
        region="Test Region"
    )
    db_session.add(site)
    await db_session.commit()
    await db_session.refresh(site)
    return site
