// ── Admin API Router ──
// Merges all admin operations into a single endpoint to stay within
// Vercel Hobby plan serverless function limit (12 max).
// Action is selected via `action` field in request body.

import { getFirebaseAdmin, verifyAuth, corsHeaders } from './gps/_mapon-client.js';

export default async function handler(req, res) {
    // ── CORS ──
    const headers = corsHeaders(req);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // ── Auth: Firebase Auth token required ──
    const caller = await verifyAuth(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { action } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action required (create-user | bulk-provision | reset-passwords)' });

    try {
        const admin = await getFirebaseAdmin();
        if (!admin) return res.status(500).json({ error: 'Firebase Admin not available' });

        // ═══ CREATE USER ═══
        if (action === 'create-user') {
            return handleCreateUser(req, res, admin, caller);
        }
        // ═══ BULK PROVISION ═══
        if (action === 'bulk-provision') {
            return handleBulkProvision(req, res, admin, caller);
        }
        // ═══ RESET PASSWORDS ═══
        if (action === 'reset-passwords') {
            return handleResetPasswords(req, res, admin, caller);
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
        console.error(`[admin/${action}] Error:`, err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}

// ── Create / Update user ──
async function handleCreateUser(req, res, admin, caller) {
    const { username, password, displayName, subAction } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'password required (min 6 chars)' });

    const email = username.includes('@') ? username : `${username}@rakusic-corporation.live`;
    const auth = admin.auth();

    if (subAction === 'update') {
        try {
            const existingUser = await auth.getUserByEmail(email);
            await auth.updateUser(existingUser.uid, { password, ...(displayName ? { displayName } : {}) });
            return res.status(200).json({ success: true, action: 'updated', uid: existingUser.uid, email });
        } catch (err) {
            if (err.code !== 'auth/user-not-found') throw err;
        }
    }

    try {
        const newUser = await auth.createUser({
            email, password, displayName: displayName || username, emailVerified: true,
        });
        console.log(JSON.stringify({ level: 'info', action: 'USER_CREATED', email, uid: newUser.uid, createdBy: caller.email, timestamp: new Date().toISOString() }));
        return res.status(201).json({ success: true, action: 'created', uid: newUser.uid, email });
    } catch (err) {
        if (err.code === 'auth/email-already-exists') {
            const existingUser = await auth.getUserByEmail(email);
            await auth.updateUser(existingUser.uid, { password, ...(displayName ? { displayName } : {}) });
            return res.status(200).json({ success: true, action: 'updated', uid: existingUser.uid, email });
        }
        throw err;
    }
}

// ── Bulk provision all workers ──
async function handleBulkProvision(req, res, admin, caller) {
    const { defaultPassword } = req.body || {};
    if (!defaultPassword || defaultPassword.length < 6) {
        return res.status(400).json({ error: 'defaultPassword required (min 6 chars)' });
    }

    const auth = admin.auth();
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();
    const results = { created: [], existing: [], failed: [], skipped: [] };

    for (const doc of usersSnap.docs) {
        const userData = doc.data();
        const username = userData.username;
        if (!username) { results.skipped.push({ id: doc.id, name: userData.name, reason: 'no username' }); continue; }
        if (userData.active === false) { results.skipped.push({ id: doc.id, name: userData.name, reason: 'inactive' }); continue; }

        const email = username.includes('@') ? username : `${username}@rakusic-corporation.live`;
        try {
            await auth.getUserByEmail(email);
            results.existing.push({ username, email });
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                try {
                    const newUser = await auth.createUser({ email, password: defaultPassword, displayName: userData.name || username, emailVerified: true });
                    results.created.push({ username, email, uid: newUser.uid, name: userData.name });
                } catch (createErr) {
                    results.failed.push({ username, email, error: createErr.message });
                }
            } else {
                results.failed.push({ username, email, error: err.message });
            }
        }
    }

    console.log(JSON.stringify({ level: 'info', action: 'BULK_PROVISION_AUTH', triggeredBy: caller.email, created: results.created.length, existing: results.existing.length, skipped: results.skipped.length, failed: results.failed.length, timestamp: new Date().toISOString() }));
    return res.status(200).json({ success: true, summary: `Created ${results.created.length} accounts, ${results.existing.length} already existed, ${results.skipped.length} skipped, ${results.failed.length} failed`, ...results });
}

// ── Reset all passwords (emergency) ──
async function handleResetPasswords(req, res, admin, caller) {
    const ADMIN_SECRET = process.env.ADMIN_RESET_SECRET;
    if (!ADMIN_SECRET) return res.status(500).json({ error: 'ADMIN_RESET_SECRET env var not configured' });

    const provided = req.headers['x-admin-secret'] || req.body?.secret;
    if (provided !== ADMIN_SECRET) return res.status(403).json({ error: 'Invalid admin secret' });

    const newPassword = req.body?.newPassword;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'newPassword required (min 8 chars)' });
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: 'Password must contain uppercase' });
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: 'Password must contain number' });

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

    console.log(JSON.stringify({ level: 'warn', action: 'ADMIN_PASSWORD_RESET_ALL', triggeredBy: caller.email, usersUpdated: updated.length, usersFailed: failed.length, timestamp: new Date().toISOString() }));
    return res.status(200).json({ success: true, message: `Updated ${updated.length}/${listResult.users.length} users`, updated, failed });
}
