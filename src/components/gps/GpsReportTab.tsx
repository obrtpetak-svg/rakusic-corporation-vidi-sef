// ═══════════════════════════════════════════════════════
// GPS Report Tab — Daily/Weekly GPS presence reports
// Filters by worker, project, date range
// Export to PDF & CSV/Excel
// ═══════════════════════════════════════════════════════
import React, { useState, useMemo, useCallback } from 'react';
import { C, styles, fmtDate } from '../../utils/helpers';
import { Icon, Field, Input, Select } from '../ui/SharedComponents';
import { formatDistance, timeAgo, EVENT_LABELS } from '../../services/GpsSettingsManager';
import { haversine } from '../../services/GeofenceEngine';

// ── Date helpers ──
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const formatHM = (mins) => { const h = Math.floor(mins / 60); const m = Math.round(mins % 60); return h > 0 ? `${h}h ${m}min` : `${m}min`; };

export default function GpsReportTab({
    timesheets, workers, projects, gpsEvents, liveLocations,
    getWorkerName, getProjectName, isMobile
}) {
    const [dateFrom, setDateFrom] = useState(daysAgo(7));
    const [dateTo, setDateTo] = useState(today());
    const [workerFilter, setWorkerFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [viewMode, setViewMode] = useState('workers'); // workers | projects | daily
    const [exporting, setExporting] = useState(false);

    // ── Filtered timesheets with GPS ──
    const filteredData = useMemo(() => {
        let list = timesheets.filter(t =>
            t.date >= dateFrom && t.date <= dateTo && t.gpsLocation
        );
        if (workerFilter) list = list.filter(t => t.workerId === workerFilter);
        if (projectFilter) list = list.filter(t => t.projectId === projectFilter);
        return list;
    }, [timesheets, dateFrom, dateTo, workerFilter, projectFilter]);

    // ── Filtered events ──
    const filteredEvents = useMemo(() => {
        return gpsEvents.filter(e => {
            const eDate = e.timestamp?.slice(0, 10) || '';
            if (eDate < dateFrom || eDate > dateTo) return false;
            if (workerFilter && e.workerId !== workerFilter) return false;
            if (projectFilter && e.projectId !== projectFilter) return false;
            return true;
        });
    }, [gpsEvents, dateFrom, dateTo, workerFilter, projectFilter]);

    // ═══════════════════════════════════ WORKER VIEW ══
    const workerReport = useMemo(() => {
        const map = new Map();
        filteredData.forEach(t => {
            if (!map.has(t.workerId)) {
                map.set(t.workerId, {
                    workerId: t.workerId,
                    name: getWorkerName(t.workerId),
                    totalEntries: 0,
                    gpsEntries: 0,
                    projects: new Set(),
                    dates: new Set(),
                    totalMins: 0,
                    inZoneCount: 0,
                    avgDistance: [],
                });
            }
            const w = map.get(t.workerId);
            w.totalEntries++;
            w.gpsEntries++;
            w.projects.add(t.projectId);
            w.dates.add(t.date);
            // Calc mins from time
            const [sh, sm] = (t.startTime || '07:00').split(':').map(Number);
            const [eh, em] = (t.endTime || '15:00').split(':').map(Number);
            w.totalMins += (eh * 60 + em) - (sh * 60 + sm) - (t.breakMins || 0);
            // Check if in geofence
            const proj = projects.find(p => p.id === t.projectId);
            if (proj?.siteLat && proj?.siteLng && t.gpsLocation) {
                const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lng)) {
                    const dist = haversine(lat, lng, proj.siteLat, proj.siteLng);
                    w.avgDistance.push(dist);
                    if (dist <= 300) w.inZoneCount++;
                }
            }
        });

        return [...map.values()].map(w => ({
            ...w,
            projects: w.projects.size,
            days: w.dates.size,
            avgDist: w.avgDistance.length > 0
                ? Math.round(w.avgDistance.reduce((a, b) => a + b, 0) / w.avgDistance.length)
                : null,
            presencePct: w.gpsEntries > 0
                ? Math.round((w.inZoneCount / w.gpsEntries) * 100)
                : 0,
        })).sort((a, b) => b.presencePct - a.presencePct);
    }, [filteredData, projects, getWorkerName]);

    // ═══════════════════════════════════ PROJECT VIEW ══
    const projectReport = useMemo(() => {
        const map = new Map();
        filteredData.forEach(t => {
            if (!map.has(t.projectId)) {
                map.set(t.projectId, {
                    projectId: t.projectId,
                    name: getProjectName(t.projectId),
                    workers: new Set(),
                    totalEntries: 0,
                    gpsEntries: 0,
                    dates: new Set(),
                    totalMins: 0,
                    inZoneCount: 0,
                });
            }
            const p = map.get(t.projectId);
            p.workers.add(t.workerId);
            p.totalEntries++;
            p.gpsEntries++;
            p.dates.add(t.date);
            const [sh, sm] = (t.startTime || '07:00').split(':').map(Number);
            const [eh, em] = (t.endTime || '15:00').split(':').map(Number);
            p.totalMins += (eh * 60 + em) - (sh * 60 + sm) - (t.breakMins || 0);

            const proj = projects.find(pr => pr.id === t.projectId);
            if (proj?.siteLat && proj?.siteLng && t.gpsLocation) {
                const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lng)) {
                    const dist = haversine(lat, lng, proj.siteLat, proj.siteLng);
                    if (dist <= 300) p.inZoneCount++;
                }
            }
        });
        return [...map.values()].map(p => ({
            ...p,
            workerCount: p.workers.size,
            days: p.dates.size,
            presencePct: p.gpsEntries > 0 ? Math.round((p.inZoneCount / p.gpsEntries) * 100) : 0,
        })).sort((a, b) => b.presencePct - a.presencePct);
    }, [filteredData, projects, getProjectName]);

    // ═══════════════════════════════════ DAILY VIEW ══
    const dailyReport = useMemo(() => {
        const map = new Map();
        filteredData.forEach(t => {
            if (!map.has(t.date)) {
                map.set(t.date, {
                    date: t.date,
                    workers: new Set(),
                    entries: 0,
                    inZone: 0,
                    totalMins: 0,
                });
            }
            const d = map.get(t.date);
            d.workers.add(t.workerId);
            d.entries++;
            const [sh, sm] = (t.startTime || '07:00').split(':').map(Number);
            const [eh, em] = (t.endTime || '15:00').split(':').map(Number);
            d.totalMins += (eh * 60 + em) - (sh * 60 + sm) - (t.breakMins || 0);

            const proj = projects.find(p => p.id === t.projectId);
            if (proj?.siteLat && proj?.siteLng && t.gpsLocation) {
                const [lat, lng] = t.gpsLocation.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(lat) && !isNaN(lng) && haversine(lat, lng, proj.siteLat, proj.siteLng) <= 300) {
                    d.inZone++;
                }
            }
        });
        return [...map.values()].map(d => ({
            ...d,
            workerCount: d.workers.size,
            presencePct: d.entries > 0 ? Math.round((d.inZone / d.entries) * 100) : 0,
        })).sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredData, projects]);

    // ═══════════════════════════════════ EXPORT ══

    const exportCSV = useCallback(() => {
        let headers, rows;
        if (viewMode === 'workers') {
            headers = ['Radnik', 'Dana', 'Projekata', 'Unosa', 'Ukupno sati', 'Prosj. udaljenost', 'Prisutnost %'];
            rows = workerReport.map(w => [
                w.name, w.days, w.projects, w.gpsEntries,
                (w.totalMins / 60).toFixed(1), w.avgDist != null ? `${w.avgDist}m` : '-', `${w.presencePct}%`
            ]);
        } else if (viewMode === 'projects') {
            headers = ['Projekt', 'Radnika', 'Dana', 'Unosa', 'Ukupno sati', 'Prisutnost %'];
            rows = projectReport.map(p => [
                p.name, p.workerCount, p.days, p.gpsEntries,
                (p.totalMins / 60).toFixed(1), `${p.presencePct}%`
            ]);
        } else {
            headers = ['Datum', 'Radnika', 'Unosa', 'Ukupno sati', 'U zoni', 'Prisutnost %'];
            rows = dailyReport.map(d => [
                d.date, d.workerCount, d.entries,
                (d.totalMins / 60).toFixed(1), d.inZone, `${d.presencePct}%`
            ]);
        }

        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GPS_izvjestaj_${viewMode}_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [viewMode, workerReport, projectReport, dailyReport, dateFrom, dateTo]);

    const exportPDF = useCallback(() => {
        const printDiv = document.createElement('div');
        const title = viewMode === 'workers' ? 'Po radnicima' : viewMode === 'projects' ? 'Po projektima' : 'Po danima';

        let tableHTML = '';
        if (viewMode === 'workers') {
            tableHTML = `<table><thead><tr><th>Radnik</th><th>Dana</th><th>Projekata</th><th>Unosa</th><th>Sati</th><th>Prosj. udalj.</th><th>Prisutnost</th></tr></thead><tbody>` +
                workerReport.map(w => `<tr><td>${w.name}</td><td>${w.days}</td><td>${w.projects}</td><td>${w.gpsEntries}</td><td>${(w.totalMins / 60).toFixed(1)}h</td><td>${w.avgDist != null ? w.avgDist + 'm' : '-'}</td><td style="color:${w.presencePct >= 80 ? '#059669' : w.presencePct >= 50 ? '#D97706' : '#DC2626'};font-weight:700">${w.presencePct}%</td></tr>`).join('') +
                `</tbody></table>`;
        } else if (viewMode === 'projects') {
            tableHTML = `<table><thead><tr><th>Projekt</th><th>Radnika</th><th>Dana</th><th>Unosa</th><th>Sati</th><th>Prisutnost</th></tr></thead><tbody>` +
                projectReport.map(p => `<tr><td>${p.name}</td><td>${p.workerCount}</td><td>${p.days}</td><td>${p.gpsEntries}</td><td>${(p.totalMins / 60).toFixed(1)}h</td><td style="color:${p.presencePct >= 80 ? '#059669' : p.presencePct >= 50 ? '#D97706' : '#DC2626'};font-weight:700">${p.presencePct}%</td></tr>`).join('') +
                `</tbody></table>`;
        } else {
            tableHTML = `<table><thead><tr><th>Datum</th><th>Radnika</th><th>Unosa</th><th>Sati</th><th>U zoni</th><th>Prisutnost</th></tr></thead><tbody>` +
                dailyReport.map(d => `<tr><td>${d.date}</td><td>${d.workerCount}</td><td>${d.entries}</td><td>${(d.totalMins / 60).toFixed(1)}h</td><td>${d.inZone}</td><td style="color:${d.presencePct >= 80 ? '#059669' : d.presencePct >= 50 ? '#D97706' : '#DC2626'};font-weight:700">${d.presencePct}%</td></tr>`).join('') +
                `</tbody></table>`;
        }

        // KPIs
        const totalEntries = filteredData.length;
        const totalWorkers = new Set(filteredData.map(t => t.workerId)).size;
        const totalMins = filteredData.reduce((s, t) => {
            const [sh, sm] = (t.startTime || '07:00').split(':').map(Number);
            const [eh, em] = (t.endTime || '15:00').split(':').map(Number);
            return s + (eh * 60 + em) - (sh * 60 + sm) - (t.breakMins || 0);
        }, 0);
        const avgPresence = viewMode === 'workers'
            ? (workerReport.length > 0 ? Math.round(workerReport.reduce((s, w) => s + w.presencePct, 0) / workerReport.length) : 0)
            : viewMode === 'projects'
                ? (projectReport.length > 0 ? Math.round(projectReport.reduce((s, p) => s + p.presencePct, 0) / projectReport.length) : 0)
                : (dailyReport.length > 0 ? Math.round(dailyReport.reduce((s, d) => s + d.presencePct, 0) / dailyReport.length) : 0);

        printDiv.innerHTML = `
            <html><head><title>GPS Izvještaj</title><style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1a1a2e; }
                h1 { font-size: 22px; margin-bottom: 4px; }
                .subtitle { color: #64748b; font-size: 13px; margin-bottom: 20px; }
                .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; }
                .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
                .kpi-val { font-size: 24px; font-weight: 800; color: #D95D08; }
                .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 700; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
                td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
                tr:hover td { background: #fafbfc; }
                .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                @media print { body { padding: 0; } .kpi-row { gap: 8px; } }
            </style></head><body>
                <h1>📡 GPS Izvještaj — ${title}</h1>
                <div class="subtitle">Period: ${dateFrom} — ${dateTo} | Generirano: ${new Date().toLocaleString('hr')}</div>
                <div class="kpi-row">
                    <div class="kpi"><div class="kpi-val">${totalWorkers}</div><div class="kpi-label">Radnika</div></div>
                    <div class="kpi"><div class="kpi-val">${totalEntries}</div><div class="kpi-label">GPS unosa</div></div>
                    <div class="kpi"><div class="kpi-val">${(totalMins / 60).toFixed(0)}h</div><div class="kpi-label">Ukupno sati</div></div>
                    <div class="kpi"><div class="kpi-val">${avgPresence}%</div><div class="kpi-label">Prosj. prisutnost</div></div>
                </div>
                ${tableHTML}
                <div class="footer">Vi-Di-Sef GPS Nadzor • Automatski generirano</div>
            </body></html>
        `;

        const win = window.open('', '_blank');
        win.document.write(printDiv.innerHTML);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
    }, [viewMode, workerReport, projectReport, dailyReport, filteredData, dateFrom, dateTo]);

    // ═══════════════════════════════════ PRESENCE BAR ══
    const PresenceBar = ({ pct }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: `${C.border}30`, overflow: 'hidden', minWidth: 60 }}>
                <div style={{
                    height: '100%', borderRadius: 4, width: `${Math.min(100, pct)}%`,
                    background: pct >= 80 ? 'linear-gradient(90deg, #10B981, #34D399)'
                        : pct >= 50 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                            : 'linear-gradient(90deg, #EF4444, #F87171)',
                    transition: 'width 0.5s ease',
                }} />
            </div>
            <span style={{
                fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: 'right',
                color: pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626',
            }}>{pct}%</span>
        </div>
    );

    // ═══════════════════════════════════ RENDER ══
    const currentData = viewMode === 'workers' ? workerReport : viewMode === 'projects' ? projectReport : dailyReport;

    return (
        <div>
            {/* Filters */}
            <div style={{ ...styles.card, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <Field label="Od datuma" style={{ flex: 1, minWidth: 130 }}>
                        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Do datuma" style={{ flex: 1, minWidth: 130 }}>
                        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </Field>
                    <Field label="Radnik" style={{ flex: 1, minWidth: 150 }}>
                        <Select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)}>
                            <option value="">Svi radnici</option>
                            {workers.filter(w => w.active !== false).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Projekt" style={{ flex: 1, minWidth: 150 }}>
                        <Select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                            <option value="">Svi projekti</option>
                            {projects.filter(p => p.status !== 'arhiviran').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </Field>
                </div>

                {/* Quick date buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Danas', from: today(), to: today() },
                        { label: 'Zadnjih 7 dana', from: daysAgo(7), to: today() },
                        { label: 'Zadnjih 30 dana', from: daysAgo(30), to: today() },
                        { label: 'Ovaj mjesec', from: new Date().toISOString().slice(0, 8) + '01', to: today() },
                    ].map(q => (
                        <button key={q.label} onClick={() => { setDateFrom(q.from); setDateTo(q.to); }}
                            style={{
                                padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                                background: dateFrom === q.from && dateTo === q.to ? C.accentLight : 'transparent',
                                color: dateFrom === q.from && dateTo === q.to ? C.accent : C.textMuted,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}>
                            {q.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* View mode + export buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 10, padding: 4 }}>
                    {[
                        { id: 'workers', label: '👷 Radnici' },
                        { id: 'projects', label: '📋 Projekti' },
                        { id: 'daily', label: '📅 Dnevno' },
                    ].map(v => (
                        <button key={v.id} onClick={() => setViewMode(v.id)} style={{
                            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: viewMode === v.id ? 700 : 500,
                            background: viewMode === v.id ? C.card : 'transparent',
                            color: viewMode === v.id ? C.accent : C.textMuted,
                            boxShadow: viewMode === v.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                        }}>
                            {v.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} style={{ ...styles.btnSmall, fontSize: 12 }}>
                        📊 Excel/CSV
                    </button>
                    <button onClick={exportPDF} style={{ ...styles.btnSmall, fontSize: 12 }}>
                        📄 PDF
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: 10, marginBottom: 16,
            }}>
                <KpiBox label="GPS unosa" value={filteredData.length} icon="📍" color="#3B82F6" />
                <KpiBox label="Radnika" value={new Set(filteredData.map(t => t.workerId)).size} icon="👷" color="#8B5CF6" />
                <KpiBox label="Projekata" value={new Set(filteredData.map(t => t.projectId)).size} icon="📋" color="#F59E0B" />
                <KpiBox label="GPS evenata" value={filteredEvents.length} icon="📡" color="#10B981" />
            </div>

            {/* Data Table */}
            <div style={styles.card}>
                {currentData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                        Nema GPS podataka za odabrani period
                    </div>
                ) : viewMode === 'workers' ? (
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                            👷 Izvještaj po radnicima ({workerReport.length})
                        </div>
                        {/* Table header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 2fr',
                            gap: 8, padding: '8px 12px',
                            background: C.bg, borderRadius: 8, marginBottom: 8,
                            fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            <div>Radnik</div>
                            <div>Dana</div>
                            <div>Sati</div>
                            {!isMobile && <div>Prosj. udalj.</div>}
                            {!isMobile && <div>Unosa</div>}
                            <div>Prisutnost</div>
                        </div>
                        {workerReport.map(w => (
                            <div key={w.workerId} style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 2fr',
                                gap: 8, padding: '12px',
                                borderBottom: `1px solid ${C.border}30`,
                                alignItems: 'center',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{w.name}</div>
                                    <div style={{ fontSize: 11, color: C.textMuted }}>{w.projects} proj.</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{w.days}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{(w.totalMins / 60).toFixed(1)}h</div>
                                {!isMobile && <div style={{ fontSize: 13, color: w.avgDist != null && w.avgDist > 300 ? '#EF4444' : C.text }}>{w.avgDist != null ? `${w.avgDist}m` : '—'}</div>}
                                {!isMobile && <div style={{ fontSize: 13, color: C.textMuted }}>{w.gpsEntries}</div>}
                                <PresenceBar pct={w.presencePct} />
                            </div>
                        ))}
                    </div>
                ) : viewMode === 'projects' ? (
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                            📋 Izvještaj po projektima ({projectReport.length})
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 2fr',
                            gap: 8, padding: '8px 12px',
                            background: C.bg, borderRadius: 8, marginBottom: 8,
                            fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            <div>Projekt</div>
                            <div>Radnika</div>
                            <div>Sati</div>
                            {!isMobile && <div>Unosa</div>}
                            <div>Prisutnost</div>
                        </div>
                        {projectReport.map(p => (
                            <div key={p.projectId} style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 2fr',
                                gap: 8, padding: '12px',
                                borderBottom: `1px solid ${C.border}30`,
                                alignItems: 'center',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{p.name}</div>
                                    <div style={{ fontSize: 11, color: C.textMuted }}>{p.days} dana</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.workerCount}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{(p.totalMins / 60).toFixed(1)}h</div>
                                {!isMobile && <div style={{ fontSize: 13, color: C.textMuted }}>{p.gpsEntries}</div>}
                                <PresenceBar pct={p.presencePct} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                            📅 Dnevni izvještaj ({dailyReport.length} dana)
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 2fr',
                            gap: 8, padding: '8px 12px',
                            background: C.bg, borderRadius: 8, marginBottom: 8,
                            fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            <div>Datum</div>
                            <div>Radnika</div>
                            <div>Sati</div>
                            {!isMobile && <div>Unosa</div>}
                            {!isMobile && <div>U zoni</div>}
                            <div>Prisutnost</div>
                        </div>
                        {dailyReport.map(d => (
                            <div key={d.date} style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 2fr',
                                gap: 8, padding: '12px',
                                borderBottom: `1px solid ${C.border}30`,
                                alignItems: 'center',
                            }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{d.date}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.workerCount}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{(d.totalMins / 60).toFixed(1)}h</div>
                                {!isMobile && <div style={{ fontSize: 13, color: C.textMuted }}>{d.entries}</div>}
                                {!isMobile && <div style={{ fontSize: 13, color: '#059669' }}>{d.inZone}</div>}
                                <PresenceBar pct={d.presencePct} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── KPI Box ──
function KpiBox({ label, value, icon, color }) {
    return (
        <div style={{
            ...styles.card, display: 'flex', alignItems: 'center', gap: 10,
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: `${color}10` }} />
            <div style={{
                width: 38, height: 38, borderRadius: 10, background: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>{icon}</div>
            <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
        </div>
    );
}
