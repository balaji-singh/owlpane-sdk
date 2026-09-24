package com.owlpane;

/** Resolves Owlpane ingest settings from environment (sdk-contract). Use with the OTel Java agent. */
public final class OwlpaneEnv {
  private OwlpaneEnv() {}

  public static boolean sdkDisabled() {
    return "true".equalsIgnoreCase(trim(System.getenv("OTEL_SDK_DISABLED")));
  }

  public static String otlpEndpoint() {
    if (sdkDisabled()) return null;
    String endpoint = trim(System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"));
    if (endpoint == null || endpoint.isEmpty()) {
      endpoint = trim(System.getenv("OWLPANE_INGEST_URL"));
    }
    if (endpoint == null || endpoint.isEmpty()) return null;
    return endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
  }

  public static String authorizationHeader() {
    String key = trim(System.getenv("OWLPANE_INGEST_KEY"));
    return (key == null || key.isEmpty()) ? null : "Bearer " + key;
  }

  public static String serviceName() {
    String s = trim(System.getenv("OTEL_SERVICE_NAME"));
    return (s == null || s.isEmpty()) ? "java-app" : s;
  }

  private static String trim(String v) {
    return v == null ? null : v.trim();
  }
}
