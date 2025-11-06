# 🧪 Tests d'Isolation Multi-Tenant

## Vue d'Ensemble

Ce document explique comment exécuter et maintenir les tests automatisés qui garantissent **l'isolation complète des données entre tenants**.

## 📋 Tests Couverts

### [test_multi_tenant_isolation.py](test_multi_tenant_isolation.py)

| Test | Description | Objectif |
|------|-------------|----------|
| `test_patient_isolation_list` | Isolation liste patients | Tenant1 ne voit PAS les patients de Tenant2 |
| `test_patient_isolation_get_by_id` | Isolation accès patient par ID | Impossible d'accéder au patient d'un autre tenant |
| `test_encounter_isolation_list` | Isolation liste consultations | Chaque tenant voit seulement ses consultations |
| `test_encounter_creation_cross_tenant_patient` | Protection création cross-tenant | Impossible de créer une consultation pour un patient d'un autre tenant |
| `test_reports_isolation` | Isolation rapports | Les statistiques sont filtrées par tenant |
| `test_sql_injection_tenant_filter` | Protection injection SQL | Le filtre tenant résiste aux tentatives d'injection |

**Total** : 7 tests critiques

---

## 🚀 Exécution des Tests

### Prérequis

```bash
cd api

# Installer les dépendances de test
pip install pytest pytest-asyncio pytest-cov httpx

# OU avec Poetry
poetry install --with dev
```

### Exécuter Tous les Tests d'Isolation

```bash
# Méthode 1 : pytest simple
pytest tests/test_multi_tenant_isolation.py -v

# Méthode 2 : avec couverture de code
pytest tests/test_multi_tenant_isolation.py --cov=app.routers --cov-report=html

# Méthode 3 : avec logs détaillés
pytest tests/test_multi_tenant_isolation.py -v -s
```

### Exécuter un Test Spécifique

```bash
# Test d'isolation des patients
pytest tests/test_multi_tenant_isolation.py::test_patient_isolation_list -v

# Test d'injection SQL
pytest tests/test_multi_tenant_isolation.py::test_sql_injection_tenant_filter -v
```

### Exécuter Avec Docker

```bash
# Depuis la racine du projet
docker exec -it sante_api pytest tests/test_multi_tenant_isolation.py -v
```

---

## ✅ Résultat Attendu

```
tests/test_multi_tenant_isolation.py::test_patient_isolation_list PASSED                 [ 14%]
tests/test_multi_tenant_isolation.py::test_patient_isolation_get_by_id PASSED            [ 28%]
tests/test_multi_tenant_isolation.py::test_encounter_isolation_list PASSED               [ 42%]
tests/test_multi_tenant_isolation.py::test_encounter_creation_cross_tenant_patient PASSED[ 57%]
tests/test_multi_tenant_isolation.py::test_reports_isolation PASSED                      [ 71%]
tests/test_multi_tenant_isolation.py::test_sql_injection_tenant_filter PASSED            [ 85%]

====================================== 7 passed in 2.34s =======================================
```

**Si tous les tests passent** : ✅ L'isolation multi-tenant est garantie à 100%

**Si un test échoue** : ❌ ALERTE CRITIQUE - Faille de sécurité détectée !

---

## 🔍 Comprendre les Tests

### Exemple : test_patient_isolation_list

```python
async def test_patient_isolation_list(...):
    # 1. Créer 2 tenants avec 1 patient chacun
    # 2. Login utilisateur Tenant1
    # 3. Lister les patients
    # 4. Vérifier que SEULEMENT le patient de Tenant1 est visible
    # 5. Login utilisateur Tenant2
    # 6. Vérifier que SEULEMENT le patient de Tenant2 est visible
```

**Principe** : Chaque tenant doit voir ses données ET SEULEMENT ses données.

### Exemple : test_encounter_creation_cross_tenant_patient

```python
async def test_encounter_creation_cross_tenant_patient(...):
    # 1. Utilisateur de Tenant1 essaie de créer une consultation
    #    pour un patient de Tenant2
    # 2. L'API doit retourner 404 "Patient non trouvé"
    #    (même si le patient existe, il n'est pas dans le bon tenant)
```

