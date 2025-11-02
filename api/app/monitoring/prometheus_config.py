"""
Configuration Prometheus pour les métriques de performance
"""

from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST
from prometheus_fastapi_instrumentator import Instrumentator, metrics
from fastapi import FastAPI, Response
import time
import psutil
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Métriques personnalisées
# ============================================================================

# Compteurs
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

sync_operations_total = Counter(
    'sync_operations_total',
    'Total sync operations',
    ['operation_type', 'status']
)

database_queries_total = Counter(
    'database_queries_total',
    'Total database queries',
    ['table', 'operation']
)

auth_attempts_total = Counter(
    'auth_attempts_total',
    'Total authentication attempts',
    ['status']
)

# Histogrammes (pour mesurer la durée)
http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

sync_operation_duration_seconds = Histogram(
    'sync_operation_duration_seconds',
    'Sync operation duration in seconds',
    ['operation_type']
)

database_query_duration_seconds = Histogram(
    'database_query_duration_seconds',
    'Database query duration in seconds',
    ['table', 'operation']
)

# Jauges (valeurs instantanées)
active_users_gauge = Gauge(
    'active_users',
    'Number of active users'
)

pending_sync_operations_gauge = Gauge(
    'pending_sync_operations',
    'Number of pending sync operations'
)

database_connections_gauge = Gauge(
    'database_connections',
    'Number of active database connections'
)

# Informations système
system_info = Info(
    'system_info',
    'System information'
)


# ============================================================================
# Configuration Prometheus
# ============================================================================

def configure_prometheus(app: FastAPI, enable_default_metrics: bool = True):
    """
    Configurer Prometheus pour l'application FastAPI

    Args:
        app: Application FastAPI
        enable_default_metrics: Activer les métriques par défaut

    Example:
        configure_prometheus(app, enable_default_metrics=True)
    """
    try:
        instrumentator = Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            should_respect_env_var=True,
            should_instrument_requests_inprogress=True,
            excluded_handlers=["/health", "/metrics"],
            env_var_name="ENABLE_METRICS",
            inprogress_name="http_requests_inprogress",
            inprogress_labels=True,
        )

        # Ajouter les métriques par défaut
        if enable_default_metrics:
            instrumentator.add(
                metrics.default()
            ).add(
                metrics.latency(
                    buckets=(0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0)
                )
            ).add(
                metrics.requests()
            ).add(
                metrics.response_size()
            ).add(
                metrics.request_size()
            )

        # Instrumenter l'application
        instrumentator.instrument(app)

        # Exposer les métriques sur /metrics
        instrumentator.expose(app, endpoint="/metrics", include_in_schema=False)

        # Définir les informations système
        _set_system_info()

        logger.info("Prometheus metrics configured successfully")

    except Exception as e:
        logger.error(f"Failed to configure Prometheus: {e}")


def _set_system_info():
    """Définir les informations système"""
    try:
        import platform
        import sys

        system_info.info({
            'python_version': sys.version,
            'platform': platform.platform(),
            'architecture': platform.machine(),
        })
    except Exception as e:
        logger.warning(f"Failed to set system info: {e}")


# ============================================================================
# Helpers pour enregistrer les métriques
# ============================================================================

