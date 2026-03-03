// ═══════════════════════════════════════════════════════
// Fleet Vehicle Detail — Single vehicle deep dive
// Tabs: Live · Rute · Održavanje
// ═══════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import { C, styles } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

declare global { interface Window { L: any; } }

const STATUS_META: Record<string, { icon: string; label: string; color: string }> = {
    moving: { icon: '🟢', label: 'U vožnji', color: '#10B981' },
    idle: { icon: '🟡', label: 'Stoji (motor pali)', color: '#F59E0B' },
    stopped: { icon: '🔴', label: 'Zaustavljeno', color: '#EF4444' },
    offline: { icon: '⚫', label: 'Offline', color: '#6B7280' },
};

// Mock maintenance data (Firestore in future)
const MOCK_MAINTENANCE = [
    { id: 'm1', type: 'Servis', desc: 'Veliki servis — ulje, filteri, kočnice', date: '2026-02-15', km: 125400, cost: 890, status: 'done' },
    { id: 'm2', type: 'Gume', desc: 'Zamjena zimskih guma', date: '2026-03-01', km: 127200, cost: 1200, status: 'done' },
    { id: 'm3', type: 'Registracija', desc: 'Godišnja registracija + tehnički', date: '2026-06-15', km: null, cost: 450, status: 'upcoming' },
];

const MOCK_IGNITIONS = [
    { start: '2026-03-02T06:30:00Z', end: '2026-03-02T08:45:00Z', durationMin: 135 },
    { start: '2026-03-01T14:00:00Z', end: '2026-03-01T17:30:00Z', durationMin: 210 },
    { start: '2026-03-01T07:00:00Z', end: '2026-03-01T12:00:00Z', durationMin: 300 },
];

