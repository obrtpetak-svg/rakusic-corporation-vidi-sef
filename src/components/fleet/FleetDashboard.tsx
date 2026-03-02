// ═══════════════════════════════════════════════════════
// GPS Vozila — Fleet Dashboard (Orchestrator)
// Enterprise GPS Fleet tracking with Mapon FMLC integration
// ═══════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useIsMobile } from '../ui/SharedComponents';
import { C, styles } from '../../utils/helpers';
import FleetMapTab from './FleetMapTab';
import FleetVehicleList from './FleetVehicleList';
import FleetVehicleDetail from './FleetVehicleDetail';
import FleetRouteHistory from './FleetRouteHistory';
import FleetGeofenceTab from './FleetGeofenceTab';
import FleetReportTab from './FleetReportTab';

// ── Mock data for Sprint 1 (replaced by Firestore onSnapshot in Sprint 2) ──
const MOCK_VEHICLES = {
    'u001': { id: 'u001', name: 'Iveco Daily 1', plate: 'ZG-1234-AB', lat: 45.815, lng: 15.982, speed: 47, heading: 120, ignition: true, status: 'moving' as const, address: 'Ilica 242, Zagreb', driverName: 'Ivan Horvat', lastUpdate: new Date().toISOString(), group: 'Dostava' },
    'u002': { id: 'u002', name: 'MAN TGX 18', plate: 'ZG-5678-CD', lat: 45.801, lng: 15.971, speed: 0, heading: 45, ignition: true, status: 'idle' as const, address: 'Vukovarska 58, Zagreb', driverName: 'Marko Jurić', lastUpdate: new Date(Date.now() - 300000).toISOString(), group: 'Teretna' },
    'u003': { id: 'u003', name: 'Renault Master', plate: 'ST-9012-EF', lat: 43.508, lng: 16.440, speed: 62, heading: 200, ignition: true, status: 'moving' as const, address: 'Put Firula 12, Split', driverName: 'Ante Kovačević', lastUpdate: new Date().toISOString(), group: 'Dostava' },
    'u004': { id: 'u004', name: 'Mercedes Sprinter', plate: 'ZG-3456-GH', lat: 45.833, lng: 16.012, speed: 0, heading: 0, ignition: false, status: 'stopped' as const, address: 'Samoborska 21, Zagreb', driverName: null, lastUpdate: new Date(Date.now() - 3600000).toISOString(), group: 'Dostava' },
    'u005': { id: 'u005', name: 'Volvo FH16', plate: 'RI-7890-IJ', lat: 45.327, lng: 14.442, speed: 81, heading: 300, ignition: true, status: 'moving' as const, address: 'A7 Rijeka-Zagreb', driverName: 'Petar Novak', lastUpdate: new Date().toISOString(), group: 'Teretna' },
    'u006': { id: 'u006', name: 'Ford Transit', plate: 'ZG-1122-KL', lat: 45.790, lng: 15.950, speed: 0, heading: 90, ignition: false, status: 'offline' as const, address: 'Heinzelova 62, Zagreb', driverName: null, lastUpdate: new Date(Date.now() - 86400000).toISOString(), group: 'Servis' },
};

const TAB_ITEMS = [
    { id: 'map', label: '🗺️ Karta', icon: 'location' },
    { id: 'vehicles', label: '🚛 Vozila', icon: 'car' },
    { id: 'routes', label: '📍 Rute', icon: 'history' },
    { id: 'geofence', label: '🏗️ Geofence', icon: 'location' },
    { id: 'reports', label: '📊 Izvještaji', icon: 'report' },
];

export type FleetVehicle = {
    id: string;
    name: string;
    plate: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    ignition: boolean;
    status: 'moving' | 'idle' | 'stopped' | 'offline';
    address: string | null;
    driverName: string | null;
    lastUpdate: string;
    group: string | null;
};

export type CacheDoc = {
    updatedAt: string;
    dataAgeSeconds: number;
    providerStatus: 'OK' | 'STALE' | 'FALLBACK' | 'ERROR';
    dataSource: 'push' | 'poll' | 'mock';
    vehicleCount: number;
    vehicles: Record<string, FleetVehicle>;
};

