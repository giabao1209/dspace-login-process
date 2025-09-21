import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'cas test', 'db.json');

console.log('Reading database file...');
if (fs.existsSync(dbPath)) {
  const fileDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log('Database contents:');
  console.log(JSON.stringify(fileDb, null, 2));
  
  // Check the jack123 user specifically
  if (Array.isArray(fileDb.users)) {
    const jack123User = fileDb.users.find(user => user.username === 'jack123');
    if (jack123User) {
      console.log('\njack123 user from database:');
      console.log(JSON.stringify(jack123User, null, 2));
      console.log('Email:', jack123User.attributes.email);
    }
  }
} else {
  console.log('Database file not found');
}