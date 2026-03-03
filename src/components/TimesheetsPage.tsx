import { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Select, StatusBadge, Pagination, usePagination, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, diffMins, fmtHours, compressImage } from '../utils/helpers';
import { BulkActionBar } from './ui/BulkActionBar';
import './timesheets.css';

export function TimesheetsPage() {
    const confirm = useConfirm();
    const { timesheets, workers, projects, currentUser, addAuditLog, companyProfile } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterProject, setFilterProject] = useState('all');
    const [filterWorker, setFilterWorker] = useState('all');
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
    const [dateTo, setDateTo] = useState(() => today());
    const [viewMode, setViewMode] = useState('table');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const isMobile = useIsMobile();

    const toggleSelect = (id) => setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const selectAllVisible = () => {
        const visible = pg.paginate(filtered);
        const allSelected = visible.every(t => selectedIds.has(t.id));
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(visible.map(t => t.id)));
    };
    const clearSelection = () => setSelectedIds(new Set());

    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');
    const activeProjects = projects.filter(p => p.status === 'aktivan');

    const blankForm = () => ({ workerId: '', projectId: '', date: today(), startTime: '07:00', endTime: '15:00', breakMins: 30, description: '', status: 'odobren', type: 'normalan', notes: '', gpsLocation: '' });
    const [form, setForm] = useState(blankForm());
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = useMemo(() => {
        let list = timesheets;
        if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus);
        if (filterProject !== 'all') list = list.filter(t => t.projectId === filterProject);
        if (filterWorker !== 'all') list = list.filter(t => t.workerId === filterWorker);
        if (dateFrom) list = list.filter(t => t.date >= dateFrom);
        if (dateTo) list = list.filter(t => t.date <= dateTo);
        if (search) {
            const s = search.toLowerCase();
            list = list.filter(t => {
                const w = workers.find(x => x.id === t.workerId);
                const p = projects.find(x => x.id === t.projectId);
                return (w?.name || '').toLowerCase().includes(s) || (p?.name || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s);
            });
        }
        return list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    }, [timesheets, filterStatus, filterProject, filterWorker, dateFrom, dateTo, search, workers, projects]);

    const pg = usePagination(filtered.length, [filterStatus, filterProject, filterWorker, dateFrom, dateTo, search]);

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (t) => {
        setForm({ workerId: t.workerId || '', projectId: t.projectId || '', date: t.date || today(), startTime: t.startTime || '07:00', endTime: t.endTime || '15:00', breakMins: t.breakMins || 0, description: t.description || '', status: t.status || 'odobren', type: t.type || 'normalan', notes: t.notes || '', gpsLocation: t.gpsLocation || '' });
        setEditId(t.id); setShowForm(true);
    };

    const doSave = async () => {
        if (!form.workerId) return alert('Odaberite radnika');
        if (!form.projectId) return alert('Odaberite projekt');
        if (editId) {
            await updateDoc('timesheets', editId, { ...form, updatedAt: new Date().toISOString(), updatedBy: currentUser?.name });
        } else {
            await addDoc('timesheets', { id: genId(), ...form, createdAt: new Date().toISOString(), createdBy: currentUser?.name, source: 'admin' });
        }
        setShowForm(false);
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati ovaj unos?'))) return;
        await removeDoc('timesheets', id);
    };

    const approve = async (t) => {
        await updateDoc('timesheets', t.id, { status: 'odobren', approvedAt: new Date().toISOString(), approvedBy: currentUser?.name });
        await addAuditLog('TIMESHEET_APPROVED', `Sati za ${workers.find(w => w.id === t.workerId)?.name || '?'} (${t.date}) odobreni`);
    };

    const reject = async (t) => {
        const reason = prompt('Razlog odbijanja:');
        if (reason === null) return;
        await updateDoc('timesheets', t.id, { status: 'odbijen', rejectedAt: new Date().toISOString(), rejectedBy: currentUser?.name, rejectReason: reason });
        await addAuditLog('TIMESHEET_REJECTED', `Sati za ${workers.find(w => w.id === t.workerId)?.name || '?'} (${t.date}) odbijeni: ${reason}`);
    };

    // Bulk actions
    const bulkApprove = async () => {
        for (const id of selectedIds) {
            const t = timesheets.find(x => x.id === id);
            if (t && t.status === 'na čekanju') {
                await updateDoc('timesheets', id, { status: 'odobren', approvedAt: new Date().toISOString(), approvedBy: currentUser?.name });
            }
        }
        clearSelection();
    };
    const bulkReject = async () => {
        const reason = prompt('Razlog odbijanja za sve odabrane:');
        if (reason === null) return;
        for (const id of selectedIds) {
            const t = timesheets.find(x => x.id === id);
            if (t && t.status === 'na čekanju') {
                await updateDoc('timesheets', id, { status: 'odbijen', rejectedAt: new Date().toISOString(), rejectedBy: currentUser?.name, rejectReason: reason });
            }
        }
        clearSelection();
    };
    const bulkDelete = async () => {
        for (const id of selectedIds) {
            await removeDoc('timesheets', id);
        }
        clearSelection();
    };

    const detailTs = detailId ? timesheets.find(t => t.id === detailId) : null;
    const totalFiltered = filtered.reduce((s, t) => s + diffMins(t.startTime, t.endTime) - (t.breakMins || 0), 0);
    const pendingCount = timesheets.filter(t => t.status === 'na čekanju').length;
    const approvedCount = filtered.filter(t => t.status === 'odobren').length;
    const rejectedCount = filtered.filter(t => t.status === 'odbijen').length;
    const avgPerDay = useMemo(() => {
        const days = new Set(filtered.map(t => t.date)).size;
        return days > 0 ? (totalFiltered / 60 / days).toFixed(1) : 0;
    }, [filtered, totalFiltered]);

    // Export CSV
    const exportCSV = () => {
        let csv = 'Datum;Radnik;Projekt;Od;Do;Pauza;Neto sati;Tip;Status;Opis\n';
        filtered.forEach(t => {
            const w = workers.find(x => x.id === t.workerId)?.name || '—';
            const p = projects.find(x => x.id === t.projectId)?.name || '—';
            const mins = diffMins(t.startTime, t.endTime) - (t.breakMins || 0);
            csv += `${t.date};${w};${p};${t.startTime};${t.endTime};${t.breakMins || 0};${(mins / 60).toFixed(1)};${t.type || 'normalan'};${t.status};${(t.description || '').replace(/;/g, ',')}\n`;
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.download = `radni-sati-${dateFrom || 'sve'}-${dateTo || 'sve'}.csv`; link.click();
    };

    // Export PDF
    const exportPDF = () => {
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Radni sati - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:30px;color:#1E293B;font-size:12px}
        h1{color:#1D4ED8;font-size:18px;margin-bottom:4px}
        .sub{color:#64748B;font-size:11px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #CBD5E1;padding:6px 8px;text-align:left;font-size:11px}
        th{background:#F1F5F9;font-weight:700}tr:nth-child(even){background:#FAFBFC}
        .stats{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
        .stat{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 16px;text-align:center}
        .stat .v{font-size:18px;font-weight:800;color:#1D4ED8}
        .stat .l{font-size:9px;color:#64748B;text-transform:uppercase}
        @media print{button{display:none!important}}</style></head><body>`;
        html += `<h1> ${company} — Radni sati</h1><p class="sub">Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)} | Generirano: ${new Date().toLocaleString('hr-HR')}</p>`;
        html += `<div class="stats"><div class="stat"><div class="v">${(totalFiltered / 60).toFixed(1)}h</div><div class="l">Ukupno sati</div></div><div class="stat"><div class="v">${filtered.length}</div><div class="l">Unosa</div></div><div class="stat"><div class="v">${approvedCount}</div><div class="l">Odobreno</div></div><div class="stat"><div class="v">${avgPerDay}h</div><div class="l">Prosj./dan</div></div></div>`;
        html += `<table><tr><th>Datum</th><th>Radnik</th><th>Projekt</th><th>Od</th><th>Do</th><th>Pauza</th><th>Neto</th><th>Tip</th><th>Status</th><th>Opis</th></tr>`;
        filtered.forEach(t => {
            const wn = workers.find(x => x.id === t.workerId)?.name || '—';
            const pn = projects.find(x => x.id === t.projectId)?.name || '—';
            const mins = diffMins(t.startTime, t.endTime) - (t.breakMins || 0);
            html += `<tr><td>${t.date}</td><td>${wn}</td><td>${pn}</td><td>${t.startTime}</td><td>${t.endTime}</td><td>${t.breakMins || 0}m</td><td><strong>${(mins / 60).toFixed(1)}h</strong></td><td>${t.type || 'normalan'}</td><td>${t.status}</td><td>${t.description || ''}</td></tr>`;
        });
        html += `</table><br><button onclick="window.print()">🖨️ Isprintaj / Spremi PDF</button></body></html>`;
        w.document.write(html); w.document.close();
    };

    return (
        <>
            <div>
                {/* Header */}
                <div className="ts__header">
                    <div>
                        <div className="u-fs-22 u-fw-800 u-color-text"> Radni sati</div>
                        <div className="u-fs-13 u-text-muted">Upravljanje evidencijom radnog vremena</div>
                    </div>
                    <div className="u-flex-center u-gap-8">
                        <button onClick={exportCSV} style={styles.btnSecondary}><Icon name="download" size={14} /> CSV/Excel</button>
                        <button onClick={exportPDF} style={{ ...styles.btnSecondary, color: C.red, borderColor: 'rgba(239,68,68,0.3)' }}><Icon name="file" size={14} /> PDF</button>
                        <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Dodaj</button>
                    </div>
                </div>

                {/* Stats */}
                <div className={`ts__stats ${isMobile ? 'ts__stats--mobile' : 'ts__stats--desktop'}`}>
                    <div style={{ ...styles.card, textAlign: 'center', padding: '14px 12px' }}>
                        <div className="u-stat-label">Ukupno sati</div>
                        <div className="ts__stat-value" style={{ color: C.accent }}>{(totalFiltered / 60).toFixed(1)}h</div>
                    </div>
                    <div style={{ ...styles.card, textAlign: 'center', padding: '14px 12px' }}>
                        <div className="u-stat-label">Unosa</div>
                        <div className="ts__stat-value" style={{ color: C.blue }}>{filtered.length}</div>
                    </div>
                    <div style={{ ...styles.card, textAlign: 'center', padding: '14px 12px' }}>
                        <div className="u-stat-label">Odobreno</div>
                        <div className="ts__stat-value" style={{ color: C.green }}>{approvedCount}</div>
                    </div>
                    <div style={{ ...styles.card, textAlign: 'center', padding: '14px 12px' }}>
                        <div className="u-stat-label">Na čekanju</div>
                        <div className="ts__stat-value" style={{ color: C.yellow }}>{pendingCount}</div>
                    </div>
                    <div style={{ ...styles.card, textAlign: 'center', padding: '14px 12px' }}>
                        <div className="u-stat-label">Prosj./dan</div>
                        <div className="ts__stat-value" style={{ color: 'var(--purple)' }}>{avgPerDay}h</div>
                    </div>
                </div>

                {/* Filters */}
                <div style={styles.card} className="ts__filters">
                    <div className="ts__search-wrap">
                        <Input placeholder="Traži radnika, projekt..." value={search} onChange={e => setSearch(e.target.value)} className="u-pl-36" />
                        <div className="ts__search-icon"><Icon name="search" size={14} /></div>
                    </div>
                    <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} className="ts__filter-select">
                        <option value="all">Svi radnici</option>
                        {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </Select>
                    <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="ts__filter-select">
                        <option value="all">Svi projekti</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                    <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ts__filter-status">
                        <option value="all">Svi statusi</option>
                        <option value="na čekanju">Na čekanju</option>
                        <option value="odobren">Odobren</option>
                        <option value="odbijen">Odbijen</option>
                    </Select>
                    <div className="ts__date-range">
                        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="ts__date-input" />
                        <span className="ts__date-sep">—</span>
                        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="ts__date-input" />
                    </div>
                </div>

                {/* Pending banner */}
                {pendingCount > 0 && (
                    <div style={styles.card} className="ts__pending-banner">
                        <div className="ts__pending-icon">⏳</div>
                        <div>
                            <div className="ts__pending-title">{pendingCount} unos{pendingCount > 1 ? 'a' : ''} čeka odobrenje</div>
                            <div className="u-fs-12 u-text-muted">Pregledajte i odobrite/odbijte unose radnika</div>
                        </div>
                        <button onClick={() => { setFilterStatus('na čekanju'); }} style={{ ...styles.btnSmall, marginLeft: 'auto', color: C.yellow, borderColor: 'rgba(180,83,9,0.3)' }}>Prikaži sve</button>
                    </div>
                )}

                {/* Table */}
                <div style={styles.card} className="ts__table-card">
                    <div className="ts__table-header">
                        <div className="u-section-title">Pregled ({filtered.length})</div>
                        <div className="u-fs-12 u-text-muted">{(totalFiltered / 60).toFixed(1)}h ukupno</div>
                    </div>
                    <div className="u-overflow-x">
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                            <thead><tr>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1, width: 36, textAlign: 'center' }}>
                                    <input type="checkbox" checked={pg.paginate(filtered).length > 0 && pg.paginate(filtered).every(t => selectedIds.has(t.id))} onChange={selectAllVisible} style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 16, height: 16 }} />
                                </th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Datum</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Radnik</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Projekt</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Od</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Do</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Pauza</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Neto</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Tip</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Status</th>
                                <th style={{ ...styles.th, position: 'sticky', top: 0, background: C.bgElevated, zIndex: 1 }}>Akcije</th>
                            </tr></thead>
                            <tbody>
                                {pg.paginate(filtered).map((t, idx) => {
                                    const w = workers.find(x => x.id === t.workerId);
                                    const p = projects.find(x => x.id === t.projectId);
                                    const mins = diffMins(t.startTime, t.endTime) - (t.breakMins || 0);
                                    const isPending = t.status === 'na čekanju';
                                    const typeLabel = { normalan: '', prekovremeni: '', noćni: '🌙', vikend: '📅' };
                                    return (
                                        <tr key={t.id} style={{ background: selectedIds.has(t.id) ? 'var(--accent-light)' : isPending ? 'var(--yellow-light)' : 'var(--card)' }}>
                                            <td style={{ ...styles.td, width: 36, textAlign: 'center' }}>
                                                <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 16, height: 16 }} />
                                            </td>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                                            <td style={styles.td}>
                                                <div className="u-flex-center u-gap-8">
                                                    <div className="ts__avatar">{w?.name?.charAt(0)}</div>
                                                    <span className="ts__worker-name">{w?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td style={styles.td} className="ts__project-cell">{p?.name || '—'}</td>
                                            <td style={{ ...styles.td, fontSize: 13 }}>{t.startTime}</td>
                                            <td style={{ ...styles.td, fontSize: 13 }}>{t.endTime}</td>
                                            <td style={{ ...styles.td, fontSize: 12, color: C.textMuted }}>{t.breakMins || 0}m</td>
                                            <td style={{ ...styles.td, fontWeight: 700, color: C.accent, fontSize: 13 }}>{(mins / 60).toFixed(1)}h</td>
                                            <td style={{ ...styles.td, fontSize: 12 }}>{typeLabel[t.type] || ''} {t.type || 'normalan'}</td>
                                            <td style={styles.td}><StatusBadge status={t.status} /></td>
                                            <td style={styles.td}>
                                                <div className="ts__actions">
                                                    {isPending && <>
                                                        <button onClick={() => approve(t)} style={{ ...styles.btnSmall, background: 'rgba(34,197,94,0.12)', color: C.green, border: '1px solid rgba(34,197,94,0.25)', padding: '4px 8px' }} title="Odobri"><Icon name="check" size={13} /></button>
                                                        <button onClick={() => reject(t)} style={{ ...styles.btnSmall, background: 'rgba(239,68,68,0.1)', color: C.red, border: '1px solid rgba(239,68,68,0.2)', padding: '4px 8px' }} title="Odbij"><Icon name="close" size={13} /></button>
                                                    </>}
                                                    <button onClick={() => setDetailId(t.id)} style={{ ...styles.btnSmall, padding: '4px 8px' }} title="Detalji"><Icon name="eye" size={13} /></button>
                                                    <button onClick={() => openEdit(t)} style={{ ...styles.btnSmall, padding: '4px 8px' }} title="Uredi"><Icon name="edit" size={12} /></button>
                                                    <button onClick={() => doDelete(t.id)} style={{ ...styles.btnSmall, background: 'rgba(239,68,68,0.08)', color: C.red, border: '1px solid rgba(239,68,68,0.15)', padding: '4px 8px' }} title="Obriši"><Icon name="trash" size={12} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filtered.length === 0 && <div className="ts__empty">Nema unosa za odabrane filtere</div>}
                    </div>
                    {filtered.length > 0 && <Pagination {...pg} totalItems={filtered.length} label="unosa" />}
                </div>

                {/* Detail modal */}
                {detailTs && (
                    <Modal title="Detalji radnog vremena" onClose={() => setDetailId(null)}>
                        {(() => {
                            const w = workers.find(x => x.id === detailTs.workerId);
                            const p = projects.find(x => x.id === detailTs.projectId);
                            const mins = diffMins(detailTs.startTime, detailTs.endTime) - (detailTs.breakMins || 0);
                            return (
                                <div>
                                    <div className="ts__detail-grid">
                                        <div><span style={styles.label}>Radnik</span><div className="u-fw-600">{w?.name || '—'}</div></div>
                                        <div><span style={styles.label}>Projekt</span><div className="u-fw-600">{p?.name || '—'}</div></div>
                                        <div><span style={styles.label}>Datum</span><div>{fmtDate(detailTs.date)}</div></div>
                                        <div><span style={styles.label}>Tip</span><div>{detailTs.type || 'normalan'}</div></div>
                                        <div><span style={styles.label}>Od - Do</span><div>{detailTs.startTime} — {detailTs.endTime}</div></div>
                                        <div><span style={styles.label}>Neto sati</span><div style={{ fontWeight: 700, color: C.accent }}>{(mins / 60).toFixed(1)}h</div></div>
                                        <div><span style={styles.label}>Pauza</span><div>{detailTs.breakMins || 0} min</div></div>
                                        <div><span style={styles.label}>Status</span><StatusBadge status={detailTs.status} /></div>
                                    </div>
                                    {detailTs.description && <div className="u-mb-12"><span style={styles.label}>Opis rada</span><div className="ts__detail-desc">{detailTs.description}</div></div>}
                                    {detailTs.gpsLocation && <div className="u-mb-12"><span style={styles.label}>GPS Lokacija</span><div className="ts__detail-gps">📍 {detailTs.gpsLocation}</div></div>}
                                    {detailTs.notes && <div className="u-mb-12"><span style={styles.label}>Napomene</span><div className="ts__detail-notes">{detailTs.notes}</div></div>}
                                    {detailTs.rejectReason && <div className="u-mb-12"><span style={styles.label}>Razlog odbijanja</span><div className="ts__detail-reject">{detailTs.rejectReason}</div></div>}
                                    {detailTs.source && <div className="u-fs-12 u-text-muted">Izvor: {detailTs.source === 'admin' ? 'Admin unos' : 'Radnički unos'}</div>}
                                    {detailTs.invoiceFile && <div className="u-mt-12"><span style={styles.label}>Priloženi račun</span><div style={{ marginTop: 4 }}><a href={detailTs.invoiceFile.data} download={detailTs.invoiceFile.name} style={styles.btnSmall}><Icon name="download" size={14} /> {detailTs.invoiceFile.name}</a></div></div>}
                                    {detailTs.status === 'na čekanju' && (
                                        <div className="ts__detail-actions">
                                            <button onClick={() => { approve(detailTs); setDetailId(null); }} style={{ ...styles.btn, background: C.green, flex: 1, justifyContent: 'center' }}><Icon name="check" size={16} /> Odobri</button>
                                            <button onClick={() => { reject(detailTs); setDetailId(null); }} style={{ ...styles.btn, background: C.red, flex: 1, justifyContent: 'center' }}><Icon name="close" size={16} /> Odbij</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </Modal>
                )}

                {/* Add/Edit Modal */}
                {showForm && (
                    <Modal title={editId ? 'Uredi radne sate' : 'Dodaj radne sate'} onClose={() => setShowForm(false)} wide>
                        <div className={`ts__form-grid ${isMobile ? 'ts__form-grid--mobile' : 'ts__form-grid--desktop'} u-gap-16`}>
                            <Field label="Radnik" required>
                                <Select value={form.workerId} onChange={e => update('workerId', e.target.value)}>
                                    <option value="">— Odaberi radnika —</option>
                                    {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </Select>
                            </Field>
                            <Field label="Projekt" required>
                                <Select value={form.projectId} onChange={e => update('projectId', e.target.value)}>
                                    <option value="">— Odaberi projekt —</option>
                                    {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </Select>
                            </Field>
                            <Field label="Datum"><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
                            <Field label="Tip rada">
                                <Select value={form.type} onChange={e => update('type', e.target.value)}>
                                    <option value="normalan">Normalan</option><option value="prekovremeni">Prekovremeni</option><option value="noćni">Noćni</option><option value="vikend">Vikend</option>
                                </Select>
                            </Field>
                            <Field label="Početak"><Input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} /></Field>
                            <Field label="Završetak"><Input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} /></Field>
                            <Field label="Pauza (min)"><Input type="number" value={form.breakMins} onChange={e => update('breakMins', parseInt(e.target.value) || 0)} min={0} max={120} /></Field>
                            <Field label="Status">
                                <Select value={form.status} onChange={e => update('status', e.target.value)}>
                                    <option value="odobren">Odobren</option><option value="na čekanju">Na čekanju</option><option value="odbijen">Odbijen</option>
                                </Select>
                            </Field>
                        </div>
                        <div className="ts__net-hours">
                            <div className="ts__net-label">Neto sati:</div>
                            <div className="ts__net-value">{((diffMins(form.startTime, form.endTime) - (form.breakMins || 0)) / 60).toFixed(1)}h</div>
                        </div>
                        <Field label="Opis rada"><Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Što je radnik radio..." /></Field>
                        <Field label="Napomene"><Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Dodatne napomene..." /></Field>
                        <div className="u-flex-end">
                            <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Odustani</button>
                            <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                        </div>
                    </Modal>
                )}
            </div>

            {/* Bulk Action Bar */}
            <BulkActionBar
                count={selectedIds.size}
                actions={[
                    { label: 'Odobri', icon: 'check', color: 'green', onClick: bulkApprove },
                    { label: 'Odbij', icon: 'close', color: 'red', onClick: bulkReject },
                    { label: 'Obriši', icon: 'trash', color: 'red', onClick: bulkDelete, confirm: true }
                ]}
                onClear={clearSelection}
            />
        </>
    );
}
