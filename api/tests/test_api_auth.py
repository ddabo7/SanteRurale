"""
Tests d'intégration pour les endpoints d'authentification
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


# ============================================================================
# Tests pour l'authentification
# ============================================================================

@pytest.mark.integration
@pytest.mark.api
@pytest.mark.auth
class TestAuthEndpoints:
    """Tests pour les endpoints d'authentification."""

    async def test_login_success(self, client: AsyncClient, test_user: User):
        """Test de connexion réussie."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpassword123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"

    async def test_login_invalid_email(self, client: AsyncClient):
        """Test de connexion avec email invalide."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "wrongpassword"
            }
        )

        assert response.status_code == 401
        assert "detail" in response.json()

    async def test_login_invalid_password(self, client: AsyncClient, test_user: User):
        """Test de connexion avec mot de passe invalide."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword"
            }
        )

        assert response.status_code == 401
        assert "detail" in response.json()

    async def test_login_inactive_user(self, client: AsyncClient, db_session: AsyncSession, test_user: User):
        """Test de connexion avec utilisateur inactif."""
        # Désactiver l'utilisateur
        test_user.actif = False
        await db_session.commit()

        response = await client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpassword123"
            }
        )

        assert response.status_code == 401
        assert "inactif" in response.json()["detail"].lower()

    async def test_get_current_user(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """Test de récupération de l'utilisateur connecté."""
        response = await client.get("/api/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["nom"] == test_user.nom
        assert data["prenom"] == test_user.prenom

    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test de récupération utilisateur sans authentification."""
        response = await client.get("/api/auth/me")

        assert response.status_code == 401

    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test avec token JWT invalide."""
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalidtoken"}
        )

        assert response.status_code == 401


# ============================================================================
# Tests pour les endpoints de gestion des utilisateurs
# ============================================================================

@pytest.mark.integration
@pytest.mark.api
class TestUserEndpoints:
    """Tests pour les endpoints de gestion des utilisateurs."""

    async def test_list_users_as_admin(self, client: AsyncClient, admin_auth_headers: dict, test_user: User, admin_user: User):
        """Test de listing des utilisateurs en tant qu'admin."""
        response = await client.get("/api/users", headers=admin_auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # Au moins test_user et admin_user

    async def test_list_users_unauthorized(self, client: AsyncClient):
        """Test de listing sans authentification."""
        response = await client.get("/api/users")

        assert response.status_code == 401

    async def test_get_user_by_id(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test de récupération d'un utilisateur par ID."""
        response = await client.get(
            f"/api/users/{test_user.id}",
            headers=admin_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email

    async def test_get_nonexistent_user(self, client: AsyncClient, admin_auth_headers: dict):
        """Test de récupération d'un utilisateur inexistant."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/users/{fake_uuid}",
            headers=admin_auth_headers
        )

        assert response.status_code == 404

    async def test_create_user_as_admin(self, client: AsyncClient, admin_auth_headers: dict, test_role: str, test_site: str):
        """Test de création d'utilisateur en tant qu'admin."""
        response = await client.post(
            "/api/users",
            headers=admin_auth_headers,
            json={
                "nom": "Nouveau",
                "prenom": "Utilisateur",
                "email": "nouveau@example.com",
                "telephone": "+22312345690",
                "password": "newpassword123",
                "role_id": str(test_role.id),
                "site_id": str(test_site.id)
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "nouveau@example.com"
        assert "id" in data

    async def test_create_user_duplicate_email(self, client: AsyncClient, admin_auth_headers: dict, test_user: User, test_role: str, test_site: str):
        """Test de création d'utilisateur avec email déjà utilisé."""
        response = await client.post(
            "/api/users",
            headers=admin_auth_headers,
            json={
                "nom": "Duplicate",
                "prenom": "User",
                "email": test_user.email,  # Email déjà utilisé
                "telephone": "+22312345691",
                "password": "password123",
                "role_id": str(test_role.id),
                "site_id": str(test_site.id)
            }
        )

        assert response.status_code == 400

    async def test_update_user(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test de mise à jour d'un utilisateur."""
        response = await client.put(
            f"/api/users/{test_user.id}",
            headers=admin_auth_headers,
            json={
                "nom": "UpdatedName",
                "prenom": "UpdatedFirstName"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["nom"] == "UpdatedName"
        assert data["prenom"] == "UpdatedFirstName"

    async def test_delete_user(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test de suppression d'un utilisateur."""
        response = await client.delete(
            f"/api/users/{test_user.id}",
            headers=admin_auth_headers
        )

        assert response.status_code == 204

        # Vérifier que l'utilisateur est bien supprimé
        get_response = await client.get(
            f"/api/users/{test_user.id}",
            headers=admin_auth_headers
        )
        assert get_response.status_code == 404


# ============================================================================
# Tests pour les permissions
# ============================================================================

@pytest.mark.integration
@pytest.mark.api
@pytest.mark.auth
class TestPermissions:
    """Tests pour les permissions et autorisations."""

    async def test_regular_user_cannot_list_all_users(self, client: AsyncClient, auth_headers: dict):
        """Test qu'un utilisateur normal ne peut pas lister tous les utilisateurs."""
        response = await client.get("/api/users", headers=auth_headers)

        # Devrait être refusé ou retourner seulement son propre compte
        assert response.status_code in [403, 200]
        if response.status_code == 200:
            data = response.json()
            assert len(data) <= 1  # Seulement son propre compte

    async def test_regular_user_cannot_create_user(self, client: AsyncClient, auth_headers: dict, test_role: str, test_site: str):
        """Test qu'un utilisateur normal ne peut pas créer d'utilisateurs."""
        response = await client.post(
            "/api/users",
            headers=auth_headers,
            json={
                "nom": "Test",
                "prenom": "User",
                "email": "shouldfail@example.com",
                "telephone": "+22312345692",
                "password": "password123",
                "role_id": str(test_role.id),
                "site_id": str(test_site.id)
            }
        )

        assert response.status_code == 403

    async def test_medecin_can_access_own_patients(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test qu'un médecin peut accéder à ses patients."""
        response = await client.get("/api/patients", headers=medecin_auth_headers)

        assert response.status_code == 200
        assert isinstance(response.json(), list)
