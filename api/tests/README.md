# Tests Backend - Santé Rurale

Guide complet pour exécuter et maintenir les tests backend de l'application.

## 📋 Table des Matières

- [Structure des Tests](#structure-des-tests)
- [Configuration](#configuration)
- [Exécution des Tests](#exécution-des-tests)
- [Couverture de Code](#couverture-de-code)
- [Fixtures Disponibles](#fixtures-disponibles)
- [Marqueurs](#marqueurs)
- [Bonnes Pratiques](#bonnes-pratiques)

---

## 🗂️ Structure des Tests

```
api/tests/
├── conftest.py                    # Configuration pytest et fixtures globales
├── test_models.py                 # Tests unitaires des modèles SQLAlchemy
├── test_api_auth.py              # Tests API authentification
├── test_api_patients.py          # Tests API patients
├── test_api_encounters.py        # Tests API consultations
└── README.md                      # Ce fichier
```

### Types de Tests

1. **Tests Unitaires** (`test_models.py`)
   - Tests des modèles de données
   - Validation des contraintes
   - Tests des relations

2. **Tests d'Intégration** (`test_api_*.py`)
   - Tests des endpoints API
   - Tests d'authentification
   - Tests de permissions
   - Tests de validation

---

## ⚙️ Configuration

### Prérequis

1. **PostgreSQL** doit être en cours d'exécution
2. **Base de données de test** sera créée automatiquement

### Variables d'Environnement

Les tests utilisent une base de données dédiée :
```
postgresql+asyncpg://postgres:postgres@localhost:5432/sante_rurale_test
```

Pour modifier, éditez `tests/conftest.py`:
```python
TEST_DATABASE_URL = "postgresql+asyncpg://user:pass@host:port/dbname"
```

---

## 🚀 Exécution des Tests

### Tous les Tests

```bash
cd api
pytest
```

### Tests Spécifiques

```bash
# Exécuter un fichier de test
pytest tests/test_models.py

# Exécuter une classe de test
pytest tests/test_models.py::TestUser

# Exécuter un test spécifique
pytest tests/test_models.py::TestUser::test_create_user

# Exécuter avec verbose
pytest -v

# Exécuter avec output complet
pytest -vv
```

### Tests par Marqueur

```bash
# Tests unitaires seulement
pytest -m unit

# Tests d'intégration seulement
pytest -m integration

# Tests API
pytest -m api

# Tests d'authentification
pytest -m auth

# Tests base de données
pytest -m db

# Exclure les tests lents
pytest -m "not slow"
```

### Mode Watch (Développement)

```bash
# Installer pytest-watch
pip install pytest-watch

# Lancer en mode watch
ptw
```

---

## 📊 Couverture de Code

### Générer un Rapport de Couverture

```bash
# Rapport dans le terminal
pytest --cov=app --cov-report=term-missing

# Rapport HTML (recommandé)
pytest --cov=app --cov-report=html

# Ouvrir le rapport HTML
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

### Rapport XML (CI/CD)

```bash
pytest --cov=app --cov-report=xml
```

### Objectifs de Couverture

- **Minimum acceptable**: 70%
- **Objectif**: 85%
- **Excellent**: 95%+

---

## 🔧 Fixtures Disponibles

### Base de Données

- `db_session` - Session AsyncSession pour chaque test
- `test_engine` - Moteur de base de données de test
- `create_test_database` - Création/suppression de la DB de test

### Modèles de Test

- `test_role` - Rôle de test basique
- `admin_role` - Rôle administrateur
- `medecin_role` - Rôle médecin
- `test_region` - Région de test
- `test_district` - District de test
- `test_site` - Site de test (CSCOM)
- `test_patient` - Patient de test
- `test_user` - Utilisateur de test
- `admin_user` - Utilisateur admin
- `medecin_user` - Utilisateur médecin

### Authentification

- `test_user_token` - Token JWT pour utilisateur test
- `admin_user_token` - Token JWT pour admin
- `medecin_user_token` - Token JWT pour médecin
- `auth_headers` - Headers HTTP avec token utilisateur
- `admin_auth_headers` - Headers HTTP avec token admin
- `medecin_auth_headers` - Headers HTTP avec token médecin

### Client HTTP

- `client` - Client AsyncClient pour tester l'API

### Exemple d'Utilisation

```python
async def test_example(client: AsyncClient, auth_headers: dict, test_patient: Patient):
    """Exemple de test utilisant les fixtures."""
    response = await client.get(
        f"/api/patients/{test_patient.id}",
        headers=auth_headers
    )
    assert response.status_code == 200
```

---

## 🏷️ Marqueurs

Les tests utilisent des marqueurs pytest pour la catégorisation :

- `@pytest.mark.unit` - Tests unitaires
- `@pytest.mark.integration` - Tests d'intégration
- `@pytest.mark.api` - Tests d'API
- `@pytest.mark.auth` - Tests d'authentification
- `@pytest.mark.db` - Tests nécessitant la base de données
- `@pytest.mark.slow` - Tests lents

### Définir dans pytest.ini

```ini
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
    auth: Authentication tests
    db: Database tests
    api: API endpoint tests
```

---

## ✅ Bonnes Pratiques

### 1. Nommage des Tests

```python
# ✅ BON
async def test_user_can_login_with_valid_credentials():
    ...

# ❌ MAUVAIS
async def test1():
    ...
```

### 2. Arrange-Act-Assert (AAA)

```python
async def test_create_patient(client, auth_headers, test_site):
    # ARRANGE - Préparer les données
    patient_data = {
        "nom": "Test",
        "prenom": "Patient",
        "site_id": str(test_site.id)
    }

    # ACT - Exécuter l'action
    response = await client.post("/api/patients", json=patient_data, headers=auth_headers)

    # ASSERT - Vérifier les résultats
    assert response.status_code == 201
    assert response.json()["nom"] == "Test"
```

### 3. Tests Indépendants

Chaque test doit être indépendant et pouvoir s'exécuter seul :

```python
# ✅ BON - Utilise des fixtures
async def test_example(test_user):
    assert test_user.email == "test@example.com"

# ❌ MAUVAIS - Dépend d'un état global
user = None

async def test_create():
    global user
    user = User(...)

async def test_use():
    global user
    assert user is not None  # Dépend du test précédent
```

### 4. Utiliser des Assertions Explicites

```python
# ✅ BON
assert response.status_code == 200
assert "access_token" in response.json()
assert response.json()["user"]["email"] == "test@example.com"

# ❌ MAUVAIS
assert response.status_code  # Quelle valeur ?
assert response.json()  # Que teste-t-on ?
```

### 5. Tester les Cas Limites

```python
async def test_login_invalid_email(client):
    """Test avec email invalide."""
    ...

async def test_login_inactive_user(client):
    """Test avec utilisateur inactif."""
    ...

async def test_login_wrong_password(client):
    """Test avec mauvais mot de passe."""
    ...
```

---

## 🐛 Débogage

### Mode Verbose

```bash
pytest -vv
```

### Afficher les print()

```bash
pytest -s
```

### Arrêter au Premier Échec

```bash
pytest -x
```

### Déboguer avec pdb

```bash
pytest --pdb
```

Ou dans le code :
```python
import pdb; pdb.set_trace()
```

### Logs de Base de Données

Pour voir les requêtes SQL :
```python
# Dans conftest.py
engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=True,  # Active les logs SQL
    future=True,
)
```

---

## 📈 CI/CD

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          cd api
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd api
          pytest --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 🔄 Maintenance

### Ajouter un Nouveau Test

1. Créer le fichier de test dans `tests/`
2. Importer les fixtures nécessaires depuis `conftest.py`
3. Utiliser les marqueurs appropriés
4. Suivre la convention AAA
5. Exécuter le test : `pytest tests/test_nouveau.py`

### Ajouter une Nouvelle Fixture

Dans `conftest.py` :

```python
@pytest.fixture
async def ma_nouvelle_fixture(db_session: AsyncSession) -> MonModele:
    """Description de la fixture."""
    instance = MonModele(...)
    db_session.add(instance)
    await db_session.commit()
    await db_session.refresh(instance)
    return instance
```

---

## 📞 Support

Pour questions sur les tests :

- 📖 Documentation pytest : https://docs.pytest.org/
- 📖 Documentation httpx : https://www.python-httpx.org/
- 📧 Email : support@sante-rurale.health
- 💬 GitHub Issues

---

**Auteur**: Équipe Santé Rurale
**Version**: 1.0.0
**Dernière mise à jour**: 2 Novembre 2025
