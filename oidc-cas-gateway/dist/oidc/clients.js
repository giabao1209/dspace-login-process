import { cfg } from '../config.js';
export const clients = [
    {
        client_id: cfg.dspaceClient.id,
        client_secret: cfg.dspaceClient.secret,
        redirect_uris: [cfg.dspaceClient.redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_basic',
        // Skip consent for this trusted client
        skipConsent: true,
        // Trust all requested scopes for this client
        trusted: ['openid', 'email', 'profile'],
    },
];
console.log('OIDC Clients Configuration:');
console.log(JSON.stringify(clients, null, 2));
//# sourceMappingURL=clients.js.map