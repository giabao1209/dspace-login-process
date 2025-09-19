import { cfg } from '../config.js';
export const clients = [
    {
        client_id: cfg.dspaceClient.id,
        client_secret: cfg.dspaceClient.secret,
        redirect_uris: [cfg.dspaceClient.redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_basic',
    },
];
//# sourceMappingURL=clients.js.map