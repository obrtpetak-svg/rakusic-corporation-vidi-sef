// ═══════════════════════════════════════════════════════
// GPS Analytics Tab — Charts, KPIs, trends
// Pure CSS charts (no library dependency)
// ═══════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { C, styles } from '../../utils/helpers';
import { haversine } from '../../services/GeofenceEngine';
import { formatDistance, EVENT_LABELS } from '../../services/GpsSettingsManager';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export default function GpsAnalyticsTab({
    timesheets, workers, projects, gpsEvents, liveLocations,
    getWorkerName, getProjectName, isMobile
}) {
    const [period, setPeriod] = useState(30);

    const dateFrom = useMemo(() => daysAgo(period), [period]);
    const dateTo = today();

    // ── Filter data ──
    const filteredTs = useMemo(() =>
        timesheets.filter(t => t.date >= dateFrom && t.date <= dateTo && t.gpsLocation),
        [timesheets, dateFrom, dateTo]
    );

    const filteredEvents = useMemo(() =>
        gpsEvents.filter(e => {
            const d = e.timestamp?.slice(0, 10) || '';
            return d >= dateFrom && d <= dateTo;
        }),
        [gpsEvents, dateFrom, dateTo]
    );

    // ═══════════════════ KPIs ══
    const kpis = useMemo(() => {
        const uniqueWorkers = new Set(filteredTs.map(t => t.workerId)).size;
        const uniqueProjects = new Set(filteredTs.map(t => t.projectId)).size;
        const totalEntries = filteredTs.length;
        let inZone = 0;
        let distances = [];
        let accuracies = [];

        filteredTs.forEach(t => {
            const proj = projects.find(p => p.id === t.projectId);
            if (proj?.siteLat && proj?.siteLng && t.gpsLocation) {
                const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lng)) {
                    const d = haversine(lat, lng, proj.siteLat, proj.siteLng);
                    distances.push(d);
                    if (d <= 300) inZone++;
                }
            }
        });

        filteredEvents.forEach(e => {
            if (e.accuracy) accuracies.push(e.accuracy);
        });

        return {
            uniqueWorkers,
            uniqueProjects,
            totalEntries,
            totalEvents: filteredEvents.length,
            inZone,
            outZone: totalEntries - inZone,
            presencePct: totalEntries > 0 ? Math.round((inZone / totalEntries) * 100) : 0,
            avgDistance: distances.length > 0 ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : 0,
            avgAccuracy: accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0,
        };
    }, [filteredTs, filteredEvents, projects]);

    // ═══════════════════ DONUT DATA ══
    const donutData = useMemo(() => [
        { label: 'U zoni', value: kpis.inZone, color: '#10B981' },
        { label: 'Izvan zone', value: kpis.outZone, color: '#EF4444' },
    ], [kpis]);

    // ═══════════════════ WORKER BAR CHART ══
    const workerDistances = useMemo(() => {
        const map = new Map();
        filteredTs.forEach(t => {
            const proj = projects.find(p => p.id === t.projectId);
            if (!proj?.siteLat || !proj?.siteLng || !t.gpsLocation) return;
            const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
            if (isNaN(lat) || isNaN(lng)) return;
            const d = haversine(lat, lng, proj.siteLat, proj.siteLng);
            if (!map.has(t.workerId)) map.set(t.workerId, { total: 0, count: 0, name: getWorkerName(t.workerId) });
            const w = map.get(t.workerId);
            w.total += d;
            w.count++;
        });
        return [...map.entries()].map(([id, w]) => ({
            id, name: w.name, avgDist: Math.round(w.total / w.count),
        })).sort((a, b) => a.avgDist - b.avgDist).slice(0, 10);
    }, [filteredTs, projects, getWorkerName]);

    // ═══════════════════ DAILY TREND ══
    const dailyTrend = useMemo(() => {
        const map = new Map();
        filteredTs.forEach(t => {
            if (!map.has(t.date)) map.set(t.date, { total: 0, inZone: 0 });
            const d = map.get(t.date);
            d.total++;
            const proj = projects.find(p => p.id === t.projectId);
            if (proj?.siteLat && proj?.siteLng && t.gpsLocation) {
                const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lng) && haversine(lat, lng, proj.siteLat, proj.siteLng) <= 300) d.inZone++;
            }
        });
        return [...map.entries()]
            .map(([date, d]) => ({ date, pct: d.total > 0 ? Math.round((d.inZone / d.total) * 100) : 0, total: d.total }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30);
    }, [filteredTs, projects]);

    // ═══════════════════ EVENT BREAKDOWN ══
    const eventBreakdown = useMemo(() => {
        const map = new Map();
        filteredEvents.forEach(e => {
            const t = e.type || 'UNKNOWN';
            map.set(t, (map.get(t) || 0) + 1);
        });
        return [...map.entries()]
            .map(([type, count]) => ({ type, count, ...EVENT_LABELS[type] || { label: type, icon: '📍', color: '#6B7280' } }))
            .sort((a, b) => b.count - a.count);
    }, [filteredEvents]);

    // ═══════════════════ ANOMALIES ══
    const anomalies = useMemo(() => {
        const map = new Map();
        filteredTs.forEach(t => {
            const proj = projects.find(p => p.id === t.projectId);
            if (!proj?.siteLat || !proj?.siteLng || !t.gpsLocation) return;
            const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
            if (isNaN(lat) || isNaN(lng)) return;
            const d = haversine(lat, lng, proj.siteLat, proj.siteLng);
            if (d > 500) {
                if (!map.has(t.workerId)) map.set(t.workerId, { name: getWorkerName(t.workerId), count: 0, maxDist: 0, dates: [] });
                const w = map.get(t.workerId);
                w.count++;
                w.maxDist = Math.max(w.maxDist, Math.round(d));
                if (!w.dates.includes(t.date)) w.dates.push(t.date);
            }
        });
        return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    }, [filteredTs, projects, getWorkerName]);

    // ═══════════════════ RENDER ══
    const maxBarDist = Math.max(...workerDistances.map(w => w.avgDist), 1);
    const maxTrend = Math.max(...dailyTrend.map(d => d.pct), 1);
    const donutTotal = Math.max(donutData.reduce((s, d) => s + d.value, 0), 1);

    return (
        <div>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {[
                    { d: 7, label: '7 dana' },
                    { d: 14, label: '14 dana' },
                    { d: 30, label: '30 dana' },
                    { d: 90, label: '90 dana' },
                ].map(p => (
                    <button key={p.d} onClick={() => setPeriod(p.d)} style={{
                        padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                        background: period === p.d ? C.accentLight : 'transparent',
                        color: period === p.d ? C.accent : C.textMuted,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>{p.label}</button>
                ))}
            </div>

            {/* KPI Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                gap: 10, marginBottom: 20,
            }}>
                <KpiCard label="GPS unosa" value={kpis.totalEntries} icon="📍" color="#3B82F6" />
                <KpiCard label="Radnika" value={kpis.uniqueWorkers} icon="👷" color="#8B5CF6" />
                <KpiCard label="Prisutnost" value={`${kpis.presencePct}%`} icon="✅" color="#10B981"
                    sub={kpis.presencePct >= 80 ? 'Odlično' : kpis.presencePct >= 50 ? 'Može bolje' : 'Upozorenje'} />
                <KpiCard label="Prosj. udaljenost" value={formatDistance(kpis.avgDistance)} icon="📏" color="#F59E0B" />
                <KpiCard label="Prosj. preciznost" value={kpis.avgAccuracy ? `±${kpis.avgAccuracy}m` : '—'} icon="🎯" color="#06B6D4" />
            </div>

            {/* Charts Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
                gap: 16, marginBottom: 20,
            }}>
                {/* Donut Chart */}
                <div style={styles.card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                        🟢 Prisutnost u zoni
                    </div>
                    <DonutChart data={donutData} total={donutTotal} centerLabel={`${kpis.presencePct}%`} />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
                        {donutData.map(d => (
                            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                                <span style={{ color: C.textMuted }}>{d.label}: <b style={{ color: C.text }}>{d.value}</b></span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trend Chart */}
                <div style={styles.card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                        📈 Trend prisutnosti (zadnjih {period} dana)
                    </div>
                    {dailyTrend.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Nema podataka</div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, padding: '0 4px' }}>
                            {dailyTrend.map((d, i) => (
                                <div key={d.date} style={{
                                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    position: 'relative', cursor: 'default',
                                }} title={`${d.date}: ${d.pct}% (${d.total} unosa)`}>
                                    <div style={{
                                        width: '100%', maxWidth: 20,
                                        height: `${Math.max(4, (d.pct / maxTrend) * 120)}px`,
                                        borderRadius: '4px 4px 0 0',
                                        background: d.pct >= 80 ? 'linear-gradient(180deg, #10B981, #34D399)'
                                            : d.pct >= 50 ? 'linear-gradient(180deg, #F59E0B, #FBBF24)'
                                                : 'linear-gradient(180deg, #EF4444, #F87171)',
                                        transition: 'height 0.3s ease',
                                    }} />
                                    {(i === 0 || i === dailyTrend.length - 1 || i % 7 === 0) && (
                                        <div style={{ fontSize: 9, color: C.textMuted, marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                                            {d.date.slice(5)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Second row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 16, marginBottom: 20,
            }}>
                {/* Worker Distance Bar Chart */}
                <div style={styles.card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                        📏 Prosječna udaljenost po radniku (top 10)
                    </div>
                    {workerDistances.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 30, color: C.textMuted }}>Nema podataka</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {workerDistances.map(w => (
                                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: C.text, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {w.name?.split(' ')[0] || '?'}
                                    </div>
                                    <div style={{ flex: 1, height: 20, borderRadius: 4, background: `${C.border}20`, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4,
                                            width: `${Math.max(4, (w.avgDist / maxBarDist) * 100)}%`,
                                            background: w.avgDist <= 100 ? 'linear-gradient(90deg, #10B981, #34D399)'
                                                : w.avgDist <= 300 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                                    : 'linear-gradient(90deg, #EF4444, #F87171)',
                                            transition: 'width 0.5s ease',
                                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                                            fontSize: 10, fontWeight: 700, color: 'white',
                                        }}>
                                            {w.avgDist}m
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Event Type Breakdown */}
                <div style={styles.card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                        📋 Vrste GPS događaja
                    </div>
                    {eventBreakdown.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 30, color: C.textMuted }}>Nema evenata</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {eventBreakdown.map(e => {
                                const maxCount = eventBreakdown[0]?.count || 1;
                                return (
                                    <div key={e.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{e.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                                                <span style={{ fontWeight: 600, color: C.text }}>{e.label}</span>
                                                <span style={{ color: C.textMuted }}>{e.count}x</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 3, background: `${C.border}20`, overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: 3,
                                                    width: `${(e.count / maxCount) * 100}%`,
                                                    background: e.color,
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Anomalies */}
            {anomalies.length > 0 && (
                <div style={styles.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 18 }}>⚠️</span>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>Anomalije — izvan zone (&gt;500m)</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>Radnici koji su česti bili daleko od gradilišta</div>
                        </div>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: 10,
                    }}>
                        {anomalies.map((a, i) => (
                            <div key={i} style={{
                                padding: '12px 14px', borderRadius: 10,
                                background: 'rgba(239,68,68,0.04)',
                                border: '1px solid rgba(239,68,68,0.12)',
                            }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>
                                    {a.count}× izvan zone • max {formatDistance(a.maxDist)}
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                                    Datumi: {a.dates.slice(0, 3).join(', ')}{a.dates.length > 3 ? ` +${a.dates.length - 3}` : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Donut Chart (Pure CSS/SVG) ──
function DonutChart({ data, total, centerLabel }) {
    const size = 140;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let cumulativeOffset = 0;

    return (
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background circle */}
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={`${C.border}30`} strokeWidth={strokeWidth} />
                {/* Data arcs */}
                {data.map((d, i) => {
                    const pct = d.value / total;
                    const dashLength = circumference * pct;
                    const offset = circumference * cumulativeOffset;
                    cumulativeOffset += pct;
                    return (
                        <circle key={i}
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none" stroke={d.color} strokeWidth={strokeWidth}
                            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                    );
                })}
            </svg>
            {/* Center label */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 28, fontWeight: 800, color: C.text,
            }}>
                {centerLabel}
            </div>
        </div>
    );
}

// ── KPI Card ──
function KpiCard({ label, value, icon, color, sub }) {
    return (
        <div style={{
            ...styles.card, position: 'relative', overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', top: -15, right: -15,
                width: 60, height: 60, borderRadius: '50%', background: `${color}10`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 10, background: `${color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{icon}</div>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{value}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    {sub && <div style={{ fontSize: 10, color: C.textMuted }}>{sub}</div>}
                </div>
            </div>
        </div>
    );
}
