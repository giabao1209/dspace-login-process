export type AccountRecord = {
  id: string;                      // sub
  username: string;
  email?: string;
  name?: string;
  roles: string[];
  raw?: Record<string, any>;
};

const users = new Map<string, AccountRecord>();

export const UserStore = {
  upsert(u: AccountRecord) { users.set(u.id, u); return u; },
  get(id: string) { return users.get(id); },
};