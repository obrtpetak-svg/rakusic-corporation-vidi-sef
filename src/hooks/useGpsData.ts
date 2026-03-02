// ═══════════════════════════════════════════════════════
// useGpsData — Custom hook for all GPS data fetching,
// computed values, RBAC filtering, and save operations
// Extracted from GpsAdminPanel for clean separation
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
    GPS_COL, mergeSettings
} from '../services/GpsSettingsManager';
import { haversine } from '../services/GeofenceEngine';

export function useGpsData({ leaderProjectIds } = {}) {
    const ctx = useApp();
    const { workers, projects, timesheets, currentUser, getWorkerName, getProjectName } = ctx;
    const isLeader = currentUser?.role === 'leader';

    // ── Raw state ──
    const [gpsSettings, setGpsSettings] = useState({});
    const [projectGpsSettings, setProjectGpsSettings] = useState([]);
    const [workerGpsSettings, setWorkerGpsSettings] = useState([]);
    const [liveLocations, setLiveLocations] = useState([]);
    const [gpsEvents, setGpsEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const unsubsRef = useRef([]);

    // ── Firestore listeners ──
    useEffect(() => {
        const db = window.firebase?.firestore?.();
        if (!db) { setLoading(false); return; }

        const unsubs = [];
        let resolved = false;
        const markLoaded = () => { if (!resolved) { resolved = true; setLoading(false); } };

        // Safety timeout — never show spinner longer than 5s
        const timeout = setTimeout(markLoaded, 5000);

        const onError = (label) => (err) => {
            console.warn(`[GPS] ${label} listener error:`, err.message);
            markLoaded(); // Resolve loading even on error
        };

        // Company settings
        unsubs.push(db.collection(GPS_COL.settings).doc('company').onSnapshot(doc => {
            setGpsSettings(doc.exists ? doc.data() : {});
        }, onError('settings')));

        // Project overrides
        unsubs.push(db.collection(GPS_COL.projectSettings).onSnapshot(snap => {
            const items = [];
            snap.forEach(d => items.push({ ...d.data(), id: d.id }));
            setProjectGpsSettings(items);
        }, onError('projectSettings')));

        // Worker overrides
        unsubs.push(db.collection(GPS_COL.workerSettings).onSnapshot(snap => {
            const items = [];
            snap.forEach(d => items.push({ ...d.data(), id: d.id }));
            setWorkerGpsSettings(items);
        }, onError('workerSettings')));

        // Live locations
        unsubs.push(db.collection(GPS_COL.liveLocations).onSnapshot(snap => {
            const items = [];
            snap.forEach(d => items.push({ ...d.data(), id: d.id }));
            setLiveLocations(items);
            markLoaded();
        }, onError('liveLocations')));

        // Events (last 200)
        unsubs.push(db.collection(GPS_COL.events).orderBy('timestamp', 'desc').limit(200).onSnapshot(snap => {
            const items = [];
            snap.forEach(d => items.push({ ...d.data(), id: d.id }));
            setGpsEvents(items);
        }, onError('events')));

        unsubsRef.current = unsubs;
        return () => { clearTimeout(timeout); unsubs.forEach(fn => fn()); };
    }, []);

    // ── Effective settings ──
    const effectiveCompanySettings = useMemo(() => mergeSettings(gpsSettings), [gpsSettings]);

    // ── Timesheet fallback locations ──
    const timesheetFallbackLocations = useMemo(() => {
        if (liveLocations.length > 0) return [];
        const locMap = new Map();
        const sorted = [...timesheets]
            .filter(t => t.gpsLocation && typeof t.gpsLocation === 'string')
            .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
        for (const t of sorted) {
            if (locMap.has(t.workerId)) continue;
            const parts = t.gpsLocation.split(',').map(s => s.trim());
            if (parts.length !== 2) continue;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) continue;
            const proj = projects.find(p => p.id === t.projectId);
            let distanceFromSite = null;
            let inGeofence = null;
            if (proj?.siteLat && proj?.siteLng) {
                const dist = haversine(lat, lng, proj.siteLat, proj.siteLng);
                distanceFromSite = Math.round(dist);
                inGeofence = dist <= (effectiveCompanySettings.geofenceRadius || 300);
            }
            locMap.set(t.workerId, {
                id: t.workerId, lat, lng, accuracy: null,
                timestamp: t.createdAt || t.date, projectId: t.projectId,
                source: 'TIMESHEET', distanceFromSite, inGeofence,
                batteryLevel: null, workerName: t.createdBy || null,
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
            return projects.filter(p => leaderProjectIds.includes(p.id));
        }
        return projects;
    }, [projects, isLeader, leaderProjectIds]);

    const filteredWorkerIds = useMemo(() => {
        if (isLeader && leaderProjectIds?.length) {
            const ids = new Set();
            filteredProjects.forEach(p => (p.workers || []).forEach(wId => ids.add(wId)));
            return ids;
        }
        return null;
    }, [filteredProjects, isLeader, leaderProjectIds]);

    // ── Workers with locations ──
    const workersWithLocation = useMemo(() => {
        const workerList = filteredWorkerIds
            ? workers.filter(w => filteredWorkerIds.has(w.id))
            : workers;

        return workerList.map(w => {
            const loc = effectiveLocations.find(l => l.id === w.id);
            return { ...w, location: loc || null };
        }).sort((a, b) => {
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
        const withLoc = workersWithLocation.filter(w => w.location);
        const inZone = withLoc.filter(w => w.location?.inGeofence);
        const outZone = withLoc.filter(w => w.location && !w.location.inGeofence);
        const avgDist = withLoc.length > 0
            ? Math.round(withLoc.reduce((s, w) => s + (w.location?.distanceFromSite || 0), 0) / withLoc.length)
            : 0;
        return { total: workersWithLocation.length, active: withLoc.length, inZone: inZone.length, outZone: outZone.length, avgDist };
    }, [workersWithLocation]);

    // ── Save operations ──
    const saveCompanySettings = useCallback(async (data) => {
        const db = window.firebase?.firestore?.();
        if (!db) return;
        await db.collection(GPS_COL.settings).doc('company').set(data, { merge: true });
    }, []);

    const saveProjectSettings = useCallback(async (projectId, data) => {
        const db = window.firebase?.firestore?.();
        if (!db) return;
        await db.collection(GPS_COL.projectSettings).doc(projectId).set(data, { merge: true });
    }, []);

    const saveWorkerSettings = useCallback(async (workerId, data) => {
        const db = window.firebase?.firestore?.();
        if (!db) return;
        await db.collection(GPS_COL.workerSettings).doc(workerId).set(data, { merge: true });
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
