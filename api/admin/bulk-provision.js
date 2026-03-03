// ── Admin: Bulk Provision Firebase Auth Accounts ──
// Reads all users from Firestore `users` collection and creates
// Firebase Auth accounts for any that don't already have one.

import { getFirebaseAdmin, verifyAuth, corsHeaders } from '../gps/_mapon-client.js';

export default async function handler(req, res) {
    const headers = corsHeaders(req);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // Auth: Firebase Auth token required
    const caller = await verifyAuth(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { defaultPassword } = req.body || {};
    if (!defaultPassword || defaultPassword.length < 6) {
        return res.status(400).json({ error: 'defaultPassword required (min 6 chars)' });
    }

    try {
        const admin = await getFirebaseAdmin();
        if (!admin) return res.status(500).json({ error: 'Firebase Admin not available' });

        const auth = admin.auth();
        const db = admin.firestore();

        // Read all users from Firestore
        const usersSnap = await db.collection('users').get();
        const results = { created: [], existing: [], failed: [], skipped: [] };

        for (const doc of usersSnap.docs) {
            const userData = doc.data();
            const username = userData.username;

            if (!username) {
                results.skipped.push({ id: doc.id, name: userData.name, reason: 'no username' });
                continue;
            }
            if (userData.active === false) {
                results.skipped.push({ id: doc.id, name: userData.name, reason: 'inactive' });
                continue;
            }

            const email = username.includes('@') ? username : `${username}@rakusic-corporation.live`;

            try {
                // Check if Firebase Auth account already exists
                await auth.getUserByEmail(email);
                results.existing.push({ username, email });
            } catch (err) {
                if (err.code === 'auth/user-not-found') {
                    // Create new account
                    try {
                        const newUser = await auth.createUser({
                            email,
                            password: defaultPassword,
                            displayName: userData.name || username,
                            emailVerified: true,
                        });
                        results.created.push({ username, email, uid: newUser.uid, name: userData.name });
                    } catch (createErr) {
                        results.failed.push({ username, email, error: createErr.message });
                    }
                } else {
                    results.failed.push({ username, email, error: err.message });
                }
            }
        }

        console.log(JSON.stringify({
            level: 'info', action: 'BULK_PROVISION_AUTH',
            triggeredBy: caller.email,
            created: results.created.length,
            existing: results.existing.length,
            skipped: results.skipped.length,
            failed: results.failed.length,
            timestamp: new Date().toISOString(),
        }));

        return res.status(200).json({
            success: true,
            summary: `Created ${results.created.length} accounts, ${results.existing.length} already existed, ${results.skipped.length} skipped, ${results.failed.length} failed`,
            ...results,
        });

    } catch (err) {
        console.error('[bulk-provision] Error:', err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
