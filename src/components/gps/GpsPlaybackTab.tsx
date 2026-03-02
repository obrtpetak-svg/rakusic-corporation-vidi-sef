// ═══════════════════════════════════════════════════════
// GPS Playback Tab — Historical route replay on map
// Select worker + date → animated path with controls
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { C, styles } from '../../utils/helpers';
import { formatDistance, timeAgo, EVENT_LABELS } from '../../services/GpsSettingsManager';
import { haversine } from '../../services/GeofenceEngine';

const today = () => new Date().toISOString().slice(0, 10);

export default function GpsPlaybackTab({
    gpsEvents, timesheets, workers, projects,
    getWorkerName, getProjectName, isMobile
}) {
    const [selectedWorker, setSelectedWorker] = useState('');
    const [selectedDate, setSelectedDate] = useState(today());
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1); // 1x, 2x, 5x
    const [currentIdx, setCurrentIdx] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const pathRef = useRef(null);
    const markerRef = useRef(null);
    const circlesRef = useRef([]);
    const intervalRef = useRef(null);

    // ── Build timesheet-based points as fallback ──
    const timesheetPoints = useMemo(() => {
        if (!selectedWorker || !selectedDate) return [];
        return (timesheets || [])
            .filter(t => t.workerId === selectedWorker && t.date === selectedDate && t.gpsLocation)
            .map(t => {
                const parts = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
                if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
                const proj = projects.find(p => p.id === t.projectId);
                let distanceFromSite = null, inGeofence = null;
                if (proj?.siteLat && proj?.siteLng) {
                    distanceFromSite = Math.round(haversine(parts[0], parts[1], proj.siteLat, proj.siteLng));
                    inGeofence = distanceFromSite <= 300;
                }
                return {
                    lat: parts[0], lng: parts[1],
                    timestamp: t.createdAt || `${t.date}T${t.startTime || '07:00'}:00`,
                    type: 'TIMESHEET', workerId: t.workerId, projectId: t.projectId,
                    accuracy: null, distanceFromSite, inGeofence,
                    id: t.id,
                };
            })
            .filter(Boolean)
            .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }, [timesheets, selectedWorker, selectedDate, projects]);

    // ── Filter events for selected worker + date (with timesheet fallback) ──
    const routeEvents = useMemo(() => {
        if (!selectedWorker || !selectedDate) return [];
        const fromEvents = gpsEvents
            .filter(e => {
                const eDate = e.timestamp?.slice(0, 10) || '';
                return e.workerId === selectedWorker && eDate === selectedDate && e.lat && e.lng;
            })
            .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        // Use events if available, otherwise fall back to timesheet points
        return fromEvents.length > 0 ? fromEvents : timesheetPoints;
    }, [gpsEvents, selectedWorker, selectedDate, timesheetPoints]);

    // ── Available dates for selected worker (from events + timesheets) ──
    const availableDates = useMemo(() => {
        if (!selectedWorker) return [];
        const dates = new Set();
        gpsEvents
            .filter(e => e.workerId === selectedWorker && e.lat && e.lng)
            .forEach(e => { const d = e.timestamp?.slice(0, 10); if (d) dates.add(d); });
        (timesheets || [])
            .filter(t => t.workerId === selectedWorker && t.gpsLocation)
            .forEach(t => { if (t.date) dates.add(t.date); });
        return [...dates].sort().reverse();
    }, [gpsEvents, timesheets, selectedWorker]);

    // ── All workers (show everyone, not just those with GPS data) ──
    const workersWithData = useMemo(() => {
        return workers.filter(w => w.name);
    }, [workers]);

    // ── Load Leaflet ──
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

    // ── Init map ──
    useEffect(() => {
        if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
        const L = window.L;
        const map = L.map(mapRef.current, { zoomControl: !isMobile, attributionControl: false })
            .setView([45.815, 15.982], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution('© <a href="https://osm.org">OSM</a>').addTo(map);
        mapInstanceRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);
        return () => { map.remove(); mapInstanceRef.current = null; };
    }, [mapReady, isMobile]);

    // ── Draw route when data changes ──
    useEffect(() => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        // Clear old
        if (pathRef.current) { map.removeLayer(pathRef.current); pathRef.current = null; }
        if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
        circlesRef.current.forEach(c => map.removeLayer(c));
        circlesRef.current = [];

        if (routeEvents.length === 0) return;

        const latlngs = routeEvents.map(e => [e.lat, e.lng]);

        // Draw polyline
        pathRef.current = L.polyline(latlngs, {
            color: '#D95D08', weight: 3, opacity: 0.7,
            dashArray: '6 4',
        }).addTo(map);

        // Draw event dots
        routeEvents.forEach((e, i) => {
            const meta = EVENT_LABELS[e.type] || { color: '#6B7280', icon: '📍' };
            const isAlarm = e.type === 'LEFT_SITE';
            const dotColor = e.inGeofence === false ? '#EF4444' : e.inGeofence === true ? '#10B981' : meta.color;

            const dot = L.circleMarker([e.lat, e.lng], {
                radius: isAlarm ? 8 : 5,
                color: 'white', weight: 2,
                fillColor: dotColor,
                fillOpacity: 0.9,
            }).addTo(map);

            const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit' }) : '';
            dot.bindPopup(`
                <b>${meta.icon} ${EVENT_LABELS[e.type]?.label || e.type}</b><br/>
                ⏱️ ${time}<br/>
                🎯 ±${e.accuracy || '?'}m
                ${e.distanceFromSite != null ? `<br/>📏 ${formatDistance(e.distanceFromSite)}` : ''}
            `);

            circlesRef.current.push(dot);
        });

        // Add project geofences
        const projIds = new Set(routeEvents.map(e => e.projectId).filter(Boolean));
        projIds.forEach(pid => {
            const proj = projects.find(p => p.id === pid);
            if (proj?.siteLat && proj?.siteLng) {
                const circle = L.circle([proj.siteLat, proj.siteLng], {
                    radius: 300, color: '#D95D08', fillColor: '#D95D0820', fillOpacity: 0.15,
                    weight: 2, dashArray: '8 4',
                }).addTo(map);
                circle.bindPopup(`📍 ${proj.name}`);
                circlesRef.current.push(circle);
            }
        });

        // Fit bounds
        if (latlngs.length > 0) {
            try { map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 16 }); } catch { }
        }

        // Reset playback
        setCurrentIdx(0);
        setPlaying(false);

    }, [routeEvents, projects]);

    // ── Current position marker ──
    useEffect(() => {
        if (!mapInstanceRef.current || !window.L || routeEvents.length === 0) return;
        const L = window.L;
        const map = mapInstanceRef.current;
        const e = routeEvents[currentIdx];
        if (!e) return;

        if (markerRef.current) map.removeLayer(markerRef.current);

        const workerIcon = L.divIcon({
            className: 'gps-playback-marker',
            html: `<div style="width:22px;height:22px;border-radius:50%;background:#D95D08;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:800">▶</div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
        });

        markerRef.current = L.marker([e.lat, e.lng], { icon: workerIcon }).addTo(map);
        map.panTo([e.lat, e.lng], { animate: true });
    }, [currentIdx, routeEvents]);

    // ── Playback timer ──
    useEffect(() => {
        if (!playing) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        const delay = Math.max(100, 1000 / speed);
        intervalRef.current = setInterval(() => {
            setCurrentIdx(prev => {
                if (prev >= routeEvents.length - 1) {
                    setPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, delay);
        return () => clearInterval(intervalRef.current);
    }, [playing, speed, routeEvents.length]);

    // Current event data
    const currentEvent = routeEvents[currentIdx] || null;
    const currentMeta = currentEvent ? (EVENT_LABELS[currentEvent.type] || { label: currentEvent.type, icon: '📍', color: '#6B7280' }) : null;

    return (
        <div>
            {/* Controls */}
            <div style={{ ...styles.card, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {/* Worker select */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Radnik</div>
                        <select value={selectedWorker} onChange={e => { setSelectedWorker(e.target.value); setCurrentIdx(0); setPlaying(false); }}
                            style={styles.input}>
                            <option value="">— Odaberi radnika —</option>
                            {workersWithData.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    {/* Date select */}
                    <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Datum</div>
                        {availableDates.length > 0 ? (
                            <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setCurrentIdx(0); setPlaying(false); }}
                                style={styles.input}>
                                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        ) : (
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={styles.input} />
                        )}
                    </div>
                </div>
            </div>

            {routeEvents.length === 0 ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: 48, color: C.textMuted }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Povijest kretanja</div>
                    <div style={{ fontSize: 13 }}>
                        {!selectedWorker ? 'Odaberi radnika za prikaz povijesti kretanja' : 'Nema GPS podataka za odabrani datum'}
                    </div>
                </div>
            ) : (
                <>
                    {/* Map */}
                    <div style={{ ...styles.card, padding: 0, overflow: 'hidden', borderRadius: 16, height: isMobile ? 350 : 450, marginBottom: 16 }}>
                        {!mapReady ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <div className="spinner" />
                            </div>
                        ) : (
                            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                        )}
                    </div>

                    {/* Player Controls */}
                    <div style={{ ...styles.card, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Play/Pause */}
                            <button onClick={() => {
                                if (currentIdx >= routeEvents.length - 1) setCurrentIdx(0);
                                setPlaying(!playing);
                            }} style={{
                                width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #D95D08, #F97316)',
                                color: 'white', fontSize: 18,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(217,93,8,0.3)',
                            }}>
                                {playing ? '⏸' : '▶'}
                            </button>

                            {/* Stop */}
                            <button onClick={() => { setPlaying(false); setCurrentIdx(0); }} style={{
                                width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.border}`,
                                cursor: 'pointer', background: C.card, fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text,
                            }}>⏹</button>

                            {/* Slider */}
                            <div style={{ flex: 1, minWidth: 100 }}>
                                <input type="range" min={0} max={routeEvents.length - 1} value={currentIdx}
                                    onChange={e => { setCurrentIdx(+e.target.value); setPlaying(false); }}
                                    style={{ width: '100%', accentColor: '#D95D08', cursor: 'pointer' }}
                                />
                            </div>

                            {/* Speed toggle */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[1, 2, 5].map(s => (
                                    <button key={s} onClick={() => setSpeed(s)} style={{
                                        padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
                                        background: speed === s ? C.accentLight : 'transparent',
                                        color: speed === s ? C.accent : C.textMuted,
                                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    }}>{s}×</button>
                                ))}
                            </div>

                            {/* Counter */}
                            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {currentIdx + 1} / {routeEvents.length}
                            </div>
                        </div>

                        {/* Current event info */}
                        {currentEvent && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12, marginTop: 12,
                                padding: '10px 14px', borderRadius: 10,
                                background: `${currentMeta.color}08`,
                                border: `1px solid ${currentMeta.color}20`,
                            }}>
                                <div style={{ fontSize: 24 }}>{currentMeta.icon}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{currentMeta.label}</div>
                                    <div style={{ fontSize: 12, color: C.textMuted }}>
                                        {currentEvent.timestamp ? new Date(currentEvent.timestamp).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                                        {currentEvent.accuracy ? ` • ±${currentEvent.accuracy}m` : ''}
                                        {currentEvent.distanceFromSite != null ? ` • ${formatDistance(currentEvent.distanceFromSite)} od gradilišta` : ''}
                                    </div>
                                </div>
                                <div style={{
                                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                    background: currentEvent.inGeofence ? '#10B98120' : currentEvent.inGeofence === false ? '#EF444420' : `${C.border}30`,
                                    color: currentEvent.inGeofence ? '#059669' : currentEvent.inGeofence === false ? '#DC2626' : C.textMuted,
                                }}>
                                    {currentEvent.inGeofence ? '✅ U zoni' : currentEvent.inGeofence === false ? '🚨 Izvan' : '—'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timeline strip */}
                    <div style={styles.card}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                            📋 Kronologija ({routeEvents.length} točaka)
                        </div>
                        <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                            {routeEvents.map((e, i) => {
                                const meta = EVENT_LABELS[e.type] || { label: e.type, icon: '📍', color: '#6B7280' };
                                const isCurrent = i === currentIdx;
                                return (
                                    <div key={e.id || i}
                                        onClick={() => { setCurrentIdx(i); setPlaying(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                                            background: isCurrent ? `${C.accent}10` : 'transparent',
                                            borderLeft: isCurrent ? `3px solid ${C.accent}` : '3px solid transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <div style={{ fontSize: 14, width: 24, textAlign: 'center' }}>{meta.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? C.accent : C.text }}>
                                                {meta.label}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>
                                            {e.timestamp ? new Date(e.timestamp).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: e.inGeofence ? '#10B981' : e.inGeofence === false ? '#EF4444' : '#94A3B8',
                                        }} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
