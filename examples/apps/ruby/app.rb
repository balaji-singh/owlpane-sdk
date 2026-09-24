# frozen_string_literal: true

require "opentelemetry/sdk"
require "opentelemetry/exporter/otlp"

endpoint = ENV.fetch("OTEL_EXPORTER_OTLP_ENDPOINT").chomp("/")
headers = {}
if (key = ENV.fetch("OWLPANE_INGEST_KEY", "")).strip != ""
  headers["Authorization"] = "Bearer #{key}"
end

exporter = OpenTelemetry::Exporter::OTLP::Exporter.new(
  endpoint: "#{endpoint}/v1/traces",
  headers: headers,
)

OpenTelemetry::SDK.configure do |c|
  c.service_name = ENV.fetch("OTEL_SERVICE_NAME")
  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(exporter),
  )
  c.resource = OpenTelemetry::SDK::Resources::Resource.create(
    {
      "deployment.environment.name" => ENV.fetch("OWLPANE_ENVIRONMENT", "development"),
      "service.version" => "0.1.1",
      "telemetry.sdk.language" => "ruby",
    },
  )
end

tracer = OpenTelemetry.tracer_provider.tracer("owlpane-dogfood")
tracer.in_span("GET /demo", kind: :server) {}
OpenTelemetry.tracer_provider.shutdown
puts "span emitted (#{ENV.fetch('OTEL_SERVICE_NAME')})"
