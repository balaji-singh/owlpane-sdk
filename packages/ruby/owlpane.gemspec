# frozen_string_literal: true

require_relative "lib/owlpane/version"

Gem::Specification.new do |s|
  s.name = "owlpane"
  s.version = Owlpane::VERSION
  s.authors = ["Owlpane"]
  s.email = ["support@owlpane.dev"]
  s.summary = "Thin Owlpane env bootstrap for OpenTelemetry Ruby"
  s.description = "Resolves ingest URL and key from environment for OTLP export."
  s.homepage = "https://github.com/balaji-singh/owlpane-sdk"
  s.license = "MIT"
  s.required_ruby_version = ">= 3.0"
  s.files = Dir["lib/**/*.rb"]
  s.require_paths = ["lib"]
  s.metadata = {
    "source_code_uri" => "https://github.com/balaji-singh/owlpane-sdk/tree/main/packages/ruby",
  }
end
