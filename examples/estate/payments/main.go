package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func main() {
	ctx := context.Background()
	exp, err := otlptracehttp.New(ctx) // endpoint and key come from OTEL_EXPORTER_OTLP_* variables
	if err != nil {
		log.Fatal(err)
	}
	res, _ := resource.New(ctx, resource.WithAttributes(semconv.ServiceName("payments-service"), semconv.ServiceVersion("1.7.2"), attribute.String("deployment.environment.name", "production")))
	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exp), sdktrace.WithResource(res))
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	tracer := otel.Tracer("payments")
	client := http.Client{Transport: otelhttp.NewTransport(http.DefaultTransport), Timeout: 2 * time.Second}
	ledger := os.Getenv("LEDGER_URL")

	mux := http.NewServeMux()
	mux.HandleFunc("/charge", func(w http.ResponseWriter, r *http.Request) {
		ctx, span := tracer.Start(r.Context(), "provider.authorize")
		defer span.End()
		time.Sleep(time.Duration(30+rand.Intn(80)) * time.Millisecond)
		if rand.Intn(7) == 0 { // the payment provider times out now and then
			time.Sleep(700 * time.Millisecond)
			err := fmt.Errorf("provider timed out after 700ms")
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, ledger+"/record", strings.NewReader("{}"))
		if resp, err := client.Do(req); err == nil {
			resp.Body.Close()
		}
		fmt.Fprint(w, `{"status":"captured"}`)
	})
	log.Println("payments-service on :5103")
	log.Fatal(http.ListenAndServe(":5103", otelhttp.NewHandler(mux, "payments")))
}
