// ═══════════════════════════════════════════════════════
// useDashboardData — All memoized data computations for the Dashboard
// Extracted from Dashboard.tsx for maintainability
// ═══════════════════════════════════════════════════════
import { useMemo, useEffect, useRef } from 'react';
import { diffMins, today } from '../../utils/helpers';
import { refreshDashboardStats } from '../../services/DashboardStats';
import type { Project, Worker, Timesheet, Invoice, Vehicle, Smjestaj, Obaveza, Otpremnica } from '../../types';

// Firestore docs may have extra dynamic fields, so we extend with Record
type Doc<T> = T & Record<string, any>;

interface DashboardDataInput {
    projects: Doc<Project>[];
    workers: Doc<Worker>[];
    timesheets: Doc<Timesheet>[];
    invoices: Doc<Invoice>[];
    otpremnice: Doc<Otpremnica>[];
    obaveze: Doc<Obaveza>[];
    vehicles: Doc<Vehicle>[];
    smjestaj: Doc<Smjestaj>[];
    auditLog: Record<string, any>[];
}

export function useDashboardData({ projects, workers, timesheets, invoices, otpremnice, obaveze, vehicles, smjestaj, auditLog }: DashboardDataInput) {
    const now = new Date();

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
            if (!tsByProject.has(t.projectId)) tsByProject.set(t.projectId, []);
            tsByProject.get(t.projectId).push(t);
            if (!tsByWorker.has(t.workerId)) tsByWorker.set(t.workerId, []);
            tsByWorker.get(t.workerId).push(t);
            if (!tsByDate.has(t.date)) tsByDate.set(t.date, []);
            tsByDate.get(t.date).push(t);
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

    // Stats
    const activeProjects = useMemo(() => projects.filter(p => p.status === 'aktivan').length, [projects]);
    const activeWorkers = useMemo(() => workers.filter(w => w.active !== false).length, [workers]);
    const pendingTimesheets = useMemo(() => timesheets.filter(t => t.status === 'na čekanju').length, [timesheets]);
    const pendingInvoices = useMemo(() => invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik').length, [invoices]);
    const pendingOtpremnice = useMemo(() => otpremnice.filter(o => o.status === 'na čekanju').length, [otpremnice]);
    const pendingTotal = useMemo(() => pendingTimesheets + pendingInvoices + pendingOtpremnice, [pendingTimesheets, pendingInvoices, pendingOtpremnice]);

    // Write-behind cache: persist computed stats to Firestore (debounced)
    const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
        statsTimerRef.current = setTimeout(() => {
            refreshDashboardStats({ projects, workers, timesheets, invoices, otpremnice, obaveze, vehicles, smjestaj });
        }, 2000);
        return () => { if (statsTimerRef.current) clearTimeout(statsTimerRef.current); };
    }, [activeProjects, activeWorkers, pendingTimesheets, pendingInvoices, pendingOtpremnice]);

    // Total hours this month
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthTimesheets = useMemo(() => {
        const result: any[] = [];
        approvedByDate.forEach((entries, date) => { if (date >= monthStart) result.push(...entries); });
        return result;
    }, [approvedByDate, monthStart]);
    const totalHoursMonth = useMemo(() => monthTimesheets.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0), [monthTimesheets]);

    // Previous month for comparison
    const prevMonth = useMemo(() => {
        const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pmStart = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}-01`;
        const pmEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const pmTs: any[] = [];
        approvedByDate.forEach((entries, date) => { if (date >= pmStart && date < pmEnd) pmTs.push(...entries); });
        return {
            hours: pmTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0),
            workers: new Set(pmTs.map(t => t.workerId)).size,
            projects: new Set(pmTs.map(t => t.projectId)).size
        };
    }, [approvedByDate, now]);

    // Hours per project (donut)
    const hoursByProjectAll = useMemo(() => {
        const map: Record<string, number> = {};
        monthTimesheets.forEach(t => {
            const name = projectNameMap.get(t.projectId) || 'Nepoznato';
            map[name] = (map[name] || 0) + diffMins(t.startTime, t.endTime);
        });
        const colors = ['#F97316', '#2563EB', '#059669', '#DC2626', '#7C3AED', '#D97706', '#0891B2', '#BE185D', '#0D9488', '#DB2777'];
        return Object.entries(map).map(([name, mins], i) => ({ name, value: Math.round(mins / 60), color: colors[i % colors.length] })).sort((a, b) => b.value - a.value);
    }, [monthTimesheets, projectNameMap]);

    // Hours by work type
    const hoursByType = useMemo(() => {
        const map: Record<string, number> = {};
        monthTimesheets.forEach(t => {
            const type = t.type || 'normalan';
            map[type] = (map[type] || 0) + diffMins(t.startTime, t.endTime);
        });
        const colors: Record<string, string> = { normalan: '#2563EB', prekovremeni: '#F59E0B', 'noćni': '#7C3AED', vikend: '#EF4444' };
        return Object.entries(map).map(([name, mins]) => ({ name, value: Math.round(mins / 60), color: colors[name] || '#6B7280' })).sort((a, b) => b.value - a.value);
    }, [monthTimesheets]);

    // Sortable project table
    const projectTableData = useMemo(() => {
        return projects.filter(p => p.status === 'aktivan').map(p => {
            const pTs = approvedByProject.get(p.id) || [];
            const hrs = pTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            const wSet = new Set(pTs.map(t => t.workerId));
            const pInvoices = invoicesByProject.get(p.id) || [];
            const cost = pInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            return { id: p.id, name: p.name, hours: Math.round(hrs / 60), workers: wSet.size, entries: pTs.length, cost: Math.round(cost) };
        });
    }, [projects, approvedByProject, invoicesByProject]);

    // Audit log (recent)
    const recentAudit = useMemo(() => {
        return (auditLog || []).slice(0, 12).map(a => ({
            ...a,
            user: workers.find(w => w.id === a.userId)?.name || a.userName || '?',
        }));
    }, [auditLog, workers]);

    // Obaveze stats
    const activeObaveze = obaveze.filter(o => o.active !== false).length;
    const completedObaveze = obaveze.reduce((a, o) => a + (o.completions || []).length, 0);

    // Greeting based on time
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Dobro jutro' : hour < 18 ? 'Dobar dan' : 'Dobra večer';

    // Sparkline data
    const sparkHours = useMemo(() => {
        const d: number[] = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const ds = dt.toISOString().slice(0, 10);
            const mins = (approvedByDate.get(ds) || []).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            d.push(Math.round(mins / 60));
        }
        return d;
    }, [approvedByDate]);

    const sparkProjects = useMemo(() => {
        const d: number[] = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const ds = dt.toISOString().slice(0, 10);
            const unique = new Set((tsByDate.get(ds) || []).map(t => t.projectId));
            d.push(unique.size);
        }
        return d;
    }, [tsByDate]);

    const sparkWorkers = useMemo(() => {
        const d: number[] = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(); dt.setDate(dt.getDate() - i);
            const ds = dt.toISOString().slice(0, 10);
            const unique = new Set((tsByDate.get(ds) || []).map(t => t.workerId));
            d.push(unique.size);
        }
        return d;
    }, [tsByDate]);

    // 30-day daily hours
    const dailyHours30 = useMemo(() => {
        const days: { dan: string; hours: number }[] = [];
        for (let d = 29; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const dateStr = dt.toISOString().slice(0, 10);
            const mins = (approvedByDate.get(dateStr) || []).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
            days.push({ dan: `${dt.getDate()}.${dt.getMonth() + 1}`, hours: +(mins / 60).toFixed(1) });
        }
        return days;
    }, [approvedByDate]);

    // Top 10 workers
    const topWorkers = useMemo(() => {
        const map: Record<string, number> = {};
        monthTimesheets.forEach(t => {
            map[t.workerId] = (map[t.workerId] || 0) + diffMins(t.startTime, t.endTime);
        });
        return Object.entries(map)
            .map(([id, mins]) => ({ name: workers.find(w => w.id === id)?.name || '?', hours: Math.round(mins / 60) }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 10);
    }, [monthTimesheets, workers]);

    // Heat map
    const heatMapData = useMemo(() => {
        const map: Record<string, number> = {};
        for (let d = 34; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const key = dt.toISOString().slice(0, 10);
            map[key] = (approvedByDate.get(key) || []).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
        }
        return map;
    }, [approvedByDate]);

    // Currently at work
    const todayStr = today();
    const currentlyWorking = useMemo(() => {
        const todayEntries = tsByDate.get(todayStr) || [];
        const workerIds = [...new Set(todayEntries.map(t => t.workerId))];
        return workerIds.map(id => workers.find(w => w.id === id)).filter(Boolean).slice(0, 12);
    }, [tsByDate, workers, todayStr]);

    // Streak
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

    // Financial summary
    const totalInvoiceAmount = useMemo(() => invoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [invoices]);
    const pendingInvoiceAmount = useMemo(() => invoices.filter(i => i.status === 'na čekanju').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), [invoices]);

    // Predictive Alert
    const prediction = useMemo(() => {
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (dayOfMonth < 5) return null;
        const hoursSoFar = totalHoursMonth / 60;
        const rate = hoursSoFar / dayOfMonth;
        const projected = Math.round(rate * daysInMonth);
        const prevHours = Math.round(prevMonth.hours / 60);
        const diff = prevHours > 0 ? Math.round(((projected - prevHours) / prevHours) * 100) : 0;
        return { projected, diff, prevHours, daysLeft: daysInMonth - dayOfMonth };
    }, [totalHoursMonth, prevMonth, now]);

    // Smart Nudge
    const nudgeMessage = useMemo(() => {
        if (pendingTimesheets > 5) return `${pendingTimesheets} radnih sati čeka odobrenje već duže vrijeme`;
        if (pendingInvoices > 0) return `${pendingInvoices} računa čeka vašu provjeru`;
        if (pendingOtpremnice > 0) return `${pendingOtpremnice} otpremnica za pregled`;
        return null;
    }, [pendingTimesheets, pendingInvoices, pendingOtpremnice]);

    // Weekly Digest
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

    // Workers without entries (>2 days)
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

    // Workers per project distribution
    const workersPerProject = useMemo(() => {
        const colors = ['#2563EB', '#059669', '#D95D08', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#BE185D'];
        return projects.filter(p => p.status === 'aktivan').map((p, i) => {
            const pWorkers = new Set((tsByProject.get(p.id) || []).map(t => t.workerId));
            return { name: p.name?.length > 16 ? p.name.slice(0, 16) + '…' : p.name, value: pWorkers.size, color: colors[i % colors.length] };
        }).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
    }, [projects, tsByProject]);

    // Cost per project (top 8)
    const costPerProject = useMemo(() => {
        const colors = ['#2563EB', '#059669', '#D95D08', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#BE185D'];
        return projects.filter(p => p.status === 'aktivan').map((p, i) => {
            const cost = (invoicesByProject.get(p.id) || []).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
            return { name: p.name?.length > 16 ? p.name.slice(0, 16) + '…' : p.name, cost: Math.round(cost), color: colors[i % colors.length] };
        }).filter(p => p.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 8);
    }, [projects, invoicesByProject]);

    // Project status breakdown
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

    // Hours by day of week
    const hoursByWeekday = useMemo(() => {
        const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
        const totals = [0, 0, 0, 0, 0, 0, 0];
        monthTimesheets.forEach(t => {
            const d = new Date(t.date);
            const dow = (d.getDay() + 6) % 7;
            totals[dow] += diffMins(t.startTime, t.endTime);
        });
        return days.map((name, i) => ({ name, hours: Math.round(totals[i] / 60) }));
    }, [monthTimesheets]);

    // Unpaid invoices summary
    const unpaidInvoices = useMemo(() => {
        const unpaid = invoices.filter(i => i.status === 'na čekanju' || i.status === 'neplaćen');
        const total = unpaid.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        return { count: unpaid.length, total: Math.round(total) };
    }, [invoices]);

    // Financial categories (donut)
    const financialCategories = useMemo(() => {
        const map: Record<string, number> = {};
        invoices.forEach(i => { const c = i.category || 'ostalo'; map[c] = (map[c] || 0) + (parseFloat(i.amount) || 0); });
        const colors: Record<string, string> = { materijal: '#2563EB', usluga: '#059669', gorivo: '#EF4444', oprema: '#7C3AED', ostalo: '#6B7280' };
        return Object.entries(map).map(([name, val]) => ({ name, value: +val.toFixed(0), color: colors[name] || '#94A3B8' })).sort((a, b) => b.value - a.value);
    }, [invoices]);

    // Top suppliers
    const topSuppliers = useMemo(() => {
        const map: Record<string, number> = {};
        invoices.forEach(i => { const s = i.supplier || '—'; map[s] = (map[s] || 0) + (parseFloat(i.amount) || 0); });
        return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, val]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, iznos: +val.toFixed(0) }));
    }, [invoices]);

    // Upcoming obaveze
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

    // Daily hours 14 days (bar chart)
    const dailyHours = useMemo(() => {
        const days: { dan: string; hours: number }[] = [];
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
        const items: any[] = [];
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

    return {
        // Indexes
        tsByProject, tsByWorker, tsByDate, approvedByProject, approvedByDate, projectNameMap,
        invoicesByProject,
        // Stats
        activeProjects, activeWorkers, pendingTimesheets, pendingInvoices, pendingOtpremnice, pendingTotal,
        // Time data
        monthTimesheets, totalHoursMonth, prevMonth,
        hoursByProjectAll, hoursByType, projectTableData,
        // Sparklines
        sparkHours, sparkProjects, sparkWorkers,
        // Charts
        dailyHours, dailyHours30, topWorkers, heatMapData, hoursByWeekday,
        // Alerts
        currentlyWorking, streak, prediction, nudgeMessage, weeklyDigest,
        // Financial
        totalInvoiceAmount, pendingInvoiceAmount, unpaidInvoices,
        financialCategories, topSuppliers,
        // Workers
        workersNoEntries, workersPerProject,
        // Projects
        costPerProject, projectStatusBreakdown,
        // Activity
        recentAudit, recentActivity,
        // Obaveze
        activeObaveze, completedObaveze, upcomingObaveze,
        // Fleet
        fleetStats,
        // UI
        greeting,
    };
}
