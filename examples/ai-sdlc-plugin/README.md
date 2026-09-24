# Coding activity ingest

Forward coding-agent traces to Owlpane. The Coding activity page (`/observability/ai-sdlc`) counts only spans that carry a coding-agent attribute, a `coding_agent.*` span name, or a repository together with a model, operation, or tool. Ordinary application chat spans are left out.

## Span attributes

Send these on OTLP traces. Owlpane shows a value only when the attribute is present. It does not estimate cost or invent a model name.

| Attribute | Used for |
|-----------|----------|
| `coding_agent.session.id` | Session grouping. Falls back to the trace id when absent. |
| `coding_agent.harness` | Tool name (`claude-code`, `cursor`, `codex`, `copilot-cli`). `gen_ai.system` is used when harness is absent. |
| `coding_agent.stage` | Stage duration (coding, review, merge). |
| `coding_agent.pull_request.id` | Distinct assisted pull requests. `vcs.change.id` is used when this is absent. |
| `gen_ai.request.model` | Model name. `gen_ai.response.model` is the fallback. |
| `gen_ai.usage.input_tokens` / `output_tokens` | Token counts. A missing count stays blank. |
| `gen_ai.usage.cost` | Reported USD. Owlpane never prices tokens itself. |
| `vcs.repository.name` | Repository. `vcs.repository.url` is the fallback. |
| `vcs.change.state` | Stage duration when `coding_agent.stage` is absent. |
| `tool.name` | Tool and skill calls. |
| `user.name` or `enduser.id` | Adoption. Hash the value if you do not want a raw identifier. |

## Privacy

Do not send prompt or completion bodies. Owlpane queries do not read them.

## Console

After spans arrive, open Coding activity. Overview, Adoption, Cost, Productivity, Tools, and Sessions each stay on the get-started state until matching spans are in the selected time range.
