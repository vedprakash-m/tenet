import { expect, it } from "vitest";
import type { RouteOptions } from "fastify";
import { admissionApp } from "./support/admission.ts";

it.each(["declared", "late-route"])("refuses %s grouping visible to the ready diagnostic [QLT-12]", async kind => {
  const c = await admissionApp(), rate: { max: number; groupId?: string } = { max: 10000 };
  try {
    if (kind === "declared") rate.groupId = "unsupported";
    if (kind === "late-route") c.app.addHook("onRoute", route => { if (route.url === "/api/grouped") rate.groupId = "unsupported"; });
    c.app.get("/api/grouped", { config: { rateLimit: rate } }, async () => ({ reached: true }));
    await expect(c.app.ready()).rejects.toThrow(/rate.limit metadata/i);
    expect(c.app.server.listening).toBe(false);
  } finally { await c.close(); }
});

it("fails closed for later ready mutation before counters or handlers [QLT-12]", async () => {
  const c = await admissionApp(), rate: { max: number; groupId?: string } = { max: 10000 }; let calls = 0;
  c.app.get("/api/grouped", { config: { rateLimit: rate } }, async () => { calls++; return {}; });
  c.app.addHook("onReady", async () => { rate.groupId = "late"; });
  try {
    await c.app.ready();
    const refused = await c.app.inject({ method: "GET", url: "/api/grouped" });
    expect(refused.statusCode).toBe(500); expect(calls).toBe(0);
    expect(refused.json()).toMatchObject({ type: "urn:problem:internal" });
    expect(refused.body).not.toContain("late");
    for (let n = 0; n < 120; n++) expect((await c.app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
  } finally { await c.close(); }
});

it("checks served metadata when retained registration options detach [QLT-12]", async () => {
  const c = await admissionApp(), rate: { max: number; groupId?: string } = { max: 10000 };
  let captured: RouteOptions | undefined, calls = 0;
  c.app.addHook("onRoute", route => { if (route.url === "/api/detached") captured = route; });
  c.app.get("/api/detached", { config: { rateLimit: rate } }, async () => { calls++; return {}; });
  c.app.addHook("onReady", async () => { rate.groupId = "detached"; captured!.config = { rateLimit: { max: 10000 } }; });
  try {
    await c.app.ready();
    expect((await c.app.inject({ method: "GET", url: "/api/detached" })).statusCode).toBe(500);
    expect(calls).toBe(0);
  } finally { await c.close(); }
});

it.each(["groupId", "max"])("never evaluates a late %s accessor in admission [QLT-12]", async field => {
  const c = await admissionApp(), rate = { max: 10000 }; let reads = 0, calls = 0;
  c.app.get("/api/accessor", { config: { rateLimit: rate } }, async () => { calls++; return {}; });
  c.app.addHook("onReady", async () => { Object.defineProperty(rate, field, { configurable: true, get: () => { reads++; return reads % 2 ? undefined : "split"; } }); });
  try {
    await c.app.ready();
    expect((await c.app.inject({ method: "GET", url: "/api/accessor" })).statusCode).toBe(500);
    expect(reads).toBe(0); expect(calls).toBe(0);
  } finally { await c.close(); }
});

it("rejects a late custom metadata prototype [QLT-12]", async () => {
  const c = await admissionApp(), rate = { max: 10000 }; let calls = 0;
  c.app.get("/api/prototype", { config: { rateLimit: rate } }, async () => { calls++; return {}; });
  c.app.addHook("onReady", async () => { Object.setPrototypeOf(rate, { groupId: "split" }); });
  try {
    expect((await c.app.inject({ method: "GET", url: "/api/prototype" })).statusCode).toBe(500);
    expect(calls).toBe(0);
  } finally { await c.close(); }
});

it.each(["replace", "mutate", "accessor", "prototype"])("keeps counters unpartitioned after a later %s attempt and repeated sealing [QLT-12]", async kind => {
  const c = await admissionApp(); let attempts = 0;
  c.app.get("/api/sealed", { config: { rateLimit: { max: 10000 } } }, async () => ({ reached: true }));
  c.app.addHook("onRequest", async req => {
    if (req.routeOptions.url !== "/api/sealed") return;
    const config = req.routeOptions.config, rate = config.rateLimit;
    if (!rate || typeof rate !== "object") throw new Error("expected object rate metadata");
    attempts++;
    if (kind === "replace") expect(Reflect.set(config, "rateLimit", { groupId: String(attempts) })).toBe(false);
    if (kind === "mutate") expect(Reflect.set(rate, "groupId", String(attempts))).toBe(false);
    if (kind === "accessor") expect(() => Object.defineProperty(rate, "groupId", { get: () => String(attempts) })).toThrow();
    if (kind === "prototype") expect(Reflect.setPrototypeOf(rate, { groupId: String(attempts) })).toBe(false);
    const descriptor = Object.getOwnPropertyDescriptor(rate, "groupId");
    expect(descriptor).toMatchObject({ value: undefined, writable: false, configurable: false });
    expect(Object.getPrototypeOf(rate)).toBeNull();
  });
  try {
    for (let n = 0; n < 120; n++) expect((await c.app.inject({ method: "GET", url: "/api/sealed" })).statusCode).toBe(200);
    const refused = await c.app.inject({ method: "GET", url: "/api/sealed" });
    expect(refused.statusCode).toBe(429); expect(refused.headers["x-ratelimit-limit"]).toBe("120");
    expect(attempts).toBe(120);
  } finally { await c.close(); }
});
