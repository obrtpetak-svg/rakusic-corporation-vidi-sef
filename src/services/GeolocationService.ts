// ═══════════════════════════════════════════════════════
// Geolocation Service — PWA-compatible GPS tracking
// Ping on open/resume + live while active
// Offline queue, battery-aware, smart throttle
// ═══════════════════════════════════════════════════════

import { isInGeofence, shouldSendLocation, GeofenceAlarmTracker } from './GeofenceEngine';
import { isTrackingAllowed, GPS_COL } from './GpsSettingsManager';
import type { GpsSettings } from './GpsSettingsManager';
import { NativeGps, isCapacitorNative } from './NativeBridge';

// ── Types ──────────────────────────────────────────────

interface GpsPosition {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
    source: string;
}

interface LiveDoc {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
    projectId: string | null;
    distanceFromSite: number | null;
    inGeofence: boolean;
    source: string;
    batteryLevel: number | null;
}

interface GpsError {
    type: string;
    message: string;
}

interface GpsEvent extends Record<string, unknown> {
    type: string;
    workerId: string | null;
    projectId: string | null;
    timestamp: string;
}

interface InitOptions {
    workerId: string;
    projectId: string | null;
    settings: GpsSettings;
    siteCoords: { lat: number; lng: number } | null;
    onLocationUpdate: ((doc: LiveDoc) => void) | null;
    onEvent: ((event: GpsEvent) => void) | null;
    onError: ((error: GpsError) => void) | null;
}

// ── Battery API type (not in default lib.dom) ──
interface BatteryManager extends EventTarget {
    level: number;
    charging: boolean;
}

let _instance: GeolocationService | null = null;

export class GeolocationService {
    workerId: string | null;
    projectId: string | null;
    settings: GpsSettings | null;
    siteCoords: { lat: number; lng: number } | null;
    watchId: number | null;
    _nativeWatch: unknown;
    lastSent: GpsPosition | null;
    alarmTracker: InstanceType<typeof GeofenceAlarmTracker>;
    offlineQueue: unknown[];
    batteryLevel: number | null;
    isCharging: boolean;
    _criticalPingInterval: ReturnType<typeof setInterval> | null;
    onLocationUpdate: ((doc: LiveDoc) => void) | null;
    onEvent: ((event: GpsEvent) => void) | null;
    onError: ((error: GpsError) => void) | null;
    _visibilityHandler: (() => void) | null;
    _focusHandler: (() => void) | null;
    _destroyed: boolean;

    constructor() {
        this.workerId = null;
        this.projectId = null;
        this.settings = null;
        this.siteCoords = null;
        this.watchId = null;
        this._nativeWatch = null;
        this.lastSent = null;
        this.alarmTracker = new GeofenceAlarmTracker();
        this.offlineQueue = [];
        this.batteryLevel = null;
        this.isCharging = false;
        this._criticalPingInterval = null;
        this.onLocationUpdate = null;
        this.onEvent = null;
        this.onError = null;
        this._visibilityHandler = null;
        this._focusHandler = null;
        this._destroyed = false;
    }

    static getInstance(): GeolocationService {
        if (!_instance) _instance = new GeolocationService();
        return _instance;
    }

    // ── Initialize ──
    init({ workerId, projectId, settings, siteCoords, onLocationUpdate, onEvent, onError }: InitOptions): void {
        this.workerId = workerId;
        this.projectId = projectId;
        this.settings = settings;
        this.siteCoords = siteCoords;
        this.onLocationUpdate = onLocationUpdate;
        this.onEvent = onEvent;
        this.onError = onError;
        this._destroyed = false;
        this.alarmTracker.reset();

        this._initBattery();

        this._visibilityHandler = () => {
            if (document.visibilityState === 'visible') this.ping('APP_RESUME');
        };
        this._focusHandler = () => this.ping('APP_RESUME');
        document.addEventListener('visibilitychange', this._visibilityHandler);
        window.addEventListener('focus', this._focusHandler);

        if (!isTrackingAllowed(settings)) return;

        const mode = settings.gpsMode;
        if (mode === 'PING_ON_OPEN' || mode === 'PING_PLUS_LIVE') {
            this.ping('APP_OPEN');
        }
        if (mode === 'LIVE_WHILE_OPEN' || mode === 'PING_PLUS_LIVE') {
            this.startLive();
        }
    }

