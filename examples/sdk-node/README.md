# Node example (published `@balaji-singh/owlpane-node`)

Emits one `hello-owlpane` job span to your **local ingest** using the GitHub Packages build.

```bash
cp ../.env.console.example ../.env   # edit key + URL
export GITHUB_PACKAGES_TOKEN=ghp_... # or: gh auth login with read:packages
./run-console.sh
```

Use monorepo package instead of registry:

```bash
OWLPANE_SDK_SOURCE=local ./run-console.sh
```
