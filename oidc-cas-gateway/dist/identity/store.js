const users = new Map();
export const UserStore = {
    upsert(u) {
        console.log(`[USER_STORE] Upserting user: ${u.id}`, JSON.stringify(u, null, 2));
        users.set(u.id, u);
        return u;
    },
    get(id) {
        const user = users.get(id);
        console.log(`[USER_STORE] Getting user: ${id}`, user ? JSON.stringify(user, null, 2) : 'Not found');
        return user;
    },
};
//# sourceMappingURL=store.js.map