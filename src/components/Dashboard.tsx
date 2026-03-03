import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, SvgBarChart, SvgDonutChart, SvgLineChart, SvgHBarChart, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, today } from '../utils/helpers';
import { EmptyState } from './ui/EmptyState';
import { CountUp, BentoCard, EnhancedStat, QuickAction, StatRow, HeatMap } from './dashboard/DashboardWidgets';
import { useDashboardData } from './dashboard/useDashboardData';
import './dashboard.css';

export function Dashboard({ onGoToNotifications, onNavigate }) {
    const { projects, workers, timesheets, invoices, otpremnice, obaveze, vehicles, smjestaj, auditLog, currentUser, companyProfile } = useApp();
    const isMobile = useIsMobile();
    const now = new Date();
    const [showComparison, setShowComparison] = useState(false);
    const [monthlyGoal, setMonthlyGoal] = useState(() => parseInt(localStorage.getItem('vidisef-goal') || '2000'));
    const [editingGoal, setEditingGoal] = useState(false);
    const [projectPage, setProjectPage] = useState(0);
    const [projectSort, setProjectSort] = useState({ col: 'hours', dir: 'desc' });
    const [donutPage, setDonutPage] = useState(0);

    // All data computations extracted to custom hook
    const data = useDashboardData({ projects, workers, timesheets, invoices, otpremnice, obaveze, vehicles, smjestaj, auditLog });
    const {
        activeProjects, activeWorkers, pendingTimesheets, pendingInvoices, pendingOtpremnice, pendingTotal,
        monthTimesheets, totalHoursMonth, prevMonth,
        hoursByProjectAll, hoursByType, projectTableData,
        sparkHours, sparkProjects, sparkWorkers,
        dailyHours, dailyHours30, topWorkers, heatMapData, hoursByWeekday,
        currentlyWorking, streak, prediction, nudgeMessage, weeklyDigest,
        totalInvoiceAmount, pendingInvoiceAmount, unpaidInvoices,
        financialCategories, topSuppliers,
        workersNoEntries, workersPerProject,
        costPerProject, projectStatusBreakdown,
        recentActivity, recentAudit,
        activeObaveze, completedObaveze, upcomingObaveze,
        fleetStats,
        greeting,
    } = data;

    // Donut pagination (depends on local state)
    const DONUT_PAGE_SIZE = 5;
    const donutTotalPages = Math.ceil(hoursByProjectAll.length / DONUT_PAGE_SIZE);
    const hoursByProject = useMemo(() => {
        if (hoursByProjectAll.length <= DONUT_PAGE_SIZE) return hoursByProjectAll;
        const start = donutPage * DONUT_PAGE_SIZE;
        const page = hoursByProjectAll.slice(start, start + DONUT_PAGE_SIZE);
        const rest = hoursByProjectAll.filter((_, i) => i < start || i >= start + DONUT_PAGE_SIZE);
        const restSum = rest.reduce((s, d) => s + d.value, 0);
        if (restSum > 0) page.push({ name: `Ostali (${rest.length})`, value: restSum, color: '#94A3B8' });
        return page;
    }, [hoursByProjectAll, donutPage]);

    // Project table pagination/sorting (depends on local state)
    const PROJECT_PAGE_SIZE = 5;
    const sortedProjectTable = useMemo(() => {
        return [...projectTableData].sort((a, b) =>
            projectSort.dir === 'desc' ? b[projectSort.col] - a[projectSort.col] : a[projectSort.col] - b[projectSort.col]
        );
    }, [projectTableData, projectSort]);
    const projectTablePages = Math.ceil(sortedProjectTable.length / PROJECT_PAGE_SIZE);
    const projectTableSlice = sortedProjectTable.slice(projectPage * PROJECT_PAGE_SIZE, (projectPage + 1) * PROJECT_PAGE_SIZE);

    return (
        <div>
            {/* ═══ Hero Header ═══ */}
            <div className="aurora-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div className={`dash__hero-title ${isMobile ? 'dash__hero-title--mobile' : 'dash__hero-title--desktop'}`}>
                        {greeting}, {currentUser?.name?.split(' ')[0]}
                    </div>
                    <div className="dash__hero-sub">
                        {companyProfile?.companyName || 'Vi-Di-Sef'} · {fmtDate(today())}
                    </div>
                </div>
                {pendingTotal > 0 && (
                    <button onClick={onGoToNotifications} style={{
                        ...styles.btn,
                        background: 'var(--red)',
                        animation: 'cardEntry 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both',
                        gap: 8, borderRadius: 12
                    }}>
                        <Icon name="bell" size={16} />
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pendingTotal}</span>
                        <span className="hide-mobile">na čekanju</span>
                    </button>
                )}
            </div>

            {/* ═══ Smart Nudge + Prediction ═══ */}
            {(nudgeMessage || prediction) && (
                <div className="dash__nudge-row">
                    {nudgeMessage && (
                        <div role="button" tabIndex={0} aria-label="Pogledaj obavijesti na čekanju" onClick={onGoToNotifications} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onGoToNotifications?.()} className="dash__nudge">
                            {nudgeMessage}
                        </div>
                    )}
                    {prediction && (
                        <div style={{ flex: 1, minWidth: 200, background: Math.abs(prediction.diff) > 20 ? 'var(--red-light)' : 'var(--blue-light)', borderRadius: 12, padding: '10px 16px', fontSize: 12, color: 'var(--text)', border: `1px solid ${Math.abs(prediction.diff) > 20 ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.15)'}`, animation: 'cardEntry 0.3s ease 0.1s both' }}>
                            <span className="u-fw-700">Predikcija:</span> ~{prediction.projected}h do kraja mjeseca
                            <span style={{ fontWeight: 700, color: prediction.diff > 0 ? 'var(--green)' : 'var(--red)', marginLeft: 6 }}>
                                {prediction.diff > 0 ? '↑' : '↓'}{Math.abs(prediction.diff)}% vs prošli
                            </span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({prediction.daysLeft}d preostalo)</span>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Weekly Digest ═══ */}
            {now.getDay() <= 2 && (
                <div className="dash__digest">
                    <div className="dash__digest-title">
                        Tjedni pregled
                    </div>
                    <div className="dash__digest-row">
                        <div className="dash__digest-stat"><strong className="dash__digest-value">{weeklyDigest.hours}h</strong> odrađeno</div>
                        <div className="dash__digest-stat"><strong className="dash__digest-value">{weeklyDigest.workers}</strong> radnika</div>
                        <div className="dash__digest-stat"><strong className="dash__digest-value">{weeklyDigest.projects}</strong> projekata</div>
                        <div className="dash__digest-stat"><strong className="dash__digest-value">{weeklyDigest.entries}</strong> unosa</div>
                    </div>
                </div>
            )}

            {/* ═══ Goal Progress + Comparison Toggle ═══ */}
            <div className="dash__goal-row">
                {/* Goal */}
                <div className="dash__goal-card">
                    <div className="dash__goal-header">
                        <span className="dash__goal-label">Mjesečni cilj</span>
                        {editingGoal ? (
                            <input type="number" autoFocus defaultValue={monthlyGoal} onBlur={e => { const v = parseInt(e.target.value) || 2000; setMonthlyGoal(v); localStorage.setItem('vidisef-goal', v); setEditingGoal(false); }} onKeyDown={e => e.key === 'Enter' && e.target.blur()} style={{ width: 60, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 12, background: 'var(--input-bg)', color: 'var(--text)', textAlign: 'right' }} />
                        ) : (
                            <button onClick={() => setEditingGoal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>{Math.round(totalHoursMonth / 60)}h / {monthlyGoal}h</button>
                        )}
                    </div>
                    <div className="dash__goal-bar-track">
                        <div style={{ height: '100%', borderRadius: 3, background: (totalHoursMonth / 60) / monthlyGoal > 0.8 ? 'var(--green)' : 'var(--accent)', width: `${Math.min(((totalHoursMonth / 60) / monthlyGoal) * 100, 100)}%`, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                    </div>
                    <div className="dash__goal-note">{Math.round(((totalHoursMonth / 60) / monthlyGoal) * 100)}% ostvareno — klikni za promjenu cilja</div>
                </div>
                {/* Comparison toggle */}
                <button onClick={() => setShowComparison(!showComparison)} className="s-btn" style={{ background: showComparison ? 'var(--accent)' : 'var(--card)', color: showComparison ? 'var(--text-on-accent)' : 'var(--text)', border: `1px solid ${showComparison ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, fontSize: 12, padding: '8px 14px', gap: 6 }}>
                    {showComparison ? 'Sakrij usporedbu' : 'vs prošli mjesec'}
                </button>
            </div>

            {/* ═══ Comparison Banner ═══ */}
            {showComparison && (
                <div className={`dash__compare-grid ${isMobile ? 'dash__compare-grid--mobile' : 'dash__compare-grid--desktop'}`}>
                    {[{
                        label: 'Sati', curr: Math.round(totalHoursMonth / 60), prev: Math.round(prevMonth.hours / 60), suffix: 'h'
                    }, {
                        label: 'Radnici', curr: new Set(monthTimesheets.map(t => t.workerId)).size, prev: prevMonth.workers
                    }, {
                        label: 'Projekti', curr: new Set(monthTimesheets.map(t => t.projectId)).size, prev: prevMonth.projects
                    }].map((item, i) => {
                        const diff = item.prev > 0 ? Math.round(((item.curr - item.prev) / item.prev) * 100) : 0;
                        return (
                            <div key={i} className="dash__compare-card">
                                <div className="dash__compare-label">{item.label}</div>
                                <div className="dash__compare-values">
                                    <span className="dash__compare-current">{item.curr}{item.suffix || ''}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)' }}>{diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diff)}%</span>
                                </div>
                                <div className="dash__compare-prev">Prošli: {item.prev}{item.suffix || ''}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ Stat Cards (Bento Row) ═══ */}
            <div className={`swipe-row dash__stat-grid ${isMobile ? 'dash__stat-grid--mobile' : 'dash__stat-grid--desktop'}`}>
                <EnhancedStat label="Projekti" value={activeProjects} icon="project" color="#2563EB" sub={`od ${projects.length}`} delay={0} sparkData={sparkProjects} onClick={() => onNavigate?.('projekti')} />
                <EnhancedStat label="Radnici" value={activeWorkers} icon="workers" color="#059669" sub={`od ${workers.length}`} delay={0.06} sparkData={sparkWorkers} onClick={() => onNavigate?.('radnici')} />
                <EnhancedStat label="Sati" value={Math.round(totalHoursMonth / 60)} icon="clock" color="#D95D08" suffix="h" sub={`${monthTimesheets.length} unosa`} delay={0.12} sparkData={sparkHours} onClick={() => onNavigate?.('radni-sati')} />
                <EnhancedStat label="Vozila" value={vehicles.length} icon="car" color="#7C3AED" sub={`${smjestaj.length} smještaj`} delay={0.18} onClick={() => onNavigate?.('vozila')} />
            </div>

            {/* ═══ Pending Banner (conditional) ═══ */}
            {pendingTotal > 0 && (
                <div style={{
                    ...styles.card,
                    background: 'var(--red-light)',
                    borderColor: 'rgba(220,38,38,0.15)',
                    marginBottom: 24,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: 12,
                    animation: 'cardEntry 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s both'
                }}>
                    <div>
                        <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon name="alert-circle" size={16} /> Imate stvari na čekanju
                        </div>
                        <div className="dash__pending-detail">
                            {pendingTimesheets > 0 && `${pendingTimesheets} sati · `}{pendingInvoices > 0 && `${pendingInvoices} računa · `}{pendingOtpremnice > 0 && `${pendingOtpremnice} otpremnica`}
                        </div>
                    </div>
                    <button onClick={onGoToNotifications} className="s-btn-sm" style={{ borderRadius: 10, padding: '8px 16px' }}>Pregledaj →</button>
                </div>
            )}

            {/* ═══ BENTO GRID ═══ */}
            <div className={`dash__bento-2-1 ${isMobile ? 'dash__bento-2-1--mobile' : 'dash__bento-2-1--desktop'}`} style={{ gridTemplateRows: 'auto auto' }}>
                {/* ── Activity (2×1 — first, most prominent) ── */}
                <BentoCard style={{ animationDelay: '0.1s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
                            <Icon name="history" size={14} />
                        </div>
                        Nedavna aktivnost
                    </div>
                    {recentActivity.length === 0
                        ? <div className="dash__empty" style={{ padding: 24 }}>Nema aktivnosti</div>
                        : recentActivity.map((item, i) => (
                            <div key={i} className="dash__activity-item" style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                                <div className="dash__activity-icon" style={{ background: item.type === 'timesheet' ? 'var(--accent-light)' : 'var(--blue-light)', color: item.type === 'timesheet' ? 'var(--accent)' : 'var(--blue)' }}>
                                    <Icon name={item.type === 'timesheet' ? 'clock' : 'invoice'} size={14} />
                                </div>
                                <div className="dash__activity-text">
                                    <div className="dash__activity-title">{item.text}</div>
                                    <div className="dash__activity-date">{fmtDate(item.date)}</div>
                                </div>
                                {item.status && <span style={styles.badge(item.status === 'odobren' || item.status === 'prihvaćen' ? '34,197,94' : item.status === 'na čekanju' ? '234,179,8' : '100,116,139')}>{item.status}</span>}
                            </div>
                        ))
                    }
                </BentoCard>

                {/* ── Bar Chart (2×1) ── */}
                <BentoCard style={{ animationDelay: '0.15s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                            <Icon name="report" size={14} />
                        </div>
                        Radni sati · zadnjih 14 dana
                    </div>
                    {dailyHours.length > 0
                        ? <SvgBarChart data={dailyHours} dataKey="hours" label="dan" height={isMobile ? 160 : 200} />
                        : <EmptyState emoji="" title="Nema podataka za graf" description="Sati će se prikazati kad radnici počnu unositi evidencije" compact />
                    }
                </BentoCard>

                {/* ── Donut Chart (1×1) ── */}
                <BentoCard style={{ animationDelay: '0.25s' }}>
                    <div className="u-bento-header" className="u-mb-12">
                        <div className="dash__icon-badge" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                            <Icon name="project" size={14} />
                        </div>
                        Po projektima
                        {donutTotalPages > 1 && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{donutPage + 1}/{donutTotalPages}</span>}
                    </div>
                    {hoursByProject.length > 0
                        ? <SvgDonutChart data={hoursByProject} height={isMobile ? 130 : 150} />
                        : <EmptyState emoji="📊" title="Nema podataka" description="Rasporedite radnike po projektima" compact />
                    }
                    {donutTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                            <button onClick={() => setDonutPage(p => Math.max(0, p - 1))} disabled={donutPage === 0} style={{ background: 'none', border: `1px solid var(--border)`, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: donutPage === 0 ? 'default' : 'pointer', opacity: donutPage === 0 ? 0.3 : 1, color: 'var(--text-muted)' }}>‹</button>
                            {Array.from({ length: donutTotalPages }, (_, i) => (
                                <button key={i} onClick={() => setDonutPage(i)} style={{ background: i === donutPage ? 'var(--accent)' : 'none', border: `1px solid ${i === donutPage ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: i === donutPage ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</button>
                            ))}
                            <button onClick={() => setDonutPage(p => Math.min(donutTotalPages - 1, p + 1))} disabled={donutPage >= donutTotalPages - 1} style={{ background: 'none', border: `1px solid var(--border)`, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: donutPage >= donutTotalPages - 1 ? 'default' : 'pointer', opacity: donutPage >= donutTotalPages - 1 ? 0.3 : 1, color: 'var(--text-muted)' }}>›</button>
                        </div>
                    )}
                    {/* Work type breakdown */}
                    {hoursByType.length > 0 && (
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Po tipu rada</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {hoursByType.map((t, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: `${t.color}15`, border: `1px solid ${t.color}30` }}>
                                        <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
                                        <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{t.name}</span>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: t.color }}>{t.value}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </BentoCard>
            </div>

            {/* ═══ ROW 2: Line Chart + Heat Map ═══ */}
            <div className={`dash__bento-2-1 ${isMobile ? 'dash__bento-2-1--mobile' : 'dash__bento-2-1--desktop'}`}>
                {/* ── Line Chart 30 days ── */}
                <BentoCard style={{ animationDelay: '0.3s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                            <Icon name="report" size={14} />
                        </div>
                        Trend sati · 30 dana
                    </div>
                    {dailyHours30.length > 0
                        ? <SvgLineChart data={dailyHours30} dataKey="hours" height={isMobile ? 140 : 180} color="#D95D08" />
                        : <EmptyState emoji="📈" title="Nema podataka za trend" description="Prikazat će se nakon prvih unosa" compact />
                    }
                </BentoCard>

                {/* ── Heat Map ── */}
                <BentoCard style={{ animationDelay: '0.35s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
                            <Icon name="calendar" size={14} />
                        </div>
                        Aktivnost
                    </div>
                    <HeatMap data={heatMapData} weeks={5} />
                    <div className="dash__heatmap-legend">
                        <span>Manje</span>
                        {[0.1, 0.3, 0.5, 0.7, 1].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(5,150,105,${0.2 + i * 0.8})` }} />)}
                        <span>Više</span>
                    </div>
                </BentoCard>
            </div>

            {/* ═══ ROW 3: Top Workers + Currently at Work ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Top Workers ── */}
                <BentoCard style={{ animationDelay: '0.4s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                            <Icon name="workers" size={14} />
                        </div>
                        Top radnici · ovaj mjesec
                    </div>
                    {topWorkers.length > 0 ? (
                        <div className="dash__ranking-list">
                            {topWorkers.map((w, i) => {
                                const maxH = topWorkers[0]?.hours || 1;
                                return (
                                    <div key={i} className="dash__ranking-row">
                                        <span style={{ fontSize: 11, fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--text-muted)', width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                                        <div className="dash__ranking-bar-wrap">
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(w.hours / maxH) * 100}%`, background: i < 3 ? 'var(--accent-light)' : 'var(--blue-light)', borderRadius: 6, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)', animation: `fadeIn 0.5s ease ${0.1 * i}s both` }} />
                                            <div className="dash__ranking-bar-inner">
                                                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{w.name}</span>
                                                <span style={{ fontWeight: 800, color: i < 3 ? 'var(--accent)' : 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>{w.hours}h</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <EmptyState emoji="🏆" title="Nema aktivnosti" description="Ovdje će se prikazati najaktivniji radnici" compact />}
                </BentoCard>

                {/* ── Currently at Work + Streak ── */}
                <BentoCard style={{ animationDelay: '0.45s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
                            <span className="u-fs-14">📍</span>
                        </div>
                        Danas na poslu
                        <span style={{ marginLeft: 'auto', fontSize: 24, fontWeight: 900, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{currentlyWorking.length}</span>
                    </div>
                    {currentlyWorking.length > 0 ? (
                        <div className="dash__workers-today">
                            {currentlyWorking.map((w, i) => (
                                <div key={w.id} title={w.name} style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: `hsl(${(i * 37) % 360}, 65%, 55%)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 13, fontWeight: 800,
                                    border: '2px solid var(--card-solid)',
                                    animation: `cardEntry 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
                                    position: 'relative'
                                }}>
                                    {w.name?.charAt(0)}
                                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--card-solid)', animation: 'pulse 2s ease infinite' }} />
                                </div>
                            ))}
                        </div>
                    ) : <div className="dash__empty" style={{ padding: 12, marginBottom: 16 }}>Nitko još nije evidentirao danas</div>}

                    {/* Streak */}
                    <div className="dash__streak" style={{ background: streak > 5 ? 'var(--green-light)' : streak > 0 ? 'var(--yellow-light)' : 'var(--red-light)' }}>
                        <span className="dash__streak-emoji">{streak > 5 ? '🔥' : streak > 0 ? '⚡' : '⚠️'}</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: streak > 5 ? 'var(--green)' : streak > 0 ? 'var(--yellow)' : 'var(--red)' }}>Streak: {streak} dana</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{streak > 5 ? 'Odlično! Svi redovito unose sate' : 'Konzistentnost unosa radnih sati'}</div>
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* ═══ ROW 4: Sortable Project Table ═══ */}
            <div className="u-mb-24">
                <BentoCard style={{ animationDelay: '0.5s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                            <Icon name="project" size={14} />
                        </div>
                        Aktivni projekti — pregled
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{projectTableData.length} projekata</span>
                    </div>
                    <div className="u-overflow-x">
                        <table aria-label="Projekti" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                            <thead>
                                <tr>
                                    {[{ col: 'name', label: 'Projekt' }, { col: 'location', label: 'Lokacija' }, { col: 'workers', label: 'Radnika' }, { col: 'hours', label: 'Sati' }, { col: 'cost', label: 'Troškovi (€)' }].map(h => (
                                        <th key={h.col} onClick={() => setProjectSort(s => ({ col: h.col, dir: s.col === h.col && s.dir === 'desc' ? 'asc' : 'desc' }))} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--divider)', cursor: 'pointer', textAlign: h.col === 'name' || h.col === 'location' ? 'left' : 'right', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                            {h.label} {projectSort.col === h.col ? (projectSort.dir === 'desc' ? '↓' : '↑') : ''}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {projectTableSlice.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>📍 {p.location}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--green)', textAlign: 'right' }}>{p.workers}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: 'var(--accent)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.hours}h</td>
                                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--blue)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.cost.toLocaleString('hr-HR')}€</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {projectTablePages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                            {Array.from({ length: projectTablePages }, (_, i) => (
                                <button key={i} onClick={() => setProjectPage(i)} style={{ background: i === projectPage ? 'var(--accent)' : 'none', border: `1px solid ${i === projectPage ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: i === projectPage ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</button>
                            ))}
                        </div>
                    )}
                </BentoCard>
            </div>

            {/* ═══ ROW 5: Financial + Fleet + Obaveze ═══ */}
            <div className={`dash__bento-3 ${isMobile ? 'dash__bento-3--mobile' : 'dash__bento-3--desktop'}`}>
                {/* ── Financial with Donut ── */}
                <BentoCard style={{ animationDelay: '0.55s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--yellow-light)', color: 'var(--yellow)' }}>
                            <Icon name="invoice" size={14} />
                        </div>
                        Financije
                    </div>
                    <div className="dash__fin-row">
                        <div className="dash__fin-box" style={{ background: 'var(--blue-light)' }}>
                            <div className="dash__fin-value" style={{ color: 'var(--blue)' }}><CountUp end={Math.round(totalInvoiceAmount)} />€</div>
                            <div className="dash__fin-label">Ukupno</div>
                        </div>
                        <div className="dash__fin-box" style={{ background: 'var(--yellow-light)' }}>
                            <div className="dash__fin-value" style={{ color: 'var(--yellow)' }}><CountUp end={Math.round(pendingInvoiceAmount)} />€</div>
                            <div className="dash__fin-label">Na čekanju</div>
                        </div>
                    </div>
                    {financialCategories.length > 0 && <SvgDonutChart data={financialCategories} height={120} />}
                    {topSuppliers.length > 0 && (
                        <div className="u-mt-12">
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Top dobavljači</div>
                            {topSuppliers.slice(0, 3).map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--divider)', fontSize: 12 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                                    <span style={{ fontWeight: 800, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>{s.iznos}€</span>
                                </div>
                            ))}
                        </div>
                    )}
                </BentoCard>

                {/* ── Fleet Dashboard ── */}
                <BentoCard style={{ animationDelay: '0.6s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                            <Icon name="car" size={14} />
                        </div>
                        Flota
                    </div>
                    <div className="dash__fleet-grid">
                        <div className="dash__fleet-stat" style={{ background: 'var(--purple-light)' }}>
                            <div className="dash__fleet-value" style={{ color: 'var(--purple)' }}><CountUp end={vehicles.length} /></div>
                            <div className="dash__fleet-label">Vozila</div>
                        </div>
                        <div className="dash__fleet-stat" style={{ background: 'var(--red-light)' }}>
                            <div className="dash__fleet-value" style={{ color: 'var(--red)' }}><CountUp end={fleetStats.totalCost} />€</div>
                            <div className="dash__fleet-label">Gorivo</div>
                        </div>
                        <div className="dash__fleet-stat" style={{ background: 'var(--blue-light)' }}>
                            <div className="dash__fleet-value" style={{ color: 'var(--blue)' }}><CountUp end={Math.round(fleetStats.totalKm / 1000)} />k</div>
                            <div className="dash__fleet-label">km</div>
                        </div>
                    </div>
                    {fleetStats.topFuel.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Top potrošnja goriva</div>
                            {fleetStats.topFuel.map((v, i) => {
                                const maxCost = fleetStats.topFuel[0]?.cost || 1;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                                        <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--divider)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 4, background: '#EF4444', width: `${(v.cost / maxCost) * 100}%`, transition: 'width 0.8s ease' }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.cost}€</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </BentoCard>

                {/* ── Obaveze Timeline ── */}
                <BentoCard style={{ animationDelay: '0.65s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                            <span className="u-fs-14">🎯</span>
                        </div>
                        Obaveze
                        <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>{obaveze.filter(o => o.active !== false).length}</span>
                    </div>
                    {upcomingObaveze.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {upcomingObaveze.map((o, i) => {
                                const due = o.dueDate || o.deadline || '';
                                const isOverdue = due && due < today();
                                const prioColors = { hitno: '#EF4444', visok: '#F59E0B', normalan: '#3B82F6' };
                                const prioColor = prioColors[o.priority] || '#3B82F6';
                                return (
                                    <div key={o.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: isOverdue ? 'rgba(239,68,68,0.08)' : 'var(--divider)', borderLeft: `3px solid ${prioColor}` }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                                            {due && <div style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--text-muted)', fontWeight: isOverdue ? 700 : 400 }}>{isOverdue ? '⚠️ ' : '📅 '}{fmtDate(due)}</div>}
                                        </div>
                                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: prioColor, padding: '2px 6px', borderRadius: 4, background: `${prioColor}15` }}>{o.priority || 'normalan'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div className="dash__empty" className="u-p-20">Nema aktivnih obaveza</div>}
                </BentoCard>
            </div>

            {/* ═══ ROW 6: Workers without entries + Weekday Pattern ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Workers without entries (>2 days) ── */}
                <BentoCard style={{ animationDelay: '0.7s' }}>
                    <div className="u-bento-header">
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: workersNoEntries.length > 0 ? 'var(--red-light)' : 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: workersNoEntries.length > 0 ? 'var(--red)' : 'var(--green)' }}>
                            <Icon name="alert-circle" size={14} />
                        </div>
                        Bez unosa sati
                        <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: workersNoEntries.length > 0 ? 'var(--red)' : 'var(--green)' }}>{workersNoEntries.length}</span>
                    </div>
                    {workersNoEntries.length > 0 ? (
                        <div className="u-flex-col u-gap-6">
                            {workersNoEntries.map((w, i) => (
                                <div key={w.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: w.days > 7 ? 'rgba(239,68,68,0.06)' : 'var(--divider)', borderLeft: `3px solid ${w.days > 7 ? 'var(--red)' : w.days > 4 ? 'var(--yellow)' : 'var(--text-muted)'}` }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{w.name}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: w.days > 7 ? 'var(--red)' : w.days > 4 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                                        {w.days > 100 ? 'Nikada' : `${w.days}d`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : <div style={{ color: 'var(--green)', fontSize: 13, padding: 20, textAlign: 'center', fontWeight: 600 }}>Svi radnici su aktivni</div>}
                </BentoCard>

                {/* ── Weekday Pattern ── */}
                <BentoCard style={{ animationDelay: '0.75s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                            <Icon name="calendar" size={14} />
                        </div>
                        Sati po danu u tjednu
                    </div>
                    <SvgBarChart data={hoursByWeekday} dataKey="hours" label="name" height={isMobile ? 130 : 160} color="#D95D08" />
                </BentoCard>
            </div>

            {/* ═══ ROW 7: Workers per Project + Cost per Project ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Workers per project ── */}
                <BentoCard style={{ animationDelay: '0.8s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
                            <Icon name="workers" size={14} />
                        </div>
                        Radnici po projektima
                    </div>
                    {workersPerProject.length > 0 ? (
                        <div className="u-flex-col u-gap-6">
                            {workersPerProject.map((p, i) => {
                                const maxV = workersPerProject[0]?.value || 1;
                                return (
                                    <div key={i} className="u-flex-center u-gap-8">
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                                        <div style={{ flex: 1, height: 20, borderRadius: 5, background: 'var(--divider)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 5, background: p.color, width: `${(p.value / maxV) * 100}%`, transition: 'width 0.8s ease', animation: `fadeIn 0.5s ease ${0.1 * i}s both` }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: p.color, width: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div className="dash__empty" className="u-p-20">Nema podataka</div>}
                </BentoCard>

                {/* ── Cost per project ── */}
                <BentoCard style={{ animationDelay: '0.85s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--red-light)', color: 'var(--red)' }}>
                            <Icon name="invoice" size={14} />
                        </div>
                        Troškovi po projektu
                    </div>
                    {costPerProject.length > 0 ? (
                        <div className="u-flex-col u-gap-6">
                            {costPerProject.map((p, i) => {
                                const maxC = costPerProject[0]?.cost || 1;
                                return (
                                    <div key={i} className="u-flex-center u-gap-8">
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                                        <div style={{ flex: 1, height: 20, borderRadius: 5, background: 'var(--divider)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 5, background: p.color, width: `${(p.cost / maxC) * 100}%`, transition: 'width 0.8s ease', animation: `fadeIn 0.5s ease ${0.1 * i}s both` }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: p.color, width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.cost.toLocaleString('hr-HR')}€</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div className="dash__empty" className="u-p-20">Nema podataka</div>}
                </BentoCard>
            </div>

            {/* ═══ ROW 8: Project Status + Unpaid Invoices ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Project Status Donut ── */}
                <BentoCard style={{ animationDelay: '0.9s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                            <Icon name="project" size={14} />
                        </div>
                        Status projekata
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{projects.length} ukupno</span>
                    </div>
                    {projectStatusBreakdown.length > 0
                        ? <SvgDonutChart data={projectStatusBreakdown} height={isMobile ? 120 : 140} />
                        : <div className="dash__empty" className="u-p-20">Nema projekata</div>
                    }
                </BentoCard>

                {/* ── Unpaid Invoices Highlight ── */}
                <BentoCard style={{ animationDelay: '0.95s' }}>
                    <div className="u-bento-header">
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: unpaidInvoices.count > 0 ? 'var(--yellow-light)' : 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: unpaidInvoices.count > 0 ? 'var(--yellow)' : 'var(--green)' }}>
                            <Icon name="invoice" size={14} />
                        </div>
                        Neplaćeni računi
                    </div>
                    <div className="dash__unpaid-center">
                        <div className="dash__unpaid-count" style={{ color: unpaidInvoices.count > 0 ? 'var(--yellow)' : 'var(--green)' }}>
                            <CountUp end={unpaidInvoices.count} />
                        </div>
                        <div className="dash__unpaid-sub">računa na čekanju</div>
                        {unpaidInvoices.total > 0 && (
                            <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 10, background: 'var(--yellow-light)', display: 'inline-block' }}>
                                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--yellow)', fontVariantNumeric: 'tabular-nums' }}>{unpaidInvoices.total.toLocaleString('hr-HR')}€</span>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>ukupni iznos</div>
                            </div>
                        )}
                        {unpaidInvoices.count === 0 && (
                            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginTop: 12 }}>Sve je plaćeno</div>
                        )}
                    </div>
                </BentoCard>
            </div>

            {/* ═══ ROW 9: Audit Log ═══ */}
            <div className="u-mb-24">
                <BentoCard style={{ animationDelay: '0.65s' }}>
                    <div className="u-bento-header">
                        <div className="dash__icon-badge" style={{ background: 'var(--red-light)', color: 'var(--red)' }}>
                            <Icon name="security" size={14} />
                        </div>
                        Audit Log
                        <button onClick={() => window.print()} style={{ marginLeft: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📸 Export
                        </button>
                    </div>
                    {auditLog.length === 0
                        ? <div className="dash__empty" className="u-p-16">Nema log zapisa</div>
                        : auditLog.slice(-5).reverse().map((entry, i) => {
                            const timeAgo = (() => {
                                if (!entry.timestamp) return '';
                                const d = Math.round((Date.now() - new Date(entry.timestamp).getTime()) / 60000);
                                if (d < 1) return 'upravo';
                                if (d < 60) return `${d}min`;
                                if (d < 1440) return `${Math.round(d / 60)}h`;
                                return `${Math.round(d / 1440)}d`;
                            })();
                            return (
                                <div key={entry.id || i} className="dash__audit-item" style={{ borderBottom: i < 4 ? '1px solid var(--divider)' : 'none', animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
                                    <div className="dash__audit-icon">📝</div>
                                    <div className="dash__audit-text">
                                        <div className="dash__audit-action">{entry.action}</div>
                                        <div className="dash__audit-detail">{entry.user} {entry.details ? `· ${entry.details}` : ''}</div>
                                    </div>
                                    <span className="dash__audit-time">{timeAgo}</span>
                                </div>
                            );
                        })
                    }
                </BentoCard>
            </div>
        </div>
    );
}
