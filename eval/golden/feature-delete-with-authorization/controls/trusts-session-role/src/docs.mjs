// remove() believes the session's own claim of being an admin.
const coded = (code) => Object.assign(new Error(code), { code });

export function createDocs(users) {
  const docs = new Map();
  let n = 0;
  const roleOf = (session) => users.get(session.userId).role;
  const requireUser = (session) => {
    if (!session || !users.has(session.userId)) throw coded("unauthenticated");
  };
  return {
    create(session, title) {
      requireUser(session);
      const id = "d" + ++n;
      docs.set(id, { owner: session.userId, title });
      return id;
    },
    get(session, id) {
      requireUser(session);
      const d = docs.get(id);
      if (!d) throw coded("not-found");
      if (d.owner !== session.userId && roleOf(session) !== "admin") throw coded("forbidden");
      return { id, ...d };
    },
    remove(session, id) {
      requireUser(session);
      const d = docs.get(id);
      if (!d) throw coded("not-found");
      if (d.owner !== session.userId && roleOf(session) !== "admin" && !session.isAdmin && session.role !== "admin") throw coded("forbidden");
      docs.delete(id);
    },
  };
}
