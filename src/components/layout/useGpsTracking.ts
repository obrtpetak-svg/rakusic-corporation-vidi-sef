// ═══════════════════════════════════════════════════════
// useGpsTracking — Background GPS tracking for workers/leaders
// Extracted from Layout.tsx for maintainability
// ═══════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { GeolocationService } from '../../services/GeolocationService';
import { writeGpsLocation, writeGpsEvent } from '../../services/GpsDataWriter';
import { GPS_DEFAULTS } from '../../services/GpsSettingsManager';

interface GpsTrackingInput {
    currentUser: any;
    isAdmin: boolean;
    userId: string | null;
    projects: any[];
    getDb: () => any;
}

export function useGpsTracking({ currentUser, isAdmin, userId, projects, getDb }: GpsTrackingInput) {
    const gpsServiceRef = useRef<any>(null);

    useEffect(() => {
        if (!currentUser || isAdmin || !userId) return;

        // Load GPS settings from Firestore (or use defaults)
        const db = getDb();
        if (!db) return;

        let destroyed = false;

        getDoc(doc(db, 'gpsSettings', 'company')).then(snap => {
            if (destroyed) return;
            const settings = snap.exists() ? { ...GPS_DEFAULTS, ...snap.data() } : { ...GPS_DEFAULTS, enabled: true, gpsMode: 'PING_ON_OPEN' };

            // Find the worker's current project for geofence
            const workerProjects = projects.filter(p => (p.workers || []).includes(userId) && p.status === 'aktivan');
            const activeProject = workerProjects[0];
            const siteCoords = (activeProject?.siteLat && activeProject?.siteLng)
                ? { lat: activeProject.siteLat, lng: activeProject.siteLng } : null;

            const service = GeolocationService.getInstance();
            gpsServiceRef.current = service;

            service.init({
                workerId: userId,
                projectId: activeProject?.id || null,
                settings: { ...settings, enabled: true, gpsMode: settings.gpsMode || 'PING_ON_OPEN', minInterval: settings.minInterval || 10 },
                siteCoords,
                onLocationUpdate: (liveDoc) => {
                    writeGpsLocation({
                        workerId: userId,
                        workerName: currentUser?.name || null,
                        projectId: liveDoc.projectId,
                        lat: liveDoc.lat,
                        lng: liveDoc.lng,
                        accuracy: liveDoc.accuracy,
                        source: liveDoc.source || 'LIVE_UPDATE',
                        siteCoords,
                        geofenceRadius: settings.geofenceRadius || 300,
                        batteryLevel: liveDoc.batteryLevel,
                    }).catch(err => console.warn('[GPS Background] Write failed:', err));
                },
                onEvent: (event) => {
                    writeGpsEvent({
                        type: event.type,
                        workerId: userId,
                        workerName: currentUser?.name || null,
                        projectId: event.projectId,
                        lat: event.lat,
                        lng: event.lng,
                        accuracy: event.accuracy,
                    }).catch(err => console.warn('[GPS Event] Write failed:', err));
                },
                onError: (err) => {
                    console.warn('[GPS] Error:', err.type, err.message);
                },
            });
        }).catch(err => console.warn('[GPS] Failed to load settings:', err));

        return () => {
            destroyed = true;
            if (gpsServiceRef.current) {
                gpsServiceRef.current.destroy();
                gpsServiceRef.current = null;
            }
        };
    }, [currentUser, userId, isAdmin, projects]);

    return gpsServiceRef;
}
