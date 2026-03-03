import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    GPS_DEFAULTS, GPS_MODE_OPTIONS, DISTANCE_OPTIONS, INTERVAL_OPTIONS,
    KEEPALIVE_OPTIONS, RADIUS_OPTIONS, DEBOUNCE_OPTIONS, GPS_COL, EVENT_LABELS,
    mergeSettings, isTrackingAllowed, getOverrideSource, formatDistance, timeAgo,
} from './GpsSettingsManager';

// ── GPS_DEFAULTS ──────────────────────────────────────
describe('GPS_DEFAULTS', () => {
    it('has expected default values', () => {
        expect(GPS_DEFAULTS.enabled).toBe(false);
        expect(GPS_DEFAULTS.gpsMode).toBe('OFF');
        expect(GPS_DEFAULTS.distanceThreshold).toBe(50);
        expect(GPS_DEFAULTS.minInterval).toBe(120);
        expect(GPS_DEFAULTS.keepAlive).toBe(1800);
        expect(GPS_DEFAULTS.maxAccuracy).toBe(80);
        expect(GPS_DEFAULTS.requireTwoReadings).toBe(true);
        expect(GPS_DEFAULTS.trackingOnlyDuringShift).toBe(true);
        expect(GPS_DEFAULTS.geofenceEnabled).toBe(false);
        expect(GPS_DEFAULTS.geofenceRadius).toBe(300);
    });
});

// ── OPTIONS arrays ────────────────────────────────────
describe('GPS option arrays', () => {
    it('GPS_MODE_OPTIONS has 4 entries', () => {
        expect(GPS_MODE_OPTIONS).toHaveLength(4);
        expect(GPS_MODE_OPTIONS.map(o => o.value)).toEqual(['OFF', 'PING_ON_OPEN', 'LIVE_WHILE_OPEN', 'PING_PLUS_LIVE']);
    });
    it('DISTANCE_OPTIONS is sorted ascending', () => {
        expect(DISTANCE_OPTIONS).toEqual([...DISTANCE_OPTIONS].sort((a, b) => a - b));
    });
    it('INTERVAL_OPTIONS is sorted ascending', () => {
        expect(INTERVAL_OPTIONS).toEqual([...INTERVAL_OPTIONS].sort((a, b) => a - b));
    });
    it('KEEPALIVE_OPTIONS has valid entries', () => {
        expect(KEEPALIVE_OPTIONS.length).toBeGreaterThan(0);
        KEEPALIVE_OPTIONS.forEach(v => expect(v).toBeGreaterThan(0));
    });
    it('RADIUS_OPTIONS has valid entries', () => {
        expect(RADIUS_OPTIONS.length).toBeGreaterThan(0);
    });
    it('DEBOUNCE_OPTIONS has valid entries', () => {
        expect(DEBOUNCE_OPTIONS.length).toBeGreaterThan(0);
    });
});

// ── GPS_COL ──────────────────────────────────────────
describe('GPS_COL', () => {
    it('has required collection names', () => {
        expect(GPS_COL.settings).toBe('gpsSettings');
        expect(GPS_COL.projectSettings).toBe('gpsProjectSettings');
        expect(GPS_COL.workerSettings).toBe('gpsWorkerSettings');
        expect(GPS_COL.liveLocations).toBe('gpsLiveLocations');
        expect(GPS_COL.events).toBe('gpsEvents');
    });
});

// ── mergeSettings ────────────────────────────────────
describe('mergeSettings', () => {
    it('returns defaults when no overrides', () => {
        const result = mergeSettings();
        expect(result).toEqual(GPS_DEFAULTS);
    });
    it('company settings override defaults', () => {
        const result = mergeSettings({ enabled: true, gpsMode: 'LIVE_WHILE_OPEN' });
        expect(result.enabled).toBe(true);
        expect(result.gpsMode).toBe('LIVE_WHILE_OPEN');
        expect(result.distanceThreshold).toBe(GPS_DEFAULTS.distanceThreshold);
    });
    it('project settings override company', () => {
        const result = mergeSettings({ distanceThreshold: 100 }, { distanceThreshold: 200 });
        expect(result.distanceThreshold).toBe(200);
    });
    it('worker settings override project', () => {
        const result = mergeSettings({ distanceThreshold: 100 }, { distanceThreshold: 200 }, { distanceThreshold: 300 });
        expect(result.distanceThreshold).toBe(300);
    });
    it('ignores null and undefined values', () => {
        const result = mergeSettings({ enabled: true }, { enabled: null }, { enabled: undefined });
        expect(result.enabled).toBe(true);
    });
    it('ignores id field', () => {
        const result = mergeSettings({ id: 'company-123', enabled: true });
        expect(result.enabled).toBe(true);
        expect(result).not.toHaveProperty('id');
    });
    it('cascades all three levels', () => {
        const result = mergeSettings(
            { enabled: true, gpsMode: 'PING_ON_OPEN', distanceThreshold: 100 },
            { gpsMode: 'LIVE_WHILE_OPEN', minInterval: 60 },
            { minInterval: 30, keepAlive: 600 }
        );
        expect(result.enabled).toBe(true); // company
        expect(result.gpsMode).toBe('LIVE_WHILE_OPEN'); // project override
        expect(result.distanceThreshold).toBe(100); // company (no override)
        expect(result.minInterval).toBe(30); // worker override
        expect(result.keepAlive).toBe(600); // worker override
    });
});

