"""
Tests d'intégration pour le flux complet de vérification d'email.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.main import app
from app.models import District, Region, Site, User


@pytest.mark.asyncio
async def test_email_verification_flow(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Vérifie qu'un utilisateur peut s'inscrire, recevoir un token, le valider
    puis se connecter avec succès.
    """
    sent_email: dict[str, Any] = {}

    def fake_send_verification_email(to_email: str, token: str, user_name: str) -> None:
        sent_email.update({
            "email": to_email,
            "token": token,
            "user_name": user_name,
        })

    monkeypatch.setattr("app.routers.auth.send_verification_email", fake_send_verification_email)

    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    created_region_id: UUID | None = None
    created_user_id: UUID | None = None

    test_email = f"test.verify+{uuid4().hex}@example.com"
    test_password = "SecurePass1!"

    try:
        # S'assurer qu'il existe au moins un site pour l'affectation automatique
        async with async_session() as session:
            result = await session.execute(select(Site).limit(1))
            site = result.scalar_one_or_none()

            if site is None:
                # Créer un trio Région > District > Site minimal pour le test
                region = Region(
                    nom="Test Région Vérification",
                    code=f"test-region-{uuid4().hex[:8]}"
                )
                district = District(
                    nom="Test District Vérification",
                    code=f"test-district-{uuid4().hex[:8]}",
                    region=region,
                )
                site = Site(
                    nom="Site Test Vérification",
                    type="cscom",
                    district=district,
                )

                session.add_all([region, district, site])
                await session.commit()
                created_region_id = region.id

        # 1. Inscription
        with TestClient(app) as client:
            signup_response = client.post(
                "/api/auth/signup",
                json={
                    "email": test_email,
                    "password": test_password,
                    "nom": "Test",
                    "prenom": "Vérification",
                    "telephone": "+22370123456",
                },
            )
            assert signup_response.status_code == 201, signup_response.text

            # Le token doit avoir été "envoyé" via l'email mocké
            assert sent_email.get("token"), "Le token de vérification n'a pas été généré"
            assert sent_email["email"] == test_email

            # Récupérer l'utilisateur et son token
            async with async_session() as session:
                result = await session.execute(select(User).where(User.email == test_email))
                user = result.scalar_one()
                created_user_id = user.id
                token = user.verification_token or sent_email["token"]
                assert user.email_verified is False

            # 2. Vérification de l'email
            verify_response = client.post(
                "/api/auth/verify-email",
                json={"token": token},
            )
            assert verify_response.status_code == 200, verify_response.text

            async with async_session() as session:
                result = await session.execute(select(User).where(User.email == test_email))
                user = result.scalar_one()
                assert user.email_verified is True

            # 3. Connexion réussie après vérification
            login_response = client.post(
                "/api/auth/login",
                json={"email": test_email, "password": test_password},
            )
            assert login_response.status_code == 200, login_response.text
            payload = login_response.json()
            assert payload["user"]["email"] == test_email
            assert payload["access_token"]

    finally:
        # Nettoyage des données de test
        async with async_session() as session:
            if created_user_id:
                await session.execute(delete(User).where(User.id == created_user_id))

            if created_region_id:
                region = await session.get(Region, created_region_id)
                if region:
                    await session.delete(region)

            await session.commit()

        await engine.dispose()
