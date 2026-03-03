import { useState, useMemo } from 'react';
import { useApp, add as addDoc, update as updateDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Select, StatusBadge, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, nowTime, diffMins, fmtDate, compressImage } from '../utils/helpers';

export function TimesheetEntry() {
    const { currentUser, timesheets, projects, workers, addAuditLog } = useApp();
    const [form, setForm] = useState({ projectId: '', date: today(), startTime: '07:00', endTime: '15:00', breakMins: 30, description: '', type: 'normalan', gpsLocation: '', gpsLoading: false });
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [editId, setEditId] = useState(null);
    const [editReason, setEditReason] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const isMobile = useIsMobile();

    const userId = currentUser?.workerId || currentUser?.id;
    const workerProjects = projects.filter(p => p.status === 'aktivan' && (p.workers || []).includes(userId));
    const myTs = useMemo(() => timesheets.filter(t => t.workerId === userId).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [timesheets, userId]);

    const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSuccess(''); };

    const getGPS = () => {
        if (!navigator.geolocation) return alert('GPS nije dostupan na ovom uređaju');
        update('gpsLoading', true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { update('gpsLocation', `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); update('gpsLoading', false); },
            (err) => { update('gpsLoading', false); alert('GPS greška: ' + err.message); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert('Datoteka je prevelika (max 10MB)');
        const compressed = await compressImage(file);
        setInvoiceFile(compressed);
    };

    const submit = async () => {
        if (!form.projectId) return alert('Odaberite projekt');
        if (!form.date) return alert('Odaberite datum');
        setSaving(true);
        const entry = {
            id: genId(), workerId: userId, projectId: form.projectId,
            date: form.date, startTime: form.startTime, endTime: form.endTime,
            breakMins: form.breakMins, description: form.description,
            type: form.type, gpsLocation: form.gpsLocation,
            status: 'na čekanju', source: 'radnik',
            createdAt: new Date().toISOString(), createdBy: currentUser?.name,
            editLog: [],
            ...(invoiceFile ? { invoiceFile } : {})
        };
        await addDoc('timesheets', entry);
        setSaving(false);
        setSuccess('✅ Sati uspješno poslani na odobrenje!');
        setForm(f => ({ ...f, description: '', gpsLocation: '' }));
        setInvoiceFile(null);
    };

    const openEdit = (t) => {
        setForm({
            projectId: t.projectId || '', date: t.date || today(), startTime: t.startTime || '07:00',
            endTime: t.endTime || '15:00', breakMins: t.breakMins || 30, description: t.description || '',
            type: t.type || 'normalan', gpsLocation: t.gpsLocation || '', gpsLoading: false
        });
        setEditId(t.id);
        setEditReason('');
        setShowEditModal(true);
    };

    const saveEdit = async () => {
        if (!editId) return;
        if (!editReason.trim()) return alert('Unesite razlog izmjene');
        setSaving(true);
        const old = timesheets.find(t => t.id === editId);
        const logEntry = {
            date: new Date().toISOString(),
            by: currentUser?.name || 'Radnik',
            reason: editReason,
            changes: {
                ...(old?.date !== form.date ? { date: { from: old?.date, to: form.date } } : {}),
                ...(old?.startTime !== form.startTime ? { startTime: { from: old?.startTime, to: form.startTime } } : {}),
                ...(old?.endTime !== form.endTime ? { endTime: { from: old?.endTime, to: form.endTime } } : {}),
                ...(old?.description !== form.description ? { description: { from: old?.description, to: form.description } } : {}),
                ...(old?.projectId !== form.projectId ? { projectId: { from: old?.projectId, to: form.projectId } } : {}),
                ...(old?.type !== form.type ? { type: { from: old?.type, to: form.type } } : {}),
            }
        };
        const existingLog = old?.editLog || [];
        await updateDoc('timesheets', editId, {
            projectId: form.projectId, date: form.date, startTime: form.startTime, endTime: form.endTime,
            breakMins: form.breakMins, description: form.description, type: form.type,
            status: 'na čekanju',
            updatedAt: new Date().toISOString(), updatedBy: currentUser?.name,
            editLog: [...existingLog, logEntry]
        });
        if (addAuditLog) await addAuditLog('TIMESHEET_EDITED', `${currentUser?.name} izmijenio sate (${form.date}): ${editReason}`);
        setSaving(false);
        setShowEditModal(false);
        setEditId(null);
        setSuccess('✅ Unos uspješno izmijenjen i poslan na ponovno odobrenje!');
    };

    const netMins = diffMins(form.startTime, form.endTime) - (form.breakMins || 0);

    return (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>⏱️ Unos radnih sati</div>

            {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: C.green, fontWeight: 600, fontSize: 14 }}>{success}</div>}

            <div style={styles.card}>
                <Field label="Projekt" required>
                    <Select value={form.projectId} onChange={e => update('projectId', e.target.value)}>
                        <option value="">— Odaberi projekt —</option>
                        {workerProjects.map(p => <option key={p.id} value={p.id}>{p.name}{p.location ? ` (${p.location})` : ''}</option>)}
                    </Select>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Datum"><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
                    <Field label="Tip rada">
                        <Select value={form.type} onChange={e => update('type', e.target.value)}>
                            <option value="normalan">Normalan</option><option value="prekovremeni">Prekovremeni</option><option value="noćni">Noćni</option><option value="vikend">Vikend</option>
                        </Select>
                    </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <Field label="Početak"><Input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} /></Field>
                    <Field label="Završetak"><Input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} /></Field>
                    <Field label="Pauza (min)"><Input type="number" value={form.breakMins} onChange={e => update('breakMins', parseInt(e.target.value) || 0)} min={0} max={120} /></Field>
                </div>

                <div style={{ background: C.accentLight, borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textDim }}>Neto radno vrijeme:</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{(netMins / 60).toFixed(1)}h</span>
                </div>

                <Field label="Opis rada"><Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Što ste radili..." /></Field>

                <Field label="GPS Lokacija">
                    <div className="u-flex-gap-8">
                        <Input value={form.gpsLocation} onChange={e => update('gpsLocation', e.target.value)} placeholder="Automatski ili ručno" className="u-flex-1" readOnly />
                        <button type="button" onClick={getGPS} disabled={form.gpsLoading} style={{ ...styles.btn, whiteSpace: 'nowrap' }}>
                            {form.gpsLoading ? '📡 ...' : '📍 GPS'}
                        </button>
                    </div>
                    {form.gpsLocation && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>✅ Lokacija zabilježena</div>}
                </Field>

                <Field label="Priloži račun (opcionalno)">
                    <div className="u-flex-center u-gap-12">
                        <label style={{ ...styles.btnSmall, cursor: 'pointer' }}>
                            <Icon name="upload" size={14} /> {invoiceFile ? invoiceFile.name : 'Odaberi datoteku'}
                            <input type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
                        </label>
                        {invoiceFile && <button onClick={() => setInvoiceFile(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>✕ Ukloni</button>}
                    </div>
                    {invoiceFile && invoiceFile.type?.startsWith('image/') && (
                        <img loading="lazy" src={invoiceFile.data} alt="Preview" style={{ marginTop: 8, maxWidth: 200, maxHeight: 150, borderRadius: 8, border: `1px solid ${C.border}` }} />
                    )}
                </Field>

                <button onClick={submit} disabled={saving || !form.projectId} style={{ ...styles.btn, width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 16, opacity: saving || !form.projectId ? 0.5 : 1, marginTop: 12 }}>
                    {saving ? 'Šaljem...' : '📤 Pošalji na odobrenje'}
                </button>
            </div>

            {/* My recent entries with EDIT */}
            <div style={{ ...styles.card, marginTop: 20 }}>
                <div className="u-section-title u-mb-12">📋 Moji nedavni unosi</div>
                {myTs.slice(0, 15).map(t => {
                    const p = projects.find(x => x.id === t.projectId);
                    const mins = diffMins(t.startTime, t.endTime) - (t.breakMins || 0);
                    const statusColor = t.status === 'odobren' ? C.green : t.status === 'odbijen' ? C.red : C.yellow;
                    const hasEdits = (t.editLog || []).length > 0;
                    return (
                        <div key={t.id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}7A` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                <div className="u-flex-1">
                                    <div style={{ fontWeight: 600, color: C.textDim }}>{p?.name || '—'} — {fmtDate(t.date)}</div>
                                    <div style={{ color: C.textMuted, fontSize: 12 }}>{t.startTime} - {t.endTime} ({(mins / 60).toFixed(1)}h) {t.description && `• ${t.description.slice(0, 40)}`}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    {hasEdits && <span className="u-stat-label" title="Izmijenjeno">✏️</span>}
                                    <span style={{ ...styles.badge(t.status === 'odobren' ? '34,197,94' : t.status === 'odbijen' ? '239,68,68' : '234,179,8'), fontSize: 10 }}>{t.status === 'odobren' ? 'ODOBREN' : t.status === 'odbijen' ? 'ODBIJEN' : 'ČEKA'}</span>
                                    <button onClick={() => openEdit(t)} style={{ ...styles.btnSmall, padding: '4px 10px', fontSize: 11 }} title="Uredi unos">
                                        <Icon name="edit" size={12} /> Uredi
                                    </button>
                                </div>
                            </div>

                            {/* Edit log display */}
                            {hasEdits && (
                                <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${C.border}` }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Izmjene:</div>
                                    {(t.editLog || []).map((log, i) => (
                                        <div key={i} style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
                                            <span style={{ color: C.textDim }}>{new Date(log.date).toLocaleString('hr-HR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                            {' — '}<span style={{ color: C.yellow }}>{log.by}</span>
                                            {': '}<span style={{ fontStyle: 'italic' }}>{log.reason}</span>
                                            {log.changes && Object.keys(log.changes).length > 0 && (
                                                <span className="u-text-muted"> ({Object.keys(log.changes).map(k => {
                                                    const c = log.changes[k];
                                                    return `${k}: ${c.from || '—'} → ${c.to || '—'}`;
                                                }).join(', ')})</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {myTs.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, padding: 12 }}>Nema unosa</div>}
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <Modal title="Uredi unos" onClose={() => { setShowEditModal(false); setEditId(null); }}>
                    <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: C.yellow }}>
                        ⚠️ Izmijenjeni unos će biti poslan na ponovno odobrenje. Sve izmjene se bilježe u log.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <Field label="Projekt">
                            <Select value={form.projectId} onChange={e => update('projectId', e.target.value)}>
                                <option value="">—</option>
                                {workerProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </Field>
                        <Field label="Datum"><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
                        <Field label="Početak"><Input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} /></Field>
                        <Field label="Završetak"><Input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} /></Field>
                        <Field label="Pauza (min)"><Input type="number" value={form.breakMins} onChange={e => update('breakMins', parseInt(e.target.value) || 0)} /></Field>
                        <Field label="Tip rada">
                            <Select value={form.type} onChange={e => update('type', e.target.value)}>
                                <option value="normalan">Normalan</option><option value="prekovremeni">Prekovremeni</option><option value="noćni">Noćni</option><option value="vikend">Vikend</option>
                            </Select>
                        </Field>
                    </div>
                    <Field label="Opis"><Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Što ste radili..." /></Field>
                    <Field label="Razlog izmjene" required>
                        <Input value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Npr. Krivi projekt, kriva smjena, greška u satu..." autoFocus />
                    </Field>
                    <div style={{ background: C.accentLight, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                        Neto: <strong style={{ color: C.accent }}>{(netMins / 60).toFixed(1)}h</strong>
                    </div>
                    <div className="u-flex-end">
                        <button onClick={() => setShowEditModal(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={saveEdit} disabled={saving} style={styles.btn}><Icon name="check" size={16} /> Spremi izmjenu</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
