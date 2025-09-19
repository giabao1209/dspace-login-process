import fetch from 'node-fetch';
import { cfg } from '../config.js';
import { parseServiceValidate } from './parser.js';
export function loginUrl(service) {
    const url = new URL('login', cfg.cas.baseUrl);
    url.searchParams.set('service', service);
    return url.toString();
}
export async function serviceValidate(service, ticket) {
    const url = new URL(cfg.cas.validatePath, cfg.cas.baseUrl);
    url.searchParams.set('service', service);
    url.searchParams.set('ticket', ticket);
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
        throw new Error(`Failed to validate ticket. CAS server responded with ${res.status}`);
    }
    const xml = await res.text();
    return parseServiceValidate(xml);
}
//# sourceMappingURL=cas-client.js.map