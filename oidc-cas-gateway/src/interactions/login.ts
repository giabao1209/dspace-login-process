import type Provider from 'oidc-provider';
import { loginUrl, serviceValidate } from '../cas/cas-client.js';
import { UserStore } from '../identity/store.js';
import { cfg } from '../config.js';

export function mountLoginRoutes(app: any, provider: Provider) {
  app.get('/interaction/:uid', async (req, res, next) => {
    try {
      const { uid } = req.params;
      console.log(`=== INTERACTION START ===`);
      console.log(`Interaction request received for UID: ${uid}`);
      console.log(`Request URL: ${req.url}`);
      console.log(`Request method: ${req.method}`);
      console.log(`Request headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`Request query:`, JSON.stringify(req.query, null, 2));
      
      // Get interaction details from the OIDC provider
      const details = await provider.interactionDetails(req, res);
      console.log('Interaction details:', JSON.stringify(details, null, 2));
      
      // Log client information
      if (details.params.client_id) {
        console.log(`Client ID from request: ${details.params.client_id}`);
        console.log(`DSpace client ID from config: ${cfg.dspaceClient.id}`);
        console.log(`Is this the DSpace client? ${details.params.client_id === cfg.dspaceClient.id}`);
      }
      
      // Log the expected redirect URI
      console.log(`Expected redirect URI: ${details.params.redirect_uri}`);
      console.log(`Return URL: ${details.returnTo}`);
      
      // Check what kind of prompt we're dealing with
      if (details.prompt.name === 'login') {
        console.log('Handling login prompt');
        console.log('Reasons:', details.prompt.reasons);
        // Create a dynamic callback URL that includes the UID in the path
        const service = `${cfg.publicUrl}/interaction/${uid}/cas/callback`;
        console.log(`Redirecting to CAS login with service: ${service}`);
        const casLoginUrl = loginUrl(service);
        console.log(`Full CAS login URL: ${casLoginUrl}`);
        res.redirect(casLoginUrl);
        console.log(`=== REDIRECT SENT TO CAS ===`);
        return;

      } else if (details.prompt.name === 'consent') {
        console.log('Handling consent prompt');
        console.log('Reasons:', details.prompt.reasons);
        console.log('Client ID from request:', details.params.client_id);
        console.log('DSpace client ID from config:', cfg.dspaceClient.id);
        console.log('Is this the DSpace client?', details.params.client_id === cfg.dspaceClient.id);
        
        // For the DSpace client, we auto-grant consent
        if (details.params.client_id === cfg.dspaceClient.id) {
          console.log('>>> TRUSTED DSPACE CLIENT DETECTED, auto-granting consent');
          
          const { session, params } = details;
          const accountId = session?.accountId;

          if (!accountId) {
            // This should not happen if the user is logged in
            console.error('No accountId found in session for consent grant');
            // Redirect to login if something is wrong
            const service = `${cfg.publicUrl}/interaction/${uid}/cas/callback`;
            const casLoginUrl = loginUrl(service);
            res.redirect(casLoginUrl);
            return;
          }

          const grant = new provider.Grant({
            accountId,
            clientId: params.client_id as string,
          });

          const scopes = (params.scope as string)?.split(' ') || [];
          if (scopes.length > 0) {
            grant.addOIDCScope(scopes.join(' '));
          }
          
          const grantId = await grant.save();

          const result = {
            consent: {
              grantId,
            },
          };

          console.log('Finishing interaction with consent result:', JSON.stringify(result, null, 2));
          await provider.interactionFinished(req, res, result, {
            mergeWithLastSubmission: true,
          });
          console.log('=== CONSENT GRANTED AND INTERACTION FINISHED ===');
          return;
        }
        
        // For other clients or when accountId is missing, redirect back to the OIDC flow
        // Get the accountId from the session or last submission
        const accountId = details.session?.accountId || details.lastSubmission?.login?.accountId;
        console.log(`Account ID for other client: ${accountId}`);
        
        if (!accountId) {
          // If we don't have an accountId, redirect to login
          console.log('No accountId found, redirecting to CAS for authentication');
          const service = `${cfg.publicUrl}/interaction/${uid}/cas/callback`;
          const casLoginUrl = loginUrl(service);
          console.log(`Redirecting to CAS login with service: ${service}`);
          console.log(`Full CAS login URL: ${casLoginUrl}`);
          res.redirect(casLoginUrl);
          console.log(`=== REDIRECT SENT TO CAS ===`);
          return;
        }
        
        // For trusted clients, we can simply redirect back to the OIDC flow
        console.log('Redirecting back to OIDC flow for trusted client');
        console.log(`Return URL: ${details.returnTo}`);
        console.log(`Account ID: ${accountId}`);
        // Only redirect if headers haven't been sent yet
        if (!res.headersSent) {
          res.redirect(details.returnTo);
        }
        console.log(`=== REDIRECT SENT TO OIDC FLOW ===`);
        return;
      } else {
        console.log(`Handling ${details.prompt.name} prompt`);
        console.log('Reasons:', details.prompt.reasons);
        console.log('Details:', JSON.stringify(details.prompt.details, null, 2));
        // For other prompt types, redirect back to the OIDC flow
        // Get the accountId from the session or last submission
        const accountId = details.session?.accountId || details.lastSubmission?.login?.accountId;
        console.log(`Account ID: ${accountId}`);
        
        if (!accountId) {
          // If we don't have an accountId, redirect to login
          console.log('No accountId found, redirecting to CAS for authentication');
          const service = `${cfg.publicUrl}/interaction/${uid}/cas/callback`;
          const casLoginUrl = loginUrl(service);
          console.log(`Redirecting to CAS login with service: ${service}`);
          console.log(`Full CAS login URL: ${casLoginUrl}`);
          res.redirect(casLoginUrl);
          console.log(`=== REDIRECT SENT TO CAS ===`);
          return;
        }
        
        // For trusted clients, we can simply redirect back to the OIDC flow
        console.log('Redirecting back to OIDC flow for trusted client');
        console.log(`Return URL: ${details.returnTo}`);
        console.log(`Account ID: ${accountId}`);
        // Only redirect if headers haven't been sent yet
        if (!res.headersSent) {
          res.redirect(details.returnTo);
        }
        console.log(`=== REDIRECT SENT TO OIDC FLOW ===`);
        return;
      }
    } catch (e: any) { 
      console.error('Error in interaction endpoint:', e);
      console.error('Error stack:', e.stack);
      console.error('Error name:', e.name);
      console.error('Error message:', e.message);
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).send(`Authentication flow error. Please try again. Error details: ${e.message}`);
      }
    }
  });;

  app.get('/interaction/:uid/cas/callback', async (req, res, next) => {
    try {
      const { uid } = req.params;
      const { ticket } = req.query as { ticket: string };
      console.log(`=== CAS CALLBACK START ===`);
      console.log(`CAS callback received with uid: ${uid} and ticket: ${ticket}`);
      console.log(`Request URL: ${req.url}`);
      console.log(`Request method: ${req.method}`);
      console.log(`Request headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`Request query:`, JSON.stringify(req.query, null, 2));
      
      if (!ticket) {
        throw new Error('Missing ticket in CAS callback');
      }
      
      const service = `${cfg.publicUrl}/interaction/${uid}/cas/callback`;
      console.log(`Validating ticket: ${ticket} for service: ${service}`);

      const casUser = await serviceValidate(service, ticket);
      console.log(`CAS validation successful for user: ${casUser.user}`, casUser);

      const sub = casUser.user;
      console.log(`[CAS_CALLBACK] Storing user with ID: ${sub}`);
      console.log(`[CAS_CALLBACK] User data to store:`, JSON.stringify({
        id: sub,
        username: casUser.user,
        email: casUser.email,
        name: casUser.name,
        roles: Array.from(new Set(casUser.roles)),
        raw: casUser.raw
      }, null, 2));
      
      UserStore.upsert({
        id: sub,
        username: casUser.user,
        email: casUser.email,
        name: casUser.name,
        roles: Array.from(new Set(casUser.roles)),
        raw: casUser.raw
      });
      
      console.log(`[CAS_CALLBACK] User stored successfully`);

      // Get interaction details to understand what scopes are requested
      const details = await provider.interactionDetails(req, res);
      console.log('Interaction details in CAS callback:', JSON.stringify(details, null, 2));

      // For the DSpace client, we only need to provide login information
      // The provider should handle consent skipping automatically
      const result = {
        login: { accountId: sub, remember: true }
      };

      // Use interactionFinished which works with the OIDC provider's session management
      console.log('Finishing interaction with result:', JSON.stringify(result, null, 2));
      console.log('Expected redirect after this should be to final destination');
      await provider.interactionFinished(req, res, result, {
        mergeWithLastSubmission: true
      });
      console.log(`=== INTERACTION FINISHED ===`);
      console.log('After this point, OIDC provider should redirect to final destination');
      // Do not manually redirect after interactionFinished - let the OIDC provider handle it

    } catch (e: any) { 
      console.error('Error in CAS callback:', e);
      console.error('Error stack:', e.stack);
      console.error('Error name:', e.name);
      console.error('Error message:', e.message);
      // Instead of sending a 500 error, let's redirect back to the interaction endpoint
      // which might be able to handle the error better
      const { uid } = req.params;
      console.log(`Redirecting back to interaction endpoint: /interaction/${uid}`);
      // Only redirect if headers haven't been sent yet
      if (!res.headersSent) {
        res.redirect(`/interaction/${uid}`);
      }
    }
  });
}