class MetricsCollector:
    """Collecteur de métriques pour l'application"""

    @staticmethod
    def record_http_request(method: str, endpoint: str, status: int, duration: float):
        """
        Enregistrer une requête HTTP

        Args:
            method: Méthode HTTP (GET, POST, etc.)
            endpoint: Endpoint appelé
            status: Code de statut HTTP
            duration: Durée en secondes
        """
        http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status=status
        ).inc()

        http_request_duration_seconds.labels(
            method=method,
            endpoint=endpoint
        ).observe(duration)

    @staticmethod
    def record_sync_operation(operation_type: str, status: str, duration: float):
        """
        Enregistrer une opération de synchronisation

        Args:
            operation_type: Type d'opération (push, pull, etc.)
            status: Statut (success, failure, etc.)
            duration: Durée en secondes
        """
        sync_operations_total.labels(
            operation_type=operation_type,
            status=status
        ).inc()

        sync_operation_duration_seconds.labels(
            operation_type=operation_type
        ).observe(duration)

    @staticmethod
    def record_database_query(table: str, operation: str, duration: float):
        """
        Enregistrer une requête de base de données

        Args:
            table: Table interrogée
            operation: Opération (SELECT, INSERT, UPDATE, DELETE)
            duration: Durée en secondes
        """
        database_queries_total.labels(
            table=table,
            operation=operation
        ).inc()

        database_query_duration_seconds.labels(
            table=table,
            operation=operation
        ).observe(duration)

    @staticmethod
    def record_auth_attempt(status: str):
        """
        Enregistrer une tentative d'authentification

        Args:
            status: Statut (success, failure, etc.)
        """
        auth_attempts_total.labels(status=status).inc()

    @staticmethod
    def update_active_users(count: int):
        """
        Mettre à jour le nombre d'utilisateurs actifs

        Args:
            count: Nombre d'utilisateurs actifs
        """
        active_users_gauge.set(count)

    @staticmethod
    def update_pending_sync_operations(count: int):
        """
        Mettre à jour le nombre d'opérations en attente

        Args:
            count: Nombre d'opérations en attente
        """
        pending_sync_operations_gauge.set(count)

    @staticmethod
    def update_database_connections(count: int):
        """
        Mettre à jour le nombre de connexions DB actives

        Args:
            count: Nombre de connexions
        """
        database_connections_gauge.set(count)


# ============================================================================
# Métriques système (CPU, RAM, etc.)
# ============================================================================

cpu_usage_gauge = Gauge('system_cpu_usage_percent', 'CPU usage percentage')
memory_usage_gauge = Gauge('system_memory_usage_percent', 'Memory usage percentage')
disk_usage_gauge = Gauge('system_disk_usage_percent', 'Disk usage percentage')


def collect_system_metrics():
    """
    Collecter les métriques système

    À appeler périodiquement (ex: toutes les 30 secondes)
    """
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_usage_gauge.set(cpu_percent)

        # Mémoire
        memory = psutil.virtual_memory()
        memory_usage_gauge.set(memory.percent)

        # Disque
        disk = psutil.disk_usage('/')
        disk_usage_gauge.set(disk.percent)

    except Exception as e:
        logger.error(f"Failed to collect system metrics: {e}")


# ============================================================================
# Décorateur pour mesurer la durée d'une fonction
# ============================================================================

def track_time(metric: Histogram, **labels):
    """
    Décorateur pour mesurer le temps d'exécution d'une fonction

    Args:
        metric: Métrique Histogram à utiliser
        **labels: Labels pour la métrique

    Example:
        @track_time(sync_operation_duration_seconds, operation_type="push")
        async def push_data():
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                metric.labels(**labels).observe(duration)
        return wrapper
    return decorator


# ============================================================================
# Endpoint custom pour les métriques de santé
# ============================================================================

def add_health_metrics_endpoint(app: FastAPI):
    """
    Ajouter un endpoint pour les métriques de santé de l'application

    Args:
        app: Application FastAPI
    """
    @app.get("/health/metrics", include_in_schema=False)
    async def health_metrics():
        """Endpoint pour les métriques de santé détaillées"""
        try:
            # Collecter les métriques système
            collect_system_metrics()

            # Retourner un résumé
            return {
                "status": "healthy",
                "metrics": {
                    "cpu_percent": psutil.cpu_percent(),
                    "memory_percent": psutil.virtual_memory().percent,
                    "disk_percent": psutil.disk_usage('/').percent,
                },
                "prometheus_endpoint": "/metrics"
            }
        except Exception as e:
            logger.error(f"Health metrics error: {e}")
            return {
                "status": "error",
                "error": str(e)
            }


# Instance globale du collecteur
metrics_collector = MetricsCollector()
