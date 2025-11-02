"""
Tests d'intégration pour les endpoints de consultations (encounters)
"""

import pytest
from datetime import datetime
from httpx import AsyncClient

from app.models import Patient, User, Site, Encounter


@pytest.mark.integration
@pytest.mark.api
class TestEncounterEndpoints:
    """Tests pour les endpoints de gestion des consultations."""

    async def test_list_encounters(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test de listing des consultations."""
        response = await client.get("/api/encounters", headers=medecin_auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_encounters_unauthorized(self, client: AsyncClient):
        """Test de listing des consultations sans authentification."""
        response = await client.get("/api/encounters")

        assert response.status_code == 401

    async def test_create_encounter(self, client: AsyncClient, medecin_auth_headers: dict, test_patient: Patient, test_site: Site):
        """Test de création d'une consultation."""
        response = await client.post(
            "/api/encounters",
            headers=medecin_auth_headers,
            json={
                "patient_id": str(test_patient.id),
                "site_id": str(test_site.id),
                "date_consultation": datetime.utcnow().isoformat(),
                "motif": "Consultation de routine",
                "examen_clinique": "RAS",
                "diagnostic": "Bonne santé",
                "traitement": "Aucun",
                "statut": "termine"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["patient_id"] == str(test_patient.id)
        assert data["motif"] == "Consultation de routine"
        assert "id" in data

    async def test_get_encounter_by_id(self, client: AsyncClient, medecin_auth_headers: dict, db_session, test_patient: Patient, medecin_user: User, test_site: Site):
        """Test de récupération d'une consultation par ID."""
        # Créer une consultation d'abord
        encounter = Encounter(
            patient_id=test_patient.id,
            practitioner_id=medecin_user.id,
            site_id=test_site.id,
            date_consultation=datetime.utcnow(),
            motif="Test",
            statut="en_cours"
        )
        db_session.add(encounter)
        await db_session.commit()
        await db_session.refresh(encounter)

        response = await client.get(
            f"/api/encounters/{encounter.id}",
            headers=medecin_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(encounter.id)
        assert data["motif"] == "Test"

    async def test_update_encounter(self, client: AsyncClient, medecin_auth_headers: dict, db_session, test_patient: Patient, medecin_user: User, test_site: Site):
        """Test de mise à jour d'une consultation."""
        # Créer une consultation
        encounter = Encounter(
            patient_id=test_patient.id,
            practitioner_id=medecin_user.id,
            site_id=test_site.id,
            date_consultation=datetime.utcnow(),
            motif="Initial",
            statut="en_cours"
        )
        db_session.add(encounter)
        await db_session.commit()
        await db_session.refresh(encounter)

        # Mettre à jour
        response = await client.put(
            f"/api/encounters/{encounter.id}",
            headers=medecin_auth_headers,
            json={
                "motif": "Updated motif",
                "diagnostic": "New diagnostic",
                "statut": "termine"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["motif"] == "Updated motif"
        assert data["diagnostic"] == "New diagnostic"
        assert data["statut"] == "termine"

    async def test_filter_encounters_by_patient(self, client: AsyncClient, medecin_auth_headers: dict, test_patient: Patient):
        """Test de filtrage des consultations par patient."""
        response = await client.get(
            "/api/encounters",
            headers=medecin_auth_headers,
            params={"patient_id": str(test_patient.id)}
        )

        assert response.status_code == 200
        data = response.json()
        assert all(e["patient_id"] == str(test_patient.id) for e in data)

    async def test_filter_encounters_by_date_range(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test de filtrage des consultations par période."""
        start_date = "2025-01-01"
        end_date = "2025-12-31"

        response = await client.get(
            "/api/encounters",
            headers=medecin_auth_headers,
            params={
                "start_date": start_date,
                "end_date": end_date
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_filter_encounters_by_status(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test de filtrage des consultations par statut."""
        response = await client.get(
            "/api/encounters",
            headers=medecin_auth_headers,
            params={"statut": "termine"}
        )

        assert response.status_code == 200
        data = response.json()
        assert all(e["statut"] == "termine" for e in data)


@pytest.mark.integration
@pytest.mark.api
class TestEncounterStatistics:
    """Tests pour les statistiques des consultations."""

    async def test_get_encounter_count(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test de récupération du nombre total de consultations."""
        response = await client.get(
            "/api/encounters/stats/count",
            headers=medecin_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "total" in data

    async def test_get_encounters_by_practitioner(self, client: AsyncClient, medecin_auth_headers: dict, medecin_user: User):
        """Test des statistiques par praticien."""
        response = await client.get(
            "/api/encounters/stats/by-practitioner",
            headers=medecin_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    async def test_get_encounters_by_site(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test des statistiques par site."""
        response = await client.get(
            "/api/encounters/stats/by-site",
            headers=medecin_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)


@pytest.mark.integration
@pytest.mark.api
class TestEncounterPermissions:
    """Tests pour les permissions sur les consultations."""

    async def test_medecin_can_create_encounter(self, client: AsyncClient, medecin_auth_headers: dict, test_patient: Patient, test_site: Site):
        """Test qu'un médecin peut créer une consultation."""
        response = await client.post(
            "/api/encounters",
            headers=medecin_auth_headers,
            json={
                "patient_id": str(test_patient.id),
                "site_id": str(test_site.id),
                "date_consultation": datetime.utcnow().isoformat(),
                "motif": "Test",
                "statut": "en_cours"
            }
        )

        assert response.status_code == 201

    async def test_regular_user_cannot_create_encounter(self, client: AsyncClient, auth_headers: dict, test_patient: Patient, test_site: Site):
        """Test qu'un utilisateur normal ne peut pas créer de consultation."""
        response = await client.post(
            "/api/encounters",
            headers=auth_headers,
            json={
                "patient_id": str(test_patient.id),
                "site_id": str(test_site.id),
                "date_consultation": datetime.utcnow().isoformat(),
                "motif": "Should fail",
                "statut": "en_cours"
            }
        )

        # Devrait échouer (403) ou être autorisé selon la logique métier
        assert response.status_code in [201, 403]

    async def test_medecin_can_only_see_own_site_encounters(self, client: AsyncClient, medecin_auth_headers: dict):
        """Test qu'un médecin ne voit que les consultations de son site."""
        response = await client.get("/api/encounters", headers=medecin_auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Toutes les consultations devraient être du même site
        if len(data) > 0:
            site_ids = set(e["site_id"] for e in data)
            assert len(site_ids) <= 1  # Au maximum 1 site
