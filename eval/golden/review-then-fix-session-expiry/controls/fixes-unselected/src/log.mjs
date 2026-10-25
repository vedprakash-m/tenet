// logRequest(req): one line per request for the access log.
export function logRequest(req) {
  return req.method + " " + req.url;
}
