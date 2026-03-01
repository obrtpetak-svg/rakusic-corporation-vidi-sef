// ═══════════════════════════════════════════════════════
// GPS Data Writer — Centralized Firestore GPS operations
// Writes to gpsLiveLocations + gpsEvents with retry,
// geofence checks, and coordinate validation
// ═══════════════════════════════════════════════════════

import { haversine, isInGeofence } from './GeofenceEngine';
import { GPS_COL } from './GpsSettingsManager';
import { enqueue, startAutoFlush } from './SyncQueue';

// ── Types ──────────────────────────────────────────────

export interface Coords {
    lat: number;
    lng: number;
}

export interface GpsLocationPayload {
    workerId: string;
    workerName?: string | null;
    projectId?: string | null;
    lat: number;
    lng: number;
    accuracy?: number | null;
    source?: string;
    siteCoords?: Coords | null;
    geofenceRadius?: number;
    batteryLevel?: number | null;
}

export interface GpsEventPayload {
    type: string;
    workerId: string;
    workerName?: string | null;
    projectId?: string | null;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    details?: string | null;
}

export interface GpsWriteResult {
    success: boolean;
    error?: string;
    liveOk?: boolean;
    eventOk?: boolean;
    data?: Record<string, unknown>;
}

// ── Constants ──
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const VALID_LAT_RANGE: [number, number] = [-90, 90];
const VALID_LNG_RANGE: [number, number] = [-180, 180];

// ── Coordinate Validation ──
export function validateCoords(lat: unknown, lng: unknown): boolean {
    if (lat == null || lng == null) return false;
    const la = Number(lat);
    const lo = Number(lng);
    if (isNaN(la) || isNaN(lo)) return false;
    if (la < VALID_LAT_RANGE[0] || la > VALID_LAT_RANGE[1]) return false;
    if (lo < VALID_LNG_RANGE[0] || lo > VALID_LNG_RANGE[1]) return false;
    return true;
}

// ── Normalize coords to 6 decimal places ──
export function normalizeCoord(val: number | string): number {
    return Math.round(Number(val) * 1e6) / 1e6;
}

// ── Parse GPS string "45.815, 15.982" → { lat, lng } ──
export function parseGpsString(str: unknown): Coords | null {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(',').map(s => s.trim());
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!validateCoords(lat, lng)) return null;
    return { lat: normalizeCoord(lat), lng: normalizeCoord(lng) };
}

// ── Calculate distance in metres between two points ──
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number | null {
    if (!validateCoords(lat1, lng1) || !validateCoords(lat2, lng2)) return null;
    return Math.round(haversine(lat1, lng1, lat2, lng2));
}

// ── Retry wrapper for Firestore writes ──
async function withRetry(fn: () => Promise<unknown>, label = 'GPS write'): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await fn();
            return true;
        } catch (err) {
            console.warn(`[GpsDataWriter] ${label} attempt ${attempt}/${MAX_RETRIES} failed:`, (err as Error).message);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
            } else {
                console.error(`[GpsDataWriter] ${label} failed after ${MAX_RETRIES} attempts:`, err);
                return false;
            }
        }
    }
    return false;
}

// ── Get Firestore instance ──
// TODO: Replace with typed Firebase import when firebaseCore migrates to TS
function getDb(): ReturnType<typeof Function> | null {
    const win = window as Record<string, unknown>;
    const fb = win.firebase as { firestore?: () => unknown } | undefined;
    return fb?.firestore?.() ?? null;
}

