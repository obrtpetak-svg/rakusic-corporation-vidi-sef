// ═══════════════════════════════════════════════════════
// POST /api/gps/ingest — Mapon Data Forwarding webhook
// Receives push position packs, validates, writes Firestore
// ═══════════════════════════════════════════════════════
import { normalizeVehicle, corsHeaders, getFirebaseAdmin } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

    // Only POST allowed
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Auth: validate token ──
    const token = req.query.token || req.headers['x-ingest-token'];
    const expectedToken = process.env.MAPON_INGEST_TOKEN;
    if (!expectedToken || token !== expectedToken) {
        console.warn(JSON.stringify({
            level: 'warn', action: 'ingest_auth_failed',
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
            tokenProvided: !!token,
        }));
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const body = req.body;
        const start = Date.now();

        // Mapon sends different payload formats — handle common ones
        const units = Array.isArray(body) ? body
            : body?.units ? body.units
                : body?.data?.units ? body.data.units
                    : body?.data ? [body.data]
                        : [body];

        if (!units || units.length === 0) {
            return res.status(200).json({ status: 'ok', processed: 0, message: 'No units in payload' });
        }

        // ── Dedupe + normalize ──
        const processed = [];
        const dedupeKeys = new Set();

        for (const unit of units) {
            const pos = unit.last_position || unit.position || unit;
            const unitId = String(unit.unit_id || unit.id || pos.unit_id || 'unknown');
            const ts = pos.time || pos.timestamp || new Date().toISOString();
            const dedupeKey = `mapon_${unitId}_${ts}`;

            if (dedupeKeys.has(dedupeKey)) continue;
            dedupeKeys.add(dedupeKey);

            const vehicle = normalizeVehicle(unit);
            processed.push({ dedupeKey, vehicle });
        }

        // ── Write to Firestore ──
        let firestoreWritten = false;
        try {
            const admin = await getFirebaseAdmin();
            if (admin) {
                const db = admin.firestore();
                const docRef = db.doc('gps/cache');

                // Build partial update for just the received vehicles
                const updateData = {
                    'lastPositions.updatedAt': new Date().toISOString(),
                    'lastPositions.dataAgeSeconds': 0,
                    'lastPositions.providerStatus': 'OK',
                    'lastPositions.dataSource': 'push',
                };

                for (const { vehicle } of processed) {
                    updateData[`lastPositions.vehicles.${vehicle.id}`] = vehicle;
                }
                updateData['lastPositions.vehicleCount'] = admin.firestore.FieldValue.increment(0); // keep existing

                await docRef.set(updateData, { merge: true });

                // Write events for significant state changes (optional)
                const batch = db.batch();
                for (const { vehicle, dedupeKey } of processed) {
                    // Write dedup key with TTL (Firestore TTL policy auto-deletes)
                    batch.set(db.collection('gpsFleet').doc('dedup').collection('keys').doc(dedupeKey), {
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        expireAt: new Date(Date.now() + 5 * 60 * 1000), // TTL: 5 minutes
                    });
                }
                await batch.commit();
                firestoreWritten = true;
            }
        } catch (fbErr) {
            console.warn('[ingest] Firestore write failed:', fbErr.message);
        }

        console.log(JSON.stringify({
            level: 'info', action: 'ingest_processed',
            unitsReceived: units.length,
            processed: processed.length,
            dedupSkipped: units.length - processed.length,
            firestoreWritten,
            latencyMs: Date.now() - start,
        }));

        // ACK fast
        return res.status(200).json({
            status: 'ok',
            processed: processed.length,
            dedupSkipped: units.length - processed.length,
        });
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', action: 'ingest_failed',
            error: err.message, stack: err.stack,
        }));
        return res.status(500).json({ error: 'Ingest processing failed' });
    }
}

