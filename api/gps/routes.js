// ═══════════════════════════════════════════════════════
// GET /api/gps/routes — Fetch route history from Mapon
// Cache results in Firestore for 24h
// ═══════════════════════════════════════════════════════
import { maponGet, corsHeaders, verifyAuth, getFirebaseAdmin } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authUser = await verifyAuth(req);
    if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

    const { vehicleId, from, to } = req.query;
    if (!vehicleId || !from || !to) {
        return res.status(400).json({ error: 'Missing required params: vehicleId, from, to' });
    }

    const cacheKey = `${vehicleId}_${from}_${to}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
        // ── Check Firestore cache ──
        let cached = null;
        try {
            const admin = await getFirebaseAdmin();
            if (admin) {
                const doc = await admin.firestore().collection('gpsFleet').doc('routeCache').collection('entries').doc(cacheKey).get();
                if (doc.exists) {
                    const data = doc.data();
                    const cacheAge = (Date.now() - new Date(data.cachedAt).getTime()) / 1000;
                    if (cacheAge < 86400) { // 24h TTL
                        console.log(JSON.stringify({ level: 'info', action: 'route_cache_hit', cacheKey, ageSeconds: Math.round(cacheAge) }));
                        return res.status(200).json({ ...data, fromCache: true });
                    }
                }
            }
        } catch (fbErr) {
            console.warn('[routes] Cache check failed:', fbErr.message);
        }

        // ── Fetch from Mapon ──
        const start = Date.now();
        const data = await maponGet('route/list.json', {
            unit_id: vehicleId,
            from: from,
            to: to,
            include: 'polyline',
        });

        const routes = data?.data?.units?.[vehicleId]?.routes || data?.data?.routes || [];

        // Normalize route data
        let totalDistance = 0;
        let maxSpeed = 0;
        let totalDuration = 0;
        const allPoints = [];
        const stops = [];

        routes.forEach(route => {
            totalDistance += route.distance || 0;
            totalDuration += route.duration || 0;
            if (route.max_speed > maxSpeed) maxSpeed = route.max_speed;

            // Extract polyline points
            if (route.polyline) {
                const decoded = decodePolyline(route.polyline);
                decoded.forEach(p => allPoints.push({ lat: p[0], lng: p[1], speed: 0, ts: route.start }));
            } else if (route.points) {
                route.points.forEach(p => allPoints.push({
                    lat: p.lat || p.latitude,
                    lng: p.lng || p.longitude,
                    speed: p.speed || 0,
                    ts: p.time || p.timestamp,
                }));
            }

            // Extract stops
            if (route.start_address) {
                stops.push({
                    lat: route.start?.lat, lng: route.start?.lng,
                    startTs: route.start_time, endTs: null,
                    dwellSeconds: 0, address: route.start_address,
                });
            }
        });

        const avgSpeed = allPoints.length > 0
            ? Math.round(allPoints.reduce((sum, p) => sum + p.speed, 0) / allPoints.length)
            : 0;

        const result = {
            vehicleId, from, to,
            points: allPoints,
            stops,
            distanceKm: Math.round(totalDistance / 1000 * 10) / 10,
            maxSpeed: Math.round(maxSpeed),
            avgSpeed,
            durationMin: Math.round(totalDuration / 60),
            routeCount: routes.length,
            pointCount: allPoints.length,
            cachedAt: new Date().toISOString(),
        };

        // ── Write to Firestore cache ──
        try {
            const admin = await getFirebaseAdmin();
            if (admin) {
                await admin.firestore().collection('gpsFleet').doc('routeCache').collection('entries').doc(cacheKey).set(result);
            }
        } catch (fbErr) {
            console.warn('[routes] Cache write failed:', fbErr.message);
        }

        console.log(JSON.stringify({
            level: 'info', action: 'route_fetched',
            vehicleId, from, to,
            routeCount: routes.length, pointCount: allPoints.length,
            latencyMs: Date.now() - start,
        }));

        return res.status(200).json({ ...result, fromCache: false });
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', action: 'route_fetch_failed',
            vehicleId, from, to, error: err.message,
        }));
        return res.status(500).json({ error: 'Failed to fetch routes', details: err.message });
    }
}

// Decode Google-encoded polyline
function decodePolyline(encoded) {
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let result = 0, shift = 0, b;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        result = 0; shift = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
}

