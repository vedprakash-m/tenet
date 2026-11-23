export function healthResponse() {
  return { status: 200, body: { ok: true, service: "ledgergate" } };
}
