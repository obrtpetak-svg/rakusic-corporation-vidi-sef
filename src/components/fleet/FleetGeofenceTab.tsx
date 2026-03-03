// ═══════════════════════════════════════════════════════
// Fleet Geofence Tab — CRUD zones + event log
// ═══════════════════════════════════════════════════════
import React, { useState } from 'react';
import { C, styles, genId } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

type Geofence = {
    id: string; name: string; type: 'circle' | 'polygon';
    lat: number; lng: number; radius: number;
    alertType: 'enter' | 'exit' | 'both'; active: boolean;
};

const MOCK_GEOFENCES: Geofence[] = [
    { id: 'g1', name: 'Skladište Zagreb', type: 'circle', lat: 45.815, lng: 15.982, radius: 300, alertType: 'both', active: true },
    { id: 'g2', name: 'Gradilište Split', type: 'circle', lat: 43.508, lng: 16.440, radius: 500, alertType: 'enter', active: true },
    { id: 'g3', name: 'Parkiralište Rijeka', type: 'circle', lat: 45.327, lng: 14.442, radius: 200, alertType: 'exit', active: false },
];

const MOCK_EVENTS = [
    { id: 'e1', type: 'GEOFENCE_ENTER', vehicleName: 'Iveco Daily 1', geofenceName: 'Skladište Zagreb', timestamp: '2026-03-02T07:30:00Z' },
    { id: 'e2', type: 'GEOFENCE_EXIT', vehicleName: 'MAN TGX 18', geofenceName: 'Gradilište Split', timestamp: '2026-03-02T06:45:00Z' },
    { id: 'e3', type: 'GEOFENCE_ENTER', vehicleName: 'Renault Master', geofenceName: 'Gradilište Split', timestamp: '2026-03-02T05:15:00Z' },
    { id: 'e4', type: 'SPEED_ALERT', vehicleName: 'Volvo FH16', geofenceName: null, timestamp: '2026-03-01T22:10:00Z' },
];

export default function FleetGeofenceTab({ vehicles }: { vehicles: FleetVehicle[] }) {
    const isMobile = useIsMobile();
    const [geofences, setGeofences] = useState(MOCK_GEOFENCES);
    const [showAdd, setShowAdd] = useState(false);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }} className="u-gap-16">
            {/* ── Geofence List ── */}
            <div>
                <div className="u-card-header">
                    <div className="u-section-title">🏗️ Geofence zone ({geofences.length})</div>
                    <button onClick={() => setShowAdd(true)} style={{ ...styles.btn, fontSize: 11, padding: '6px 12px' }}>+ Nova zona</button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                    {geofences.map(g => (
                        <div key={g.id} style={{
                            background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 12,
                            padding: 14, display: 'flex', alignItems: 'center', gap: 12,
                            opacity: g.active ? 1 : 0.5,
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: g.active ? 'rgba(99,102,241,0.12)' : 'rgba(107,114,128,0.12)', fontSize: 20,
                            }}>{g.type === 'circle' ? '⭕' : '🔷'}</div>
                            <div className="u-flex-1">
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{g.name}</div>
                                <div className="u-fs-11 u-text-muted">
                                    {g.type === 'circle' ? `Krug · ${g.radius}m` : 'Poligon'} · Alert: {g.alertType === 'both' ? 'ulaz+izlaz' : g.alertType === 'enter' ? 'ulaz' : 'izlaz'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setGeofences(prev => prev.map(x => x.id === g.id ? { ...x, active: !x.active } : x))}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'var(--bg)', fontSize: 12, cursor: 'pointer', color: C.text }}>
                                    {g.active ? '⏸' : '▶️'}
                                </button>
                                <button onClick={() => setGeofences(prev => prev.filter(x => x.id !== g.id))}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'var(--bg)', fontSize: 12, cursor: 'pointer', color: C.red }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add form placeholder */}
                {showAdd && (
                    <div style={{ marginTop: 12, background: 'var(--card)', border: `1px solid ${C.accent}`, borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📍 Nova geofence zona</div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            <input placeholder="Naziv zone" style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <input placeholder="Lat" type="number" step={0.001} style={{ padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 12 }} />
                                <input placeholder="Lng" type="number" step={0.001} style={{ padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 12 }} />
                                <input placeholder="Radius (m)" type="number" defaultValue={300} style={{ padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 12 }} />
                            </div>
                            <div className="u-flex-gap-8">
                                <button onClick={() => setShowAdd(false)} style={styles.btnSecondary}>Odustani</button>
                                <button onClick={() => { setShowAdd(false); setGeofences(prev => [...prev, { id: genId(), name: 'Nova zona', type: 'circle', lat: 45.8, lng: 15.98, radius: 300, alertType: 'both', active: true }]); }}
                                    style={styles.btn}>✅ Spremi</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Event Feed ── */}
            <div>
                <div className="u-section-title u-mb-12">📋 Události ({MOCK_EVENTS.length})</div>
                <div style={{ display: 'grid', gap: 6 }}>
                    {MOCK_EVENTS.map(e => (
                        <div key={e.id} style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16 }}>
                                {e.type === 'GEOFENCE_ENTER' ? '📥' : e.type === 'GEOFENCE_EXIT' ? '📤' : '⚡'}
                            </span>
                            <div className="u-flex-1">
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                                    {e.vehicleName} — {e.type === 'GEOFENCE_ENTER' ? 'Ulaz u zonu' : e.type === 'GEOFENCE_EXIT' ? 'Izlaz iz zone' : 'Prekoračenje brzine'}
                                </div>
                                <div className="u-fs-11 u-text-muted">
                                    {e.geofenceName || '—'} · {new Date(e.timestamp).toLocaleString('hr')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
