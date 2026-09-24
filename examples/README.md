# Plain OpenTelemetry samples

Tiny programs that emit one span using only the upstream OpenTelemetry SDK or agent, configured purely
by environment variables as described in [docs/reference/opentelemetry-any-language.md](../docs/reference/opentelemetry-any-language.md).

Each `run.sh` starts a throwaway receiver ([`_receiver/receiver.mjs`](_receiver/receiver.mjs), Node, listens
on 127.0.0.1 on a random port, forwards nothing), runs the sample against it with the placeholder key
`owl_ing_test_local_key`, and exits 0 only if the receiver saw a decodable `POST /v1/traces` with a
`Bearer owl_ing_` header, the right `service.name` and the expected span. They never contact a real endpoint.

| Sample | Needs | Run |
|---|---|---|
| [`python`](python) | python3, node, network for pip | `python/run.sh` |
| [`go`](go) | go, node, network for modules | `go/run.sh` |
| [`java`](java) | JDK 17+, node, network for the agent and API jars | `java/run.sh` |

There is no .NET sample: no .NET SDK was available, so that guide is marked Partial and untested.
Setting `HEADERS_VALUE='Authorization=Bearer owl_ing_test_local_key'` runs the literal-space header form.
