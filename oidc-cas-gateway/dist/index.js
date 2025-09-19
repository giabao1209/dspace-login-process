import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg } from './config.js';
import { createProvider } from './oidc/provider.js';
import { mountLoginRoutes } from './interactions/login.js';
// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function main() {
    const app = express();
    app.set('trust proxy', true);
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.use(morgan('combined'));
    app.use(cookieParser());
    app.use(session({
        secret: cfg.cookieKeys[0],
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } // Set to true in production with HTTPS
    }));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '../public')));
    // --- UI Configuration Routes ---
    app.get('/', (req, res) => {
        const configPath = path.resolve(process.cwd(), 'config.json');
        const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        res.render('index', { config: currentConfig, success: req.query.success });
    });
    app.post('/save', (req, res) => {
        const configPath = path.resolve(process.cwd(), 'config.json');
        const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const newConfig = {
            ...currentConfig,
            issuerBaseUrl: req.body.issuerBaseUrl,
            publicUrl: req.body.publicUrl,
            cas: {
                baseUrl: req.body.casBaseUrl,
                validatePath: req.body.casValidatePath,
            },
            dspaceClient: {
                id: req.body.dspaceClientId,
                secret: req.body.dspaceClientSecret,
                redirectUri: req.body.dspaceRedirectUri,
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
        console.log('Configuration updated. Please restart the application for changes to take effect.');
        res.redirect('/?success=true');
    });
    // --- OIDC Provider ---
    const provider = createProvider();
    mountLoginRoutes(app, provider);
    app.use('/oidc', provider.callback());
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`OIDC<->CAS Gateway listening on port ${port}`);
        console.log(`> Configuration UI: http://localhost:${port}`);
        console.log(`> OIDC Discovery: ${cfg.issuerBaseUrl}/.well-known/openid-configuration`);
        console.log('Note: The application needs a restart to apply configuration changes made via the UI.');
    });
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map