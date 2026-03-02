// ═══════════════════════════════════════════════════════
// Fleet Route History — Replay + Timeline
// ═══════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { C, styles } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

export default function FleetRouteHistory({ vehicles }: { vehicles: FleetVehicle[] }) {
    const isMobile = useIsMobile();
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [dateFrom, setDateFrom] = useState('2026-03-01');
    const [dateTo, setDateTo] = useState('2026-03-02');
    const [loading, setLoading] = useState(false);
    const [routeData, setRouteData] = useState<any>(null);

    const handleFetchRoute = async () => {
        if (!selectedVehicle) return;
        setLoading(true);
        // Sprint 2: call /api/gps/routes?vehicleId=X&from=Y&to=Z
        // For now simulate loading
        await new Promise(r => setTimeout(r, 1500));
        setRouteData({
            vehicleId: selectedVehicle,
            from: dateFrom, to: dateTo,
            distanceKm: 147.3, maxSpeed: 112, avgSpeed: 58,
            points: 2340, stops: 5, durationMin: 342,
        });
        setLoading(false);
    };

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
                        <MiniStat label="GPS točke" value={`${routeData.points.toLocaleString()}`} unit="" color="#8B5CF6" />
                        <MiniStat label="Zaustavljanja" value={`${routeData.stops}`} unit="" color="#EC4899" />
                    </div>

                    {/* Map placeholder (Sprint 2: polyline + animation) */}
                    <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🗺️ Replay rute</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 16, cursor: 'pointer' }}>⏮</button>
                                <button style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 16, cursor: 'pointer' }}>▶️</button>
                                <button style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 16, cursor: 'pointer' }}>⏭</button>
                                <select style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 12 }}>
                                    <option>1x</option><option>2x</option><option>4x</option><option>8x</option>
                                </select>
                            </div>
                        </div>
                        {/* Timeline slider */}
                        <input type="range" min={0} max={100} defaultValue={0}
                            style={{ width: '100%', marginBottom: 8, accentColor: C.accent }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
                            <span>{dateFrom} 00:00</span>
                            <span>{dateTo} 23:59</span>
                        </div>
                        {/* Map area */}
                        <div style={{ background: 'var(--bg)', borderRadius: 12, height: 350, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>
                            🗺️ Replay mapa s rutom — Sprint 2: Leaflet polyline + marker animacija
                        </div>
                    </div>
                </>
            )}

            {!routeData && !loading && (
                <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 60, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Odaberite vozilo i period</div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>Povijest ruta će se prikazati s replay animacijom, statistikama i mogućnošću PDF izvoza</div>
                </div>
            )}
        </div>
    );
}

function MiniStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
    return (
        <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{unit} {label}</div>
        </div>
    );
}
