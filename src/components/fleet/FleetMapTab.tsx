// ═══════════════════════════════════════════════════════
// Fleet Map Tab — Live vehicle tracking map
// Uses Leaflet with OpenStreetMap tiles
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from 'react';
import { C, styles } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

declare global { interface Window { L: any; } }

const STATUS_COLORS: Record<string, string> = {
    moving: '#10B981', idle: '#F59E0B', stopped: '#EF4444', offline: '#6B7280',
};
const STATUS_LABELS: Record<string, string> = {
    moving: 'U vožnji', idle: 'Stoji (pali)', stopped: 'Zaustavljeno', offline: 'Offline',
};

export default function FleetMapTab({ vehicles, onSelectVehicle, providerStatus }: {
    vehicles: FleetVehicle[];
    onSelectVehicle: (id: string) => void;
    providerStatus: string;
}) {
    const isMobile = useIsMobile();
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<Record<string, any>>({});
    const [leafletReady, setLeafletReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

    // ── Load Leaflet ──
    useEffect(() => {
        if (window.L) { setLeafletReady(true); return; }
        const css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
        const js = document.createElement('script');
        js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload = () => setLeafletReady(true);
        document.head.appendChild(js);
    }, []);

    // ── Init map ──
    useEffect(() => {
        if (!leafletReady || !mapContainerRef.current || mapRef.current) return;
        const L = window.L;
        const map = L.map(mapContainerRef.current, {
            center: [45.1, 15.5], zoom: 7, zoomControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 19,
        }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
    }, [leafletReady]);

    // ── Update markers ──
    useEffect(() => {
        if (!mapRef.current || !leafletReady) return;
        const L = window.L;
        const map = mapRef.current;
        const existing = markersRef.current;

        // Remove old markers
        Object.keys(existing).forEach(id => {
            if (!vehicles.find(v => v.id === id)) {
                map.removeLayer(existing[id]);
                delete existing[id];
            }
        });

        // Add/update markers
        vehicles.forEach(v => {
            const color = STATUS_COLORS[v.status] || '#6B7280';
            const html = `<div style="
                width: 32px; height: 32px; border-radius: 50%; background: ${color};
                border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex; align-items: center; justify-content: center;
                font-size: 14px; color: #fff; font-weight: 800;
                transform: rotate(${v.heading}deg);
                opacity: ${providerStatus !== 'OK' ? 0.6 : 1};
                transition: all 0.5s ease;
            ">🚛</div>`;
            const icon = L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });

            if (existing[v.id]) {
                existing[v.id].setLatLng([v.lat, v.lng]);
                existing[v.id].setIcon(icon);
            } else {
                const marker = L.marker([v.lat, v.lng], { icon }).addTo(map);
                marker.bindPopup(`
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-width: 200px;">
                        <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px;">${v.name}</div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">🔖 ${v.plate}</div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">📍 ${v.address || 'Nepoznato'}</div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">🏎️ ${v.speed} km/h · ${STATUS_LABELS[v.status]}</div>
                        ${v.driverName ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">👷 ${v.driverName}</div>` : ''}
                        <div style="font-size: 11px; color: #999; margin-top: 6px;">Ažurirano: ${new Date(v.lastUpdate).toLocaleTimeString('hr')}</div>
                    </div>
                `);
                marker.on('click', () => onSelectVehicle(v.id));
                existing[v.id] = marker;
            }
        });

        // Fit bounds if first render
        if (vehicles.length > 0 && Object.keys(existing).length === vehicles.length) {
            const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
    }, [vehicles, leafletReady, providerStatus]);

    // ── Filtered vehicles for sidebar ──
    const filtered = useMemo(() => {
        return vehicles.filter(v => {
            if (filterStatus !== 'all' && v.status !== filterStatus) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return v.name.toLowerCase().includes(q) || v.plate.toLowerCase().includes(q) ||
                    (v.driverName || '').toLowerCase().includes(q) || (v.address || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [vehicles, filterStatus, searchQuery]);

    const flyToVehicle = (v: FleetVehicle) => {
        if (mapRef.current) mapRef.current.flyTo([v.lat, v.lng], 15, { duration: 0.8 });
    };

    return (
        <div style={{ display: 'flex', gap: 0, height: isMobile ? 'calc(100vh - 280px)' : 'calc(100vh - 320px)', borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {/* ── Sidebar ── */}
            {sidebarOpen && (
                <div style={{
                    width: isMobile ? '100%' : 320, background: 'var(--card)', borderRight: `1px solid ${C.border}`,
                    display: 'flex', flexDirection: 'column', position: isMobile ? 'absolute' : 'relative',
                    zIndex: isMobile ? 10 : 1, height: '100%',
                }}>
                    {/* Search */}
                    <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
                        <input
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="🔍 Pretraži vozila, vozače, lokacije..."
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: 10,
                                border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text,
                                fontSize: 13, outline: 'none',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                            {[
                                { id: 'all', label: 'Svi', color: C.accent },
                                { id: 'moving', label: '🟢 Vožnja', color: '#10B981' },
                                { id: 'idle', label: '🟡 Stoji', color: '#F59E0B' },
                                { id: 'stopped', label: '🔴 Stop', color: '#EF4444' },
                                { id: 'offline', label: '⚫ Offline', color: '#6B7280' },
                            ].map(f => (
                                <button key={f.id} onClick={() => setFilterStatus(f.id)} style={{
                                    padding: '4px 10px', borderRadius: 8, border: `1px solid ${filterStatus === f.id ? f.color : C.border}`,
                                    background: filterStatus === f.id ? `${f.color}15` : 'transparent',
                                    color: filterStatus === f.id ? f.color : C.textDim,
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                }}>{f.label}</button>
                            ))}
                        </div>
                    </div>
                    {/* Vehicle list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                        {filtered.map(v => (
                            <button key={v.id} onClick={() => { flyToVehicle(v); onSelectVehicle(v.id); }}
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none',
                                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: STATUS_COLORS[v.status], flexShrink: 0,
                                    boxShadow: v.status === 'moving' ? `0 0 8px ${STATUS_COLORS[v.status]}` : 'none',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {v.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {v.plate} · {v.speed} km/h · {v.driverName || '—'}
                                    </div>
                                </div>
                                <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>
                                    {new Date(v.lastUpdate).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: C.textMuted }}>
                                Nema rezultata za "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Map ── */}
            <div style={{ flex: 1, position: 'relative' }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
                {/* Sidebar toggle */}
                <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                    position: 'absolute', top: 12, left: 12, zIndex: 1000,
                    width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`,
                    background: 'var(--card)', color: C.text, fontSize: 16,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>{sidebarOpen ? '◀' : '▶'}</button>
                {/* Vehicle count badge */}
                <div style={{
                    position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
                    background: 'var(--card)', borderRadius: 10, padding: '8px 14px',
                    border: `1px solid ${C.border}`, fontSize: 12, color: C.text, fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                    🚛 {filtered.length}/{vehicles.length} vozila
                </div>
            </div>
        </div>
    );
}
