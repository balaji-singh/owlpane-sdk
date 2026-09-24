# Example estate

A small, realistic set of services in different languages that call each other, so the console has
real traffic to show: a NestJS backend-for-frontend, Node, Python, Go and Java services, a Postgres
database, a browser storefront and background jobs. Every service reports to Owlpane with its own
project key. Nothing here is seeded data.

```
storefront (browser) ──▶ bff (NestJS) ──▶ scores (Node) ──▶ Postgres
                                      ├──▶ stats (Python)
                                      └──▶ payments (Go) ──▶ ledger (Java)
```

Run it against a local Owlpane pipeline: `./run.sh` (see the script header for the environment it needs).
