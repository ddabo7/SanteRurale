# Architecture PWA Santé Rurale Mali

## Vue d'ensemble

Cette architecture cible une PWA offline-first pour zones rurales au Mali avec connectivité intermittente (2G/3G).

## 1. Architecture Logique

```mermaid
graph TB
    subgraph "Client (PWA Android)"
        PWA[React PWA]
        SW[Service Worker<br/>Workbox]
        IDB[(IndexedDB<br/>Dexie)]
        OUTBOX[Outbox Queue]
        CRYPTO[WebCrypto<br/>Encryption]

        PWA --> SW
        PWA --> IDB
        PWA --> OUTBOX
        PWA --> CRYPTO
        SW --> IDB
    end

    subgraph "API Gateway"
        GW[NGINX/Traefik]
        TLS[TLS 1.3]
        RATELIMIT[Rate Limiting]
        JWT_CHECK[JWT Validation]

        GW --> TLS
        GW --> RATELIMIT
        GW --> JWT_CHECK
    end

    subgraph "Application Layer"
        API[FastAPI]
        WORKER[Celery Workers]
        SCHEDULER[Celery Beat]

        API --> WORKER
        SCHEDULER --> WORKER
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL 16<br/>+ TDE)]
        REDIS[(Redis<br/>Cache + Queue)]
        S3[S3/MinIO<br/>Attachments]

        API --> POSTGRES
        API --> REDIS
        API --> S3
        WORKER --> POSTGRES
        WORKER --> S3
    end

    subgraph "External Systems"
        DHIS2[DHIS2 Instance<br/>District]
        SMS[Orange/Moov SMS]
        WHATSAPP[WhatsApp Business API]

        WORKER --> DHIS2
        WORKER --> SMS
        WORKER --> WHATSAPP
    end

    subgraph "Observability"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        LOKI[Loki Logs]
        TEMPO[Tempo Traces]

        API --> PROMETHEUS
        API --> LOKI
        API --> TEMPO
    end

    OUTBOX -.sync.-> GW
    GW --> API
```

## 2. Architecture de Déploiement (Production)

```mermaid
graph TB
    subgraph "Zone Rurale Mali"
        DEVICE1[Android Device 1<br/>CSCOM Konobougou]
        DEVICE2[Android Device 2<br/>CSCOM Djeli]
        DEVICE3[Android Device N...]
    end

    subgraph "Internet 2G/3G"
        ISP[Orange/Malitel]
    end

    subgraph "Cloud Region eu-west-1 Paris"
        subgraph "VPC 10.0.0.0/16"
            subgraph "Public Subnets"
                ALB[Application LB<br/>HTTPS/TLS]
                NAT[NAT Gateway]
            end

            subgraph "Private Subnets AZ-a"
                API1[API Instance 1<br/>ECS/EC2]
                WORKER1[Worker 1]
            end

            subgraph "Private Subnets AZ-b"
                API2[API Instance 2<br/>ECS/EC2]
                WORKER2[Worker 2]
            end

            subgraph "Data Tier"
                RDS_PRIMARY[(RDS PostgreSQL<br/>Primary AZ-a)]
                RDS_STANDBY[(RDS Standby<br/>AZ-b)]
                REDIS_CLUSTER[(ElastiCache Redis<br/>Multi-AZ)]
            end
        end

        S3_BUCKET[S3 Bucket<br/>sante-rurale-mali<br/>SSE-S3]
        SECRETS[AWS Secrets Manager]
        CLOUDWATCH[CloudWatch Logs]

        ALB --> API1
        ALB --> API2
        API1 --> RDS_PRIMARY
        API2 --> RDS_PRIMARY
        RDS_PRIMARY -.replication.-> RDS_STANDBY
        API1 --> REDIS_CLUSTER
        API2 --> REDIS_CLUSTER
        API1 --> S3_BUCKET
        API2 --> S3_BUCKET
        WORKER1 --> RDS_PRIMARY
        WORKER2 --> RDS_PRIMARY
        WORKER1 --> REDIS_CLUSTER
        WORKER2 --> REDIS_CLUSTER

        API1 --> SECRETS
        API2 --> SECRETS
        API1 --> CLOUDWATCH
        API2 --> CLOUDWATCH
    end

    DEVICE1 -.HTTPS.-> ISP
    DEVICE2 -.HTTPS.-> ISP
    DEVICE3 -.HTTPS.-> ISP
    ISP --> ALB

    WORKER1 -.export.-> DHIS2_EXTERNAL[DHIS2 Mali<br/>dhis2.sante.gov.ml]
    WORKER1 -.SMS.-> SMS_GATEWAY[Orange API]
```

## 3. Flux de Synchronisation Offline

