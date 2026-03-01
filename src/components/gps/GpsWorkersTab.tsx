// ═══════════════════════════════════════════════════════
// GPS Workers Tab — Worker list with search, filter, pagination
// ═══════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { C, styles } from '../../utils/helpers';
import { Icon } from '../ui/SharedComponents';
import WorkerLocationCard from './WorkerLocationCard';

const PAGE_SIZE = 20;

export default function GpsWorkersTab({ workers, projects, getProjectName, isMobile }) {
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        let list = workers;
        if (filter) {
            const q = filter.toLowerCase();
            list = list.filter(w => (w.name || '').toLowerCase().includes(q));
        }
        if (statusFilter === 'active') list = list.filter(w => w.location);
        if (statusFilter === 'inZone') list = list.filter(w => w.location?.inGeofence);
        if (statusFilter === 'outZone') list = list.filter(w => w.location && !w.location.inGeofence);
        return list;
    }, [workers, filter, statusFilter]);

    // Reset page when filters change
    const setFilterAndReset = (v) => { setFilter(v); setPage(0); };
    const setStatusAndReset = (v) => { setStatusFilter(v); setPage(0); };

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}>
                        <Icon name="search" size={16} />
                    </div>
                    <input
                        value={filter}
                        onChange={e => setFilterAndReset(e.target.value)}
                        placeholder="Pretraži radnike..."
                        style={{ ...styles.input, paddingLeft: 36 }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {[
                        { id: 'all', label: 'Svi' },
                        { id: 'active', label: '🟢 Aktivni' },
                        { id: 'inZone', label: '✅ U zoni' },
                        { id: 'outZone', label: '🚨 Izvan' },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setStatusAndReset(f.id)}
                            style={{
                                padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                                background: statusFilter === f.id ? C.accentLight : 'transparent',
                                color: statusFilter === f.id ? C.accent : C.textMuted,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Worker cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 12,
            }}>
                {paged.map(w => (
                    <WorkerLocationCard key={w.id} worker={w} getProjectName={getProjectName} />
                ))}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
                    Nema radnika za prikaz
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 12, marginTop: 20, padding: '12px 0',
                }}>
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{
                            padding: '8px 16px', borderRadius: 8,
                            border: `1px solid ${C.border}`,
                            background: page === 0 ? 'transparent' : C.card,
                            color: page === 0 ? C.textMuted : C.text,
                            fontSize: 13, fontWeight: 600, cursor: page === 0 ? 'default' : 'pointer',
                            opacity: page === 0 ? 0.5 : 1,
                        }}
                    >
                        ← Prethodna
                    </button>
                    <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
                        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} od {filtered.length}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        style={{
                            padding: '8px 16px', borderRadius: 8,
                            border: `1px solid ${C.border}`,
                            background: page >= totalPages - 1 ? 'transparent' : C.card,
                            color: page >= totalPages - 1 ? C.textMuted : C.text,
                            fontSize: 13, fontWeight: 600, cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                            opacity: page >= totalPages - 1 ? 0.5 : 1,
                        }}
                    >
                        Sljedeća →
                    </button>
                </div>
            )}
        </div>
    );
}
