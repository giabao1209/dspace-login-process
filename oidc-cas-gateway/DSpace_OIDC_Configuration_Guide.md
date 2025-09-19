# DSpace OIDC Configuration Guide for OIDC-CAS Gateway

This guide explains how to configure DSpace to authenticate users through the OIDC-CAS Gateway, which acts as a bridge between DSpace's OIDC support and your CAS server.

## Prerequisites

1. OIDC-CAS Gateway running on port 3001
2. CAS server properly configured and accessible
3. DSpace 7.x installation

## Step 1: Configure the OIDC-CAS Gateway

First, ensure your gateway is properly configured. The gateway stores its configuration in `config.json`:

### Current Gateway Configuration (from config.json):

1. **Issuer Base URL**: `http://localhost:3001/oidc`
2. **Public URL**: `http://localhost:3001`
3. **DSpace Client ID**: `dspace`
4. **DSpace Client Secret**: `a_very_secret_string`
5. **DSpace Redirect URI**: `http://localhost:8080/server/api/authn/oidc`

### Updating Gateway Configuration:

You can either:
1. Edit `config.json` directly (requires gateway restart)
2. Use the web UI at `http://localhost:3001` (requires restart after saving)

When using the web UI, make sure to update:
1. **Issuer Base URL**: `http://localhost:3001/oidc`
2. **Public URL**: `http://localhost:3001`
3. **CAS Base URL**: Your CAS server URL (e.g., `https://your-cas-server.com/cas`)
4. **CAS Validate Path**: Usually `/serviceValidate` or `/p3/serviceValidate`
5. **DSpace Client ID**: `dspace` (or any string you prefer)
6. **DSpace Client Secret**: `a_very_secret_string` (or any secure string you prefer)
7. **DSpace Redirect URI**: `http://localhost:8080/server/api/authn/oidc` (or your DSpace server's URL)

After saving the configuration, restart the gateway for changes to take effect.

## Step 2: Configure DSpace Authentication

### Enable OIDC Authentication

In your DSpace configuration directory, edit `config/modules/authentication.cfg`:

```properties
# Enable OIDC authentication
plugin.sequence.org.dspace.authenticate.AuthenticationMethod = \
    org.dspace.authenticate.OIDCAuthentication,\
    org.dspace.authenticate.PasswordAuthentication
```

### Configure OIDC Parameters

Create or edit `config/modules/authentication-oidc.cfg`:

```properties
# OIDC Configuration for CAS Gateway
authentication-oidc.domain.regression.tests = true

# OIDC Provider Configuration
authentication-oidc.oidc-url = http://localhost:3001/oidc

# Client Configuration (must match gateway settings)
# Client ID from gateway config.json: "dspace"
authentication-oidc.client-id = dspace

# Client Secret from gateway config.json: "a_very_secret_string"
authentication-oidc.client-secret = a_very_secret_string

# Callback Configuration
authentication-oidc.callback-url = http://localhost:8080/server/api/authn/oidc

# User Attribute Mapping (standard OIDC claims)
authentication-oidc.user-email = email
authentication-oidc.user-name = name
authentication-oidc.user-surname = family_name
authentication-oidc.user-givenname = given_name

# Optional: If you want to specify which user details to request
authentication-oidc.scopes = openid,profile,email

# Optional: If using a self-signed certificate for the gateway
# authentication-oidc.jwt-access-token-validation-enabled = false
```

**Important Notes**:
1. The `client-id` and `client-secret` values must exactly match what's in your gateway's `config.json` file
2. The default values are:
   - Client ID: `dspace`
   - Client Secret: `a_very_secret_string`
3. You can change these values in `config.json` for better security, but remember to update both the gateway and DSpace configurations

## Step 3: Restart DSpace

After making these configuration changes, restart your DSpace server:

```bash
# If using Tomcat
$CATALINA_HOME/bin/shutdown.sh
$CATALINA_HOME/bin/startup.sh

# If using DSpace's built-in server
[dspace]/bin/dspace-stop
[dspace]/bin/dspace-start
```

## Testing the Configuration

1. Navigate to your DSpace installation in a web browser
2. Click on "Log In" 
3. You should see an option for OIDC authentication
4. Clicking this should redirect you through the OIDC-CAS Gateway to your CAS server
5. After successful CAS authentication, you should be redirected back to DSpace

## Troubleshooting

### Common Issues:

1. **Redirect URI Mismatch**: Ensure the Redirect URI in the gateway configuration exactly matches the `authentication-oidc.callback-url` in DSpace.

2. **Network Connectivity**: Verify that your DSpace server can reach the OIDC-CAS Gateway at `http://localhost:3001`.

3. **CAS Server Configuration**: Ensure your CAS server is configured to accept service validation requests from the gateway.

4. **SSL/Certificate Issues**: If using HTTPS, you may need to configure certificate trust between components.

### Log Files:

Check these logs for debugging information:
- DSpace logs: `[dspace]/log/dspace.log*`
- OIDC-CAS Gateway logs: Console output from the running gateway process

## How It Works

1. User attempts to log into DSpace
2. DSpace redirects to the OIDC-CAS Gateway (`http://localhost:3001/oidc`)
3. Gateway redirects user to CAS server for authentication
4. CAS authenticates user and redirects back to gateway with a ticket
5. Gateway validates the ticket with CAS server and creates an OIDC token
6. Gateway redirects user back to DSpace with the OIDC token
7. DSpace validates the token with the gateway and logs in the user

This configuration allows DSpace to leverage your existing CAS infrastructure for user authentication while using standard OIDC protocols for the integration.