export default function FleetDashboard() {
    const { addAuditLog, currentUser } = useApp() as any;
    const isMobile = useIsMobile();
    const [tab, setTab] = useState('map');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

    // ── Firestore cache — live onSnapshot + mock fallback ──
    const [cacheDoc, setCacheDoc] = useState<CacheDoc>({
        updatedAt: new Date().toISOString(),
        dataAgeSeconds: 0,
        providerStatus: 'OK',
        dataSource: 'mock',
        vehicleCount: Object.keys(MOCK_VEHICLES).length,
        vehicles: MOCK_VEHICLES,
    });

    useEffect(() => {
        // Primary: fetch from API directly (always works)
        const fetchVehicles = () => {
            fetch('/api/gps/vehicles')
                .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
                .then(data => {
                    if (data?.vehicles && Object.keys(data.vehicles).length > 0) {
                        setCacheDoc({
                            updatedAt: data.updatedAt || new Date().toISOString(),
                            dataAgeSeconds: data.dataAgeSeconds || 0,
                            providerStatus: data.providerStatus || 'OK',
                            dataSource: data.dataSource || 'poll',
                            vehicleCount: data.vehicleCount || Object.keys(data.vehicles).length,
                            vehicles: data.vehicles,
                        });
                    }
                })
                .catch(err => console.warn('[Fleet] API fetch failed:', err.message));
        };

        fetchVehicles(); // immediate
        const pollInterval = setInterval(fetchVehicles, 30000); // poll every 30s

        // Secondary: Firestore onSnapshot for push-based live updates
        let unsub = () => { };
        try {
            const db = (window as any).firebase?.firestore?.();
            if (db) {
                unsub = db.doc('gps/cache').onSnapshot((snap: any) => {
                    if (!snap.exists) return;
                    const data = snap.data();
                    const lp = data?.lastPositions;
                    if (lp?.vehicles && Object.keys(lp.vehicles).length > 0) {
                        setCacheDoc({
                            updatedAt: lp.updatedAt || new Date().toISOString(),
                            dataAgeSeconds: lp.dataAgeSeconds || 0,
                            providerStatus: lp.providerStatus || 'OK',
                            dataSource: lp.dataSource || 'push',
                            vehicleCount: lp.vehicleCount || Object.keys(lp.vehicles).length,
                            vehicles: lp.vehicles,
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('[Fleet] Firestore listener failed:', e);
        }

        return () => { clearInterval(pollInterval); unsub(); };
    }, []);

    // ── Computed stats ──
    const vehicles = useMemo(() => Object.values(cacheDoc.vehicles || {}), [cacheDoc]);
    const stats = useMemo(() => ({
        total: vehicles.length,
        moving: vehicles.filter(v => v.status === 'moving').length,
        idle: vehicles.filter(v => v.status === 'idle').length,
        stopped: vehicles.filter(v => v.status === 'stopped').length,
        offline: vehicles.filter(v => v.status === 'offline').length,
    }), [vehicles]);

    // ── Stale detection ──
    const [staleAge, setStaleAge] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            const age = (Date.now() - new Date(cacheDoc.updatedAt).getTime()) / 1000;
            setStaleAge(Math.round(age));
        }, 5000);
        return () => clearInterval(interval);
    }, [cacheDoc.updatedAt]);

    const isStale = cacheDoc.providerStatus !== 'OK' || staleAge > 120;

    // ── Audit: log page view ──
    useEffect(() => {
        addAuditLog?.('FLEET_MAP_VIEWED', `${currentUser?.name || 'unknown'} opened GPS Vozila`);
    }, []);

    // ── Vehicle select handler ──
    const handleSelectVehicle = (id: string) => {
        setSelectedVehicleId(id);
        setTab('vehicles'); // switch to detail view
    };

    const selectedVehicle = selectedVehicleId ? cacheDoc.vehicles[selectedVehicleId] : null;

    return (
        <div>
            {/* ── Stale Warning Banner ── */}
            {isStale && (
                <div style={{
                    background: cacheDoc.providerStatus === 'ERROR' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                    border: `1px solid ${cacheDoc.providerStatus === 'ERROR' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: 12, padding: '10px 16px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.3s ease',
                }}>
                    <span style={{ fontSize: 20 }}>{cacheDoc.providerStatus === 'ERROR' ? '🔴' : '⚠️'}</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: cacheDoc.providerStatus === 'ERROR' ? C.red : '#F59E0B' }}>
                            {cacheDoc.providerStatus === 'ERROR' ? 'GPS sustav nedostupan' : `GPS podaci stari ${staleAge}s`}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>
                            {cacheDoc.providerStatus === 'FALLBACK' ? 'Koristi se polling fallback' : 'Prikazuju se zadnji poznati podaci'}
                            {cacheDoc.dataSource === 'mock' && ' · Demo podaci'}
                        </div>
                    </div>
                    <div style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: cacheDoc.providerStatus === 'OK' ? 'rgba(16,185,129,0.15)' : cacheDoc.providerStatus === 'STALE' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: cacheDoc.providerStatus === 'OK' ? '#10B981' : cacheDoc.providerStatus === 'STALE' ? '#F59E0B' : C.red,
                    }}>
                        {cacheDoc.providerStatus}
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
                        🚛 GPS Vozila
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: cacheDoc.dataSource !== 'mock' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                            color: cacheDoc.dataSource !== 'mock' ? '#10B981' : '#F59E0B',
                        }}>
                            {cacheDoc.dataSource !== 'mock' ? 'LIVE' : 'OFFLINE'}
                        </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        Mapon FMLC · {stats.total} vozila · Ažurirano: {new Date(cacheDoc.updatedAt).toLocaleTimeString('hr')}
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                <StatCard icon="🚛" label="Ukupno" value={stats.total} color="#6366F1" />
                <StatCard icon="🟢" label="U vožnji" value={stats.moving} color="#10B981" />
                <StatCard icon="🟡" label="Stoji (pali)" value={stats.idle} color="#F59E0B" />
                <StatCard icon="🔴" label="Zaustavljeno" value={stats.stopped} color="#EF4444" />
                <StatCard icon="⚫" label="Offline" value={stats.offline} color="#6B7280" />
            </div>

            {/* ── Tab Navigation ── */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto',
                padding: 4, background: 'var(--bg-elevated)', borderRadius: 12,
                WebkitOverflowScrolling: 'touch',
            }}>
                {TAB_ITEMS.map(t => (
                    <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'vehicles') setSelectedVehicleId(null); }}
                        style={{
                            padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: tab === t.id ? 700 : 500, whiteSpace: 'nowrap',
                            background: tab === t.id ? C.accent : 'transparent',
                            color: tab === t.id ? '#fff' : C.textDim,
                            transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                            flex: isMobile ? '1 0 auto' : undefined,
                        }}>{t.label}</button>
                ))}
            </div>

            {/* ── Tab Content ── */}
            <div style={{ animation: 'fadeIn 0.25s ease' }}>
                {tab === 'map' && <FleetMapTab vehicles={vehicles} onSelectVehicle={handleSelectVehicle} providerStatus={cacheDoc.providerStatus} />}
                {tab === 'vehicles' && !selectedVehicleId && <FleetVehicleList vehicles={vehicles} onSelectVehicle={handleSelectVehicle} />}
                {tab === 'vehicles' && selectedVehicle && <FleetVehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicleId(null)} />}
                {tab === 'routes' && <FleetRouteHistory vehicles={vehicles} />}
                {tab === 'geofence' && <FleetGeofenceTab vehicles={vehicles} />}
                {tab === 'reports' && <FleetReportTab vehicles={vehicles} />}
            </div>
        </div>
    );
}

// ── Stat Card ──
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
    return (
        <div style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            transition: 'all 0.2s', cursor: 'default',
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${color}15`, fontSize: 20,
            }}>{icon}</div>
            <div>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            </div>
        </div>
    );
}
