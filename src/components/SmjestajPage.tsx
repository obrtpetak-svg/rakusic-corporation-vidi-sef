import { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, WorkerCheckboxList, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate } from '../utils/helpers';

export function SmjestajPage({ workerFilterId }) {
    const confirm = useConfirm();
    const { smjestaj, workers, currentUser } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [search, setSearch] = useState('');
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;
    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');

    const blankForm = () => ({ name: '', address: '', city: '', pricePerNight: '', startDate: today(), endDate: '', maxCapacity: '', workerIds: [], contactPerson: '', contactPhone: '', notes: '' });
    const [form, setForm] = useState(blankForm());
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = useMemo(() => {
        let list = smjestaj;
        if (isWorker) list = list.filter(s => (s.workerIds || []).includes(workerFilterId));
        if (search) list = list.filter(s => (s.name || '').toLowerCase().includes(search.toLowerCase()) || (s.city || '').toLowerCase().includes(search.toLowerCase()));
        return list;
    }, [smjestaj, search, workerFilterId]);

    const openAdd = () => { setForm(blankForm()); setEditId(null); setShowForm(true); };
    const openEdit = (s) => { setForm({ name: s.name || '', address: s.address || '', city: s.city || '', pricePerNight: s.pricePerNight || '', startDate: s.startDate || '', endDate: s.endDate || '', maxCapacity: s.maxCapacity || '', workerIds: s.workerIds || [], contactPerson: s.contactPerson || '', contactPhone: s.contactPhone || '', notes: s.notes || '' }); setEditId(s.id); setShowForm(true); };

    const doSave = async () => {
        if (!form.name.trim()) return alert('Naziv smještaja je obavezan');
        if (editId) await updateDoc('smjestaj', editId, { ...form, updatedAt: new Date().toISOString() });
        else await addDoc('smjestaj', { id: genId(), ...form, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
        setShowForm(false);
    };

    const doDelete = async (id) => { if (!(await confirm('Obrisati?'))) return; await removeDoc('smjestaj', id); };

    const calcCost = (s) => {
        if (!s.pricePerNight || !s.startDate) return 0;
        const end = s.endDate ? new Date(s.endDate) : new Date();
        const start = new Date(s.startDate);
        const days = Math.max(1, Math.ceil((end - start) / 86400000));
        return days * parseFloat(s.pricePerNight) * (s.workerIds || []).length;
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div className="u-fs-22 u-fw-800" className="u-color-text">{isWorker ? 'Moj smještaj' : 'Smještaj'}</div>
                {!isWorker && <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Novi smještaj</button>}
            </div>
            <div style={{ position: 'relative', marginBottom: 20 }}><Input placeholder="Traži smještaj..." value={search} onChange={e => setSearch(e.target.value)} className="u-pl-36" /><div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}><Icon name="search" size={16} /></div></div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map(s => {
                    const sWorkers = (s.workerIds || []).map(wid => workers.find(w => w.id === wid)).filter(Boolean);
                    const cost = calcCost(s);
                    return (
                        <div key={s.id} style={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div><div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.name}</div><div className="u-fs-12" className="u-text-muted">{s.address && `📍 ${s.address}`}{s.city && `, ${s.city}`}</div></div>
                                {s.pricePerNight && <div style={{ ...styles.badge('249,115,22'), fontSize: 12 }}>{s.pricePerNight}€/noć</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
                                <span>👥 {sWorkers.length}{s.maxCapacity ? `/${s.maxCapacity}` : ''}</span>
                                <span>📅 {fmtDate(s.startDate)}{s.endDate ? ` → ${fmtDate(s.endDate)}` : ' → danas'}</span>
                                {cost > 0 && <span>💰 ~{cost.toFixed(0)}€</span>}
                            </div>
                            {sWorkers.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                                    {sWorkers.map(w => <span key={w.id} style={{ background: C.bgElevated, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: C.textDim }}>{w.name}</span>)}
                                </div>
                            )}
                            {s.contactPerson && <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>📞 {s.contactPerson} {s.contactPhone}</div>}
                            {!isWorker && <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
                                <button onClick={() => openEdit(s)} style={styles.btnSmall}><Icon name="edit" size={12} /> Uredi</button>
                                <button onClick={() => doDelete(s.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                            </div>}
                        </div>
                    );
                })}
            </div>
            {filtered.length === 0 && <div style={{ ...styles.card, textAlign: 'center', padding: 40, color: C.textMuted }}>Nema smještaja</div>}

            {showForm && (
                <Modal title={editId ? 'Uredi smještaj' : 'Novi smještaj'} onClose={() => setShowForm(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }} className="u-gap-16">
                        <Field label="Naziv smještaja" required><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Stan / Hostel / Apartman" autoFocus /></Field>
                        <Field label="Grad"><Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Zagreb" /></Field>
                        <Field label="Adresa"><Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Ulica i broj" /></Field>
                        <Field label="Cijena po noćenju (€)"><Input type="number" step="0.01" value={form.pricePerNight} onChange={e => update('pricePerNight', e.target.value)} placeholder="0.00" /></Field>
                        <Field label="Datum od"><Input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></Field>
                        <Field label="Datum do"><Input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></Field>
                        <Field label="Maks. kapacitet"><Input type="number" value={form.maxCapacity} onChange={e => update('maxCapacity', e.target.value)} placeholder="4" /></Field>
                        <Field label="Kontakt osoba"><Input value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} placeholder="Ime kontakta" /></Field>
                        <Field label="Kontakt telefon"><Input value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="+385 91..." /></Field>
                    </div>
                    <Field label="Dodjeljeni radnici"><WorkerCheckboxList allWorkers={activeWorkers} selected={form.workerIds} onChange={v => update('workerIds', v)} /></Field>
                    <Field label="Napomene"><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Napomene..." rows={2} /></Field>
                    <div className="u-flex-end">
                        <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
