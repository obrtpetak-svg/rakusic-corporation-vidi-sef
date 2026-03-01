import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, SvgBarChart, SvgDonutChart, SvgLineChart, SvgHBarChart, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, diffMins, today } from '../utils/helpers';
import { EmptyState } from './ui/EmptyState';
import { refreshDashboardStats } from '../services/DashboardStats';

// ── Animated CountUp ─────────────────────────────────────────────────────
const CountUp = React.memo(function CountUp({ end, duration = 800, suffix = '' }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (typeof end !== 'number' || end === 0) { setCount(end); return; }
        let start = 0;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.round(start));
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration]);
    return <>{count}{suffix}</>;
});

// ── SVG Sparkline ────────────────────────────────────────────────────────
const Sparkline = React.memo(function Sparkline({ data = [], color = 'var(--accent)', width = 64, height = 28 }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pad = 2;
    const points = data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = pad + ((max - v) / range) * (height - pad * 2);
        return `${x},${y}`;
    }).join(' ');
    const pathLength = data.length * 20; // approximate

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', flexShrink: 0 }}>
            {/* Gradient fill under line */}
            <defs>
                <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Area fill */}
            <polygon
                points={`${pad},${height} ${points} ${width - pad},${height}`}
                fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`}
                style={{ animation: 'fadeIn 0.8s ease 0.3s both' }}
            />
            {/* Sparkline */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    strokeDasharray: pathLength,
                    strokeDashoffset: pathLength,
                    animation: `sparkDraw 1s cubic-bezier(0.16,1,0.3,1) 0.2s forwards`
                }}
            />
            {/* End dot */}
            {data.length > 0 && (() => {
                const lastX = pad + ((data.length - 1) / (data.length - 1)) * (width - pad * 2);
                const lastY = pad + ((max - data[data.length - 1]) / range) * (height - pad * 2);
                return <circle cx={lastX} cy={lastY} r="2.5" fill={color} style={{ animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) 1s both' }} />;
            })()}
        </svg>
    );
});

// ── BentoCard wrapper ────────────────────────────────────────────────────
const BentoCard = React.memo(({ children, gridArea, style = {}, className = '' }) => (
    <div className={className} style={{
        background: 'var(--card)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
        gridArea,
        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        animation: 'cardEntry 0.5s cubic-bezier(0.16,1,0.3,1) both',
        ...style
    }}>
        {children}
    </div>
));

// ── Enhanced StatCard with Sparkline ─────────────────────────────────────
const EnhancedStat = React.memo(({ label, value, icon, color, sub, suffix = '', delay = 0, sparkData, onClick }) => (
    <div style={{
        background: 'var(--card)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        padding: '20px 18px',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        animation: `cardEntry 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
        cursor: onClick ? 'pointer' : 'default'
    }}
        onClick={onClick} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
    >
        <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: `${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color, flexShrink: 0
        }}>
            <Icon name={icon} size={22} />
        </div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {typeof value === 'number' ? <CountUp end={value} suffix={suffix} /> : value}
            </div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
    </div>
));

// ── QuickAction button ───────────────────────────────────────────────────
const QuickAction = React.memo(({ icon, label, color, onClick }) => (
    <button onClick={onClick} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 10px', borderRadius: 14,
        background: `${color}10`, border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)',
        fontFamily: 'inherit', width: '100%'
    }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}20`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            <Icon name={icon} size={18} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
    </button>
));

// ── Inline Stat Row ──────────────────────────────────────────────────────
const StatRow = React.memo(({ label, value, color, bg }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: bg || 'var(--divider)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 800, color, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
));

