# Documentation Opérationnelle & Runbooks - Santé Rurale

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Monitoring & Alertes](#monitoring--alertes)
3. [Runbooks](#runbooks)
4. [Sauvegardes & Restauration](#sauvegardes--restauration)
5. [Rotation des clés & secrets](#rotation-des-clés--secrets)
6. [Scaling & Performance](#scaling--performance)
7. [Plan de reprise (DR)](#plan-de-reprise-dr)

---

## Vue d'ensemble

### SLO/SLA

| Métrique | Objectif | Mesure | Alerte |
|----------|----------|--------|--------|
| Disponibilité API | ≥ 99.5% | Uptime checks (1 min) | < 99.5% sur 7j |
| Latence P95 | < 1s | Prometheus | > 1s pendant 5 min |
| Latence P99 | < 2s | Prometheus | > 2s pendant 5 min |
| Taux d'erreur | < 1% | Logs structurés | > 1% pendant 5 min |
| DB Query P95 | < 100ms | pg_stat_statements | > 200ms |
| Sync Success Rate | > 95% | App metrics | < 90% sur 1h |

### Points de contact

- **On-call**: support@sante-rurale.ml
- **Escalation**: admin@sante-rurale.ml
- **WhatsApp support**: +223 XX XX XX XX

---

## Monitoring & Alertes

### Dashboards Grafana

#### 1. Overview Dashboard
- **Requêtes HTTP/s**: Total, par endpoint, par status code
- **Latence**: P50, P95, P99
- **Erreurs**: Taux d'erreur 5xx, 4xx
- **Santé DB**: Connexions, temps requêtes, locks
- **Redis**: Hit rate cache, connexions, memory usage

#### 2. Business Metrics Dashboard
- **Patients**: Nouveaux patients/jour, total
- **Consultations**: Consultations/jour, par site
- **Sync**: Opérations pending, success rate, conflits
- **DHIS2**: Exports réussis/échoués, dernière sync

#### 3. Infrastructure Dashboard
- **Compute**: CPU, Memory, Network (ECS tasks)
- **RDS**: CPU, IOPS, Storage, Replication lag
- **ElastiCache**: CPU, Memory, Evictions
- **S3**: Requests, Storage

### Alertes critiques

```yaml
# alerts.yml (Prometheus AlertManager)
groups:
  - name: api_health
    interval: 1m
    rules:
      - alert: APIDown
        expr: up{job="api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API is down"
          description: "API {{ $labels.instance }} has been down for > 2 minutes"

      - alert: HighErrorRate
        expr: (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate (> 1%)"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency > 1s"

  - name: database
    interval: 1m
    rules:
      - alert: DatabaseDown
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is down"

      - alert: DatabaseHighConnections
        expr: (pg_stat_database_numbackends / pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connections > 80%"

      - alert: DatabaseSlowQueries
        expr: rate(pg_slow_queries_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of slow queries (> 10/s)"

  - name: sync
    interval: 5m
    rules:
      - alert: SyncBacklog
        expr: sync_pending_operations > 1000
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Large sync backlog (> 1000 ops)"
```

---

## Runbooks

### RB-001: API ne répond plus (504 Gateway Timeout)

**Symptômes**:
- Alertes `APIDown` ou `HighLatency`
- Timeouts côté clients
- HTTP 504 depuis l'ALB

**Diagnostics**:

```bash
# 1. Vérifier le statut des ECS tasks
aws ecs list-tasks --cluster sante-rurale-cluster --service-name api
aws ecs describe-tasks --cluster sante-rurale-cluster --tasks <task-arn>

# 2. Vérifier les logs CloudWatch
aws logs tail /aws/ecs/sante-rurale-api --follow

# 3. Vérifier les health checks
curl https://api.sante-rurale.ml/health

# 4. Vérifier la DB
psql -h <rds-endpoint> -U sante_admin -d sante_rurale -c "SELECT 1;"

# 5. Vérifier Redis
redis-cli -h <redis-endpoint> -a <password> ping
```

**Actions correctives**:

1. **Redémarrage rapide** (si urgence):
   ```bash
   # Forcer un nouveau déploiement (rolling restart)
   aws ecs update-service --cluster sante-rurale-cluster \
       --service api --force-new-deployment
   ```

2. **Si DB bloquée** (locks):
   ```sql
   -- Identifier les requêtes longues
   SELECT pid, usename, state, query, now() - query_start AS duration
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC;

   -- Tuer une requête bloquante (en dernier recours)
   SELECT pg_terminate_backend(<pid>);
   ```

3. **Si memory leak** (OOM):
   ```bash
   # Vérifier la mémoire des containers
   aws ecs describe-tasks --cluster sante-rurale-cluster --tasks <task-arn> \
       | jq '.tasks[].containers[].memory'

   # Augmenter la mémoire temporairement
   aws ecs update-service --cluster sante-rurale-cluster \
       --service api --task-definition api:NEW_VERSION
   ```

4. **Post-mortem**:
   - Analyser les logs Sentry
   - Vérifier les requêtes lentes (pg_stat_statements)
   - Créer un ticket incident

---

### RB-002: Base de données pleine (Storage Full)

**Symptômes**:
- Alerte `DatabaseStorageFull`
- Erreurs `ENOSPC` dans les logs
- Impossibilité d'écrire

**Diagnostics**:

```sql
-- Taille de la base
SELECT pg_size_pretty(pg_database_size('sante_rurale'));

-- Taille par table
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Index les plus gros
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;
```

**Actions correctives**:

1. **Augmenter le storage** (solution immédiate):
   ```bash
   aws rds modify-db-instance --db-instance-identifier sante-rurale-db \
       --allocated-storage 200 \
       --apply-immediately
   ```

2. **Nettoyer les logs d'audit** (si > 30 jours):
   ```sql
   -- Supprimer les logs > 90 jours
   DELETE FROM audit_logs
   WHERE created_at < NOW() - INTERVAL '90 days';

   -- Vacuum
   VACUUM FULL audit_logs;
   ```

3. **Archiver les anciennes consultations** (si besoin):
   ```sql
   -- Identifier les vieilles consultations
   SELECT COUNT(*), EXTRACT(YEAR FROM created_at) AS year
   FROM encounters
   GROUP BY year
   ORDER BY year;

   -- Exporter puis supprimer (après sauvegarde!)
   -- (via script Python avec pg_dump ciblé)
   ```

---

### RB-003: Échec d'export DHIS2

**Symptômes**:
- Alertes `DHIS2ExportFailed`
- Jobs en statut `failed` dans `dhis2_exports`
- Rapports incomplets dans DHIS2

**Diagnostics**:

```sql
-- Vérifier les exports récents
SELECT id, period, site_id, status, error, created_at
FROM dhis2_exports
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Détails d'un export
SELECT id, payload, response, error
FROM dhis2_exports
WHERE id = '<job_id>';
```

**Actions correctives**:

1. **Erreur de validation DHIS2**:
   ```python
   # Vérifier les data elements dans DHIS2
   curl -u admin:password \
       https://dhis2.sante.gov.ml/api/dataElements.json?filter=code:in:[CONS_TOTAL,CONS_U5]

   # Corriger le mapping si nécessaire
   # Relancer l'export
   curl -X POST https://api.sante-rurale.ml/v1/dhis2/export \
       -H "Authorization: Bearer <token>" \
       -d '{"period": "202404", "site_id": "<uuid>", "dry_run": true}'
   ```

2. **DHIS2 inaccessible** (timeout):
   ```bash
   # Vérifier la connexion
   curl -I https://dhis2.sante.gov.ml/api/system/info

   # Retry manuel après résolution
   psql -c "UPDATE dhis2_exports SET status='pending' WHERE id='<job_id>';"
   ```

3. **Données invalides** (valeurs négatives, etc.):
   ```sql
   -- Identifier les anomalies
   SELECT period, site_id, payload
   FROM dhis2_exports
   WHERE payload::jsonb @> '{"dataValues": [{"value": "-1"}]}'::jsonb;

   -- Corriger les données sources
   -- Relancer l'export
   ```

---

## Sauvegardes & Restauration

### Politique de sauvegarde

| Ressource | Fréquence | Rétention | Méthode |
|-----------|-----------|-----------|---------|
| PostgreSQL | Quotidienne (3h UTC) | 30 jours | RDS Automated Backup + Snapshots manuels mensuels |
| S3 (Attachments) | Versioning activé | 90 jours | S3 Versioning + Lifecycle policy |
| Redis | Snapshots quotidiens | 5 jours | ElastiCache automated snapshots |
| Secrets | Backup manuel lors des rotations | Permanent | Secrets Manager versions |

### Restauration PostgreSQL

```bash
# 1. Restaurer depuis un snapshot automatique (Point-in-Time)
aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier sante-rurale-db \
    --target-db-instance-identifier sante-rurale-db-restored \
    --restore-time 2024-04-20T10:00:00Z

# 2. Restaurer depuis un snapshot manuel
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier sante-rurale-db-restored \
    --db-snapshot-identifier sante-rurale-manual-snapshot-202404

# 3. Tester la base restaurée
psql -h sante-rurale-db-restored.<region>.rds.amazonaws.com \
    -U sante_admin -d sante_rurale -c "SELECT COUNT(*) FROM patients;"

# 4. Basculer (après validation)
# - Mettre à jour le DNS ou la variable d'environnement DATABASE_URL
# - Redéployer l'API
```

### Tests de restauration

**Fréquence**: Mensuellement

**Procédure**:
1. Restaurer le dernier snapshot dans un environnement de test
2. Vérifier l'intégrité des données (counts, checksums)
3. Tester les requêtes critiques
4. Documenter le temps de restauration (RTO)
5. Supprimer l'instance de test

---

## Rotation des clés & secrets

### JWT Keys (tous les 6 mois)

```bash
# 1. Générer une nouvelle paire de clés RSA
ssh-keygen -t rsa -b 4096 -m PEM -f jwt-private-new.pem
ssh-keygen -e -m PEM -f jwt-private-new.pem > jwt-public-new.pem

# 2. Uploader dans Secrets Manager
aws secretsmanager create-secret --name sante-rurale/prod/jwt-private-key-v2 \
    --secret-binary fileb://jwt-private-new.pem

# 3. Mettre à jour l'application (support des 2 clés pendant transition)
# - API accepte tokens signés avec ancienne ET nouvelle clé
# - API signe nouveaux tokens avec nouvelle clé

# 4. Après 7 jours (durée max refresh token), retirer l'ancienne clé
```

### Database Password (annuellement)

```bash
# 1. Générer un nouveau mot de passe
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Modifier le mot de passe RDS
aws rds modify-db-instance --db-instance-identifier sante-rurale-db \
    --master-user-password "$NEW_PASSWORD" \
    --apply-immediately

# 3. Mettre à jour Secrets Manager
aws secretsmanager update-secret --secret-id sante-rurale/prod/db-password \
    --secret-string "$NEW_PASSWORD"

# 4. Redéployer l'API (lit le nouveau secret)
aws ecs update-service --cluster sante-rurale-cluster \
    --service api --force-new-deployment
```

---

## Scaling & Performance

### Scaling horizontal (API)

```bash
# Augmenter le nombre de tasks ECS
aws ecs update-service --cluster sante-rurale-cluster \
    --service api --desired-count 4

# Auto-scaling basé sur CPU
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/sante-rurale-cluster/api \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10

aws application-autoscaling put-scaling-policy \
    --policy-name cpu-scaling \
    --service-namespace ecs \
    --resource-id service/sante-rurale-cluster/api \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration \
        '{"TargetValue": 70.0, "PredefinedMetricSpecification": {"PredefinedMetricType": "ECSServiceAverageCPUUtilization"}}'
```

### Scaling vertical (RDS)

```bash
# Passer à une instance plus grosse (nécessite downtime court)
aws rds modify-db-instance --db-instance-identifier sante-rurale-db \
    --db-instance-class db.t4g.large \
    --apply-immediately

# Ajouter un read replica (pas de downtime)
aws rds create-db-instance-read-replica \
    --db-instance-identifier sante-rurale-db-replica \
    --source-db-instance-identifier sante-rurale-db
```

### Optimisation requêtes lentes

```sql
-- Activer pg_stat_statements (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 requêtes lentes
SELECT
    calls,
    mean_exec_time,
    max_exec_time,
    query
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- ms
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyser un plan de requête
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

-- Créer un index si nécessaire
CREATE INDEX CONCURRENTLY idx_patients_search
ON patients USING gin (to_tsvector('french', nom || ' ' || COALESCE(prenom, '')));
```

---

## Plan de reprise (DR)

### RTO & RPO

- **RTO**: 4 heures (temps maximal pour restaurer le service)
- **RPO**: 1 heure (perte de données maximale acceptable)

### Procédure de reprise

**Scénario**: Perte totale de la région AWS eu-west-1

**Étapes**:

1. **Activer le plan DR** (décision management + tech lead)

2. **Restaurer RDS dans région secondaire** (eu-central-1):
   ```bash
   # Restaurer depuis le dernier snapshot cross-region
   aws rds restore-db-instance-from-db-snapshot \
       --db-instance-identifier sante-rurale-db-dr \
       --db-snapshot-identifier arn:aws:rds:eu-central-1:...:snapshot:sante-rurale-daily \
       --region eu-central-1
   ```

3. **Déployer l'infra Terraform dans eu-central-1**:
   ```bash
   cd terraform/
   terraform workspace select dr
   terraform apply -var="aws_region=eu-central-1"
   ```

4. **Restaurer S3** (réplication cross-region si activée):
   ```bash
   aws s3 sync s3://sante-rurale-prod-attachments-replica \
       s3://sante-rurale-dr-attachments \
       --region eu-central-1
   ```

5. **Déployer API**:
   ```bash
   # Build et push Docker image
   docker build -t api:dr .
   docker tag api:dr <ecr-dr>/api:latest
   docker push <ecr-dr>/api:latest

   # Déployer sur ECS DR
   aws ecs update-service --cluster sante-rurale-dr-cluster \
       --service api --force-new-deployment \
       --region eu-central-1
   ```

6. **Basculer DNS**:
   ```bash
   # Mettre à jour Route53 pour pointer vers ALB DR
   aws route53 change-resource-record-sets --hosted-zone-id Z123 \
       --change-batch file://dns-dr.json
   ```

7. **Valider**:
   - Health checks
   - Login test
   - Créer un patient test
   - Vérifier les logs

8. **Communication**:
   - Notifier les utilisateurs (WhatsApp broadcast)
   - Mise à jour status page

### Drill de reprise

**Fréquence**: Semestrielle

**Checklist**:
- [ ] Restaurer snapshot dans région secondaire
- [ ] Tester connectivité DB
- [ ] Déployer API (mode read-only)
- [ ] Mesurer RTO effectif
- [ ] Documenter les problèmes rencontrés
- [ ] Mettre à jour le runbook
