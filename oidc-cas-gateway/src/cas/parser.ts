import { parseStringPromise } from 'xml2js';

export async function parseServiceValidate(xml: string) {
  console.log(`[CAS_PARSER] Parsing XML response: ${xml}`);
  
  const doc = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
  console.log(`[CAS_PARSER] Parsed document:`, JSON.stringify(doc, null, 2));
  
  const resp = doc['cas:serviceResponse'];
  if (resp['cas:authenticationSuccess']) {
    const ok = resp['cas:authenticationSuccess'];
    const user = ok['cas:user'];
    const attrs = ok['cas:attributes'] || {};
    
    console.log(`[CAS_PARSER] Authentication success for user: ${user}`);
    console.log(`[CAS_PARSER] Attributes:`, JSON.stringify(attrs, null, 2));
    
    const roles = [
      ...(Array.isArray(attrs['cas:memberOf']) ? attrs['cas:memberOf'] : (attrs['cas:memberOf'] ? [attrs['cas:memberOf']] : [])),
      ...(Array.isArray(attrs['cas:roles']) ? attrs['cas:roles'] : (attrs['cas:roles'] ? [attrs['cas:roles']] : [])),
      ...(Array.isArray(attrs['cas:eduPersonAffiliation']) ? attrs['cas:eduPersonAffiliation'] : (attrs['cas:eduPersonAffiliation'] ? [attrs['cas:eduPersonAffiliation']] : [])),
    ].map(String);

    const result = {
      user: String(user),
      email: attrs['cas:mail'] || attrs['cas:email'],
      name: attrs['cas:displayName'] || attrs['cas:cn'] || attrs['cas:givenName'],
      roles,
      raw: attrs,
    };
    
    console.log(`[CAS_PARSER] Final parsed result:`, JSON.stringify(result, null, 2));
    
    return result;
  }
  
  const fail = resp['cas:authenticationFailure'];
  console.log(`[CAS_PARSER] Authentication failure:`, JSON.stringify(fail, null, 2));
  
  throw new Error(`CAS authenticationFailure: ${fail?._ || 'unknown'}`);
}