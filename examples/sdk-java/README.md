# Java example (OTel agent JAR + env)

No `com.owlpane:owlpane-java` on Maven Central yet — this uses the **OpenTelemetry Java agent** and the same env vars as the console wizard.

```bash
cp ../.env.console.example ../.env
./run-console.sh
```

JARs are cached under `lib/` (gitignored via parent `java/.gitignore` pattern).