    // ── Update settings (live reload) ──
    updateSettings(newSettings: GpsSettings, newSiteCoords?: { lat: number; lng: number } | null): void {
        const wasLive = this.watchId !== null;
        this.settings = newSettings;
        if (newSiteCoords) this.siteCoords = newSiteCoords;

        if (!isTrackingAllowed(newSettings)) {
            this.stopLive();
            return;
        }

        const mode = newSettings.gpsMode;
        const needsLive = mode === 'LIVE_WHILE_OPEN' || mode === 'PING_PLUS_LIVE';

        if (needsLive && !wasLive) this.startLive();
        if (!needsLive && wasLive) this.stopLive();
    }

    // ── Single ping ──
    ping(source = 'APP_OPEN'): void {
        if (this._destroyed || !this.settings) return;
        if (!isTrackingAllowed(this.settings)) return;

        if (isCapacitorNative()) {
            NativeGps.getCurrentPosition()
                .then((pos: GeolocationPosition) => this._processPosition(pos, source))
                .catch((err: GeolocationPositionError) => this._handleGeoError(err));
        } else {
            if (!navigator.geolocation) {
                this._emitError('GEOLOCATION_NOT_SUPPORTED');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => this._processPosition(pos, source),
                (err) => this._handleGeoError(err),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        }
    }

    // ── Start live tracking ──
    async startLive(): Promise<void> {
        if (this._destroyed || (this.watchId !== null || this._nativeWatch !== null)) return;

        if (isCapacitorNative()) {
            try {
                this._nativeWatch = await NativeGps.watchPosition(
                    (pos: GeolocationPosition) => this._processPosition(pos, 'LIVE'),
                    (err: GeolocationPositionError) => this._handleGeoError(err),
                    { timeout: 30000, maximumAge: 5000 }
                );
            } catch {
                console.warn('[GeolocationService] Native watch failed, falling back to web');
                this._startWebWatch();
            }
        } else {
            this._startWebWatch();
        }
    }

    _startWebWatch(): void {
        if (!navigator.geolocation) return;
        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this._processPosition(pos, 'LIVE'),
            (err) => this._handleGeoError(err),
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 5000,
            }
        );
    }

    // ── Stop live tracking ──
    async stopLive(): Promise<void> {
        if (this._nativeWatch) {
            await NativeGps.clearWatch(this._nativeWatch);
            this._nativeWatch = null;
        }
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    // ── Process incoming position ──
    _processPosition(pos: GeolocationPosition, source: string): void {
        if (this._destroyed) return;

        const newPos: GpsPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: new Date().toISOString(),
            source,
        };

        // Battery-aware: critical (<5%), low (<15%), normal
        if (this.batteryLevel !== null && !this.isCharging) {
            if (this.batteryLevel < 0.05 && source === 'LIVE') {
                return;
            }
            if (this.batteryLevel < 0.15 && source === 'LIVE') {
                const adjustedSettings: GpsSettings = {
                    ...this.settings!,
                    minInterval: Math.max(this.settings!.minInterval, 300),
                    distanceThreshold: Math.max(this.settings!.distanceThreshold, 100),
                };
                const decision = shouldSendLocation(newPos, this.lastSent, adjustedSettings);
                if (!decision.send) return;
            } else {
                const decision = shouldSendLocation(newPos, this.lastSent, this.settings!);
                if (!decision.send) {
                    if (decision.reason === 'accuracy_too_high') {
                        this._emitEvent('ACCURACY_TOO_HIGH', newPos);
                    }
                    return;
                }
            }
        } else {
            const decision = shouldSendLocation(newPos, this.lastSent, this.settings!);
            if (!decision.send) {
                if (decision.reason === 'accuracy_too_high') {
                    this._emitEvent('ACCURACY_TOO_HIGH', newPos);
                }
                return;
            }
        }

        // Geofence check
        let distanceFromSite: number | null = null;
        let inGeofence = false;
        if (this.siteCoords && this.settings!.geofenceEnabled) {
            const geo = isInGeofence(
                newPos.lat, newPos.lng,
                this.siteCoords.lat, this.siteCoords.lng,
                this.settings!.geofenceRadius
            );
            distanceFromSite = geo.distance;
            inGeofence = geo.inZone;

            const alarm = this.alarmTracker.checkAlarm(inGeofence, this.settings!);
            if (alarm) {
                this._emitEvent(alarm, { ...newPos, distanceFromSite });
            }
        }

        // Build live doc
        const liveDoc: LiveDoc = {
            lat: newPos.lat,
            lng: newPos.lng,
            accuracy: newPos.accuracy,
            timestamp: newPos.timestamp,
            projectId: this.projectId,
            distanceFromSite,
            inGeofence,
            source: newPos.source,
            batteryLevel: this.batteryLevel !== null ? Math.round(this.batteryLevel * 100) : null,
        };

        this.lastSent = newPos;

        if (this.onLocationUpdate) {
            this.onLocationUpdate(liveDoc);
        }
    }

    // ── Error handling ──
    _handleGeoError(err: GeolocationPositionError): void {
        const errorMap: Record<number, string> = {
            1: 'PERMISSION_DENIED',
            2: 'POSITION_UNAVAILABLE',
            3: 'TIMEOUT',
        };
        const type = errorMap[err.code] || 'UNKNOWN';
        this._emitEvent(type, { error: err.message });
        if (this.onError) this.onError({ type, message: err.message });
    }

    _emitError(type: string): void {
        if (this.onError) this.onError({ type, message: type });
    }

    _emitEvent(type: string, data: Record<string, unknown> = {}): void {
        if (this.onEvent) {
            this.onEvent({
                type,
                workerId: this.workerId,
                projectId: this.projectId,
                timestamp: new Date().toISOString(),
                ...data,
            });
        }
    }

    // ── Battery monitoring ──
    async _initBattery(): Promise<void> {
        try {
            const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
            if (nav.getBattery) {
                const battery = await nav.getBattery();
                this.batteryLevel = battery.level;
                this.isCharging = battery.charging;
                battery.addEventListener('levelchange', () => {
                    this.batteryLevel = battery.level;
                    this._checkBatteryMode();
                });
                battery.addEventListener('chargingchange', () => {
                    this.isCharging = battery.charging;
                    this._checkBatteryMode();
                });
            }
        } catch { /* Battery API not supported */ }
    }

    // ── Battery mode transitions ──
    _checkBatteryMode(): void {
        if (this._destroyed) return;
        if (this.isCharging || (this.batteryLevel !== null && this.batteryLevel >= 0.20)) {
            if (this._criticalPingInterval) {
                clearInterval(this._criticalPingInterval);
                this._criticalPingInterval = null;
                this._emitEvent('BATTERY_NORMAL', { batteryLevel: Math.round((this.batteryLevel ?? 0) * 100) });
                const mode = this.settings?.gpsMode;
                if ((mode === 'LIVE_WHILE_OPEN' || mode === 'PING_PLUS_LIVE') && this.watchId === null) {
                    this.startLive();
                }
            }
        } else if (this.batteryLevel !== null && this.batteryLevel < 0.05 && !this._criticalPingInterval) {
            this.stopLive();
            this._emitEvent('BATTERY_CRITICAL', { batteryLevel: Math.round(this.batteryLevel * 100) });
            this._criticalPingInterval = setInterval(() => this.ping('BATTERY_PING'), 300000);
        }
    }

    // ── Cleanup ──
    destroy(): void {
        this._destroyed = true;
        this.stopLive();
        if (this._criticalPingInterval) {
            clearInterval(this._criticalPingInterval);
            this._criticalPingInterval = null;
        }
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
        }
        if (this._focusHandler) {
            window.removeEventListener('focus', this._focusHandler);
        }
        this.alarmTracker.reset();
        this.lastSent = null;
        _instance = null;
    }
}
