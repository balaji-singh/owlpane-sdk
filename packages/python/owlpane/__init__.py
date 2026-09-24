"""Owlpane thin Python SDK — configures OpenTelemetry export from environment."""

from __future__ import annotations

from typing import Callable, Optional

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBasedTraceIdRatio

from owlpane._generated_config import Config, resolve_config_from_env

_provider: Optional[TracerProvider] = None
_enabled = False


def start(cfg: Optional[Config] = None) -> Optional[Callable[[], None]]:
    """Start OTLP export. Returns shutdown callable, or None when unconfigured."""
    global _provider, _enabled
    if cfg is None:
        cfg = resolve_config_from_env()
    if cfg is None:
        return None
    if _provider is not None:
        return shutdown

    headers = {}
    if cfg.authorization:
        headers["Authorization"] = cfg.authorization

    exporter = OTLPSpanExporter(
        endpoint=f"{cfg.base_url}/v1/traces",
        headers=headers,
    )
    resource = Resource.create(
        {
            "service.name": cfg.service_name,
            "service.version": cfg.version,
            "deployment.environment.name": cfg.environment,
            "telemetry.sdk.language": "python",
        }
    )
    sampler = ParentBasedTraceIdRatio(cfg.sample_ratio)
    _provider = TracerProvider(resource=resource, sampler=sampler)
    _provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(_provider)
    _enabled = True
    return shutdown


def shutdown() -> None:
    global _provider, _enabled
    if _provider is not None:
        _provider.shutdown()
        _provider = None
    _enabled = False


def is_enabled() -> bool:
    return _enabled


def emit_test_span(name: str) -> None:
    if not _enabled:
        raise RuntimeError("owlpane not enabled")
    tracer = trace.get_tracer("owlpane")
    with tracer.start_as_current_span(name):
        pass


def emit_console_demo_span() -> None:
    """Server span for Owlpane Applications → runtime RED boards."""
    if not _enabled:
        raise RuntimeError("owlpane not enabled")
    tracer = trace.get_tracer("owlpane")
    with tracer.start_as_current_span("GET /demo", kind=trace.SpanKind.SERVER):
        pass