```mermaid
sequenceDiagram
    participant Device as PWA (offline)
    participant IDB as IndexedDB
    participant Outbox as Outbox Queue
    participant API as API Server
    participant DB as PostgreSQL

    Note over Device,IDB: Mode OFFLINE
    Device->>IDB: Créer Patient (local)
    Device->>Outbox: Enqueue {op: create, entity: patient, payload, idempotency_key}

    Note over Device,API: Réseau revient
    Device->>API: POST /sync/batch [{op, entity, payload, idempotency_key}]
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT INTO patients ... ON CONFLICT (idempotency_key) DO NOTHING
    API->>DB: COMMIT
    API-->>Device: {synced: [uuid1], conflicts: []}
    Device->>Outbox: Remove synced items
    Device->>IDB: Update local records with server IDs

    Note over Device,API: Pull changes depuis serveur
    Device->>API: GET /sync/changes?since=cursor_123
    API->>DB: SELECT * FROM sync_ledger WHERE version > cursor
    API-->>Device: {changes: [{entity, id, data, version}], next_cursor}
    Device->>IDB: Apply changes locally

    Note over Device,IDB: Résolution de conflit
    alt Conflit détecté (updated_at)
        Device->>Device: Compare local vs server timestamps
        Device->>Device: Last-write-wins OU merge guidé
        Device->>IDB: Update with resolved data
    end
```

## 4. Architecture de Sécurité

```mermaid
graph TB
    subgraph "Client Security"
        LOCAL_CRYPT[WebCrypto AES-256-GCM<br/>Patient data at rest]
        KEY_DERIV[PBKDF2 Key Derivation<br/>from user PIN]
        CSP[Content Security Policy]

        LOCAL_CRYPT --> KEY_DERIV
    end

    subgraph "Transport Security"
        TLS13[TLS 1.3<br/>Cert Let's Encrypt]
        HSTS[HSTS Headers]
        CERT_PIN[Certificate Pinning]

        TLS13 --> HSTS
    end

    subgraph "Authentication"
        JWT_ACCESS[Access Token JWT RS256<br/>15 min expiry]
        JWT_REFRESH[Refresh Token<br/>7 days, encrypted in DB]
        JWKS[JWKS Endpoint<br/>Key rotation]

        JWT_ACCESS --> JWKS
        JWT_REFRESH --> JWKS
    end

    subgraph "Authorization"
        RBAC[Role-Based Access<br/>soignant/major/medecin/admin]
        ABAC[Attribute-Based<br/>site_id filtering]
        RLS[Row-Level Security<br/>PostgreSQL]

        RBAC --> RLS
        ABAC --> RLS
    end

    subgraph "Data Protection"
        DB_TDE[PostgreSQL TDE<br/>or Encrypted EBS]
        S3_SSE[S3 SSE-S3<br/>Attachments]
        BACKUP_ENCRYPT[Encrypted Backups<br/>AWS KMS]

        DB_TDE --> BACKUP_ENCRYPT
        S3_SSE --> BACKUP_ENCRYPT
    end

    subgraph "Audit & Compliance"
        AUDIT_LOG[Audit Trail<br/>All patient access]
        RETENTION[12 months retention]
        GDPR[GDPR/Data Protection<br/>Consent management]

        AUDIT_LOG --> RETENTION
        AUDIT_LOG --> GDPR
    end

    LOCAL_CRYPT -.encrypted data.-> TLS13
    TLS13 --> JWT_ACCESS
    JWT_ACCESS --> RBAC
    RBAC --> DB_TDE
    DB_TDE --> AUDIT_LOG
```

## 5. Modèle de Données Conceptuel

```mermaid
erDiagram
    PATIENT ||--o{ ENCOUNTER : "has"
    ENCOUNTER ||--o{ CONDITION : "diagnosed"
    ENCOUNTER ||--o{ MEDICATION_REQUEST : "prescribed"
    ENCOUNTER ||--o{ PROCEDURE : "performed"
    ENCOUNTER ||--o| REFERENCE : "referred"
    ENCOUNTER }o--|| SITE : "at"
    ENCOUNTER }o--|| USER : "by"
    PATIENT ||--o{ ATTACHMENT : "has"
    ENCOUNTER ||--o{ ATTACHMENT : "has"
    USER }o--|| SITE : "works_at"
    USER }o--|| ROLE : "has"

    PATIENT {
        uuid id PK
        string nom
        string prenom
        string sexe
        int annee_naissance
        string telephone
        string village
        timestamp created_at
        timestamp updated_at
        int version
    }

    ENCOUNTER {
        uuid id PK
        uuid patient_id FK
        uuid site_id FK
        uuid user_id FK
        date date
        string motif
        float temperature
        int pouls
        text notes
        timestamp created_at
        timestamp updated_at
        int version
    }

    CONDITION {
        uuid id PK
        uuid encounter_id FK
        string code_icd10
        string libelle
        timestamp created_at
    }

    MEDICATION_REQUEST {
        uuid id PK
        uuid encounter_id FK
        string medicament
        string posologie
        int duree_jours
        timestamp created_at
    }

    PROCEDURE {
        uuid id PK
        uuid encounter_id FK
        string type
        text description
        timestamp created_at
    }

    REFERENCE {
        uuid id PK
        uuid encounter_id FK
        string destination
        text raison
        string statut
        timestamp eta
        timestamp created_at
    }

    USER {
        uuid id PK
        string nom
        string email
        string phone
        string password_hash
        uuid role_id FK
        uuid site_id FK
        timestamp last_login
        timestamp created_at
    }

    SITE {
        uuid id PK
        string nom
        string district
        string region
        float latitude
        float longitude
    }

    ATTACHMENT {
        uuid id PK
        uuid patient_id FK
        uuid encounter_id FK
        string filename
        string s3_key
        string mime_type
        int size_bytes
        timestamp created_at
    }
```

