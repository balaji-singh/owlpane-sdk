# Kubeshark → Owlpane flow forwarder (example)

Example pattern for forwarding Kubeshark-observed traffic into Owlpane as `owlpane.flow.*` OTLP logs.

## Prerequisites

- Kubeshark installed (`helm install` from [kubeshark/kubeshark](https://github.com/kubeshark/kubeshark))
- Owlpane ingest URL and project ingest key
- Cluster name matching `owlpane-agent` `cluster.name`

## Configure

```bash
export OWLPANE_INGEST_ENDPOINT=https://ingest.example.com
export OWLPANE_INGEST_KEY=owl_ing_...
export K8S_CLUSTER_NAME=my-cluster
```

## Deploy

```bash
kubectl apply -f deploy.yaml
```

The sample `deploy.yaml` runs a loop that emits **synthetic** flow records shaped like Kubeshark exports. Replace the loop body with calls to your Kubeshark API / export hook when wiring production.

## Docs

Full bridge guide: [docs/ops/kubeshark-owlpane-bridge.md](../../docs/ops/kubeshark-owlpane-bridge.md)
