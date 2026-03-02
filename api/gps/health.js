// ═══════════════════════════════════════════════════════
// GET /api/gps/health — Fleet GPS system health check
// ═══════════════════════════════════════════════════════
import { corsHeaders } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

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
            cacheStatus.error = fbErr.message;
        }

        // Environment check
        const envCheck = {
            maponApiKey: !!process.env.MAPON_API_KEY,
            maponDataForwardKey: !!process.env.MAPON_DATA_FORWARD_KEY,
            maponIngestToken: !!process.env.MAPON_INGEST_TOKEN,
            firebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        };

        return res.status(200).json({
            service: 'gps-fleet',
            timestamp: new Date().toISOString(),
            cache: cacheStatus,
            env: envCheck,
            endpoints: {
                vehicles: '/api/gps/vehicles',
                ingest: '/api/gps/ingest',
                routes: '/api/gps/routes',
                health: '/api/gps/health',
                dataForward: '/api/gps/data-forward',
            },
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
