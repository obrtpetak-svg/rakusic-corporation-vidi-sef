import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the _mapon-client module ──────────────────────────
vi.mock('./_mapon-client.js', () => ({
    normalizeVehicle: vi.fn((unit) => ({
        id: String(unit.unit_id || unit.id || 'test'),
        name: unit.label || unit.number || 'Test Vehicle',
        plate: 'ZG-123-AB',
        lat: unit.lat || 0,
        lng: unit.lng || 0,
        speed: 0,
        status: 'stopped',
        lastUpdate: new Date().toISOString(),
    })),
    corsHeaders: vi.fn(() => ({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    })),
    getFirebaseAdmin: vi.fn(() => null), // no Firestore in tests
}));

// ─── Import after mock ──────────────────────────────────────
import handler from './ingest.js';

// ─── Helper: create mock req/res ────────────────────────────
function mockReq(overrides = {}) {
    return {
        method: 'POST',
        query: {},
        headers: {},
        body: {},
        ...overrides,
    };
}

function mockRes() {
    const res = {
        statusCode: 200,
        _json: null,
        _headers: {},
        status(code) { res.statusCode = code; return res; },
        json(body) { res._json = body; return res; },
        setHeader(k, v) { res._headers[k] = v; },
    };
    return res;
}

describe('POST /api/gps/ingest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.MAPON_INGEST_TOKEN = 'test-secret-token';
    });

    // ── Auth Tests ──
    it('rejects requests without token', async () => {
        const req = mockReq({ query: {}, headers: {} });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(401);
        expect(res._json.error).toBe('Unauthorized');
    });

    it('rejects requests with wrong token', async () => {
        const req = mockReq({ query: { token: 'wrong-token' } });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(401);
    });

    it('accepts requests with correct token in query', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: [{ unit_id: 1, lat: 45.8, lng: 15.97 }],
        });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._json.status).toBe('ok');
    });

    it('accepts requests with correct token in header', async () => {
        const req = mockReq({
            headers: { 'x-ingest-token': 'test-secret-token' },
            body: [{ unit_id: 1, lat: 45.8, lng: 15.97 }],
        });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);
    });

    // ── Method Tests ──
    it('rejects non-POST methods', async () => {
        const req = mockReq({ method: 'GET', query: { token: 'test-secret-token' } });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(405);
    });

    it('handles OPTIONS for CORS preflight', async () => {
        const req = mockReq({ method: 'OPTIONS' });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);
    });

    // ── Payload Tests ──
    it('processes array payload', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: [
                { unit_id: 1, lat: 45.8, lng: 15.97 },
                { unit_id: 2, lat: 45.7, lng: 15.96 },
            ],
        });
        const res = mockRes();
        await handler(req, res);
        expect(res._json.processed).toBe(2);
    });

    it('processes units wrapper payload', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: { units: [{ unit_id: 1 }, { unit_id: 2 }] },
        });
        const res = mockRes();
        await handler(req, res);
        expect(res._json.processed).toBe(2);
    });

    it('processes data.units wrapper payload', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: { data: { units: [{ unit_id: 1 }] } },
        });
        const res = mockRes();
        await handler(req, res);
        expect(res._json.processed).toBe(1);
    });

    it('processes single data object payload', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: { data: { unit_id: 1 } },
        });
        const res = mockRes();
        await handler(req, res);
        expect(res._json.processed).toBe(1);
    });

    it('handles empty payload gracefully', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: [],
        });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._json.processed).toBe(0);
    });

    // ── Dedupe Tests ──
    it('deduplicates identical units', async () => {
        const ts = new Date().toISOString();
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: [
                { unit_id: 1, last_position: { time: ts } },
                { unit_id: 1, last_position: { time: ts } },
            ],
        });
        const res = mockRes();
        await handler(req, res);
        expect(res._json.processed).toBe(1);
        expect(res._json.dedupSkipped).toBe(1);
    });

    it('allows different timestamps for same unit', async () => {
        const req = mockReq({
            query: { token: 'test-secret-token' },
            body: [
                { unit_id: 1, last_position: { time: '2025-01-01T10:00:00Z' } },
                { unit_id: 1, last_position: { time: '2025-01-01T10:01:00Z' } },
            ],
        });
        const res = mockRes();
        await handler(req, res);
        expect(res._json.processed).toBe(2);
        expect(res._json.dedupSkipped).toBe(0);
    });
});
