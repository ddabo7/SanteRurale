"""
Tests unitaires pour les modèles de base de données
"""

import pytest
from datetime import datetime, timedelta
import uuid as uuid_module

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Role, Region, District, Site, Patient, Encounter
from app.auth import verify_password


# ============================================================================
# Tests pour le modèle Role
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestRole:
    """Tests pour le modèle Role."""

    async def test_create_role(self, db_session: AsyncSession):
        """Test de création d'un rôle."""
        role = Role(
            id=uuid_module.uuid4(),
            nom="Test Role",
            code="TEST",
            niveau_acces=2,
            description="Test description"
        )
        db_session.add(role)
        await db_session.commit()
        await db_session.refresh(role)

        assert role.id is not None
        assert role.nom == "Test Role"
        assert role.code == "TEST"
        assert role.niveau_acces == 2
        assert role.description == "Test description"

    async def test_role_unique_code(self, db_session: AsyncSession):
        """Test que le code du rôle est unique."""
        role1 = Role(
            id=uuid_module.uuid4(),
            nom="Role 1",
            code="UNIQUE",
            niveau_acces=1
        )
        db_session.add(role1)
        await db_session.commit()

        role2 = Role(
            id=uuid_module.uuid4(),
            nom="Role 2",
            code="UNIQUE",
            niveau_acces=2
        )
        db_session.add(role2)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()


# ============================================================================
# Tests pour le modèle User
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestUser:
    """Tests pour le modèle User."""

    async def test_create_user(self, test_user: User):
        """Test de création d'un utilisateur."""
        assert test_user.id is not None
        assert test_user.nom == "Test"
        assert test_user.prenom == "User"
        assert test_user.email == "test@example.com"
        assert test_user.actif is True
        assert test_user.email_verifie is True

    async def test_user_password_hashing(self, test_user: User):
        """Test que le mot de passe est bien hashé."""
        assert test_user.mot_de_passe_hash != "testpassword123"
        assert verify_password("testpassword123", test_user.mot_de_passe_hash)

    async def test_user_email_unique(self, db_session: AsyncSession, test_user: User, test_role: Role, test_site: Site):
        """Test que l'email est unique."""
        duplicate_user = User(
            id=uuid_module.uuid4(),
            nom="Duplicate",
            prenom="User",
            email=test_user.email,  # Même email
            telephone="+22312345681",
            mot_de_passe_hash="hash",
            role_id=test_role.id,
            site_id=test_site.id
        )
        db_session.add(duplicate_user)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()

    async def test_user_relationships(self, test_user: User, test_role: Role, test_site: Site):
        """Test des relations du modèle User."""
        assert test_user.role_id == test_role.id
        assert test_user.site_id == test_site.id


# ============================================================================
# Tests pour le modèle Region
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestRegion:
    """Tests pour le modèle Region."""

    async def test_create_region(self, test_region: Region):
        """Test de création d'une région."""
        assert test_region.id is not None
        assert test_region.nom == "Région Test"
        assert test_region.code == "TEST-REG"
        assert test_region.created_at is not None

    async def test_region_unique_code(self, db_session: AsyncSession):
        """Test que le code de la région est unique."""
        region1 = Region(
            id=uuid_module.uuid4(),
            nom="Region 1",
            code="UNIQUE",
            created_at=datetime.utcnow()
        )
        db_session.add(region1)
        await db_session.commit()

        region2 = Region(
            id=uuid_module.uuid4(),
            nom="Region 2",
            code="UNIQUE",
            created_at=datetime.utcnow()
        )
        db_session.add(region2)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()


# ============================================================================
# Tests pour le modèle District
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestDistrict:
    """Tests pour le modèle District."""

    async def test_create_district(self, test_district: District, test_region: Region):
        """Test de création d'un district."""
        assert test_district.id is not None
        assert test_district.nom == "District Test"
        assert test_district.code == "TEST-DIST"
        assert test_district.region_id == test_region.id

    async def test_district_relationship(self, test_district: District, test_region: Region):
        """Test de la relation district -> région."""
        assert test_district.region_id == test_region.id


