# frozen_string_literal: true

require_relative "owlpane/version"

module Owlpane
  module_function

  def sdk_disabled?
    ENV.fetch("OTEL_SDK_DISABLED", "").strip.casecmp("true").zero?
  end

  def otlp_endpoint
    return nil if sdk_disabled?

    endpoint = ENV.fetch("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip
    endpoint = ENV.fetch("OWLPANE_INGEST_URL", "").strip if endpoint.empty?
    return nil if endpoint.empty?

    endpoint.delete_suffix("/")
  end

  def authorization_header
    key = ENV.fetch("OWLPANE_INGEST_KEY", "").strip
    key.empty? ? nil : "Bearer #{key}"
  end

  def service_name
    name = ENV.fetch("OTEL_SERVICE_NAME", "").strip
    name.empty? ? "ruby-app" : name
  end
end
