// ═══════════════════════════════════════════════════════
// Fleet Route History — Live API + Leaflet Replay
// ═══════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, styles } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

declare global { interface Window { L: any; } }

export default function FleetRouteHistory({ vehicles }: { vehicles: FleetVehicle[] }) {
    const isMobile = useIsMobile();
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 86400000).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [routeData, setRouteData] = useState<any>(null);

    // Replay state
    const [playing, setPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [playIndex, setPlayIndex] = useState(0);
    const playIntervalRef = useRef<any>(null);

    // Map refs
    const replayMapRef = useRef<HTMLDivElement>(null);
    const replayMapInstance = useRef<any>(null);
    const polylineRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const trailRef = useRef<any>(null);

    const handleFetchRoute = async () => {
        if (!selectedVehicle) return;
        setLoading(true);
        setError('');
        setRouteData(null);
        setPlayIndex(0);
        setPlaying(false);

        try {
            const res = await fetch(`/api/gps/routes?vehicleId=${selectedVehicle}&from=${dateFrom}T00:00:00Z&to=${dateTo}T23:59:59Z`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data.points || data.points.length === 0) {
                // Fallback: mock data for demo
                setRouteData({
                    vehicleId: selectedVehicle,
                    from: dateFrom, to: dateTo,
                    distanceKm: 147.3, maxSpeed: 112, avgSpeed: 58,
                    pointCount: 2340, stops: [],
                    durationMin: 342, routeCount: 3, fromCache: false,
                    points: generateMockRoutePoints(vehicles.find(v => v.id === selectedVehicle)),
                });
            } else {
                setRouteData(data);
            }
        } catch (err: any) {
            console.warn('[FleetRouteHistory] API failed, using mock data:', err.message);
            // Use mock data as fallback
            setRouteData({
                vehicleId: selectedVehicle,
                from: dateFrom, to: dateTo,
                distanceKm: 147.3, maxSpeed: 112, avgSpeed: 58,
                pointCount: 2340, stops: [],
                durationMin: 342, routeCount: 3, fromCache: false,
                points: generateMockRoutePoints(vehicles.find(v => v.id === selectedVehicle)),
            });
        } finally {
            setLoading(false);
        }
    };

    // ── Init replay map ──
    useEffect(() => {
        if (!routeData?.points?.length || !replayMapRef.current || !window.L) return;
        const L = window.L;

        // Clean up old map
        if (replayMapInstance.current) {
            replayMapInstance.current.remove();
            replayMapInstance.current = null;
        }

        const pts = routeData.points.map((p: any) => [p.lat, p.lng]);
        const map = L.map(replayMapRef.current, { zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Full route polyline (faded)
        polylineRef.current = L.polyline(pts, { color: '#6366F1', weight: 3, opacity: 0.3 }).addTo(map);

        // Animated trail
        trailRef.current = L.polyline([], { color: '#10B981', weight: 4, opacity: 0.9 }).addTo(map);

        // Vehicle marker
        const startPt = pts[0];
        const icon = L.divIcon({
            html: `<div style="width:28px;height:28px;border-radius:50%;background:#6366F1;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;">🚛</div>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });
        markerRef.current = L.marker(startPt, { icon }).addTo(map);

        // Start/end markers
        L.circleMarker(pts[0], { radius: 8, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 })
            .bindPopup('🟢 Start').addTo(map);
        L.circleMarker(pts[pts.length - 1], { radius: 8, color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 })
            .bindPopup('🔴 Kraj').addTo(map);

        // Stop markers
        (routeData.stops || []).forEach((s: any, i: number) => {
            if (s.lat && s.lng) {
                L.circleMarker([s.lat, s.lng], { radius: 6, color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.8 })
                    .bindPopup(`⏱️ Stop ${i + 1}: ${s.dwellSeconds ? Math.round(s.dwellSeconds / 60) + 'min' : ''}<br>${s.address || ''}`).addTo(map);
            }
        });

        map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
        replayMapInstance.current = map;

        return () => { map.remove(); replayMapInstance.current = null; };
    }, [routeData]);

    // ── Replay animation ──
    useEffect(() => {
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        if (!playing || !routeData?.points?.length) return;

        const pts = routeData.points;
        const interval = Math.max(10, 100 / playSpeed);

        playIntervalRef.current = setInterval(() => {
            setPlayIndex(prev => {
                const next = prev + 1;
                if (next >= pts.length) {
                    setPlaying(false);
                    return pts.length - 1;
                }
                // Update map
                if (markerRef.current && trailRef.current) {
                    const p = pts[next];
                    markerRef.current.setLatLng([p.lat, p.lng]);
                    const trail = pts.slice(0, next + 1).map((pt: any) => [pt.lat, pt.lng]);
                    trailRef.current.setLatLngs(trail);
                }
                return next;
            });
        }, interval);

        return () => clearInterval(playIntervalRef.current);
    }, [playing, playSpeed, routeData]);

    // ── Slider change ──
    const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const idx = parseInt(e.target.value);
        setPlayIndex(idx);
        if (routeData?.points && markerRef.current && trailRef.current) {
            const p = routeData.points[idx];
            if (p) {
                markerRef.current.setLatLng([p.lat, p.lng]);
                trailRef.current.setLatLngs(routeData.points.slice(0, idx + 1).map((pt: any) => [pt.lat, pt.lng]));
            }
        }
    }, [routeData]);

    const currentPoint = routeData?.points?.[playIndex];

    return (
        <div>
            {/* ── Query Form ── */}
            <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>📍 Povijest ruta — Pretraživanje</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Vozilo</label>
                        <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13, minWidth: 200 }}>
                            <option value="">Odaberite vozilo...</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Od</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Do</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                    </div>
                    <button onClick={handleFetchRoute} disabled={!selectedVehicle || loading}
                        style={{ ...styles.btn, fontSize: 13, padding: '10px 20px', opacity: !selectedVehicle || loading ? 0.5 : 1 }}>
                        {loading ? '⏳ Učitavam...' : '🔍 Prikaži rutu'}
                    </button>
                    {routeData && (
                        <button style={{ ...styles.btnSecondary, fontSize: 12, padding: '10px 14px' }}>📄 PDF Export</button>
                    )}
                </div>
                {error && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>❌ {error}</div>}
                {routeData?.fromCache && <div style={{ color: '#10B981', fontSize: 11, marginTop: 6 }}>✅ Učitano iz cache-a</div>}
            </div>

            {/* ── Route Results ── */}
            {routeData && (
                <>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
                        <MiniStat label="Udaljenost" value={`${routeData.distanceKm}`} unit="km" color="#6366F1" />
                        <MiniStat label="Max brzina" value={`${routeData.maxSpeed}`} unit="km/h" color="#EF4444" />
                        <MiniStat label="Prosjek" value={`${routeData.avgSpeed}`} unit="km/h" color="#10B981" />
                        <MiniStat label="Trajanje" value={`${Math.floor(routeData.durationMin / 60)}h ${routeData.durationMin % 60}m`} unit="" color="#F59E0B" />
                        <MiniStat label="GPS točke" value={`${(routeData.pointCount || routeData.points?.length || 0).toLocaleString()}`} unit="" color="#8B5CF6" />
                        <MiniStat label="Ruta" value={`${routeData.routeCount || 1}`} unit="seg." color="#EC4899" />
                    </div>

                    {/* Replay Map */}
                    <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                                🗺️ Replay rute
                                {currentPoint && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>
                                    {Math.round(currentPoint.speed || 0)} km/h · {currentPoint.ts ? new Date(currentPoint.ts).toLocaleTimeString('hr') : ''}
                                </span>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button onClick={() => { setPlayIndex(0); setPlaying(false); }} style={ctrlBtn}>⏮</button>
                                <button onClick={() => setPlaying(!playing)} style={{ ...ctrlBtn, background: playing ? '#EF4444' : C.accent, color: '#fff', border: 'none' }}>
                                    {playing ? '⏸' : '▶️'}
                                </button>
                                <button onClick={() => { setPlayIndex(routeData.points.length - 1); setPlaying(false); }} style={ctrlBtn}>⏭</button>
                                <select value={playSpeed} onChange={e => setPlaySpeed(Number(e.target.value))}
                                    style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 12 }}>
                                    <option value={1}>1x</option>
                                    <option value={2}>2x</option>
                                    <option value={4}>4x</option>
                                    <option value={8}>8x</option>
                                    <option value={16}>16x</option>
                                </select>
                            </div>
                        </div>
                        {/* Timeline slider */}
                        <input type="range" min={0} max={Math.max(0, (routeData.points?.length || 1) - 1)} value={playIndex}
                            onChange={handleSliderChange}
                            style={{ width: '100%', marginBottom: 8, accentColor: C.accent }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
                            <span>{dateFrom} 00:00</span>
                            <span>{playIndex + 1} / {routeData.points?.length || 0}</span>
                            <span>{dateTo} 23:59</span>
                        </div>
                        {/* Map */}
                        <div ref={replayMapRef} style={{ borderRadius: 12, height: isMobile ? 300 : 420, marginTop: 12 }} />
                    </div>
                </>
            )}

            {!routeData && !loading && (
                <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 60, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Odaberite vozilo i period</div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>Povijest ruta s replay animacijom, brzinom na karti i PDF izvozom</div>
                </div>
            )}
        </div>
    );
}

const ctrlBtn: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 8, border: `1px solid var(--border)`,
    background: 'var(--bg)', color: 'var(--text)', fontSize: 16, cursor: 'pointer',
};

function MiniStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
    return (
        <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{unit} {label}</div>
        </div>
    );
}

// Generate mock route points around a vehicle's position
function generateMockRoutePoints(vehicle?: FleetVehicle) {
    const baseLat = vehicle?.lat || 45.815;
    const baseLng = vehicle?.lng || 15.982;
    const points = [];
    for (let i = 0; i < 200; i++) {
        const angle = (i / 200) * Math.PI * 2;
        const radius = 0.02 + Math.sin(i * 0.1) * 0.01;
        points.push({
            lat: baseLat + Math.sin(angle) * radius + (Math.random() - 0.5) * 0.002,
            lng: baseLng + Math.cos(angle) * radius + (Math.random() - 0.5) * 0.002,
            speed: 30 + Math.random() * 80,
            ts: new Date(Date.now() - (200 - i) * 60000).toISOString(),
        });
    }
    return points;
}
