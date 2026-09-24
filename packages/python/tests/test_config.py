import os

from owlpane._generated_config import resolve_config_from_env


def test_missing_endpoint():
    os.environ.clear()
    assert resolve_config_from_env() is None


def test_basic():
    os.environ.clear()
    os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://ingest.test"
    os.environ["OWLPANE_INGEST_KEY"] = "owl_ing_" + "a" * 48
    os.environ["OTEL_SERVICE_NAME"] = "api"
    cfg = resolve_config_from_env()
    assert cfg is not None
    assert cfg.base_url == "https://ingest.test"
    assert cfg.service_name == "api"
    assert cfg.authorization.startswith("Bearer ")