# ============================================================================
# Tests pour le modèle Site
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestSite:
    """Tests pour le modèle Site."""

    async def test_create_site(self, test_site: Site, test_district: District):
        """Test de création d'un site."""
        assert test_site.id is not None
        assert test_site.nom == "Site Test"
        assert test_site.code == "TEST-SITE"
        assert test_site.type_site == "CSCOM"
        assert test_site.district_id == test_district.id
        assert test_site.actif is True

    async def test_site_coordinates(self, test_site: Site):
        """Test que les coordonnées GPS sont valides."""
        assert test_site.latitude is not None
        assert test_site.longitude is not None
        assert -90 <= test_site.latitude <= 90
        assert -180 <= test_site.longitude <= 180

    async def test_site_unique_code(self, db_session: AsyncSession, test_district: District):
        """Test que le code du site est unique."""
        site1 = Site(
            id=uuid_module.uuid4(),
            nom="Site 1",
            code="UNIQUE",
            type_site="CSCOM",
            district_id=test_district.id,
            actif=True
        )
        db_session.add(site1)
        await db_session.commit()

        site2 = Site(
            id=uuid_module.uuid4(),
            nom="Site 2",
            code="UNIQUE",
            type_site="CSCOM",
            district_id=test_district.id,
            actif=True
        )
        db_session.add(site2)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()


# ============================================================================
# Tests pour le modèle Patient
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestPatient:
    """Tests pour le modèle Patient."""

    async def test_create_patient(self, test_patient: Patient):
        """Test de création d'un patient."""
        assert test_patient.id is not None
        assert test_patient.nom == "Patient"
        assert test_patient.prenom == "Test"
        assert test_patient.sexe == "M"
        assert test_patient.numero_dossier == "TEST-001"

    async def test_patient_age_calculation(self, test_patient: Patient):
        """Test du calcul de l'âge du patient."""
        # Patient né le 1990-01-01
        expected_age = datetime.utcnow().year - 1990
        # L'âge devrait être environ 35 ans en 2025
        assert 30 <= expected_age <= 40

    async def test_patient_unique_numero_dossier(self, db_session: AsyncSession, test_site: Site):
        """Test que le numéro de dossier est unique."""
        patient1 = Patient(
            id=uuid_module.uuid4(),
            nom="Patient 1",
            prenom="Test",
            date_naissance=datetime(1990, 1, 1),
            sexe="M",
            site_id=test_site.id,
            numero_dossier="UNIQUE-001"
        )
        db_session.add(patient1)
        await db_session.commit()

        patient2 = Patient(
            id=uuid_module.uuid4(),
            nom="Patient 2",
            prenom="Test",
            date_naissance=datetime(1991, 1, 1),
            sexe="F",
            site_id=test_site.id,
            numero_dossier="UNIQUE-001"
        )
        db_session.add(patient2)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()

    async def test_patient_sexe_values(self, db_session: AsyncSession, test_site: Site):
        """Test que le sexe ne peut être que M ou F."""
        patient = Patient(
            id=uuid_module.uuid4(),
            nom="Patient",
            prenom="Test",
            date_naissance=datetime(1990, 1, 1),
            sexe="X",  # Valeur invalide
            site_id=test_site.id,
            numero_dossier="TEST-SEX-001"
        )
        db_session.add(patient)

        # Devrait échouer car sexe n'est pas dans ('M', 'F')
        with pytest.raises(Exception):
            await db_session.commit()


# ============================================================================
# Tests pour le modèle Encounter
# ============================================================================

@pytest.mark.unit
@pytest.mark.db
class TestEncounter:
    """Tests pour le modèle Encounter (consultation)."""

    async def test_create_encounter(self, db_session: AsyncSession, test_patient: Patient, medecin_user: User, test_site: Site):
        """Test de création d'une consultation."""
        encounter = Encounter(
            id=uuid_module.uuid4(),
            patient_id=test_patient.id,
            practitioner_id=medecin_user.id,
            site_id=test_site.id,
            date_consultation=datetime.utcnow(),
            motif="Fièvre",
            examen_clinique="Examen normal",
            diagnostic="Paludisme",
            traitement="Artemether",
            statut="termine"
        )
        db_session.add(encounter)
        await db_session.commit()
        await db_session.refresh(encounter)

        assert encounter.id is not None
        assert encounter.patient_id == test_patient.id
        assert encounter.practitioner_id == medecin_user.id
        assert encounter.motif == "Fièvre"
        assert encounter.statut == "termine"

    async def test_encounter_relationships(self, db_session: AsyncSession, test_patient: Patient, medecin_user: User, test_site: Site):
        """Test des relations du modèle Encounter."""
        encounter = Encounter(
            id=uuid_module.uuid4(),
            patient_id=test_patient.id,
            practitioner_id=medecin_user.id,
            site_id=test_site.id,
            date_consultation=datetime.utcnow(),
            motif="Test",
            statut="en_cours"
        )
        db_session.add(encounter)
        await db_session.commit()

        assert encounter.patient_id == test_patient.id
        assert encounter.practitioner_id == medecin_user.id
        assert encounter.site_id == test_site.id
