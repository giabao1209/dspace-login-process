const users = new Map();
export const UserStore = {
    upsert(u) { users.set(u.id, u); return u; },
    get(id) { return users.get(id); },
};
//# sourceMappingURL=store.js.map