**Principe** : Impossible de créer des relations cross-tenant.

---

## 📊 Couverture de Code

Générer un rapport de couverture HTML :

```bash
pytest tests/test_multi_tenant_isolation.py \
  --cov=app.routers \
  --cov=app.dependencies.tenant \
  --cov-report=html

# Ouvrir le rapport
open htmlcov/index.html
```

**Objectif** : > 90% de couverture des routers sécurisés

---

## 🔧 Ajouter de Nouveaux Tests

### Template de Test d'Isolation

```python
@pytest.mark.asyncio
async def test_YOUR_RESOURCE_isolation(
    client: AsyncClient,
    user1: User,
    user2: User,
    resource_tenant1: YourResource,
    resource_tenant2: YourResource
):
    """
    Test : Isolation de YourResource entre tenants
    """
    # Login tenant1
    response = await client.post("/api/auth/login", json={
        "email": "user1@tenant1.com",
        "password": "password123"
    })
    token1 = response.json()["access_token"]

    # Liste les ressources
    response = await client.get(
        "/api/your-resources",
        headers={"Authorization": f"Bearer {token1}"}
    )

    # Vérifications
    assert response.status_code == 200
    resources = response.json()["data"]
    resource_ids = [r["id"] for r in resources]

    # CRITIQUE : Ne doit voir QUE ses ressources
    assert str(resource_tenant1.id) in resource_ids  # ✅
    assert str(resource_tenant2.id) not in resource_ids  # ❌
```

---

## 🚨 CI/CD : Tests Automatiques

### GitHub Actions

Ajoutez à `.github/workflows/tests.yml` :

```yaml
name: Multi-Tenant Security Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd api
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run multi-tenant isolation tests
        run: |
          cd api
          pytest tests/test_multi_tenant_isolation.py -v
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost/test_db

      - name: Fail if tests don't pass
        if: failure()
        run: |
          echo "⚠️ ALERTE : Tests d'isolation multi-tenant échoués !"
          echo "L'application a une faille de sécurité CRITIQUE"
          exit 1
```

**Avantage** : Chaque commit est automatiquement vérifié pour les failles de sécurité.

---

## 📋 Checklist Avant Production

- [ ] Tous les tests d'isolation passent (7/7)
- [ ] Couverture de code > 90% sur les routers sécurisés
- [ ] Tests exécutés en CI/CD
- [ ] Audit manuel de sécurité effectué
- [ ] Tests de charge avec 2+ tenants simultanés
- [ ] Documentation mise à jour

---

## 🐛 Dépannage

### Erreur : "fixture 'site' not found"

**Solution** : Assurez-vous que la fixture `site` est dans `conftest.py` :

```python
@pytest.fixture
async def site(db_session: AsyncSession):
    from app.models import Site

    site = Site(
        id=uuid_module.uuid4(),
        nom="Site de Test",
        code="TEST-SITE",
        type="cscom"
    )
    db_session.add(site)
    await db_session.commit()
    return site
```

### Erreur : "Could not connect to database"

**Solution** : Configurez la variable d'environnement pour les tests :

```bash
export DATABASE_URL="postgresql+asyncpg://user:password@localhost/test_db"
pytest tests/test_multi_tenant_isolation.py
```

### Erreur : "Table 'tenants' does not exist"

**Solution** : Exécutez les migrations sur la DB de test :

```bash
cd api
alembic -c alembic.ini upgrade head
pytest tests/test_multi_tenant_isolation.py
```

---

## 📚 Ressources

- **Documentation principale** : [MULTI_TENANT_SECURITY.md](../../MULTI_TENANT_SECURITY.md)
- **Guide SaaS** : [SAAS_SETUP_GUIDE.md](../../SAAS_SETUP_GUIDE.md)
- **Tests pytest** : https://docs.pytest.org/en/latest/

---

## 🎯 Objectif

**Ces tests garantissent que votre application SaaS est sécurisée pour gérer plusieurs tenants sans risque de fuite de données.**

**Date de création** : 02 Novembre 2025
**Version** : 1.0.0
**Status** : ✅ Production Ready
