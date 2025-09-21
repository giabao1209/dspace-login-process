import Provider, { Configuration, interactionPolicy } from 'oidc-provider';
import fs from 'node:fs';
import { cfg } from '../config.js';
import { clients } from './clients.js';
import { findAccount } from '../identity/account.js';
import { extraTokenClaims } from './claims.js';
import FileAdapter from './fs-adapter.js';

const jwks = JSON.parse(fs.readFileSync(cfg.jwksPath, 'utf8'));

export function createProvider() {
  // Create the interaction policy - handle API changes gracefully
  let policy;
  try {
    if (interactionPolicy && typeof interactionPolicy.base === 'function') {
      policy = interactionPolicy.base();
      
      // Find the consent prompt and modify it to skip consent for the DSpace client
      const consentPrompt = policy.get('consent');
      if (consentPrompt) {
        console.log('>>> CONSENT PROMPT FOUND');
        console.log('>>> Current checks in consent prompt:', consentPrompt.checks.length);
        
        // Add a check to skip consent for the DSpace client
        consentPrompt.checks.add(new interactionPolicy.Check(
          'dspace_client_skip_consent',
          'Skipping consent for trusted DSpace client',
          (ctx) => {
            // Skip consent for the DSpace client
            if (ctx.oidc.client?.clientId === cfg.dspaceClient.id) {
              console.log('>>> SKIPPING CONSENT for trusted DSpace client');
              console.log(`Client ID: ${ctx.oidc.client?.clientId}`);
              console.log(`DSpace Client ID: ${cfg.dspaceClient.id}`);
              console.log('>>> CONSENT CHECK RETURNING FALSE (skip consent)');
              return false; // Don't require consent
            }
            console.log('>>> CONSENT REQUIRED for client', ctx.oidc.client?.clientId);
            console.log('>>> CONSENT CHECK RETURNING TRUE (require consent)');
            return true; // Require consent for other clients
          }
        ), 0); // Add at the beginning
        
        console.log('>>> ADDED DSPACE CONSENT CHECK');
        console.log('>>> Updated checks in consent prompt:', consentPrompt.checks.length);
      } else {
        console.log('>>> CONSENT PROMPT NOT FOUND');
      }
    } else {
      console.warn('interactionPolicy.base() not available, using default policy');
      policy = undefined; // Will use default policy
    }
  } catch (error) {
    console.warn('Error creating interaction policy, using default:', error instanceof Error ? error.message : 'Unknown error');
    policy = undefined; // Will use default policy
  }

  const configuration: Configuration = {

    clients,
    jwks,
    cookies: { 
      keys: cfg.cookieKeys,
      // Adjust cookie settings for better compatibility with CAS redirects
      long: { 
        sameSite: 'lax',
        secure: false, // Set to true in production with HTTPS
        path: '/',
        signed: true
      },
      short: { 
        sameSite: 'lax',
        secure: false, // Set to true in production with HTTPS
        path: '/',
        signed: true
      },
      names: {
        interaction: '_interaction',
        interactionSig: '_interaction.sig',
        resume: '_interaction_resume',
        resumeSig: '_interaction_resume.sig'
      }
    },
    findAccount,

    pkce: {
      methods: ['S256'],
      required: (ctx, client) => {
        // DSpace does not support PKCE, so we disable it for this client.
        if (client.clientId === cfg.dspaceClient.id) {
          return false;
        }
        return true;
      },
    },
    scopes: ['openid', 'email', 'profile', 'offline_access'],

    formats: { AccessToken: 'jwt' },

    features: {
      devInteractions: { enabled: false },
      rpInitiatedLogout: { enabled: true },
      userinfo: { enabled: true },
      pushedAuthorizationRequests: { enabled: true },
      jwtResponseModes: { enabled: true },
      revocation: { enabled: true },
      introspection: { enabled: true },
    },

    // Define which claims are released for each scope
    claims: {
      // Standard OpenID Connect scope
      openid: ['sub'],

      // Profile scope claims
      profile: ['name', 'preferred_username', 'given_name', 'family_name'],

      // Email scope claims
      email: ['email', 'email_verified'],
    },

    routes: {
      authorization: '/auth',
      token: '/token',
      userinfo: '/userinfo',
      end_session: '/logout',
      jwks: '/.well-known/jwks.json',
      revocation: '/token/revocation',
      introspection: '/token/introspection',
    },

    extraTokenClaims,

    ttl: {
      Interaction: 1800, // 30 minutes to accommodate CAS login flow
      Session: 24 * 60 * 60, // 24 hours
      Grant: 24 * 60 * 60, // 24 hours
    },

    // Add consent configuration to prevent infinite loops
    conformIdTokenClaims: false,

    interactions: {
      policy,
    },
    
    // Add custom error handler for better debugging
    renderError: async (ctx, out, error) => {
      console.error('OIDC Provider Error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', out);
      
      // Send detailed error information in development
      if (process.env.NODE_ENV !== 'production') {
        ctx.type = 'html';
        ctx.body = `
          <html>
            <head><title>OIDC Error</title></head>
            <body>
              <h1>OIDC Provider Error</h1>
              <pre>${error.message}</pre>
              <pre>${error.stack}</pre>
              <pre>${JSON.stringify(out, null, 2)}</pre>
            </body>
          </html>
        `;
      } else {
        // Use default error handler in production
        const provider = new Provider(cfg.issuerBaseUrl);
        await provider.renderError(ctx, out, error);
      }
    }
  };

  const provider = new Provider(cfg.issuerBaseUrl, configuration);

  provider.on('server_error', (ctx, error) => {
    console.error('--- OIDC Provider Server Error ---');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Context:', {
      method: ctx.method,
      url: ctx.originalUrl,
      headers: ctx.headers,
      body: ctx.request.body,
    });
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('--- End OIDC Provider Server Error ---');
  });

  return provider;
}