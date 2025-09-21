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
  upsert(u: AccountRecord) { 
    console.log(`[USER_STORE] Upserting user: ${u.id}`, JSON.stringify(u, null, 2));
    users.set(u.id, u); 
    return u; 
  },
  get(id: string) { 
    const user = users.get(id);
    console.log(`[USER_STORE] Getting user: ${id}`, user ? JSON.stringify(user, null, 2) : 'Not found');
    return user; 
  },
};