// ── isTrackingAllowed ────────────────────────────────
describe('isTrackingAllowed', () => {
    it('returns false when not enabled', () => {
        expect(isTrackingAllowed({ ...GPS_DEFAULTS, enabled: false })).toBe(false);
    });
    it('returns false when mode is OFF', () => {
        expect(isTrackingAllowed({ ...GPS_DEFAULTS, enabled: true, gpsMode: 'OFF' })).toBe(false);
    });
    it('returns true when enabled and mode is not OFF', () => {
        expect(isTrackingAllowed({ ...GPS_DEFAULTS, enabled: true, gpsMode: 'LIVE_WHILE_OPEN' })).toBe(true);
    });
    it('returns false when outside time window', () => {
        const settings = {
            ...GPS_DEFAULTS,
            enabled: true,
            gpsMode: 'LIVE_WHILE_OPEN',
            timeWindowEnabled: true,
            timeWindowStart: '23:00',
            timeWindowEnd: '23:01',
        };
        // Unless it happens to be exactly 23:00-23:01, this should be false
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (hhmm < '23:00' || hhmm > '23:01') {
            expect(isTrackingAllowed(settings)).toBe(false);
        }
    });
    it('returns true when inside time window', () => {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const settings = {
            ...GPS_DEFAULTS,
            enabled: true,
            gpsMode: 'PING_ON_OPEN',
            timeWindowEnabled: true,
            timeWindowStart: '00:00',
            timeWindowEnd: '23:59',
        };
        expect(isTrackingAllowed(settings)).toBe(true);
    });
});

// ── getOverrideSource ────────────────────────────────
describe('getOverrideSource', () => {
    it('returns "worker" when worker has the key', () => {
        expect(getOverrideSource('enabled', {}, {}, { enabled: true })).toBe('worker');
    });
    it('returns "project" when project has key but worker doesnt', () => {
        expect(getOverrideSource('enabled', {}, { enabled: true }, {})).toBe('project');
    });
    it('returns "company" when only company has key', () => {
        expect(getOverrideSource('enabled', { enabled: false }, {}, {})).toBe('company');
    });
    it('returns "default" when no level has key', () => {
        expect(getOverrideSource('enabled', {}, {}, {})).toBe('default');
    });
    it('worker takes precedence over project and company', () => {
        expect(getOverrideSource('enabled', { enabled: false }, { enabled: false }, { enabled: true })).toBe('worker');
    });
    it('ignores null values', () => {
        expect(getOverrideSource('enabled', { enabled: true }, { enabled: null }, { enabled: null })).toBe('company');
    });
});

// ── formatDistance ────────────────────────────────────
describe('formatDistance', () => {
    it('returns "—" for null', () => expect(formatDistance(null)).toBe('—'));
    it('returns "—" for undefined', () => expect(formatDistance(undefined)).toBe('—'));
    it('returns meters for < 1000', () => {
        expect(formatDistance(500)).toBe('500m');
        expect(formatDistance(0)).toBe('0m');
        expect(formatDistance(999)).toBe('999m');
    });
    it('returns km for >= 1000', () => {
        expect(formatDistance(1000)).toBe('1.0km');
        expect(formatDistance(1500)).toBe('1.5km');
        expect(formatDistance(10000)).toBe('10.0km');
    });
});

// ── timeAgo ──────────────────────────────────────────
describe('timeAgo', () => {
    it('returns "Nikad" for null/undefined', () => {
        expect(timeAgo(null)).toBe('Nikad');
        expect(timeAgo(undefined)).toBe('Nikad');
    });
    it('returns "Upravo sad" for less than 1 minute ago', () => {
        const now = new Date().toISOString();
        expect(timeAgo(now)).toBe('Upravo sad');
    });
    it('returns minutes for < 60 mins', () => {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
        expect(timeAgo(thirtyMinsAgo)).toMatch(/prije \d+ min/);
    });
    it('returns hours for < 24 hours', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
        expect(timeAgo(twoHoursAgo)).toMatch(/prije \d+h/);
    });
    it('returns days for >= 24 hours', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
        expect(timeAgo(threeDaysAgo)).toMatch(/prije \d+d/);
    });
});

// ── EVENT_LABELS ─────────────────────────────────────
describe('EVENT_LABELS', () => {
    it('has APP_OPEN event', () => {
        expect(EVENT_LABELS.APP_OPEN).toBeDefined();
        expect(EVENT_LABELS.APP_OPEN.label).toBe('App otvorena');
        expect(EVENT_LABELS.APP_OPEN.icon).toBe('📱');
    });
    it('has all expected event types', () => {
        const expectedKeys = ['APP_OPEN', 'APP_RESUME', 'LIVE_UPDATE', 'LEFT_SITE', 'RETURNED_TO_SITE', 'SHIFT_START', 'SHIFT_END', 'PERMISSION_DENIED', 'ACCURACY_TOO_HIGH', 'GEOFENCE_ENTER', 'TIMESHEET', 'MANUAL'];
        expectedKeys.forEach(key => {
            expect(EVENT_LABELS[key]).toBeDefined();
            expect(EVENT_LABELS[key].label).toBeTruthy();
            expect(EVENT_LABELS[key].icon).toBeTruthy();
            expect(EVENT_LABELS[key].color).toMatch(/^#/);
        });
    });
    it('has correct color format for all events', () => {
        Object.values(EVENT_LABELS).forEach(e => {
            expect(e.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
    });
});