// ═══════════════════════════════════════════════════════
// Main GPS Write — writes to gpsLiveLocations + gpsEvents
// ═══════════════════════════════════════════════════════
export async function writeGpsLocation({
    workerId,
    workerName = null,
    projectId = null,
    lat,
    lng,
    accuracy = null,
    source = 'MANUAL',
    siteCoords = null,
    geofenceRadius = 300,
    batteryLevel = null,
}: GpsLocationPayload): Promise<GpsWriteResult> {
    const db = getDb() as { collection: (n: string) => { doc: (id: string) => { set: (d: unknown, o?: unknown) => Promise<void> }; add: (d: unknown) => Promise<void> } } | null;
    if (!db || !navigator.onLine) {
        await enqueue('gpsLocation', { workerId, workerName, projectId, lat, lng, accuracy, source, siteCoords, geofenceRadius, batteryLevel });
        return { success: false, error: 'QUEUED_OFFLINE' };
    }

    if (!workerId) return { success: false, error: 'NO_WORKER_ID' };
    if (!validateCoords(lat, lng)) return { success: false, error: 'INVALID_COORDS' };

    const normalLat = normalizeCoord(lat);
    const normalLng = normalizeCoord(lng);
    const timestamp = new Date().toISOString();

    let distanceFromSite: number | null = null;
    let inGeofence: boolean | null = null;
    if (siteCoords && validateCoords(siteCoords.lat, siteCoords.lng)) {
        const geo = isInGeofence(normalLat, normalLng, siteCoords.lat, siteCoords.lng, geofenceRadius);
        distanceFromSite = geo.distance;
        inGeofence = geo.inZone;
    }

    const liveDoc = {
        lat: normalLat, lng: normalLng,
        accuracy: accuracy != null ? Math.round(accuracy) : null,
        timestamp, projectId: projectId || null, source,
        inGeofence, distanceFromSite,
        batteryLevel: batteryLevel != null ? Math.round(batteryLevel) : null,
        workerName: workerName || null,
    };

    const eventDoc = {
        type: source, workerId, workerName: workerName || null,
        projectId: projectId || null,
        lat: normalLat, lng: normalLng,
        accuracy: accuracy != null ? Math.round(accuracy) : null,
        timestamp, distanceFromSite, inGeofence,
    };

    const liveOk = await withRetry(
        () => db.collection(GPS_COL.liveLocations).doc(workerId).set(liveDoc, { merge: true }),
        'gpsLiveLocations'
    );

    const eventOk = await withRetry(
        () => db.collection(GPS_COL.events).add(eventDoc),
        'gpsEvents'
    );

    if (!liveOk || !eventOk) {
        await enqueue('gpsLocation', { workerId, workerName, projectId, lat, lng, accuracy, source, siteCoords, geofenceRadius, batteryLevel });
    }

    return { success: liveOk && eventOk, liveOk, eventOk, data: liveDoc };
}

// ═══════════════════════════════════════════════════════
// Write GPS Event only (for errors, geofence alerts, etc.)
// ═══════════════════════════════════════════════════════
export async function writeGpsEvent({
    type, workerId, workerName = null, projectId = null,
    lat = null, lng = null, accuracy = null, details = null,
}: GpsEventPayload): Promise<boolean> {
    const db = getDb() as { collection: (n: string) => { add: (d: unknown) => Promise<void> } } | null;
    if (!db) return false;

    const eventDoc = {
        type, workerId, workerName: workerName || null,
        projectId: projectId || null,
        lat: lat != null ? normalizeCoord(lat) : null,
        lng: lng != null ? normalizeCoord(lng) : null,
        accuracy: accuracy != null ? Math.round(accuracy) : null,
        timestamp: new Date().toISOString(),
        details: details || null,
    };

    return await withRetry(
        () => db.collection(GPS_COL.events).add(eventDoc),
        'gpsEvent'
    );
}

// ═══════════════════════════════════════════════════════
// Initialize auto-flush — call once at app startup
// ═══════════════════════════════════════════════════════
export function initSyncQueue(): void {
    startAutoFlush(async (type: string, payload: Record<string, unknown>) => {
        if (type === 'gpsLocation') {
            const db = getDb() as { collection: (n: string) => { doc: (id: string) => { set: (d: unknown, o?: unknown) => Promise<void> }; add: (d: unknown) => Promise<void> } } | null;
            if (!db) throw new Error('No DB');
            const { workerId, lat, lng } = payload as { workerId: string; lat: number; lng: number };
            await db.collection(GPS_COL.liveLocations).doc(workerId).set({
                lat: normalizeCoord(lat),
                lng: normalizeCoord(lng),
                accuracy: payload.accuracy,
                timestamp: new Date().toISOString(),
                projectId: payload.projectId || null,
                source: payload.source || 'SYNC_RETRY',
                batteryLevel: payload.batteryLevel,
                workerName: payload.workerName || null,
            }, { merge: true });
        } else if (type === 'gpsEvent') {
            const db = getDb() as { collection: (n: string) => { add: (d: unknown) => Promise<void> } } | null;
            if (!db) throw new Error('No DB');
            await db.collection(GPS_COL.events).add(payload);
        }
    });
}
