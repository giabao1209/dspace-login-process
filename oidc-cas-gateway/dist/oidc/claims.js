export async function extraTokenClaims(ctx, token) {
    if (token.kind === 'AccessToken' || token.kind === 'IdToken') {
        const { accountId } = token;
        const acc = await ctx.oidc.provider.Account.findAccount(ctx, accountId);
        if (acc) {
            const claims = await acc.claims('', '', {}, {});
            const [given_name, ...family_name_parts] = (claims.name || '').split(' ');
            const family_name = family_name_parts.join(' ');
            return {
                ...claims,
                given_name,
                family_name,
            };
        }
    }
    return {};
}
//# sourceMappingURL=claims.js.map