import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Icon, SvgBarChart, SvgHBarChart, SvgLineChart, SvgDonutChart, Select, Input, useIsMobile } from './ui/SharedComponents';
import { C, styles, today, fmtDate, diffMins } from '../utils/helpers';

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

    // CSV/PDF export
    const exportCSV = () => {
        let csv = 'Datum;Radnik;Projekt;Od;Do;Sati;Tip;Status\n';
        periodTs.forEach(t => {
            const w = workers.find(x => x.id === t.workerId)?.name || '—';
            const p = projects.find(x => x.id === t.projectId)?.name || '—';
            const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
            csv += `${t.date};${w};${p};${t.startTime || ''};${t.endTime || ''};${h};${t.type || 'normalan'};${t.status || ''}\n`;
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.download = `izvjestaj-${today()}.csv`; link.click();
    };

    const exportPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Izvještaj - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#1D4ED8;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #1D4ED8;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F1F5F9;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #1D4ED8;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#1D4ED8}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1> ${company}</h1><p style="color:#64748B;font-size:12px">Izvještaj: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}</p></div>`;
        html += `<div><div class="stat"><div class="val">${Math.round(totalHours / 60)}h</div><div class="lbl">Ukupno sati</div></div><div class="stat"><div class="val">${periodTs.length}</div><div class="lbl">Unosa</div></div><div class="stat"><div class="val">${totalCosts.toFixed(0)}€</div><div class="lbl">Računi</div></div><div class="stat"><div class="val">${activeWorkersCount}</div><div class="lbl">Radnika</div></div></div>`;
        html += `<h2>Sati po radnicima</h2><table><tr><th>Radnik</th><th>Sati</th><th>Normalan</th><th>Prekovremeni</th><th>Noćni</th><th>Vikend</th><th>Unosa</th></tr>`;
        hoursByWorker.forEach(w => { html += `<tr><td>${w.name}</td><td><strong>${w.sati}h</strong></td><td>${w.normalan}h</td><td>${w.prekovremeni}h</td><td>${w.nocni}h</td><td>${w.vikend}h</td><td>${w.unosa}</td></tr>`; });
        html += `</table>`;
        html += `<h2>Sati po projektima</h2><table><tr><th>Projekt</th><th>Sati</th><th>Radnika</th><th>Računi €</th></tr>`;
        hoursByProject.forEach(p => { html += `<tr><td>${p.fullName}</td><td><strong>${p.sati}h</strong></td><td>${p.radnika}</td><td>${p.trošak.toFixed(2)}€</td></tr>`; });
        html += `</table>`;
        html += `<h2>Detaljni pregled</h2><table><tr><th>Datum</th><th>Radnik</th><th>Projekt</th><th>Od</th><th>Do</th><th>Sati</th><th>Tip</th></tr>`;
        periodTs.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
            const wn = workers.find(x => x.id === t.workerId)?.name || '—';
            const pn = projects.find(x => x.id === t.projectId)?.name || '—';
            const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
            html += `<tr><td>${t.date}</td><td>${wn}</td><td>${pn}</td><td>${t.startTime || ''}</td><td>${t.endTime || ''}</td><td>${h}h</td><td>${t.type || 'normalan'}</td></tr>`;
        });
        html += `</table><p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Workers section only
    const exportWorkersPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedWorker = filterWorker !== 'sve' ? workers.find(w => w.id === filterWorker)?.name : null;
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Radnici - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#1D4ED8;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #1D4ED8;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F1F5F9;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #1D4ED8;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#1D4ED8}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>👷 ${company} — Izvještaj po radnicima</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedWorker) html += ` | Radnik: <strong>${selectedWorker}</strong>`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${hoursByWorker.length}</div><div class="lbl">Radnika</div></div>`;
        html += `<div class="stat"><div class="val">${Math.round(totalHours / 60)}h</div><div class="lbl">Ukupno sati</div></div>`;
        html += `<div class="stat"><div class="val">${periodTs.length}</div><div class="lbl">Unosa</div></div></div>`;
        html += `<h2>Sati po radnicima</h2><table><tr><th>Radnik</th><th>Ukupno sati</th><th>Normalan</th><th>Prekovremeni</th><th>Noćni</th><th>Vikend</th><th>Br. unosa</th><th>Prosj/dan</th></tr>`;
        hoursByWorker.forEach(wr => {
            html += `<tr><td><strong>${wr.name}</strong></td><td><strong>${wr.sati}h</strong></td><td>${wr.normalan}h</td><td>${wr.prekovremeni}h</td><td>${wr.nocni}h</td><td>${wr.vikend}h</td><td>${wr.unosa}</td><td>${wr.unosa > 0 ? (wr.sati / wr.unosa).toFixed(1) : 0}h</td></tr>`;
        });
        html += `</table>`;
        // Detailed entries for each worker
        hoursByWorker.forEach(wr => {
            const wTs = periodTs.filter(t => t.workerId === wr.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            if (wTs.length === 0) return;
            html += `<h2>${wr.name} — Detaljni pregled (${wTs.length} unosa)</h2>`;
            html += `<table><tr><th>Datum</th><th>Projekt</th><th>Od</th><th>Do</th><th>Sati</th><th>Tip</th></tr>`;
            wTs.forEach(t => {
                const pn = projects.find(x => x.id === t.projectId)?.name || '—';
                const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
                html += `<tr><td>${t.date}</td><td>${pn}</td><td>${t.startTime || ''}</td><td>${t.endTime || ''}</td><td>${h}h</td><td>${t.type || 'normalan'}</td></tr>`;
            });
            html += `</table>`;
        });
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Projects section only
    const exportProjectsPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const selectedWorker = filterWorker !== 'sve' ? workers.find(w => w.id === filterWorker)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Projekti - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#047857;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #047857;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F0FDF4;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #047857;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#047857}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>🏗️ ${company} — Izvještaj po projektima</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        if (selectedWorker) html += ` | Radnik: <strong>${selectedWorker}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${hoursByProject.length}</div><div class="lbl">Projekata</div></div>`;
        html += `<div class="stat"><div class="val">${Math.round(totalHours / 60)}h</div><div class="lbl">Ukupno sati</div></div>`;
        html += `<div class="stat"><div class="val">${totalCosts.toFixed(0)}€</div><div class="lbl">Troškovi</div></div></div>`;
        html += `<h2>Pregled projekata</h2><table><tr><th>Projekt</th><th>Sati</th><th>Radnika</th><th>Troškovi</th><th>Status</th><th>% vremena</th></tr>`;
        hoursByProject.forEach(p => {
            const proj = projects.find(x => x.id === p.id);
            html += `<tr><td><strong>${p.fullName || p.name}</strong></td><td><strong>${p.sati}h</strong></td><td>${p.radnika}</td><td>${p.trošak.toFixed(0)}€</td><td>${proj?.status || 'aktivan'}</td><td>${totalHours > 0 ? ((p.sati / (totalHours / 60)) * 100).toFixed(1) : 0}%</td></tr>`;
        });
        html += `</table>`;
        // Detailed per-project breakdown
        hoursByProject.forEach(p => {
            const pTs = periodTs.filter(t => t.projectId === p.id);
            if (pTs.length === 0) return;
            // Workers on this project
            const projectWorkers = {};
            pTs.forEach(t => {
                const wn = workers.find(x => x.id === t.workerId)?.name || '—';
                if (!projectWorkers[wn]) projectWorkers[wn] = 0;
                projectWorkers[wn] += (t.durationMins || diffMins(t.startTime, t.endTime)) / 60;
            });
            html += `<h2>${p.fullName || p.name} — Radnici (${Object.keys(projectWorkers).length})</h2>`;
            html += `<table><tr><th>Radnik</th><th>Sati</th><th>% od projekta</th></tr>`;
            Object.entries(projectWorkers).sort((a, b) => b[1] - a[1]).forEach(([name, hrs]) => {
                html += `<tr><td><strong>${name}</strong></td><td>${hrs.toFixed(1)}h</td><td>${p.sati > 0 ? ((hrs / p.sati) * 100).toFixed(1) : 0}%</td></tr>`;
            });
            html += `</table>`;
        });
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Costs section
    const exportCostsPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Troškovi - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#B91C1C;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #B91C1C;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#FEF2F2;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #B91C1C;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#B91C1C}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>€ ${company} — Izvještaj troškova</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${totalCosts.toFixed(2)}€</div><div class="lbl">Ukupni troškovi</div></div>`;
        html += `<div class="stat"><div class="val">${periodInvoices.length}</div><div class="lbl">Računa</div></div>`;
        html += `<div class="stat"><div class="val">${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€</div><div class="lbl">Gorivo</div></div></div>`;
        html += `<h2>Troškovi po projektima</h2><table><tr><th>Projekt</th><th>Troškovi €</th><th>% ukupnog</th></tr>`;
        costsByProject.forEach(c => { html += `<tr><td>${c.fullName || c.name}</td><td><strong>${c.iznos.toFixed(2)}€</strong></td><td>${totalCosts > 0 ? ((c.iznos / totalCosts) * 100).toFixed(1) : 0}%</td></tr>`; });
        html += `</table>`;
        if (costsByCategory.length > 0) {
            html += `<h2>Troškovi po kategorijama</h2><table><tr><th>Kategorija</th><th>Iznos €</th><th>% ukupnog</th></tr>`;
            costsByCategory.forEach(c => { html += `<tr><td>${c.name}</td><td><strong>${c.iznos.toFixed(2)}€</strong></td><td>${totalCosts > 0 ? ((c.iznos / totalCosts) * 100).toFixed(1) : 0}%</td></tr>`; });
            html += `</table>`;
        }
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Vehicles section
    const exportVehiclesPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedVehicle = filterVehicle !== 'sve' ? (vehicles || []).find(v => v.id === filterVehicle) : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vozila - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#B45309;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #B45309;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#FFFBEB;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #B45309;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#B45309}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>🚛 ${company} — Izvještaj vozila</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedVehicle) html += ` | Vozilo: <strong>${selectedVehicle.name || selectedVehicle.regNumber}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€</div><div class="lbl">Ukupno gorivo</div></div>`;
        html += `<div class="stat"><div class="val">${vehicleData.reduce((s, v) => s + v.litara, 0).toFixed(0)}</div><div class="lbl">Litara</div></div>`;
        html += `<div class="stat"><div class="val">${vehicleData.length}</div><div class="lbl">Vozila</div></div></div>`;
        html += `<h2>Pregled vozila</h2><table><tr><th>Vozilo</th><th>Litara</th><th>Trošak €</th><th>Km</th><th>Br. tankanja</th></tr>`;
        vehicleData.forEach(v => { html += `<tr><td><strong>${v.name}</strong></td><td>${v.litara.toFixed(1)}</td><td><strong>${v.trošak.toFixed(2)}€</strong></td><td>${v.km.toFixed(0)}</td><td>${v.unosa}</td></tr>`; });
        html += `</table>`;
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // PDF for Otpremnice section
    const exportOtpremnicePDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const selectedProject = filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : null;
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Otpremnice - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B}
        h1{color:#3B82F6;font-size:22px}h2{font-size:15px;margin-top:28px;border-bottom:2px solid #3B82F6;padding-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#EFF6FF;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .header{border-bottom:3px solid #3B82F6;padding-bottom:14px;margin-bottom:24px}
        .stat{display:inline-block;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 18px;margin:4px;text-align:center}
        .stat .val{font-size:22px;font-weight:800;color:#3B82F6}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px}@media print{button{display:none!important}}</style></head><body>`;
        html += `<div class="header"><h1>📦 ${company} — Izvještaj otpremnica</h1>`;
        html += `<p style="color:#64748B;font-size:12px">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        if (selectedProject) html += ` | Projekt: <strong>${selectedProject}</strong>`;
        html += `</p></div>`;
        html += `<div><div class="stat"><div class="val">${otpStats.totalAmount}€</div><div class="lbl">Ukupni iznos</div></div>`;
        html += `<div class="stat"><div class="val">${otpStats.count}</div><div class="lbl">Otpremnica</div></div>`;
        html += `<div class="stat"><div class="val">${otpStats.approved}</div><div class="lbl">Odobrene</div></div>`;
        html += `<div class="stat"><div class="val">${otpStats.pending}</div><div class="lbl">Na čekanju</div></div></div>`;
        html += `<h2>Sve otpremnice (${otpremnicePeriod.length})</h2><table><tr><th>Br.</th><th>Datum</th><th>Dobavljač</th><th>Projekt</th><th>Iznos</th><th>Status</th><th>Napomena</th></tr>`;
        otpremnicePeriod.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(o => {
            const proj = projects.find(p => p.id === o.projectId);
            html += `<tr><td>${o.deliveryNumber || '—'}</td><td>${fmtDate(o.date)}</td><td>${o.supplier || '—'}</td><td>${proj?.name || '—'}</td><td><strong>${o.amount ? parseFloat(o.amount).toFixed(2) + '€' : '—'}</strong></td><td>${o.status || '—'}</td><td>${o.note || '—'}</td></tr>`;
        });
        html += `</table>`;
        html += `<p class="footer">Generirano: ${new Date().toLocaleString('hr-HR')} • ${company} • Vi-Di-Sef v3.0</p></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

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

    const StatCard = ({ label, value, color, sub }) => (
        <div style={{ ...styles.card, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: color || C.accent }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: C.textMuted }}>{sub}</div>}
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}> Izvještaji</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={exportCSV} style={styles.btnSecondary}><Icon name="download" size={14} /> CSV</button>
                    <button onClick={exportPDF} style={styles.btn}><Icon name="file" size={14} /> PDF</button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ ...styles.card, marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
                <span style={{ color: C.textMuted }}>—</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 140 }} />
                <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ width: 160 }}>
                    <option value="sve">Svi radnici</option>
                    {workers.filter(w => w.role !== 'admin').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
                <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: 160 }}>
                    <option value="sve">Svi projekti</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard label="Ukupno sati" value={`${Math.round(totalHours / 60)}h`} color={C.accent} />
                <StatCard label="Unosa" value={periodTs.length} color={C.blue} />
                <StatCard label="Radnika" value={activeWorkersCount} color={C.green} />
                <StatCard label="Projekata" value={activeProjectsCount} color="#7C3AED" />
                <StatCard label="Troškovi" value={`${totalCosts.toFixed(0)}€`} color={C.red} />
                <StatCard label="Prosj./dan" value={`${avgHoursPerDay}h`} color="#B45309" sub={`${dailyTrend.length} dana`} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `2px solid ${C.border}`, overflowX: 'auto' }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent', color: tab === t.id ? C.accent : C.textMuted, fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', marginBottom: -2 }}>{t.label}</button>
                ))}
            </div>

            {/* Tab: Po radnicima */}
            {tab === 'radnici' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={exportWorkersPDF} style={styles.btn}><Icon name="file" size={14} /> PDF Radnici</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Sati po radnicima</div><SvgHBarChart data={hoursByWorker} dataKey="sati" height={Math.max(150, hoursByWorker.length * 36)} /></div>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Dnevni trend</div><SvgLineChart data={dailyTrend} dataKey="sati" height={200} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Tip rada raspodjela</div><SvgDonutChart data={typeDistribution} height={160} /></div>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Po danima u tjednu</div><SvgBarChart data={weeklyDist} dataKey="sati" label="name" height={160} color="#047857" /></div>
                    </div>
                    <div style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Detaljna tablica po radnicima</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{hoursByWorker.length} radnika | {filterWorker !== 'sve' ? workers.find(w => w.id === filterWorker)?.name : 'Svi'}{filterProject !== 'sve' ? ` • ${projects.find(p => p.id === filterProject)?.name}` : ''}</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}><thead><tr><th style={styles.th}>Radnik</th><th style={styles.th}>Sati</th><th style={styles.th}>Normalan</th><th style={styles.th}>Prekovrm.</th><th style={styles.th}>Noćni</th><th style={styles.th}>Vikend</th><th style={styles.th}>Unosa</th><th style={styles.th}>Prosj/dan</th></tr></thead><tbody>
                            {hoursByWorker.map(w => <tr key={w.name}><td style={{ ...styles.td, fontWeight: 600 }}>{w.name}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{w.sati}h</td><td style={styles.td}>{w.normalan}h</td><td style={styles.td}>{w.prekovremeni}h</td><td style={styles.td}>{w.nocni}h</td><td style={styles.td}>{w.vikend}h</td><td style={styles.td}>{w.unosa}</td><td style={styles.td}>{w.unosa > 0 ? (w.sati / w.unosa).toFixed(1) : 0}h</td></tr>)}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Po projektima */}
            {tab === 'projekti' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={exportProjectsPDF} style={{ ...styles.btn, background: '#047857' }}><Icon name="file" size={14} /> PDF Projekti</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Raspodjela sati</div><SvgDonutChart data={hoursByProject} height={200} /></div>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Usporedba projekata</div><SvgBarChart data={hoursByProject} dataKey="sati" label="name" height={200} /></div>
                    </div>
                    <div style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Projekti - detalji</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{hoursByProject.length} projekata | {filterProject !== 'sve' ? projects.find(p => p.id === filterProject)?.name : 'Svi'}{filterWorker !== 'sve' ? ` • ${workers.find(w => w.id === filterWorker)?.name}` : ''}</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}><thead><tr><th style={styles.th}>Projekt</th><th style={styles.th}>Sati</th><th style={styles.th}>Radnika</th><th style={styles.th}>Troškovi</th><th style={styles.th}>Status</th><th style={styles.th}>% vremena</th></tr></thead><tbody>
                            {hoursByProject.map(p => {
                                const proj = projects.find(x => x.id === p.id);
                                return <tr key={p.name}><td style={{ ...styles.td, fontWeight: 600 }}>{p.fullName || p.name}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{p.sati}h</td><td style={styles.td}>{p.radnika}</td><td style={styles.td}>{p.trošak.toFixed(0)}€</td><td style={styles.td}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: proj?.status === 'aktivan' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: proj?.status === 'aktivan' ? '#10B981' : '#F59E0B' }}>{proj?.status || 'aktivan'}</span></td><td style={styles.td}>{totalHours > 0 ? ((p.sati / (totalHours / 60)) * 100).toFixed(1) : 0}%</td></tr>;
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
                            <div key={p.id} style={{ ...styles.card, marginTop: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>🏗️ {p.fullName || p.name} — Radnici ({workerList.length})</div>
                                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={styles.th}>Radnik</th><th style={styles.th}>Sati</th><th style={styles.th}>Unosa</th><th style={styles.th}>% od projekta</th></tr></thead><tbody>
                                    {workerList.map(([name, d]) => <tr key={name}><td style={{ ...styles.td, fontWeight: 600 }}>{name}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{d.total.toFixed(1)}h</td><td style={styles.td}>{d.entries}</td><td style={styles.td}>{p.sati > 0 ? ((d.total / p.sati) * 100).toFixed(1) : 0}%</td></tr>)}
                                </tbody></table></div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tab: Troškovi */}
            {tab === 'troskovi' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={exportCostsPDF} style={{ ...styles.btn, background: '#B91C1C' }}><Icon name="file" size={14} /> PDF Troškovi</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <StatCard label="Ukupni troškovi" value={`${totalCosts.toFixed(2)}€`} color={C.red} sub={`${periodInvoices.length} računa`} />
                        <StatCard label="Gorivo" value={`${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€`} color="#B45309" sub={`${vehicleData.reduce((s, v) => s + v.litara, 0).toFixed(0)} litara`} />
                        <StatCard label="Prosj. po računu" value={periodInvoices.length > 0 ? `${(totalCosts / periodInvoices.length).toFixed(2)}€` : '—'} color="#7C3AED" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Troškovi po projektima</div>
                            {costsByProject.length > 0 ? <SvgBarChart data={costsByProject.map(c => ({ ...c, sati: c.iznos }))} dataKey="sati" label="name" height={220} color="#B91C1C" /> : <div style={{ color: C.textMuted, padding: 20 }}>Nema podataka</div>}
                        </div>
                        <div style={styles.card}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Po kategorijama</div>
                            {costsByCategory.length > 0 ? <SvgHBarChart data={costsByCategory.map(c => ({ name: c.name, sati: c.iznos }))} dataKey="sati" height={Math.max(120, costsByCategory.length * 36)} /> : <div style={{ color: C.textMuted, padding: 20 }}>Nema podataka</div>}
                        </div>
                    </div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Troškovi po projektima - tablica</div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={styles.th}>Projekt</th><th style={styles.th}>Troškovi €</th><th style={styles.th}>% ukupnog</th></tr></thead><tbody>
                            {costsByProject.map(c => <tr key={c.name}><td style={{ ...styles.td, fontWeight: 600 }}>{c.fullName || c.name}</td><td style={{ ...styles.td, fontWeight: 700, color: C.red }}>{c.iznos.toFixed(2)}€</td><td style={styles.td}>{totalCosts > 0 ? ((c.iznos / totalCosts) * 100).toFixed(1) : 0}%</td></tr>)}
                            {costsByProject.length === 0 && <tr><td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: C.textMuted }}>Nema podataka</td></tr>}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Izvješća */}
            {tab === 'izvjesca' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Dnevni trend (zadnjih 30 dana)</div><SvgLineChart data={dailyTrend} dataKey="sati" height={250} /></div>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Raspodjela po danima</div><SvgBarChart data={weeklyDist} dataKey="sati" label="name" height={250} color="#047857" /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Tip rada</div><SvgDonutChart data={typeDistribution} height={180} /></div>
                        <div style={styles.card}><div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Troškovi vs Sati</div><SvgBarChart data={hoursByProject.slice(0, 8).map(p => ({ name: p.name, sati: p.trošak }))} dataKey="sati" label="name" height={180} color="#B91C1C" /></div>
                    </div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Dnevna tablica</div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={styles.th}>Dan</th><th style={styles.th}>Sati</th></tr></thead><tbody>
                            {dailyTrend.map(d => <tr key={d.dan}><td style={styles.td}>{d.dan}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{d.sati}h</td></tr>)}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Vozila */}
            {tab === 'vozila' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <Select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={{ width: 200 }}>
                            <option value="sve">Sva vozila ({(vehicles || []).length})</option>
                            {(vehicles || []).map(v => <option key={v.id} value={v.id}>{v.name || v.regNumber}</option>)}
                        </Select>
                        <button onClick={exportVehiclesPDF} style={{ ...styles.btn, background: '#B45309' }}><Icon name="file" size={14} /> PDF Vozila</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <StatCard label="Ukupno gorivo" value={`${vehicleData.reduce((s, v) => s + v.trošak, 0).toFixed(2)}€`} color={C.red} />
                        <StatCard label="Litara" value={vehicleData.reduce((s, v) => s + v.litara, 0).toFixed(0)} color="#B45309" />
                        <StatCard label="Vozila" value={vehicleData.length} color={C.blue} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div style={styles.card}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Troškovi goriva</div>
                            {vehicleData.length > 0 ? <SvgBarChart data={vehicleData.map(v => ({ ...v, sati: v.trošak }))} dataKey="sati" label="name" height={200} color="#B91C1C" /> : <div style={{ color: C.textMuted, padding: 12 }}>Nema podataka</div>}
                        </div>
                        <div style={styles.card}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Litara po vozilu</div>
                            {vehicleData.length > 0 ? <SvgHBarChart data={vehicleData.map(v => ({ name: v.name, sati: v.litara }))} dataKey="sati" height={Math.max(120, vehicleData.length * 36)} /> : <div style={{ color: C.textMuted, padding: 12 }}>Nema podataka</div>}
                        </div>
                    </div>
                    <div style={styles.card}>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={styles.th}>Vozilo</th><th style={styles.th}>Litara</th><th style={styles.th}>Trošak €</th><th style={styles.th}>Km</th><th style={styles.th}>Unosa</th></tr></thead><tbody>
                            {vehicleData.map(v => <tr key={v.name}><td style={{ ...styles.td, fontWeight: 600 }}>{v.name}</td><td style={styles.td}>{v.litara.toFixed(1)}</td><td style={{ ...styles.td, fontWeight: 700, color: C.red }}>{v.trošak.toFixed(2)}€</td><td style={styles.td}>{v.km.toFixed(0)}</td><td style={styles.td}>{v.unosa}</td></tr>)}
                            {vehicleData.length === 0 && <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: C.textMuted }}>Nema podataka</td></tr>}
                        </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Produktivnost */}
            {tab === 'produktivnost' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                        <StatCard label="Prosj. efikasnost" value={`${productivity.length > 0 ? Math.round(productivity.reduce((s, p) => s + p.efficiency, 0) / productivity.length) : 0}%`} color="#10B981" />
                        <StatCard label="Prosj. sati/dan" value={`${productivity.length > 0 ? (productivity.reduce((s, p) => s + p.avgH, 0) / productivity.length).toFixed(1) : 0}h`} color={C.blue} />
                        <StatCard label="Ukupno prekovremenih" value={`${productivity.reduce((s, p) => s + p.overtime, 0).toFixed(1)}h`} color="#F59E0B" />
                    </div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}> Produktivnost po radnicima</div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr><th style={styles.th}>Radnik</th><th style={styles.th}>Ukupno h</th><th style={styles.th}>Radnih dana</th><th style={styles.th}>Prosj./dan</th><th style={styles.th}>Projekata</th><th style={styles.th}>Prekov.</th><th style={styles.th}>Efikasnost</th></tr></thead>
                            <tbody>{productivity.map(w => (
                                <tr key={w.name}><td style={{ ...styles.td, fontWeight: 600 }}>{w.name}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{w.totalH}h</td><td style={styles.td}>{w.days}</td><td style={styles.td}>{w.avgH}h</td><td style={styles.td}>{w.projects}</td><td style={{ ...styles.td, color: w.overtime > 0 ? '#F59E0B' : C.textMuted }}>{w.overtime}h</td>
                                    <td style={styles.td}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: 6, background: 'rgba(128,128,128,0.15)', borderRadius: 3 }}><div style={{ height: '100%', width: `${w.efficiency}%`, background: w.efficiency >= 80 ? '#10B981' : w.efficiency >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} /></div><span style={{ fontSize: 11, fontWeight: 700, color: w.efficiency >= 80 ? '#10B981' : '#F59E0B' }}>{w.efficiency}%</span></div></td></tr>
                            ))}
                                {productivity.length === 0 && <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: C.textMuted }}>Nema podataka</td></tr>}
                            </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Prisutnost */}
            {tab === 'prisutnost' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                        <StatCard label="Prosj. prisutnost" value={`${attendance.length > 0 ? Math.round(attendance.reduce((s, a) => s + a.rate, 0) / attendance.length) : 0}%`} color="#10B981" />
                        <StatCard label="Ukupno kašnjenja" value={attendance.reduce((s, a) => s + a.late, 0)} color="#F59E0B" />
                        <StatCard label="Radnih dana u periodu" value={attendance[0]?.totalDays || 0} color={C.blue} />
                    </div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>📋 Prisutnost radnika</div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr><th style={styles.th}>Radnik</th><th style={styles.th}>Prisutan (dana)</th><th style={styles.th}>Odsutan</th><th style={styles.th}>Kašnjenja</th><th style={styles.th}>Stopa prisutnosti</th></tr></thead>
                            <tbody>{attendance.map(a => (
                                <tr key={a.name}><td style={{ ...styles.td, fontWeight: 600 }}>{a.name}</td><td style={{ ...styles.td, fontWeight: 700, color: C.green }}>{a.present}</td><td style={{ ...styles.td, color: a.absent > 3 ? C.red : C.textMuted }}>{a.absent}</td><td style={{ ...styles.td, color: a.late > 0 ? '#F59E0B' : C.textMuted }}>{a.late}</td>
                                    <td style={styles.td}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: 6, background: 'rgba(128,128,128,0.15)', borderRadius: 3 }}><div style={{ height: '100%', width: `${a.rate}%`, background: a.rate >= 80 ? '#10B981' : a.rate >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} /></div><span style={{ fontSize: 11, fontWeight: 700 }}>{a.rate}%</span></div></td></tr>
                            ))}
                            </tbody></table></div>
                    </div>
                </div>
            )}

            {/* Tab: Otpremnice */}
            {tab === 'otpremnice' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={exportOtpremnicePDF} style={{ ...styles.btn, background: '#3B82F6' }}><Icon name="file" size={14} /> PDF Otpremnice</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                        <StatCard label="Ukupni iznos" value={`${otpStats.totalAmount}€`} color={C.accent} />
                        <StatCard label="Otpremnica" value={otpStats.count} color={C.blue} />
                        <StatCard label="Odobrene" value={otpStats.approved} color="#10B981" />
                        <StatCard label="Na čekanju" value={otpStats.pending} color="#F59E0B" />
                        <StatCard label="Prosj. iznos" value={`${otpStats.avgAmount}€`} color="#6366F1" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                        {otpStats.statusChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Status otpremnica</div><SvgDonutChart data={otpStats.statusChart} height={160} /></div>}
                        {otpStats.projectChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Po projektu (iznos)</div><SvgHBarChart data={otpStats.projectChart} dataKey="iznos" height={180} /></div>}
                        {otpStats.supplierChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Po dobavljaču</div><SvgHBarChart data={otpStats.supplierChart} dataKey="iznos" color="#10B981" height={180} /></div>}
                    </div>
                    <div style={styles.card}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>📦 Sve otpremnice u periodu ({otpremnicePeriod.length})</div>
                        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                            <thead><tr><th style={styles.th}>Br.</th><th style={styles.th}>Datum</th><th style={styles.th}>Dobavljač</th><th style={styles.th}>Projekt</th><th style={styles.th}>Iznos</th><th style={styles.th}>Status</th><th style={styles.th}>Napomena</th></tr></thead>
                            <tbody>{otpremnicePeriod.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 100).map(o => {
                                const proj = projects.find(p => p.id === o.projectId);
                                return <tr key={o.id} style={{ background: String(o.status).includes('čekanju') ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{o.deliveryNumber || '—'}</td>
                                    <td style={styles.td}>{fmtDate(o.date)}</td>
                                    <td style={styles.td}>{o.supplier || '—'}</td>
                                    <td style={styles.td}>{proj?.name || '—'}</td>
                                    <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{o.amount ? `${parseFloat(o.amount).toFixed(2)}€` : '—'}</td>
                                    <td style={styles.td}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: String(o.status).includes('odobren') ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: String(o.status).includes('odobren') ? '#10B981' : '#F59E0B' }}>{o.status || '—'}</span></td>
                                    <td style={{ ...styles.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.note || '—'}</td>
                                </tr>;
                            })}
                            </tbody></table></div>
                        {otpremnicePeriod.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Nema otpremnica u odabranom periodu</div>}
                    </div>
                </div>
            )}

            {/* Tab: Sve podatke */}
            {tab === 'sve' && (
                <div style={styles.card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Svi radni sati ({periodTs.length} unosa)</div>
                    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}><thead><tr><th style={styles.th}>Datum</th><th style={styles.th}>Radnik</th><th style={styles.th}>Projekt</th><th style={styles.th}>Od</th><th style={styles.th}>Do</th><th style={styles.th}>Sati</th><th style={styles.th}>Tip</th><th style={styles.th}>Status</th></tr></thead><tbody>
                        {periodTs.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 200).map(t => {
                            const w = workers.find(x => x.id === t.workerId);
                            const p = projects.find(x => x.id === t.projectId);
                            const h = ((t.durationMins || diffMins(t.startTime, t.endTime)) / 60).toFixed(1);
                            return <tr key={t.id}><td style={styles.td}>{fmtDate(t.date)}</td><td style={styles.td}>{w?.name || '—'}</td><td style={styles.td}>{p?.name || '—'}</td><td style={styles.td}>{t.startTime}</td><td style={styles.td}>{t.endTime}</td><td style={{ ...styles.td, fontWeight: 700 }}>{h}h</td><td style={styles.td}>{t.type || 'normalan'}</td><td style={styles.td}>{t.status || '—'}</td></tr>;
                        })}
                    </tbody></table></div>
                    {periodTs.length > 200 && <div style={{ padding: 12, textAlign: 'center', color: C.textMuted, fontSize: 12 }}>Prikazano prvih 200 od {periodTs.length}</div>}
                </div>
            )}
        </div>
    );
}
