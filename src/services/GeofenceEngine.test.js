import { describe, it, expect } from 'vitest';
import { haversine, isInGeofence, shouldSendLocation, GeofenceAlarmTracker } from './GeofenceEngine';

// ═══════════════════════════════════════════════════════════════════════════
// haversine — distance between two GPS points in metres
// ═══════════════════════════════════════════════════════════════════════════
describe('haversine', () => {
    it('returns 0 for same point', () => {
        expect(haversine(45.815, 15.982, 45.815, 15.982)).toBe(0);
    });

    it('calculates Zagreb → Đakovo (~200km)', () => {
        const dist = haversine(45.815, 15.982, 45.308, 18.410);
        expect(dist).toBeGreaterThan(180000);
        expect(dist).toBeLessThan(210000);
    });

    it('calculates short distance (~100m)', () => {
        // ~100m apart on same latitude
        const dist = haversine(45.815, 15.982, 45.815, 15.9835);
        expect(dist).toBeGreaterThan(80);
        expect(dist).toBeLessThan(130);
    });

    it('calculates equator crossing', () => {
        const dist = haversine(0.001, 0, -0.001, 0);
        expect(dist).toBeGreaterThan(200);
        expect(dist).toBeLessThan(250);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// isInGeofence — zone check with distance
// ═══════════════════════════════════════════════════════════════════════════
describe('isInGeofence', () => {
    const siteLat = 45.308;
    const siteLng = 18.410;

    it('detects point inside 500m geofence', () => {
        // ~50m from site
        const result = isInGeofence(45.3084, 18.4104, siteLat, siteLng, 500);
        expect(result.inZone).toBe(true);
        expect(result.distance).toBeLessThan(500);
    });

    it('detects point outside 100m geofence', () => {
        // ~1km away
        const result = isInGeofence(45.318, 18.420, siteLat, siteLng, 100);
        expect(result.inZone).toBe(false);
        expect(result.distance).toBeGreaterThan(100);
    });

    it('returns false with null coords', () => {
        expect(isInGeofence(null, null, siteLat, siteLng, 300).inZone).toBe(false);
    });

    it('returns false with null site', () => {
        expect(isInGeofence(45.308, 18.410, null, null, 300).inZone).toBe(false);
    });

    it('exact same location is in zone', () => {
        const result = isInGeofence(siteLat, siteLng, siteLat, siteLng, 10);
        expect(result.inZone).toBe(true);
        expect(result.distance).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// shouldSendLocation — throttle logic
// ═══════════════════════════════════════════════════════════════════════════
describe('shouldSendLocation', () => {
    const settings = {
        maxAccuracy: 100,
        keepAlive: 300,
        distanceThreshold: 50,
        minInterval: 30,
    };

    it('always sends for APP_OPEN', () => {
        const result = shouldSendLocation({ source: 'APP_OPEN', accuracy: 10, lat: 45, lng: 15 }, null, settings);
        expect(result.send).toBe(true);
        expect(result.reason).toBe('event');
    });

    it('always sends first location', () => {
        const result = shouldSendLocation({ source: 'GPS', accuracy: 10, lat: 45, lng: 15 }, null, settings);
        expect(result.send).toBe(true);
        expect(result.reason).toBe('first');
    });

    it('rejects bad accuracy', () => {
        const result = shouldSendLocation({ source: 'GPS', accuracy: 200, lat: 45, lng: 15 }, null, settings);
        expect(result.send).toBe(false);
        expect(result.reason).toBe('accuracy_too_high');
    });

    it('throttles close + recent location', () => {
        const lastSent = { lat: 45, lng: 15, timestamp: new Date().toISOString() };
        const result = shouldSendLocation({ source: 'GPS', accuracy: 10, lat: 45.0001, lng: 15.0001 }, lastSent, settings);
        expect(result.send).toBe(false);
        expect(result.reason).toBe('throttled');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// GeofenceAlarmTracker — alarm state machine
// ═══════════════════════════════════════════════════════════════════════════
describe('GeofenceAlarmTracker', () => {
    const settings = {
        requireTwoReadings: true,
        alertDebounce: 0, // immediate for tests
        alertOnEnter: true,
        alertOnLeave: true,
    };

    it('fires LEFT_SITE after 2 out-of-zone readings', () => {
        const tracker = new GeofenceAlarmTracker();
        expect(tracker.checkAlarm(false, settings)).toBeNull(); // 1st reading
        expect(tracker.checkAlarm(false, settings)).toBe('LEFT_SITE'); // 2nd reading
    });

    it('fires RETURNED_TO_SITE after leaving and returning', () => {
        const tracker = new GeofenceAlarmTracker();
        tracker.checkAlarm(false, settings); // out 1
        tracker.checkAlarm(false, settings); // out 2 → LEFT_SITE
        // Simulate time passing (debounce = 0 still checks >=)
        tracker.lastAlarmTime = 0;
        tracker.checkAlarm(true, settings);  // in 1
        expect(tracker.checkAlarm(true, settings)).toBe('RETURNED_TO_SITE'); // in 2
    });

    it('does not fire without 2 readings when requireTwoReadings=true', () => {
        const tracker = new GeofenceAlarmTracker();
        expect(tracker.checkAlarm(false, settings)).toBeNull();
        // Single reading then back in
        expect(tracker.checkAlarm(true, settings)).toBeNull();
    });

    it('fires immediately when requireTwoReadings=false', () => {
        const tracker = new GeofenceAlarmTracker();
        const noRequire = { ...settings, requireTwoReadings: false };
        expect(tracker.checkAlarm(false, noRequire)).toBe('LEFT_SITE');
    });

    it('reset clears state', () => {
        const tracker = new GeofenceAlarmTracker();
        tracker.checkAlarm(false, settings);
        tracker.reset();
        expect(tracker.consecutiveOOZ).toBe(0);
        expect(tracker.consecutiveIZ).toBe(0);
        expect(tracker.lastKnownStatus).toBeNull();
    });
});