// ── HeatMap (GitHub-style activity) ──────────────────────────────────────
const HeatMap = React.memo(({ data = {}, weeks = 5 }) => {
    const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
    const cells = [];
    const now = new Date();
    const maxVal = Math.max(...Object.values(data), 1);
    for (let w = weeks - 1; w >= 0; w--) {
        for (let d = 0; d < 7; d++) {
            const dt = new Date(now);
            dt.setDate(dt.getDate() - (w * 7 + (6 - d)));
            const key = dt.toISOString().slice(0, 10);
            const val = data[key] || 0;
            const intensity = val / maxVal;
            cells.push({ key, val, intensity, day: d, week: weeks - 1 - w });
        }
    }
    return (
        <div>
            <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {days.map((d, i) => <div key={i} style={{ height: 16, lineHeight: '16px' }}>{i % 2 === 0 ? d : ''}</div>)}
                </div>
                {Array.from({ length: weeks }, (_, w) => (
                    <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {cells.filter(c => c.week === w).map(c => (
                            <div key={c.key} title={`${c.key}: ${Math.round(c.val / 60)}h`} style={{
                                width: 16, height: 16, borderRadius: 3,
                                background: c.val === 0 ? 'var(--divider)' : `rgba(5, 150, 105, ${0.2 + c.intensity * 0.8})`,
                                transition: 'all 0.15s ease',
                                cursor: 'default'
                            }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
});

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

    // ═══ PRE-INDEXED MAPS (single O(n) pass — critical for 10k+ records) ═══
    const { tsByProject, tsByWorker, tsByDate, approvedByProject, approvedByDate, projectNameMap } = useMemo(() => {
        const tsByProject = new Map();
        const tsByWorker = new Map();
        const tsByDate = new Map();
        const approvedByProject = new Map();
        const approvedByDate = new Map();
        const projectNameMap = new Map();
        projects.forEach(p => projectNameMap.set(p.id, p.name));
        timesheets.forEach(t => {
            // By project
            if (!tsByProject.has(t.projectId)) tsByProject.set(t.projectId, []);
            tsByProject.get(t.projectId).push(t);
            // By worker
            if (!tsByWorker.has(t.workerId)) tsByWorker.set(t.workerId, []);
            tsByWorker.get(t.workerId).push(t);
            // By date
            if (!tsByDate.has(t.date)) tsByDate.set(t.date, []);
            tsByDate.get(t.date).push(t);
            // Approved only indexes
            if (t.status === 'odobren' || t.status === 'prihvaćen') {
                if (!approvedByProject.has(t.projectId)) approvedByProject.set(t.projectId, []);
                approvedByProject.get(t.projectId).push(t);
                if (!approvedByDate.has(t.date)) approvedByDate.set(t.date, []);
                approvedByDate.get(t.date).push(t);
            }
        });
        return { tsByProject, tsByWorker, tsByDate, approvedByProject, approvedByDate, projectNameMap };
    }, [timesheets, projects]);

    const invoicesByProject = useMemo(() => {
        const map = new Map();
        invoices.forEach(i => {
            if (!map.has(i.projectId)) map.set(i.projectId, []);
            map.get(i.projectId).push(i);
        });
        return map;
    }, [invoices]);

    // Stats — memoized to avoid recomputation on unrelated renders
    const activeProjects = useMemo(() => projects.filter(p => p.status === 'aktivan').length, [projects]);
    const activeWorkers = useMemo(() => workers.filter(w => w.active !== false).length, [workers]);
    const pendingTimesheets = useMemo(() => timesheets.filter(t => t.status === 'na čekanju').length, [timesheets]);
    const pendingInvoices = useMemo(() => invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik').length, [invoices]);
    const pendingOtpremnice = useMemo(() => otpremnice.filter(o => o.status === 'na čekanju').length, [otpremnice]);
    const pendingTotal = useMemo(() => pendingTimesheets + pendingInvoices + pendingOtpremnice, [pendingTimesheets, pendingInvoices, pendingOtpremnice]);

    // ── Write-behind cache: persist computed stats to Firestore (debounced) ──
    const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        // Debounce: write stats 2s after last change (avoids spamming on rapid state changes)
        if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
        statsTimerRef.current = setTimeout(() => {
            refreshDashboardStats({ projects, workers, timesheets, invoices, otpremnice, obaveze, vehicles, smjestaj });
        }, 2000);
        return () => { if (statsTimerRef.current) clearTimeout(statsTimerRef.current); };
    }, [activeProjects, activeWorkers, pendingTimesheets, pendingInvoices, pendingOtpremnice]);

    // Total hours this month — uses approvedByDate index
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthTimesheets = useMemo(() => {
        const result = [];
        approvedByDate.forEach((entries, date) => { if (date >= monthStart) result.push(...entries); });
        return result;
    }, [approvedByDate, monthStart]);
    const totalHoursMonth = useMemo(() => monthTimesheets.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0), [monthTimesheets]);

    // Previous month for comparison
    const prevMonth = useMemo(() => {
        const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pmStart = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}-01`;
        const pmEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const pmTs = [];
        approvedByDate.forEach((entries, date) => { if (date >= pmStart && date < pmEnd) pmTs.push(...entries); });
        return {
            hours: pmTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0),
            workers: new Set(pmTs.map(t => t.workerId)).size,
            projects: new Set(pmTs.map(t => t.projectId)).size
        };
    }, [approvedByDate, now]);

    // Hours per project (donut) — uses projectNameMap instead of .find()
    const hoursByProjectAll = useMemo(() => {
        const map = {};
        monthTimesheets.forEach(t => {
            const name = projectNameMap.get(t.projectId) || 'Nepoznato';
            map[name] = (map[name] || 0) + diffMins(t.startTime, t.endTime);
        });
        const colors = ['#F97316', '#2563EB', '#059669', '#DC2626', '#7C3AED', '#D97706', '#0891B2', '#BE185D', '#0D9488', '#DB2777'];
        return Object.entries(map).map(([name, mins], i) => ({ name, value: Math.round(mins / 60), color: colors[i % colors.length] })).sort((a, b) => b.value - a.value);
    }, [monthTimesheets, projectNameMap]);

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

    // Hours by work type
    const hoursByType = useMemo(() => {
        const map = {};
        monthTimesheets.forEach(t => {
            const type = t.type || 'normalan';
            map[type] = (map[type] || 0) + diffMins(t.startTime, t.endTime);
        });
        const colors = { normalan: '#2563EB', prekovremeni: '#F59E0B', 'noćni': '#7C3AED', vikend: '#EF4444' };
        return Object.entries(map).map(([name, mins]) => ({ name, value: Math.round(mins / 60), color: colors[name] || '#6B7280' })).sort((a, b) => b.value - a.value);
    }, [monthTimesheets]);

    // Sortable project table — uses pre-indexed Maps (O(1) per project)
    const projectTableData = useMemo(() => {
        return projects.filter(p => p.status === 'aktivan').map(p => {
            const pTs = approvedByProject.get(p.id) || [];
            const hrs = pTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            const wCount = new Set((tsByProject.get(p.id) || []).map(t => t.workerId)).size;
            const cost = (invoicesByProject.get(p.id) || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            return { name: p.name, location: p.location || '—', workers: wCount, hours: Math.round(hrs / 60), cost: +cost.toFixed(2) };
        }).sort((a, b) => projectSort.dir === 'desc' ? b[projectSort.col] - a[projectSort.col] : a[projectSort.col] - b[projectSort.col]);
    }, [projects, approvedByProject, tsByProject, invoicesByProject, projectSort]);
    const PROJECT_PAGE_SIZE = 5;
    const projectTablePages = Math.ceil(projectTableData.length / PROJECT_PAGE_SIZE);
    const projectTableSlice = projectTableData.slice(projectPage * PROJECT_PAGE_SIZE, (projectPage + 1) * PROJECT_PAGE_SIZE);

    // Financial categories (donut)
    const financialCategories = useMemo(() => {
        const map = {};
        invoices.forEach(i => { const c = i.category || 'ostalo'; map[c] = (map[c] || 0) + (parseFloat(i.amount) || 0); });
        const colors = { materijal: '#2563EB', usluga: '#059669', gorivo: '#EF4444', oprema: '#7C3AED', ostalo: '#6B7280' };
        return Object.entries(map).map(([name, val]) => ({ name, value: +val.toFixed(0), color: colors[name] || '#94A3B8' })).sort((a, b) => b.value - a.value);
    }, [invoices]);

    // Top suppliers
    const topSuppliers = useMemo(() => {
        const map = {};
        invoices.forEach(i => { const s = i.supplier || '—'; map[s] = (map[s] || 0) + (parseFloat(i.amount) || 0); });
        return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, val]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, iznos: +val.toFixed(0) }));
    }, [invoices]);

    // Upcoming obaveze (sorted by deadline)
    const upcomingObaveze = useMemo(() => {
        return obaveze
            .filter(o => o.active !== false)
            .sort((a, b) => (a.dueDate || a.deadline || '9999').localeCompare(b.dueDate || b.deadline || '9999'))
            .slice(0, 6);
    }, [obaveze]);

    // Fleet fuel stats
    const fleetStats = useMemo(() => {
        const totalLiters = vehicles.reduce((s, v) => s + (v.fuelLogs || []).reduce((s2, f) => s2 + (parseFloat(f.liters) || 0), 0), 0);
        const totalCost = vehicles.reduce((s, v) => s + (v.fuelLogs || []).reduce((s2, f) => s2 + (parseFloat(f.totalCost) || 0), 0), 0);
        const totalKm = vehicles.reduce((s, v) => s + (parseInt(v.currentKm) || 0), 0);
        const topFuel = vehicles.filter(v => (v.fuelLogs || []).length > 0)
            .map(v => ({ name: (v.name || v.regNumber || '—').slice(0, 14), cost: +(v.fuelLogs || []).reduce((s2, f) => s2 + (parseFloat(f.totalCost) || 0), 0).toFixed(0) }))
            .sort((a, b) => b.cost - a.cost).slice(0, 5);
        return { totalLiters: Math.round(totalLiters), totalCost: +totalCost.toFixed(0), totalKm, topFuel };
    }, [vehicles]);

    // Daily hours (bar chart) — uses approvedByDate index
    const dailyHours = useMemo(() => {
        const days = [];
        for (let d = 13; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const dateStr = dt.toISOString().slice(0, 10);
            const dayTs = approvedByDate.get(dateStr) || [];
            const mins = dayTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            days.push({ dan: `${dt.getDate()}.${dt.getMonth() + 1}`, hours: +(mins / 60).toFixed(1) });
        }
        return days;
    }, [approvedByDate]);

    // Recent activity
    const recentActivity = useMemo(() => {
        const items = [];
        timesheets.slice(-5).forEach(t => {
            const w = workers.find(x => x.id === t.workerId);
            const p = projects.find(x => x.id === t.projectId);
            items.push({ type: 'timesheet', text: `${w?.name || '?'} — ${p?.name || '?'}`, date: t.date, status: t.status });
        });
        invoices.slice(-3).forEach(i => {
            const w = workers.find(x => x.id === i.workerId);
            items.push({ type: 'invoice', text: `Račun: ${i.invoiceNumber || '?'} — ${w?.name || i.supplier || '?'}`, date: i.date, status: i.status });
        });
        return items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
    }, [timesheets, invoices, workers, projects]);

    // Obaveze stats
    const activeObaveze = obaveze.filter(o => o.active !== false).length;
    const completedObaveze = obaveze.reduce((a, o) => a + (o.completions || []).length, 0);

    // Greeting based on time
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Dobro jutro' : hour < 18 ? 'Dobar dan' : 'Dobra večer';

    // Sparkline data — uses indexed Maps
    const sparkHours = useMemo(() => {
        const d = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const ds = dt.toISOString().slice(0, 10);
            const mins = (approvedByDate.get(ds) || []).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            d.push(Math.round(mins / 60));
        }
        return d;
    }, [approvedByDate]);

    const sparkProjects = useMemo(() => {
        const d = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const ds = dt.toISOString().slice(0, 10);
            const unique = new Set((tsByDate.get(ds) || []).map(t => t.projectId));
            d.push(unique.size);
        }
        return d;
    }, [tsByDate]);

    const sparkWorkers = useMemo(() => {
        const d = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const ds = dt.toISOString().slice(0, 10);
            const unique = new Set((tsByDate.get(ds) || []).map(t => t.workerId));
            d.push(unique.size);
        }
        return d;
    }, [tsByDate]);

    // ── 30-day daily hours — uses approvedByDate ──
    const dailyHours30 = useMemo(() => {
        const days = [];
        for (let d = 29; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const dateStr = dt.toISOString().slice(0, 10);
            const mins = (approvedByDate.get(dateStr) || []).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            days.push({ dan: `${dt.getDate()}.${dt.getMonth() + 1}`, hours: +(mins / 60).toFixed(1) });
        }
        return days;
    }, [approvedByDate]);

    // ── Top 10 workers — uses pre-computed monthTimesheets ──
    const topWorkers = useMemo(() => {
        const map = {};
        monthTimesheets.forEach(t => {
            map[t.workerId] = (map[t.workerId] || 0) + diffMins(t.startTime, t.endTime);
        });
        return Object.entries(map)
            .map(([id, mins]) => ({ name: workers.find(w => w.id === id)?.name || '?', hours: Math.round(mins / 60) }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 10);
    }, [monthTimesheets, workers]);

    // ── Heat map — uses approvedByDate ──
    const heatMapData = useMemo(() => {
        const map = {};
        for (let d = 34; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const key = dt.toISOString().slice(0, 10);
            map[key] = (approvedByDate.get(key) || []).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
        }
        return map;
    }, [approvedByDate]);

    // ── Currently at work — uses tsByDate ──
    const todayStr = today();
    const currentlyWorking = useMemo(() => {
        const todayEntries = tsByDate.get(todayStr) || [];
        const workerIds = [...new Set(todayEntries.map(t => t.workerId))];
        return workerIds.map(id => workers.find(w => w.id === id)).filter(Boolean).slice(0, 12);
    }, [tsByDate, workers, todayStr]);

    // ── Streak — uses tsByDate ──
    const streak = useMemo(() => {
        let count = 0;
        for (let d = 1; d <= 30; d++) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            if (dt.getDay() === 0 || dt.getDay() === 6) { count++; continue; }
            const key = dt.toISOString().slice(0, 10);
            if (tsByDate.has(key)) count++; else break;
        }
        return count;
    }, [tsByDate]);



    // ── NEW: Financial summary ──
    const totalInvoiceAmount = useMemo(() => invoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [invoices]);
    const pendingInvoiceAmount = useMemo(() => invoices.filter(i => i.status === 'na čekanju').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [invoices]);

    // ── Predictive Alert: extrapolate this month's hours ──
    const prediction = useMemo(() => {
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (dayOfMonth < 5) return null; // Too early to predict
        const hoursSoFar = totalHoursMonth / 60;
        const rate = hoursSoFar / dayOfMonth;
        const projected = Math.round(rate * daysInMonth);
        const prevHours = Math.round(prevMonth.hours / 60);
        const diff = prevHours > 0 ? Math.round(((projected - prevHours) / prevHours) * 100) : 0;
        return { projected, diff, prevHours, daysLeft: daysInMonth - dayOfMonth };
    }, [totalHoursMonth, prevMonth, now]);

    // ── Smart Nudge message ──
    const nudgeMessage = useMemo(() => {
        if (pendingTimesheets > 5) return `${pendingTimesheets} radnih sati čeka odobrenje već duže vrijeme`;
        if (pendingInvoices > 0) return `${pendingInvoices} računa čeka vašu provjeru`;
        if (pendingOtpremnice > 0) return `${pendingOtpremnice} otpremnica za pregled`;
        return null;
    }, [pendingTimesheets, pendingInvoices, pendingOtpremnice]);

    // ── Weekly Digest (last 7 days) ──
    const weeklyDigest = useMemo(() => {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().slice(0, 10);
        const weekTs = timesheets.filter(t => t.date >= weekStr && (t.status === 'odobren' || t.status === 'prihvaćen'));
        return {
            hours: Math.round(weekTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60),
            workers: new Set(weekTs.map(t => t.workerId)).size,
            projects: new Set(weekTs.map(t => t.projectId)).size,
            entries: weekTs.length
        };
    }, [timesheets]);

    // ── NEW: Workers without entries (>2 days) ──
    const workersNoEntries = useMemo(() => {
        const active = workers.filter(w => w.active !== false);
        return active.filter(w => {
            const wEntries = tsByWorker.get(w.id) || [];
            if (wEntries.length === 0) return true;
            const lastDate = wEntries.reduce((max, t) => t.date > max ? t.date : max, '');
            const daysDiff = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
            return daysDiff > 2;
        }).map(w => {
            const wEntries = tsByWorker.get(w.id) || [];
            const lastDate = wEntries.length > 0 ? wEntries.reduce((max, t) => t.date > max ? t.date : max, '') : null;
            const daysDiff = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
            return { name: w.name || '?', days: daysDiff, id: w.id };
        }).sort((a, b) => b.days - a.days).slice(0, 8);
    }, [workers, tsByWorker]);

    // ── NEW: Workers per project distribution ──
    const workersPerProject = useMemo(() => {
        const colors = ['#2563EB', '#059669', '#D95D08', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#BE185D'];
        return projects.filter(p => p.status === 'aktivan').map((p, i) => {
            const pWorkers = new Set((tsByProject.get(p.id) || []).map(t => t.workerId));
            return { name: p.name?.length > 16 ? p.name.slice(0, 16) + '…' : p.name, value: pWorkers.size, color: colors[i % colors.length] };
        }).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
    }, [projects, tsByProject]);

    // ── NEW: Cost per project (top 8) ──
    const costPerProject = useMemo(() => {
        const colors = ['#2563EB', '#059669', '#D95D08', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#BE185D'];
        return projects.filter(p => p.status === 'aktivan').map((p, i) => {
            const cost = (invoicesByProject.get(p.id) || []).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
            return { name: p.name?.length > 16 ? p.name.slice(0, 16) + '…' : p.name, cost: Math.round(cost), color: colors[i % colors.length] };
        }).filter(p => p.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 8);
    }, [projects, invoicesByProject]);

    // ── NEW: Project status breakdown (donut) ──
    const projectStatusBreakdown = useMemo(() => {
        const counts = { aktivan: 0, zavrsen: 0, pauziran: 0, ostalo: 0 };
        projects.forEach(p => {
            if (p.status === 'aktivan') counts.aktivan++;
            else if (p.status === 'završen' || p.status === 'zavrsen') counts.zavrsen++;
            else if (p.status === 'pauziran') counts.pauziran++;
            else counts.ostalo++;
        });
        return [
            { name: 'Aktivni', value: counts.aktivan, color: '#059669' },
            { name: 'Završeni', value: counts.zavrsen, color: '#6B7280' },
            { name: 'Pauzirani', value: counts.pauziran, color: '#F59E0B' },
            ...(counts.ostalo > 0 ? [{ name: 'Ostalo', value: counts.ostalo, color: '#94A3B8' }] : [])
        ].filter(d => d.value > 0);
    }, [projects]);

    // ── NEW: Hours by day of week (Mon=0..Sun=6) ──
    const hoursByWeekday = useMemo(() => {
        const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
        const totals = [0, 0, 0, 0, 0, 0, 0];
        monthTimesheets.forEach(t => {
            const d = new Date(t.date);
            const dow = (d.getDay() + 6) % 7; // Mon=0
            totals[dow] += diffMins(t.startTime, t.endTime);
        });
        return days.map((name, i) => ({ name, hours: Math.round(totals[i] / 60) }));
    }, [monthTimesheets]);

    // ── NEW: Unpaid invoices summary ──
    const unpaidInvoices = useMemo(() => {
        const unpaid = invoices.filter(i => i.status === 'na čekanju' || i.status === 'neplaćen');
        const total = unpaid.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        return { count: unpaid.length, total: Math.round(total) };
    }, [invoices]);

    return (
        <div>
            {/* ═══ Hero Header ═══ */}
            <div className="aurora-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                        {greeting}, {currentUser?.name?.split(' ')[0]}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
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
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    {nudgeMessage && (
                        <div onClick={onGoToNotifications} style={{ flex: 1, minWidth: 200, background: 'var(--yellow-light)', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', gap: 8, animation: 'cardEntry 0.3s ease' }}>
                            {nudgeMessage}
                        </div>
                    )}
                    {prediction && (
                        <div style={{ flex: 1, minWidth: 200, background: Math.abs(prediction.diff) > 20 ? 'var(--red-light)' : 'var(--blue-light)', borderRadius: 12, padding: '10px 16px', fontSize: 12, color: 'var(--text)', border: `1px solid ${Math.abs(prediction.diff) > 20 ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.15)'}`, animation: 'cardEntry 0.3s ease 0.1s both' }}>
                            <span style={{ fontWeight: 700 }}>Predikcija:</span> ~{prediction.projected}h do kraja mjeseca
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
                <div style={{ background: 'linear-gradient(135deg, var(--accent-light), var(--blue-light))', borderRadius: 14, padding: '14px 18px', marginBottom: 16, border: '1px solid var(--border)', animation: 'cardEntry 0.4s ease 0.15s both' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Tjedni pregled
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}><strong style={{ fontSize: 16, color: 'var(--text)' }}>{weeklyDigest.hours}h</strong> odrađeno</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}><strong style={{ fontSize: 16, color: 'var(--text)' }}>{weeklyDigest.workers}</strong> radnika</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}><strong style={{ fontSize: 16, color: 'var(--text)' }}>{weeklyDigest.projects}</strong> projekata</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}><strong style={{ fontSize: 16, color: 'var(--text)' }}>{weeklyDigest.entries}</strong> unosa</div>
                    </div>
                </div>
            )}

            {/* ═══ Goal Progress + Comparison Toggle ═══ */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Goal */}
                <div style={{ flex: 1, minWidth: 200, background: 'var(--card)', borderRadius: 12, padding: '12px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Mjesečni cilj</span>
                        {editingGoal ? (
                            <input type="number" autoFocus defaultValue={monthlyGoal} onBlur={e => { const v = parseInt(e.target.value) || 2000; setMonthlyGoal(v); localStorage.setItem('vidisef-goal', v); setEditingGoal(false); }} onKeyDown={e => e.key === 'Enter' && e.target.blur()} style={{ width: 60, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 12, background: 'var(--input-bg)', color: 'var(--text)', textAlign: 'right' }} />
                        ) : (
                            <button onClick={() => setEditingGoal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>{Math.round(totalHoursMonth / 60)}h / {monthlyGoal}h</button>
                        )}
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--divider)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: (totalHoursMonth / 60) / monthlyGoal > 0.8 ? 'var(--green)' : 'var(--accent)', width: `${Math.min(((totalHoursMonth / 60) / monthlyGoal) * 100, 100)}%`, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{Math.round(((totalHoursMonth / 60) / monthlyGoal) * 100)}% ostvareno — klikni za promjenu cilja</div>
                </div>
                {/* Comparison toggle */}
                <button onClick={() => setShowComparison(!showComparison)} style={{ ...styles.btn, background: showComparison ? 'var(--accent)' : 'var(--card)', color: showComparison ? 'var(--text-on-accent)' : 'var(--text)', border: `1px solid ${showComparison ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, fontSize: 12, padding: '8px 14px', gap: 6 }}>
                    {showComparison ? 'Sakrij usporedbu' : 'vs prošli mjesec'}
                </button>
            </div>

            {/* ═══ Comparison Banner ═══ */}
            {showComparison && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20, animation: 'cardEntry 0.3s ease' }}>
                    {[{
                        label: 'Sati', curr: Math.round(totalHoursMonth / 60), prev: Math.round(prevMonth.hours / 60), suffix: 'h'
                    }, {
                        label: 'Radnici', curr: new Set(monthTimesheets.map(t => t.workerId)).size, prev: prevMonth.workers
                    }, {
                        label: 'Projekti', curr: new Set(monthTimesheets.map(t => t.projectId)).size, prev: prevMonth.projects
                    }].map((item, i) => {
                        const diff = item.prev > 0 ? Math.round(((item.curr - item.prev) / item.prev) * 100) : 0;
                        return (
                            <div key={i} style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                    <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{item.curr}{item.suffix || ''}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-muted)' }}>{diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diff)}%</span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Prošli: {item.prev}{item.suffix || ''}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ Stat Cards (Bento Row) ═══ */}
            <div className="swipe-row" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: 24 }}>
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
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            {pendingTimesheets > 0 && `${pendingTimesheets} sati · `}{pendingInvoices > 0 && `${pendingInvoices} računa · `}{pendingOtpremnice > 0 && `${pendingOtpremnice} otpremnica`}
                        </div>
                    </div>
                    <button onClick={onGoToNotifications} style={{ ...styles.btnSmall, borderRadius: 10, padding: '8px 16px' }}>Pregledaj →</button>
                </div>
            )}

            {/* ═══ BENTO GRID ═══ */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
                gridTemplateRows: 'auto auto',
                gap: 20,
                marginBottom: 24
            }}>
                {/* ── Activity (2×1 — first, most prominent) ── */}
                <BentoCard style={{ animationDelay: '0.1s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                            <Icon name="history" size={14} />
                        </div>
                        Nedavna aktivnost
                    </div>
                    {recentActivity.length === 0
                        ? <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24, textAlign: 'center' }}>Nema aktivnosti</div>
                        : recentActivity.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: item.type === 'timesheet' ? 'var(--accent-light)' : 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: item.type === 'timesheet' ? 'var(--accent)' : 'var(--blue)' }}>
                                    <Icon name={item.type === 'timesheet' ? 'clock' : 'invoice'} size={14} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(item.date)}</div>
                                </div>
                                {item.status && <span style={styles.badge(item.status === 'odobren' || item.status === 'prihvaćen' ? '34,197,94' : item.status === 'na čekanju' ? '234,179,8' : '100,116,139')}>{item.status}</span>}
                            </div>
                        ))
                    }
                </BentoCard>

                {/* ── Bar Chart (2×1) ── */}
                <BentoCard style={{ animationDelay: '0.15s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Line Chart 30 days ── */}
                <BentoCard style={{ animationDelay: '0.3s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                            <Icon name="calendar" size={14} />
                        </div>
                        Aktivnost
                    </div>
                    <HeatMap data={heatMapData} weeks={5} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                            <Icon name="workers" size={14} />
                        </div>
                        Top radnici · ovaj mjesec
                    </div>
                    {topWorkers.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {topWorkers.map((w, i) => {
                                const maxH = topWorkers[0]?.hours || 1;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--text-muted)', width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                                        <div style={{ flex: 1, position: 'relative', height: 28, borderRadius: 6, overflow: 'hidden', background: 'var(--divider)' }}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(w.hours / maxH) * 100}%`, background: i < 3 ? 'var(--accent-light)' : 'var(--blue-light)', borderRadius: 6, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)', animation: `fadeIn 0.5s ease ${0.1 * i}s both` }} />
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', height: '100%', fontSize: 12 }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                            <span style={{ fontSize: 14 }}>📍</span>
                        </div>
                        Danas na poslu
                        <span style={{ marginLeft: 'auto', fontSize: 24, fontWeight: 900, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{currentlyWorking.length}</span>
                    </div>
                    {currentlyWorking.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
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
                    ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 12, textAlign: 'center', marginBottom: 16 }}>Nitko još nije evidentirao danas</div>}

                    {/* Streak */}
                    <div style={{ background: streak > 5 ? 'var(--green-light)' : streak > 0 ? 'var(--yellow-light)' : 'var(--red-light)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 28 }}>{streak > 5 ? '🔥' : streak > 0 ? '⚡' : '⚠️'}</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: streak > 5 ? 'var(--green)' : streak > 0 ? 'var(--yellow)' : 'var(--red)' }}>Streak: {streak} dana</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{streak > 5 ? 'Odlično! Svi redovito unose sate' : 'Konzistentnost unosa radnih sati'}</div>
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* ═══ ROW 4: Sortable Project Table ═══ */}
            <div style={{ marginBottom: 24 }}>
                <BentoCard style={{ animationDelay: '0.5s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                            <Icon name="project" size={14} />
                        </div>
                        Aktivni projekti — pregled
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{projectTableData.length} projekata</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Financial with Donut ── */}
                <BentoCard style={{ animationDelay: '0.55s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--yellow-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yellow)' }}>
                            <Icon name="invoice" size={14} />
                        </div>
                        Financije
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'var(--blue-light)' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}><CountUp end={Math.round(totalInvoiceAmount)} />€</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Ukupno</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'var(--yellow-light)' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--yellow)', fontVariantNumeric: 'tabular-nums' }}><CountUp end={Math.round(pendingInvoiceAmount)} />€</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Na čekanju</div>
                        </div>
                    </div>
                    {financialCategories.length > 0 && <SvgDonutChart data={financialCategories} height={120} />}
                    {topSuppliers.length > 0 && (
                        <div style={{ marginTop: 12 }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)' }}>
                            <Icon name="car" size={14} />
                        </div>
                        Flota
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                        <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: 'var(--purple-light)' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--purple)' }}><CountUp end={vehicles.length} /></div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>Vozila</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: 'var(--red-light)' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--red)' }}><CountUp end={fleetStats.totalCost} />€</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>Gorivo</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: 'var(--blue-light)' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--blue)' }}><CountUp end={Math.round(fleetStats.totalKm / 1000)} />k</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>km</div>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                            <span style={{ fontSize: 14 }}>🎯</span>
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
                    ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Nema aktivnih obaveza</div>}
                </BentoCard>
            </div>

            {/* ═══ ROW 6: Workers without entries + Weekday Pattern ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Workers without entries (>2 days) ── */}
                <BentoCard style={{ animationDelay: '0.7s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: workersNoEntries.length > 0 ? 'var(--red-light)' : 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: workersNoEntries.length > 0 ? 'var(--red)' : 'var(--green)' }}>
                            <Icon name="alert-circle" size={14} />
                        </div>
                        Bez unosa sati
                        <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: workersNoEntries.length > 0 ? 'var(--red)' : 'var(--green)' }}>{workersNoEntries.length}</span>
                    </div>
                    {workersNoEntries.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                            <Icon name="workers" size={14} />
                        </div>
                        Radnici po projektima
                    </div>
                    {workersPerProject.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {workersPerProject.map((p, i) => {
                                const maxV = workersPerProject[0]?.value || 1;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                                        <div style={{ flex: 1, height: 20, borderRadius: 5, background: 'var(--divider)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 5, background: p.color, width: `${(p.value / maxV) * 100}%`, transition: 'width 0.8s ease', animation: `fadeIn 0.5s ease ${0.1 * i}s both` }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: p.color, width: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Nema podataka</div>}
                </BentoCard>

                {/* ── Cost per project ── */}
                <BentoCard style={{ animationDelay: '0.85s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                            <Icon name="invoice" size={14} />
                        </div>
                        Troškovi po projektu
                    </div>
                    {costPerProject.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {costPerProject.map((p, i) => {
                                const maxC = costPerProject[0]?.cost || 1;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                                        <div style={{ flex: 1, height: 20, borderRadius: 5, background: 'var(--divider)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 5, background: p.color, width: `${(p.cost / maxC) * 100}%`, transition: 'width 0.8s ease', animation: `fadeIn 0.5s ease ${0.1 * i}s both` }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: p.color, width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.cost.toLocaleString('hr-HR')}€</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Nema podataka</div>}
                </BentoCard>
            </div>

            {/* ═══ ROW 8: Project Status + Unpaid Invoices ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* ── Project Status Donut ── */}
                <BentoCard style={{ animationDelay: '0.9s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                            <Icon name="project" size={14} />
                        </div>
                        Status projekata
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{projects.length} ukupno</span>
                    </div>
                    {projectStatusBreakdown.length > 0
                        ? <SvgDonutChart data={projectStatusBreakdown} height={isMobile ? 120 : 140} />
                        : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Nema projekata</div>
                    }
                </BentoCard>

                {/* ── Unpaid Invoices Highlight ── */}
                <BentoCard style={{ animationDelay: '0.95s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: unpaidInvoices.count > 0 ? 'var(--yellow-light)' : 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: unpaidInvoices.count > 0 ? 'var(--yellow)' : 'var(--green)' }}>
                            <Icon name="invoice" size={14} />
                        </div>
                        Neplaćeni računi
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: 40, fontWeight: 900, color: unpaidInvoices.count > 0 ? 'var(--yellow)' : 'var(--green)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                            <CountUp end={unpaidInvoices.count} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>računa na čekanju</div>
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
            <div style={{ marginBottom: 24 }}>
                <BentoCard style={{ animationDelay: '0.65s' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                            <Icon name="security" size={14} />
                        </div>
                        Audit Log
                        <button onClick={() => window.print()} style={{ marginLeft: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📸 Export
                        </button>
                    </div>
                    {auditLog.length === 0
                        ? <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>Nema log zapisa</div>
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
                                <div key={entry.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--divider)' : 'none', animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>📝</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.action}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entry.user} {entry.details ? `· ${entry.details}` : ''}</div>
                                    </div>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{timeAgo}</span>
                                </div>
                            );
                        })
                    }
                </BentoCard>
            </div>
        </div>
    );
}
