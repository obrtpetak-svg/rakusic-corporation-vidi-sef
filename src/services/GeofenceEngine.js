// ═══════════════════════════════════════════════════════
// Geofence Engine — Distance calculation & zone detection
// Haversine for short, Vincenty-approx for > 1km
// ═══════════════════════════════════════════════════════

const R = 6371000; // Earth radius in metres
const toRad = (deg) => (deg * Math.PI) / 180;

// ── Haversine distance (metres) ──
export function haversine(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Check if point is inside geofence ──
export function isInGeofence(workerLat, workerLng, siteLat, siteLng, radiusMetres) {
    if (!siteLat || !siteLng || !workerLat || !workerLng) return { inZone: false, distance: null };
    const distance = haversine(workerLat, workerLng, siteLat, siteLng);
    return {
        inZone: distance <= radiusMetres,
        distance: Math.round(distance),
    };
}

// ── Throttle decision: should we send this location? ──
export function shouldSendLocation(newPos, lastSent, settings) {
    // Always send if source is APP_OPEN, APP_RESUME, SHIFT_START, SHIFT_END
    const alwaysSend = ['APP_OPEN', 'APP_RESUME', 'SHIFT_START', 'SHIFT_END'];
    if (alwaysSend.includes(newPos.source)) return { send: true, reason: 'event' };

    // Reject bad accuracy
    if (newPos.accuracy > settings.maxAccuracy) {
        return { send: false, reason: 'accuracy_too_high' };
    }

    // No previous — always send
    if (!lastSent) return { send: true, reason: 'first' };

    const timeDiff = (Date.now() - new Date(lastSent.timestamp).getTime()) / 1000;
    const distDiff = haversine(newPos.lat, newPos.lng, lastSent.lat, lastSent.lng);

    // keepAlive: send even if stationary after X seconds
    if (timeDiff >= settings.keepAlive) return { send: true, reason: 'keepalive' };

    // Movement threshold + time threshold
    if (distDiff >= settings.distanceThreshold && timeDiff >= settings.minInterval) {
        return { send: true, reason: 'movement' };
    }

    // Time threshold alone (at minimum interval)
    if (timeDiff >= settings.minInterval && distDiff >= 5) {
        return { send: true, reason: 'interval' };
    }

    return { send: false, reason: 'throttled' };
}

// ── Geofence alarm logic with 2-reading confirmation ──
export class GeofenceAlarmTracker {
    constructor() {
        this.consecutiveOOZ = 0; // out-of-zone readings
        this.consecutiveIZ = 0;  // in-zone readings
        this.lastAlarmTime = 0;
        this.lastKnownStatus = null; // 'IN_ZONE' | 'OUT_OF_ZONE'
    }

    // Returns alarm type or null
    checkAlarm(inZone, settings) {
        const now = Date.now();
        const debounceMs = (settings.alertDebounce || 3) * 60 * 1000;

        if (inZone) {
            this.consecutiveOOZ = 0;
            this.consecutiveIZ++;

            if (this.lastKnownStatus === 'OUT_OF_ZONE') {
                const confirmed = settings.requireTwoReadings ? this.consecutiveIZ >= 2 : true;
                const debounced = (now - this.lastAlarmTime) >= debounceMs;

                if (confirmed && debounced && settings.alertOnEnter) {
                    this.lastAlarmTime = now;
                    this.lastKnownStatus = 'IN_ZONE';
                    return 'RETURNED_TO_SITE';
                }
                if (confirmed) {
                    this.lastKnownStatus = 'IN_ZONE';
                }
            } else {
                this.lastKnownStatus = 'IN_ZONE';
            }
        } else {
            this.consecutiveIZ = 0;
            this.consecutiveOOZ++;

            if (this.lastKnownStatus === 'IN_ZONE' || this.lastKnownStatus === null) {
                const confirmed = settings.requireTwoReadings ? this.consecutiveOOZ >= 2 : true;
                const debounced = (now - this.lastAlarmTime) >= debounceMs;

                if (confirmed && debounced && settings.alertOnLeave) {
                    this.lastAlarmTime = now;
                    this.lastKnownStatus = 'OUT_OF_ZONE';
                    return 'LEFT_SITE';
                }
                if (confirmed) {
                    this.lastKnownStatus = 'OUT_OF_ZONE';
                }
            } else {
                this.lastKnownStatus = 'OUT_OF_ZONE';
            }
        }
        return null;
    }

    reset() {
        this.consecutiveOOZ = 0;
        this.consecutiveIZ = 0;
        this.lastAlarmTime = 0;
        this.lastKnownStatus = null;
    }
}
