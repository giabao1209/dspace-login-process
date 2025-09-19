import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
function loadConfig() {
    const configPath = path.resolve(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error('FATAL: config.json not found. Please copy config.json.example to config.json and fill it out.');
        process.exit(1);
    }
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const jsonConfig = JSON.parse(rawConfig);
    return {
        ...jsonConfig,
        cookieKeys: process.env.COOKIE_KEYS?.split(',') || ['default-key'],
        jwksPath: process.env.JWKS_PATH || './keys/jwks.json',
    };
}
export const cfg = loadConfig();
//# sourceMappingURL=config.js.map