// ═══════════════════════════════════════════════════════
// POST /api/gps/route-planning — Route Planning workflows
// Orders CRUD, route create/optimize/send
// ═══════════════════════════════════════════════════════
import { maponGet, maponPost, corsHeaders, verifyAuth, getFirebaseAdmin } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

    const authUser = await verifyAuth(req);
    if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

    const { action } = req.query;

    try {
        switch (action) {
            // ── Orders ──
            case 'create-order': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { name, places } = req.body;
                if (!name || !places?.length) return res.status(400).json({ error: 'name and places required' });

                const data = await maponPost('routeplanning_orders/create.json', {
                    name,
                    places: places.map((p, i) => ({
                        address: p.address,
                        lat: p.lat, lng: p.lng,
                        duration: p.durationMin || 15,
                        sequence: i + 1,
                    })),
                });

                // Save to Firestore
                try {
                    const admin = await getFirebaseAdmin();
                    if (admin && data?.data?.id) {
                        await admin.firestore().collection('gpsFleet').doc('orders').collection('items').doc(String(data.data.id)).set({
                            maponOrderId: data.data.id,
                            name, places, status: 'draft',
                            createdAt: new Date().toISOString(),
                        });
                    }
                } catch (e) { console.warn('[route-planning] Firestore save failed:', e.message); }

                return res.status(200).json(data);
            }

            case 'list-orders': {
                const data = await maponGet('routeplanning_orders/list.json');
                return res.status(200).json(data);
            }

            case 'get-order': {
                const { orderId } = req.query;
                if (!orderId) return res.status(400).json({ error: 'orderId required' });
                const data = await maponGet('routeplanning_orders/get.json', { id: orderId });
                return res.status(200).json(data);
            }

            // ── Routes ──
            case 'create-route': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { orderIds, vehicleId, startTime, startAddress, endAddress } = req.body;

                const data = await maponPost('routeplanning_routes/save.json', {
                    order_ids: orderIds,
                    unit_id: vehicleId,
                    start_time: startTime,
                    ...(startAddress && { start_address: startAddress }),
                    ...(endAddress && { end_address: endAddress }),
                });

                // Save to Firestore
                try {
                    const admin = await getFirebaseAdmin();
                    if (admin && data?.data?.id) {
                        await admin.firestore().collection('gpsFleet').doc('plannedRoutes').collection('items').doc(String(data.data.id)).set({
                            maponRouteId: data.data.id,
                            orderIds, vehicleId, startTime,
                            status: 'draft', createdAt: new Date().toISOString(),
                        });
                    }
                } catch (e) { console.warn('[route-planning] Firestore save failed:', e.message); }

                return res.status(200).json(data);
            }

            case 'list-routes': {
                const data = await maponGet('routeplanning_routes/list.json');
                return res.status(200).json(data);
            }

            // ── Optimization ──
            case 'optimize': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { routeId } = req.body;
                if (!routeId) return res.status(400).json({ error: 'routeId required' });

                const data = await maponPost('routeplanning_routes/optimize.json', { id: routeId });
                return res.status(200).json(data);
            }

            case 'optimize-progress': {
                const { routeId } = req.query;
                if (!routeId) return res.status(400).json({ error: 'routeId required' });
                const data = await maponGet('routeplanning_routes/optimize_check_progress.json', { id: routeId });
                return res.status(200).json(data);
            }

            // ── Send to driver ──
            case 'send': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { routeId } = req.body;
                if (!routeId) return res.status(400).json({ error: 'routeId required' });

                const data = await maponPost('routeplanning_routes/send_to_assignee.json', { id: routeId });

                // Audit log
                console.log(JSON.stringify({
                    level: 'info', action: 'FLEET_ROUTE_SENT',
                    routeId, timestamp: new Date().toISOString(),
                }));

                return res.status(200).json(data);
            }

            default:
                return res.status(400).json({
                    error: 'Invalid action',
                    validActions: [
                        'create-order', 'list-orders', 'get-order',
                        'create-route', 'list-routes',
                        'optimize', 'optimize-progress', 'send',
                    ],
                });
        }
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', action: 'route_planning_error',
            requestAction: action, error: err.message,
        }));
        return res.status(500).json({ error: err.message });
    }
}

