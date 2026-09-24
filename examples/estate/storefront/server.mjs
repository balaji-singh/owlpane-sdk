// Serves the storefront page and the browser SDK. The project key is handed to the page at runtime,
// the way a real site would embed its browser key.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
const sdk = new URL("../../../packages/browser/dist/", import.meta.url).pathname;
const page = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const types = { ".js": "text/javascript", ".html": "text/html" };
http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/config.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end(`window.ESTATE = ${JSON.stringify({ key: process.env.OWLPANE_INGEST_KEY, endpoint: process.env.OWLPANE_PUBLIC_ENDPOINT, bff: process.env.BFF_PUBLIC_URL })};`);
  }
  if (path.startsWith("/sdk/")) {
    const f = join(sdk, normalize(path.slice(5)).replace(/^(\.\.[/\\])+/, ""));
    if (existsSync(f)) { res.writeHead(200, { "content-type": types[extname(f)] ?? "application/octet-stream" }); return res.end(readFileSync(f)); }
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { "content-type": "text/html" }); res.end(page);
}).listen(5180, () => console.log("storefront on :5180"));
