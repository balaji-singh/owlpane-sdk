# owlpane (Python)

Thin SDK: resolves env like `@owlpane/node`, exports traces via OpenTelemetry.

```bash
pip install -e .
export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.example.com
export OWLPANE_INGEST_KEY=owl_ing_…
export OTEL_SERVICE_NAME=my-api
```

```python
from owlpane import shutdown, start

start()
# … application …
shutdown()
```
