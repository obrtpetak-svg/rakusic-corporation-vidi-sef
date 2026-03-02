// ── Admin: Reset All User Passwords (Emergency) ──
// Self-contained: inits Firebase Admin inline (same pattern as vehicles.js)

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // Secret key auth
    const ADMIN_SECRET = process.env.ADMIN_RESET_SECRET || 'RakusicResetAll2026!';
    const provided = req.headers['x-admin-secret'] || req.body?.secret;
    if (provided !== ADMIN_SECRET) {
        return res.status(403).json({ error: 'Invalid admin secret' });
    }

    const newPassword = req.body?.newPassword;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'newPassword required (min 6 chars)' });
    }

    try {
        const { default: admin } = await import('firebase-admin');

        if (!admin.apps.length) {
            // Try multiple env var sources
            const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT
                || process.env.GOOGLE_SERVICE_ACCOUNT
                || process.env.FIREBASE_SA;

            if (!saRaw) {
                return res.status(500).json({
                    error: 'No service account env var found',
                    available: Object.keys(process.env).filter(k =>
                        k.includes('FIRE') || k.includes('GOOGLE') || k.includes('SERVICE')
                    ),
                });
            }

            // Handle potential double-encoding or escaped JSON
            let parsed;
            try {
                parsed = JSON.parse(saRaw);
            } catch {
                // Try decoding if base64 encoded
                try {
                    parsed = JSON.parse(Buffer.from(saRaw, 'base64').toString('utf-8'));
                } catch {
                    return res.status(500).json({
                        error: 'Failed to parse service account JSON',
                        length: saRaw.length,
                        first50: saRaw.substring(0, 50),
                        last50: saRaw.substring(saRaw.length - 50),
                    });
                }
            }

            admin.initializeApp({
                credential: admin.credential.cert(parsed),
            });
        }

        const auth = admin.auth();
        const updated = [];
        const failed = [];
        const listResult = await auth.listUsers(1000);

        for (const user of listResult.users) {
            try {
                await auth.updateUser(user.uid, { password: newPassword });
                updated.push(user.email);
            } catch (err) {
                failed.push({ email: user.email, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Updated ${updated.length}/${listResult.users.length} users`,
            updated,
            failed,
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
