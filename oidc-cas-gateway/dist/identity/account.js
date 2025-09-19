import { UserStore } from './store.js';
export const findAccount = async (_ctx, id) => {
    const u = UserStore.get(id);
    if (!u)
        return undefined;
    return {
        accountId: u.id,
        async claims(_use, _scope, _claims, _reject) {
            return {
                sub: u.id,
                preferred_username: u.username,
                email: u.email,
                name: u.name,
                roles: u.roles,
            };
        },
    };
};
//# sourceMappingURL=account.js.map