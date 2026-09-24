from opentelemetry import trace

from owlpane import shutdown, start

fn = start()
if fn is None:
    raise SystemExit("owlpane did not start — check examples/.env")

tracer = trace.get_tracer("owlpane-dogfood")
with tracer.start_as_current_span("GET /demo", kind=trace.SpanKind.SERVER):
    pass

shutdown()
import os

print(f"span emitted ({os.environ.get('OTEL_SERVICE_NAME', 'owlpane-sdk-python')})")
