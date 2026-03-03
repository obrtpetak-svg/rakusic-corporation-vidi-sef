import { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, WorkerCheckboxList, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, fmtDateTime, compressImage } from '../utils/helpers';

export function ObavezePage({ workerFilterId }) {
    const confirm = useConfirm();
    const { obaveze, workers, currentUser } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [search, setSearch] = useState('');
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;
    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');

    const blankForm = () => ({ title: '', description: '', dueDate: '', workerIds: [], priority: 'normalan', active: true, files: [] });
    const [form, setForm] = useState(blankForm());
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

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

    const filtered = useMemo(() => {
        let list = obaveze;
        if (isWorker) list = list.filter(o => (o.workerIds || []).includes(workerFilterId));
        if (search) list = list.filter(o => (o.title || '').toLowerCase().includes(search.toLowerCase()));
        return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }, [obaveze, search, workerFilterId]);

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (o) => { setForm({ title: o.title || '', description: o.description || '', dueDate: o.dueDate || '', workerIds: o.workerIds || [], priority: o.priority || 'normalan', active: o.active !== false, files: o.files || [] }); setEditId(o.id); setShowForm(true); };

    const doSave = async () => {
        if (!form.title.trim()) return alert('Naslov je obavezan');
        if (editId) await updateDoc('obaveze', editId, { ...form, updatedAt: new Date().toISOString() });
        else await addDoc('obaveze', { id: genId(), ...form, completions: [], createdAt: new Date().toISOString(), createdBy: currentUser?.name });
        setShowForm(false);
    };

    const doDelete = async (id) => { if (!(await confirm('Obrisati?'))) return; await removeDoc('obaveze', id); };

    const markComplete = async (obavezaId) => {
        const o = obaveze.find(x => x.id === obavezaId);
        if (!o) return;
        const completions = o.completions || [];
        if (completions.find(c => c.workerId === workerFilterId)) return;
        await updateDoc('obaveze', obavezaId, { completions: [...completions, { workerId: workerFilterId, workerName: currentUser?.name, completedAt: new Date().toISOString(), adminSeen: false }] });
    };

    const markAdminSeen = async (obavezaId, workerId) => {
        const o = obaveze.find(x => x.id === obavezaId);
        if (!o) return;
        const completions = (o.completions || []).map(c => c.workerId === workerId ? { ...c, adminSeen: true } : c);
        await updateDoc('obaveze', obavezaId, { completions });
    };

    const toggleActive = async (o) => {
        await updateDoc('obaveze', o.id, { active: !o.active });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div className="u-fs-22 u-fw-800" style={{ color: C.text }}>{isWorker ? 'Moje obaveze' : 'Obaveze'}</div>
                {!isWorker && <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Nova obaveza</button>}
            </div>
            <div style={{ position: 'relative', marginBottom: 20 }}><Input placeholder="Traži..." value={search} onChange={e => setSearch(e.target.value)} className="u-pl-36" /><div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}><Icon name="search" size={16} /></div></div>

            {filtered.map(o => {
                const oWorkers = (o.workerIds || []).map(wid => workers.find(w => w.id === wid)).filter(Boolean);
                const completions = o.completions || [];
                const isCompleted = isWorker && completions.some(c => c.workerId === workerFilterId);
                const newCompletions = completions.filter(c => !c.adminSeen);
                const priorityColor = o.priority === 'hitno' ? C.red : o.priority === 'visok' ? C.yellow : C.textMuted;

                return (
                    <div key={o.id} style={{ ...styles.card, marginBottom: 12, opacity: o.active === false ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div className="u-flex-1">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{o.title}</div>
                                    {o.priority !== 'normalan' && <span style={{ ...styles.badge(o.priority === 'hitno' ? '239,68,68' : '234,179,8'), fontSize: 10 }}>{o.priority?.toUpperCase()}</span>}
                                    {!isWorker && newCompletions.length > 0 && <span style={{ ...styles.badge('34,197,94'), fontSize: 10 }}>🆕 {newCompletions.length} novo</span>}
                                </div>
                                {o.description && <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>{o.description}</div>}
                                {o.dueDate && <div style={{ fontSize: 11, color: priorityColor }}>📅 Rok: {fmtDate(o.dueDate)}</div>}
                                {(o.files || []).length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                        {(o.files || []).map(f => (
                                            f.type?.startsWith('image/') ? (
                                                <img key={f.id} src={f.data} alt={f.name} onClick={() => { const w = window.open(); w.document.write(`<img src="${f.data}" style="max-width:100%;height:auto">`); }} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${C.border}` }} />
                                            ) : (
                                                <a key={f.id} href={f.data} download={f.name} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: C.bgElevated, border: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, textDecoration: 'none' }}><Icon name="file" size={12} /> {f.name}</a>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                            {isWorker && !isCompleted && <button onClick={() => markComplete(o.id)} style={{ ...styles.btn, background: C.green, whiteSpace: 'nowrap' }}><Icon name="check" size={14} /> Izvršeno</button>}
                            {isWorker && isCompleted && <span style={{ ...styles.badge('34,197,94'), fontSize: 12 }}>✅ Izvršeno</span>}
                        </div>

                        {/* Worker/completion list */}
                        {oWorkers.length > 0 && (
                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>Radnici ({completions.length}/{oWorkers.length} izvršeno)</div>
                                {oWorkers.map(w => {
                                    const comp = completions.find(c => c.workerId === w.id);
                                    return (
                                        <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                                            <div className="u-flex-center u-gap-8">
                                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: comp ? 'rgba(34,197,94,0.15)' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: comp ? C.green : C.textMuted }}>{comp ? '✓' : w.name?.charAt(0)}</div>
                                                <span style={{ color: comp ? C.green : C.textDim, fontWeight: comp ? 600 : 400 }}>{w.name}</span>
                                            </div>
                                            {comp && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="u-fs-11" style={{ color: C.textMuted }}>{fmtDateTime(comp.completedAt)}</span>
                                                {!isWorker && !comp.adminSeen && <button onClick={() => markAdminSeen(o.id, w.id)} style={{ ...styles.btnSmall, fontSize: 10, padding: '3px 8px' }}>Viđeno</button>}
                                                {!isWorker && comp.adminSeen && <span style={{ fontSize: 10, color: C.textMuted }}>✓ viđeno</span>}
                                            </div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!isWorker && (
                            <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 8 }}>
                                <button onClick={() => toggleActive(o)} style={styles.btnSmall}>{o.active !== false ? 'Deaktiviraj' : 'Aktiviraj'}</button>
                                <button onClick={() => openEdit(o)} style={styles.btnSmall}><Icon name="edit" size={12} /></button>
                                <button onClick={() => doDelete(o.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                            </div>
                        )}
                    </div>
                );
            })}
            {filtered.length === 0 && <div style={{ ...styles.card, textAlign: 'center', padding: 40, color: C.textMuted }}>Nema obaveza</div>}

            {showForm && (
                <Modal title={editId ? 'Uredi obavezu' : 'Nova obaveza'} onClose={() => setShowForm(false)}>
                    <Field label="Naslov" required><Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Što treba napraviti" autoFocus /></Field>
                    <Field label="Opis"><Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Detalji obaveze..." /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Field label="Rok"><Input type="date" value={form.dueDate} onChange={e => update('dueDate', e.target.value)} /></Field>
                        <Field label="Prioritet"><select value={form.priority} onChange={e => update('priority', e.target.value)} style={styles.input}><option value="normalan">Normalan</option><option value="visok">Visok</option><option value="hitno">Hitno</option></select></Field>
                    </div>
                    <Field label="Dodijeljeni radnici"><WorkerCheckboxList allWorkers={activeWorkers} selected={form.workerIds} onChange={v => update('workerIds', v)} /></Field>
                    <Field label="Dokumenti i slike">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                            {(form.files || []).map(f => (
                                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: C.bgElevated, border: `1px solid ${C.border}`, fontSize: 12 }}>
                                    {f.type?.startsWith('image/') ? <img src={f.data} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover' }} /> : <Icon name="file" size={12} />}
                                    <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.textDim }}>{f.name}</span>
                                    <button onClick={() => removeFile(f.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                                </div>
                            ))}
                        </div>
                        <label style={{ ...styles.btnSmall, cursor: 'pointer', display: 'inline-flex' }}>
                            <Icon name="upload" size={14} /> Dodaj datoteku
                            <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                    </Field>
                    <div className="u-flex-end">
                        <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
