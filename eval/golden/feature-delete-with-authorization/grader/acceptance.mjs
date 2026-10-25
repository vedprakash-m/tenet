export default async function acceptance({ probe }) {
  const checks = [];
  const run = (id, source, pred, detail) => {
    const r = probe(source);
    const pass = r.ok && pred(r.value);
    checks.push({ id, pass, detail: pass ? detail : r.ok ? JSON.stringify(r.value) : r.error });
  };
  const setup = `import { createDocs } from "./src/docs.mjs";
    const users = new Map([["owner", { role: "member" }], ["other", { role: "member" }], ["boss", { role: "admin" }]]);
    const code = (fn) => { try { fn(); return "ok"; } catch (e) { return e.code ?? "error"; } };
    const fresh = () => { const docs = createDocs(users); const id = docs.create({ userId: "owner" }, "Plan"); return { docs, id }; };
    const exists = (docs, id) => code(() => docs.get({ userId: "boss" }, id)) === "ok";`;

  run("owner-and-admin-may-remove", `${setup}
    const a = fresh(); const byOwner = [code(() => a.docs.remove({ userId: "owner" }, a.id)), exists(a.docs, a.id)];
    const b = fresh(); const byAdmin = [code(() => b.docs.remove({ userId: "boss" }, b.id)), exists(b.docs, b.id)];
    console.log(JSON.stringify([byOwner, byAdmin]));`,
    (v) => JSON.stringify(v) === JSON.stringify([["ok", false], ["ok", false]]), "owner and admin deletes succeed and remove the document");

  run("others-refused-and-doc-kept", `${setup}
    const a = fresh(); const r = code(() => a.docs.remove({ userId: "other" }, a.id));
    console.log(JSON.stringify([r, exists(a.docs, a.id)]));`,
    (v) => JSON.stringify(v) === JSON.stringify(["forbidden", true]), "a refused delete leaves the document");

  run("forged-claims-ignored", `${setup}
    const a = fresh(); const r = code(() => a.docs.remove({ userId: "other", role: "admin", isAdmin: true, admin: true }, a.id));
    console.log(JSON.stringify([r, exists(a.docs, a.id)]));`,
    (v) => JSON.stringify(v) === JSON.stringify(["forbidden", true]), "a session's own admin claims are not believed");

  run("errors-coded", `${setup}
    const { docs, id } = fresh();
    console.log(JSON.stringify([code(() => docs.remove({ userId: "boss" }, "nope")), code(() => docs.remove({ userId: "ghost" }, id)), code(() => docs.remove(undefined, id)), exists(docs, id)]));`,
    (v) => JSON.stringify(v) === JSON.stringify(["not-found", "unauthenticated", "unauthenticated", true]), "not-found and unauthenticated carry their codes");
  return checks;
}
