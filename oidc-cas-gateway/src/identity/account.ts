import type { Account } from 'oidc-provider';
import { UserStore } from './store.js';

// Function to validate and sanitize email address format
function sanitizeEmail(email: string): string | undefined {
  console.log(`[ACCOUNT] sanitizeEmail called with: "${email}"`);
  
  if (!email) {
    console.log(`[ACCOUNT] sanitizeEmail returning undefined - email is falsy`);
    return undefined;
  }
  
  // Trim whitespace
  let sanitized = email.trim();
  console.log(`[ACCOUNT] sanitizeEmail after trim: "${sanitized}"`);
  
  // If it contains spaces, try to fix it by removing them
  if (sanitized.includes(' ')) {
    console.log(`[ACCOUNT] sanitizeEmail found spaces in email`);
    // Try to fix common issues like "user @domain.com" or "user@ domain.com"
    sanitized = sanitized.replace(/\s+/g, '');
    console.log(`[ACCOUNT] sanitizeEmail after removing spaces: "${sanitized}"`);
  }
  
  // Basic email validation - checks for @ symbol
  if (sanitized.includes('@')) {
    console.log(`[ACCOUNT] sanitizeEmail returning valid email: "${sanitized}"`);
    return sanitized;
  }
  
  console.log(`[ACCOUNT] sanitizeEmail returning undefined - email invalid after processing`);
  return undefined;
}

export const findAccount: (ctx: any, id: string) => Promise<Account | undefined> = async (_ctx, id) => {
  const u = UserStore.get(id);
  if (!u) return undefined;
  return {
    accountId: u.id,
    async claims(_use, _scope, _claims, _reject) {
      console.log(`[ACCOUNT] claims function called for user ${u.id}`);
      console.log(`[ACCOUNT] User data:`, JSON.stringify(u, null, 2));
      
      // Validate and sanitize email address
      let email: string | undefined = undefined;
      if (u.email) {
        console.log(`[ACCOUNT] Processing email for user ${u.id}: "${u.email}"`);
        email = sanitizeEmail(u.email);
        if (!email) {
          console.warn(`[ACCOUNT] Invalid email address for user ${u.id}: ${u.email}`);
          // If the email is invalid, generate a fallback email
          email = `${u.id}@example.com`;
          console.warn(`[ACCOUNT] Using fallback email for user ${u.id}: ${email}`);
        } else {
          console.log(`[ACCOUNT] Sanitized email for user ${u.id}: ${email}`);
        }
      } else {
        console.log(`[ACCOUNT] No email found for user ${u.id}`);
      }
      
      const claims = {
        sub: u.id,
        preferred_username: u.username,
        email: email,
        name: u.name,
        roles: u.roles,
      };
      
      console.log(`[ACCOUNT] Returning claims for user ${u.id}:`, JSON.stringify(claims, null, 2));
      
      return claims;
    },
  };
};