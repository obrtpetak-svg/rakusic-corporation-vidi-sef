import { useState, useEffect, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { warn, error } from '../utils/logger';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, Pagination, usePagination, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, fmtDate, diffMins, hashPin } from '../utils/helpers';
import { EmptyState } from './ui/EmptyState';
import { EditableField } from './ui/EditableField';
import './workers.css';

export function WorkersPage({ leaderProjectIds, leaderWorkerIds, defaultDetailId, onDetailConsumed }) {
    const confirm = useConfirm();
    const { workers, users, projects, timesheets, vehicles, smjestaj, currentUser } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState('active');
    const isMobile = useIsMobile();

    // Deep-link: auto-open worker detail when navigated from another page
    useEffect(() => {
        if (defaultDetailId) {
            setDetailId(defaultDetailId);
            if (onDetailConsumed) onDetailConsumed();
        }
    }, [defaultDetailId]);

    const blankForm = () => ({ name: '', position: '', phone: '', email: '', oib: '', address: '', notes: '', active: true, username: '', pin: 'RakusicCorp2026.!', role: 'radnik', assignedProjects: [] });
    const [form, setForm] = useState(blankForm());
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = useMemo(() => {
        let list = workers.filter(w => w.role !== 'admin');
        if (leaderWorkerIds && leaderWorkerIds.length > 0) list = list.filter(w => leaderWorkerIds.includes(w.id));
        if (filterActive === 'active') list = list.filter(w => w.active !== false);
        else if (filterActive === 'inactive') list = list.filter(w => w.active === false);
        if (search) list = list.filter(w => (w.name || '').toLowerCase().includes(search.toLowerCase()) || (w.position || '').toLowerCase().includes(search.toLowerCase()));
        return list;
    }, [workers, filterActive, search, leaderWorkerIds]);

    const pg = usePagination(filtered.length, [filtered.length, search, filterActive], 50);
    const paginatedWorkers = filtered.slice(pg.startIndex, pg.endIndex + 1);

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (w) => {
        setForm({ name: w.name || '', position: w.position || '', phone: w.phone || '', email: w.email || '', oib: w.oib || '', address: w.address || '', notes: w.notes || '', active: w.active !== false, username: w.username || '', pin: '', role: w.role || 'radnik', assignedProjects: w.assignedProjects || [] });
        setEditId(w.id); setShowForm(true);
    };

    const doSave = async () => {
        if (!form.name.trim()) return alert('Ime radnika je obavezno');
        if (form.role === 'leader' && (!form.assignedProjects || form.assignedProjects.length === 0)) {
            if (!(await confirm('Voditelj nema dodijeljenih projekata — neće moći vidjeti ništa. Nastaviti?'))) return;
        }
        try {
            const { pin: _pin, assignedProjects: _ap, ...workerFields } = form;

            // Helper: provision Firebase Auth account for the worker
            const provisionFirebaseAuth = async (username: string, password: string, displayName: string) => {
                try {
                    const auth = (await import('../context/firebaseCore')).getAuth();
                    if (!auth?.currentUser) return;
                    const token = await auth.currentUser.getIdToken();
                    const resp = await fetch('/api/admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ action: 'create-user', username, password, displayName }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) warn('[Worker] Firebase Auth provision failed:', data.error);
                } catch (err) {
                    warn('[Worker] Firebase Auth provision error:', err);
                }
            };

            if (editId) {
                await updateDoc('workers', editId, { ...workerFields, updatedAt: new Date().toISOString() });
                const existingUser = users.find(u => u.id === editId);
                if (existingUser) {
                    const userUpdate: Record<string, unknown> = { name: form.name, username: form.username, role: form.role, active: form.active, assignedProjects: form.role === 'leader' ? form.assignedProjects : [] };
                    if (form.pin && form.pin.length >= 4) {
                        userUpdate.pin = await hashPin(form.pin);
                        // Also update Firebase Auth password
                        if (form.username) await provisionFirebaseAuth(form.username, form.pin, form.name);
                    }
                    await updateDoc('users', editId, userUpdate);
                }
            } else {
                const id = genId();
                await addDoc('workers', { id, ...workerFields, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
                if (form.username && form.pin) {
                    const hashedPin = await hashPin(form.pin);
                    await addDoc('users', { id, name: form.name, username: form.username, pin: hashedPin, role: form.role, active: form.active, workerId: id, assignedProjects: form.role === 'leader' ? form.assignedProjects : [] });
                    // Create Firebase Auth account so worker can log in
                    await provisionFirebaseAuth(form.username, form.pin, form.name);
                }
            }
            setShowForm(false);
        } catch (e) {
            error('Greška pri spremanju radnika:', e);
            alert('Greška pri spremanju: ' + ((e as Error).message || 'Nepoznata greška'));
        }
    };

    const toggleActive = async (w) => {
        await updateDoc('workers', w.id, { active: !w.active });
        const existingUser = users.find(u => u.id === w.id);
        if (existingUser) await updateDoc('users', w.id, { active: !w.active });
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati ovog radnika? Njegovi podaci (sati, računi) ostaju.'))) return;
        await removeDoc('workers', id);
        const existingUser = users.find(u => u.id === id);
        if (existingUser) await removeDoc('users', id);
    };

    // Detail view
    const detailWorker = detailId ? workers.find(w => w.id === detailId) : null;
    if (detailWorker) {
        const wTimesheets = timesheets.filter(t => t.workerId === detailWorker.id);
        const wProjects = projects.filter(p => (p.workers || []).includes(detailWorker.id));
        const wVehicle = vehicles.find(v => v.assignedWorker === detailWorker.id);
        const wSmjestaj = smjestaj.filter(s => (s.workerIds || []).includes(detailWorker.id));
        const totalMins = wTimesheets.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);

        // This month stats
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthTimesheets = wTimesheets.filter(t => (t.date || '').startsWith(monthStr));
        const monthMins = monthTimesheets.reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);

        // Average arrival time
        const arrivals = wTimesheets.map(t => t.startTime).filter(Boolean);
        const avgArrival = arrivals.length > 0 ? (() => {
            const totalMinutes = arrivals.reduce((s, t) => {
                const [h, m] = t.split(':').map(Number);
                return s + h * 60 + (m || 0);
            }, 0) / arrivals.length;
            return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(Math.round(totalMinutes % 60)).padStart(2, '0')}`;
        })() : '—';

        // Hours by day (last 14 days)
        const dayMap = {};
        wTimesheets.forEach(t => { if (t.date) dayMap[t.date] = (dayMap[t.date] || 0) + diffMins(t.startTime, t.endTime) / 60; });
        const hoursByDay = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, hours]) => ({ dan: day.slice(5), hours: +hours.toFixed(1) }));

        // Hours per project
        const projectHours = wProjects.map(p => ({
            name: p.name,
            status: p.status,
            hours: +(wTimesheets.filter(t => t.projectId === p.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0) / 60).toFixed(1)
        })).sort((a, b) => b.hours - a.hours);
        const maxProjectHours = Math.max(...projectHours.map(p => p.hours), 1);

        return (
            <div>
                <button onClick={() => setDetailId(null)} className="s-btn-sec" style={{ marginBottom: 20, display: 'inline-flex' }}><Icon name="back" size={16} /> Natrag</button>
                <div className="s-card" className="u-mb-20">
                    <div className="workers__detail-header">
                        <div className="workers__avatar workers__avatar--active workers__avatar--large">{detailWorker.name?.charAt(0)}</div>
                        <div>
                            <div className="u-fs-22 u-fw-800 u-color-text">{detailWorker.name}</div>
                            <div className="workers__detail-subtitle">{detailWorker.position || 'Radnik'} • {detailWorker.active !== false ? '🟢 Aktivan' : '🔴 Neaktivan'}</div>
                        </div>
                    </div>
                    <div className={`workers__stats ${isMobile ? 'workers__stats--mobile' : 'workers__stats--desktop'}`}>
                        <div className="workers__stat-card workers__stat-card--accent"><div className="u-stat-label">Projekti</div><div className="workers__stat-value">{wProjects.length}</div></div>
                        <div className="workers__stat-card workers__stat-card--blue"><div className="u-stat-label">Ukupno sati</div><div className="workers__stat-value">{Math.round(totalMins / 60)}h</div></div>
                        <div className="workers__stat-card workers__stat-card--green"><div className="u-stat-label">Ovaj mjesec</div><div className="workers__stat-value">{Math.round(monthMins / 60)}h</div></div>
                        <div className="workers__stat-card workers__stat-card--teal"><div className="u-stat-label">Unosi</div><div className="workers__stat-value">{wTimesheets.length}</div></div>
                        <div className="workers__stat-card workers__stat-card--amber"><div className="u-stat-label">Prosjek dolaska</div><div className="workers__stat-value">{avgArrival}</div></div>
                        <div className="workers__stat-card workers__stat-card--purple"><div className="u-stat-label">Vozilo</div><div className="workers__stat-value">{wVehicle ? '✔️' : '—'}</div></div>
                    </div>
                    <div className={`workers__fields-grid ${isMobile ? 'workers__fields-grid--mobile' : 'workers__fields-grid--desktop'}`}>
                        <EditableField label="📞 Tel" value={detailWorker.phone} onSave={v => updateDoc('workers', detailWorker.id, { phone: v })} type="tel" placeholder="Dodaj telefon" />
                        <EditableField label="📧 Email" value={detailWorker.email} onSave={v => updateDoc('workers', detailWorker.id, { email: v })} type="email" placeholder="Dodaj email" />
                        <EditableField label="🆔 OIB" value={detailWorker.oib} onSave={v => updateDoc('workers', detailWorker.id, { oib: v })} placeholder="Dodaj OIB" />
                        <EditableField label="📍 Adresa" value={detailWorker.address} onSave={v => updateDoc('workers', detailWorker.id, { address: v })} placeholder="Dodaj adresu" />
                        {detailWorker.username && <EditableField label="👤 User" value={detailWorker.username} onSave={v => updateDoc('workers', detailWorker.id, { username: v })} placeholder="—" />}
                    </div>
                    <div className="u-mt-12">
                        <EditableField label="📝 Napomene" value={detailWorker.notes} onSave={v => updateDoc('workers', detailWorker.id, { notes: v })} placeholder="Dodaj napomenu..." />
                    </div>
                </div>

                {/* Hours by day chart */}
                {hoursByDay.length > 1 && (
                    <div className="s-card" className="u-mb-20">
                        <div className="workers__section-title"><Icon name="clock" size={16} /> Sati po danu (zadnjih {hoursByDay.length} dana)</div>
                        <div className="workers__chart">
                            {hoursByDay.map((d, i) => (
                                <div key={i} className="workers__chart-bar-wrap">
                                    <div className="workers__chart-bar-label">{d.hours > 0 ? `${d.hours}` : ''}</div>
                                    <div className="workers__chart-bar" style={{ height: `${Math.max(4, d.hours / Math.max(...hoursByDay.map(x => x.hours), 1) * 80)}px` }} />
                                    <div className="workers__chart-bar-date">{d.dan}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Projects with hours */}
                {wProjects.length > 0 && <div className="s-card" className="u-mb-20">
                    <div className="workers__section-title"><Icon name="project" size={16} /> Projekti ({wProjects.length})</div>
                    {projectHours.map(p => (
                        <div key={p.name} className="workers__project-row">
                            <div className="workers__project-row-top">
                                <span className="workers__project-name">{p.name}</span>
                                <div className="u-flex-center u-gap-8">
                                    <span className="workers__project-hours">{p.hours}h</span>
                                    <StatusBadge status={p.status} />
                                </div>
                            </div>
                            <div className="workers__progress-track">
                                <div className="workers__progress-fill" style={{ width: `${p.hours / maxProjectHours * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>}
            </div>
        );
    }

    return (
        <div>
            <div className="workers__header">
                <div className="u-fs-22 u-fw-800 u-color-text">Radnici</div>
                <button onClick={openAdd} className="s-btn"><Icon name="plus" size={16} /> Novi radnik</button>
            </div>
            <div className="workers__toolbar">
                <div className="workers__search-wrap">
                    <Input placeholder="Traži radnika..." value={search} onChange={e => setSearch(e.target.value)} className="u-pl-36" />
                    <div className="workers__search-icon"><Icon name="search" size={16} /></div>
                </div>
                <Select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="workers__filter-select">
                    <option value="active">Aktivni</option>
                    <option value="inactive">Neaktivni</option>
                    <option value="all">Svi</option>
                </Select>
            </div>

            <div className={`workers__grid ${isMobile ? 'workers__grid--mobile' : 'workers__grid--desktop'}`}>
                {paginatedWorkers.map(w => {
                    const wProjects = projects.filter(p => (p.workers || []).includes(w.id));
                    const wHours = timesheets.filter(t => t.workerId === w.id).reduce((s, t) => s + diffMins(t.startTime, t.endTime), 0);
                    return (
                        <div key={w.id} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && e.currentTarget.click()} className="s-card" className="workers__card" onClick={() => setDetailId(w.id)}>
                            <div className="workers__card-top">
                                <div className={`workers__avatar ${w.active !== false ? 'workers__avatar--active' : 'workers__avatar--inactive'}`}>{w.name?.charAt(0)}</div>
                                <div className="workers__card-info">
                                    <div className="workers__card-name">{w.name}</div>
                                    <div className="u-fs-12 u-text-muted">{w.position || 'Radnik'}{w.phone ? ` • ${w.phone}` : ''}</div>
                                </div>
                            </div>
                            <div className="workers__card-meta">
                                <span>📂 {wProjects.length} projekata</span>
                                <span>⏱️ {Math.round(wHours / 60)}h ukupno</span>
                            </div>
                            <div className="workers__card-footer" onClick={e => e.stopPropagation()}>
                                <span className="workers__card-status" style={{ color: w.active !== false ? C.green : C.red }}>{w.active !== false ? '🟢 Aktivan' : '🔴 Neaktivan'}</span>
                                <div className="workers__card-actions">
                                    <button onClick={() => toggleActive(w)} className="s-btn-sm" style={{ fontSize: 11 }}>{w.active !== false ? 'Deaktiviraj' : 'Aktiviraj'}</button>
                                    <button onClick={() => openEdit(w)} className="s-btn-sm"><Icon name="edit" size={12} /></button>
                                    <button onClick={() => doDelete(w.id)} className="s-btn-danger"><Icon name="trash" size={12} /></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filtered.length === 0 && <EmptyState icon="workers" title="Nema radnika" description="Dodajte radnike kako biste mogli pratiti njihove sate i projekte" action={{ label: "Dodaj radnika", icon: "plus", onClick: openAdd }} />}

            {/* Pagination */}
            {filtered.length > pg.pageSize && (
                <div className="u-mt-16">
                    <Pagination {...pg} totalItems={filtered.length} label="radnika" />
                </div>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <Modal title={editId ? 'Uredi radnika' : 'Novi radnik'} onClose={() => setShowForm(false)} wide>
                    <div className={`workers__form-grid ${isMobile ? 'workers__form-grid--mobile' : 'workers__form-grid--desktop'} u-gap-16`}>
                        <Field label="Ime i prezime" required><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ivan Horvat" autoFocus /></Field>
                        <Field label="Pozicija / Zanimanje"><Input value={form.position} onChange={e => update('position', e.target.value)} placeholder="Zidar, Tesar, Vozač..." /></Field>
                        <Field label="Tel. Broj"><Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+385 91 234 5678" /></Field>
                        <Field label="Email"><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@example.com" /></Field>
                        <Field label="OIB"><Input value={form.oib} onChange={e => update('oib', e.target.value.replace(/\D/g, ''))} placeholder="11 znamenki" maxLength={11} /></Field>
                        <Field label="Adresa"><Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Ulica i broj, Grad" /></Field>

                    </div>
                    <div className="workers__form-section">
                        <div className="workers__section-title"><Icon name="user" size={16} /> Pristup aplikaciji</div>
                        <div className={`workers__form-access-grid ${isMobile ? 'workers__form-access-grid--mobile' : 'workers__form-access-grid--desktop'}`}>
                            <Field label="Korisničko ime"><Input value={form.username} onChange={e => update('username', e.target.value.toLowerCase())} placeholder="ivan.h" /></Field>
                            <Field label="Lozinka"><Input type="password" value={form.pin} onChange={e => update('pin', e.target.value)} placeholder={editId ? 'Ostavi prazno ako ne mijenjaš' : 'min. 6 znakova'} /></Field>
                            <Field label="Uloga"><Select value={form.role} onChange={e => update('role', e.target.value)}><option value="radnik">Radnik</option><option value="leader">Voditelj</option><option value="admin">Administrator</option></Select></Field>
                        </div>
                        {form.role === 'leader' && (
                            <div className="u-mt-12">
                                <Field label="Projekti voditelja (odaberi koje projekte smije vidjeti)">
                                    <div className="workers__project-tags">
                                        {projects.map(p => {
                                            const selected = (form.assignedProjects || []).includes(p.id);
                                            return (
                                                <button key={p.id} type="button" className={`workers__project-tag ${selected ? 'workers__project-tag--selected' : 'workers__project-tag--unselected'}`} onClick={() => {
                                                    const cur = form.assignedProjects || [];
                                                    update('assignedProjects', selected ? cur.filter(id => id !== p.id) : [...cur, p.id]);
                                                }}>
                                                    {selected ? '✓ ' : ''}{p.name}
                                                </button>
                                            );
                                        })}
                                        {projects.length === 0 && <div className="u-fs-12 u-text-muted">Nema projekata</div>}
                                    </div>
                                </Field>
                            </div>
                        )}
                    </div>
                    <Field label="Napomene"><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Interne napomene o radniku..." rows={2} /></Field>
                    <div className="workers__form-footer">
                        <label className="workers__form-checkbox">
                            <input type="checkbox" checked={form.active} onChange={e => update('active', e.target.checked)} /> Aktivan
                        </label>
                    </div>
                    <div className="u-flex-end">
                        <button onClick={() => setShowForm(false)} className="s-btn-sec">Odustani</button>
                        <button onClick={doSave} className="s-btn"><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )
            }
        </div >
    );
}
