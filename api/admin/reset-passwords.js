// ── Admin: Reset All User Passwords (Emergency — secret key auth) ──
// Uses a secret key instead of Firebase Auth to avoid chicken-and-egg problem
// when password format changes make login impossible.

import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (sa) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(sa)),
            });
        }
    } catch (e) {
        console.error('[Admin] Firebase init error:', e.message);
    }
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // ── Secret key auth (since Firebase Auth login is broken) ──
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

        if (!admin.apps.length) {
            return res.status(500).json({ error: 'Firebase Admin not initialized — check FIREBASE_SERVICE_ACCOUNT env var' });
        }

        const auth = admin.auth();
        const results = { updated: [], failed: [], total: 0 };

        // List all Firebase Auth users
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
            message: `✅ Updated ${results.updated.length}/${results.total} users to new password`,
            updated: results.updated.length,
            failed: results.failed.length,
            failedDetails: results.failed,
            updatedEmails: results.updated.map(u => u.email),
        });

    } catch (err) {
        console.error('[Admin] Reset error:', err);
        return res.status(500).json({ error: err.message });
    }
}
