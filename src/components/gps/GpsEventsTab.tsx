// ═══════════════════════════════════════════════════════
// GPS Events Tab — Event timeline with filters
// ═══════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { C, styles } from '../../utils/helpers';
import { formatDistance, timeAgo, EVENT_LABELS } from '../../services/GpsSettingsManager';

export default function GpsEventsTab({ events, getWorkerName, getProjectName, isMobile }) {
    const [typeFilter, setTypeFilter] = useState('all');
    const [workerFilter, setWorkerFilter] = useState('');

    const filtered = useMemo(() => {
        let list = events;
        if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter);
        if (workerFilter) {
            const q = workerFilter.toLowerCase();
            list = list.filter(e => (e.workerName || getWorkerName(e.workerId) || '').toLowerCase().includes(q));
        }
        return list.slice(0, 100);
    }, [events, typeFilter, workerFilter, getWorkerName]);

    const uniqueTypes = useMemo(() => {
        const types = new Set(events.map(e => e.type));
        return [...types];
    }, [events]);

    return (
        <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    style={{ ...styles.input, maxWidth: isMobile ? '100%' : 200 }}
                >
                    <option value="all">Svi tipovi</option>
                    {uniqueTypes.map(t => (
                        <option key={t} value={t}>{EVENT_LABELS[t]?.label || t}</option>
                    ))}
                </select>
                <input
                    value={workerFilter}
                    onChange={e => setWorkerFilter(e.target.value)}
                    placeholder="Pretraži po radniku..."
                    style={{ ...styles.input, maxWidth: isMobile ? '100%' : 240 }}
                />
            </div>

            {/* Timeline */}
            <div style={{ ...styles.card }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                        Nema GPS događaja za prikaz
                    </div>
                ) : (
                    <div>
                        {filtered.map((event, i) => {
                            const meta = EVENT_LABELS[event.type] || { label: event.type, icon: '📍', color: '#6B7280' };
                            const isAlarm = event.type === 'LEFT_SITE';
                            return (
                                <div
                                    key={event.id || i}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                        padding: '12px 0',
                                        borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}40` : 'none',
                                        ...(isAlarm ? { background: 'rgba(239,68,68,0.04)', margin: '0 -20px', padding: '12px 20px', borderRadius: 8 } : {}),
                                    }}
                                >
                                    {/* Timeline dot */}
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                        background: `${meta.color}15`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 16,
                                    }}>
                                        {meta.icon}
                                    </div>
                                    <div className="u-flex-1">
                                        <div style={{ fontSize: 13, fontWeight: 600, color: isAlarm ? '#EF4444' : C.text }}>
                                            {event.workerName || getWorkerName(event.workerId)} — {meta.label}
                                        </div>
                                        <div className="u-fs-12" style={{ color: C.textMuted, marginTop: 2 }}>
                                            {event.projectName || getProjectName(event.projectId)}
                                            {event.distance != null && ` • ${formatDistance(event.distance)}`}
                                            {event.accuracy && ` • ±${event.accuracy}m`}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', marginTop: 2 }}>
                                        {timeAgo(event.timestamp)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
