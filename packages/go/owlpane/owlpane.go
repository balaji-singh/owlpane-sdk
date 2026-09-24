package owlpane

import (
	"context"
	"errors"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

type JobKind string

const (
	JobCron     JobKind = "cron"
	JobInterval JobKind = "interval"
	JobTimeout  JobKind = "timeout"
	JobQueue    JobKind = "queue"
	JobTask     JobKind = "task"
)

type ShutdownFunc func(context.Context) error

var (
	tp       *sdktrace.TracerProvider
	enabled  bool
	traceUP  bool
)

// Start configures OpenTelemetry export from environment (see ResolveConfigFromEnv).
// Returns a shutdown function, or (nil, nil) when unconfigured (no-op).
func Start(ctx context.Context, cfg *Config) (ShutdownFunc, error) {
	if cfg == nil {
		cfg = ResolveConfigFromEnv()
	}
	if cfg == nil {
		return nil, nil
	}
	if tp != nil {
		return Shutdown, nil
	}

	opts := []otlptracehttp.Option{
		otlptracehttp.WithEndpointURL(cfg.BaseURL + "/v1/traces"),
	}
	if cfg.Authorization != "" {
		opts = append(opts, otlptracehttp.WithHeaders(map[string]string{
			"Authorization": cfg.Authorization,
		}))
	}

	exp, err := otlptracehttp.New(ctx, opts...)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.Version),
			attribute.String("deployment.environment.name", cfg.Environment),
		),
	)
	if err != nil {
		return nil, err
	}

	sampler := sdktrace.TraceIDRatioBased(cfg.SampleRatio)
	tp = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.ParentBased(sampler)),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	enabled = true
	traceUP = cfg.TraceUserProfile
	return Shutdown, nil
}

func Shutdown(ctx context.Context) error {
	if tp == nil {
		return nil
	}
	err := tp.Shutdown(ctx)
	tp = nil
	enabled = false
	return err
}

func IsEnabled() bool { return enabled }

// Job runs fn as a root span with job.* attributes (portable API).
func Job(ctx context.Context, name string, kind JobKind, attrs map[string]string, fn func(context.Context) error) error {
	if !enabled {
		return fn(ctx)
	}
	tr := otel.Tracer("owlpane-jobs")
	kindAttr := trace.SpanKindInternal
	if kind == JobQueue {
		kindAttr = trace.SpanKindConsumer
	}
	start := time.Now()
	ctx, span := tr.Start(ctx, name, trace.WithNewRoot(), trace.WithSpanKind(kindAttr))
	span.SetAttributes(
		attribute.String("job.name", name),
		attribute.String("job.kind", string(kind)),
	)
	for k, v := range attrs {
		span.SetAttributes(attribute.String(k, v))
	}
	outcome := "success"
	err := fn(ctx)
	if err != nil {
		outcome = "failure"
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	span.SetAttributes(attribute.String("job.outcome", outcome))
	span.End()
	_ = start
	return err
}

// SetUser tags the active span with enduser.id (and optional profile when TraceUserProfile is on).
func SetUser(ctx context.Context, id string, email, name string) {
	if id == "" || !enabled {
		return
	}
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}
	span.SetAttributes(attribute.String("enduser.id", id))
	if !traceUP {
		return
	}
	if email != "" {
		span.SetAttributes(attribute.String("enduser.email", email))
	}
	if name != "" {
		span.SetAttributes(attribute.String("enduser.name", name))
	}
}

// EmitTestSpan is used by conformance tests to send one span.
func EmitTestSpan(ctx context.Context, spanName string) error {
	if !enabled {
		return errors.New("owlpane not enabled")
	}
	_, span := otel.Tracer("owlpane").Start(ctx, spanName)
	defer span.End()
	return nil
}

// MustParseConfigForTest exposes resolved config for tests.
func MustParseConfigForTest() *Config {
	return ResolveConfigFromEnv()
}
