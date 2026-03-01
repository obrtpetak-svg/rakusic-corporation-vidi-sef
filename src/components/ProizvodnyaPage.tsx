import React, { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, WorkerCheckboxList, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, diffMins, compressImage } from '../utils/helpers';

const STAGES = [
    { id: 'narudzba', label: 'Narudžba', emoji: '📋', color: '#6366F1' },
    { id: 'priprema', label: 'Priprema', emoji: '🔧', color: '#F59E0B' },
    { id: 'proizvodnja', label: 'Proizvodnja', emoji: '⚙️', color: '#3B82F6' },
    { id: 'kontrola', label: 'Kontrola', emoji: '✅', color: '#10B981' },
    { id: 'isporuka', label: 'Isporuka', emoji: '🚚', color: '#8B5CF6' },
    { id: 'zavrseno', label: 'Završeno', emoji: '✓', color: '#047857' },
];

const COST_CATEGORIES = [
    { value: 'materijal', label: '🧱 Materijal' },
    { value: 'rad', label: '👷 Rad' },
    { value: 'transport', label: '🚚 Transport' },
    { value: 'ostalo', label: '📦 Ostalo' },
];

const genOrderNumber = () => {
    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    return `PRO-${year}-${num}`;
};

export function ProizvodnyaPage({ leaderProjectIds }) {
    const confirm = useConfirm();
    const { production, workers, projects, currentUser } = useApp();
    const [activeTab, setActiveTab] = useState('pipeline');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStage, setFilterStage] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const isMobile = useIsMobile();
    const isAdmin = currentUser?.role === 'admin';
    const isLeader = currentUser?.role === 'leader';
    const canManage = isAdmin || isLeader;

    const allOrders = production || [];
    const activeOrders = allOrders.filter(o => o.status !== 'arhiviran');
    const archivedOrders = allOrders.filter(o => o.status === 'arhiviran');
    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');

    const filtered = useMemo(() => {
        let list = activeOrders;
        if (leaderProjectIds && leaderProjectIds.length > 0) {
            list = list.filter(o => !o.projectId || leaderProjectIds.includes(o.projectId));
        }
        if (filterStage !== 'all') list = list.filter(o => o.stage === filterStage);
        if (filterPriority !== 'all') list = list.filter(o => o.priority === filterPriority);
        if (search) list = list.filter(o =>
            (o.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (o.client || '').toLowerCase().includes(search.toLowerCase()) ||
            (o.orderNumber || '').toLowerCase().includes(search.toLowerCase())
        );
        return list;
    }, [activeOrders, filterStage, filterPriority, search, leaderProjectIds]);

    // Stats
    const stats = useMemo(() => {
        const orders = leaderProjectIds?.length > 0
            ? activeOrders.filter(o => !o.projectId || leaderProjectIds.includes(o.projectId))
            : activeOrders;
        const totalCost = orders.reduce((s, o) => s + (o.totalCost || 0), 0);
        const thisMonth = new Date().toISOString().slice(0, 7);
        const doneThisMonth = allOrders.filter(o => o.stage === 'zavrseno' && (o.stages || []).find(s => s.stage === 'zavrseno' && (s.completedAt || '').startsWith(thisMonth)));
        return {
            total: orders.length,
            inProgress: orders.filter(o => o.stage === 'proizvodnja').length,
            waiting: orders.filter(o => o.stage === 'narudzba' || o.stage === 'priprema').length,
            done: doneThisMonth.length,
            totalCost,
        };
    }, [activeOrders, allOrders, leaderProjectIds]);

    // Form
    const blankForm = () => ({
        orderNumber: genOrderNumber(), name: '', client: '', description: '',
        deadline: '', priority: 'normalan', quantity: 1, unit: 'kom',
        stage: 'narudzba', assignedWorkers: [], projectId: '', notes: '',
        stages: [{ stage: 'narudzba', enteredAt: new Date().toISOString() }],
        costItems: [], totalCost: 0, files: [], status: 'aktivan',
    });
    const [form, setForm] = useState(blankForm());
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (o) => {
        setForm({ ...o, assignedWorkers: o.assignedWorkers || [], costItems: o.costItems || [], files: o.files || [], stages: o.stages || [] });
        setEditId(o.id); setShowForm(true);
    };

    const doSave = async () => {
        if (!form.name.trim()) return alert('Naziv je obavezan');
        const data = { ...form, totalCost: (form.costItems || []).reduce((s, c) => s + (c.total || 0), 0) };
        if (editId) {
            await updateDoc('production', editId, { ...data, updatedAt: new Date().toISOString() });
        } else {
            await addDoc('production', { id: genId(), ...data, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
        }
        setShowForm(false);
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati ovu narudžbu?'))) return;
        await removeDoc('production', id);
    };

    const advanceStage = async (order) => {
        const idx = STAGES.findIndex(s => s.id === order.stage);
        if (idx >= STAGES.length - 1) return;
        const nextStage = STAGES[idx + 1].id;
        const updatedStages = [...(order.stages || [])];
        // Mark current stage as completed
        const current = updatedStages.find(s => s.stage === order.stage && !s.completedAt);
        if (current) { current.completedAt = new Date().toISOString(); current.completedBy = currentUser?.name; }
        // Add entry for next stage
        updatedStages.push({ stage: nextStage, enteredAt: new Date().toISOString() });
        await updateDoc('production', order.id, { stage: nextStage, stages: updatedStages });
    };

    const archiveOrder = async (order) => {
        await updateDoc('production', order.id, { status: 'arhiviran' });
    };
    const unarchiveOrder = async (order) => {
        await updateDoc('production', order.id, { status: 'aktivan' });
    };

    // Cost management
    const [showCostForm, setShowCostForm] = useState(false);
    const [costForm, setCostForm] = useState({ name: '', category: 'materijal', quantity: 1, unitPrice: 0, notes: '' });
    const addCostItem = async () => {
        if (!costForm.name.trim()) return;
        const item = { id: genId(), ...costForm, total: costForm.quantity * costForm.unitPrice };
        const newItems = [...(detailOrder?.costItems || []), item];
        const newTotal = newItems.reduce((s, c) => s + (c.total || 0), 0);
        await updateDoc('production', detailOrder.id, { costItems: newItems, totalCost: newTotal });
        setShowCostForm(false);
        setCostForm({ name: '', category: 'materijal', quantity: 1, unitPrice: 0, notes: '' });
    };
    const removeCostItem = async (itemId) => {
        const newItems = (detailOrder?.costItems || []).filter(c => c.id !== itemId);
        const newTotal = newItems.reduce((s, c) => s + (c.total || 0), 0);
        await updateDoc('production', detailOrder.id, { costItems: newItems, totalCost: newTotal });
    };

    // File upload
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert('Max 10MB');
        const compressed = await compressImage(file);
        const newFiles = [...(detailOrder?.files || []), { id: genId(), ...compressed, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.name }];
        await updateDoc('production', detailOrder.id, { files: newFiles });
    };
    const removeFile = async (fileId) => {
        const newFiles = (detailOrder?.files || []).filter(f => f.id !== fileId);
        await updateDoc('production', detailOrder.id, { files: newFiles });
    };

    // Export CSV
    const exportCSV = () => {
        const data = (activeTab === 'archive' ? archivedOrders : filtered);
        const headers = ['Broj', 'Naziv', 'Naručitelj', 'Faza', 'Prioritet', 'Količina', 'Rok', 'Trošak (€)', 'Status'];
        const rows = data.map(o => [o.orderNumber, o.name, o.client, STAGES.find(s => s.id === o.stage)?.label, o.priority, `${o.quantity} ${o.unit}`, o.deadline, (o.totalCost || 0).toFixed(2), o.status]);
        const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `proizvodnja-${today()}.csv`; a.click();
    };

    // ── Detail View ──
    const detailOrder = detailId ? allOrders.find(o => o.id === detailId) : null;
    const [detailTab, setDetailTab] = useState('info');

    if (detailOrder) {
        const stageIdx = STAGES.findIndex(s => s.id === detailOrder.stage);
        const progressPct = ((stageIdx + 1) / STAGES.length * 100);
        const daysLeft = detailOrder.deadline ? Math.ceil((new Date(detailOrder.deadline).getTime() - Date.now()) / 86400000) : null;
        const costItems = detailOrder.costItems || [];
        const files = detailOrder.files || [];
        const stageHistory = detailOrder.stages || [];
        const costByCategory = COST_CATEGORIES.map(c => ({
            ...c, total: costItems.filter(i => i.category === c.value).reduce((s, i) => s + (i.total || 0), 0),
        }));

        return (
            <div>
                <button onClick={() => { setDetailId(null); setDetailTab('info'); }} style={{ ...styles.btnSecondary, marginBottom: 20, display: 'inline-flex' }}><Icon name="back" size={16} /> Natrag</button>

                {/* Header card */}
                <div style={{ ...styles.card, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 4 }}>{detailOrder.orderNumber}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{detailOrder.name}</div>
                            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>🏢 {detailOrder.client || '—'} {detailOrder.quantity && `• ${detailOrder.quantity} ${detailOrder.unit}`}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {detailOrder.priority === 'hitno' && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 6 }}>🔴 HITNO</span>}
                            {detailOrder.priority === 'visok' && <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 6 }}>🟡 Visok</span>}
                            <span style={{ fontSize: 12, fontWeight: 700, color: STAGES[stageIdx]?.color, background: `${STAGES[stageIdx]?.color}18`, padding: '4px 12px', borderRadius: 8 }}>
                                {STAGES[stageIdx]?.emoji} {STAGES[stageIdx]?.label}
                            </span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                            <span>Napredak</span>
                            <span style={{ fontWeight: 700, color: stageIdx === STAGES.length - 1 ? C.green : C.accent }}>{Math.round(progressPct)}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: 3 }}>
                            {STAGES.map((s, i) => (
                                <div key={s.id} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= stageIdx ? (STAGES[stageIdx]?.color || C.accent) : 'var(--border)', transition: 'background 0.3s ease' }} />
                            ))}
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: C.accentLight }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Količina</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{detailOrder.quantity} {detailOrder.unit}</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)' }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ukupni trošak</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{(detailOrder.totalCost || 0).toFixed(2)}€</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: daysLeft !== null && daysLeft < 0 ? 'rgba(239,68,68,0.08)' : daysLeft !== null && daysLeft <= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)' }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Rok isporuke</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: daysLeft !== null && daysLeft < 0 ? '#EF4444' : daysLeft !== null && daysLeft <= 3 ? '#F59E0B' : C.green }}>
                                {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d kasni` : daysLeft === 0 ? 'DANAS' : `${daysLeft}d`) : '—'}
                            </div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(29,78,216,0.08)' }}>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Stavke troška</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{costItems.length}</div>
                        </div>
                    </div>

                    {/* Actions */}
                    {canManage && detailOrder.stage !== 'zavrseno' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={() => advanceStage(detailOrder)} style={{ ...styles.btn, fontSize: 13 }}>
                                ⏭️ {STAGES[stageIdx + 1] ? `Pomakni u: ${STAGES[stageIdx + 1].label}` : 'Završi'}
                            </button>
                            <button onClick={() => openEdit(detailOrder)} style={styles.btnSecondary}><Icon name="edit" size={14} /> Uredi</button>
                        </div>
                    )}
                    {canManage && detailOrder.stage === 'zavrseno' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={() => archiveOrder(detailOrder)} style={{ ...styles.btnSecondary, fontSize: 13 }}>📦 Arhiviraj</button>
                        </div>
                    )}
                </div>

                {/* Detail tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
                    {[{ id: 'info', label: '📋 Info' }, { id: 'troskovnik', label: '💰 Troškovnik' }, { id: 'dokumenti', label: '📎 Dokumenti' }, { id: 'povijest', label: '🕐 Povijest' }].map(t => (
                        <button key={t.id} onClick={() => setDetailTab(t.id)} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${detailTab === t.id ? C.accent : C.border}`, background: detailTab === t.id ? C.accentLight : 'transparent', color: detailTab === t.id ? C.accent : C.textMuted, fontWeight: detailTab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Info tab */}
                {detailTab === 'info' && (
                    <div style={{ ...styles.card, marginBottom: 20 }}>
                        {detailOrder.description && <div style={{ padding: '12px 16px', borderRadius: 8, background: C.bgElevated, fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 12 }}>{detailOrder.description}</div>}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                            <div><span style={{ color: C.textMuted }}>📅 Kreiran:</span> <strong>{fmtDate(detailOrder.createdAt)}</strong></div>
                            <div><span style={{ color: C.textMuted }}>📅 Rok:</span> <strong>{fmtDate(detailOrder.deadline) || '—'}</strong></div>
                            <div><span style={{ color: C.textMuted }}>👤 Kreirao:</span> <strong>{detailOrder.createdBy || '—'}</strong></div>
                            <div><span style={{ color: C.textMuted }}>📋 Broj:</span> <strong>{detailOrder.orderNumber}</strong></div>
                        </div>
                        {detailOrder.notes && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', fontSize: 13, color: '#D97706' }}>📝 {detailOrder.notes}</div>}

                        {/* Stage timeline */}
                        <div style={{ marginTop: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Tok narudžbe</div>
                            {STAGES.map((s, i) => {
                                const record = stageHistory.find(r => r.stage === s.id);
                                const isCurrent = detailOrder.stage === s.id;
                                const isDone = record?.completedAt;
                                const isPast = STAGES.findIndex(x => x.id === detailOrder.stage) > i;
                                return (
                                    <div key={s.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < STAGES.length - 1 ? 16 : 0 }}>
                                        {i < STAGES.length - 1 && <div style={{ position: 'absolute', left: 13, top: 28, width: 2, height: 'calc(100% - 14px)', background: isPast || isDone ? s.color : 'var(--border)' }} />}
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDone || isPast ? s.color : isCurrent ? C.accent : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 800, flexShrink: 0, zIndex: 1, border: isCurrent ? `3px solid ${C.accent}44` : 'none' }}>
                                            {isDone || isPast ? '✓' : s.emoji}
                                        </div>
                                        <div style={{ flex: 1, paddingTop: 2 }}>
                                            <div style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? C.text : isDone || isPast ? C.textDim : C.textMuted }}>{s.label}</div>
                                            {record && <div style={{ fontSize: 11, color: C.textMuted }}>
                                                {record.enteredAt && `Započeto: ${fmtDate(record.enteredAt)}`}
                                                {record.completedAt && ` → Završeno: ${fmtDate(record.completedAt)}`}
                                                {record.completedBy && ` (${record.completedBy})`}
                                            </div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Troškovnik tab */}
                {detailTab === 'troskovnik' && (
                    <div style={{ ...styles.card, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>💰 Troškovnik ({costItems.length} stavki)</div>
                            {canManage && <button onClick={() => setShowCostForm(true)} style={styles.btnSmall}><Icon name="plus" size={12} /> Nova stavka</button>}
                        </div>
                        {/* Category summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                            {costByCategory.map(c => (
                                <div key={c.value} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>{c.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: c.total > 0 ? C.accent : C.textMuted }}>{c.total.toFixed(2)}€</div>
                                </div>
                            ))}
                        </div>
                        {costItems.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Nema stavki troškova</div> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr><th style={styles.th}>Stavka</th><th style={styles.th}>Kat.</th><th style={styles.th}>Kol.</th><th style={styles.th}>Cijena</th><th style={styles.th}>Ukupno</th>{canManage && <th style={styles.th}></th>}</tr></thead>
                                    <tbody>
                                        {costItems.map(c => (
                                            <tr key={c.id}>
                                                <td style={styles.td}><span style={{ fontWeight: 600 }}>{c.name}</span>{c.notes && <div style={{ fontSize: 10, color: C.textMuted }}>{c.notes}</div>}</td>
                                                <td style={styles.td}>{COST_CATEGORIES.find(cat => cat.value === c.category)?.label || c.category}</td>
                                                <td style={styles.td}>{c.quantity}</td>
                                                <td style={styles.td}>{(c.unitPrice || 0).toFixed(2)}€</td>
                                                <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{(c.total || 0).toFixed(2)}€</td>
                                                {canManage && <td style={styles.td}><button onClick={() => removeCostItem(c.id)} style={{ ...styles.btnDanger, padding: '4px 8px' }}><Icon name="trash" size={10} /></button></td>}
                                            </tr>
                                        ))}
                                        <tr><td colSpan={4} style={{ ...styles.td, fontWeight: 700, textAlign: 'right' }}>UKUPNO:</td><td style={{ ...styles.td, fontWeight: 800, color: C.accent, fontSize: 16 }}>{(detailOrder.totalCost || 0).toFixed(2)}€</td>{canManage && <td style={styles.td}></td>}</tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {/* Cost form modal */}
                        {showCostForm && (
                            <Modal title="Nova stavka troška" onClose={() => setShowCostForm(false)}>
                                <Field label="Naziv stavke" required><Input value={costForm.name} onChange={e => setCostForm(f => ({ ...f, name: e.target.value }))} placeholder="Čelik S235, Transport..." autoFocus /></Field>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    <Field label="Kategorija"><Select value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))}>{COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
                                    <Field label="Količina"><Input type="number" value={costForm.quantity} onChange={e => setCostForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} /></Field>
                                    <Field label="Jed. cijena (€)"><Input type="number" step="0.01" value={costForm.unitPrice} onChange={e => setCostForm(f => ({ ...f, unitPrice: parseFloat(e.target.value) || 0 }))} /></Field>
                                </div>
                                <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, margin: '8px 0' }}>Ukupno: {(costForm.quantity * costForm.unitPrice).toFixed(2)}€</div>
                                <Field label="Napomena"><Input value={costForm.notes} onChange={e => setCostForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcionalno..." /></Field>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                                    <button onClick={() => setShowCostForm(false)} style={styles.btnSecondary}>Odustani</button>
                                    <button onClick={addCostItem} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                                </div>
                            </Modal>
                        )}
                    </div>
                )}

                {/* Dokumenti tab */}
                {detailTab === 'dokumenti' && (
                    <div style={{ ...styles.card, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📎 Dokumenti ({files.length})</div>
                            {canManage && (
                                <label style={{ ...styles.btnSmall, cursor: 'pointer', display: 'inline-flex' }}>
                                    <Icon name="upload" size={12} /> Upload
                                    <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>
                        {files.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 30 }}>Nema dokumenata</div> : (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                                {files.map(f => (
                                    <div key={f.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                                        {f.type?.startsWith('image/') ? (
                                            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(128,128,128,0.06)' }} onClick={() => { const w = window.open(); w.document.write(`<img src="${f.data}" style="max-width:100%;height:auto">`); }}>
                                                <img src={f.data} alt={f.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                                            </div>
                                        ) : (
                                            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.06)' }}>
                                                <div style={{ textAlign: 'center' }}><Icon name="file" size={28} /><div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{f.type || 'File'}</div></div>
                                            </div>
                                        )}
                                        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div><div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{f.name}</div><div style={{ fontSize: 9, color: C.textMuted }}>{f.uploadedBy}</div></div>
                                            {canManage && <button onClick={() => removeFile(f.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>✕</button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Povijest tab */}
                {detailTab === 'povijest' && (
                    <div style={{ ...styles.card, marginBottom: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>🕐 Povijest promjena</div>
                        {stageHistory.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>Nema zapisa</div> : (
                            <div>
                                {[...stageHistory].reverse().map((h, i) => {
                                    const stage = STAGES.find(s => s.id === h.stage);
                                    return (
                                        <div key={i} style={{ padding: '10px 0', borderBottom: i < stageHistory.length - 1 ? `1px solid ${C.border}7A` : 'none', display: 'flex', gap: 12 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage?.color || C.accent, marginTop: 6, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{stage?.emoji} {stage?.label}</div>
                                                <div style={{ fontSize: 11, color: C.textMuted }}>
                                                    Ulaz: {fmtDate(h.enteredAt)}
                                                    {h.completedAt && ` → Izlaz: ${fmtDate(h.completedAt)}`}
                                                    {h.completedBy && ` • ${h.completedBy}`}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Main View ──
    const stageColor = (stage) => STAGES.find(s => s.id === stage)?.color || C.textMuted;
    const stageLabel = (stage) => STAGES.find(s => s.id === stage);

    // Pipeline card component
    const OrderCard = ({ order }) => {
        const daysLeft = order.deadline ? Math.ceil((new Date(order.deadline).getTime() - Date.now()) / 86400000) : null;
        return (
            <div onClick={() => setDetailId(order.id)} style={{ padding: '12px 14px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, cursor: 'pointer', marginBottom: 8, borderLeft: `4px solid ${stageColor(order.stage)}`, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, marginBottom: 4 }}>{order.orderNumber}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{order.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>🏢 {order.client || '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <span style={{ color: C.textMuted }}>{order.quantity} {order.unit}</span>
                    {daysLeft !== null && (
                        <span style={{ fontWeight: 700, color: daysLeft < 0 ? '#EF4444' : daysLeft <= 3 ? '#F59E0B' : C.green, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: daysLeft < 0 ? 'rgba(239,68,68,0.1)' : daysLeft <= 3 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)' }}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d kasni` : daysLeft === 0 ? 'DANAS' : `${daysLeft}d`}
                        </span>
                    )}
                </div>
                {order.priority !== 'normalan' && <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: order.priority === 'hitno' ? '#EF4444' : '#F59E0B' }}>{order.priority === 'hitno' ? '🔴 HITNO' : '🟡 Visok prioritet'}</div>}
                {(order.totalCost || 0) > 0 && <div style={{ marginTop: 4, fontSize: 10, color: C.accent, fontWeight: 700 }}>💰 {order.totalCost.toFixed(2)}€</div>}
            </div>
        );
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>🏭 Proizvodnja</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{activeOrders.length} narudžbi • Praćenje proizvodnog procesa</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {canManage && <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Nova narudžba</button>}
                    <button onClick={exportCSV} style={styles.btnSecondary}>📊 Export</button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ukupno</div><div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{stats.total}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>U proizvodnji</div><div style={{ fontSize: 22, fontWeight: 800, color: '#3B82F6' }}>{stats.inProgress}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Na čekanju</div><div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>{stats.waiting}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Završeno (mj)</div><div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{stats.done}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Troškovi</div><div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444' }}>{stats.totalCost > 0 ? `${stats.totalCost.toFixed(0)}€` : '0€'}</div></div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[{ id: 'pipeline', label: '🔄 Pipeline' }, { id: 'lista', label: '📋 Lista' }, { id: 'archive', label: '📦 Arhiva' }].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '8px 18px', borderRadius: 8, border: `1.5px solid ${activeTab === t.id ? C.accent : C.border}`, background: activeTab === t.id ? C.accentLight : 'transparent', color: activeTab === t.id ? C.accent : C.textMuted, fontWeight: activeTab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                        {t.label} {t.id === 'archive' && archivedOrders.length > 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>({archivedOrders.length})</span>}
                    </button>
                ))}
            </div>

            {/* Filters */}
            {activeTab !== 'archive' && (
                <div style={{ ...styles.card, marginBottom: 16, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                            <Input placeholder="Pretraži narudžbu..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}><Icon name="search" size={16} /></div>
                        </div>
                        <Select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ width: 150 }}>
                            <option value="all">Sve faze</option>
                            {STAGES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                        </Select>
                        <Select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ width: 140 }}>
                            <option value="all">Svi prioriteti</option>
                            <option value="hitno">🔴 Hitno</option>
                            <option value="visok">🟡 Visok</option>
                            <option value="normalan">Normalan</option>
                        </Select>
                    </div>
                </div>
            )}

            {/* Pipeline View */}
            {activeTab === 'pipeline' && (
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                    {STAGES.filter(s => s.id !== 'zavrseno').map(stage => {
                        const stageOrders = filtered.filter(o => o.stage === stage.id);
                        return (
                            <div key={stage.id} style={{ minWidth: isMobile ? 260 : 220, flex: 1, background: 'var(--bg)', borderRadius: 12, padding: 12, border: `1px solid ${C.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.emoji} {stage.label}</div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, background: 'var(--border)', borderRadius: 10, padding: '2px 8px' }}>{stageOrders.length}</div>
                                </div>
                                {stageOrders.length === 0 && <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: '20px 0', opacity: 0.5 }}>Nema narudžbi</div>}
                                {stageOrders.map(o => <OrderCard key={o.id} order={o} />)}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {activeTab === 'lista' && (
                <div>
                    {filtered.length === 0 ? <div style={{ ...styles.card, textAlign: 'center', padding: 50, color: C.textMuted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>Nema narudžbi za odabrane filtre</div> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Broj</th><th style={styles.th}>Naziv</th><th style={styles.th}>Naručitelj</th>
                                        <th style={styles.th}>Faza</th><th style={styles.th}>Prioritet</th><th style={styles.th}>Rok</th>
                                        <th style={styles.th}>Trošak</th>{canManage && <th style={styles.th}>Akcije</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(o => {
                                        const s = stageLabel(o.stage);
                                        const daysLeft = o.deadline ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86400000) : null;
                                        return (
                                            <tr key={o.id} onClick={() => setDetailId(o.id)} style={{ cursor: 'pointer' }}>
                                                <td style={{ ...styles.td, fontSize: 11, fontWeight: 700, color: C.accent }}>{o.orderNumber}</td>
                                                <td style={{ ...styles.td, fontWeight: 600 }}>{o.name}</td>
                                                <td style={styles.td}>{o.client || '—'}</td>
                                                <td style={styles.td}><span style={{ fontSize: 11, fontWeight: 700, color: s?.color, background: `${s?.color}18`, padding: '3px 8px', borderRadius: 6 }}>{s?.emoji} {s?.label}</span></td>
                                                <td style={styles.td}>{o.priority === 'hitno' ? '🔴' : o.priority === 'visok' ? '🟡' : '—'}</td>
                                                <td style={{ ...styles.td, color: daysLeft !== null && daysLeft < 0 ? '#EF4444' : C.textDim }}>{fmtDate(o.deadline) || '—'}</td>
                                                <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{(o.totalCost || 0) > 0 ? `${o.totalCost.toFixed(2)}€` : '—'}</td>
                                                {canManage && (
                                                    <td style={styles.td} onClick={e => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button onClick={() => openEdit(o)} style={styles.btnSmall}><Icon name="edit" size={10} /></button>
                                                            <button onClick={() => doDelete(o.id)} style={styles.btnDanger}><Icon name="trash" size={10} /></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Archive view */}
            {activeTab === 'archive' && (
                <div>
                    {archivedOrders.length === 0 ? <div style={{ ...styles.card, textAlign: 'center', padding: 50, color: C.textMuted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>Nema arhiviranih narudžbi</div> : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                            {archivedOrders.map(o => (
                                <div key={o.id} style={{ ...styles.card, opacity: 0.8, borderLeft: `4px solid ${C.textMuted}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>{o.orderNumber}</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{o.name}</div>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>🏢 {o.client || '—'}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => setDetailId(o.id)} style={styles.btnSmall}>Detalji</button>
                                            {canManage && <button onClick={() => unarchiveOrder(o)} style={styles.btnSmall}>↩️</button>}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: C.textMuted }}>💰 {(o.totalCost || 0).toFixed(2)}€ • 📅 {fmtDate(o.deadline)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <Modal title={editId ? 'Uredi narudžbu' : 'Nova narudžba za proizvodnju'} onClose={() => setShowForm(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Field label="Broj narudžbe" required><Input value={form.orderNumber} onChange={e => upd('orderNumber', e.target.value)} /></Field>
                        <Field label="Naziv proizvoda / projekta" required><Input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Čelična konstrukcija XY" autoFocus /></Field>
                        <Field label="Naručitelj"><Input value={form.client} onChange={e => upd('client', e.target.value)} placeholder="Ime klijenta" /></Field>
                        <Field label="Prioritet"><Select value={form.priority} onChange={e => upd('priority', e.target.value)}><option value="normalan">Normalan</option><option value="visok">Visok</option><option value="hitno">Hitno</option></Select></Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Količina"><Input type="number" value={form.quantity} onChange={e => upd('quantity', parseFloat(e.target.value) || 0)} /></Field>
                            <Field label="Jedinica"><Select value={form.unit} onChange={e => upd('unit', e.target.value)}><option value="kom">kom</option><option value="m²">m²</option><option value="m">m</option><option value="m³">m³</option><option value="kg">kg</option><option value="t">t</option><option value="set">set</option></Select></Field>
                        </div>
                        <Field label="Rok isporuke"><Input type="date" value={form.deadline} onChange={e => upd('deadline', e.target.value)} /></Field>
                        <Field label="Povezani projekt"><Select value={form.projectId} onChange={e => upd('projectId', e.target.value)}><option value="">— Bez projekta —</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                    </div>
                    <Field label="Opis"><Textarea value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Tehnički opis, specifikacije..." rows={3} /></Field>
                    <Field label="Napomene"><Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Interne napomene..." rows={2} /></Field>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
