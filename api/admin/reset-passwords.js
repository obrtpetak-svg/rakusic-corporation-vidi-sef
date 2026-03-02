// ── Admin: Reset All User Passwords ──
// ONE-TIME USE: Resets all Firebase Auth user passwords to a specified password.
// Protected by Firebase Auth — only admin users can execute.
// Uses Firebase Admin SDK to update passwords server-side.

import { getAuthAdmin, verifyAuth, corsHeaders } from '../gps/_mapon-client.js';

export default async function handler(req, res) {
    const headers = corsHeaders(req);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Auth check ──
    const authResult = await verifyAuth(req);
    if (!authResult.ok) {
        return res.status(401).json({ error: 'Unauthorized', detail: authResult.error });
    }

    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const admin = getAuthAdmin();
        if (!admin) {
            return res.status(500).json({ error: 'Firebase Admin not configured' });
        }

        const auth = admin.auth();
        const results = { updated: [], failed: [], total: 0 };

        // List all users (max 1000)
        const listResult = await auth.listUsers(1000);
        results.total = listResult.users.length;

        for (const user of listResult.users) {
            try {
                await auth.updateUser(user.uid, { password: newPassword });
                results.updated.push({ uid: user.uid, email: user.email });
            } catch (err) {
                results.failed.push({ uid: user.uid, email: user.email, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Updated ${results.updated.length}/${results.total} users`,
            updated: results.updated.length,
            failed: results.failed.length,
            details: results,
        });

    } catch (err) {
        console.error('[Admin] Reset passwords error:', err);
        return res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
}
