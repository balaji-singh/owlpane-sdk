package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/balaji-singh/owlpane-sdk/packages/go/owlpane"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

func main() {
	ctx := context.Background()
	shutdown, err := owlpane.Start(ctx, nil)
	if err != nil {
		log.Fatal(err)
	}
	if shutdown == nil {
		log.Fatal("owlpane did not start — check examples/.env")
	}

	_, span := otel.Tracer("owlpane-dogfood").Start(ctx, "GET /demo", trace.WithSpanKind(trace.SpanKindServer))
	span.End()

	if err := shutdown(ctx); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("span emitted (%s)\n", mustService())
}

func mustService() string {
	return getenv("OTEL_SERVICE_NAME", "owlpane-sdk-go")
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
