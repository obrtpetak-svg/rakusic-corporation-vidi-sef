// ── Admin: Create/Update Firebase Auth Account for Worker ──
// Creates Firebase Auth accounts so workers can log in via AppLogin.
// Also supports updating password for existing users.

import { getFirebaseAdmin, verifyAuth, corsHeaders } from '../gps/_mapon-client.js';

export default async function handler(req, res) {
    // ── CORS ──
    const headers = corsHeaders(req);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // ── Auth: Firebase Auth token required ──
    const caller = await verifyAuth(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { username, password, displayName, action } = req.body || {};

    if (!username) return res.status(400).json({ error: 'username required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'password required (min 6 chars)' });

    const email = username.includes('@') ? username : `${username}@rakusic-corporation.live`;

    try {
        const admin = await getFirebaseAdmin();
        if (!admin) return res.status(500).json({ error: 'Firebase Admin not available' });
        const auth = admin.auth();

        if (action === 'update') {
            // Update existing user's password
            try {
                const existingUser = await auth.getUserByEmail(email);
                await auth.updateUser(existingUser.uid, {
                    password,
                    ...(displayName ? { displayName } : {}),
                });
                return res.status(200).json({ success: true, action: 'updated', uid: existingUser.uid, email });
            } catch (err) {
                if (err.code === 'auth/user-not-found') {
                    // User doesn't exist, fall through to create
                } else {
                    throw err;
                }
            }
        }

        // Create new Firebase Auth account
        try {
            const newUser = await auth.createUser({
                email,
                password,
                displayName: displayName || username,
                emailVerified: true, // Skip email verification for internal users
            });

            console.log(JSON.stringify({
                level: 'info', action: 'USER_CREATED',
                email, uid: newUser.uid,
                createdBy: caller.email,
                timestamp: new Date().toISOString(),
            }));

            return res.status(201).json({ success: true, action: 'created', uid: newUser.uid, email });
        } catch (err) {
            if (err.code === 'auth/email-already-exists') {
                // User exists — update their password instead
                const existingUser = await auth.getUserByEmail(email);
                await auth.updateUser(existingUser.uid, {
                    password,
                    ...(displayName ? { displayName } : {}),
                });
                return res.status(200).json({ success: true, action: 'updated', uid: existingUser.uid, email });
            }
            throw err;
        }

    } catch (err) {
        console.error('[create-user] Error:', err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
