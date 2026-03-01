import React, { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, Pagination, usePagination, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, fmtDateTime } from '../utils/helpers';

export function OtpremnicePage({ workerFilterId }) {
    const confirm = useConfirm();
    const { otpremnice, projects, workers, currentUser, companyProfile } = useApp();
    const [editItem, setEditItem] = useState(null);
    const [filters, setFilters] = useState({ project: '', status: 'sve', dateFrom: '', dateTo: '', search: '' });
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;
    const isAdmin = currentUser?.role === 'admin';

    const filtered = useMemo(() => {
        return (otpremnice || []).filter(o => {
            if (workerFilterId && o.workerId !== workerFilterId) return false;
            if (filters.project && o.projectId !== filters.project) return false;
            if (filters.status !== 'sve' && o.status !== filters.status) return false;
            if (filters.dateFrom && o.date < filters.dateFrom) return false;
            if (filters.dateTo && o.date > filters.dateTo) return false;
            if (filters.search) {
                const s = filters.search.toLowerCase();
                if (!(o.supplier || '').toLowerCase().includes(s) && !(o.deliveryNumber || '').toLowerCase().includes(s)) return false;
            }
            return true;
        }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [otpremnice, filters, workerFilterId]);

    const totalAmount = filtered.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);

    const pg = usePagination(filtered.length, [filters, workerFilterId]);

    const doSave = async (item) => {
        if (item.id && otpremnice.some(o => o.id === item.id)) {
            // Workers cannot change status on edit
            const updateData = isWorker ? { ...item, status: otpremnice.find(o => o.id === item.id)?.status || 'na čekanju' } : item;
            await updateDoc('otpremnice', item.id, updateData);
        } else {
            const newItem = {
                ...item,
                id: genId(),
                status: 'na čekanju',  // Always pending on creation
                workerId: workerFilterId || currentUser?.id,
                workerName: currentUser?.name,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.name
            };
            await addDoc('otpremnice', newItem);
        }
        setEditItem(null);
    };

    const doApprove = async (id) => {
        await updateDoc('otpremnice', id, { status: 'prihvaćena', approvedBy: currentUser?.name, approvedAt: new Date().toISOString() });
    };

    const doReject = async (id) => {
        const reason = prompt('Razlog odbijanja (opcionalno):');
        await updateDoc('otpremnice', id, { status: 'odbijena', rejectedBy: currentUser?.name, rejectedAt: new Date().toISOString(), rejectReason: reason || '' });
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati otpremnicu?'))) return;
        await removeDoc('otpremnice', id);
    };

    // Worker can only edit own pending items
    const canWorkerEdit = (o) => isWorker && o.workerId === workerFilterId && o.status === 'na čekanju';

    // PDF Export
    const exportPDF = () => {
        if (!filtered.length) return alert('Nema podataka za export');
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Otpremnice - ${company}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#1E293B;font-size:12px}
        h1{color:#D95D08;font-size:22px;margin:0 0 4px 0}
        .meta{color:#475569;font-size:11px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #CBD5E1;padding:7px 10px;text-align:left;font-size:11px}
        th{background:#F1F5F9;font-weight:700;font-size:10px;text-transform:uppercase}
        tr:nth-child(even){background:#FAFBFC}
        .total{margin-top:16px;font-size:14px;font-weight:800;color:#D95D08}
        .footer{margin-top:30px;color:#94A3B8;font-size:10px;border-top:1px solid #E2E8F0;padding-top:10px}
        </style></head><body>`;
        html += `<h1> ${company} — Otpremnice</h1>`;
        html += `<div class="meta">Generirano: ${new Date().toLocaleString('hr-HR')}`;
        if (filters.project) {
            const pn = projects.find(p => p.id === filters.project);
            html += ` | Gradilište: ${pn?.name || filters.project}`;
        }
        if (filters.dateFrom || filters.dateTo) html += ` | Period: ${filters.dateFrom || '...'} — ${filters.dateTo || '...'}`;
        html += `<br>Ukupno: ${filtered.length} otpremnica | Iznos: ${totalAmount.toFixed(2)} EUR</div>`;
        html += `<table><thead><tr><th>Datum</th><th>Dobavljač</th><th>Gradilište</th><th>Br. otpr.</th><th>Stavke</th><th>Iznos (€)</th><th>Status</th></tr></thead><tbody>`;
        filtered.forEach(o => {
            const proj = projects.find(p => p.id === o.projectId);
            const st = o.status === 'prihvaćena' ? '✅ Prihvaćena' : o.status === 'odbijena' ? '❌ Odbijena' : '⏳ Na čekanju';
            html += `<tr><td>${fmtDate(o.date)}</td><td>${o.supplier || '—'}</td><td>${proj?.name || '—'}</td><td>${o.deliveryNumber || '—'}</td><td>${(o.items || '—').substring(0, 50)}</td><td style="text-align:right;font-weight:600">${o.amount ? parseFloat(o.amount).toFixed(2) : '—'}</td><td>${st}</td></tr>`;
        });
        html += `</tbody></table>`;
        html += `<div class="total">UKUPNO: ${totalAmount.toFixed(2)} EUR</div>`;
        html += `<div class="footer">${company} • Vi-Di-Sef v3.0 • ${new Date().toISOString()}</div>`;
        html += `</body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // CSV/Excel Export
    const exportCSV = () => {
        if (!filtered.length) return alert('Nema podataka za export');
        let csv = 'Datum;Dobavljač;Gradilište;Br. otpremnice;Iznos (EUR);Status;Radnik;Stavke;Napomena\n';
        filtered.forEach(o => {
            const proj = projects.find(p => p.id === o.projectId);
            const wk = workers.find(w => w.id === o.workerId);
            const row = [fmtDate(o.date), o.supplier || '', proj?.name || '', o.deliveryNumber || '',
            o.amount || '', o.status || 'na čekanju', wk?.name || o.workerName || '',
            (o.items || '').replace(/\n/g, ' '), (o.note || '').replace(/\n/g, ' ')
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
            csv += row + '\n';
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.download = `otpremnice_${today()}.csv`; link.click();
    };

    // Stats
    const stats = [
        { label: 'Ukupno', value: (otpremnice || []).length, icon: 'file', color: C.accent },
        { label: 'Na čekanju', value: (otpremnice || []).filter(o => o.status === 'na čekanju').length, icon: 'clock', color: C.yellow },
        { label: 'Prihvaćene', value: (otpremnice || []).filter(o => o.status === 'prihvaćena').length, icon: 'check', color: C.green },
        { label: 'Ukupni iznos', value: totalAmount.toFixed(0) + ' €', icon: 'invoice', color: C.blue },
    ];

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{isWorker ? 'Moje otpremnice' : ' Otpremnice'}</div>
                    <div style={{ color: C.textMuted, fontSize: 14 }}>
                        {(otpremnice || []).length} otpremnica ukupno · Iznos: <b style={{ color: C.green }}>{totalAmount.toFixed(2)} €</b>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={exportPDF} style={{ ...styles.btnSecondary, fontSize: 13, padding: '8px 14px' }}>📄 PDF</button>
                    <button onClick={exportCSV} style={{ ...styles.btnSecondary, fontSize: 13, padding: '8px 14px' }}>📊 Excel/CSV</button>
                    <button style={styles.btn} onClick={() => setEditItem({})}><Icon name="plus" size={16} /> Nova otpremnica</button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ ...styles.card, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
                    <div><label style={styles.label}>Pretraži</label><Input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Dobavljač, broj..." /></div>
                    <div><label style={styles.label}>Projekt</label><Select value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}><option value="">Svi</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
                    <div><label style={styles.label}>Status</label><Select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><option value="sve">Svi</option><option value="na čekanju">Na čekanju</option><option value="prihvaćena">Prihvaćena</option><option value="odbijena">Odbijena</option></Select></div>
                    <div><label style={styles.label}>Od</label><Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
                    <div><label style={styles.label}>Do</label><Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
                </div>
            </div>

            {/* Stat cards */}
            {!isWorker && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {stats.map(s => (
                        <div key={s.label} style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ background: `${s.color}18`, borderRadius: 12, padding: 12, color: s.color }}><Icon name={s.icon} size={22} /></div>
                            <div>
                                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* List */}
            <div style={styles.card}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Datum</th>
                                <th style={styles.th}>Dobavljač</th>
                                <th style={styles.th}>Gradilište</th>
                                <th style={styles.th}>Br. otpr.</th>
                                <th style={styles.th}>Iznos</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Radnik</th>
                                <th style={styles.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pg.paginate(filtered).map(o => {
                                const proj = projects.find(p => p.id === o.projectId);
                                const wk = workers.find(w => w.id === o.workerId);
                                return (
                                    <tr key={o.id}>
                                        <td style={styles.td}>{fmtDate(o.date)}</td>
                                        <td style={{ ...styles.td, fontWeight: 600 }}>{o.supplier || '—'}</td>
                                        <td style={styles.td}>{proj?.name || '—'}</td>
                                        <td style={styles.td}>{o.deliveryNumber || '—'}</td>
                                        <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{o.amount ? parseFloat(o.amount).toFixed(2) + ' €' : '—'}</td>
                                        <td style={styles.td}><StatusBadge status={o.status || 'na čekanju'} /></td>
                                        <td style={{ ...styles.td, fontSize: 12, color: C.textMuted }}>{wk?.name || o.workerName || '—'}</td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {/* Admin: approve/reject buttons for pending items */}
                                                {isAdmin && o.status === 'na čekanju' && (
                                                    <>
                                                        <button onClick={() => doApprove(o.id)} title="Odobri" style={{ ...styles.btnSmall, background: 'rgba(34,197,94,0.15)', color: '#16A34A', border: '1px solid #BBF7D0', fontWeight: 700 }}>✅</button>
                                                        <button onClick={() => doReject(o.id)} title="Odbij" style={{ ...styles.btnSmall, background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 700 }}>❌</button>
                                                    </>
                                                )}
                                                {/* Admin can always edit; worker only if pending & own */}
                                                {(isAdmin || canWorkerEdit(o)) && (
                                                    <button onClick={() => setEditItem(o)} style={styles.btnSmall}><Icon name="edit" size={12} /></button>
                                                )}
                                                {/* Only admin can delete */}
                                                {isAdmin && (
                                                    <button onClick={() => doDelete(o.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={8} style={{ ...styles.td, textAlign: 'center', color: C.textMuted, padding: 30 }}>Nema otpremnica za prikaz</td></tr>}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 && <Pagination {...pg} totalItems={filtered.length} label="otpremnica" />}
            </div>

            {/* Form Modal */}
            {editItem && (
                <OtpremniceForm
                    item={editItem}
                    projects={projects}
                    onSave={doSave}
                    onClose={() => setEditItem(null)}
                    isMobile={isMobile}
                    isWorker={isWorker}
                />
            )}
        </div>
    );
}

function OtpremniceForm({ item, projects, onSave, onClose, isMobile, isWorker }) {
    const [form, setForm] = useState({
        date: item.date || today(),
        projectId: item.projectId || '',
        supplier: item.supplier || '',
        deliveryNumber: item.deliveryNumber || '',
        amount: item.amount || '',
        items: item.items || '',
        note: item.note || '',
        status: item.status || 'na čekanju',
    });

    const handleSave = () => {
        if (!form.supplier && !form.deliveryNumber) return alert('Dobavljač ili broj otpremnice je obavezan');
        onSave({ ...item, ...form });
    };

    return (
        <Modal title={item.id ? 'Uredi otpremnicu' : 'Nova otpremnica'} onClose={onClose} wide>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <Field label="Datum" required><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="Gradilište / Projekt" required><Select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}><option value="">— Odaberi —</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                <Field label="Dobavljač" required><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Naziv dobavljača" /></Field>
                <Field label="Broj otpremnice"><Input value={form.deliveryNumber} onChange={e => setForm(f => ({ ...f, deliveryNumber: e.target.value }))} placeholder="OTP-001" /></Field>
                <Field label="Iznos (€)"><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></Field>
                {/* Status field - only visible to admin */}
                {!isWorker ? (
                    <Field label="Status"><Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option value="na čekanju">Na čekanju</option><option value="prihvaćena">Prihvaćena</option><option value="odbijena">Odbijena</option></Select></Field>
                ) : (
                    <Field label="Status">
                        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.12)', borderRadius: 10, fontSize: 13, color: C.yellow, fontWeight: 600 }}>⏳ Na čekanju — odobrava admin</div>
                    </Field>
                )}
            </div>
            <Field label="Stavke"><Textarea value={form.items} onChange={e => setForm(f => ({ ...f, items: e.target.value }))} rows={3} placeholder="Popis stavki..." /></Field>
            <Field label="Napomena"><Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Dodatne napomene..." /></Field>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                <button onClick={onClose} style={styles.btnSecondary}>Odustani</button>
                <button onClick={handleSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
            </div>
        </Modal>
    );
}
