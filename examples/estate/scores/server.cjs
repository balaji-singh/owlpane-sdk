// CommonJS on purpose: the OpenTelemetry auto-instrumentation hooks require(), not ESM imports of built-ins.
const { owlpane } = require("../../../packages/node");
owlpane.start({ service: "scores-service", ingestKey: process.env.OWLPANE_INGEST_KEY, endpoint: process.env.OWLPANE_ENDPOINT, environment: "production", release: "2.4.0" });
const http = require("node:http");
const pg = require("pg");
const pool = new pg.Pool({ connectionString: process.env.ESTATE_DB, max: 4 });
http.createServer(async (req, res) => {
  const m = req.url.match(/^\/scores\/(\d+)/);
  if (!m) { res.writeHead(404).end(); return; }
  try {
    // The occasional heavy join, so the Databases page has a slow query to rank.
    const slow = Number(m[1]) % 6 === 0;
    const { rows } = await pool.query(slow ? "SELECT m.id, m.league, pg_sleep(0.18), (SELECT count(*) FROM balls b WHERE b.match_id = m.id) AS balls FROM matches m WHERE m.id = $1" : "SELECT id, league, home, away FROM matches WHERE id = $1", [m[1]]);
    if (!rows[0]) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(rows[0]));
  } catch (e) { res.writeHead(500).end(String(e.message)); }
}).listen(Number(process.env.PORT) || 5101, () => console.log("scores-service up"));
