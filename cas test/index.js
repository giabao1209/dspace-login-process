import express from 'express';
import session from 'express-session';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// In-memory database for users (this simulates a real user database)
const dbPath = path.join(__dirname, 'db.json');
let db = { users: {} };

// Load database
if (fs.existsSync(dbPath)) {
  const fileDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log('[DB_LOAD] Loading database from file');
  console.log('[DB_LOAD] File database contents:', JSON.stringify(fileDb, null, 2));
  
  // Convert array format to object format if needed
  if (Array.isArray(fileDb.users)) {
    console.log('[DB_LOAD] Converting array format to object format');
    // Convert array to object format
    const usersObj = {};
    fileDb.users.forEach(user => {
      console.log('[DB_LOAD] Processing user from array:', user.username);
      console.log('[DB_LOAD] User attributes email:', user.attributes.email);
      
      // Validate and fix email addresses
      let email = user.attributes.email ? user.attributes.email.trim() : '';
      console.log('[DB_LOAD] Email after trim:', email);
      
      // If email is invalid or empty, generate a valid one
      if (!email || !email.includes('@') || email.includes(' ')) {
        email = `${user.username.trim()}@example.com`;
        console.log('[DB_LOAD] Generated new email:', email);
      } else {
        console.log('[DB_LOAD] Using existing email:', email);
      }
      
      usersObj[user.username] = {
        user: user.username,
        email: email,
        name: user.attributes.firstName + ' ' + user.attributes.lastName,
        roles: [user.attributes.roles],
        raw: user.attributes
      };
      
      console.log('[DB_LOAD] Stored user object:', user.username, usersObj[user.username]);
    });
    db.users = usersObj;
    console.log('[DB_LOAD] Final users object:', JSON.stringify(db.users, null, 2));
  } else {
    console.log('[DB_LOAD] Using object format');
    // For object format, ensure all emails are trimmed and valid
    for (const [username, user] of Object.entries(fileDb.users)) {
      console.log('[DB_LOAD] Processing user from object:', username);
      console.log('[DB_LOAD] User email:', user.email);
      
      // Validate and fix email addresses
      let email = user.email ? user.email.trim() : '';
      console.log('[DB_LOAD] Email after trim:', email);
      
      // If email is invalid or empty, generate a valid one
      if (!email || !email.includes('@') || email.includes(' ')) {
        email = `${username.trim()}@example.com`;
        console.log('[DB_LOAD] Generated new email:', email);
      } else {
        console.log('[DB_LOAD] Using existing email:', email);
      }
      
      user.email = email;
      console.log('[DB_LOAD] Updated user object:', username, user);
    }
    db = fileDb;
    console.log('[DB_LOAD] Final database object:', JSON.stringify(db, null, 2));
  }
}

// Save database
function saveDb() {
  // Create a copy of the database for saving
  const saveDb = { ...db };
  
  // Convert users object back to array format for compatibility
  const usersArray = Object.values(db.users).map(user => {
    // Validate and fix email addresses
    let email = (user.email || `${user.user}@example.com`).trim();
    // If email is invalid, generate a valid one
    if (!email.includes('@') || email.includes(' ')) {
      email = `${user.user.trim()}@example.com`;
    }
    
    return {
      id: Math.random().toString(36).substring(2, 15), // Generate a random ID
      username: user.user,
      password: 'password', // Default password for test users
      attributes: {
        roles: Array.isArray(user.roles) ? user.roles[0] : user.roles,
        firstName: user.name ? user.name.split(' ')[0] : user.user,
        lastName: user.name && user.name.split(' ').length > 1 ? user.name.split(' ')[1] : '',
        email: email
      }
    };
  });
  
  saveDb.users = usersArray;
  fs.writeFileSync(dbPath, JSON.stringify(saveDb, null, 2));
}

