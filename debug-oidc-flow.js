import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

async function debugOIDCFlow() {
  try {
    console.log('=== Debugging OIDC Flow ===');
    
    // Step 1: Get the OIDC configuration
    console.log('\n1. Getting OIDC configuration...');
    const configResponse = await fetch('http://localhost:3001/oidc/.well-known/openid-configuration');
    const config = await configResponse.json();
    console.log('Token endpoint:', config.token_endpoint);
    console.log('Authorization endpoint:', config.authorization_endpoint);
    
    // Step 2: Simulate getting an authorization code
    // In a real flow, the user would be redirected to the authorization endpoint
    // and then redirected back with a code. For our test, we'll try to get a 
    // code by directly calling the authorization endpoint.
    console.log('\n2. Attempting to get authorization code...');
    
    // We can't easily simulate the full flow without a browser, but we can 
    // test what happens when we try to exchange a fake code
    console.log('\n3. Testing token exchange with fake code...');
    
    const tokenParams = new URLSearchParams({
      'grant_type': 'authorization_code',
      'code': 'fake_code',  // This is intentionally invalid
      'redirect_uri': 'http://localhost:8081/server/api/authn/oidc'
    });
    
    const tokenResponse = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from('dspace:a_very_secret_string').toString('base64')
      },
      body: tokenParams
    });
    
    console.log('Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.text();
    console.log('Token response body:', tokenData);
    
    if (tokenResponse.ok) {
      console.log('Token exchange successful');
    } else {
      console.log('Token exchange failed as expected with fake code');
    }
    
    // Step 4: Let's also test with a missing code parameter
    console.log('\n4. Testing token exchange with missing code...');
    const tokenParams2 = new URLSearchParams({
      'grant_type': 'authorization_code',
      // Missing 'code' parameter
      'redirect_uri': 'http://localhost:8081/server/api/authn/oidc'
    });
    
    const tokenResponse2 = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from('dspace:a_very_secret_string').toString('base64')
      },
      body: tokenParams2
    });
    
    console.log('Token response status (missing code):', tokenResponse2.status);
    const tokenData2 = await tokenResponse2.text();
    console.log('Token response body (missing code):', tokenData2);
    
    // Step 5: Let's test with incorrect client credentials
    console.log('\n5. Testing token exchange with incorrect client credentials...');
    const tokenResponse3 = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from('dspace:wrong_secret').toString('base64')
      },
      body: tokenParams
    });
    
    console.log('Token response status (wrong secret):', tokenResponse3.status);
    const tokenData3 = await tokenResponse3.text();
    console.log('Token response body (wrong secret):', tokenData3);
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

debugOIDCFlow();