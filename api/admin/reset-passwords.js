// ── Admin: Reset All User Passwords (Emergency) ──
// Uses the SAME Firebase Admin init from _mapon-client.js (which works)
// Plus a secret key since Firebase Auth login may be broken.

import { getAuthAdmin } from '../gps/_mapon-client.js';

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
        const admin = await getAuthAdmin();
        if (!admin) {
            return res.status(500).json({ error: 'Firebase Admin not available' });
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
        return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
    }
}
