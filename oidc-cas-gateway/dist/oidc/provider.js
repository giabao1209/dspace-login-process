import Provider from 'oidc-provider';
import fs from 'node:fs';
import { cfg } from '../config.js';
import { clients } from './clients.js';
import { findAccount } from '../identity/account.js';
import { extraTokenClaims } from './claims.js';
const jwks = JSON.parse(fs.readFileSync(cfg.jwksPath, 'utf8'));
export function createProvider() {
    const configuration = {
        clients,
        jwks,
        cookies: { keys: cfg.cookieKeys },
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
//# sourceMappingURL=provider.js.map