app.use(session({
  secret: 'cas-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.urlencoded({ extended: true }));

// CAS login page
app.get('/cas/login', (req, res) => {
  const service = req.query.service;
  console.log(`[LOGIN_PAGE] Service received: ${service}`);
  
  res.send(`<html>
  <body>
    <h1>CAS Login</h1>
    <p>This CAS server authenticates users and returns their information.</p>
    <p>It does NOT create accounts in third-party applications.</p>
    <p>The OIDC-CAS gateway handles communication with applications like DSpace.</p>
    <form method="POST" action="/cas/login">
      <input type="hidden" name="service" value="${service || ''}" />
      <label>Username: <input type="text" name="username" value="jack123" /></label><br/>
      <label>Password: <input type="password" name="password" value="password" /></label><br/>
      <button type="submit">Login</button>
    </form>
  </body>
</html>`);
});

// CAS login submission
app.post('/cas/login', (req, res) => {
  const { username, password, service } = req.body;
  console.log(`[LOGIN_ATTEMPT] User: ${username}, Service: ${service}`);
  
  // Simple authentication - in a real CAS, this would check against a user database
  if (username && password) {
    // Create or update user in our database (this is the CAS server's own user database)
    // Ensure username is trimmed to prevent invalid email addresses
    const trimmedUsername = username.trim();
    const user = {
      user: trimmedUsername,
      email: `${trimmedUsername}@example.com`,
      name: trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1),
      roles: ['default'],
      raw: {}
    };
    
    db.users[trimmedUsername] = user;
    saveDb();
    
    // Create ticket for single-use authentication
    const ticket = `ST-${Math.random().toString(36).substring(2, 15)}`;
    db.users[trimmedUsername].tickets = db.users[trimmedUsername].tickets || {};
    db.users[trimmedUsername].tickets[ticket] = {
      service: service,
      createdAt: Date.now()
    };
    saveDb();
    
    console.log(`[TICKET_ISSUED] Ticket: ${ticket} for User: ${trimmedUsername} and Service: ${service}`);
    console.log(`[TICKET_ISSUED] Ticket data:`, JSON.stringify(db.users[trimmedUsername].tickets[ticket], null, 2));
    
    // Redirect back to service with ticket
    if (service) {
      const redirectUrl = `${service}?ticket=${ticket}`;
      console.log(`[REDIRECT] Redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
    } else {
      res.send(`<p>Login successful for ${username}. No service URL provided.</p>`);
    }
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// CAS service validation
app.get('/cas/serviceValidate', (req, res) => {
  const { ticket, service } = req.query;
  console.log(`[VALIDATE_TICKET] Ticket: ${ticket}, Service: ${service}`);
  console.log(`[VALIDATE_TICKET] Request URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log(`[VALIDATE_TICKET] Request headers:`, JSON.stringify(req.headers, null, 2));
  
  // Find ticket in any user's tickets
  let user = null;
  let ticketData = null;
  
  for (const [username, userData] of Object.entries(db.users)) {
    if (userData.tickets && userData.tickets[ticket]) {
      user = username;
      ticketData = userData.tickets[ticket];
      break;
    }
  }
  
  if (user && ticketData) {
    console.log(`[VALIDATE_TICKET] Stored ticket found. Associated service: ${ticketData.service}`);
    console.log(`[VALIDATE_TICKET] Ticket data:`, JSON.stringify(ticketData, null, 2));
    
    // Check if service matches
    if (ticketData.service === service) {
      // Remove ticket (one-time use)
      delete db.users[user].tickets[ticket];
      saveDb();
      
      const userData = db.users[user];
      console.log(`[VALIDATE_SUCCESS] User: ${user}`);
      console.log(`[VALIDATE_SUCCESS] User data from memory:`, JSON.stringify(userData, null, 2));
      console.log(`[VALIDATE_SUCCESS] User email from memory:`, userData.email);
      console.log(`[VALIDATE_SUCCESS] User email type from memory:`, typeof userData.email);
      
      // Return CAS validation response with user information
      res.set('Content-Type', 'text/xml');
      // Ensure email is properly formatted (trim and validate)
      const userEmail = (userData.email || '').trim();
      console.log(`[VALIDATE_SUCCESS] User email after trim:`, userEmail);
      console.log(`[VALIDATE_SUCCESS] User email includes @:`, userEmail.includes('@'));
      console.log(`[VALIDATE_SUCCESS] User email includes space:`, userEmail.includes(' '));
      const validEmail = userEmail && userEmail.includes('@') && !userEmail.includes(' ') ? userEmail : `${userData.user}@example.com`;
      console.log(`[VALIDATE_SUCCESS] Valid email:`, validEmail);
      
      const response = `<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>${userData.user}</cas:user>
    <cas:attributes>
      <cas:email>${validEmail}</cas:email>
      <cas:givenName>${userData.name}</cas:givenName>
      <cas:sn>${userData.user}</cas:sn>
    </cas:attributes>
  </cas:authenticationSuccess>
</cas:serviceResponse>`;
      console.log(`[VALIDATE_SUCCESS] Response:`, response);
      res.send(response);
    } else {
      console.log(`[VALIDATE_FAILED] Service mismatch. Expected: ${ticketData.service}, Got: ${service}`);
      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_SERVICE">
    Service mismatch
  </cas:authenticationFailure>
</cas:serviceResponse>`);
    }
  } else {
    console.log(`[VALIDATE_FAILED] Ticket not found or expired`);
    console.log(`[VALIDATE_FAILED] Available tickets:`, JSON.stringify(db.users, null, 2));
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_TICKET">
    Ticket not found
  </cas:authenticationFailure>
</cas:serviceResponse>`);
  }
});

app.listen(port, () => {
  console.log(`Mock CAS Server listening at http://localhost:${port}`);
  console.log('Endpoints:');
  console.log(`- Login: http://localhost:${port}/cas/login`);
  console.log(`- Service Validation: http://localhost:${port}/cas/serviceValidate`);
});