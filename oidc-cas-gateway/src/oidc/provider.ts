import Provider, { Configuration } from 'oidc-provider';
import fs from 'node:fs';
import { cfg } from '../config.js';
import { clients } from './clients.js';
import { findAccount } from '../identity/account.js';
import { extraTokenClaims } from './claims.js';
import FileAdapter from './fs-adapter.js';

const jwks = JSON.parse(fs.readFileSync(cfg.jwksPath, 'utf8'));

export function createProvider() {
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
    },

  };

  return new Provider(cfg.issuerBaseUrl, configuration);
}