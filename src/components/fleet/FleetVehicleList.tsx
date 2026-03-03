// ═══════════════════════════════════════════════════════
// Fleet Vehicle List — sortable grid with search + import
// ═══════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { C, styles } from '../../utils/helpers';
import { useIsMobile } from '../ui/SharedComponents';
import type { FleetVehicle } from './FleetDashboard';

const STATUS_META: Record<string, { icon: string; label: string; color: string }> = {
    moving: { icon: '🟢', label: 'U vožnji', color: '#10B981' },
    idle: { icon: '🟡', label: 'Stoji (pali)', color: '#F59E0B' },
    stopped: { icon: '🔴', label: 'Zaustavljeno', color: '#EF4444' },
    offline: { icon: '⚫', label: 'Offline', color: '#6B7280' },
};

type SortKey = 'name' | 'plate' | 'speed' | 'status' | 'lastUpdate';

export default function FleetVehicleList({ vehicles, onSelectVehicle }: {
    vehicles: FleetVehicle[];
    onSelectVehicle: (id: string) => void;
}) {
    const isMobile = useIsMobile();
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    const filtered = useMemo(() => {
        let list = [...vehicles];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(v =>
                v.name.toLowerCase().includes(q) || v.plate.toLowerCase().includes(q) ||
                (v.driverName || '').toLowerCase().includes(q) || (v.group || '').toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortBy === 'plate') cmp = a.plate.localeCompare(b.plate);
            else if (sortBy === 'speed') cmp = a.speed - b.speed;
            else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
            else if (sortBy === 'lastUpdate') cmp = new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime();
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [vehicles, search, sortBy, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(key); setSortDir('asc'); }
    };

    const timeSince = (date: string) => {
        const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
        if (s < 60) return `${s}s`;
        if (s < 3600) return `${Math.round(s / 60)}m`;
        if (s < 86400) return `${Math.round(s / 3600)}h`;
        return `${Math.round(s / 86400)}d`;
    };

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Pretraži vozila..."
                    style={{
                        flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10,
                        border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: 13,
                    }} />
                <div className="u-flex-gap-4">
                    <button onClick={() => setViewMode('cards')} style={{
                        padding: '8px 12px', borderRadius: 8, border: `1px solid ${viewMode === 'cards' ? C.accent : C.border}`,
                        background: viewMode === 'cards' ? `${C.accent}15` : 'transparent', color: viewMode === 'cards' ? C.accent : C.textDim,
                        fontSize: 13, cursor: 'pointer',
                    }}>⊞</button>
                    <button onClick={() => setViewMode('table')} style={{
                        padding: '8px 12px', borderRadius: 8, border: `1px solid ${viewMode === 'table' ? C.accent : C.border}`,
                        background: viewMode === 'table' ? `${C.accent}15` : 'transparent', color: viewMode === 'table' ? C.accent : C.textDim,
                        fontSize: 13, cursor: 'pointer',
                    }}>☰</button>
                </div>
                {/* Import button (Sprint 2: implement Mapon import) */}
                <button style={{ ...styles.btn, fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    📥 Uvezi iz Mapona
                </button>
            </div>

            {/* ── Sort chips ── */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {([
                    { key: 'name', label: 'Naziv' },
                    { key: 'plate', label: 'Registracija' },
                    { key: 'speed', label: 'Brzina' },
                    { key: 'status', label: 'Status' },
                    { key: 'lastUpdate', label: 'Ažurirano' },
                ] as { key: SortKey; label: string }[]).map(s => (
                    <button key={s.key} onClick={() => toggleSort(s.key)} style={{
                        padding: '4px 10px', borderRadius: 8, border: `1px solid ${sortBy === s.key ? C.accent : C.border}`,
                        background: sortBy === s.key ? `${C.accent}10` : 'transparent',
                        color: sortBy === s.key ? C.accent : C.textMuted,
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>{s.label} {sortBy === s.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
                ))}
                <span style={{ fontSize: 11, color: C.textMuted, alignSelf: 'center', marginLeft: 'auto' }}>
                    {filtered.length} od {vehicles.length} vozila
                </span>
            </div>

            {/* ── Cards View ── */}
            {viewMode === 'cards' && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                    {filtered.map(v => {
                        const meta = STATUS_META[v.status] || STATUS_META.offline;
                        return (
                            <button key={v.id} onClick={() => onSelectVehicle(v.id)}
                                style={{
                                    background: 'var(--card)', border: `1px solid ${C.border}`, borderRadius: 14,
                                    padding: 16, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                                    borderLeft: `4px solid ${meta.color}`,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                {/* Top row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12, background: `${meta.color}12`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                                        }}>🚛</div>
                                        <div>
                                            <div className="u-section-title">{v.name}</div>
                                            <div className="u-fs-11 u-text-muted">🔖 {v.plate}</div>
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                        background: `${meta.color}15`, color: meta.color,
                                    }}>
                                        {meta.icon} {meta.label}
                                    </div>
                                </div>
                                {/* Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, color: C.textDim }}>
                                    <div>🏎️ {v.speed} km/h</div>
                                    <div>👷 {v.driverName || '—'}</div>
                                    <div style={{ gridColumn: '1 / -1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        📍 {v.address || 'Nepoznato'}
                                    </div>
                                </div>
                                {/* Footer */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                                    <span className="u-stat-label">{v.group || '—'}</span>
                                    <span className="u-stat-label">⏱️ {timeSince(v.lastUpdate)}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Table View ── */}
            {viewMode === 'table' && (
                <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.border}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-elevated)' }}>
                                {['Status', 'Vozilo', 'Registracija', 'Brzina', 'Vozač', 'Lokacija', 'Ažurirano'].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(v => {
                                const meta = STATUS_META[v.status] || STATUS_META.offline;
                                return (
                                    <tr key={v.id} onClick={() => onSelectVehicle(v.id)}
                                        style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.text }}>{v.name}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim, fontFamily: 'monospace' }}>{v.plate}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: v.speed > 0 ? '#10B981' : C.textMuted, fontWeight: 600 }}>{v.speed} km/h</td>
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim }}>{v.driverName || '—'}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.address || '—'}</td>
                                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>{timeSince(v.lastUpdate)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>Nema vozila za prikaz</div>}
        </div>
    );
}
