// ═══════════════════════════════════════════════════════
// GPS Settings Manager — 3-level override hierarchy
// Company → Project → Worker (last override wins)
// ═══════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────

export interface GpsSettings {
    enabled: boolean;
    gpsMode: 'OFF' | 'PING_ON_OPEN' | 'LIVE_WHILE_OPEN' | 'PING_PLUS_LIVE';
    distanceThreshold: number;
    minInterval: number;
    keepAlive: number;
    maxAccuracy: number;
    requireTwoReadings: boolean;
    trackingOnlyDuringShift: boolean;
    timeWindowEnabled: boolean;
    timeWindowStart: string;
    timeWindowEnd: string;
    geofenceEnabled: boolean;
    geofenceRadius: number;
    alertOnLeave: boolean;
    alertOnEnter: boolean;
    alertDebounce: number;
    [key: string]: unknown; // allow extra fields from Firestore
}

export interface GpsModeOption {
    value: GpsSettings['gpsMode'];
    label: string;
    desc: string;
}

export interface EventLabelEntry {
    label: string;
    icon: string;
    color: string;
}

// ── Defaults ───────────────────────────────────────────

export const GPS_DEFAULTS: GpsSettings = {
    enabled: false,
    gpsMode: 'OFF',
    distanceThreshold: 50,
    minInterval: 120,
    keepAlive: 1800,
    maxAccuracy: 80,
    requireTwoReadings: true,
    trackingOnlyDuringShift: true,
    timeWindowEnabled: false,
    timeWindowStart: '06:00',
    timeWindowEnd: '18:00',
    geofenceEnabled: false,
    geofenceRadius: 300,
    alertOnLeave: true,
    alertOnEnter: false,
    alertDebounce: 3,
};

export const GPS_MODE_OPTIONS: GpsModeOption[] = [
    { value: 'OFF', label: 'Isključeno', desc: 'GPS modul nije aktivan' },
    { value: 'PING_ON_OPEN', label: 'Ping na otvaranje', desc: 'Jednokratna lokacija kad radnik otvori app' },
    { value: 'LIVE_WHILE_OPEN', label: 'Praćenje dok je otvoreno', desc: 'Kontinuirano praćenje dok je app aktivna' },
    { value: 'PING_PLUS_LIVE', label: 'Ping + praćenje (preporučeno)', desc: 'Ping na otvaranje + praćenje dok je aktivna' },
];

export const DISTANCE_OPTIONS: number[] = [20, 30, 50, 100, 200, 500];
export const INTERVAL_OPTIONS: number[] = [60, 120, 300, 600, 900, 1800];
export const KEEPALIVE_OPTIONS: number[] = [600, 1800, 3600];
export const RADIUS_OPTIONS: number[] = [100, 200, 300, 500, 1000, 2000];
export const DEBOUNCE_OPTIONS: number[] = [2, 3, 5];

// ── Collection names ──
export const GPS_COL: Record<string, string> = {
    settings: 'gpsSettings',
    projectSettings: 'gpsProjectSettings',
    workerSettings: 'gpsWorkerSettings',
    liveLocations: 'gpsLiveLocations',
    events: 'gpsEvents',
};

// ── Merge settings: company → project → worker ──
export function mergeSettings(
    company: Partial<GpsSettings> = {},
    project: Partial<GpsSettings> = {},
    worker: Partial<GpsSettings> = {},
): GpsSettings {
    const result: GpsSettings = { ...GPS_DEFAULTS };
    for (const [k, v] of Object.entries(company)) {
        if (v !== undefined && v !== null && k !== 'id') (result as Record<string, unknown>)[k] = v;
    }
    for (const [k, v] of Object.entries(project)) {
        if (v !== undefined && v !== null && k !== 'id') (result as Record<string, unknown>)[k] = v;
    }
    for (const [k, v] of Object.entries(worker)) {
        if (v !== undefined && v !== null && k !== 'id') (result as Record<string, unknown>)[k] = v;
    }
    return result;
}

// ── Check if GPS should be active right now ──
export function isTrackingAllowed(settings: GpsSettings): boolean {
    if (!settings.enabled || settings.gpsMode === 'OFF') return false;

    if (settings.timeWindowEnabled) {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (hhmm < settings.timeWindowStart || hhmm > settings.timeWindowEnd) return false;
    }
    return true;
}

// ── Format settings for display ──
export function getOverrideSource(
    key: string,
    company: Record<string, unknown>,
    project: Record<string, unknown>,
    worker: Record<string, unknown>,
): 'worker' | 'project' | 'company' | 'default' {
    if (worker[key] !== undefined && worker[key] !== null) return 'worker';
    if (project[key] !== undefined && project[key] !== null) return 'project';
    if (company[key] !== undefined && company[key] !== null) return 'company';
    return 'default';
}

// ── Distance formatting ──
export function formatDistance(meters: number | null | undefined): string {
    if (meters == null) return '—';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}

// ── Time ago formatting ──
export function timeAgo(timestamp: string | null | undefined): string {
    if (!timestamp) return 'Nikad';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Upravo sad';
    if (mins < 60) return `prije ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `prije ${hours}h`;
    return `prije ${Math.floor(hours / 24)}d`;
}

// ── Event type labels ──
export const EVENT_LABELS: Record<string, EventLabelEntry> = {
    APP_OPEN: { label: 'App otvorena', icon: '📱', color: '#3B82F6' },
    APP_RESUME: { label: 'App nastavljena', icon: '🔄', color: '#8B5CF6' },
    LIVE_UPDATE: { label: 'Praćenje', icon: '📍', color: '#10B981' },
    LEFT_SITE: { label: 'Napustio gradilište', icon: '🚨', color: '#EF4444' },
    RETURNED_TO_SITE: { label: 'Vratio se na gradilište', icon: '✅', color: '#10B981' },
    SHIFT_START: { label: 'Početak smjene', icon: '🟢', color: '#059669' },
    SHIFT_END: { label: 'Kraj smjene', icon: '🔴', color: '#DC2626' },
    PERMISSION_DENIED: { label: 'Dozvola odbijena', icon: '🚫', color: '#F59E0B' },
    ACCURACY_TOO_HIGH: { label: 'Loša preciznost', icon: '⚠️', color: '#F97316' },
    GEOFENCE_ENTER: { label: 'Ušao u zonu', icon: '📥', color: '#06B6D4' },
    TIMESHEET: { label: 'Iz timesheeta', icon: '⏱️', color: '#6366F1' },
    MANUAL: { label: 'Ručni unos', icon: '✍️', color: '#78716C' },
};
