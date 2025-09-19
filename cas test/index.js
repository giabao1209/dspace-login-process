import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { DOMParser } from '@xmldom/xmldom';
import fetch from 'node-fetch';

// --- Database Setup ---
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { users: [] });

await db.read();
await db.write();

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${port}`;
const DEFAULT_SERVICE_URL = `${BASE_URL}/welcome`;
const tickets = new Map();

// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- DSpace Configuration ---
const DSPACE_URL = 'http://localhost:8081/server';
const DSPACE_EMAIL = 'dspace@localhost';
const DSPACE_PASSWORD = process.env.DSPACE_PASSWORD || 'dspace';

// --- Helper Functions ---
const getCSRFToken = async () => {
  // First, we need to get a CSRF token from DSpace
  console.log('[DSPACE_DEBUG] Getting CSRF token from DSpace...');
  const csrfResponse = await fetch(`${DSPACE_URL}/api/security/csrf`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const csrfToken = csrfResponse.headers.get('DSPACE-XSRF-TOKEN');
  const setCookieHeader = csrfResponse.headers.raw()['set-cookie'];
  let csrfCookie = '';
  
  if (setCookieHeader) {
    // Find the DSPACE-XSRF-COOKIE in the set-cookie headers
    const cookieHeader = setCookieHeader.find(cookie => cookie.startsWith('DSPACE-XSRF-COOKIE'));
    if (cookieHeader) {
      // Extract just the cookie name=value part
      csrfCookie = cookieHeader.split(';')[0];
    }
  }
  
  console.log(`[DSPACE_DEBUG] CSRF Token: ${csrfToken}`);
  console.log(`[DSPACE_DEBUG] CSRF Cookie: ${csrfCookie}`);

  if (!csrfToken) {
    const responseBody = await csrfResponse.text();
    console.error('[DSPACE_DEBUG] Failed to get CSRF token. Response:', responseBody);
    throw new Error(`Failed to obtain CSRF token from DSpace. Response: ${responseBody}`);
  }
  
  return { csrfToken, csrfCookie };
};

const getDSpaceToken = async () => {
  // Get CSRF token first
  const { csrfToken, csrfCookie } = await getCSRFToken();
  
  // Prepare form data for login
  const formData = new URLSearchParams();
  formData.append('user', DSPACE_EMAIL);
  formData.append('password', DSPACE_PASSWORD);
  
  console.log(`[DSPACE_DEBUG] Logging into DSpace with user: ${DSPACE_EMAIL}`);

  const fetchOptions = {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-XSRF-TOKEN': csrfToken,
      'Cookie': csrfCookie
    },
    body: formData,
  };

  console.log('[DSPACE_DEBUG] DSpace login request body:', formData.toString());

  // Login with CSRF token
  const response = await fetch(`${DSPACE_URL}/api/authn/login`, fetchOptions);
  
  // Check if we got a new CSRF token in the response
  const newCsrfToken = response.headers.get('DSPACE-XSRF-TOKEN');
  const newSetCookieHeader = response.headers.raw()['set-cookie'];
  let newCsrfCookie = csrfCookie; // Default to the existing cookie
  
  if (newSetCookieHeader) {
    // Find the DSPACE-XSRF-COOKIE in the set-cookie headers
    const cookieHeader = newSetCookieHeader.find(cookie => cookie.startsWith('DSPACE-XSRF-COOKIE'));
    if (cookieHeader) {
      // Extract just the cookie name=value part
      newCsrfCookie = cookieHeader.split(';')[0];
    }
  }
  
  const token = response.headers.get('authorization');
  if (!token) {
    const responseBody = await response.text();
    console.error('[DSPACE_DEBUG] DSpace login failed. Response:', responseBody);
    throw new Error(`DSpace login failed. Response from DSpace: ${responseBody}`);
  }
  
  console.log('[DSPACE_DEBUG] Successfully logged into DSpace.');
  return { token, csrfToken: newCsrfToken || csrfToken, csrfCookie: newCsrfCookie };
};

// --- Helper Functions ---
const findUserByUsername = async (username) => {
  await db.read();
  return db.data.users.find(u => u.username === username);
};

// --- Main Routes ---

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  const service = req.query.service || DEFAULT_SERVICE_URL;
  console.log(`[LOGIN_PAGE] Service received: ${req.query.service}. Using: ${service}`);
  res.send(getLoginPageHTML(service));
});

app.get('/register', (req, res) => {
  res.send(getRegisterPageHTML());
});

app.get('/change-password', (req, res) => {
  res.send(getChangePasswordPageHTML());
});

app.post('/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) {
    return res.status(400).send('Username, old password, and new password are required.');
  }

  const user = await findUserByUsername(username);

  if (user && user.password === oldPassword) {
    user.password = newPassword;
    await db.write();
    console.log(`[PASSWORD_CHANGED] User: ${username}`);
    res.send(getChangePasswordSuccessPageHTML());
  } else {
    res.status(401).send('Invalid credentials. <a href="/change-password">Try again</a>');
  }
});

app.get('/welcome', async (req, res) => {
    const { ticket } = req.query;

    if (!ticket) {
        return res.send(getWelcomePageHTML({ error: "Not logged in. Please <a href='/login'>login</a>." }));
    }

    const validateUrl = `${BASE_URL}/serviceValidate?service=${encodeURIComponent(DEFAULT_SERVICE_URL)}&ticket=${ticket}`;
    
    try {
        const response = await fetch(validateUrl);
        const xmlText = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, "application/xml");
        
        const successNode = doc.getElementsByTagName('cas:authenticationSuccess')[0];

        if (successNode) {
            const userNode = successNode.getElementsByTagName('cas:user')[0];
            const username = userNode.textContent || userNode.text;
            res.send(getWelcomePageHTML({ username }));
        } else {
            const failureNode = doc.getElementsByTagName('cas:authenticationFailure')[0];
            const errorMessage = (failureNode.textContent || failureNode.text).trim();
            res.send(getWelcomePageHTML({ error: `Ticket validation failed: ${errorMessage}` }));
        }
    } catch (error) {
        console.error("[WELCOME_ERROR]", error);
        res.status(500).send("Error validating ticket.");
    }
});


app.post('/register', async (req, res) => {
  const { username, password, roles, firstName, lastName, email } = req.body;
  if (!username || !password || !roles) {
    return res.status(400).send('Username, password, and roles are required.');
  }

  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    return res.status(409).send('Username already exists.');
  }

  const newUser = {
    id: uuidv4(),
    username,
    password,
    attributes: {
        roles: roles || 'user',
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || ''
    }
  };

  db.data.users.push(newUser);
  await db.write();

  console.log(`[USER_CREATED] Username: ${username}, Roles: ${roles}`);
  res.send(getRegisterSuccessPageHTML());
});

app.post('/login', async (req, res) => {
  const service = req.query.service || DEFAULT_SERVICE_URL;
  const { username, password } = req.body;
  console.log(`[LOGIN_ATTEMPT] User: ${username}, Service received: ${req.query.service}. Using: ${service}`);

  const user = await findUserByUsername(username);

  if (user && user.password === password) {
    try {
      const { token: dspaceToken, csrfToken, csrfCookie } = await getDSpaceToken();
      
      // Check if user exists in DSpace
      const userResponse = await fetch(`${DSPACE_URL}/api/eperson/epersons/search/by-email?email=${encodeURIComponent(user.attributes.email)}`, {
        headers: {
          'Authorization': dspaceToken,
          'X-XSRF-TOKEN': csrfToken,
          'Cookie': csrfCookie
        },
      });

      let dspaceUser;
      if (userResponse.status === 404) {
        // User not found, create them
        const { csrfToken: createCsrfToken, csrfCookie: createCsrfCookie } = await getCSRFToken();
        const createUserResponse = await fetch(`${DSPACE_URL}/api/eperson/epersons`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': dspaceToken,
            'X-XSRF-TOKEN': createCsrfToken,
            'Cookie': createCsrfCookie
          },
          body: JSON.stringify({
            email: user.attributes.email,
            firstName: user.attributes.firstName,
            lastName: user.attributes.lastName,
            password: crypto.randomBytes(16).toString('hex'), // DSpace requires a password, but it won't be used
            canLogIn: true,
            requirePasswordChange: false,
          }),
        });
        dspaceUser = await createUserResponse.json();
        console.log(`[DSPACE] Created user response:`, JSON.stringify(dspaceUser, null, 2));
      } else {
        dspaceUser = await userResponse.json();
        console.log(`[DSPACE] Found user: ${dspaceUser.email}`);
      }

      // TODO: Role mapping logic here

      const ticket = `ST-${crypto.randomBytes(16).toString('hex')}`;
      tickets.set(ticket, { user, service });
      console.log(`[TICKET_ISSUED] Ticket: ${ticket} for User: ${username} and Service: ${service}`);
      
      const redirectUrl = new URL(service);
      redirectUrl.searchParams.set('ticket', ticket);
      return res.redirect(redirectUrl.toString());

    } catch (error) {
      console.error('[DSPACE_ERROR]', error);
      return res.status(500).send(`Error communicating with DSpace: ${error.message}`);
    }
  }

  res.status(401).send('Invalid credentials. <a href="/login">Try again</a>');
});

app.get('/serviceValidate', (req, res) => {
    const { ticket, service } = req.query;
    console.log(`[VALIDATE_TICKET] Ticket: ${ticket}, Service: ${service}`);
    const storedTicket = tickets.get(ticket);

    if (storedTicket && storedTicket.service) {
        console.log(`[VALIDATE_TICKET] Stored ticket found. Associated service: ${storedTicket.service}`);
        tickets.delete(ticket);
        const { user } = storedTicket;
        console.log(`[VALIDATE_SUCCESS] User: ${user.username}`);
        const xmlResponse = `
