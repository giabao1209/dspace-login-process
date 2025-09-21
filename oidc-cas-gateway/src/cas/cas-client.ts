import fetch from 'node-fetch';
import { cfg } from '../config.js';
import { parseServiceValidate } from './parser.js';

export function loginUrl(service: string) {
  const url = new URL('/cas/login', cfg.cas.baseUrl);
  url.searchParams.set('service', service);
  return url.toString();
}

export async function serviceValidate(service: string, ticket: string) {
  const url = new URL(cfg.cas.validatePath, cfg.cas.baseUrl);
  url.searchParams.set('service', service);
  url.searchParams.set('ticket', ticket);
  
  console.log(`[CAS_CLIENT] Validating ticket: ${ticket} for service: ${service}`);
  console.log(`[CAS_CLIENT] Request URL: ${url.toString()}`);
  
  const res = await fetch(url.toString(), { method: 'GET' });
  
  console.log(`[CAS_CLIENT] CAS server response status: ${res.status}`);
  console.log(`[CAS_CLIENT] CAS server response headers:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
  
  if (!res.ok) {
    const errorText = await res.text();
    console.log(`[CAS_CLIENT] CAS server error response: ${errorText}`);
    throw new Error(`Failed to validate ticket. CAS server responded with ${res.status}: ${errorText}`);
  }
  
  const xml = await res.text();
  console.log(`[CAS_CLIENT] CAS server response XML: ${xml}`);
  
  const parsed = parseServiceValidate(xml);
  console.log(`[CAS_CLIENT] Parsed CAS response:`, JSON.stringify(parsed, null, 2));
  
  return parsed;
}