// ── Admin: Reset All User Passwords (Emergency) ──
// Uses a secret key since Firebase Auth login may be broken.
// Matches the exact firebase-admin init pattern from _mapon-client.js

let _admin = null;
async function getAdmin() {
    if (_admin) return _admin;
    try {
        const { default: admin } = await import('firebase-admin');
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
            });
        }
        _admin = admin;
        return admin;
    } catch (e) {
        console.error('[Admin Reset] Firebase init error:', e.message);
        return null;
    }
}

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

    try {
        const newPassword = req.body?.newPassword;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'newPassword required (min 6 chars)' });
        }

        const admin = await getAdmin();
        if (!admin) {
            return res.status(500).json({ error: 'Firebase Admin SDK failed to initialize' });
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
        console.error('[Admin Reset] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
