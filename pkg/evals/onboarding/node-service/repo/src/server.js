import http from "node:http";
import { MAX_BODY_BYTES } from "./config/limits.js";
import { healthResponse } from "./routes/health.js";

export function createServer() {
  return http.createServer((req, res) => {
    if (req.url === "/healthz") {
      const h = healthResponse();
      res.writeHead(h.status, { "content-type": "application/json" }).end(JSON.stringify(h.body));
      return;
    }
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) req.destroy();
    });
    req.on("end", () => res.writeHead(202).end("accepted"));
  });
}
