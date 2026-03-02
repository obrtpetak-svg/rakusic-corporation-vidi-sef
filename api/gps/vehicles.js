// ═══════════════════════════════════════════════════════
// GET /api/gps/vehicles — Fetch all vehicles from Mapon
// Writes to Firestore gps/cache/lastPositions + returns
// ═══════════════════════════════════════════════════════
import { maponGet, normalizeVehicle, corsHeaders, verifyAuth } from './_mapon-client.js';

export default async function handler(req, res) {
    // CORS
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // 🔒 Auth: verify Firebase ID token
    const authUser = await verifyAuth(req);
    if (!authUser) return res.status(401).json({ error: 'Unauthorized — valid Firebase token required' });

    try {
        const start = Date.now();

        // Call Mapon unit/list
        const data = await maponGet('unit/list.json');
        // FMLC returns units as an object keyed by unit_id, or sometimes as array
        const rawUnits = data?.data?.units || data?.units || {};
        const units = Array.isArray(rawUnits) ? rawUnits : Object.values(rawUnits);

        // Normalize all vehicles
        const vehiclesMap = {};
        units.forEach(u => {
            const v = normalizeVehicle(u);
            vehiclesMap[v.id] = v;
        });

        const cacheDoc = {
            updatedAt: new Date().toISOString(),
            dataAgeSeconds: 0,
            providerStatus: 'OK',
            dataSource: 'poll',
            syncIntervalMs: 30000,
            vehicleCount: Object.keys(vehiclesMap).length,
            vehicles: vehiclesMap,
        };

        // Write to Firestore (if firebase-admin available)
        try {
            const admin = await getFirebaseAdmin();
            if (admin) {
                await admin.firestore().doc('gps/cache').set({ lastPositions: cacheDoc }, { merge: true });
            }
        } catch (fbErr) {
            console.warn('[vehicles] Firestore write skipped:', fbErr.message);
        }

        console.log(JSON.stringify({
            level: 'info', action: 'vehicles_sync',
            vehicleCount: Object.keys(vehiclesMap).length,
            latencyMs: Date.now() - start,
        }));

        return res.status(200).json(cacheDoc);
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', action: 'vehicles_sync_failed',
            error: err.message, stack: err.stack,
        }));
        return res.status(500).json({ error: 'Failed to fetch vehicles', details: err.message });
    }
}

// Firebase Admin lazy init
let _admin = null;
async function getFirebaseAdmin() {
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
    } catch {
        return null;
    }
}
