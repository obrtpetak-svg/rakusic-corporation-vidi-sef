import React, { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, fmtDateTime } from '../utils/helpers';

export function VozilaPage({ workerFilterId }) {
    const confirm = useConfirm();
    const { vehicles, workers, currentUser } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [showFuelForm, setShowFuelForm] = useState(null);
    const [showKmForm, setShowKmForm] = useState(null);
    const [showDiaryForm, setShowDiaryForm] = useState(null);
    const [detailTab, setDetailTab] = useState('fuel');
    const [search, setSearch] = useState('');
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;

    const [fuelForm, setFuelForm] = useState({ date: today(), liters: '', pricePerLiter: '', totalCost: '', km: '', location: '', notes: '' });
    const [kmForm, setKmForm] = useState({ date: today(), km: '', type: 'servis', notes: '' });
    const [diaryForm, setDiaryForm] = useState({ date: today(), title: '', description: '', priority: 'normalna' });

    const blankForm = () => ({ name: '', regNumber: '', brand: '', model: '', year: '', assignedWorker: '', fuelType: 'dizel', notes: '', fuelLogs: [], kmLogs: [], diary: [], currentKm: '' });
    const [form, setForm] = useState(blankForm());
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = useMemo(() => {
        let list = vehicles;
        if (isWorker) list = list.filter(v => v.assignedWorker === workerFilterId);
        if (search) list = list.filter(v => (v.name || '').toLowerCase().includes(search.toLowerCase()) || (v.regNumber || '').toLowerCase().includes(search.toLowerCase()));
        return list;
    }, [vehicles, search, workerFilterId]);

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (v) => { setForm({ name: v.name || '', regNumber: v.regNumber || '', brand: v.brand || '', model: v.model || '', year: v.year || '', assignedWorker: v.assignedWorker || '', fuelType: v.fuelType || 'dizel', notes: v.notes || '', fuelLogs: v.fuelLogs || [], kmLogs: v.kmLogs || [], diary: v.diary || [], currentKm: v.currentKm || '' }); setEditId(v.id); setShowForm(true); };

    const doSave = async () => {
        if (!form.name && !form.regNumber) return alert('Naziv ili reg. oznaka je obavezna');
        if (editId) {
            await updateDoc('vehicles', editId, { ...form, updatedAt: new Date().toISOString() });
        } else {
            await addDoc('vehicles', { id: genId(), ...form, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
        }
        setShowForm(false);
    };

    const doDelete = async (id) => { if (!(await confirm('Obrisati?'))) return; await removeDoc('vehicles', id); };

    // Fuel log
    const addFuelLog = async (vehicleId) => {
        if (!fuelForm.liters && !fuelForm.totalCost) return alert('Unesi litaže ili cijenu');
        const fuel = { id: genId(), ...fuelForm, createdAt: new Date().toISOString(), createdBy: currentUser?.name };
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const updObj = { fuelLogs: [...(vehicle?.fuelLogs || []), fuel] };
        if (fuelForm.km) updObj.currentKm = fuelForm.km;
        await updateDoc('vehicles', vehicleId, updObj);
        setShowFuelForm(null);
        setFuelForm({ date: today(), liters: '', pricePerLiter: '', totalCost: '', km: '', location: '', notes: '' });
    };

    const deleteFuelLog = async (vehicleId, fuelId) => {
        if (!(await confirm('Obrisati?'))) return;
        const vehicle = vehicles.find(v => v.id === vehicleId);
        await updateDoc('vehicles', vehicleId, { fuelLogs: (vehicle?.fuelLogs || []).filter(f => f.id !== fuelId) });
    };

    // Km log
    const addKmLog = async (vehicleId) => {
        if (!kmForm.km) return alert('Unesi kilometražu');
        const log = { id: genId(), ...kmForm, createdAt: new Date().toISOString(), createdBy: currentUser?.name };
        const vehicle = vehicles.find(v => v.id === vehicleId);
        await updateDoc('vehicles', vehicleId, { kmLogs: [...(vehicle?.kmLogs || []), log], currentKm: kmForm.km });
        setShowKmForm(null);
        setKmForm({ date: today(), km: '', type: 'servis', notes: '' });
    };

    const deleteKmLog = async (vehicleId, logId) => {
        if (!(await confirm('Obrisati?'))) return;
        const vehicle = vehicles.find(v => v.id === vehicleId);
        await updateDoc('vehicles', vehicleId, { kmLogs: (vehicle?.kmLogs || []).filter(l => l.id !== logId) });
    };

    // Diary
    const addDiaryEntry = async (vehicleId) => {
        if (!diaryForm.title) return alert('Unesi naslov obavijesti');
        const entry = { id: genId(), ...diaryForm, createdAt: new Date().toISOString(), createdBy: currentUser?.name };
        const vehicle = vehicles.find(v => v.id === vehicleId);
        await updateDoc('vehicles', vehicleId, { diary: [...(vehicle?.diary || []), entry] });
        setShowDiaryForm(null);
        setDiaryForm({ date: today(), title: '', description: '', priority: 'normalna' });
    };

    const deleteDiaryEntry = async (vehicleId, entryId) => {
        if (!(await confirm('Obrisati?'))) return;
        const vehicle = vehicles.find(v => v.id === vehicleId);
        await updateDoc('vehicles', vehicleId, { diary: (vehicle?.diary || []).filter(d => d.id !== entryId) });
    };

    // Detail view
    const detailVehicle = detailId ? vehicles.find(v => v.id === detailId) : null;
    if (detailVehicle) {
        const assignedW = workers.find(w => w.id === detailVehicle.assignedWorker);
        const fuelLogs = (detailVehicle.fuelLogs || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const kmLogs = (detailVehicle.kmLogs || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const diaryEntries = (detailVehicle.diary || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const totalFuel = fuelLogs.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0);
        const totalLiters = fuelLogs.reduce((s, f) => s + (parseFloat(f.liters) || 0), 0);

        const tabs = [
            { id: 'fuel', label: '⛽ Gorivo', count: fuelLogs.length },
            { id: 'km', label: '🛣️ Kilometri', count: kmLogs.length },
            { id: 'diary', label: '📋 Dnevnik', count: diaryEntries.length }
        ];

        return (
            <div>
                <button onClick={() => setDetailId(null)} style={{ ...styles.btnSecondary, marginBottom: 20, display: 'inline-flex' }}><Icon name="back" size={16} /> Natrag</button>
                <div style={{ ...styles.card, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div><div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{detailVehicle.name || detailVehicle.regNumber}</div><div style={{ color: C.textMuted, fontSize: 13 }}>{detailVehicle.brand} {detailVehicle.model} {detailVehicle.year}</div></div>
                        <div style={{ ...styles.badge('249,115,22'), fontSize: 12 }}>{detailVehicle.regNumber}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: C.accentLight }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>GORIVO</div><div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{detailVehicle.fuelType}</div></div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(29,78,216,0.08)' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>TANKANJA</div><div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fuelLogs.length}</div></div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(4,120,87,0.08)' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>UKUPNO L</div><div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{totalLiters.toFixed(1)}</div></div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(185,28,28,0.08)' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>TROŠAK</div><div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{totalFuel.toFixed(2)}€</div></div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(124,58,237,0.08)' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>KILOMETRI</div><div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED' }}>{detailVehicle.currentKm ? `${Number(detailVehicle.currentKm).toLocaleString()} km` : '—'}</div></div>
                    </div>
                    {assignedW && <div style={{ fontSize: 13, color: C.textDim }}>👤 Dodijeljen: {assignedW.name}</div>}
                    {detailVehicle.notes && <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', fontSize: 13, color: C.yellow }}>📝 {detailVehicle.notes}</div>}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 4 }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setDetailTab(t.id)} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: detailTab === t.id ? C.accent : 'transparent', color: detailTab === t.id ? '#fff' : C.textMuted, transition: 'all 0.2s' }}>
                            {t.label} {t.count > 0 && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, background: detailTab === t.id ? 'rgba(255,255,255,0.3)' : C.accentLight, color: detailTab === t.id ? '#fff' : C.accent, borderRadius: 10, padding: '1px 6px' }}>{t.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Fuel tab */}
                {detailTab === 'fuel' && (
                    <div style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>⛽ Evidencija goriva ({fuelLogs.length})</div>
                            <button onClick={() => setShowFuelForm(detailVehicle.id)} style={styles.btn}><Icon name="plus" size={14} /> Dodaj tankanje</button>
                        </div>
                        {fuelLogs.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, padding: 12 }}>Nema evidencije goriva</div> : (
                            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                                <thead><tr><th style={styles.th}>Datum</th><th style={styles.th}>Litara</th><th style={styles.th}>€/L</th><th style={styles.th}>Ukupno €</th><th style={styles.th}>km</th><th style={styles.th}>Lokacija</th><th style={styles.th}></th></tr></thead>
                                <tbody>{fuelLogs.map(f => (
                                    <tr key={f.id}><td style={styles.td}>{fmtDate(f.date)}</td><td style={{ ...styles.td, fontWeight: 600 }}>{f.liters || '—'}</td><td style={styles.td}>{f.pricePerLiter || '—'}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{f.totalCost ? `${parseFloat(f.totalCost).toFixed(2)}€` : '—'}</td><td style={styles.td}>{f.km ? Number(f.km).toLocaleString() : '—'}</td><td style={styles.td}>{f.location || '—'}</td><td style={styles.td}>{!isWorker && <button onClick={() => deleteFuelLog(detailVehicle.id, f.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>}</td></tr>
                                ))}</tbody>
                            </table></div>
                        )}
                    </div>
                )}

                {/* Km tab */}
                {detailTab === 'km' && (
                    <div style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🛣️ Evidencija kilometara ({kmLogs.length})</div>
                            <button onClick={() => setShowKmForm(detailVehicle.id)} style={styles.btn}><Icon name="plus" size={14} /> Dodaj km</button>
                        </div>
                        {kmLogs.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, padding: 12 }}>Nema evidencije kilometara</div> : (
                            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                                <thead><tr><th style={styles.th}>Datum</th><th style={styles.th}>Kilometri</th><th style={styles.th}>Tip</th><th style={styles.th}>Napomena</th><th style={styles.th}>Upisao</th><th style={styles.th}></th></tr></thead>
                                <tbody>{kmLogs.map(l => (
                                    <tr key={l.id}><td style={styles.td}>{fmtDate(l.date)}</td><td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{Number(l.km).toLocaleString()} km</td><td style={styles.td}><span style={styles.badge(l.type === 'servis' ? '29,78,216' : l.type === 'tehnički' ? '185,28,28' : '4,120,87')}>{l.type}</span></td><td style={styles.td}>{l.notes || '—'}</td><td style={styles.td}>{l.createdBy || '—'}</td><td style={styles.td}>{!isWorker && <button onClick={() => deleteKmLog(detailVehicle.id, l.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>}</td></tr>
                                ))}</tbody>
                            </table></div>
                        )}
                    </div>
                )}

                {/* Diary tab */}
                {detailTab === 'diary' && (
                    <div style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📋 Dnevnik obavijesti ({diaryEntries.length})</div>
                            <button onClick={() => setShowDiaryForm(detailVehicle.id)} style={styles.btn}><Icon name="plus" size={14} /> Nova obavijest</button>
                        </div>
                        {diaryEntries.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, padding: 12 }}>Nema obavijesti</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {diaryEntries.map(d => (
                                    <div key={d.id} style={{ padding: '14px 18px', borderRadius: 10, background: d.priority === 'hitna' ? 'rgba(185,28,28,0.06)' : d.priority === 'važna' ? 'rgba(180,89,9,0.06)' : '#F8FAFC', border: `1px solid ${d.priority === 'hitna' ? 'rgba(185,28,28,0.2)' : d.priority === 'važna' ? 'rgba(180,89,9,0.2)' : C.border}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                            <div>
                                                <span style={styles.badge(d.priority === 'hitna' ? '185,28,28' : d.priority === 'važna' ? '180,89,9' : '100,116,139')}>{d.priority}</span>
                                                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 700, color: C.text }}>{d.title}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(d.date)}</span>
                                                {!isWorker && <button onClick={() => deleteDiaryEntry(detailVehicle.id, d.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>}
                                            </div>
                                        </div>
                                        {d.description && <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>{d.description}</div>}
                                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Upisao: {d.createdBy || '—'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Fuel modal */}
                {showFuelForm === detailVehicle.id && (
                    <Modal title="Dodaj tankanje" onClose={() => setShowFuelForm(null)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Datum"><Input type="date" value={fuelForm.date} onChange={e => setFuelForm(f => ({ ...f, date: e.target.value }))} /></Field>
                            <Field label="Litara"><Input type="number" step="0.1" value={fuelForm.liters} onChange={e => setFuelForm(f => ({ ...f, liters: e.target.value }))} placeholder="0.0" /></Field>
                            <Field label="Cijena po litri (€)"><Input type="number" step="0.01" value={fuelForm.pricePerLiter} onChange={e => setFuelForm(f => ({ ...f, pricePerLiter: e.target.value }))} placeholder="0.00" /></Field>
                            <Field label="Ukupni iznos (€)"><Input type="number" step="0.01" value={fuelForm.totalCost} onChange={e => setFuelForm(f => ({ ...f, totalCost: e.target.value }))} placeholder="0.00" /></Field>
                            <Field label="Stanje km"><Input type="number" value={fuelForm.km} onChange={e => setFuelForm(f => ({ ...f, km: e.target.value }))} placeholder="123456" /></Field>
                            <Field label="Lokacija / Pumpa"><Input value={fuelForm.location} onChange={e => setFuelForm(f => ({ ...f, location: e.target.value }))} placeholder="INA Zagreb" /></Field>
                        </div>
                        <Field label="Napomene"><Input value={fuelForm.notes} onChange={e => setFuelForm(f => ({ ...f, notes: e.target.value }))} placeholder="Napomene..." /></Field>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button onClick={() => setShowFuelForm(null)} style={styles.btnSecondary}>Odustani</button>
                            <button onClick={() => addFuelLog(detailVehicle.id)} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                        </div>
                    </Modal>
                )}

                {/* Km modal */}
                {showKmForm === detailVehicle.id && (
                    <Modal title="Dodaj kilometražu" onClose={() => setShowKmForm(null)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Datum"><Input type="date" value={kmForm.date} onChange={e => setKmForm(f => ({ ...f, date: e.target.value }))} /></Field>
                            <Field label="Kilometri"><Input type="number" value={kmForm.km} onChange={e => setKmForm(f => ({ ...f, km: e.target.value }))} placeholder="123456" /></Field>
                            <Field label="Tip"><Select value={kmForm.type} onChange={e => setKmForm(f => ({ ...f, type: e.target.value }))}><option value="servis">Servis</option><option value="tehnički">Tehnički pregled</option><option value="dnevni">Dnevni unos</option><option value="ostalo">Ostalo</option></Select></Field>
                        </div>
                        <Field label="Napomena"><Input value={kmForm.notes} onChange={e => setKmForm(f => ({ ...f, notes: e.target.value }))} placeholder="Napomene..." /></Field>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button onClick={() => setShowKmForm(null)} style={styles.btnSecondary}>Odustani</button>
                            <button onClick={() => addKmLog(detailVehicle.id)} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                        </div>
                    </Modal>
                )}

                {/* Diary modal */}
                {showDiaryForm === detailVehicle.id && (
                    <Modal title="Nova obavijest" onClose={() => setShowDiaryForm(null)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Datum"><Input type="date" value={diaryForm.date} onChange={e => setDiaryForm(f => ({ ...f, date: e.target.value }))} /></Field>
                            <Field label="Prioritet"><Select value={diaryForm.priority} onChange={e => setDiaryForm(f => ({ ...f, priority: e.target.value }))}><option value="normalna">Normalna</option><option value="važna">Važna</option><option value="hitna">Hitna</option></Select></Field>
                        </div>
                        <Field label="Naslov"><Input value={diaryForm.title} onChange={e => setDiaryForm(f => ({ ...f, title: e.target.value }))} placeholder="Zamjena ulja, registracija..." /></Field>
                        <Field label="Opis"><Textarea value={diaryForm.description} onChange={e => setDiaryForm(f => ({ ...f, description: e.target.value }))} placeholder="Detaljni opis..." rows={3} /></Field>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                            <button onClick={() => setShowDiaryForm(null)} style={styles.btnSecondary}>Odustani</button>
                            <button onClick={() => addDiaryEntry(detailVehicle.id)} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{isWorker ? 'Moje vozilo' : 'Vozila'}</div>
                {!isWorker && <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Novo vozilo</button>}
            </div>
            <div style={{ position: 'relative', marginBottom: 20 }}><Input placeholder="Traži vozilo..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} /><div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}><Icon name="search" size={16} /></div></div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {filtered.map(v => {
                    const w = workers.find(x => x.id === v.assignedWorker);
                    const fuelCount = (v.fuelLogs || []).length;
                    const totalFuelCost = (v.fuelLogs || []).reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0);
                    return (
                        <div key={v.id} style={{ ...styles.card, cursor: 'pointer' }} onClick={() => setDetailId(v.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div><div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{v.name || v.regNumber}</div><div style={{ fontSize: 12, color: C.textMuted }}>{v.brand} {v.model} {v.year && `(${v.year})`}</div></div>
                                <div style={{ ...styles.badge('249,115,22'), fontSize: 12 }}>{v.regNumber || '—'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textMuted, marginBottom: 12, flexWrap: 'wrap' }}>
                                <span>⛽ {v.fuelType}</span><span>📊 {fuelCount} tankanja</span><span>💰 {totalFuelCost.toFixed(0)}€</span>
                                {v.currentKm && <span>🛣️ {Number(v.currentKm).toLocaleString()} km</span>}
                                {(v.diary || []).length > 0 && <span>📋 {(v.diary || []).length} obavijesti</span>}
                            </div>
                            {w && <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>👤 {w.name}</div>}
                            {!isWorker && <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 12 }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => openEdit(v)} style={styles.btnSmall}><Icon name="edit" size={12} /></button>
                                <button onClick={() => doDelete(v.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                            </div>}
                        </div>
                    );
                })}
            </div>
            {filtered.length === 0 && <div style={{ ...styles.card, textAlign: 'center', padding: 40, color: C.textMuted }}>Nema vozila</div>}

            {showForm && (
                <Modal title={editId ? 'Uredi vozilo' : 'Novo vozilo'} onClose={() => setShowForm(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Field label="Naziv / Opis"><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Kamion 1" /></Field>
                        <Field label="Registracija"><Input value={form.regNumber} onChange={e => update('regNumber', e.target.value)} placeholder="ZG-1234-AB" /></Field>
                        <Field label="Marka"><Input value={form.brand} onChange={e => update('brand', e.target.value)} placeholder="Mercedes, MAN..." /></Field>
                        <Field label="Model"><Input value={form.model} onChange={e => update('model', e.target.value)} placeholder="Actros, TGS..." /></Field>
                        <Field label="Godište"><Input type="number" value={form.year} onChange={e => update('year', e.target.value)} placeholder="2023" /></Field>
                        <Field label="Trenutni km"><Input type="number" value={form.currentKm} onChange={e => update('currentKm', e.target.value)} placeholder="0" /></Field>
                        <Field label="Tip goriva"><Select value={form.fuelType} onChange={e => update('fuelType', e.target.value)}><option value="dizel">Dizel</option><option value="benzin">Benzin</option><option value="LPG">LPG</option><option value="EV">Električno</option></Select></Field>
                        <Field label="Dodijeljeni radnik"><Select value={form.assignedWorker} onChange={e => update('assignedWorker', e.target.value)}><option value="">— Nije dodijeljeno —</option>{workers.filter(w => w.active !== false).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
                    </div>
                    <Field label="Napomene"><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Napomene o vozilu..." rows={2} /></Field>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
