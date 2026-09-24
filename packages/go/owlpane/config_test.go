package owlpane_test

import (
	"os"
	"testing"

	"github.com/balaji-singh/owlpane-sdk/packages/go/owlpane"
)

func TestResolveConfigFromEnv_missingEndpoint(t *testing.T) {
	os.Clearenv()
	if c := owlpane.ResolveConfigFromEnv(); c != nil {
		t.Fatalf("expected nil, got %+v", c)
	}
}

func TestResolveConfigFromEnv_basic(t *testing.T) {
	os.Clearenv()
	os.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://ingest.test/")
	os.Setenv("OWLPANE_INGEST_KEY", "owl_ing_"+repeat("a", 48))
	os.Setenv("OTEL_SERVICE_NAME", "svc")
	cfg := owlpane.ResolveConfigFromEnv()
	if cfg == nil || cfg.BaseURL != "https://ingest.test" || cfg.ServiceName != "svc" {
		t.Fatalf("bad config: %+v", cfg)
	}
	if cfg.Authorization == "" {
		t.Fatal("expected authorization")
	}
}

func repeat(s string, n int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += s
	}
	return out
}
