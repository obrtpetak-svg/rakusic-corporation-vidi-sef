// ═══════════════════════════════════════════════════════
// useGpsData — Custom hook for all GPS data fetching,
// computed values, RBAC filtering, and save operations
// Extracted from GpsAdminPanel for clean separation
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getDb } from '../context/firebaseCore';
import { onSnapshot, doc, collection, setDoc, query, orderBy, limit } from 'firebase/firestore';
import {
    GPS_COL, mergeSettings
} from '../services/GpsSettingsManager';
import { haversine } from '../services/GeofenceEngine';

export function useGpsData({ leaderProjectIds }: { leaderProjectIds?: string[] } = {}) {
    const ctx = useApp() as any;
    const { workers, projects, timesheets, currentUser, getWorkerName, getProjectName } = ctx;
    const isLeader = currentUser?.role === 'leader';

    // ── Raw state ──
    const [gpsSettings, setGpsSettings] = useState<Record<string, any>>({});
    const [projectGpsSettings, setProjectGpsSettings] = useState<any[]>([]);
    const [workerGpsSettings, setWorkerGpsSettings] = useState<any[]>([]);
    const [liveLocations, setLiveLocations] = useState<any[]>([]);
    const [gpsEvents, setGpsEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Firestore listeners (modular SDK) ──
    useEffect(() => {
        const db = getDb();
        if (!db) { setLoading(false); return; }

        const unsubs: (() => void)[] = [];
        let resolved = false;
        const markLoaded = () => { if (!resolved) { resolved = true; setLoading(false); } };

        // Safety timeout — never show spinner longer than 5s
        const timeout = setTimeout(markLoaded, 5000);

        const onError = (label: string) => (err: Error) => {
            console.warn(`[GPS] ${label} listener error:`, err.message);
            markLoaded(); // Resolve loading even on error
        };

        // Company settings
        unsubs.push(onSnapshot(
            doc(db, GPS_COL.settings, 'company'),
            (snap) => { setGpsSettings(snap.exists() ? snap.data() : {}); },
            onError('settings')
        ));

        // Project overrides
        unsubs.push(onSnapshot(
            collection(db, GPS_COL.projectSettings),
            (snap) => {
                const items: any[] = [];
                snap.forEach(d => items.push({ ...d.data(), id: d.id }));
                setProjectGpsSettings(items);
            },
            onError('projectSettings')
        ));

        // Worker overrides
        unsubs.push(onSnapshot(
            collection(db, GPS_COL.workerSettings),
            (snap) => {
                const items: any[] = [];
                snap.forEach(d => items.push({ ...d.data(), id: d.id }));
                setWorkerGpsSettings(items);
            },
            onError('workerSettings')
        ));

        // Live locations
        unsubs.push(onSnapshot(
            collection(db, GPS_COL.liveLocations),
            (snap) => {
                const items: any[] = [];
                snap.forEach(d => items.push({ ...d.data(), id: d.id }));
                setLiveLocations(items);
                markLoaded();
            },
            onError('liveLocations')
        ));

        // Events (last 200)
        unsubs.push(onSnapshot(
            query(collection(db, GPS_COL.events), orderBy('timestamp', 'desc'), limit(200)),
            (snap) => {
                const items: any[] = [];
                snap.forEach(d => items.push({ ...d.data(), id: d.id }));
                setGpsEvents(items);
            },
            onError('events')
        ));

        return () => { clearTimeout(timeout); unsubs.forEach(fn => fn()); };
    }, []);

    // ── Effective settings ──
    const effectiveCompanySettings = useMemo(() => mergeSettings(gpsSettings), [gpsSettings]);

    // ── Timesheet fallback locations ──
    const timesheetFallbackLocations = useMemo(() => {
        if (liveLocations.length > 0) return [];
        const locMap = new Map();
        const sorted = [...timesheets]
            .filter((t: any) => t.gpsLocation && typeof t.gpsLocation === 'string')
            .sort((a: any, b: any) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
        for (const t of sorted) {
            if (locMap.has((t as any).workerId)) continue;
            const parts = (t as any).gpsLocation.split(',').map((s: string) => s.trim());
            if (parts.length !== 2) continue;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) continue;
            const proj = projects.find((p: any) => p.id === (t as any).projectId);
            let distanceFromSite: number | null = null;
            let inGeofence: boolean | null = null;
            if (proj?.siteLat && proj?.siteLng) {
                const dist = haversine(lat, lng, proj.siteLat, proj.siteLng);
                distanceFromSite = Math.round(dist);
                inGeofence = dist <= (effectiveCompanySettings.geofenceRadius || 300);
            }
            locMap.set((t as any).workerId, {
                id: (t as any).workerId, lat, lng, accuracy: null,
                timestamp: (t as any).createdAt || (t as any).date, projectId: (t as any).projectId,
                source: 'TIMESHEET', distanceFromSite, inGeofence,
                batteryLevel: null, workerName: (t as any).createdBy || null,
            });
        }
        return [...locMap.values()];
    }, [timesheets, liveLocations, projects, effectiveCompanySettings]);

    // ── Merged locations ──
    const effectiveLocations = useMemo(() => {
        return liveLocations.length > 0 ? liveLocations : timesheetFallbackLocations;
    }, [liveLocations, timesheetFallbackLocations]);

    // ── RBAC: Project filter for leaders ──
    const filteredProjects = useMemo(() => {
        if (isLeader && leaderProjectIds?.length) {
            return projects.filter((p: any) => leaderProjectIds.includes(p.id));
        }
        return projects;
    }, [projects, isLeader, leaderProjectIds]);

    const filteredWorkerIds = useMemo(() => {
        if (isLeader && leaderProjectIds?.length) {
            const ids = new Set<string>();
            filteredProjects.forEach((p: any) => (p.workers || []).forEach((wId: string) => ids.add(wId)));
            return ids;
        }
        return null;
    }, [filteredProjects, isLeader, leaderProjectIds]);

    // ── Workers with locations ──
    const workersWithLocation = useMemo(() => {
        const workerList = filteredWorkerIds
            ? workers.filter((w: any) => filteredWorkerIds.has(w.id))
            : workers;

        return workerList.map((w: any) => {
            const loc = effectiveLocations.find((l: any) => l.id === w.id);
            return { ...w, location: loc || null };
        }).sort((a: any, b: any) => {
            if (a.location && !b.location) return -1;
            if (!a.location && b.location) return 1;
            if (a.location && b.location) {
                return (a.location.distanceFromSite || 0) - (b.location.distanceFromSite || 0);
            }
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [workers, effectiveLocations, filteredWorkerIds]);

    // ── Stats ──
    const stats = useMemo(() => {
        const withLoc = workersWithLocation.filter((w: any) => w.location);
        const inZone = withLoc.filter((w: any) => w.location?.inGeofence);
        const outZone = withLoc.filter((w: any) => w.location && !w.location.inGeofence);
        const avgDist = withLoc.length > 0
            ? Math.round(withLoc.reduce((s: number, w: any) => s + (w.location?.distanceFromSite || 0), 0) / withLoc.length)
            : 0;
        return { total: workersWithLocation.length, active: withLoc.length, inZone: inZone.length, outZone: outZone.length, avgDist };
    }, [workersWithLocation]);

    // ── Save operations (modular SDK) ──
    const saveCompanySettings = useCallback(async (data: Record<string, any>) => {
        const db = getDb();
        if (!db) { console.warn('[GPS] No Firestore DB for save'); return; }
        await setDoc(doc(db, GPS_COL.settings, 'company'), data, { merge: true });
    }, []);

    const saveProjectSettings = useCallback(async (projectId: string, data: Record<string, any>) => {
        const db = getDb();
        if (!db) return;
        await setDoc(doc(db, GPS_COL.projectSettings, projectId), data, { merge: true });
    }, []);

    const saveWorkerSettings = useCallback(async (workerId: string, data: Record<string, any>) => {
        const db = getDb();
        if (!db) return;
        await setDoc(doc(db, GPS_COL.workerSettings, workerId), data, { merge: true });
    }, []);

    return {
        // Raw data
        workers, projects, timesheets, currentUser,
        getWorkerName, getProjectName,
        isLeader,
        isMobile: typeof window !== 'undefined' && window.innerWidth < 768,

        // GPS-specific data
        gpsSettings, projectGpsSettings, workerGpsSettings,
        liveLocations, gpsEvents, loading,
        effectiveCompanySettings,
        effectiveLocations,

        // Filtered/computed
        filteredProjects,
        workersWithLocation,
        stats,

        // Save operations
        saveCompanySettings,
        saveProjectSettings,
        saveWorkerSettings,
    };
}
