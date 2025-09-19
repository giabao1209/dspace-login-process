import type Provider from 'oidc-provider';
import { loginUrl, serviceValidate } from '../cas/cas-client.js';
import { UserStore } from '../identity/store.js';
import { cfg } from '../config.js';

// In-memory store for interaction data (in production, use Redis or similar)
const interactionStore = new Map<string, any>();

// Cleanup expired interactions periodically
setInterval(() => {
  const now = Date.now();
  for (const [uid, interaction] of interactionStore.entries()) {
    if (now - interaction.createdAt > 30 * 60 * 1000) { // 30 minutes
      interactionStore.delete(uid);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

export function mountLoginRoutes(app: any, provider: Provider) {
  provider.interactionUrl = async (ctx, interaction) => {
    console.log(`Creating interaction URL for interaction ID: ${interaction.uid}`);
    // Store interaction details in our own store
    interactionStore.set(interaction.uid, {
      uid: interaction.uid,
      params: interaction.params,
      returnTo: interaction.returnTo,
      createdAt: Date.now()
    });
    return `/interaction/${interaction.uid}`;
  };

  app.get('/interaction/:uid', async (req, res, next) => {
    try {
      const { uid } = req.params;
      console.log(`Interaction request received for UID: ${uid}`);
      
      // Check if we have the interaction data
      const interaction = interactionStore.get(uid);
      if (!interaction) {
        console.error(`No interaction data found for UID: ${uid}`);
        return res.status(400).send('Invalid or expired session');
      }
      
      // Redirect to CAS with the interaction UID in the service URL
      const service = `${cfg.publicUrl}/cas/callback?uid=${uid}`;
      console.log(`Redirecting to CAS login with service: ${service}`);
      res.redirect(loginUrl(service));
    } catch (e) { 
      console.error('Error in interaction endpoint:', e);
      res.status(500).send('Authentication flow error. Please try again.');
    }
  });

  app.get('/cas/callback', async (req, res, next) => {
    try {
      const { ticket, uid } = req.query as { ticket: string, uid: string };
      console.log(`CAS callback received with uid: ${uid} and ticket: ${ticket}`);
      
      if (!ticket) {
        throw new Error('Missing ticket in CAS callback');
      }
      if (!uid) {
        throw new Error('Missing interaction UID in callback');
      }
      
      // Retrieve interaction data from our store
      const interaction = interactionStore.get(uid);
      if (!interaction) {
        console.error(`No interaction data found for UID: ${uid}`);
        return res.status(400).send('Invalid or expired session');
      }
      
      const service = `${cfg.publicUrl}/cas/callback?uid=${uid}`;

      const casUser = await serviceValidate(service, ticket);
      console.log(`CAS validation successful for user: ${casUser.user}`);

      const sub = casUser.user;
      UserStore.upsert({
        id: sub,
        username: casUser.user,
        email: casUser.email,
        name: casUser.name,
        roles: Array.from(new Set(casUser.roles)),
        raw: casUser.raw
      });

      // Clean up the interaction data
      interactionStore.delete(uid);

      // Create the interaction result
      const result = {
        login: { accountId: sub, remember: true },
        consent: {
          grant: {
            rejectedScopes: [],
            rejectedClaims: [],
            replace: false,
          }
        }
      };

      // Use interactionResult which is designed for external authentication flows
      // This method doesn't require the original session cookies
      await provider.interactionResult(req, res, result, {
        mergeWithLastSubmission: false
      });

    } catch (e) { 
      console.error('Error in CAS callback:', e);
      res.status(500).send('Authentication failed. Please try again.');
    }
  });
}