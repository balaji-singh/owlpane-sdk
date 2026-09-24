import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;

/** OpenTelemetry Java agent + OTEL_* env (InstallGuide → Any OpenTelemetry SDK). */
public class App {
  public static void main(String[] args) throws Exception {
    var tracer = GlobalOpenTelemetry.getTracer("owlpane-dogfood");
    Span server = tracer.spanBuilder("GET /demo").setSpanKind(SpanKind.SERVER).startSpan();
    Thread.sleep(40);
    server.end();
    System.out.println("span emitted");
  }
}