export default function FleetVehicleDetail({ vehicle, onBack }: {
    vehicle: FleetVehicle;
    onBack: () => void;
}) {
    const isMobile = useIsMobile();
    const [detailTab, setDetailTab] = useState<'live' | 'routes' | 'maintenance'>('live');
    const miniMapRef = useRef<HTMLDivElement>(null);
    const miniMapInstance = useRef<any>(null);
    const meta = STATUS_META[vehicle.status] || STATUS_META.offline;

    // ── Mini map ──
    useEffect(() => {
        if (!window.L || !miniMapRef.current || miniMapInstance.current) return;
        const L = window.L;
        const map = L.map(miniMapRef.current, { center: [vehicle.lat, vehicle.lng], zoom: 14, zoomControl: false, dragging: !isMobile });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        const color = meta.color;
        const icon = L.divIcon({
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;transform:rotate(${vehicle.heading}deg);">🚛</div>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });
        L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(map);
        miniMapInstance.current = map;
        return () => { map.remove(); miniMapInstance.current = null; };
    }, [vehicle.id]);

    // Update marker position
    useEffect(() => {
        if (miniMapInstance.current) {
            miniMapInstance.current.panTo([vehicle.lat, vehicle.lng], { animate: true, duration: 0.5 });
        }
    }, [vehicle.lat, vehicle.lng]);

    // ── Load ignitions from API ──
    const [ignitions, setIgnitions] = useState(MOCK_IGNITIONS);
    const [ignLoading, setIgnLoading] = useState(false);

    useEffect(() => {
        const from = new Date(Date.now() - 3 * 86400000).toISOString();
        const to = new Date().toISOString();
        setIgnLoading(true);

        (async () => {
            try {
                const fbAuth = (window as any).firebase?.auth?.();
                const user = fbAuth?.currentUser;
                const token = user ? await user.getIdToken() : null;
                if (!token) return;

                const r = await fetch(`/api/gps/ignitions?vehicleId=${vehicle.id}&from=${from}&to=${to}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await r.json();
                if (data.sessions?.length > 0) {
                    setIgnitions(data.sessions.map((s: any) => ({
                        start: s.start, end: s.end, durationMin: s.durationMin,
                    })));
                }
            } catch { /* keep mock data */ }
            finally { setIgnLoading(false); }
        })();
    }, [vehicle.id]);

    // ── Reverse geocoding for address ──
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(vehicle.address);

    useEffect(() => {
        if (vehicle.address) { setResolvedAddress(vehicle.address); return; }
        if (!vehicle.lat || !vehicle.lng || (vehicle.lat === 0 && vehicle.lng === 0)) {
            setResolvedAddress(null);
            return;
        }

        // Use Nominatim (OpenStreetMap) for reverse geocoding — free, no key needed
        const controller = new AbortController();
        fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${vehicle.lat}&lon=${vehicle.lng}&zoom=18&addressdetails=1&accept-language=hr`,
            { signal: controller.signal, headers: { 'User-Agent': 'RAKUSIC-Fleet/1.0' } }
        )
            .then(r => r.json())
            .then(data => {
                if (data?.display_name) {
                    // Shorten: take first 3 parts of the display name
                    const parts = data.display_name.split(', ');
                    const short = parts.slice(0, 3).join(', ');
                    setResolvedAddress(short);
                } else {
                    setResolvedAddress(`${vehicle.lat.toFixed(5)}, ${vehicle.lng.toFixed(5)}`);
                }
            })
            .catch(() => {
                setResolvedAddress(`${vehicle.lat.toFixed(5)}, ${vehicle.lng.toFixed(5)}`);
            });

        return () => controller.abort();
    }, [vehicle.id, vehicle.lat, vehicle.lng, vehicle.address]);

    const totalEngineHours = ignitions.reduce((sum, i) => sum + i.durationMin, 0);

    return (
        <div>
            {/* ── Back button + Header ── */}
            <button onClick={onBack} style={{ ...styles.btnSecondary, marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Natrag na listu
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Vehicle info card */}
                <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, borderLeft: `4px solid ${meta.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: `${meta.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚛</div>
                        <div className="u-flex-1">
                            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{vehicle.name}</div>
                            <div className="u-fs-13 u-text-muted">🔖 {vehicle.plate} · {vehicle.group || '—'}</div>
                        </div>
                        <div style={{ padding: '5px 12px', borderRadius: 8, background: `${meta.color}15`, color: meta.color, fontSize: 11, fontWeight: 700 }}>
                            {meta.icon} {meta.label}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                        <InfoRow icon="🏎️" label="Brzina" value={`${vehicle.speed} km/h`} />
                        <InfoRow icon="🧭" label="Smjer" value={`${vehicle.heading}°`} />
                        <InfoRow icon="👷" label="Vozač" value={vehicle.driverName || '—'} />
                        <InfoRow icon="🔑" label="Motor" value={vehicle.ignition ? '✅ Pali' : '❌ Ugašen'} />
                        <div style={{ gridColumn: '1 / -1' }}>
                            <InfoRow icon="📍" label="Lokacija" value={resolvedAddress || (vehicle.lat ? `${vehicle.lat.toFixed(5)}, ${vehicle.lng.toFixed(5)}` : 'Nepoznato')} />
                        </div>
                        {(vehicle as any).mileage && (
                            <InfoRow icon="🛣️" label="Kilometri" value={`${((vehicle as any).mileage).toLocaleString()} km`} />
                        )}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <InfoRow icon="⏱️" label="Zadnje ažuriranje" value={new Date(vehicle.lastUpdate).toLocaleString('hr')} />
                        </div>
                    </div>
                </div>

                {/* Mini map */}
                <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, minHeight: 250 }}>
                    <div ref={miniMapRef} style={{ width: '100%', height: '100%', minHeight: 250 }} />
                </div>
            </div>

            {/* ── Detail Tabs ── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                {([
                    { id: 'live' as const, label: '📡 Live', icon: '' },
                    { id: 'routes' as const, label: '📍 Rute', icon: '' },
                    { id: 'maintenance' as const, label: '🔧 Održavanje', icon: '' },
                ]).map(t => (
                    <button key={t.id} onClick={() => setDetailTab(t.id)} style={{
                        flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: detailTab === t.id ? 700 : 500,
                        background: detailTab === t.id ? 'var(--card)' : 'transparent',
                        color: detailTab === t.id ? C.text : C.textDim,
                        boxShadow: detailTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.2s',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* ── Live Tab ── */}
            {detailTab === 'live' && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
                    <StatMini icon="🏎️" label="Brzina" value={`${vehicle.speed}`} unit="km/h" color="#6366F1" />
                    <StatMini icon="⛽" label="Danas km" value="—" unit="km" color="#10B981" />
                    <StatMini icon="⏱️" label="Motor sati" value={`${Math.round(totalEngineHours / 60)}`} unit="h danas" color="#F59E0B" />
                    <StatMini icon="🛑" label="Zaustavljanja" value="—" unit="puta" color="#EF4444" />
                </div>
            )}

            {/* ── Routes Tab ── */}
            {detailTab === 'routes' && (
                <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                    <div className="u-section-title u-mb-12">📍 Povijest ruta</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                        Za detaljnu povijest ruta s replay animacijom, koristite tab <strong>📍 Rute</strong> na glavnom dashboardu.
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                        <input type="date" defaultValue={new Date(Date.now() - 86400000).toISOString().split('T')[0]} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                        <input type="date" defaultValue={new Date().toISOString().split('T')[0]} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13 }} />
                        <button style={{ ...styles.btn, fontSize: 12, padding: '8px 16px' }}>🔍 Prikaži rutu</button>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 30, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                        📍 Replay rute za {vehicle.name} — dostupno na Rute tabu s animacijom i timeline sliderom
                    </div>
                </div>
            )}

            {/* ── Maintenance Tab ── */}
            {detailTab === 'maintenance' && (
                <div>
                    {/* Engine hours */}
                    <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
                        <div className="u-section-title u-fs-13 u-mb-12 u-mb-12" style={{ marginBottom: 10 }}>🔑 Rad motora (zadnja 3 dana)</div>
                        <div style={{ display: 'grid', gap: 6 }}>
                            {ignLoading ? (
                                <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 12 }}>⏳ Učitavam podatke o radu motora...</div>
                            ) : ignitions.map((ig, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                                    <span style={{ color: C.text, fontWeight: 600 }}>
                                        {new Date(ig.start).toLocaleString('hr', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        {' → '}
                                        {new Date(ig.end).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span style={{ marginLeft: 'auto', color: C.textMuted, fontWeight: 600 }}>
                                        {Math.floor(ig.durationMin / 60)}h {ig.durationMin % 60}m
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                            Ukupno: <strong className="u-color-text">{Math.floor(totalEngineHours / 60)}h {totalEngineHours % 60}m</strong>
                        </div>
                    </div>

                    {/* Maintenance log */}
                    <div style={{ background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                        <div className="u-card-header">
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🔧 Evidencija održavanja</div>
                            <button style={{ ...styles.btn, fontSize: 11, padding: '6px 12px' }}>+ Dodaj</button>
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {MOCK_MAINTENANCE.map(m => (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: m.status === 'done' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                        fontSize: 16,
                                    }}>{m.status === 'done' ? '✅' : '📅'}</div>
                                    <div className="u-flex-1">
                                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.type}: {m.desc}</div>
                                        <div className="u-fs-11 u-text-muted">
                                            {m.date} {m.km ? `· ${m.km.toLocaleString()} km` : ''} · {m.cost}€
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                        background: m.status === 'done' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                        color: m.status === 'done' ? '#10B981' : '#F59E0B',
                                    }}>{m.status === 'done' ? 'Obavljeno' : 'Nadolazeće'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className="u-flex-center u-gap-8">
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span className="u-fs-12 u-text-muted">{label}:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{value}</span>
        </div>
    );
}

function StatMini({ icon, label, value, unit, color }: { icon: string; label: string; value: string; unit: string; color: string }) {
    return (
        <div style={{
            background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 16, textAlign: 'center',
        }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{unit}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{label}</div>
        </div>
    );
}
