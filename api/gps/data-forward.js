// ═══════════════════════════════════════════════════════
// POST /api/gps/data-forward — Setup/manage Mapon Data Forwarding
// Only admin should call this (RBAC enforced by frontend)
// ═══════════════════════════════════════════════════════
import { maponGet, maponPost, corsHeaders } from './_mapon-client.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).json({});
    Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

    try {
        const { action } = req.query;

        switch (action) {
            // List available data packs
            case 'list-packs': {
                const data = await maponGet('data_forward/list_packs.json', {}, 'data_forward');
                return res.status(200).json(data);
            }

            // List current forwarding endpoints
            case 'list': {
                const data = await maponGet('data_forward/list.json', {}, 'data_forward');
                return res.status(200).json(data);
            }

            // Create or update forwarding endpoint
            case 'save': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const { url, unit_ids, packs } = req.body;
                if (!url) return res.status(400).json({ error: 'Missing url' });

                const payload = {
                    data: { url },
                    unit_ids: unit_ids || [], // empty = all vehicles
                    packs: packs || [],
                };
                const data = await maponPost('data_forward/save.json', payload, 'data_forward');

                console.log(JSON.stringify({
                    level: 'info', action: 'data_forward_saved',
                    url: url.replace(/token=.*/, 'token=***'), // redact token
                    unitCount: unit_ids?.length || 'all',
                    packCount: packs?.length || 0,
                }));

                return res.status(200).json(data);
            }

            // Add unit to forwarding
            case 'add-unit': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const data = await maponPost('data_forward/add_unit.json', req.body, 'data_forward');
                return res.status(200).json(data);
            }

            // Remove unit from forwarding
            case 'remove-unit': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const data = await maponPost('data_forward/remove_unit.json', req.body, 'data_forward');
                return res.status(200).json(data);
            }

            // Delete forwarding endpoint
            case 'delete': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                const data = await maponPost('data_forward/delete.json', req.body, 'data_forward');
                return res.status(200).json(data);
            }

            default:
                return res.status(400).json({
                    error: 'Missing or invalid action',
                    validActions: ['list-packs', 'list', 'save', 'add-unit', 'remove-unit', 'delete'],
                });
        }
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', action: 'data_forward_error',
            error: err.message,
        }));
        return res.status(500).json({ error: err.message });
    }
}
