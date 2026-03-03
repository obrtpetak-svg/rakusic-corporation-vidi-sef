import { describe, it, expect, beforeEach } from 'vitest';
import { haversine, isInGeofence, shouldSendLocation, GeofenceAlarmTracker } from './GeofenceEngine';

describe('haversine', () => {
    it('returns 0 for same point', () => {
        expect(haversine(45.8, 15.97, 45.8, 15.97)).toBe(0);
    });

    it('calculates short distance correctly', () => {
        // Zagreb center to Ban Jelačić (~100m)
        const d = haversine(45.8131, 15.9772, 45.8141, 15.9772);
        expect(d).toBeGreaterThan(90);
        expect(d).toBeLessThan(120);
    });

    it('calculates Zagreb-Split (~300km)', () => {
        const d = haversine(45.815, 15.966, 43.508, 16.44);
        expect(d).toBeGreaterThan(250000);
        expect(d).toBeLessThan(270000);
    });

    it('returns positive for any two points', () => {
        expect(haversine(0, 0, 1, 1)).toBeGreaterThan(0);
    });

    it('handles negative coordinates', () => {
        const d = haversine(-33.87, 151.21, -33.86, 151.21);
        expect(d).toBeGreaterThan(0);
    });

    it('is symmetric (a→b == b→a)', () => {
        const d1 = haversine(45.8, 15.97, 43.5, 16.44);
        const d2 = haversine(43.5, 16.44, 45.8, 15.97);
        expect(Math.abs(d1 - d2)).toBeLessThan(0.01);
    });
});

describe('isInGeofence', () => {
    it('returns inZone=true for same point', () => {
        const result = isInGeofence(45.8, 15.97, 45.8, 15.97, 100);
        expect(result.inZone).toBe(true);
        expect(result.distance).toBe(0);
    });

    it('returns inZone=true within radius', () => {
        // ~110m apart, radius 200m
        const result = isInGeofence(45.8131, 15.9772, 45.8141, 15.9772, 200);
        expect(result.inZone).toBe(true);
    });

    it('returns inZone=false outside radius', () => {
        // ~110m apart, radius 50m
        const result = isInGeofence(45.8131, 15.9772, 45.8141, 15.9772, 50);
        expect(result.inZone).toBe(false);
    });

    it('returns inZone=false for null coords', () => {
        expect(isInGeofence(null, null, 45.8, 15.97, 100).inZone).toBe(false);
    });

    it('returns distance=null for null coords', () => {
        expect(isInGeofence(45.8, 15.97, null, null, 100).distance).toBe(null);
    });

    it('returns rounded distance', () => {
        const result = isInGeofence(45.8131, 15.9772, 45.8141, 15.9772, 500);
        expect(Number.isInteger(result.distance)).toBe(true);
    });
});

describe('shouldSendLocation', () => {
    const settings = {
        maxAccuracy: 50,
        keepAlive: 300,
        distanceThreshold: 20,
        minInterval: 15,
    };

    it('always sends for APP_OPEN event', () => {
        const result = shouldSendLocation({ lat: 45.8, lng: 15.97, source: 'APP_OPEN', accuracy: 10 }, null, settings);
        expect(result.send).toBe(true);
        expect(result.reason).toBe('event');
    });

    it('always sends for SHIFT_START event', () => {
        const result = shouldSendLocation({ lat: 45.8, lng: 15.97, source: 'SHIFT_START', accuracy: 10 }, null, settings);
        expect(result.send).toBe(true);
        expect(result.reason).toBe('event');
    });

    it('rejects bad accuracy', () => {
        const result = shouldSendLocation({ lat: 45.8, lng: 15.97, source: 'GPS', accuracy: 100 }, null, settings);
        expect(result.send).toBe(false);
        expect(result.reason).toBe('accuracy_too_high');
    });

    it('sends first location', () => {
        const result = shouldSendLocation({ lat: 45.8, lng: 15.97, source: 'GPS', accuracy: 10 }, null, settings);
        expect(result.send).toBe(true);
        expect(result.reason).toBe('first');
    });

    it('throttles when too close and too soon', () => {
        const lastSent = { lat: 45.8, lng: 15.97, timestamp: new Date().toISOString() };
        const result = shouldSendLocation({ lat: 45.8, lng: 15.97, source: 'GPS', accuracy: 10 }, lastSent, settings);
        expect(result.send).toBe(false);
        expect(result.reason).toBe('throttled');
    });
});

describe('GeofenceAlarmTracker', () => {
    let tracker: any;
    const settings = {
        requireTwoReadings: true,
        alertDebounce: 0, // 0 min for testing
        alertOnEnter: true,
        alertOnLeave: true,
    };

    beforeEach(() => {
        tracker = new GeofenceAlarmTracker();
    });

    it('starts with null status', () => {
        expect(tracker.lastKnownStatus).toBe(null);
    });

    it('sets status to OUT_OF_ZONE after leaving', () => {
        tracker.checkAlarm(false, settings);
        tracker.checkAlarm(false, settings); // 2nd reading confirms
        expect(tracker.lastKnownStatus).toBe('OUT_OF_ZONE');
    });

    it('returns LEFT_SITE alarm on confirmed leave', () => {
        // First set to IN_ZONE
        tracker.lastKnownStatus = 'IN_ZONE';
        tracker.checkAlarm(false, settings); // 1st reading
        const result = tracker.checkAlarm(false, settings); // 2nd reading confirms
        expect(result).toBe('LEFT_SITE');
    });

    it('returns RETURNED_TO_SITE on confirmed return', () => {
        tracker.lastKnownStatus = 'OUT_OF_ZONE';
        tracker.checkAlarm(true, settings); // 1st reading
        const result = tracker.checkAlarm(true, settings); // 2nd reading confirms
        expect(result).toBe('RETURNED_TO_SITE');
    });

    it('does not alarm with single reading when requireTwoReadings=true', () => {
        tracker.lastKnownStatus = 'IN_ZONE';
        const result = tracker.checkAlarm(false, settings);
        expect(result).toBe(null);
    });

    it('alarms immediately when requireTwoReadings=false', () => {
        tracker.lastKnownStatus = 'IN_ZONE';
        const result = tracker.checkAlarm(false, { ...settings, requireTwoReadings: false });
        expect(result).toBe('LEFT_SITE');
    });

    it('reset clears all state', () => {
        tracker.lastKnownStatus = 'IN_ZONE';
        tracker.consecutiveOOZ = 5;
        tracker.reset();
        expect(tracker.lastKnownStatus).toBe(null);
        expect(tracker.consecutiveOOZ).toBe(0);
        expect(tracker.lastAlarmTime).toBe(0);
    });

    it('does not alarm when alertOnLeave=false', () => {
        tracker.lastKnownStatus = 'IN_ZONE';
        const result = tracker.checkAlarm(false, { ...settings, requireTwoReadings: false, alertOnLeave: false });
        expect(result).toBe(null);
    });
});
