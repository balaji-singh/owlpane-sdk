import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Random;
import java.util.logging.Logger;

public class Ledger {
  static final Logger LOG = Logger.getLogger("ledger");
  public static void main(String[] args) throws IOException {
    HttpServer s = HttpServer.create(new InetSocketAddress(5104), 0);
    Random rnd = new Random();
    s.createContext("/record", ex -> {
      try { Thread.sleep(10 + rnd.nextInt(40)); } catch (InterruptedException ignored) {}
      LOG.info("ledger entry written");
      byte[] body = "{\"ok\":true}".getBytes();
      ex.sendResponseHeaders(200, body.length);
      ex.getResponseBody().write(body);
      ex.close();
    });
    s.start();
    System.out.println("ledger-service on :5104");
  }
}
