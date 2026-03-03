import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, SvgBarChart, SvgHBarChart, SvgLineChart, SvgDonutChart, Select, Input, useIsMobile } from './ui/SharedComponents';
import { C, styles, today, fmtDate, diffMins } from '../utils/helpers';
import { useReportExports } from './reports/useReportExports';
import './reports.css';

export function ReportsPage() {
    const { workers, projects, timesheets, invoices, vehicles, smjestaj, otpremnice, companyProfile, loadAllTimesheets } = useApp();

    // Load full timesheet history for reports
    useEffect(() => { loadAllTimesheets(); }, [loadAllTimesheets]);
    const [tab, setTab] = useState('radnici');
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
    const [dateTo, setDateTo] = useState(() => today());
    const [filterWorker, setFilterWorker] = useState('sve');
    const [filterProject, setFilterProject] = useState('sve');
    const [filterVehicle, setFilterVehicle] = useState('sve');
    const isMobile = useIsMobile();

    // Filtered timesheets by date + worker + project
    const periodTs = useMemo(() => {
        let list = timesheets.filter(t => (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo));
        if (filterWorker !== 'sve') list = list.filter(t => t.workerId === filterWorker);
        if (filterProject !== 'sve') list = list.filter(t => t.projectId === filterProject);
        return list;
    }, [timesheets, dateFrom, dateTo, filterWorker, filterProject]);

    const periodInvoices = useMemo(() => {
        let list = invoices.filter(i => (!dateFrom || i.date >= dateFrom) && (!dateTo || i.date <= dateTo));
        if (filterWorker !== 'sve') list = list.filter(i => i.workerId === filterWorker);
        if (filterProject !== 'sve') list = list.filter(i => i.projectId === filterProject);
        return list;
    }, [invoices, dateFrom, dateTo, filterWorker, filterProject]);

    // Hours by worker
    const hoursByWorker = useMemo(() =>
        workers.filter(w => w.role !== 'admin').map(w => ({
            id: w.id, name: w.name,
            sati: +(periodTs.filter(t => t.workerId === w.id).reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60).toFixed(1),
            unosa: periodTs.filter(t => t.workerId === w.id).length,
            normalan: +(periodTs.filter(t => t.workerId === w.id && (!t.type || t.type === 'normalan')).reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60).toFixed(1),
            prekovremeni: +(periodTs.filter(t => t.workerId === w.id && t.type === 'prekovremeni').reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60).toFixed(1),
            nocni: +(periodTs.filter(t => t.workerId === w.id && t.type === 'noćni').reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60).toFixed(1),
            vikend: +(periodTs.filter(t => t.workerId === w.id && t.type === 'vikend').reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60).toFixed(1),
        })).filter(w => w.sati > 0).sort((a, b) => b.sati - a.sati)
        , [periodTs, workers]);

    // Hours by project
    const chartColors = ['#1D4ED8', '#047857', '#B91C1C', '#7C3AED', '#B45309', '#0891B2', '#4F46E5', '#059669'];
    const hoursByProject = useMemo(() =>
        projects.map((p, i) => ({
            name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
            fullName: p.name, id: p.id,
            sati: +(periodTs.filter(t => t.projectId === p.id).reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60).toFixed(1),
            trošak: periodInvoices.filter(inv => inv.projectId === p.id).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0),
            value: Math.round(periodTs.filter(t => t.projectId === p.id).reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60),
            color: chartColors[i % chartColors.length],
            radnika: new Set(periodTs.filter(t => t.projectId === p.id).map(t => t.workerId)).size
        })).filter(p => p.sati > 0).sort((a, b) => b.sati - a.sati)
        , [periodTs, periodInvoices, projects]);

    // Daily timeline
    const dailyTrend = useMemo(() => {
        const map = {};
        periodTs.forEach(t => { map[t.date] = (map[t.date] || 0) + (t.durationMins || diffMins(t.startTime, t.endTime)); });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([date, mins]) => ({
            dan: new Date(date).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' }),
            sati: +(mins / 60).toFixed(1)
        }));
    }, [periodTs]);

    // Costs breakdown
    const costsByProject = useMemo(() =>
        projects.map(p => ({
            name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
            fullName: p.name,
            iznos: periodInvoices.filter(inv => inv.projectId === p.id).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0)
        })).filter(p => p.iznos > 0).sort((a, b) => b.iznos - a.iznos)
        , [periodInvoices, projects]);

    // Costs by category
    const costsByCategory = useMemo(() => {
        const map = {};
        periodInvoices.forEach(i => { const c = i.category || 'Ostalo'; map[c] = (map[c] || 0) + (parseFloat(i.amount) || 0); });
        return Object.entries(map).map(([name, iznos]) => ({ name, iznos })).sort((a, b) => b.iznos - a.iznos);
    }, [periodInvoices]);

    // Vehicle fuel costs
    const vehicleData = useMemo(() => {
        let vList = (vehicles || []);
        if (filterVehicle !== 'sve') vList = vList.filter(v => v.id === filterVehicle);
        return vList.map(v => {
            const logs = (v.fuelLogs || []).filter(f => (!dateFrom || f.date >= dateFrom) && (!dateTo || f.date <= dateTo));
            return {
                id: v.id, name: v.name || v.regNumber,
                litara: logs.reduce((s, f) => s + (parseFloat(f.liters) || 0), 0),
                trošak: logs.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0),
                km: logs.reduce((s, f) => s + (parseFloat(f.km) || 0), 0),
                unosa: logs.length
            };
        }).filter(v => v.trošak > 0 || v.litara > 0).sort((a, b) => b.trošak - a.trošak);
    }, [vehicles, dateFrom, dateTo, filterVehicle]);

    // Summary stats
    const totalHours = periodTs.reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0);
    const totalCosts = periodInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const avgHoursPerDay = dailyTrend.length > 0 ? (totalHours / 60 / dailyTrend.length).toFixed(1) : 0;
    const activeWorkersCount = new Set(periodTs.map(t => t.workerId)).size;
    const activeProjectsCount = new Set(periodTs.map(t => t.projectId)).size;

    // Weekly distribution
    const weeklyDist = useMemo(() => {
        const days = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
        const map = [0, 0, 0, 0, 0, 0, 0];
        periodTs.forEach(t => { const d = new Date(t.date).getDay(); map[d] += (t.durationMins || diffMins(t.startTime, t.endTime)) / 60; });
        return days.map((name, i) => ({ name, sati: +map[i].toFixed(1) }));
    }, [periodTs]);

    // Work type distribution
    const typeDistribution = useMemo(() => {
        const types = { normalan: 0, prekovremeni: 0, noćni: 0, vikend: 0 };
        periodTs.forEach(t => { const type = t.type || 'normalan'; types[type] = (types[type] || 0) + (t.durationMins || diffMins(t.startTime, t.endTime)) / 60; });
        const colors = ['#1D4ED8', '#B91C1C', '#7C3AED', '#B45309'];
        return Object.entries(types).filter(([, v]) => v > 0).map(([name, value], i) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value), color: colors[i] }));
    }, [periodTs]);


    const tabs = [
        { id: 'radnici', label: 'Po radnicima' },
        { id: 'projekti', label: 'Po projektima' },
        { id: 'troskovi', label: 'Troškovi' },
        { id: 'izvjesca', label: 'Izvješća' },
        { id: 'vozila', label: 'Vozila' },
        { id: 'produktivnost', label: 'Produktivnost' },
        { id: 'prisutnost', label: 'Prisutnost' },
        { id: 'otpremnice', label: 'Otpremnice' },
        { id: 'sve', label: 'Sve podatke' },
    ];

    // Productivity data
    const productivity = useMemo(() => {
        return workers.filter(w => w.active !== false && w.role !== 'admin').map(w => {
            const wTs = periodTs.filter(t => t.workerId === w.id);
            const totalH = wTs.reduce((s, t) => s + (t.durationMins || diffMins(t.startTime, t.endTime)), 0) / 60;
            const days = new Set(wTs.map(t => t.date)).size;
            const avgH = days > 0 ? totalH / days : 0;
            const projectCount = new Set(wTs.map(t => t.projectId)).size;
            const overtimeH = wTs.filter(t => t.type === 'prekovremeni').reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60;
            return { name: w.name, totalH: +totalH.toFixed(1), days, avgH: +avgH.toFixed(1), projects: projectCount, overtime: +overtimeH.toFixed(1), efficiency: days > 0 ? Math.min(100, Math.round(avgH / 8 * 100)) : 0 };
        }).filter(w => w.totalH > 0).sort((a, b) => b.totalH - a.totalH);
    }, [periodTs, workers]);

    // Attendance data
    const attendance = useMemo(() => {
        const dFrom = new Date(dateFrom);
        const dTo = new Date(dateTo);
        const totalWorkDays = Math.max(1, Math.ceil((dTo - dFrom) / 86400000) - Math.floor((dTo - dFrom) / 86400000 / 7) * 2);
        return workers.filter(w => w.active !== false && w.role !== 'admin').map(w => {
            const wTs = periodTs.filter(t => t.workerId === w.id);
            const present = new Set(wTs.map(t => t.date)).size;
            const absent = Math.max(0, totalWorkDays - present);
            const lateCount = wTs.filter(t => t.startTime > '08:00').length;
            return { name: w.name, present, absent, late: lateCount, rate: Math.round(present / totalWorkDays * 100), totalDays: totalWorkDays };
        }).sort((a, b) => b.present - a.present);
    }, [periodTs, workers, dateFrom, dateTo]);

    // Otpremnice data
    const otpremnicePeriod = useMemo(() => {
        let list = (otpremnice || []);
        if (dateFrom) list = list.filter(o => (o.date || '') >= dateFrom);
        if (dateTo) list = list.filter(o => (o.date || '') <= dateTo);
        if (filterProject !== 'sve') list = list.filter(o => o.projectId === filterProject);
        return list;
    }, [otpremnice, dateFrom, dateTo, filterProject]);

    const otpStats = useMemo(() => {
        const totalAmount = otpremnicePeriod.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
        const approved = otpremnicePeriod.filter(o => String(o.status).includes('odobren')).length;
        const pending = otpremnicePeriod.filter(o => String(o.status).includes('čekanju')).length;
        // By project
        const byProject = {};
        otpremnicePeriod.forEach(o => {
            const pn = projects.find(p => p.id === o.projectId)?.name || 'Bez projekta';
            byProject[pn] = (byProject[pn] || 0) + (parseFloat(o.amount) || 0);
        });
        const projectChart = Object.entries(byProject).map(([name, value], i) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, iznos: +value.toFixed(2), color: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EF4444', '#0891B2'][i % 6] })).sort((a, b) => b.iznos - a.iznos).slice(0, 8);
        // By supplier
        const bySupplier = {};
        otpremnicePeriod.forEach(o => {
            const sup = o.supplier || '—';
            bySupplier[sup] = (bySupplier[sup] || 0) + (parseFloat(o.amount) || 0);
        });
        const supplierChart = Object.entries(bySupplier).map(([name, value], i) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, iznos: +value.toFixed(2), color: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EF4444'][i % 5] })).sort((a, b) => b.iznos - a.iznos).slice(0, 8);
        // Status chart
        const statusChart = [
            { name: 'Odobrene', value: approved, color: '#10B981' },
            { name: 'Na čekanju', value: pending, color: '#F59E0B' },
            { name: 'Ostalo', value: Math.max(0, otpremnicePeriod.length - approved - pending), color: '#94A3B8' },
        ].filter(x => x.value > 0);
        return { totalAmount: totalAmount.toFixed(2), count: otpremnicePeriod.length, approved, pending, avgAmount: otpremnicePeriod.length > 0 ? (totalAmount / otpremnicePeriod.length).toFixed(2) : '0.00', projectChart, supplierChart, statusChart };
    }, [otpremnicePeriod, projects]);

    // CSV/PDF exports — must be after otpremnicePeriod & otpStats are defined
    const { exportCSV, exportPDF, exportWorkersPDF, exportProjectsPDF, exportCostsPDF, exportVehiclesPDF, exportOtpremnicePDF } = useReportExports({
        periodTs, periodInvoices, workers, projects, vehicles, otpremnice, companyProfile,
        hoursByWorker, hoursByProject, totalHours, totalCosts, activeWorkersCount,
        costsByProject, costsByCategory, vehicleData, otpremnicePeriod, otpStats,
        dateFrom, dateTo, filterWorker, filterProject, filterVehicle,
    });

    const StatCard = ({ label, value, color, sub }) => (
        <div className="s-card" className="u-text-center">
            <div className="u-stat-label">{label}</div>
            <div className="reports__stat-value" style={{ color: color || C.accent }}>{value}</div>
            {sub && <div className="u-fs-11 u-text-muted">{sub}</div>}
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="reports__header">
                <div className="u-fs-24 u-fw-800 u-color-text"> Izvještaji</div>
                <div className="reports__header-actions">
                    <button onClick={exportCSV} className="s-btn-sec"><Icon name="download" size={14} /> CSV</button>
                    <button onClick={exportPDF} className="s-btn"><Icon name="file" size={14} /> PDF</button>
                </div>
            </div>

            {/* Filters */}
            <div className="s-card" className="reports__filters">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="reports__date-input" />
                <span className="u-text-muted">—</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="reports__date-input" />
                <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} className="reports__filter-select">
                    <option value="sve">Svi radnici</option>
                    {workers.filter(w => w.role !== 'admin').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
                <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="reports__filter-select">
                    <option value="sve">Svi projekti</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
            </div>

            {/* Summary cards */}
            <div className={`reports__stats-6 ${isMobile ? 'reports__stats-6--mobile' : 'reports__stats-6--desktop'}`}>
                <StatCard label="Ukupno sati" value={`${Math.round(totalHours / 60)}h`} color={C.accent} />
                <StatCard label="Unosa" value={periodTs.length} color={C.blue} />
                <StatCard label="Radnika" value={activeWorkersCount} color={C.green} />
                <StatCard label="Projekata" value={activeProjectsCount} color="#7C3AED" />
                <StatCard label="Troškovi" value={`${totalCosts.toFixed(0)}€`} color={C.red} />
                <StatCard label="Prosj./dan" value={`${avgHoursPerDay}h`} color="#B45309" sub={`${dailyTrend.length} dana`} />
            </div>

            {/* Tabs */}
            <div className="reports__tabs">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`reports__tab ${tab === t.id ? 'reports__tab--active' : 'reports__tab--inactive'}`}>{t.label}</button>
                ))}
            </div>

            {/* Tab: Po radnicima */}
            {tab === 'radnici' && (
                <div>
                    <div className="reports__tab-actions">
                        <button onClick={exportWorkersPDF} className="s-btn"><Icon name="file" size={14} /> PDF Radnici</button>
                    </div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card"><div className="u-section-title u-mb-12">Sati po radnicima</div><SvgHBarChart data={hoursByWorker} dataKey="sati" height={Math.max(150, hoursByWorker.length * 36)} /></div>
                        <div className="s-card"><div className="u-section-title u-mb-12">Dnevni trend</div><SvgLineChart data={dailyTrend} dataKey="sati" height={200} /></div>
                    </div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card"><div className="u-section-title u-mb-12">Tip rada raspodjela</div><SvgDonutChart data={typeDistribution} height={160} /></div>
                        <div className="s-card"><div className="u-section-title u-mb-12">Po danima u tjednu</div><SvgBarChart data={weeklyDist} dataKey="sati" label="name" height={160} color="#047857" /></div>
                    </div>
                    <div className="s-card">
                        <div className="u-card-header">
                            <div className="u-section-title">Detaljna tablica po radnicima</div>
                            <div className="u-fs-12 u-text-muted">{hoursByWorker.length} radnika | {filterWorker !== 'sve' ? workers.find(w => w.id === filterWorker)?.name : 'Svi'}{filterProject !== 'sve' ? ` • ${projects.find(p => p.id === filterProject)?.name}` : ''}</div>
                        </div>
                        <div className="u-overflow-x"><table aria-label="Podaci" className="u-table" style={{ minWidth: 600 }}><thead><tr><th className="s-th">Radnik</th><th className="s-th">Sati</th><th className="s-th">Normalan</th><th className="s-th">Prekovrm.</th><th className="s-th">Noćni</th><th className="s-th">Vikend</th><th className="s-th">Unosa</th><th className="s-th">Prosj/dan</th></tr></thead><tbody>
                            {hoursByWorker.map(w => <tr key={w.name}><td className="s-td" className="u-fw-600">{w.name}</td><td className="s-td" className="u-fw-700" style={{ color: 'var(--accent)' }}>{w.sati}h</td><td className="s-td">{w.normalan}h</td><td className="s-td">{w.prekovremeni}h</td><td className="s-td">{w.nocni}h</td><td className="s-td">{w.vikend}h</td><td className="s-td">{w.unosa}</td><td className="s-td">{w.unosa > 0 ? (w.sati / w.unosa).toFixed(1) : 0}h</td></tr>)}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Po projektima */}
            {tab === 'projekti' && (
                <div>
                    <div className="reports__tab-actions">
                        <button onClick={exportProjectsPDF} className="s-btn" style={{ background: '#047857' }}><Icon name="file" size={14} /> PDF Projekti</button>
                    </div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card"><div className="u-section-title u-mb-12">Raspodjela sati</div><SvgDonutChart data={hoursByProject} height={200} /></div>
                        <div className="s-card"><div className="u-section-title u-mb-12">Usporedba projekata</div><SvgBarChart data={hoursByProject} dataKey="sati" label="name" height={200} /></div>
                    </div>
                    <div className="s-card">
                        <div className="u-card-header">
                            <div className="u-section-title">Projekti - detalji</div>
                            <div className="u-fs-12 u-text-muted">{hoursByProject.length} projekata | {filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : 'Svi'}{filterWorker !== 'sve' ? ` • ${workers.find(w => w.id === filterWorker)?.name}` : ''}</div>
                        </div>
                        <div className="u-overflow-x"><table aria-label="Podaci" className="u-table" style={{ minWidth: 600 }}><thead><tr><th className="s-th">Projekt</th><th className="s-th">Sati</th><th className="s-th">Radnika</th><th className="s-th">Troškovi</th><th className="s-th">Status</th><th className="s-th">% vremena</th></tr></thead><tbody>
                            {hoursByProject.map(p => {
                                const proj = projects.find(x => x.id === p.id);
                                return <tr key={p.name}><td className="s-td" className="u-fw-600">{p.fullName || p.name}</td><td className="s-td" className="u-fw-700" style={{ color: 'var(--accent)' }}>{p.sati}h</td><td className="s-td">{p.radnika}</td><td className="s-td">{p.trošak.toFixed(0)}€</td><td className="s-td"><span className={`reports__status-badge ${proj?.status === 'aktivan' ? 'reports__status-badge--approved' : 'reports__status-badge--pending'}`}>{proj?.status || 'aktivan'}</span></td><td className="s-td">{totalHours > 0 ? ((p.sati / (totalHours / 60)) * 100).toFixed(1) : 0}%</td></tr>;
                            })}
                        </tbody></table></div>
                    </div>
                    {/* Worker breakdown per project */}
                    {hoursByProject.map(p => {
                        const pTs = periodTs.filter(t => t.projectId === p.id);
                        const projectWorkers = {};
                        pTs.forEach(t => {
                            const wn = workers.find(x => x.id === t.workerId)?.name || '—';
                            if (!projectWorkers[wn]) projectWorkers[wn] = { total: 0, entries: 0 };
                            projectWorkers[wn].total += (t.durationMins || diffMins(t.startTime, t.endTime)) / 60;
                            projectWorkers[wn].entries++;
                        });
                        const workerList = Object.entries(projectWorkers).sort((a, b) => b[1].total - a[1].total);
                        if (workerList.length === 0) return null;
                        return (
                            <div key={p.id} className="s-card" className="u-mt-12">
                                <div className="u-section-title" style={{ fontSize: 13, marginBottom: 8 }}>🏗️ {p.fullName || p.name} — Radnici ({workerList.length})</div>
                                <div className="u-overflow-x"><table aria-label="Pregled" className="u-table"><thead><tr><th className="s-th">Radnik</th><th className="s-th">Sati</th><th className="s-th">Unosa</th><th className="s-th">% od projekta</th></tr></thead><tbody>
                                    {workerList.map(([name, d]) => <tr key={name}><td className="s-td" className="u-fw-600">{name}</td><td className="s-td" className="u-fw-700" style={{ color: 'var(--accent)' }}>{d.total.toFixed(1)}h</td><td className="s-td">{d.entries}</td><td className="s-td">{p.sati > 0 ? ((d.total / p.sati) * 100).toFixed(1) : 0}%</td></tr>)}
                                </tbody></table></div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tab: Troškovi */}
            {tab === 'troskovi' && (
                <div>
                    <div className="reports__tab-actions">
                        <button onClick={exportCostsPDF} className="s-btn" style={{ background: '#B91C1C' }}><Icon name="file" size={14} /> PDF Troškovi</button>
                    </div>
                    <div className={`reports__stats-3 ${isMobile ? 'reports__stats-3--mobile' : 'reports__stats-3--desktop'}`}>
                        <StatCard label="Ukupni troškovi" value={`${totalCosts.toFixed(2)}€`} color={C.red} sub={`${periodInvoices.length} računa`} />
                        <StatCard label="Gorivo" value={`${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€`} color="#B45309" sub={`${vehicleData.reduce((s, v) => s + v.litara, 0).toFixed(0)} litara`} />
                        <StatCard label="Prosj. po računu" value={periodInvoices.length > 0 ? `${(totalCosts / periodInvoices.length).toFixed(2)}€` : '—'} color="#7C3AED" />
                    </div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card">
                            <div className="u-section-title u-mb-12">Troškovi po projektima</div>
                            {costsByProject.length > 0 ? <SvgBarChart data={costsByProject.map(c => ({ ...c, sati: c.iznos }))} dataKey="sati" label="name" height={220} color="#B91C1C" /> : <div className="reports__empty">Nema podataka</div>}
                        </div>
                        <div className="s-card">
                            <div className="u-section-title u-mb-12">Po kategorijama</div>
                            {costsByCategory.length > 0 ? <SvgHBarChart data={costsByCategory.map(c => ({ name: c.name, sati: c.iznos }))} dataKey="sati" height={Math.max(120, costsByCategory.length * 36)} /> : <div className="reports__empty">Nema podataka</div>}
                        </div>
                    </div>
                    <div className="s-card">
                        <div className="u-section-title u-mb-12">Troškovi po projektima - tablica</div>
                        <div className="u-overflow-x"><table aria-label="Pregled" className="u-table"><thead><tr><th className="s-th">Projekt</th><th className="s-th">Troškovi €</th><th className="s-th">% ukupnog</th></tr></thead><tbody>
                            {costsByProject.map(c => <tr key={c.name}><td className="s-td" className="u-fw-600">{c.fullName || c.name}</td><td className="s-td" style={{ fontWeight: 700, color: C.red }}>{c.iznos.toFixed(2)}€</td><td className="s-td">{totalCosts > 0 ? ((c.iznos / totalCosts) * 100).toFixed(1) : 0}%</td></tr>)}
                            {costsByProject.length === 0 && <tr><td colSpan={3} className="s-td" className="u-text-center u-text-muted">Nema podataka</td></tr>}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Izvješća */}
            {tab === 'izvjesca' && (
                <div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card"><div className="u-section-title u-mb-12">Dnevni trend (zadnjih 30 dana)</div><SvgLineChart data={dailyTrend} dataKey="sati" height={250} /></div>
                        <div className="s-card"><div className="u-section-title u-mb-12">Raspodjela po danima</div><SvgBarChart data={weeklyDist} dataKey="sati" label="name" height={250} color="#047857" /></div>
                    </div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card"><div className="u-section-title u-mb-12">Tip rada</div><SvgDonutChart data={typeDistribution} height={180} /></div>
                        <div className="s-card"><div className="u-section-title u-mb-12">Troškovi vs Sati</div><SvgBarChart data={hoursByProject.slice(0, 8).map(p => ({ name: p.name, sati: p.trošak }))} dataKey="sati" label="name" height={180} color="#B91C1C" /></div>
                    </div>
                    <div className="s-card">
                        <div className="u-section-title u-mb-12">Dnevna tablica</div>
                        <div className="u-overflow-x"><table aria-label="Pregled" className="u-table"><thead><tr><th className="s-th">Dan</th><th className="s-th">Sati</th></tr></thead><tbody>
                            {dailyTrend.map(d => <tr key={d.dan}><td className="s-td">{d.dan}</td><td className="s-td" className="u-fw-700" style={{ color: 'var(--accent)' }}>{d.sati}h</td></tr>)}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Vozila */}
            {tab === 'vozila' && (
                <div>
                    <div className="reports__tab-actions--between">
                        <Select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} className="reports__vehicle-select">
                            <option value="sve">Sva vozila ({(vehicles || []).length})</option>
                            {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.name || v.regNumber}</option>)}
                        </Select>
                        <button onClick={exportVehiclesPDF} className="s-btn" style={{ background: '#B45309' }}><Icon name="file" size={14} /> PDF Vozila</button>
                    </div>
                    <div className={`reports__stats-3 ${isMobile ? 'reports__stats-3--mobile' : 'reports__stats-3--desktop'}`}>
                        <StatCard label="Ukupno gorivo" value={`${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€`} color={C.red} />
                        <StatCard label="Litara" value={vehicleData.reduce((s, v) => s + v.litara, 0).toFixed(0)} color="#B45309" />
                        <StatCard label="Vozila" value={vehicleData.length} color={C.blue} />
                    </div>
                    <div className={`reports__grid-2 ${isMobile ? 'reports__grid-2--mobile' : 'reports__grid-2--desktop'}`}>
                        <div className="s-card">
                            <div className="u-section-title u-mb-12">Troškovi goriva</div>
                            {vehicleData.length > 0 ? <SvgBarChart data={vehicleData.map(v => ({ ...v, sati: v.trošak }))} dataKey="sati" label="name" height={200} color="#B91C1C" /> : <div className="reports__empty">Nema podataka</div>}
                        </div>
                        <div className="s-card">
                            <div className="u-section-title u-mb-12">Litara po vozilu</div>
                            {vehicleData.length > 0 ? <SvgHBarChart data={vehicleData.map(v => ({ name: v.name, sati: v.litara }))} dataKey="sati" height={Math.max(120, vehicleData.length * 36)} /> : <div className="reports__empty">Nema podataka</div>}
                        </div>
                    </div>
                    <div className="s-card">
                        <div className="u-overflow-x"><table aria-label="Pregled" className="u-table"><thead><tr><th className="s-th">Vozilo</th><th className="s-th">Litara</th><th className="s-th">Trošak €</th><th className="s-th">Km</th><th className="s-th">Unosa</th></tr></thead><tbody>
                            {vehicleData.map(v => <tr key={v.name}><td className="s-td" className="u-fw-600">{v.name}</td><td className="s-td">{v.litara.toFixed(1)}</td><td className="s-td" style={{ fontWeight: 700, color: C.red }}>{v.trošak.toFixed(2)}€</td><td className="s-td">{v.km.toFixed(0)}</td><td className="s-td">{v.unosa}</td></tr>)}
                            {vehicleData.length === 0 && <tr><td colSpan={5} className="s-td" className="u-text-center u-text-muted">Nema podataka</td></tr>}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Produktivnost */}
            {tab === 'produktivnost' && (
                <div>
                    <div className={`reports__stats-3 ${isMobile ? 'reports__stats-3--mobile' : 'reports__stats-3--desktop'}`}>
                        <StatCard label="Prosj. efikasnost" value={`${productivity.length > 0 ? Math.round(productivity.reduce((s, p) => s + p.efficiency, 0) / productivity.length) : 0}%`} color="#10B981" />
                        <StatCard label="Prosj. sati/dan" value={`${productivity.length > 0 ? (productivity.reduce((s, p) => s + p.avgH, 0) / productivity.length).toFixed(1) : 0}h`} color={C.blue} />
                        <StatCard label="Ukupno prekovremenih" value={`${productivity.reduce((s, p) => s + p.overtime, 0).toFixed(1)}h`} color="#F59E0B" />
                    </div>
                    <div className="s-card">
                        <div className="u-section-title u-mb-16"> Produktivnost po radnicima</div>
                        <div className="u-overflow-x"><table aria-label="Pregled" className="u-table">
                            <thead><tr><th className="s-th">Radnik</th><th className="s-th">Ukupno h</th><th className="s-th">Radnih dana</th><th className="s-th">Prosj./dan</th><th className="s-th">Projekata</th><th className="s-th">Prekov.</th><th className="s-th">Efikasnost</th></tr></thead>
                            <tbody>{productivity.map(w => (
                                <tr key={w.name}><td className="s-td" className="u-fw-600">{w.name}</td><td className="s-td" className="u-fw-700" style={{ color: 'var(--accent)' }}>{w.totalH}h</td><td className="s-td">{w.days}</td><td className="s-td">{w.avgH}h</td><td className="s-td">{w.projects}</td><td className="s-td" style={{ color: w.overtime > 0 ? '#F59E0B' : C.textMuted }}>{w.overtime}h</td>
                                    <td className="s-td"><div className="reports__progress-cell"><div className="reports__progress-track"><div className="reports__progress-fill" style={{ width: `${w.efficiency}%`, background: w.efficiency >= 80 ? '#10B981' : w.efficiency >= 50 ? '#F59E0B' : '#EF4444' }} /></div><span className="reports__progress-label" style={{ color: w.efficiency >= 80 ? '#10B981' : '#F59E0B' }}>{w.efficiency}%</span></div></td></tr>
                            ))}
                                {productivity.length === 0 && <tr><td colSpan={7} className="s-td" className="u-text-center u-text-muted">Nema podataka</td></tr>}
                            </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Prisutnost */}
            {tab === 'prisutnost' && (
                <div>
                    <div className={`reports__stats-3 ${isMobile ? 'reports__stats-3--mobile' : 'reports__stats-3--desktop'}`}>
                        <StatCard label="Prosj. prisutnost" value={`${attendance.length > 0 ? Math.round(attendance.reduce((s, a) => s + a.rate, 0) / attendance.length) : 0}%`} color="#10B981" />
                        <StatCard label="Ukupno kašnjenja" value={attendance.reduce((s, a) => s + a.late, 0)} color="#F59E0B" />
                        <StatCard label="Radnih dana u periodu" value={attendance[0]?.totalDays || 0} color={C.blue} />
                    </div>
                    <div className="s-card">
                        <div className="u-section-title u-mb-16">📋 Prisutnost radnika</div>
                        <div className="u-overflow-x"><table aria-label="Pregled" className="u-table">
                            <thead><tr><th className="s-th">Radnik</th><th className="s-th">Prisutan (dana)</th><th className="s-th">Odsutan</th><th className="s-th">Kašnjenja</th><th className="s-th">Stopa prisutnosti</th></tr></thead>
                            <tbody>{attendance.map(a => (
                                <tr key={a.name}><td className="s-td" className="u-fw-600">{a.name}</td><td className="s-td" style={{ fontWeight: 700, color: C.green }}>{a.present}</td><td className="s-td" style={{ color: a.absent > 3 ? C.red : C.textMuted }}>{a.absent}</td><td className="s-td" style={{ color: a.late > 0 ? '#F59E0B' : C.textMuted }}>{a.late}</td>
                                    <td className="s-td"><div className="reports__progress-cell"><div className="reports__progress-track"><div className="reports__progress-fill" style={{ width: `${a.rate}%`, background: a.rate >= 80 ? '#10B981' : a.rate >= 50 ? '#F59E0B' : '#EF4444' }} /></div><span className="reports__progress-label">{a.rate}%</span></div></td></tr>
                            ))}
                            </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Otpremnice */}
            {tab === 'otpremnice' && (
                <div>
                    <div className="reports__tab-actions">
                        <button onClick={exportOtpremnicePDF} className="s-btn" style={{ background: '#3B82F6' }}><Icon name="file" size={14} /> PDF Otpremnice</button>
                    </div>
                    <div className={`reports__stats-5 ${isMobile ? 'reports__stats-5--mobile' : 'reports__stats-5--desktop'}`}>
                        <StatCard label="Ukupni iznos" value={`${otpStats.totalAmount}€`} color={C.accent} />
                        <StatCard label="Otpremnica" value={otpStats.count} color={C.blue} />
                        <StatCard label="Odobrene" value={otpStats.approved} color="#10B981" />
                        <StatCard label="Na čekanju" value={otpStats.pending} color="#F59E0B" />
                        <StatCard label="Prosj. iznos" value={`${otpStats.avgAmount}€`} color="#6366F1" />
                    </div>
                    <div className={`reports__grid-3 ${isMobile ? 'reports__grid-3--mobile' : 'reports__grid-3--desktop'}`}>
                        {otpStats.statusChart?.length > 0 && <div className="s-card"><div className="u-section-title u-fs-13 u-mb-12 u-mb-12" className="u-mb-8">Status otpremnica</div><SvgDonutChart data={otpStats.statusChart} height={160} /></div>}
                        {otpStats.projectChart?.length > 0 && <div className="s-card"><div className="u-section-title u-fs-13 u-mb-12 u-mb-12" className="u-mb-8">Po projektu (iznos)</div><SvgHBarChart data={otpStats.projectChart} dataKey="iznos" height={180} /></div>}
                        {otpStats.supplierChart?.length > 0 && <div className="s-card"><div className="u-section-title u-fs-13 u-mb-12 u-mb-12" className="u-mb-8">Po dobavljaču</div><SvgHBarChart data={otpStats.supplierChart} dataKey="iznos" color="#10B981" height={180} /></div>}
                    </div>
                    <div className="s-card">
                        <div className="u-section-title u-mb-16">📦 Sve otpremnice u periodu ({otpremnicePeriod.length})</div>
                        <div className="u-overflow-x"><table className="u-table" style={{ minWidth: 700 }}>
                            <thead><tr><th className="s-th">Br.</th><th className="s-th">Datum</th><th className="s-th">Dobavljač</th><th className="s-th">Projekt</th><th className="s-th">Iznos</th><th className="s-th">Status</th><th className="s-th">Napomena</th></tr></thead>
                            <tbody>{otpremnicePeriod.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 100).map(o => {
                                const proj = projects.find(p => p.id === o.projectId);
                                return <tr key={o.id} style={{ background: String(o.status).includes('čekanju') ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                                    <td className="s-td" className="u-fw-600">{o.deliveryNumber || '—'}</td>
                                    <td className="s-td">{fmtDate(o.date)}</td>
                                    <td className="s-td">{o.supplier || '—'}</td>
                                    <td className="s-td">{proj?.name || '—'}</td>
                                    <td className="s-td" className="u-fw-700" style={{ color: 'var(--accent)' }}>{o.amount ? `${parseFloat(o.amount).toFixed(2)}€` : '—'}</td>
                                    <td className="s-td"><span className={`reports__status-badge ${String(o.status).includes('odobren') ? 'reports__status-badge--approved' : 'reports__status-badge--pending'}`}>{o.status || '—'}</span></td>
                                    <td className="s-td" className="reports__note-cell">{o.note || '—'}</td>
                                </tr>;
                            })}
                            </tbody></table></div>
                        {otpremnicePeriod.length === 0 && <div className="reports__empty--centered">Nema otpremnica u odabranom periodu</div>}
                    </div>
                </div>
            )}

            {/* Tab: Sve podatke */}
            {tab === 'sve' && (
                <div className="s-card">
                    <div className="u-section-title u-mb-12">Svi radni sati ({periodTs.length} unosa)</div>
                    <div className="u-overflow-x"><table className="u-table" style={{ minWidth: 700 }}><thead><tr><th className="s-th">Datum</th><th className="s-th">Radnik</th><th className="s-th">Projekt</th><th className="s-th">Od</th><th className="s-th">Do</th><th className="s-th">Sati</th><th className="s-th">Tip</th><th className="s-th">Status</th></tr></thead><tbody>
                        {periodTs.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 200).map(t => {
                            const w = workers.find(x => x.id === t.workerId);
                            const p = projects.find(x => x.id === t.projectId);
                            const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
                            return <tr key={t.id}><td className="s-td">{fmtDate(t.date)}</td><td className="s-td">{w?.name || '—'}</td><td className="s-td">{p?.name || '—'}</td><td className="s-td">{t.startTime}</td><td className="s-td">{t.endTime}</td><td className="s-td" className="u-fw-700">{h}h</td><td className="s-td">{t.type || 'normalan'}</td><td className="s-td">{t.status || '—'}</td></tr>;
                        })}
                    </tbody></table></div>
                    {periodTs.length > 200 && <div className="reports__truncated">Prikazano prvih 200 od {periodTs.length}</div>}
                </div>
            )}
        </div>
    );
}