<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
  <cas:authenticationSuccess>
    <cas:user>${user.username}</cas:user>
    <cas:attributes>
      <cas:email>${user.attributes.email || ''}</cas:email>
      <cas:firstName>${user.attributes.firstName || ''}</cas:firstName>
      <cas:lastName>${user.attributes.lastName || ''}</cas:lastName>
      <cas:roles>${user.attributes.roles || ''}</cas:roles>
    </cas:attributes>
  </cas:authenticationSuccess>
</cas:serviceResponse>
        `.trim();
        res.set('Content-Type', 'application/xml');
        return res.send(xmlResponse);
    }

    console.log(`[VALIDATE_FAILURE] Ticket not found or invalid: ${ticket}`);
    const xmlFailureResponse = `
<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
  <cas:authenticationFailure code="INVALID_TICKET">
    Ticket ${ticket} not recognized
  </cas:authenticationFailure>
</cas:serviceResponse>
    `.trim();
    res.set('Content-Type', 'application/xml');
    res.status(401).send(xmlFailureResponse);
});

// --- HTML Template Functions ---
function getBaseStyles() {
    return `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
        .container { background: #fff; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); width: 100%; max-width: 420px; text-align: center; }
        h1 { color: #333; margin-bottom: 1.5rem; }
        .form-group { margin-bottom: 1rem; text-align: left; }
        label { display: block; margin-bottom: 0.5rem; color: #555; }
        input, select { width: 100%; padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 0.75rem; border: none; border-radius: 4px; background-color: #007bff; color: white; font-size: 1rem; cursor: pointer; transition: background-color 0.3s ease; margin-top: 1rem; }
        button:hover { background-color: #0056b3; }
        .footer-link { text-align: center; margin-top: 1.5rem; font-size: 0.9rem; }
        .footer-link a { color: #007bff; text-decoration: none; }
        .error { color: #d93025; margin-bottom: 1rem; }
        .success { color: #1e8e3e; margin-bottom: 1rem; }
    `;
}

function getLoginPageHTML(service) {
  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>CAS Login</title><style>${getBaseStyles()}</style></head>
    <body>
      <div class="container">
        <h1>CAS Login</h1>
        <form action="/login?service=${encodeURIComponent(service)}" method="post">
          <div class="form-group"><label for="username">Username:</label><input type="text" id="username" name="username" required></div>
          <div class="form-group"><label for="password">Password:</label><input type="password" id="password" name="password" required></div>
          <button type="submit">Login</button>
        </form>
        <div class="footer-link">
          <p>Don't have an account? <a href="/register">Register here</a></p>
          <p><a href="/change-password">Change Password</a></p>
        </div>
      </div>
    </body></html>
  `;
}

function getRegisterPageHTML() {
    return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Register</title><style>${getBaseStyles()}</style></head>
    <body>
      <div class="container">
        <h1>Create Account</h1>
        <form action="/register" method="post">
          <div class="form-group"><label for="username">Username:</label><input type="text" id="username" name="username" required></div>
          <div class="form-group"><label for="password">Password:</label><input type="password" id="password" name="password" required></div>
          <div class="form-group">
            <label for="roles">Role:</label>
            <select id="roles" name="roles" required>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <hr style="border: 1px solid #eee; margin: 1.5rem 0;">
          <div class="form-group"><label for="firstName">First Name:</label><input type="text" id="firstName" name="firstName"></div>
          <div class="form-group"><label for="lastName">Last Name:</label><input type="text" id="lastName" name="lastName"></div>
          <div class="form-group"><label for="email">Email:</label><input type="email" id="email" name="email"></div>
          <button type="submit">Register</button>
        </form>
        <div class="footer-link"><p>Already have an account? <a href="/login">Login here</a></p></div>
      </div>
    </body></html>
  `;
}

function getChangePasswordPageHTML() {
  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Change Password</title><style>${getBaseStyles()}</style></head>
    <body>
      <div class="container">
        <h1>Change Password</h1>
        <form action="/change-password" method="post">
          <div class="form-group"><label for="username">Username:</label><input type="text" id="username" name="username" required></div>
          <div class="form-group"><label for="oldPassword">Old Password:</label><input type="password" id="oldPassword" name="oldPassword" required></div>
          <div class="form-group"><label for="newPassword">New Password:</label><input type="password" id="newPassword" name="newPassword" required></div>
          <button type="submit">Change Password</button>
        </form>
        <div class="footer-link"><p><a href="/login">Back to Login</a></p></div>
      </div>
    </body></html>
  `;
}

function getChangePasswordSuccessPageHTML() {
    return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Success</title><style>${getBaseStyles()}</style></head>
    <body>
        <div class="container">
            <h1 class="success">Password Changed Successfully!</h1>
            <p>You can now log in with your new password.</p>
            <div class="footer-link"><a href="/login">Go to Login</a></div>
        </div>
    </body></html>
    `;
}

function getRegisterSuccessPageHTML() {
    return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Success</title><style>${getBaseStyles()}</style></head>
    <body>
        <div class="container">
            <h1 class="success">Registration Successful!</h1>
            <p>You can now log in with your new account.</p>
            <div class="footer-link"><a href="/login">Go to Login</a></div>
        </div>
    </body></html>
    `;
}

function getWelcomePageHTML({ username, error }) {
    let content = '';
    if (username) {
        content = `<h1>Welcome, ${username}!</h1><p>You have successfully logged in and your ticket has been validated.</p>`;
    } else {
        content = `<h1 class="error">Login Failed</h1><p>${error || 'An unknown error occurred.'}</p>`;
    }

    return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Welcome</title><style>${getBaseStyles()}</style></head>
    <body>
        <div class="container">
            ${content}
            <div class="footer-link"><a href="/login">Log in as another user</a></div>
        </div>
    </body></html>
    `;
}


// --- Server Start ---
app.listen(port, () => {
  console.log(`Mock CAS server with DB listening at ${BASE_URL}`);
});