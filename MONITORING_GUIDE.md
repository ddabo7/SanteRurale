# Guide de Monitoring et Observabilité

Guide complet pour configurer et utiliser le système de monitoring de Santé Rurale avec **Sentry**, **Prometheus** et **Grafana**.

## 📋 Table des Matières

- [Architecture du Monitoring](#architecture-du-monitoring)
- [Configuration Sentry](#configuration-sentry)
- [Configuration Prometheus](#configuration-prometheus)
- [Configuration Grafana](#configuration-grafana)
- [Alertes et Notifications](#alertes-et-notifications)
- [Dashboards Recommandés](#dashboards-recommandés)
- [Métriques Importantes](#métriques-importantes)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture du Monitoring

```
┌─────────────┐
│   Frontend  │──┐
│    (PWA)    │  │  Errors & Events
└─────────────┘  │
                 ├──> Sentry (Error Tracking)
┌─────────────┐  │
│   Backend   │──┘
│   (FastAPI) │──┐
└─────────────┘  │  Metrics
                 ├──> Prometheus (Metrics Collection)
┌─────────────┐  │
│  Database   │──┘
│ (PostgreSQL)│
└─────────────┘
                     │
                     ▼
                ┌──────────┐
                │ Grafana  │──> Visualisation
                └──────────┘
                     │
                     ▼
                ┌──────────┐
                │ Alertes  │──> Email/SMS
                └──────────┘
```

---

## 🔴 Configuration Sentry

### 1. Créer un Compte Sentry

1. Aller sur [sentry.io](https://sentry.io)
2. Créer un compte gratuit (50k événements/mois)
3. Créer un nouveau projet:
   - Type: **FastAPI** pour le backend
   - Type: **React** pour le frontend
4. Récupérer le **DSN** (Data Source Name)

### 2. Configuration Backend (FastAPI)

```bash
# Ajouter à .env
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% des transactions
```

Dans `api/app/main.py`:

```python
from app.monitoring import configure_sentry
from app.config import settings

# Initialiser Sentry
if settings.SENTRY_DSN:
    configure_sentry(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
    )
```

### 3. Configuration Frontend (React)

```bash
# Installer Sentry
cd pwa
npm install @sentry/react
```

Dans `pwa/src/main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT || "production",
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 4. Utilisation de Sentry

```python
# Backend - Capturer une exception
from app.monitoring.sentry_config import capture_exception

try:
    risky_operation()
except Exception as e:
    capture_exception(e, user_id=user.id, operation="sync")
    raise

# Backend - Capturer un message
from app.monitoring.sentry_config import capture_message

capture_message(
    "Unusual activity detected",
    level="warning",
    patient_count=1000
)
```

```typescript
// Frontend - Capturer une erreur
import * as Sentry from "@sentry/react";

try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: "PatientList",
      operation: "fetch",
    },
  });
}
```

---

## 📊 Configuration Prometheus

### 1. Installation Prometheus

```bash
# Docker Compose
cat > docker-compose.monitoring.yml << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

volumes:
  prometheus_data:
EOF
```

### 2. Configuration Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'sante-rurale'
    environment: 'production'

scrape_configs:
  # API Backend
  - job_name: 'sante-rurale-api'
    static_configs:
      - targets: ['host.docker.internal:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Prometheus lui-même
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node Exporter (métriques système)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### 3. Démarrer Prometheus

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### 4. Vérifier les Métriques

```bash
# Accéder à Prometheus UI
open http://localhost:9090

# Tester une requête PromQL
http_requests_total
rate(http_requests_total[5m])
```

---

## 📈 Configuration Grafana

### 1. Installation Grafana

```bash
# Ajouter à docker-compose.monitoring.yml
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  grafana_data:
```

### 2. Configurer la Source de Données

```yaml
# grafana/provisioning/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### 3. Dashboard JSON (Application Overview)

Créer `grafana/provisioning/dashboards/sante-rurale-overview.json`:

```json
{
  "dashboard": {
    "title": "Santé Rurale - Application Overview",
    "tags": ["sante-rurale", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "HTTP Requests per Second",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time (p95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "Errors"
          }
        ]
      },
      {
        "id": 4,
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_users"
          }
        ]
      }
    ]
  }
}
```

### 4. Accéder à Grafana

```bash
# Ouvrir Grafana
open http://localhost:3000

# Login:
# Username: admin
# Password: admin123 (à changer au premier login)
```

---

## 🔔 Alertes et Notifications

### 1. Configuration des Alertes Prometheus

```yaml
# prometheus/rules/alerts.yml
groups:
  - name: sante_rurale_alerts
    interval: 30s
    rules:
      # API Down
      - alert: APIDown
        expr: up{job="sante-rurale-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API is down"
          description: "API has been down for more than 1 minute"

      # High Error Rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/second"

      # High Response Time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "P95 response time is {{ $value }}s"

      # High CPU Usage
      - alert: HighCPUUsage
        expr: system_cpu_usage_percent > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}%"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: system_memory_usage_percent > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%"

      # Database Connection Issues
      - alert: DatabaseConnectionIssues
        expr: database_connections_gauge > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "{{ $value }} active database connections"
```

### 2. Configuration Alertmanager

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@sante-rurale.health'
  smtp_auth_username: 'alerts@sante-rurale.health'
  smtp_auth_password: 'your-password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-email'

  routes:
    - match:
        severity: critical
      receiver: 'team-email-urgent'

    - match:
        severity: warning
      receiver: 'team-email'

receivers:
  - name: 'team-email'
    email_configs:
      - to: 'team@sante-rurale.health'
        headers:
          Subject: '[Monitoring] {{ .GroupLabels.alertname }}'

  - name: 'team-email-urgent'
    email_configs:
      - to: 'team@sante-rurale.health,oncall@sante-rurale.health'
        headers:
          Subject: '[URGENT] {{ .GroupLabels.alertname }}'
    # SMS via webhook (exemple avec Twilio)
    webhook_configs:
      - url: 'http://your-webhook-service/send-sms'
```

---

## 📊 Dashboards Recommandés

### 1. Application Overview
- Requêtes HTTP par seconde
- Temps de réponse (p50, p95, p99)
- Taux d'erreur
- Utilisateurs actifs

### 2. Synchronisation Offline
- Opérations de sync par type
- Durée moyenne de sync
- Opérations en attente
- Taux de succès/échec

### 3. Base de Données
- Requêtes par seconde
- Temps de réponse des requêtes
- Connexions actives
- Taille de la base

### 4. Système
- CPU, RAM, Disk
- Réseau I/O
- Processus actifs

---

## 📈 Métriques Importantes

### Backend (FastAPI)

```python
from app.monitoring.prometheus_config import metrics_collector

# Enregistrer une opération de sync
start = time.time()
try:
    result = await sync_operation()
    metrics_collector.record_sync_operation(
        operation_type="push",
        status="success",
        duration=time.time() - start
    )
except Exception as e:
    metrics_collector.record_sync_operation(
        operation_type="push",
        status="failure",
        duration=time.time() - start
    )
    raise
```

### Requêtes PromQL Utiles

```promql
# Taux de requêtes HTTP
rate(http_requests_total[5m])

# Temps de réponse P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Taux d'erreur
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Opérations de sync réussies
rate(sync_operations_total{status="success"}[5m])

# Mémoire utilisée
100 - (system_memory_available_bytes / system_memory_total_bytes * 100)
```

---

## 🐛 Troubleshooting

### Prometheus n'affiche pas de métriques

```bash
# Vérifier que l'endpoint /metrics est accessible
curl http://localhost:8000/metrics

# Vérifier les targets dans Prometheus
open http://localhost:9090/targets

# Vérifier les logs
docker logs prometheus
```

### Grafana ne se connecte pas à Prometheus

```bash
# Vérifier la configuration de la datasource
# Grafana UI > Configuration > Data Sources

# Test de connexion
docker exec -it grafana grafana-cli admin reset-admin-password admin123
```

### Alertes ne sont pas envoyées

```bash
# Vérifier Alertmanager
docker logs alertmanager

# Tester manuellement une alerte
curl -X POST http://localhost:9093/api/v1/alerts
```

---

## 📚 Ressources Supplémentaires

- [Sentry Documentation](https://docs.sentry.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)

---

**Auteur**: Équipe Santé Rurale
**Version**: 1.0.0
**Dernière mise à jour**: 2 Novembre 2025
