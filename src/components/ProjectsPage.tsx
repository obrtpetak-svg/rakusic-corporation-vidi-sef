import { useState, useMemo } from 'react';
import { SvgHBarChart, SvgLineChart } from './ui/SharedComponents';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, WorkerCheckboxList, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, diffMins, compressImage } from '../utils/helpers';
import './projects.css';

export function ProjectsPage({ workerFilterId, leaderProjectIds, onNavigate }) {
    const confirm = useConfirm();
    const { projects, workers, timesheets, invoices, obaveze, otpremnice, currentUser, addAuditLog } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showObForm, setShowObForm] = useState(false);
    const [obForm, setObForm] = useState({ title: '', description: '', dueDate: '', workerIds: [], priority: 'normalan' });
    const isMobile = useIsMobile();

    const [filterWorker, setFilterWorker] = useState('all');
    const [filterLocation, setFilterLocation] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const isWorker = !!workerFilterId;
    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');

    const defaultPhases = [
        { id: genId(), name: 'Pripremni radovi', description: 'Dovoz materijala, postavljanje ograde, čišćenje terena', status: 'pending', completedAt: null, completedBy: null },
        { id: genId(), name: 'Glavni radovi', description: 'Konstrukcija, betoniranje, zidanje, instalacije', status: 'pending', completedAt: null, completedBy: null },
        { id: genId(), name: 'Završni radovi', description: 'Fasada, unutarnje uređenje, čišćenje, primopredaja', status: 'pending', completedAt: null, completedBy: null },
    ];
    const blankForm = () => ({ name: '', description: '', location: '', siteLat: '', siteLng: '', status: 'aktivan', startDate: today(), endDate: '', notes: '', workers: [], client: '', teamLeader: '', engineer: '', details: '', files: [], phases: defaultPhases });
    const [form, setForm] = useState(blankForm());
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const [geocoding, setGeocoding] = useState(false);

    // Unique locations for filter
    const locations = useMemo(() => [...new Set(projects.map(p => p.location).filter(Boolean))].sort(), [projects]);

    const filtered = useMemo(() => {
        let list = projects;
        if (isWorker) list = list.filter(p => (p.workers || []).includes(workerFilterId));
        if (leaderProjectIds && leaderProjectIds.length > 0) list = list.filter(p => leaderProjectIds.includes(p.id));
        if (filterStatus !== 'all') list = list.filter(p => p.status === filterStatus);
        if (filterWorker !== 'all') list = list.filter(p => (p.workers || []).includes(filterWorker) || p.teamLeader === filterWorker || p.engineer === filterWorker);
        if (filterLocation !== 'all') list = list.filter(p => p.location === filterLocation);
        if (search) list = list.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.location || '').toLowerCase().includes(search.toLowerCase()) || (p.client || '').toLowerCase().includes(search.toLowerCase()));
        // Sort
        list = [...list].sort((a, b) => {
            if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'hr');
            if (sortBy === 'hours') { const ah = timesheets.filter(t => t.projectId === a.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0); const bh = timesheets.filter(t => t.projectId === b.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0); return bh - ah; }
            if (sortBy === 'workers') return ((b.workers || []).length) - ((a.workers || []).length);
            if (sortBy === 'date') return (b.startDate || '').localeCompare(a.startDate || '');
            if (sortBy === 'costs') { const ac = invoices.filter(i => i.projectId === a.id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0); const bc = invoices.filter(i => i.projectId === b.id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0); return bc - ac; }
            return 0;
        });
        return list;
    }, [projects, filterStatus, filterWorker, filterLocation, search, workerFilterId, leaderProjectIds, sortBy, timesheets, invoices]);

    // Stats overview
    const projectStats = useMemo(() => {
        const totalHours = +(filtered.reduce((s, p) => s + timesheets.filter(t => t.projectId === p.id).reduce((s2, t) => s2 + diffMins(t.startTime, t.endTime), 0), 0) / 60).toFixed(1);
        const totalCosts = filtered.reduce((s, p) => s + invoices.filter(i => i.projectId === p.id).reduce((s2, i) => s2 + (parseFloat(i.amount) || 0), 0), 0).toFixed(2);
        const uniqueWorkers = new Set(filtered.flatMap(p => p.workers || [])).size;
        return {
            total: filtered.length,
            active: filtered.filter(p => p.status === 'aktivan').length,
            finished: filtered.filter(p => p.status === 'završen').length,
            totalHours,
            totalCosts,
            uniqueWorkers,
        };
    }, [filtered, timesheets, invoices]);

    const hasActiveFilters = filterStatus !== 'all' || filterWorker !== 'all' || filterLocation !== 'all' || search;

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (p) => {
        setForm({ name: p.name || '', description: p.description || '', location: p.location || '', siteLat: p.siteLat || '', siteLng: p.siteLng || '', status: p.status || 'aktivan', startDate: p.startDate || '', endDate: p.endDate || '', notes: p.notes || '', workers: p.workers || [], client: p.client || '', teamLeader: p.teamLeader || '', engineer: p.engineer || '', details: p.details || '', files: p.files || [], phases: p.phases || [] });
        setEditId(p.id); setShowForm(true);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert('Datoteka je prevelika (max 10MB)');
        const compressed = await compressImage(file);
        setForm(f => ({ ...f, files: [...(f.files || []), { id: genId(), ...compressed, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.name }] }));
    };

    const removeFile = (fileId) => {
        setForm(f => ({ ...f, files: (f.files || []).filter(file => file.id !== fileId) }));
    };

    const doSave = async () => {
        if (!form.name.trim()) return alert('Naziv projekta je obavezan');
        if (editId) {
            await updateDoc('projects', editId, { ...form, updatedAt: new Date().toISOString(), updatedBy: currentUser?.name });
        } else {
            await addDoc('projects', { id: genId(), ...form, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
        }
        setShowForm(false);
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati ovaj projekt?'))) return;
        await removeDoc('projects', id);
    };

    // Detail view
    const detailProject = detailId ? projects.find(p => p.id === detailId) : null;
    const detailTimesheets = detailProject ? timesheets.filter(t => t.projectId === detailProject.id) : [];
    const detailInvoices = detailProject ? invoices.filter(i => i.projectId === detailProject.id) : [];
    const detailWorkerIds = detailProject ? (detailProject.workers || []) : [];
    const detailWorkers = detailWorkerIds.map(wid => workers.find(w => w.id === wid)).filter(Boolean);
    const totalHours = detailTimesheets.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
    const detailOtpremnice = detailProject ? otpremnice.filter(o => o.projectId === detailProject.id) : [];
    const detailObaveze = detailProject ? obaveze.filter(o => (o.projectId === detailProject.id) || (o.projectIds || []).includes(detailProject?.id)) : [];
    const detailPhases = detailProject?.phases || [];
    const canManagePhases = currentUser?.role === 'admin' || currentUser?.role === 'leader';

    // Phase management
    const togglePhase = async (phaseId) => {
        if (!canManagePhases || !detailProject) return;
        const updatedPhases = detailPhases.map(ph => ph.id === phaseId ? { ...ph, status: ph.status === 'done' ? 'pending' : 'done', completedAt: ph.status === 'done' ? null : new Date().toISOString(), completedBy: ph.status === 'done' ? null : currentUser?.name } : ph);
        await updateDoc('projects', detailProject.id, { phases: updatedPhases });
    };
    const addPhase = async (name) => {
        if (!canManagePhases || !detailProject || !name.trim()) return;
        const newPhase = { id: genId(), name: name.trim(), description: '', status: 'pending', completedAt: null, completedBy: null };
        await updateDoc('projects', detailProject.id, { phases: [...detailPhases, newPhase] });
    };
    const removePhase = async (phaseId) => {
        if (!canManagePhases || !detailProject) return;
        await updateDoc('projects', detailProject.id, { phases: detailPhases.filter(ph => ph.id !== phaseId) });
    };

    // Charts data for detail view
    const hoursByWorker = useMemo(() => {
        if (!detailProject) return [];
        return detailWorkers.map(w => ({
            name: w.name?.split(' ')[0] || '?',
            hours: +(detailTimesheets.filter(t => t.workerId === w.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1)
        })).filter(w => w.hours > 0).sort((a, b) => b.hours - a.hours);
    }, [detailProject, detailWorkers, detailTimesheets]);

    const hoursByDay = useMemo(() => {
        if (!detailProject || detailTimesheets.length === 0) return [];
        const dayMap = {};
        detailTimesheets.forEach(t => {
            if (!t.date) return;
            dayMap[t.date] = (dayMap[t.date] || 0) + diffMins(t.startTime, t.endTime) / 60;
        });
        return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, hours]) => ({ dan: day.slice(5), hours: +hours.toFixed(1) }));
    }, [detailProject, detailTimesheets]);

    const [newPhaseName, setNewPhaseName] = useState('');

    const getWorkerName = (id) => { const w = workers.find(x => x.id === id); return w ? w.name : '—'; };

    const openObAdd = () => { setObForm({ title: '', description: '', dueDate: '', workerIds: [], priority: 'normalan' }); setShowObForm(true); };
    const saveObligation = async () => {
        if (!obForm.title.trim()) return alert('Naslov je obavezan');
        await addDoc('obaveze', { id: genId(), ...obForm, projectId: detailProject.id, active: true, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
        setShowObForm(false);
    };
    const toggleOb = async (ob) => {
        await updateDoc('obaveze', ob.id, { active: !ob.active, completedAt: ob.active ? new Date().toISOString() : null });
    };

    if (detailProject) {
        const projectFiles = detailProject.files || [];
        return (
            <div>
                <button onClick={() => setDetailId(null)} className="s-btn-sec" style={{ marginBottom: 20, display: 'inline-flex' }}><Icon name="back" size={16} /> Natrag</button>
                <div className="s-card" className="u-mb-20">
                    <div className="proj__detail-header">
                        <div>
                            <div className="u-fs-22 u-fw-800 u-color-text">{detailProject.name}</div>
                            <div className="proj__detail-location">{detailProject.location && `📍 ${detailProject.location}`} {detailProject.siteLat && <span className="proj__gps-inline">({Number(detailProject.siteLat).toFixed(3)}°N, {Number(detailProject.siteLng).toFixed(3)}°E)</span>} {detailProject.client && `• 🏢 ${detailProject.client}`}</div>
                        </div>
                        <StatusBadge status={detailProject.status} />
                    </div>
                    <div className={`proj__detail-stats ${isMobile ? 'proj__stats--2' : 'proj__stats--6'}`}>
                        <div className="proj__detail-stat proj__detail-stat--accent">
                            <div className="proj__detail-stat-label">Radnici</div>
                            <div className="proj__detail-stat-value" style={{ color: C.accent }}>{detailWorkers.length}</div>
                        </div>
                        <div className="proj__detail-stat proj__detail-stat--blue">
                            <div className="proj__detail-stat-label">Ukupno sati</div>
                            <div className="proj__detail-stat-value" style={{ color: C.blue }}>{Math.round(totalHours / 60)}h</div>
                        </div>
                        <div className="proj__detail-stat proj__detail-stat--green">
                            <div className="proj__detail-stat-label">Unosi sati</div>
                            <div className="proj__detail-stat-value" style={{ color: C.green }}>{detailTimesheets.length}</div>
                        </div>
                        <div role="button" tabIndex={0} aria-label="Otvori račune" onClick={() => onNavigate && onNavigate('racuni')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onNavigate?.('racuni')} className="proj__detail-stat proj__detail-stat--purple" style={{ cursor: onNavigate ? 'pointer' : 'default', transition: 'transform 0.15s' }} onMouseEnter={e => onNavigate && (e.currentTarget.style.transform = 'scale(1.03)')} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                            <div className="proj__detail-stat-label">Računi {onNavigate && '→'}</div>
                            <div className="proj__detail-stat-value" style={{ color: '#7C3AED' }}>{detailInvoices.length}</div>
                        </div>
                        <div role="button" tabIndex={0} aria-label="Otvori otpremnice" onClick={() => onNavigate && onNavigate('otpremnice')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onNavigate?.('otpremnice')} className="proj__detail-stat proj__detail-stat--orange" style={{ cursor: onNavigate ? 'pointer' : 'default', transition: 'transform 0.15s' }} onMouseEnter={e => onNavigate && (e.currentTarget.style.transform = 'scale(1.03)')} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                            <div className="proj__detail-stat-label">Otpremnice {onNavigate && '→'}</div>
                            <div className="proj__detail-stat-value" style={{ color: '#EA580C' }}>{detailOtpremnice.length}</div>
                        </div>
                        <div className="proj__detail-stat proj__detail-stat--red">
                            <div className="proj__detail-stat-label">Obaveze</div>
                            <div className="proj__detail-stat-value" style={{ color: '#DC2626' }}>{detailObaveze.filter(o => o.active).length}/{detailObaveze.length}</div>
                        </div>
                    </div>

                    {/* Team leader & Engineer */}
                    {(detailProject.teamLeader || detailProject.engineer) && (
                        <div className="proj__team-row">
                            {detailProject.teamLeader && <div className="proj__team-badge proj__team-badge--leader"><div className="proj__team-label">Voditelj ekipe</div><div className="proj__team-name" style={{ color: C.blue }}>👷 {getWorkerName(detailProject.teamLeader)}</div></div>}
                            {detailProject.engineer && <div className="proj__team-badge proj__team-badge--engineer"><div className="proj__team-label">Inženjer</div><div className="proj__team-name" style={{ color: C.green }}> {getWorkerName(detailProject.engineer)}</div></div>}
                        </div>
                    )}

                    {detailProject.description && <div className="proj__desc-block">{detailProject.description}</div>}

                    {/* Project Details */}
                    {detailProject.details && (
                        <div className="proj__detail-block">
                            <div className="proj__detail-block-title">📋 DETALJI PROJEKTA</div>
                            <div className="proj__detail-block-text">{detailProject.details}</div>
                        </div>
                    )}

                    {detailProject.notes && <div className="proj__notes-block">📝 {detailProject.notes}</div>}
                    <div className="proj__dates-row">
                        <span>📅 Početak: {fmtDate(detailProject.startDate)}</span>
                        {detailProject.endDate && <span>📅 Kraj: {fmtDate(detailProject.endDate)}</span>}
                    </div>
                </div>

                {/* Files / Documents */}
                {projectFiles.length > 0 && (
                    <div className="s-card" className="u-mb-20">
                        <div className="proj__section-title proj__section-title--mb"><Icon name="file" size={16} /> Dokumenti i slike ({projectFiles.length})</div>
                        <div className={`proj__files-grid ${isMobile ? 'proj__files-grid--mobile' : 'proj__files-grid--desktop'}`}>
                            {projectFiles.map(f => (
                                <div key={f.id} className="proj__file-card">
                                    {f.type?.startsWith('image/') ? (
                                        <div className="proj__file-preview proj__file-preview--clickable" onClick={() => { const w = window.open(); w.document.write(`<img src="${f.data}" style="max-width:100%;height:auto">`); }}>
                                            <img src={f.data} alt={f.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ) : (
                                        <div className="proj__file-preview">
                                            <div className="u-text-center"><Icon name="file" size={32} /><div className="proj__file-type">{f.type || 'File'}</div></div>
                                        </div>
                                    )}
                                    <div className="proj__file-info">
                                        <div className="proj__file-name">{f.name}</div>
                                        <div className="u-stat-label">Uploaded: {f.uploadedBy || '—'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Workers on project */}
                <div className="s-card" className="u-mb-20">
                    <div className="proj__section-title proj__section-title--mb"><Icon name="workers" size={16} /> Radnici na projektu ({detailWorkers.length})</div>
                    {detailWorkers.length === 0 ? <div className="proj__empty">Nema dodijeljenih radnika</div> : (
                        <div className={`proj__worker-grid ${isMobile ? 'proj__worker-grid--mobile' : 'proj__worker-grid--desktop'}`}>
                            {detailWorkers.map(w => {
                                const wHours = detailTimesheets.filter(t => t.workerId === w.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                                const isLeader = detailProject.teamLeader === w.id;
                                const isEngineer = detailProject.engineer === w.id;
                                return (
                                    <div key={w.id} onClick={() => onNavigate && onNavigate('radnici', w.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: isLeader ? 'rgba(29,78,216,0.06)' : isEngineer ? 'rgba(4,120,87,0.06)' : 'var(--bg)', border: `1px solid ${isLeader ? 'rgba(29,78,216,0.2)' : isEngineer ? 'rgba(4,120,87,0.2)' : C.border}`, cursor: onNavigate ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s' }} onMouseEnter={e => { if (onNavigate) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; } }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                                        <div className="proj__worker-avatar">{w.name?.charAt(0)}</div>
                                        <div className="u-flex-1">
                                            <div className="proj__worker-name">{w.name} {isLeader && <span style={{ fontSize: 10, color: C.blue }}>👷 Voditelj</span>} {isEngineer && <span style={{ fontSize: 10, color: C.green }}> Inženjer</span>}</div>
                                            <div className="u-fs-11 u-text-muted">{w.position || 'Radnik'} • {Math.round(wHours / 60)}h</div>
                                        </div>
                                        {onNavigate && <div className="proj__worker-link">Otvori →</div>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Timesheets on project */}
                {detailTimesheets.length > 0 && (
                    <div className="s-card" className="u-mb-20">
                        <div className="u-section-title u-mb-12">Radni sati ({detailTimesheets.length})</div>
                        <div className="u-overflow-x">
                            <table aria-label="Pregled" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr><th className="s-th">Datum</th><th className="s-th">Radnik</th><th className="s-th">Od</th><th className="s-th">Do</th><th className="s-th">Sati</th><th className="s-th">Status</th></tr></thead>
                                <tbody>
                                    {detailTimesheets.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20).map(t => {
                                        const w = workers.find(x => x.id === t.workerId);
                                        const mins = diffMins(t.startTime, t.endTime);
                                        return (
                                            <tr key={t.id}><td className="s-td">{fmtDate(t.date)}</td><td className="s-td">{w?.name || '—'}</td><td className="s-td">{t.startTime}</td><td className="s-td">{t.endTime}</td><td className="s-td">{(mins / 60).toFixed(1)}h</td><td className="s-td"><StatusBadge status={t.status} /></td></tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Project Obligations */}
                <div className="s-card" className="u-mb-20">
                    <div className="u-flex-between u-mb-16">
                        <div className="proj__section-title"><Icon name="warning" size={16} /> Obaveze ({detailObaveze.filter(o => o.active).length} aktivnih)</div>
                        {!isWorker && <button onClick={openObAdd} className="s-btn-sm"><Icon name="plus" size={12} /> Nova obaveza</button>}
                    </div>
                    {detailObaveze.length === 0 ? <div className="proj__empty">Nema obaveza za ovaj projekt</div> : (
                        <div>
                            {detailObaveze.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)).map(ob => {
                                const obWorkers = (ob.workerIds || []).map(wid => workers.find(w => w.id === wid)).filter(Boolean);
                                const isOverdue = ob.dueDate && ob.dueDate < today() && ob.active;
                                return (
                                    <div key={ob.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}7A`, opacity: ob.active ? 1 : 0.5 }}>
                                        <button onClick={() => toggleOb(ob)} style={{ background: 'none', border: `2px solid ${ob.active ? (isOverdue ? C.red : C.accent) : C.green}`, borderRadius: 5, width: 20, height: 20, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                            {!ob.active && <span style={{ color: C.green, fontSize: 12 }}>✓</span>}
                                        </button>
                                        <div className="u-flex-1">
                                            <div style={{ fontWeight: 600, fontSize: 13, color: ob.active ? C.text : C.textMuted, textDecoration: ob.active ? 'none' : 'line-through' }}>{ob.title}</div>
                                            {ob.description && <div className="u-fs-12 u-text-muted" style={{ marginTop: 2 }}>{ob.description}</div>}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: C.textMuted, flexWrap: 'wrap' }}>
                                                {ob.dueDate && <span style={{ color: isOverdue ? C.red : C.textMuted }}>📅 {fmtDate(ob.dueDate)}{isOverdue ? ' ⚠️' : ''}</span>}
                                                {ob.priority === 'hitno' && <span style={{ color: C.red, fontWeight: 700 }}>🔴 HITNO</span>}
                                                {ob.priority === 'visok' && <span style={{ color: '#F59E0B', fontWeight: 700 }}>🟡 Visok</span>}
                                                {obWorkers.length > 0 && <span>👥 {obWorkers.map(w => w.name.split(' ')[0]).join(', ')}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Faze rada (Work Phases) */}
                <div className="s-card" className="u-mb-20">
                    <div className="u-flex-between u-mb-16">
                        <div className="proj__section-title"><Icon name="check" size={16} /> Faze rada ({detailPhases.filter(p => p.status === 'done').length}/{detailPhases.length})</div>
                    </div>
                    {/* Progress bar */}
                    {detailPhases.length > 0 && (
                        <div className="u-mb-16">
                            <div className="proj__progress-header">
                                <span>Napredak</span>
                                <span style={{ fontWeight: 700, color: detailPhases.every(p => p.status === 'done') ? C.green : C.accent }}>{Math.round(detailPhases.filter(p => p.status === 'done').length / detailPhases.length * 100)}%</span>
                            </div>
                            <div className="proj__progress-bar">
                                <div style={{ height: '100%', width: `${detailPhases.filter(p => p.status === 'done').length / detailPhases.length * 100}%`, background: detailPhases.every(p => p.status === 'done') ? C.green : C.accent, borderRadius: 4, transition: 'width 0.4s ease' }} />
                            </div>
                        </div>
                    )}
                    {detailPhases.length === 0 ? <div className="proj__empty">Nema definiranih faza</div> : (
                        <div>
                            {detailPhases.map((ph, i) => (
                                <div key={ph.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: i < detailPhases.length - 1 ? `1px solid ${C.border}7A` : 'none' }}>
                                    <button onClick={() => togglePhase(ph.id)} disabled={!canManagePhases} style={{ border: `2px solid ${ph.status === 'done' ? C.green : C.accent}`, borderRadius: 5, width: 22, height: 22, cursor: canManagePhases ? 'pointer' : 'default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, background: ph.status === 'done' ? C.green : 'transparent' }}>
                                        {ph.status === 'done' && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                                    </button>
                                    <div className="u-flex-1">
                                        <div style={{ fontWeight: 600, fontSize: 14, color: ph.status === 'done' ? C.textMuted : C.text, textDecoration: ph.status === 'done' ? 'line-through' : 'none' }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginRight: 6 }}>{i + 1}.</span>{ph.name}
                                        </div>
                                        {ph.description && <div className="u-fs-12 u-text-muted" style={{ marginTop: 2 }}>{ph.description}</div>}
                                        {ph.status === 'done' && ph.completedBy && (
                                            <div className="proj__phase-completed">✓ Završio: {ph.completedBy} • {fmtDate(ph.completedAt)}</div>
                                        )}
                                    </div>
                                    {canManagePhases && (
                                        <button onClick={() => removePhase(ph.id)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 4, opacity: 0.5 }} title="Ukloni fazu">✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {canManagePhases && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <input value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newPhaseName.trim()) { addPhase(newPhaseName); setNewPhaseName(''); } }} placeholder="Nova faza rada..." style={{ ...styles.input, flex: 1, marginBottom: 0, fontSize: 13 }} />
                            <button onClick={() => { if (newPhaseName.trim()) { addPhase(newPhaseName); setNewPhaseName(''); } }} disabled={!newPhaseName.trim()} className="s-btn-sm" style={{ opacity: newPhaseName.trim() ? 1 : 0.4 }}><Icon name="plus" size={12} /> Dodaj</button>
                        </div>
                    )}
                </div>

                {/* Charts: Hours by worker + Hours by day */}
                {detailTimesheets.length > 0 && (
                    <div className={`proj__charts-grid ${isMobile ? 'proj__charts-grid--mobile' : 'proj__charts-grid--desktop'}`}>
                        {hoursByWorker.length > 0 && (
                            <div className="s-card">
                                <div className="proj__chart-title"><Icon name="workers" size={16} /> Sati po radniku</div>
                                <SvgHBarChart data={hoursByWorker} dataKey="hours" color={C.accent} height={Math.max(150, hoursByWorker.length * 32)} />
                            </div>
                        )}
                        {hoursByDay.length > 1 && (
                            <div className="s-card">
                                <div className="proj__chart-title"><Icon name="clock" size={16} /> Sati po danu (zadnjih {hoursByDay.length} dana)</div>
                                <SvgLineChart data={hoursByDay} dataKey="hours" color="#3B82F6" height={200} />
                            </div>
                        )}
                    </div>
                )}

                {/* Add Obligation Modal */}
                {showObForm && (
                    <Modal title="Nova obaveza za projekt" onClose={() => setShowObForm(false)}>
                        <Field label="Naslov" required><Input value={obForm.title} onChange={e => setObForm(f => ({ ...f, title: e.target.value }))} placeholder="Što treba napraviti" autoFocus /></Field>
                        <Field label="Opis"><Textarea value={obForm.description} onChange={e => setObForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalji..." rows={2} /></Field>
                        <div className="proj__form-2col">
                            <Field label="Rok"><Input type="date" value={obForm.dueDate} onChange={e => setObForm(f => ({ ...f, dueDate: e.target.value }))} /></Field>
                            <Field label="Prioritet">
                                <Select value={obForm.priority} onChange={e => setObForm(f => ({ ...f, priority: e.target.value }))}>
                                    <option value="normalan">Normalan</option><option value="visok">Visok</option><option value="hitno">Hitno</option>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Dodijeli radnicima"><WorkerCheckboxList allWorkers={detailWorkers.length > 0 ? detailWorkers : activeWorkers} selected={obForm.workerIds} onChange={v => setObForm(f => ({ ...f, workerIds: v }))} /></Field>
                        <div className="u-flex-end u-mt-16">
                            <button onClick={() => setShowObForm(false)} className="s-btn-sec">Odustani</button>
                            <button onClick={saveObligation} className="s-btn"><Icon name="check" size={16} /> Spremi</button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="proj__header">
                <div>
                    <div className="u-fs-24 u-fw-800 u-color-text">{isWorker ? 'Moji projekti' : '📁 Projekti'}</div>
                    <div className="u-fs-12 u-text-muted" style={{ marginTop: 2 }}>{isWorker ? `${filtered.length} dodijeljenih projekata` : `${projects.length} projekata • ${activeWorkers.length} radnika • Evidencija gradilišta`}</div>
                </div>
                {!isWorker && <button onClick={openAdd} className="s-btn"><Icon name="plus" size={16} /> Novi projekt</button>}
            </div>

            {/* Stats overview */}
            <div className={`proj__stats ${isMobile ? 'proj__stats--2' : isWorker ? 'proj__stats--3' : 'proj__stats--6'}`}>
                <div className="s-card" style={{ textAlign: 'center', padding: '14px 10px' }} className="u-text-center">
                    <div className="proj__stat-label">Projekata</div>
                    <div className="proj__stat-value" style={{ color: C.accent }}>{projectStats.total}</div>
                </div>
                <div className="s-card" style={{ textAlign: 'center', padding: '14px 10px' }} className="u-text-center">
                    <div className="proj__stat-label">Aktivni</div>
                    <div className="proj__stat-value" style={{ color: '#10B981' }}>{projectStats.active}</div>
                </div>
                {!isWorker && <div className="s-card" style={{ textAlign: 'center', padding: '14px 10px' }} className="u-text-center">
                    <div className="proj__stat-label">Završeni</div>
                    <div className="proj__stat-value" style={{ color: '#6366F1' }}>{projectStats.finished}</div>
                </div>}
                <div className="s-card" style={{ textAlign: 'center', padding: '14px 10px' }} className="u-text-center">
                    <div className="proj__stat-label">Ukupno sati</div>
                    <div className="proj__stat-value" style={{ color: C.blue }}>{projectStats.totalHours}h</div>
                </div>
                {!isWorker && <>
                    <div className="s-card" style={{ textAlign: 'center', padding: '14px 10px' }} className="u-text-center">
                        <div className="proj__stat-label">Troškovi</div>
                        <div className="proj__stat-value" style={{ color: '#EF4444' }}>{parseFloat(projectStats.totalCosts) > 0 ? `${projectStats.totalCosts}€` : '0€'}</div>
                    </div>
                    <div className="s-card" style={{ textAlign: 'center', padding: '14px 10px' }} className="u-text-center">
                        <div className="proj__stat-label">Radnika</div>
                        <div className="proj__stat-value" style={{ color: '#F59E0B' }}>{projectStats.uniqueWorkers}</div>
                    </div>
                </>}
            </div>

            {/* Advanced Filters */}
            <div className="s-card" className="proj__filters">
                <div className="proj__filter-row">
                    <div className="proj__filter-search">
                        <Input placeholder="Pretraži projekt, lokaciju, klijenta..." value={search} onChange={e => setSearch(e.target.value)} className="u-pl-36" />
                        <div className="proj__filter-search-icon"><Icon name="search" size={16} /></div>
                    </div>
                    <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
                        <option value="all">Svi statusi</option>
                        <option value="aktivan">✅ Aktivan</option>
                        <option value="planiran">📋 Planiran</option>
                        <option value="pausa">⏸️ Pauza</option>
                        <option value="završen">🏁 Završen</option>
                    </Select>
                    {!isWorker && (
                        <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ width: 160 }}>
                            <option value="all">Svi radnici ({activeWorkers.length})</option>
                            {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </Select>
                    )}
                    {!isWorker && locations.length > 0 && (
                        <Select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ width: 160 }}>
                            <option value="all">Sve lokacije ({locations.length})</option>
                            {locations.map(l => <option key={l} value={l}>📍 {l}</option>)}
                        </Select>
                    )}
                    {!isWorker && (
                        <Select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 150 }}>
                            <option value="name">Sortiraj: Naziv</option>
                            <option value="date">Sortiraj: Datum</option>
                            <option value="hours">Sortiraj: Sati ↓</option>
                            <option value="workers">Sortiraj: Radnici ↓</option>
                            <option value="costs">Sortiraj: Troškovi ↓</option>
                        </Select>
                    )}
                    {hasActiveFilters && (
                        <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterWorker('all'); setFilterLocation('all'); }} className="s-btn-sm" style={{ color: C.red, borderColor: 'rgba(239,68,68,0.2)', fontSize: 11 }}>✕ Očisti</button>
                    )}
                </div>
                {hasActiveFilters && <div className="proj__filter-info">Filtrirano: {filtered.length} od {isWorker ? filtered.length : projects.length} projekata</div>}
            </div>

            {/* Projects grid */}
            <div className={`proj__grid ${isMobile ? 'proj__grid--mobile' : 'proj__grid--desktop'}`}>
                {filtered.map(p => {
                    const pWorkers = (p.workers || []).map(wid => workers.find(w => w.id === wid)).filter(Boolean);
                    const pTimesheets = timesheets.filter(t => t.projectId === p.id);
                    const pHours = pTimesheets.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                    const pCosts = invoices.filter(i => i.projectId === p.id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                    const pOtpremnice = otpremnice.filter(o => o.projectId === p.id);
                    const leader = p.teamLeader ? workers.find(w => w.id === p.teamLeader) : null;
                    return (
                        <div key={p.id} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setDetailId(p.id)} className="s-card" style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: `4px solid ${p.status === 'aktivan' ? '#10B981' : p.status === 'završen' ? '#6366F1' : p.status === 'pausa' ? '#F59E0B' : '#3B82F6'}` }} onClick={() => setDetailId(p.id)} onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
                            <div className="proj__card-header">
                                <div className="u-flex-1">
                                    <div className="proj__card-title">{p.name}</div>
                                    {p.location && <div className="u-fs-12 u-text-muted" style={{ marginTop: 2 }}>📍 {p.location} {p.siteLat ? <span className="proj__gps-yes">GPS ✓</span> : <span className="proj__gps-no">Bez GPS</span>}</div>}
                                </div>
                                <StatusBadge status={p.status} />
                            </div>
                            {p.client && <div className="proj__card-client">🏢 {p.client}</div>}
                            {leader && <div className="proj__card-leader">👷 Voditelj: {leader.name}</div>}
                            <div style={{ display: 'grid', gridTemplateColumns: isWorker ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8, marginBottom: 12, padding: '10px 0', borderTop: `1px solid ${C.border}7A`, borderBottom: `1px solid ${C.border}7A` }}>
                                <div className="u-text-center"><div className="proj__card-stat-value" style={{ color: C.accent }}>{pWorkers.length}</div><div className="u-stat-label">Radnika</div></div>
                                <div className="u-text-center"><div className="proj__card-stat-value" style={{ color: C.blue }}>{Math.round(pHours / 60)}h</div><div className="u-stat-label">Sati</div></div>
                                {!isWorker && <div className="u-text-center"><div className="proj__card-stat-value" style={{ color: '#7C3AED' }}>{pTimesheets.length}</div><div className="u-stat-label">Unosa</div></div>}
                                {!isWorker && <div className="u-text-center"><div className="proj__card-stat-value" style={{ color: pCosts > 0 ? '#EF4444' : C.textDim }}>{pCosts > 0 ? `${pCosts.toFixed(0)}€` : '—'}</div><div className="u-stat-label">Troškovi</div></div>}
                            </div>
                            {/* Worker avatars */}
                            {pWorkers.length > 0 && (
                                <div className="proj__avatar-stack">
                                    {pWorkers.slice(0, 6).map((w, i) => (
                                        <div key={w.id} className="proj__avatar-mini" style={{ marginLeft: i > 0 ? -6 : 0 }}>{w.name?.charAt(0)}</div>
                                    ))}
                                    {pWorkers.length > 6 && <div className="proj__avatar-more" style={{ marginLeft: -6, border: `2px solid ${C.card}` }}>+{pWorkers.length - 6}</div>}
                                </div>
                            )}
                            {(pOtpremnice.length > 0 || (p.files || []).length > 0) && (
                                <div className="proj__card-meta">
                                    {pOtpremnice.length > 0 && <span>📦 {pOtpremnice.length} otpremnica</span>}
                                    {(p.files || []).length > 0 && <span>📎 {(p.files || []).length} dokumenata</span>}
                                </div>
                            )}
                            <div className="proj__card-footer">
                                <span>📅 {fmtDate(p.startDate)}{p.endDate ? ' → ' + fmtDate(p.endDate) : ''}</span>
                                {!isWorker && (
                                    <div className="proj__card-actions" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => openEdit(p)} className="s-btn-sm"><Icon name="edit" size={12} /></button>
                                        <button onClick={() => doDelete(p.id)} className="s-btn-danger"><Icon name="trash" size={12} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {filtered.length === 0 && <div className="s-card" className="proj__no-results"><div className="proj__no-results-icon">📭</div>Nema projekata za odabrane filtre</div>}

            {/* Add/Edit Modal */}
            {showForm && (
                <Modal title={editId ? 'Uredi projekt' : 'Novi projekt'} onClose={() => setShowForm(false)} wide>
                    <div className={`proj__form-grid ${isMobile ? 'proj__form-grid--mobile' : 'proj__form-grid--desktop'} u-gap-16`}>
                        <Field label="Naziv projekta" required><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Naziv gradilišta / projekta" autoFocus /></Field>
                        <Field label="Status"><Select value={form.status} onChange={e => update('status', e.target.value)}><option value="aktivan">Aktivan</option><option value="planiran">Planiran</option><option value="pausa">Pauza</option><option value="završen">Završen</option></Select></Field>
                        <Field label="Lokacija">
                            <div className="u-flex-gap-8">
                                <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Adresa / grad" className="u-flex-1" />
                                <button type="button" disabled={geocoding || !form.location.trim()} onClick={async () => {
                                    setGeocoding(true);
                                    try {
                                        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.location)}&limit=1`, { headers: { 'Accept-Language': 'hr' } });
                                        const data = await r.json();
                                        if (data?.[0]) {
                                            setForm(f => ({ ...f, siteLat: parseFloat(data[0].lat), siteLng: parseFloat(data[0].lon) }));
                                        } else { alert('Lokacija nije pronađena. Pokušajte precizniju adresu.'); }
                                    } catch { alert('Greška pri geocodingu.'); }
                                    setGeocoding(false);
                                }} className="s-btn-sm" style={{ whiteSpace: 'nowrap', padding: '8px 12px', background: form.siteLat ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)', color: form.siteLat ? '#10B981' : C.accent, borderColor: form.siteLat ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)' }}>
                                    {geocoding ? '⏳' : '📍'} {form.siteLat ? 'GPS ✓' : 'Odredi GPS'}
                                </button>
                                <button type="button" onClick={() => {
                                    if (!navigator.geolocation) return alert('Geolokacija nije podržana');
                                    navigator.geolocation.getCurrentPosition(pos => {
                                        setForm(f => ({ ...f, siteLat: +pos.coords.latitude.toFixed(6), siteLng: +pos.coords.longitude.toFixed(6) }));
                                    }, () => alert('Nije moguće dohvatiti lokaciju'));
                                }} className="s-btn-sm" style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} title="Koristi moju lokaciju">📌</button>
                            </div>
                            {form.siteLat && form.siteLng && (
                                <div className="proj__gps-confirm">
                                    <span className="proj__gps-confirm-text">✅ {Number(form.siteLat).toFixed(4)}°N, {Number(form.siteLng).toFixed(4)}°E</span>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, siteLat: '', siteLng: '' }))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 11, marginLeft: 'auto' }}>✕ Ukloni</button>
                                </div>
                            )}
                        </Field>
                        <Field label="Klijent / Naručitelj"><Input value={form.client} onChange={e => update('client', e.target.value)} placeholder="Naziv klijenta" /></Field>
                        <Field label="Datum početka"><Input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></Field>
                        <Field label="Datum završetka"><Input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></Field>
                        <Field label="Voditelj ekipe"><Select value={form.teamLeader} onChange={e => update('teamLeader', e.target.value)}><option value="">— Odaberi voditelja —</option>{activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name} {w.position ? `(${w.position})` : ''}</option>)}</Select></Field>
                        <Field label="Inženjer"><Select value={form.engineer} onChange={e => update('engineer', e.target.value)}><option value="">— Odaberi inženjera —</option>{activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name} {w.position ? `(${w.position})` : ''}</option>)}</Select></Field>
                    </div>
                    <Field label="Opis"><Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Opis projekta..." /></Field>
                    <Field label="Detalji projekta"><Textarea value={form.details} onChange={e => update('details', e.target.value)} placeholder="Tehnički detalji, upute, specifikacije..." rows={4} /></Field>
                    <Field label="Napomene"><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Interne napomene..." rows={2} /></Field>

                    <Field label="Dodijeljeni radnici">
                        <WorkerCheckboxList allWorkers={activeWorkers} selected={form.workers} onChange={v => update('workers', v)} />
                    </Field>

                    {/* File uploads */}
                    <Field label="Dokumenti i slike">
                        <div className="proj__file-list">
                            {(form.files || []).map(f => (
                                <div key={f.id} className="proj__file-chip">
                                    {f.type?.startsWith('image/') ? <img src={f.data} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} /> : <Icon name="file" size={14} />}
                                    <span className="proj__file-chip-name">{f.name}</span>
                                    <button onClick={() => removeFile(f.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                                </div>
                            ))}
                        </div>
                        <label className="s-btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                            <Icon name="upload" size={14} /> Dodaj datoteku
                            <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                    </Field>
                    <div className="u-flex-end">
                        <button onClick={() => setShowForm(false)} className="s-btn-sec">Odustani</button>
                        <button onClick={doSave} className="s-btn"><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
