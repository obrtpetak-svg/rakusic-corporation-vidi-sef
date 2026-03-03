import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, StatusBadge, SvgBarChart, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, diffMins, fmtHours } from '../utils/helpers';

// TODO: define proper Timesheet/Project/Worker types when AppContext is migrated
interface Timesheet {
    id: string;
    workerId: string;
    projectId: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMins?: number;
    status: string;
    rejectReason?: string;
    [key: string]: unknown;
}

interface Project {
    id: string;
    name: string;
    [key: string]: unknown;
}

interface BarData {
    name: string;
    hours: number;
}

export function WorkerEvidencija(): React.JSX.Element {
    const { currentUser, timesheets, projects, workers } = useApp();
    const isMobile = useIsMobile();
    const userId = currentUser?.workerId || currentUser?.id;

    const myTs = useMemo((): Timesheet[] => {
        return (timesheets as Timesheet[]).filter(t => t.workerId === userId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [timesheets, userId]);

    const totalMins = myTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime) - (t.breakMins || 0), 0);
    const approvedMins = myTs.filter(t => t.status === 'odobren').reduce((s, t) => s + diffMins(t.startTime, t.endTime) - (t.breakMins || 0), 0);
    const pendingCount = myTs.filter(t => t.status === 'na čekanju').length;
    const rejectedCount = myTs.filter(t => t.status === 'odbijen').length;

    // Hours per project
    const byProject = useMemo((): BarData[] => {
        const map: Record<string, number> = {};
        myTs.forEach(t => { const p = (projects as Project[]).find(x => x.id === t.projectId); map[p?.name || '?'] = (map[p?.name || '?'] || 0) + diffMins(t.startTime, t.endTime); });
        return Object.entries(map).map(([name, mins]) => ({ name, hours: +(mins / 60).toFixed(1) })).sort((a, b) => b.hours - a.hours);
    }, [myTs, projects]);

    // Last 7 days
    const daily = useMemo((): BarData[] => {
        const result: BarData[] = [];
        for (let d = 6; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const dateStr = dt.toISOString().slice(0, 10);
            const dayMin = myTs.filter(t => t.date === dateStr).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            result.push({ name: `${dt.getDate()}.${dt.getMonth() + 1}`, hours: +(dayMin / 60).toFixed(1) });
        }
        return result;
    }, [myTs]);

    return (
        <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>📊 Moja evidencija</div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <div style={styles.card} className="u-text-center"><div className="u-stat-label">Ukupno sati</div><div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{(totalMins / 60).toFixed(1)}h</div></div>
                <div style={styles.card} className="u-text-center"><div className="u-stat-label">Odobreno</div><div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{(approvedMins / 60).toFixed(1)}h</div></div>
                <div style={styles.card} className="u-text-center"><div className="u-stat-label">Na čekanju</div><div style={{ fontSize: 28, fontWeight: 800, color: C.yellow }}>{pendingCount}</div></div>
                <div style={styles.card} className="u-text-center"><div className="u-stat-label">Odbijeno</div><div style={{ fontSize: 28, fontWeight: 800, color: C.red }}>{rejectedCount}</div></div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={styles.card}><div className="u-section-title u-mb-12">Zadnjih 7 dana</div><SvgBarChart data={daily} dataKey="hours" label="name" height={160} /></div>
                <div style={styles.card}><div className="u-section-title u-mb-12">Po projektima</div>
                    {byProject.length > 0 ? byProject.map(p => (
                        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}7A`, fontSize: 13 }}>
                            <span style={{ fontWeight: 600, color: C.textDim }}>{p.name}</span>
                            <span style={{ fontWeight: 700, color: C.accent }}>{p.hours}h</span>
                        </div>
                    )) : <div style={{ color: C.textMuted, fontSize: 13 }}>Nema podataka</div>}
                </div>
            </div>

            {/* History */}
            <div style={styles.card}>
                <div className="u-section-title u-mb-12">Povijest ({myTs.length} unosa)</div>
                <div className="u-overflow-x">
                    <table aria-label="Projekti" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                        <thead><tr><th style={styles.th}>Datum</th><th style={styles.th}>Projekt</th><th style={styles.th}>Od</th><th style={styles.th}>Do</th><th style={styles.th}>Sati</th><th style={styles.th}>Status</th></tr></thead>
                        <tbody>
                            {myTs.slice(0, 50).map(t => {
                                const p = (projects as Project[]).find(x => x.id === t.projectId);
                                const mins = diffMins(t.startTime, t.endTime) - (t.breakMins || 0);
                                return (
                                    <tr key={t.id}>
                                        <td style={styles.td}>{fmtDate(t.date)}</td>
                                        <td style={{ ...styles.td, fontWeight: 600 }}>{p?.name || '—'}</td>
                                        <td style={styles.td}>{t.startTime}</td>
                                        <td style={styles.td}>{t.endTime}</td>
                                        <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{(mins / 60).toFixed(1)}h</td>
                                        <td style={styles.td}><StatusBadge status={t.status} />{t.rejectReason && <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{t.rejectReason}</div>}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {myTs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.textMuted }}>Još nemate unosa</div>}
            </div>
        </div>
    );
}
