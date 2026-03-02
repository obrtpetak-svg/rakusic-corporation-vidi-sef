// ── Admin: Reset All User Passwords (Emergency) ──
// Secured: requires Firebase Auth (admin role) + env secret.
// CORS locked to production domain.

import { getAuthAdmin, verifyAuth, corsHeaders } from '../gps/_mapon-client.js';

export default async function handler(req, res) {
    // ── CORS (locked to production domain) ──
    const headers = corsHeaders(req);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // ── Auth: Firebase Auth token required ──
    const authResult = await verifyAuth(req);
    if (!authResult.ok) {
        return res.status(401).json({ error: 'Unauthorized — Firebase Auth required' });
    }

    // ── Auth: Admin secret also required (defense in depth) ──
    const ADMIN_SECRET = process.env.ADMIN_RESET_SECRET;
    if (!ADMIN_SECRET) {
        return res.status(500).json({ error: 'ADMIN_RESET_SECRET env var not configured' });
    }
    const provided = req.headers['x-admin-secret'] || req.body?.secret;
    if (provided !== ADMIN_SECRET) {
        return res.status(403).json({ error: 'Invalid admin secret' });
    }

    const newPassword = req.body?.newPassword;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'newPassword required (min 8 chars)' });
    }
    // Password policy
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: 'Password must contain uppercase' });
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: 'Password must contain number' });

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

        // Audit log: password reset event
        console.log(JSON.stringify({
            level: 'warn', action: 'ADMIN_PASSWORD_RESET_ALL',
            triggeredBy: authResult.user?.email,
            usersUpdated: updated.length,
            usersFailed: failed.length,
            timestamp: new Date().toISOString(),
        }));

        return res.status(200).json({
            success: true,
            message: `Updated ${updated.length}/${listResult.users.length} users`,
            updated,
            failed,
        });

    } catch (err) {
        console.error('[reset-passwords] Error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
