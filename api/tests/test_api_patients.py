"""
Tests d'intégration pour les endpoints patients
"""

import pytest
from datetime import datetime
from httpx import AsyncClient

from app.models import Patient, Site


@pytest.mark.integration
@pytest.mark.api
class TestPatientEndpoints:
    """Tests pour les endpoints de gestion des patients."""

    async def test_list_patients(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test de listing des patients."""
        response = await client.get("/api/patients", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_list_patients_unauthorized(self, client: AsyncClient):
        """Test de listing des patients sans authentification."""
        response = await client.get("/api/patients")

        assert response.status_code == 401

    async def test_get_patient_by_id(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test de récupération d'un patient par ID."""
        response = await client.get(
            f"/api/patients/{test_patient.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_patient.id)
        assert data["nom"] == test_patient.nom
        assert data["prenom"] == test_patient.prenom

    async def test_get_nonexistent_patient(self, client: AsyncClient, auth_headers: dict):
        """Test de récupération d'un patient inexistant."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/patients/{fake_uuid}",
            headers=auth_headers
        )

        assert response.status_code == 404

    async def test_create_patient(self, client: AsyncClient, auth_headers: dict, test_site: Site):
        """Test de création d'un patient."""
        response = await client.post(
            "/api/patients",
            headers=auth_headers,
            json={
                "nom": "Nouveau",
                "prenom": "Patient",
                "date_naissance": "1995-06-15",
                "sexe": "F",
                "telephone": "+22398765433",
                "adresse": "Nouvelle adresse",
                "site_id": str(test_site.id),
                "numero_dossier": "NEW-001"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["nom"] == "Nouveau"
        assert data["prenom"] == "Patient"
        assert data["sexe"] == "F"
        assert "id" in data

    async def test_create_patient_invalid_sexe(self, client: AsyncClient, auth_headers: dict, test_site: Site):
        """Test de création d'un patient avec sexe invalide."""
        response = await client.post(
            "/api/patients",
            headers=auth_headers,
            json={
                "nom": "Test",
                "prenom": "Patient",
                "date_naissance": "1990-01-01",
                "sexe": "X",  # Invalide
                "site_id": str(test_site.id),
                "numero_dossier": "INVALID-001"
            }
        )

        assert response.status_code == 422  # Validation error

    async def test_create_patient_duplicate_numero_dossier(self, client: AsyncClient, auth_headers: dict, test_patient: Patient, test_site: Site):
        """Test de création d'un patient avec numéro de dossier déjà utilisé."""
        response = await client.post(
            "/api/patients",
            headers=auth_headers,
            json={
                "nom": "Duplicate",
                "prenom": "Patient",
                "date_naissance": "1990-01-01",
                "sexe": "M",
                "site_id": str(test_site.id),
                "numero_dossier": test_patient.numero_dossier  # Déjà utilisé
            }
        )

        assert response.status_code == 400

    async def test_update_patient(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test de mise à jour d'un patient."""
        response = await client.put(
            f"/api/patients/{test_patient.id}",
            headers=auth_headers,
            json={
                "nom": "NomModifie",
                "prenom": "PrenomModifie",
                "telephone": "+22398765434"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["nom"] == "NomModifie"
        assert data["prenom"] == "PrenomModifie"
        assert data["telephone"] == "+22398765434"

    async def test_search_patients_by_name(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test de recherche de patients par nom."""
        response = await client.get(
            "/api/patients",
            headers=auth_headers,
            params={"search": test_patient.nom}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(p["nom"] == test_patient.nom for p in data)

    async def test_search_patients_by_numero_dossier(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test de recherche de patients par numéro de dossier."""
        response = await client.get(
            "/api/patients",
            headers=auth_headers,
            params={"numero_dossier": test_patient.numero_dossier}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["numero_dossier"] == test_patient.numero_dossier

    async def test_filter_patients_by_site(self, client: AsyncClient, auth_headers: dict, test_patient: Patient, test_site: Site):
        """Test de filtrage des patients par site."""
        response = await client.get(
            "/api/patients",
            headers=auth_headers,
            params={"site_id": str(test_site.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert all(p["site_id"] == str(test_site.id) for p in data)

    async def test_delete_patient(self, client: AsyncClient, admin_auth_headers: dict, test_patient: Patient):
        """Test de suppression d'un patient (admin seulement)."""
        response = await client.delete(
            f"/api/patients/{test_patient.id}",
            headers=admin_auth_headers
        )

        assert response.status_code == 204

        # Vérifier que le patient est bien supprimé
        get_response = await client.get(
            f"/api/patients/{test_patient.id}",
            headers=admin_auth_headers
        )
        assert get_response.status_code == 404

    async def test_regular_user_cannot_delete_patient(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test qu'un utilisateur normal ne peut pas supprimer de patients."""
        response = await client.delete(
            f"/api/patients/{test_patient.id}",
            headers=auth_headers
        )

        assert response.status_code == 403


@pytest.mark.integration
@pytest.mark.api
class TestPatientStatistics:
    """Tests pour les statistiques des patients."""

    async def test_get_patient_count(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test de récupération du nombre total de patients."""
        response = await client.get(
            "/api/patients/stats/count",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert data["total"] >= 1

    async def test_get_patient_statistics_by_age(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test des statistiques par tranche d'âge."""
        response = await client.get(
            "/api/patients/stats/by-age",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        # Devrait contenir des tranches d'âge

    async def test_get_patient_statistics_by_gender(self, client: AsyncClient, auth_headers: dict, test_patient: Patient):
        """Test des statistiques par sexe."""
        response = await client.get(
            "/api/patients/stats/by-gender",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "M" in data or "F" in data
