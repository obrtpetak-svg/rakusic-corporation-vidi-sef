import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, Select, StatusBadge, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, diffMins } from '../utils/helpers';

export function KalendarPage() {
    const { timesheets, workers, projects } = useApp();
    const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
    const [filterWorker, setFilterWorker] = useState('all');
    const [filterProject, setFilterProject] = useState('all');
    const isMobile = useIsMobile();

    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');
    const activeProjects = projects.filter(p => p.status === 'aktivan');

    const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const monthNames = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];

    const monthTs = useMemo(() => {
        const prefix = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
        let list = timesheets.filter(t => t.date && t.date.startsWith(prefix));
        if (filterWorker !== 'all') list = list.filter(t => t.workerId === filterWorker);
        if (filterProject !== 'all') list = list.filter(t => t.projectId === filterProject);
        return list;
    }, [timesheets, currentMonth, filterWorker, filterProject]);

    const totalMonthHours = useMemo(() => monthTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60, [monthTs]);
    const uniqueWorkers = useMemo(() => new Set(monthTs.map(t => t.workerId)).size, [monthTs]);
    const uniqueProjects = useMemo(() => new Set(monthTs.map(t => t.projectId)).size, [monthTs]);

    const [selectedDay, setSelectedDay] = useState(null);
    const selectedTs = selectedDay ? monthTs.filter(t => t.date === selectedDay) : [];

    const prev = () => setCurrentMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 });
    const next = () => setCurrentMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 });
    const goToday = () => { const d = new Date(); setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() }); };

    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const todayStr = new Date().toISOString().slice(0, 10);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="u-fs-22 u-fw-800" style={{ color: C.text }}> Kalendar</div>
                    <div className="u-fs-12" style={{ color: C.textMuted }}>{monthTs.length} unosa • {totalMonthHours.toFixed(1)}h • {uniqueWorkers} radnika • {uniqueProjects} projekata</div>
                </div>
                <button onClick={goToday} style={styles.btnSmall}>Danas</button>
            </div>

            {/* Filters */}
            <div style={{ ...styles.card, marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>FILTERI:</div>
                <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ width: 170 }}>
                    <option value="all">Svi radnici ({activeWorkers.length})</option>
                    {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
                <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: 170 }}>
                    <option value="all">Svi projekti ({activeProjects.length})</option>
                    {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                {(filterWorker !== 'all' || filterProject !== 'all') && (
                    <button onClick={() => { setFilterWorker('all'); setFilterProject('all'); }} style={{ ...styles.btnSmall, color: C.red, borderColor: 'rgba(239,68,68,0.2)', fontSize: 11 }}>✕ Očisti filtere</button>
                )}
            </div>

            <div style={styles.card}>
                {/* Month nav */}
                <div className="u-flex-between u-mb-20">
                    <button onClick={prev} style={styles.btnSecondary}><Icon name="back" size={16} /></button>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{monthNames[currentMonth.month]} {currentMonth.year}</div>
                    <button onClick={next} style={{ ...styles.btnSecondary, transform: 'rotate(180deg)' }}><Icon name="back" size={16} /></button>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                    {['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '8px 0', textTransform: 'uppercase' }}>{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                    {cells.map((day, i) => {
                        if (!day) return <div key={`empty-${i}`} />;
                        const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayTs = monthTs.filter(t => t.date === dateStr);
                        const totalMins = dayTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === selectedDay;
                        const isWeekend = (i % 7) >= 5;
                        const workerCount = new Set(dayTs.map(t => t.workerId)).size;

                        return (
                            <div key={day} onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                                style={{
                                    padding: isMobile ? '6px 2px' : '8px 6px', borderRadius: 8, cursor: 'pointer', minHeight: isMobile ? 50 : 70, transition: 'all 0.15s',
                                    background: isSelected ? C.accentLight : isToday ? 'rgba(59,130,246,0.08)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                                    border: isSelected ? `2px solid ${C.accent}` : isToday ? `2px solid ${C.blue}` : '2px solid transparent'
                                }}>
                                <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? C.blue : isWeekend ? C.textMuted : C.text, marginBottom: 4 }}>{day}</div>
                                {dayTs.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{(totalMins / 60).toFixed(1)}h</div>
                                        <div style={{ fontSize: 10, color: C.textMuted }}>{workerCount} rad. • {dayTs.length} un.</div>
                                        {!isMobile && dayTs.slice(0, 2).map((t, j) => {
                                            const w = workers.find(x => x.id === t.workerId);
                                            return <div key={j} style={{ fontSize: 9, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{w?.name?.split(' ')[0]}</div>;
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected day detail */}
            {selectedDay && selectedTs.length > 0 && (
                <div style={{ ...styles.card, marginTop: 20 }}>
                    <div className="u-card-header">
                        <div className="u-section-title">{fmtDate(selectedDay)} — {selectedTs.length} unos{selectedTs.length > 1 ? 'a' : ''} ({(selectedTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1)}h)</div>
                        <div className="u-fs-12" style={{ color: C.textMuted }}>{new Set(selectedTs.map(t => t.workerId)).size} radnika</div>
                    </div>
                    {selectedTs.map(t => {
                        const w = workers.find(x => x.id === t.workerId);
                        const p = projects.find(x => x.id === t.projectId);
                        const mins = diffMins(t.startTime, t.endTime);
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}7A`, fontSize: 13 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.accent }}>{w?.name?.charAt(0)}</div>
                                    <div><div className="u-fw-600">{w?.name || '—'}</div><div className="u-fs-11" style={{ color: C.textMuted }}>{p?.name || '—'} • {t.startTime}–{t.endTime}</div></div>
                                </div>
                                <div className="u-flex-center u-gap-8">
                                    <span style={{ fontWeight: 700, color: C.accent }}>{(mins / 60).toFixed(1)}h</span>
                                    <StatusBadge status={t.status} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedDay && selectedTs.length === 0 && (
                <div style={{ ...styles.card, marginTop: 20, textAlign: 'center', padding: 30, color: C.textMuted }}>Nema unosa za {fmtDate(selectedDay)}</div>
            )}
        </div>
    );
}
