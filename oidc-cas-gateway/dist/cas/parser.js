import { parseStringPromise } from 'xml2js';
export async function parseServiceValidate(xml) {
    const doc = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
    const resp = doc['cas:serviceResponse'];
    if (resp['cas:authenticationSuccess']) {
        const ok = resp['cas:authenticationSuccess'];
        const user = ok['cas:user'];
        const attrs = ok['cas:attributes'] || {};
        const roles = [
            ...(Array.isArray(attrs['cas:memberOf']) ? attrs['cas:memberOf'] : (attrs['cas:memberOf'] ? [attrs['cas:memberOf']] : [])),
            ...(Array.isArray(attrs['cas:roles']) ? attrs['cas:roles'] : (attrs['cas:roles'] ? [attrs['cas:roles']] : [])),
            ...(Array.isArray(attrs['cas:eduPersonAffiliation']) ? attrs['cas:eduPersonAffiliation'] : (attrs['cas:eduPersonAffiliation'] ? [attrs['cas:eduPersonAffiliation']] : [])),
        ].map(String);
        return {
            user: String(user),
            email: attrs['cas:mail'] || attrs['cas:email'],
            name: attrs['cas:displayName'] || attrs['cas:cn'] || attrs['cas:givenName'],
            roles,
            raw: attrs,
        };
    }
    const fail = resp['cas:authenticationFailure'];
    throw new Error(`CAS authenticationFailure: ${fail?._ || 'unknown'}`);
}
//# sourceMappingURL=parser.js.map