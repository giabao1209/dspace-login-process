async function testTokenExchange() {
  try {
    // First, let's get an authorization code by simulating a login
    console.log('Testing OIDC flow...');
    
    // Check the well-known configuration
    const configResponse = await fetch('http://localhost:3001/oidc/.well-known/openid-configuration');
    const config = await configResponse.json();
    console.log('OIDC Configuration:', config);
    
    // Try to exchange a fake code for a token to see what error we get
    const tokenResponse = await fetch('http://localhost:3001/oidc/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from('dspace:a_very_secret_string').toString('base64')
      },
      body: new URLSearchParams({
        'grant_type': 'authorization_code',
        'code': 'fake_code',
        'redirect_uri': 'http://localhost:8081/server/api/authn/oidc'
      })
    });
    
    console.log('Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.text();
    console.log('Token response:', tokenData);
    
    if (tokenResponse.ok) {
      console.log('Token exchange successful');
    } else {
      console.log('Token exchange failed');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testTokenExchange();