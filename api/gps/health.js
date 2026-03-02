// ═══════════════════════════════════════════════════════
// GET /api/gps/health — Fleet GPS system health check
// Fixed: uses shared getAuthAdmin instead of duplicate init
// ═══════════════════════════════════════════════════════
import { corsHeaders, getAuthAdmin } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

    try {
        let cacheStatus = { status: 'unknown', lastSync: null, vehicleCount: 0, providerStatus: 'UNKNOWN' };

        // Check Firestore cache
        try {
            const admin = await getAuthAdmin();
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
            console.error('[health] Firestore check failed:', fbErr.message);
        }

        return res.status(200).json({
            service: 'gps-fleet',
            status: cacheStatus.status,
            timestamp: new Date().toISOString(),
            vehicleCount: cacheStatus.vehicleCount,
            uptime: process.uptime ? Math.round(process.uptime()) : null,
        });
    } catch (err) {
        console.error('[health] Error:', err.message);
        return res.status(500).json({ status: 'ERROR' });
    }
}
