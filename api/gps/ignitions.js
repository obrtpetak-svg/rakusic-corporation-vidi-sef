// ═══════════════════════════════════════════════════════
// GET /api/gps/ignitions — Fetch ignition data from Mapon
// For maintenance module: engine hours tracking
// ═══════════════════════════════════════════════════════
import { maponGet, corsHeaders } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { vehicleId, from, to } = req.query;
    if (!vehicleId || !from || !to) {
        return res.status(400).json({ error: 'Missing: vehicleId, from, to' });
    }

    try {
        const data = await maponGet('unit_data/ignitions.json', {
            unit_id: vehicleId, from, to,
        });

        const ignitions = data?.data?.units?.[vehicleId]?.ignitions || data?.data?.ignitions || [];

        // Calculate engine hours
        let totalMinutes = 0;
        const sessions = ignitions.map(ig => {
            const start = new Date(ig.start || ig.time_from);
            const end = new Date(ig.end || ig.time_to);
            const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
            totalMinutes += durationMin;
            return {
                start: start.toISOString(),
                end: end.toISOString(),
                durationMin,
                durationFormatted: `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
            };
        });

        return res.status(200).json({
            vehicleId, from, to,
            sessions,
            totalMinutes,
            totalHours: Math.round(totalMinutes / 60 * 10) / 10,
            totalFormatted: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
            sessionCount: sessions.length,
        });
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', action: 'ignitions_fetch_failed',
            vehicleId, error: err.message,
        }));
        return res.status(500).json({ error: err.message });
    }
}
