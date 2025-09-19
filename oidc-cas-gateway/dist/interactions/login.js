import { loginUrl, serviceValidate } from '../cas/cas-client.js';
import { UserStore } from '../identity/store.js';
import { cfg } from '../config.js';
export function mountLoginRoutes(app, provider) {
    provider.interactionUrl = async (ctx, interaction) => `/interaction/${interaction.uid}`;
    app.get('/interaction/:uid', async (req, res, next) => {
        try {
            const { uid } = req.params;
            const service = `${cfg.publicUrl}/cas/callback?uid=${uid}`;
            res.redirect(loginUrl(service));
        }
        catch (e) {
            next(e);
        }
    });
    app.get('/cas/callback', async (req, res, next) => {
        try {
            const { ticket, uid } = req.query;
            if (!ticket) {
                throw new Error('Missing ticket in CAS callback');
            }
            if (!uid) {
                throw new Error('Missing interaction UID in callback');
            }
            const service = `${cfg.publicUrl}/cas/callback?uid=${uid}`;
            const casUser = await serviceValidate(service, ticket);
            const sub = casUser.user;
            UserStore.upsert({
                id: sub,
                username: casUser.user,
                email: casUser.email,
                name: casUser.name,
                roles: Array.from(new Set(casUser.roles)),
                raw: casUser.raw
            });
            await provider.interactionFinished(req, res, {
                login: { accountId: sub, remember: true },
                consent: {
                    // auto-consent scopes
                    grant: {
                        rejectedScopes: [],
                        rejectedClaims: [],
                        replace: false,
                    }
                }
            }, { mergeWithLastSubmission: false });
        }
        catch (e) {
            console.error('Error in CAS callback:', e);
            next(e);
        }
    });
}
//# sourceMappingURL=login.js.map