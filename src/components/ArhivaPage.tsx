import { useState, useEffect, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, batchSet, clearCollection, setDoc } from '../context/AppContext';
import { Icon, Select, Input, SvgBarChart, SvgHBarChart, SvgDonutChart, SvgLineChart, useIsMobile } from './ui/SharedComponents';
import { C, styles, fmtDate, fmtDateTime, diffMins, today } from '../utils/helpers';

const SECTIONS = [
    { id: 'projects', label: 'Projekti', icon: '📁' },
    { id: 'workers', label: 'Radnici', icon: '👷' },
    { id: 'timesheets', label: 'Radni sati', icon: '⏱️' },
    { id: 'invoices', label: 'Računi', icon: '📋' },
    { id: 'otpremnice', label: 'Otpremnice', icon: '📦' },
    { id: 'vehicles', label: 'Vozila', icon: '🚛' },
    { id: 'smjestaj', label: 'Smještaj', icon: '🏠' },
    { id: 'obaveze', label: 'Obaveze', icon: '📌' },
];

function toCsv(headers, rows) {
    const escape = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

function downloadFile(content, filename, type) {
    const blob = new Blob(['\uFEFF' + content], { type: type + ';charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function generatePdf(title, headers, rows, companyName, summaryHtml) {
    const w = window.open('', '_blank');
    const tableHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:12px;width:100%">
        <thead><tr style="background:#f1f5f9">${headers.map(h => `<th style="text-align:left;font-weight:700;padding:8px">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#FAFBFC'}">${r.map(c => `<td style="padding:6px 8px">${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:18px;margin-bottom:4px}p{color:#666;font-size:12px;margin-bottom:16px}.summary{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}.stat{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 16px;text-align:center}.stat .val{font-size:20px;font-weight:800;color:#1D4ED8}.stat .lbl{font-size:10px;color:#64748B;text-transform:uppercase}@media print{button{display:none!important}}</style></head><body>
        <h1>${companyName || 'Vi-Di-Sef'} — ${title}</h1>
        <p>Generirano: ${new Date().toLocaleString('hr-HR')} | Ukupno redova: ${rows.length}</p>
        ${summaryHtml || ''}
        ${tableHtml}
        <br><button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#f8f8f8">🖨️ Isprintaj / Spremi PDF</button>
    </body></html>`);
    w.document.close();
}

const StatCard = ({ label, value, color, sub, icon }) => (
    <div style={{ ...styles.card, textAlign: 'center', padding: '16px 12px' }}>
        {icon && <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>}
        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: color || C.accent, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
);

export function ArhivaPage() {
    const confirm = useConfirm();
    const ctx = useApp();
    const { projects, workers, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze, companyProfile, loadAllTimesheets, allTimesheetsLoaded } = ctx;

    // Load full timesheet history for archive
    useEffect(() => { loadAllTimesheets(); }, [loadAllTimesheets]);
    const [section, setSection] = useState('projects');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterWorker, setFilterWorker] = useState('all');
    const [filterProject, setFilterProject] = useState('all');
    const [filterVehicle, setFilterVehicle] = useState('all');
    const [filterSmjestaj, setFilterSmjestaj] = useState('all');
    const [importing, setImporting] = useState(false);
    const [msg, setMsg] = useState('');
    const [showCharts, setShowCharts] = useState(true);
    const [sortCol, setSortCol] = useState(-1);
    const [sortDir, setSortDir] = useState('asc');
    const isMobile = useIsMobile();

    const companyName = companyProfile?.companyName || '';
    const activeWorkers = workers.filter(w => w.role !== 'admin');

    // Backup/Restore
    const COLLECTIONS = ['projects', 'workers', 'users', 'timesheets', 'invoices', 'vehicles', 'smjestaj', 'obaveze', 'otpremnice', 'auditLog'];
    const allData = () => { const data = {}; COLLECTIONS.forEach(k => { const val = ctx[k]; if (val !== undefined) data[k] = val; }); if (ctx.companyProfile) data.companyProfile = ctx.companyProfile; data._exportedAt = new Date().toISOString(); data._version = '3.0'; return data; };
    const doBackup = () => { try { const json = JSON.stringify(allData(), null, 2); downloadFile(json, `vidsef-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); setMsg('✅ Backup preuzet!'); } catch (e) { setMsg('❌ ' + e.message); } };
    const doRestore = async (e) => { const file = e.target.files?.[0]; if (!file) return; if (!(await confirm('⚠️ Ovo će zamijeniti SVE podatke!'))) return; setImporting(true); try { const data = JSON.parse(await file.text()); for (const col of COLLECTIONS) { if (Array.isArray(data[col])) { await clearCollection(col); await batchSet(col, data[col]); } } if (data.companyProfile) await setDoc('config', 'companyProfile', data.companyProfile); setMsg(`✅ Uvezeno!`); } catch (err) { setMsg('❌ ' + err.message); } setImporting(false); };

    const wName = (id) => { const w = workers.find(x => x.id === id); return w?.name || '—'; };
    const pName = (id) => { const p = projects.find(x => x.id === id); return p?.name || '—'; };

    // Get data
    const getHeaders = () => {
        switch (section) {
            case 'projects': return ['Naziv', 'Lokacija', 'Klijent', 'Status', 'Voditelj', 'Inženjer', 'Radnici', 'Ukupno sati', 'Početak', 'Kraj'];
            case 'workers': return ['Ime', 'Pozicija', 'Telefon', 'Email', 'OIB', 'Korisničko ime', 'Status', 'Ukupno sati', 'Projekata'];
            case 'timesheets': return ['Datum', 'Radnik', 'Projekt', 'Od', 'Do', 'Sati', 'Tip', 'Status', 'Opis'];
            case 'invoices': return ['Br. računa', 'Datum', 'Dobavljač', 'Iznos', 'Valuta', 'Projekt', 'Radnik', 'Status', 'Kategorija'];
            case 'otpremnice': return ['Br. otpremnice', 'Datum', 'Dobavljač', 'Projekt', 'Iznos', 'Status', 'Napomena'];
            case 'vehicles': return ['Naziv', 'Registracija', 'Marka', 'Model', 'Godište', 'Gorivo', 'Km', 'Radnik', 'Tankanja', 'Trošak goriva'];
            case 'smjestaj': return ['Naziv', 'Adresa', 'Tip', 'Kapacitet', 'Radnici', 'Cijena', 'Napomena'];
            case 'obaveze': return ['Naslov', 'Opis', 'Rok', 'Prioritet', 'Aktivna', 'Izvršenja'];
            default: return [];
        }
    };

    const getRows = () => {
        switch (section) {
            case 'projects': return projects.map(p => {
                const pHours = timesheets.filter(t => t.projectId === p.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                return [p.name, p.location || '', p.client || '', p.status, wName(p.teamLeader), wName(p.engineer), (p.workers || []).length, `${(pHours / 60).toFixed(1)}h`, fmtDate(p.startDate), fmtDate(p.endDate)];
            });
            case 'workers': return activeWorkers.map(w => {
                const wHours = timesheets.filter(t => t.workerId === w.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                const wProjects = new Set(timesheets.filter(t => t.workerId === w.id).map(t => t.projectId)).size;
                return [w.name, w.position || '', w.phone || '', w.email || '', w.oib || '', w.username || '', w.active !== false ? 'Aktivan' : 'Neaktivan', `${(wHours / 60).toFixed(1)}h`, wProjects];
            });
            case 'timesheets': return timesheets.map(t => [t.date, wName(t.workerId), pName(t.projectId), t.startTime, t.endTime, (diffMins(t.startTime, t.endTime) / 60).toFixed(1) + 'h', t.type || 'normalan', t.status, t.description || '']);
            case 'invoices': return invoices.map(i => [i.invoiceNumber || '', i.date || '', i.supplier || '', i.amount || '', i.currency || 'EUR', pName(i.projectId), wName(i.workerId), i.status, i.category || '']);
            case 'otpremnice': return (otpremnice || []).map(o => [o.deliveryNumber || '', o.date || '', o.supplier || '', pName(o.projectId), o.amount || '', o.status, o.note || '']);
            case 'vehicles': return vehicles.map(v => [v.name || '', v.regNumber || '', v.brand || '', v.model || '', v.year || '', v.fuelType || '', v.currentKm || '', wName(v.assignedWorker), (v.fuelLogs || []).length, (v.fuelLogs || []).reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0).toFixed(2) + '€']);
            case 'smjestaj': return (smjestaj || []).map(s => [s.name || '', s.address || '', s.type || '', s.capacity || '', (s.workerIds || []).map(wid => wName(wid)).join(', '), s.monthlyPrice || '', s.notes || '']);
            case 'obaveze': return (obaveze || []).map(o => [o.title || '', o.description || '', fmtDate(o.deadline), o.priority || '', o.active !== false ? 'Da' : 'Ne', (o.completions || []).length]);
            default: return [];
        }
    };

    const filteredRows = useMemo(() => {
        let rows = getRows();
        if (filterWorker !== 'all' && ['timesheets', 'invoices', 'workers'].includes(section)) {
            if (section === 'workers') {
                const workerName = wName(filterWorker);
                rows = rows.filter(r => r[0] === workerName);
            } else {
                const workerName = wName(filterWorker);
                const wColIndex = section === 'timesheets' ? 1 : section === 'invoices' ? 6 : -1;
                if (wColIndex >= 0) rows = rows.filter(r => r[wColIndex] === workerName);
            }
        }
        if (filterProject !== 'all' && ['timesheets', 'invoices', 'otpremnice', 'projects'].includes(section)) {
            if (section === 'projects') {
                const projName = pName(filterProject);
                rows = rows.filter(r => r[0] === projName);
            } else {
                const projName = pName(filterProject);
                const pColIndex = section === 'timesheets' ? 2 : section === 'invoices' ? 5 : section === 'otpremnice' ? 3 : -1;
                if (pColIndex >= 0) rows = rows.filter(r => r[pColIndex] === projName);
            }
        }
        if (filterVehicle !== 'all' && section === 'vehicles') {
            const veh = vehicles.find(v => v.id === filterVehicle);
            const vName = veh?.name || veh?.regNumber || '';
            rows = rows.filter(r => r[0] === vName || r[1] === (veh?.regNumber || ''));
        }
        if (filterSmjestaj !== 'all' && section === 'smjestaj') {
            const sm = (smjestaj || []).find(s => s.id === filterSmjestaj);
            if (sm) rows = rows.filter(r => r[0] === (sm.name || ''));
        }
        if (search) rows = rows.filter(r => r.some(c => String(c || '').toLowerCase().includes(search.toLowerCase())));
        if (dateFrom || dateTo) {
            const dateColIndex = section === 'timesheets' ? 0 : section === 'invoices' ? 1 : section === 'otpremnice' ? 1 : -1;
            if (dateColIndex >= 0) {
                rows = rows.filter(r => { const d = r[dateColIndex]; if (!d) return true; if (dateFrom && d < dateFrom) return false; if (dateTo && d > dateTo) return false; return true; });
            }
            // For workers section, filter by timesheet dates
            if (section === 'workers' && (dateFrom || dateTo)) {
                rows = rows.map(r => {
                    const worker = activeWorkers.find(w => w.name === r[0]);
                    if (!worker) return r;
                    const wTs = timesheets.filter(t => t.workerId === worker.id && (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo));
                    const wHours = wTs.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                    const wProjects = new Set(wTs.map(t => t.projectId)).size;
                    return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], `${(wHours / 60).toFixed(1)}h`, wProjects];
                });
            }
        }
        if (filterStatus !== 'all') {
            const statusColIndex = section === 'projects' ? 3 : section === 'timesheets' ? 7 : section === 'invoices' ? 7 : section === 'otpremnice' ? 5 : section === 'workers' ? 6 : -1;
            if (statusColIndex >= 0) rows = rows.filter(r => String(r[statusColIndex] || '').toLowerCase().includes(filterStatus.toLowerCase()));
        }
        if (sortCol >= 0) {
            rows = [...rows].sort((a, b) => {
                const av = String(a[sortCol] || ''), bv = String(b[sortCol] || '');
                const cmp = av.localeCompare(bv, 'hr', { numeric: true });
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return rows;
    }, [section, search, dateFrom, dateTo, filterStatus, filterWorker, filterProject, filterVehicle, filterSmjestaj, sortCol, sortDir, projects, workers, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze]);

    const headers = getHeaders();

    // ═══════════════════════════════════════════
    // SECTION-SPECIFIC STATS & CHARTS DATA
    // ═══════════════════════════════════════════
    const sectionStats = useMemo(() => {
        const s = {};
        if (section === 'projects') {
            s.total = projects.length;
            s.active = projects.filter(p => p.status === 'aktivan').length;
            s.finished = projects.filter(p => p.status === 'završen').length;
            s.planned = projects.filter(p => p.status === 'planiran').length;
            s.paused = projects.filter(p => p.status === 'pausa').length;
            s.totalHours = +(timesheets.reduce((sum, t) => sum + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1);
            s.avgWorkers = projects.length > 0 ? +(projects.reduce((sum, p) => sum + (p.workers || []).length, 0) / projects.length).toFixed(1) : 0;
            s.totalInvoices = invoices.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2);
            s.statusChart = [
                { name: 'Aktivan', value: s.active, color: '#10B981' },
                { name: 'Završen', value: s.finished, color: '#6366F1' },
                { name: 'Planiran', value: s.planned, color: '#3B82F6' },
                { name: 'Pauza', value: s.paused, color: '#F59E0B' },
            ].filter(x => x.value > 0);
            s.hoursPerProject = projects.slice(0, 10).map(p => ({
                name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
                sati: +(timesheets.filter(t => t.projectId === p.id).reduce((sum, t) => sum + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1)
            })).filter(x => x.sati > 0).sort((a, b) => b.sati - a.sati);
        }
        if (section === 'workers') {
            s.total = activeWorkers.length;
            s.active = activeWorkers.filter(w => w.active !== false).length;
            s.inactive = activeWorkers.filter(w => w.active === false).length;
            s.totalHours = +(timesheets.reduce((sum, t) => sum + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1);
            s.avgHours = s.total > 0 ? +(s.totalHours / s.total).toFixed(1) : 0;
            s.positions = {};
            activeWorkers.forEach(w => { const pos = w.position || 'Bez pozicije'; s.positions[pos] = (s.positions[pos] || 0) + 1; });
            s.positionChart = Object.entries(s.positions).map(([name, value], i) => ({ name, value, color: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EF4444', '#0891B2', '#84CC16'][i % 7] }));
            s.topWorkers = activeWorkers.map(w => ({
                name: w.name.length > 15 ? w.name.slice(0, 15) + '…' : w.name,
                sati: +(timesheets.filter(t => t.workerId === w.id).reduce((sum, t) => sum + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1)
            })).filter(x => x.sati > 0).sort((a, b) => b.sati - a.sati).slice(0, 10);
        }
        if (section === 'timesheets') {
            const totalMins = filteredRows.reduce((sum, r) => sum + (parseFloat(r[5]) || 0), 0);
            s.totalHours = totalMins.toFixed(1);
            s.count = filteredRows.length;
            s.approved = filteredRows.filter(r => r[7] === 'odobren').length;
            s.pending = filteredRows.filter(r => r[7] === 'na čekanju').length;
            s.rejected = filteredRows.filter(r => r[7] === 'odbijen').length;
            s.avgPerDay = filteredRows.length > 0 ? +(totalMins / Math.max(1, new Set(filteredRows.map(r => r[0])).size)).toFixed(1) : 0;
            s.uniqueWorkers = new Set(filteredRows.map(r => r[1])).size;
            s.uniqueProjects = new Set(filteredRows.map(r => r[2])).size;
            const typeMap = {};
            filteredRows.forEach(r => { const t = r[6] || 'normalan'; typeMap[t] = (typeMap[t] || 0) + (parseFloat(r[5]) || 0); });
            s.typeChart = Object.entries(typeMap).map(([name, value], i) => ({ name, value: +value.toFixed(1), color: ['#3B82F6', '#F59E0B', '#6366F1', '#EF4444'][i % 4] }));
            s.statusChart = [
                { name: 'Odobren', value: s.approved, color: '#10B981' },
                { name: 'Na čekanju', value: s.pending, color: '#F59E0B' },
                { name: 'Odbijen', value: s.rejected, color: '#EF4444' },
            ].filter(x => x.value > 0);
            // Daily trend
            const daily = {};
            filteredRows.forEach(r => { daily[r[0]] = (daily[r[0]] || 0) + (parseFloat(r[5]) || 0); });
            s.dailyTrend = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([name, sati]) => ({ name: name.slice(5), sati: +sati.toFixed(1) }));
        }
        if (section === 'invoices') {
            const totalAmount = filteredRows.reduce((sum, r) => sum + (parseFloat(r[3]) || 0), 0);
            s.totalAmount = totalAmount.toFixed(2);
            s.count = filteredRows.length;
            s.avgAmount = filteredRows.length > 0 ? (totalAmount / filteredRows.length).toFixed(2) : '0.00';
            s.approved = filteredRows.filter(r => String(r[7]).includes('prihvaćen')).length;
            s.pending = filteredRows.filter(r => String(r[7]).includes('čekanju')).length;
            const catMap = {};
            filteredRows.forEach(r => { const cat = r[8] || 'Nekategorizirano'; catMap[cat] = (catMap[cat] || 0) + (parseFloat(r[3]) || 0); });
            s.categoryChart = Object.entries(catMap).map(([name, value], i) => ({ name, value: +value.toFixed(2), color: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EF4444', '#0891B2'][i % 6] }));
            const supplierMap = {};
            filteredRows.forEach(r => { const sup = r[2] || '—'; supplierMap[sup] = (supplierMap[sup] || 0) + (parseFloat(r[3]) || 0); });
            s.topSuppliers = Object.entries(supplierMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, iznos: +value.toFixed(2) }));
        }
        if (section === 'otpremnice') {
            const totalAmount = filteredRows.reduce((sum, r) => sum + (parseFloat(r[4]) || 0), 0);
            s.totalAmount = totalAmount.toFixed(2);
            s.count = filteredRows.length;
            s.approved = filteredRows.filter(r => String(r[5]).includes('odobren')).length;
            s.pending = filteredRows.filter(r => String(r[5]).includes('čekanju')).length;
        }
        if (section === 'vehicles') {
            s.total = vehicles.length;
            s.totalKm = vehicles.reduce((sum, v) => sum + (parseInt(v.currentKm) || 0), 0);
            s.totalFuelCost = vehicles.reduce((sum, v) => sum + (v.fuelLogs || []).reduce((s2, f) => s2 + (parseFloat(f.totalCost) || 0), 0), 0).toFixed(2);
            s.totalFuelLogs = vehicles.reduce((sum, v) => sum + (v.fuelLogs || []).length, 0);
            s.fuelByVehicle = vehicles.filter(v => (v.fuelLogs || []).length > 0).map(v => ({
                name: (v.name || v.regNumber || '—').slice(0, 12),
                trošak: +(v.fuelLogs || []).reduce((s2, f) => s2 + (parseFloat(f.totalCost) || 0), 0).toFixed(2)
            })).sort((a, b) => b.trošak - a.trošak).slice(0, 8);
        }
        if (section === 'smjestaj') {
            s.total = (smjestaj || []).length;
            s.totalCapacity = (smjestaj || []).reduce((sum, sm) => sum + (parseInt(sm.capacity) || 0), 0);
            s.totalWorkers = (smjestaj || []).reduce((sum, sm) => sum + (sm.workerIds || []).length, 0);
            s.totalCost = (smjestaj || []).reduce((sum, sm) => sum + (parseFloat(sm.monthlyPrice) || 0), 0).toFixed(2);
        }
        if (section === 'obaveze') {
            s.total = (obaveze || []).length;
            s.active = (obaveze || []).filter(o => o.active !== false).length;
            s.completed = (obaveze || []).filter(o => o.active === false).length;
            s.overdue = (obaveze || []).filter(o => o.active !== false && o.deadline && o.deadline < today()).length;
            const prioMap = {};
            (obaveze || []).forEach(o => { const p = o.priority || 'normalan'; prioMap[p] = (prioMap[p] || 0) + 1; });
            s.priorityChart = Object.entries(prioMap).map(([name, value], i) => ({ name, value, color: name === 'hitno' ? '#EF4444' : name === 'visok' ? '#F59E0B' : '#3B82F6' }));
        }
        return s;
    }, [section, filteredRows, projects, workers, timesheets, invoices, otpremnice, vehicles, smjestaj, obaveze]);

    const summaryPdfHtml = () => {
        if (section === 'timesheets') return `<div class="summary"><div class="stat"><div class="val">${sectionStats.totalHours}h</div><div class="lbl">Ukupno sati</div></div><div class="stat"><div class="val">${sectionStats.count}</div><div class="lbl">Unosa</div></div></div>`;
        if (section === 'invoices') return `<div class="summary"><div class="stat"><div class="val">${sectionStats.totalAmount}€</div><div class="lbl">Ukupni iznos</div></div><div class="stat"><div class="val">${sectionStats.count}</div><div class="lbl">Računa</div></div></div>`;
        return '';
    };

    const exportCsv = () => { downloadFile(toCsv(headers, filteredRows), `arhiva-${section}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv'); };
    const exportPdf = () => { generatePdf(SECTIONS.find(s => s.id === section)?.label || section, headers, filteredRows, companyName, summaryPdfHtml()); };

    const handleSort = (colIndex) => {
        if (sortCol === colIndex) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(colIndex); setSortDir('asc'); }
    };

    const sectionCounts = SECTIONS.map(s => {
        switch (s.id) {
            case 'projects': return projects.length;
            case 'workers': return activeWorkers.length;
            case 'timesheets': return timesheets.length;
            case 'invoices': return invoices.length;
            case 'otpremnice': return (otpremnice || []).length;
            case 'vehicles': return vehicles.length;
            case 'smjestaj': return (smjestaj || []).length;
            case 'obaveze': return (obaveze || []).length;
            default: return 0;
        }
    });

    const showWorkerFilter = ['timesheets', 'invoices', 'workers'].includes(section);
    const showProjectFilter = ['timesheets', 'invoices', 'otpremnice', 'projects'].includes(section);
    const showDateFilter = ['timesheets', 'invoices', 'otpremnice', 'workers', 'smjestaj'].includes(section);
    const showStatusFilter = ['projects', 'timesheets', 'invoices', 'otpremnice', 'workers'].includes(section);
    const showVehicleFilter = section === 'vehicles';
    const showSmjestajFilter = section === 'smjestaj';
    const hasActiveFilters = search || dateFrom || dateTo || filterStatus !== 'all' || filterWorker !== 'all' || filterProject !== 'all' || filterVehicle !== 'all' || filterSmjestaj !== 'all';

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Arhiva podataka</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Pregled, filtriranje i izvoz svih podataka • {projects.length} proj. • {activeWorkers.length} rad. • {timesheets.length} unosa</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => setShowCharts(c => !c)} style={styles.btnSmall}>{showCharts ? '📊 Sakrij grafove' : '📊 Prikaži grafove'}</button>
                    <button onClick={doBackup} style={styles.btnSmall}><Icon name="download" size={14} /> Backup</button>
                    <label style={{ ...styles.btnSmall, cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.5 : 1 }}>
                        <Icon name="upload" size={14} /> {importing ? '...' : 'Restore'}
                        <input type="file" accept=".json" onChange={doRestore} style={{ display: 'none' }} disabled={importing} />
                    </label>
                </div>
            </div>

            {msg && <div style={{ ...styles.card, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderColor: msg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)', marginBottom: 16, fontWeight: 600, fontSize: 13, color: msg.startsWith('✅') ? C.green : C.red }}>{msg}</div>}

            {/* Section tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(8, 1fr)', gap: 6, marginBottom: 20 }}>
                {SECTIONS.map((s, i) => (
                    <button key={s.id} onClick={() => { setSection(s.id); setSearch(''); setFilterStatus('all'); setFilterWorker('all'); setFilterProject('all'); setFilterVehicle('all'); setFilterSmjestaj('all'); setDateFrom(''); setDateTo(''); setSortCol(-1); }} style={{ padding: '10px 8px', borderRadius: 12, border: section === s.id ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: section === s.id ? C.accentLight : C.card, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                        <div style={{ fontSize: 20 }}>{s.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: section === s.id ? C.accent : C.textMuted, marginTop: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: section === s.id ? C.accent : C.textDim }}>{sectionCounts[i]}</div>
                    </button>
                ))}
            </div>

            {/* ══════════ STATS DASHBOARD PER SECTION ══════════ */}
            {showCharts && (
                <div style={{ marginBottom: 20 }}>
                    {/* PROJECTS STATS */}
                    {section === 'projects' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="Ukupno projekata" value={sectionStats.total} icon="📁" color={C.accent} />
                                <StatCard label="Aktivni" value={sectionStats.active} icon="✅" color="#10B981" />
                                <StatCard label="Završeni" value={sectionStats.finished} icon="🏁" color="#6366F1" />
                                <StatCard label="Ukupno sati" value={`${sectionStats.totalHours}h`} icon="⏱️" color={C.blue} />
                                <StatCard label="Prosj. radnika" value={sectionStats.avgWorkers} icon="👥" color="#F59E0B" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 16, marginBottom: 16 }}>
                                {sectionStats.statusChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Status projekata</div><SvgDonutChart data={sectionStats.statusChart} height={160} /></div>}
                                {sectionStats.hoursPerProject?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Sati po projektu (top 10)</div><SvgBarChart data={sectionStats.hoursPerProject} dataKey="sati" height={180} /></div>}
                            </div>
                        </>
                    )}

                    {/* WORKERS STATS */}
                    {section === 'workers' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="Ukupno radnika" value={sectionStats.total} icon="👷" color={C.accent} />
                                <StatCard label="Aktivni" value={sectionStats.active} icon="✅" color="#10B981" />
                                <StatCard label="Ukupno sati" value={`${sectionStats.totalHours}h`} icon="⏱️" color={C.blue} />
                                <StatCard label="Prosj. sati" value={`${sectionStats.avgHours}h`} icon="📊" color="#F59E0B" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 16, marginBottom: 16 }}>
                                {sectionStats.positionChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Po pozicijama</div><SvgDonutChart data={sectionStats.positionChart} height={160} /></div>}
                                {sectionStats.topWorkers?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Top radnici po satima</div><SvgHBarChart data={sectionStats.topWorkers} dataKey="sati" height={220} /></div>}
                            </div>
                        </>
                    )}

                    {/* TIMESHEETS STATS */}
                    {section === 'timesheets' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="Ukupno sati" value={`${sectionStats.totalHours}h`} icon="⏱️" color={C.accent} />
                                <StatCard label="Unosa" value={sectionStats.count} icon="📋" color={C.blue} />
                                <StatCard label="Odobreno" value={sectionStats.approved} icon="✅" color="#10B981" />
                                <StatCard label="Na čekanju" value={sectionStats.pending} icon="⏳" color="#F59E0B" />
                                <StatCard label="Prosj./dan" value={`${sectionStats.avgPerDay}h`} icon="📊" color="#6366F1" />
                                <StatCard label="Radnika" value={sectionStats.uniqueWorkers} icon="👥" color="#0891B2" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 2fr', gap: 16, marginBottom: 16 }}>
                                {sectionStats.statusChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Status</div><SvgDonutChart data={sectionStats.statusChart} height={140} /></div>}
                                {sectionStats.typeChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Tip rada</div><SvgDonutChart data={sectionStats.typeChart} height={140} /></div>}
                                {sectionStats.dailyTrend?.length > 1 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Dnevni trend (zadnjih 14 dana)</div><SvgLineChart data={sectionStats.dailyTrend} dataKey="sati" height={140} /></div>}
                            </div>
                        </>
                    )}

                    {/* INVOICES STATS */}
                    {section === 'invoices' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="Ukupni iznos" value={`${sectionStats.totalAmount}€`} icon="€" color={C.accent} />
                                <StatCard label="Računa" value={sectionStats.count} icon="📋" color={C.blue} />
                                <StatCard label="Prosj. iznos" value={`${sectionStats.avgAmount}€`} icon="📊" color="#F59E0B" />
                                <StatCard label="Prihvaćeno" value={sectionStats.approved} icon="✅" color="#10B981" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 16, marginBottom: 16 }}>
                                {sectionStats.categoryChart?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Po kategorijama</div><SvgDonutChart data={sectionStats.categoryChart} height={160} /></div>}
                                {sectionStats.topSuppliers?.length > 0 && <div style={styles.card}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Top dobavljači</div><SvgHBarChart data={sectionStats.topSuppliers} dataKey="iznos" height={200} /></div>}
                            </div>
                        </>
                    )}

                    {/* OTPREMNICE STATS */}
                    {section === 'otpremnice' && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                            <StatCard label="Ukupni iznos" value={`${sectionStats.totalAmount}€`} icon="€" color={C.accent} />
                            <StatCard label="Otpremnica" value={sectionStats.count} icon="📦" color={C.blue} />
                            <StatCard label="Odobrene" value={sectionStats.approved} icon="✅" color="#10B981" />
                            <StatCard label="Na čekanju" value={sectionStats.pending} icon="⏳" color="#F59E0B" />
                        </div>
                    )}

                    {/* VEHICLES STATS */}
                    {section === 'vehicles' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="Ukupno vozila" value={sectionStats.total} icon="🚛" color={C.accent} />
                                <StatCard label="Ukupno km" value={sectionStats.totalKm?.toLocaleString('hr-HR')} icon="🛣️" color={C.blue} />
                                <StatCard label="Trošak goriva" value={`${sectionStats.totalFuelCost}€`} icon="⛽" color="#EF4444" />
                                <StatCard label="Tankanja" value={sectionStats.totalFuelLogs} icon="📊" color="#F59E0B" />
                            </div>
                            {sectionStats.fuelByVehicle?.length > 0 && (
                                <div style={{ ...styles.card, marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Troškovi goriva po vozilu</div><SvgHBarChart data={sectionStats.fuelByVehicle} dataKey="trošak" color="#EF4444" height={180} /></div>
                            )}
                        </>
                    )}

                    {/* SMJESTAJ STATS */}
                    {section === 'smjestaj' && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                            <StatCard label="Smještaja" value={sectionStats.total} icon="🏠" color={C.accent} />
                            <StatCard label="Kapacitet" value={sectionStats.totalCapacity} icon="🛏️" color={C.blue} />
                            <StatCard label="Smješteni" value={sectionStats.totalWorkers} icon="👷" color="#10B981" />
                            <StatCard label="Mjesečni trošak" value={`${sectionStats.totalCost}€`} icon="€" color="#F59E0B" />
                        </div>
                    )}

                    {/* OBAVEZE STATS */}
                    {section === 'obaveze' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="Ukupno obaveza" value={sectionStats.total} icon="📌" color={C.accent} />
                                <StatCard label="Aktivne" value={sectionStats.active} icon="🔴" color="#EF4444" />
                                <StatCard label="Završene" value={sectionStats.completed} icon="✅" color="#10B981" />
                                <StatCard label="Istekle" value={sectionStats.overdue} icon="⚠️" color="#F59E0B" />
                            </div>
                            {sectionStats.priorityChart?.length > 0 && (
                                <div style={{ ...styles.card, marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Po prioritetu</div><SvgDonutChart data={sectionStats.priorityChart} height={140} /></div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══════════ FILTERS & EXPORT ══════════ */}
            <div style={{ ...styles.card, marginBottom: 16, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                        <Input placeholder="Pretraži..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}><Icon name="search" size={14} /></div>
                    </div>
                    {showWorkerFilter && (
                        <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ width: 160 }}>
                            <option value="all">Svi radnici ({activeWorkers.length})</option>
                            {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </Select>
                    )}
                    {showProjectFilter && (
                        <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: 160 }}>
                            <option value="all">Svi projekti ({projects.length})</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    )}
                    {showVehicleFilter && (
                        <Select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={{ width: 180 }}>
                            <option value="all">Sva vozila ({vehicles.length})</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name || v.regNumber}</option>)}
                        </Select>
                    )}
                    {showSmjestajFilter && (
                        <Select value={filterSmjestaj} onChange={e => setFilterSmjestaj(e.target.value)} style={{ width: 180 }}>
                            <option value="all">Svi smještaji ({(smjestaj || []).length})</option>
                            {(smjestaj || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    )}
                    {showDateFilter && (
                        <>
                            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
                            <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>
                            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 140 }} />
                        </>
                    )}
                    {showStatusFilter && (
                        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
                            <option value="all">Svi statusi</option>
                            {section === 'projects' && <><option value="aktivan">Aktivan</option><option value="završen">Završen</option><option value="planiran">Planiran</option></>}
                            {section === 'timesheets' && <><option value="odobren">Odobren</option><option value="na čekanju">Na čekanju</option><option value="odbijen">Odbijen</option></>}
                            {section === 'invoices' && <><option value="prihvaćena">Prihvaćena</option><option value="na čekanju">Na čekanju</option><option value="odbijena">Odbijena</option></>}
                            {section === 'otpremnice' && <><option value="odobrena">Odobrena</option><option value="na čekanju">Na čekanju</option></>}
                            {section === 'workers' && <><option value="aktivan">Aktivan</option><option value="neaktivan">Neaktivan</option></>}
                        </Select>
                    )}
                    {hasActiveFilters && (
                        <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterStatus('all'); setFilterWorker('all'); setFilterProject('all'); setFilterVehicle('all'); setFilterSmjestaj('all'); }} style={{ ...styles.btnSmall, color: C.red, borderColor: 'rgba(239,68,68,0.2)', fontSize: 11 }}>✕ Očisti</button>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button onClick={exportPdf} style={styles.btn}><Icon name="file" size={14} /> PDF</button>
                        <button onClick={exportCsv} style={{ ...styles.btn, background: C.green }}><Icon name="download" size={14} /> CSV/Excel</button>
                    </div>
                </div>
            </div>

            {/* Results count */}
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Prikazano: <strong style={{ color: C.textDim }}>{filteredRows.length}</strong> redova{hasActiveFilters ? ' (filtrirano)' : ''}</span>
                <span style={{ fontSize: 11 }}>Kliknite zaglavlje za sortiranje</span>
            </div>

            {/* Data Table */}
            <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 500 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                        <thead>
                            <tr>{headers.map((h, i) => (
                                <th key={h} onClick={() => handleSort(i)} style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                    {h} {sortCol === i ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                                </th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {filteredRows.slice(0, 300).map((row, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.04)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,93,8,0.06)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.04)'}>
                                    {row.map((cell, j) => (
                                        <td key={j} style={{ ...styles.td, fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRows.length === 0 && <div style={{ padding: 50, textAlign: 'center', color: C.textMuted, fontSize: 14 }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>Nema podataka za odabrani prikaz</div>}
                    {filteredRows.length > 300 && <div style={{ padding: 12, textAlign: 'center', color: C.textMuted, fontSize: 12, background: C.bgElevated }}>Prikazano prvih 300 od {filteredRows.length} redova. Koristite export za sve podatke.</div>}
                </div>
            </div>
        </div>
    );
}