## 6. Stack Technologique

### Frontend (PWA)
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Offline**: Workbox 7 (Service Worker)
- **State**: Zustand + React Query
- **DB locale**: Dexie.js (IndexedDB wrapper)
- **UI**: TailwindCSS + Headless UI
- **Forms**: React Hook Form + Zod validation
- **i18n**: react-i18next
- **Monitoring**: Sentry Browser SDK
- **Camera**: react-webcam

### Backend (API)
- **Framework**: FastAPI 0.109+ (Python 3.11+)
- **ASGI Server**: Uvicorn + Gunicorn
- **ORM**: SQLAlchemy 2.0 + Alembic migrations
- **Validation**: Pydantic v2
- **Auth**: python-jose (JWT), passlib (bcrypt)
- **Tasks**: Celery 5 + Redis broker
- **OpenAPI**: Auto-generated par FastAPI
- **Monitoring**: OpenTelemetry + Prometheus client

### Data
- **Primary DB**: PostgreSQL 16 (RDS Multi-AZ)
- **Cache/Queue**: Redis 7 (ElastiCache)
- **Object Storage**: S3 (ou MinIO local)
- **Search**: PostgreSQL Full-Text Search (pg_trgm)

### Infrastructure
- **Container**: Docker + Docker Compose (dev)
- **Orchestration**: AWS ECS Fargate (ou K3s si budget serré)
- **IaC**: Terraform 1.6+
- **CI/CD**: GitHub Actions
- **DNS**: Route53 + CloudFront (CDN PWA)
- **Secrets**: AWS Secrets Manager
- **Monitoring**: Grafana Cloud ou self-hosted (Prometheus + Grafana + Loki)

## 7. Exigences de Performance

| Métrique | Objectif | Mesure |
|----------|----------|---------|
| PWA TTI (3G) | < 3s | Lighthouse |
| API Response P95 | < 1s | Prometheus |
| API Response P99 | < 2s | Prometheus |
| Sync batch (100 records) | < 10s | E2E tests |
| Offline operation | < 60s consultation | User testing |
| Cache hit ratio | > 90% | Redis metrics |
| DB query P95 | < 100ms | pg_stat_statements |
| Uptime SLA | 99.5% | StatusPage |

## 8. Dimensionnement Initial

**Hypothèses**:
- 50 CSCOM pilotes
- 2-3 agents par CSCOM
- 30 consultations/jour/CSCOM
- Pic : 10 consultations/heure

**Resources**:
- API: 2x t3.medium (2 vCPU, 4 GB) + auto-scaling
- DB: db.t4g.medium (2 vCPU, 4 GB, 100 GB gp3)
- Redis: cache.t4g.micro (2 GB)
- Workers: 2x t3.small
- S3: 10 GB/mois (photos/PDFs)
- Bandwidth: ~100 GB/mois

**Coût estimé AWS**: ~300-400 USD/mois

## 9. Plan de Reprise (DR)

- **RTO**: 4 heures
- **RPO**: 1 heure
- **Backups**:
  - PostgreSQL: automated snapshots quotidiens + PITR
  - S3: versioning activé + réplication cross-region (optionnel)
  - Rétention: 30 jours
- **Restauration**: procédure testée mensuellement
- **Failover**: RDS Multi-AZ automatique

## 10. Roadmap Scalabilité

### Phase 1 (MVP - 50 sites)
- Architecture actuelle suffisante

### Phase 2 (500 sites)
- Lecture replicas PostgreSQL
- Redis Cluster (vs standalone)
- CDN CloudFront pour assets PWA
- Partitionnement DB par région

### Phase 3 (5000+ sites)
- Multi-region déploiement
- Sharding DB par district
- Kafka pour event streaming
- Microservices (patients, encounters, exports)
