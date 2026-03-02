// ═══════════════════════════════════════════════════════
// GET /api/gps/health — Fleet GPS system health check
// ═══════════════════════════════════════════════════════
import { corsHeaders } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

    try {
        let cacheStatus = { status: 'unknown', lastSync: null, vehicleCount: 0, providerStatus: 'UNKNOWN' };

        // Check Firestore cache
        try {
            const admin = await getFirebaseAdmin();
            if (admin) {
                const doc = await admin.firestore().doc('gps/cache').get();
                if (doc.exists) {
                    const data = doc.data()?.lastPositions || {};
                    const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
                    const ageSeconds = updatedAt ? Math.round((Date.now() - updatedAt.getTime()) / 1000) : 99999;

                    cacheStatus = {
                        status: ageSeconds < 120 ? 'OK' : ageSeconds < 300 ? 'STALE' : 'DOWN',
                        lastSync: data.updatedAt || null,
                        pushAgeSeconds: ageSeconds,
                        vehicleCount: data.vehicleCount || 0,
                        providerStatus: ageSeconds < 120 ? 'OK' : 'STALE',
                        dataSource: data.dataSource || 'unknown',
                    };
                }
            }
        } catch (fbErr) {
            cacheStatus.status = 'ERROR';
        }

        return res.status(200).json({
            service: 'gps-fleet',
            status: cacheStatus.status,
            timestamp: new Date().toISOString(),
            vehicleCount: cacheStatus.vehicleCount,
        });
    } catch (err) {
        return res.status(500).json({ status: 'ERROR', error: err.message });
    }
}

let _admin = null;
async function getFirebaseAdmin() {
    if (_admin) return _admin;
    try {
        const { default: admin } = await import('firebase-admin');
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')) });
        }
        _admin = admin;
        return admin;
    } catch { return null; }
}
