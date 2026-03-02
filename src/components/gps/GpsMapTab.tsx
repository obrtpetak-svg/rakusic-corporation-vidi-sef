// ═══════════════════════════════════════════════════════
// GPS Map Tab — Live map with Leaflet
// Worker markers + geofence circles + project filter
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { C, styles } from '../../utils/helpers';
import { formatDistance, timeAgo } from '../../services/GpsSettingsManager';
import { Icon } from '../ui/SharedComponents';

export default function GpsMapTab({ workers, projects, settings, isMobile }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const circlesRef = useRef({});
    const [selectedProject, setSelectedProject] = useState('');
    const [mapReady, setMapReady] = useState(false);

    // Load Leaflet CSS and JS
    useEffect(() => {
        if (window.L) { setMapReady(true); return; }
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => setMapReady(true);
        document.head.appendChild(script);
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapReady || !mapRef.current || mapInstanceRef.current) return;

        const L = window.L;
        const map = L.map(mapRef.current, {
            zoomControl: !isMobile,
            attributionControl: false,
        }).setView([45.815, 15.982], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        L.control.attribution({ prefix: false, position: 'bottomleft' })
            .addAttribution('© <a href="https://osm.org">OSM</a>')
            .addTo(map);

        mapInstanceRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, [mapReady, isMobile]);

    // Update markers + geofence circles
    useEffect(() => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        // Clear old markers
        Object.values(markersRef.current).forEach(m => map.removeLayer(m));
        markersRef.current = {};
        Object.values(circlesRef.current).forEach(c => map.removeLayer(c));
        circlesRef.current = {};

        const bounds = [];

        // Geofence circles for projects
        const projectsToShow = selectedProject
            ? projects.filter(p => p.id === selectedProject)
            : projects;

        projectsToShow.forEach(p => {
            if (p.siteLat && p.siteLng) {
                const circle = L.circle([p.siteLat, p.siteLng], {
                    radius: settings.geofenceRadius || 300,
                    color: '#D95D08',
                    fillColor: '#D95D0820',
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: '8 4',
                }).addTo(map);
                circle.bindPopup(`<b>${p.name}</b><br/>Geofence: ${settings.geofenceRadius || 300}m`);
                circlesRef.current[p.id] = circle;
                bounds.push([p.siteLat, p.siteLng]);

                // Site center marker
                const siteIcon = L.divIcon({
                    className: 'gps-site-marker',
                    html: `<div style="width:14px;height:14px;border-radius:50%;background:#D95D08;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                });
                L.marker([p.siteLat, p.siteLng], { icon: siteIcon }).addTo(map).bindPopup(`📍 ${p.name}`);
            }
        });

        // Worker markers
        const workersToShow = selectedProject
            ? workers.filter(w => {
                const proj = projects.find(p => p.id === selectedProject);
                return proj && (proj.workers || []).includes(w.id);
            })
            : workers;

        workersToShow.forEach(w => {
            if (!w.location?.lat || !w.location?.lng) return;
            const inZone = w.location.inGeofence;
            const isRecent = w.location.timestamp &&
                (Date.now() - new Date(w.location.timestamp).getTime()) < 30 * 60 * 1000;

            const color = !isRecent ? '#94A3B8' : inZone ? '#10B981' : '#EF4444';
            const pulseClass = isRecent ? 'gps-pulse' : '';

            const workerIcon = L.divIcon({
                className: `gps-worker-marker ${pulseClass}`,
                html: `
                    <div style="position:relative">
                        ${isRecent ? `<div class="gps-pulse-ring" style="border-color:${color}"></div>` : ''}
                        <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:700">
                            ${(w.name || '?')[0].toUpperCase()}
                        </div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });

            const marker = L.marker([w.location.lat, w.location.lng], { icon: workerIcon }).addTo(map);
            marker.bindPopup(`
                <b>${w.name}</b><br/>
                ${inZone ? '✅ U zoni' : '🚨 Izvan zone'}<br/>
                📏 ${formatDistance(w.location.distanceFromSite)}<br/>
                ⏱️ ${timeAgo(w.location.timestamp)}<br/>
                🎯 ±${w.location.accuracy}m
            `);
            markersRef.current[w.id] = marker;
            bounds.push([w.location.lat, w.location.lng]);
        });

        // Fit bounds
        if (bounds.length > 0) {
            try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 }); } catch { }
        }
    }, [workers, projects, selectedProject, settings, mapReady]);

    return (
        <div>
            {/* Project filter */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    style={{ ...styles.input, maxWidth: isMobile ? '100%' : 280 }}
                >
                    <option value="">Svi projekti</option>
                    {projects.filter(p => p.siteLat && p.siteLng).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                {projects.filter(p => !p.siteLat || !p.siteLng).length > 0 && (
                    <div style={{ fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ⚠️ {projects.filter(p => !p.siteLat || !p.siteLng).length} projekata bez GPS koordinata
                    </div>
                )}
            </div>

            {/* Map container */}
            <div style={{
                ...styles.card, padding: 0, overflow: 'hidden',
                borderRadius: 16, height: isMobile ? 400 : 520,
            }}>
                {!mapReady ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <div className="spinner" />
                    </div>
                ) : (
                    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 12, color: C.textMuted }}>
                <span>🟢 U zoni</span>
                <span>🔴 Izvan zone</span>
                <span>⚫ Neaktivan (&gt;30min)</span>
                <span>🟠 Geofence granica</span>
            </div>
        </div>
    );
}
