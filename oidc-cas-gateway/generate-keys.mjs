import * as jose from 'jose';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const KEY_DIR = 'keys';
const JWKS_FILE = path.join(KEY_DIR, 'jwks.json');
const PRIV_KEY_FILE = path.join(KEY_DIR, 'oidc.key');

async function generate() {
  console.log('Generating RSA key pair...');
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    modulusLength: 4096,
  });

  const privateJwk = await jose.exportJWK(privateKey);
  const publicJwk = await jose.exportJWK(publicKey);
  
  // Add required 'kid' and 'alg' to the private JWK for the keystore
  privateJwk.kid = await jose.calculateJwkThumbprint(privateJwk);
  privateJwk.alg = 'RS256';

  const keystore = {
    keys: [privateJwk],
  };

  try {
    await fs.mkdir(KEY_DIR, { recursive: true });
    
    // Save the private key in PEM format (optional, but good practice)
    const privateKeyPem = await jose.exportPKCS8(privateKey);
    await fs.writeFile(PRIV_KEY_FILE, privateKeyPem);
    console.log(`Private key saved to ${PRIV_KEY_FILE}`);

    // Save the JWKS file (containing the private key)
    await fs.writeFile(JWKS_FILE, JSON.stringify(keystore, null, 2));
    console.log(`Private JWK Set saved to ${JWKS_FILE}`);
    
    console.log('\n--- Generation Complete ---');
    console.log('A private key (oidc.key) and a JWKS file (jwks.json) have been created in the "keys" directory.');
    console.log('The jwks.json file contains the private key and is used by the OIDC provider.');

  } catch (error) {
    console.error('Failed to generate or save keys:', error);
  }
}

generate();
