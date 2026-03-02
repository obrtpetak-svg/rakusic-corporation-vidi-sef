// ═══════════════════════════════════════════════════════
// Mapon FMLC API Client — shared utility for all API routes
// Concurrency: p-limit(3) + exponential backoff
// ═══════════════════════════════════════════════════════

const MAPON_BASE = 'https://mapon.fmlc.com.hr/api/v1';
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

// Simple p-limit implementation (no external deps)
function createLimiter(concurrency) {
    let active = 0;
    const queue = [];
    const next = () => {
        if (active >= concurrency || queue.length === 0) return;
        active++;
        const { fn, resolve, reject } = queue.shift();
        fn().then(resolve, reject).finally(() => { active--; next(); });
    };
    return (fn) => new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
    });
}

const limiter = createLimiter(MAX_CONCURRENT);

// Exponential backoff fetch
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
            if (res.status === 429) {
                // Rate limited — wait and retry
                const wait = RETRY_BASE_MS * Math.pow(2, attempt);
                console.warn(`[Mapon] Rate limited, retrying in ${wait}ms (attempt ${attempt + 1})`);
                await new Promise(r => setTimeout(r, wait));
                continue;
            }
            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Mapon API ${res.status}: ${body}`);
            }
            return await res.json();
        } catch (err) {
            if (attempt === retries) throw err;
            const wait = RETRY_BASE_MS * Math.pow(2, attempt);
            console.warn(`[Mapon] Request failed, retrying in ${wait}ms:`, err.message);
            await new Promise(r => setTimeout(r, wait));
        }
    }
}

// ── Public API ──

export function getApiKey(type = 'core') {
    // CORE key for read operations, DATA_FORWARD key for push config
    const key = type === 'data_forward'
        ? process.env.MAPON_DATA_FORWARD_KEY
        : process.env.MAPON_API_KEY;
    if (!key) throw new Error(`Missing MAPON_${type.toUpperCase()}_KEY environment variable`);
    return key;
}

export async function maponGet(endpoint, params = {}, keyType = 'core') {
    const key = getApiKey(keyType);
    const url = new URL(`${MAPON_BASE}/${endpoint}`);
    url.searchParams.set('key', key);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const start = Date.now();

    console.log(JSON.stringify({
        level: 'info', requestId, action: 'mapon_request',
        endpoint, params: Object.keys(params),
    }));

    const result = await limiter(() => fetchWithRetry(url.toString()));

    console.log(JSON.stringify({
        level: 'info', requestId, action: 'mapon_response',
        endpoint, latencyMs: Date.now() - start,
        dataKeys: Object.keys(result?.data || result || {}),
    }));

    return result;
}

export async function maponPost(endpoint, body = {}, keyType = 'core') {
    const key = getApiKey(keyType);
    const url = new URL(`${MAPON_BASE}/${endpoint}`);
    url.searchParams.set('key', key);

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const start = Date.now();

    console.log(JSON.stringify({
        level: 'info', requestId, action: 'mapon_post',
        endpoint, bodyKeys: Object.keys(body),
    }));

    const result = await limiter(() => fetchWithRetry(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }));

    console.log(JSON.stringify({
        level: 'info', requestId, action: 'mapon_post_response',
        endpoint, latencyMs: Date.now() - start,
    }));

    return result;
}

// ── Vehicle normalization ──
export function normalizeVehicle(unit) {
    const pos = unit.last_position || unit.position || {};
    const now = Date.now();
    const lastUpdate = pos.time ? new Date(pos.time).getTime() : 0;
    const ageSec = lastUpdate ? Math.round((now - lastUpdate) / 1000) : 99999;

    let status = 'offline';
    if (ageSec < 300) {
        if ((pos.speed || 0) > 3) status = 'moving';
        else if (unit.ignition || pos.ignition) status = 'idle';
        else status = 'stopped';
    }

    return {
        id: String(unit.unit_id || unit.id),
        name: unit.number || unit.name || `Unit ${unit.unit_id}`,
        plate: unit.vehicle_registration || unit.plate || '',
        lat: pos.lat || pos.latitude || 0,
        lng: pos.lng || pos.longitude || 0,
        speed: Math.round(pos.speed || 0),
        heading: Math.round(pos.direction || pos.heading || 0),
        ignition: Boolean(unit.ignition || pos.ignition),
        status,
        address: pos.address || null,
        driverName: unit.driver_name || unit.driver || null,
        lastUpdate: pos.time || new Date().toISOString(),
        group: unit.group_name || unit.group || null,
    };
}

// CORS helper
export function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };
}
