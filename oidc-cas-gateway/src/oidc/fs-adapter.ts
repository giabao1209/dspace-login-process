import fs from 'node:fs';
import epochTime from 'oidc-provider/lib/helpers/epoch_time.js';

let storage = {};
const dbPath = '/home/baobeo/oicd-connect/oidc-cas-gateway/oidc-db.json';

try {
  storage = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
} catch (err) {
  // file does not exist, create it
  fs.writeFileSync(dbPath, JSON.stringify(storage));
}

function grantKeyFor(id) {
  return `grant:${id}`;
}

function sessionUidKeyFor(id) {
  return `sessionUid:${id}`;
}

function userCodeKeyFor(userCode) {
  return `userCode:${userCode}`;
}

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

class FileAdapter {
  constructor(model) {
    this.model = model;
  }

  key(id) {
    return `${this.model}:${id}`;
  }

  async destroy(id) {
    const key = this.key(id);
    delete storage[key];
    fs.writeFileSync(dbPath, JSON.stringify(storage));
  }

  async consume(id) {
    storage[this.key(id)].consumed = epochTime();
    fs.writeFileSync(dbPath, JSON.stringify(storage));
  }

  async find(id) {
    return storage[this.key(id)];
  }

  async findByUid(uid) {
    const id = storage[sessionUidKeyFor(uid)];
    return this.find(id);
  }

  async findByUserCode(userCode) {
    const id = storage[userCodeKeyFor(userCode)];
    return this.find(id);
  }

  async upsert(id, payload, expiresIn) {
    storage = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const key = this.key(id);

    if (this.model === 'Session') {
      storage[sessionUidKeyFor(payload.uid)] = id;
    }

    const { grantId, userCode } = payload;
    if (grantable.has(this.model) && grantId) {
      const grantKey = grantKeyFor(grantId);
      const grant = storage[grantKey];
      if (!grant) {
        storage[grantKey] = [key];
      } else {
        grant.push(key);
      }
    }

    if (userCode) {
      storage[userCodeKeyFor(userCode)] = id;
    }

    storage[key] = payload;
    fs.writeFileSync(dbPath, JSON.stringify(storage));
  }

  async revokeByGrantId(grantId) { // eslint-disable-line class-methods-use-this
    const grantKey = grantKeyFor(grantId);
    const grant = storage[grantKey];
    if (grant) {
      grant.forEach((token) => delete storage[token]);
      delete storage[grantKey];
      fs.writeFileSync(dbPath, JSON.stringify(storage));
    }
  }
}

export default FileAdapter;
