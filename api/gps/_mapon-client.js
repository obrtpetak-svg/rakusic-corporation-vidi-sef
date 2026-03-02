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

// ── Vehicle normalization (Mapon FMLC format) ──
// Mapon FMLC puts lat, lng, direction, speed, state directly on the unit object
export function normalizeVehicle(unit) {
    const now = Date.now();

    // FMLC: lat/lng/speed/direction at root level
    const lat = unit.lat || unit.latitude || 0;
    const lng = unit.lng || unit.longitude || 0;
    const speed = unit.speed || 0;
    const heading = unit.direction || unit.heading || 0;

    // FMLC: last_update at root, or fallback to nested
    const lastUpdateStr = unit.last_update || unit.lastUpdate
        || unit.last_position?.time || new Date().toISOString();
    const lastUpdate = new Date(lastUpdateStr).getTime();
    const ageSec = lastUpdate ? Math.round((now - lastUpdate) / 1000) : 99999;

    // FMLC: state.name = 'driving' | 'standing' | 'stopped' | 'idling' | 'offline'
    const stateName = unit.state?.name || unit.movement_state?.name || '';
    let status = 'offline';
    if (lat === 0 && lng === 0) {
        status = 'offline';
    } else if (ageSec < 600) {
        if (stateName === 'driving' || speed > 3) status = 'moving';
        else if (stateName === 'idling') status = 'idle';
        else if (stateName === 'standing' || stateName === 'stopped') status = 'stopped';
        else status = 'stopped';
    }

    // Extract plate from number field (format: "DJ-708-CT Živić Antun" → "DJ-708-CT")
    const number = unit.number || '';
    const plateParts = number.match(/^([A-Z]{1,3}-\d{2,4}-[A-Z]{1,3})/);
    const plate = plateParts ? plateParts[1] : (unit.vehicle_registration || unit.plate || '');

    // Extract driver name from number field (after plate)
    const driverFromNumber = plateParts ? number.replace(plateParts[1], '').trim() : '';

    return {
        id: String(unit.unit_id || unit.id),
        name: unit.label || unit.number || unit.name || `Unit ${unit.unit_id}`,
        plate,
        lat, lng,
        speed: Math.round(speed),
        heading: Math.round(heading),
        ignition: Boolean(unit.ignition),
        status,
        address: unit.address || null,
        driverName: unit.driver_name || driverFromNumber || null,
        lastUpdate: lastUpdateStr,
        group: unit.group_name || unit.group || null,
        mileage: unit.mileage ? Math.round(unit.mileage / 1000) : null, // m → km
        type: unit.type || unit.icon || 'car',
        vin: unit.vin || null,
        fuelType: unit.fuel_type || null,
        engineHoursTotal: unit.ignition_total_time || null,
    };
}

// ── Shared Firebase Admin lazy init ──
let _authAdmin = null;
export async function getFirebaseAdmin() {
    if (_authAdmin) return _authAdmin;
    try {
        const { default: admin } = await import('firebase-admin');
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
            });
        }
        _authAdmin = admin;
        return admin;
    } catch {
        return null;
    }
}

export async function verifyAuth(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    if (!token) return null;

    try {
        const admin = await getFirebaseAdmin();
        if (!admin) return null;
        const decoded = await admin.auth().verifyIdToken(token);
        return decoded; // { uid, email, ... }
    } catch (err) {
        console.warn(JSON.stringify({
            level: 'warn', action: 'auth_verify_failed',
            error: err.message,
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        }));
        return null;
    }
}

// CORS helper — locked to production domain
const ALLOWED_ORIGINS = [
    'https://rakusic-corporation.live',
    'http://localhost:5173', // local dev
    'http://localhost:3000',
];

export function corsHeaders(req) {
    const origin = req?.headers?.origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
    };
}
