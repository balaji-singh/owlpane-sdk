import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;

// Compiled without any OpenTelemetry dependency wiring beyond the API: the -javaagent installs the SDK
// and exporter from OTEL_* environment variables. Here one span is created by hand so the sample
// is deterministic; real apps get spans for HTTP, JDBC, etc. automatically.
public class App {
  public static void main(String[] args) throws Exception {
    Span span = GlobalOpenTelemetry.getTracer("owlpane-example").spanBuilder("hello-owlpane").startSpan();
    Thread.sleep(50);
    span.end();
    System.out.println("span emitted");
  }
}
