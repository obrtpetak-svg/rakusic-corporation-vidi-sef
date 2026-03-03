import { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, Pagination, usePagination, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, compressImage } from '../utils/helpers';

export function InvoicesPage({ workerFilterId }) {
    const confirm = useConfirm();
    const { invoices, workers, projects, currentUser, companyProfile, addAuditLog } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [filters, setFilters] = useState({ project: '', dateFrom: '', dateTo: '', search: '', status: 'all' });
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;

    const blankForm = () => ({ invoiceNumber: '', date: today(), supplier: '', description: '', amount: '', currency: 'EUR', projectId: '', workerId: workerFilterId || '', status: isWorker ? 'na čekanju' : 'prihvaćena', notes: '', category: 'materijal' });
    const [form, setForm] = useState(blankForm());
    const [fileData, setFileData] = useState(null);
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = useMemo(() => {
        let list = invoices;
        if (isWorker) list = list.filter(i => i.workerId === workerFilterId);
        if (filters.project) list = list.filter(i => i.projectId === filters.project);
        if (filters.status !== 'all') list = list.filter(i => i.status === filters.status);
        if (filters.dateFrom) list = list.filter(i => i.date >= filters.dateFrom);
        if (filters.dateTo) list = list.filter(i => i.date <= filters.dateTo);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            list = list.filter(i => (i.invoiceNumber || '').toLowerCase().includes(s) || (i.supplier || '').toLowerCase().includes(s) || (i.description || '').toLowerCase().includes(s) || (i.name || '').toLowerCase().includes(s));
        }
        return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [invoices, filters, workerFilterId]);

    const totalAmount = filtered.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

    const pg = usePagination(filtered.length, [filters, workerFilterId]);

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert('Datoteka je prevelika (max 10MB)');
        const compressed = await compressImage(file);
        setFileData(compressed);
    };

    const openAdd = () => { setForm(blankForm()); setFileData(null); setEditId(null); setShowForm(true); };
    const openEdit = (inv) => {
        setForm({ invoiceNumber: inv.invoiceNumber || '', date: inv.date || today(), supplier: inv.supplier || '', description: inv.description || '', amount: inv.amount || '', currency: inv.currency || 'EUR', projectId: inv.projectId || '', workerId: inv.workerId || '', status: inv.status || 'prihvaćena', notes: inv.notes || '', category: inv.category || 'materijal' });
        setFileData(inv.file || null);
        setEditId(inv.id); setShowForm(true);
    };

    const doSave = async () => {
        if (!form.invoiceNumber && !form.supplier) return alert('Broj računa ili dobavljač je obavezan');
        if (editId) {
            const existing = invoices.find(i => i.id === editId);
            await updateDoc('invoices', editId, { ...form, file: fileData || existing?.file, updatedAt: new Date().toISOString() });
        } else {
            await addDoc('invoices', { id: genId(), ...form, file: fileData, createdAt: new Date().toISOString(), createdBy: currentUser?.name, source: isWorker ? 'radnik' : 'admin' });
        }
        setShowForm(false);
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati ovaj račun?'))) return;
        await removeDoc('invoices', id);
    };

    const approveInvoice = async (inv) => {
        await updateDoc('invoices', inv.id, { status: 'prihvaćena', approvedAt: new Date().toISOString(), approvedBy: currentUser?.name });
        await addAuditLog('INVOICE_APPROVED', `Račun ${inv.invoiceNumber || inv.id} prihvaćen`);
    };

    const rejectInvoice = async (inv) => {
        const reason = prompt('Razlog odbijanja:');
        if (reason === null) return;
        await updateDoc('invoices', inv.id, { status: 'odbijena', rejectedAt: new Date().toISOString(), rejectedBy: currentUser?.name, rejectReason: reason });
    };

    // PDF Export
    const exportPDF = () => {
        if (!filtered.length) return alert('Nema podataka za export');
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const w = window.open('', '_blank');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Računi - ${company}</title>
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
        html += `<h1>📋 ${company} — Računi R1</h1>`;
        html += `<div class="meta">Generirano: ${new Date().toLocaleString('hr-HR')}`;
        if (filters.project) { const pn = projects.find(p => p.id === filters.project); html += ` | Gradilište: ${pn?.name || ''}`; }
        if (filters.dateFrom || filters.dateTo) html += ` | Period: ${filters.dateFrom || '...'} — ${filters.dateTo || '...'}`;
        html += `<br>Ukupno: ${filtered.length} računa | Iznos: ${totalAmount.toFixed(2)} EUR</div>`;
        html += `<table><thead><tr><th>Datum</th><th>Br. računa</th><th>Dobavljač</th><th>Opis</th><th>Kategorija</th><th>Gradilište</th><th style="text-align:right">Iznos (€)</th><th>Status</th></tr></thead><tbody>`;
        filtered.forEach(inv => {
            const proj = projects.find(p => p.id === inv.projectId);
            const st = inv.status === 'prihvaćena' ? '✅' : inv.status === 'odbijena' ? '❌' : '⏳';
            html += `<tr><td>${fmtDate(inv.date)}</td><td>${inv.invoiceNumber || '—'}</td><td>${inv.supplier || '—'}</td><td>${(inv.description || '—').substring(0, 40)}</td><td>${inv.category || '—'}</td><td>${proj?.name || '—'}</td><td style="text-align:right;font-weight:600">${inv.amount ? parseFloat(inv.amount).toFixed(2) : '—'}</td><td>${st}</td></tr>`;
        });
        html += `</tbody></table>`;
        html += `<div class="total">UKUPNO: ${totalAmount.toFixed(2)} EUR</div>`;
        html += `<div class="footer">${company} • Vi-Di-Sef v3.0 • ${new Date().toISOString()}</div></body></html>`;
        w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500);
    };

    // CSV Export
    const exportCSV = () => {
        if (!filtered.length) return alert('Nema podataka za export');
        let csv = 'Datum;Br. računa;Dobavljač;Opis;Kategorija;Gradilište;Iznos (EUR);Status;Radnik\n';
        filtered.forEach(inv => {
            const proj = projects.find(p => p.id === inv.projectId);
            const wk = workers.find(w => w.id === inv.workerId);
            const row = [fmtDate(inv.date), inv.invoiceNumber || '', inv.supplier || '', (inv.description || '').replace(/\n/g, ' '), inv.category || '', proj?.name || '', inv.amount || '', inv.status || '', wk?.name || inv.workerName || '']
                .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
            csv += row + '\n';
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
        link.download = `racuni_${today()}.csv`; link.click();
    };

    const detailInv = detailId ? invoices.find(i => i.id === detailId) : null;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{isWorker ? 'Moji računi' : 'Računi R1'}</div>
                    <div style={{ color: C.textMuted, fontSize: 14 }}>{isWorker ? `${filtered.length} računa` : <>Ukupno troškovi: <b style={{ color: C.green }}>{totalAmount.toFixed(2)} €</b></>}</div>
                </div>
                <div className="u-flex-center u-gap-8">
                    <button onClick={exportPDF} style={{ ...styles.btnSecondary, fontSize: 13, padding: '8px 14px' }}>📄 PDF</button>
                    <button onClick={exportCSV} style={{ ...styles.btnSecondary, fontSize: 13, padding: '8px 14px' }}>📊 Excel/CSV</button>
                    <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> {isWorker ? 'Pošalji račun' : 'Novi račun'}</button>
                </div>
            </div>

            {/* Filters */}
            <div style={styles.card} className="u-mb-20">
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
                    <div><label style={styles.label}>Pretraži</label><Input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Broj, dobavljač, opis..." /></div>
                    <div><label style={styles.label}>Projekt</label><Select value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}><option value="">Svi</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
                    <div><label style={styles.label}>Status</label><Select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><option value="all">Svi</option><option value="na čekanju">Na čekanju</option><option value="prihvaćena">Prihvaćena</option><option value="odbijena">Odbijena</option></Select></div>
                    <div><label style={styles.label}>Od</label><Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
                    <div><label style={styles.label}>Do</label><Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
                </div>
            </div>

            {/* Pending banner */}
            {!isWorker && invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik').length > 0 && (
                <div style={{ ...styles.card, background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.3)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>📋</span>
                    <div><div style={{ fontWeight: 700, color: C.yellow, fontSize: 14 }}>{invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik').length} računa čeka odobrenje</div><div className="u-fs-12 u-text-muted">Računi poslani od radnika</div></div>
                </div>
            )}

            {/* Table */}
            <div style={{ ...styles.card, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                    <thead><tr><th style={styles.th}>Datum</th><th style={styles.th}>Br. računa</th><th style={styles.th}>Dobavljač</th><th style={styles.th}>Opis</th><th style={styles.th}>Iznos</th><th style={styles.th}>Status</th><th style={styles.th}>Akcije</th></tr></thead>
                    <tbody>
                        {pg.paginate(filtered).map(inv => {
                            const isPending = inv.status === 'na čekanju';
                            return (
                                <tr key={inv.id} style={{ background: isPending ? 'rgba(234,179,8,0.05)' : 'transparent' }}>
                                    <td style={styles.td}>{fmtDate(inv.date)}</td>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{inv.invoiceNumber || '—'}</td>
                                    <td style={styles.td}>{inv.supplier || (workers.find(w => w.id === inv.workerId)?.name) || '—'}</td>
                                    <td style={{ ...styles.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description || '—'}</td>
                                    <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{inv.amount ? `${parseFloat(inv.amount).toFixed(2)} ${inv.currency || '€'}` : '—'}</td>
                                    <td style={styles.td}><StatusBadge status={inv.status} /></td>
                                    <td style={styles.td}>
                                        <div className="u-flex-gap-4">
                                            {isPending && !isWorker && <>
                                                <button onClick={() => approveInvoice(inv)} style={{ ...styles.btnSmall, background: 'rgba(34,197,94,0.15)', color: C.green, border: '1px solid rgba(34,197,94,0.3)' }}><Icon name="check" size={14} /></button>
                                                <button onClick={() => rejectInvoice(inv)} style={styles.btnDanger}><Icon name="close" size={14} /></button>
                                            </>}
                                            <button onClick={() => setDetailId(inv.id)} style={styles.btnSmall}><Icon name="eye" size={14} /></button>
                                            {(!isWorker || inv.source === 'radnik') && <>
                                                <button onClick={() => openEdit(inv)} style={styles.btnSmall}><Icon name="edit" size={12} /></button>
                                                <button onClick={() => doDelete(inv.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                                            </>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Nema računa</div>}
                {filtered.length > 0 && <Pagination {...pg} totalItems={filtered.length} label="računa" />}
            </div>

            {/* Detail Modal */}
            {detailInv && (
                <Modal title={`Račun: ${detailInv.invoiceNumber || detailInv.id}`} onClose={() => setDetailId(null)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div><span style={styles.label}>Broj računa</span><div className="u-fw-600">{detailInv.invoiceNumber || '—'}</div></div>
                        <div><span style={styles.label}>Datum</span><div>{fmtDate(detailInv.date)}</div></div>
                        <div><span style={styles.label}>Dobavljač</span><div>{detailInv.supplier || '—'}</div></div>
                        <div><span style={styles.label}>Kategorija</span><div>{detailInv.category || '—'}</div></div>
                        <div><span style={styles.label}>Iznos</span><div style={{ fontWeight: 700, color: C.accent }}>{detailInv.amount ? `${parseFloat(detailInv.amount).toFixed(2)} ${detailInv.currency || '€'}` : '—'}</div></div>
                        <div><span style={styles.label}>Status</span><StatusBadge status={detailInv.status} /></div>
                        {detailInv.projectId && <div><span style={styles.label}>Projekt</span><div>{projects.find(p => p.id === detailInv.projectId)?.name || '—'}</div></div>}
                        {detailInv.source && <div><span style={styles.label}>Izvor</span><div>{detailInv.source === 'admin' ? 'Admin' : 'Radnik'}</div></div>}
                    </div>
                    {detailInv.description && <div className="u-mb-12"><span style={styles.label}>Opis</span><div style={{ padding: '10px 14px', borderRadius: 8, background: C.bgElevated, fontSize: 13 }}>{detailInv.description}</div></div>}
                    {detailInv.notes && <div className="u-mb-12"><span style={styles.label}>Napomene</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', fontSize: 13, color: C.yellow }}>{detailInv.notes}</div></div>}
                    {detailInv.rejectReason && <div className="u-mb-12"><span style={styles.label}>Razlog odbijanja</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', fontSize: 13, color: C.red }}>{detailInv.rejectReason}</div></div>}
                    {detailInv.file && (
                        <div className="u-mb-12">
                            <span style={styles.label}>Priložena datoteka</span>
                            {detailInv.file.type?.startsWith('image/') ? (
                                <img loading="lazy" src={detailInv.file.data} alt="Račun" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: `1px solid ${C.border}`, marginTop: 8 }} />
                            ) : (
                                <a href={detailInv.file.data} download={detailInv.file.name} style={{ ...styles.btnSmall, display: 'inline-flex', marginTop: 8 }}><Icon name="download" size={14} /> {detailInv.file.name}</a>
                            )}
                        </div>
                    )}
                    {detailInv.status === 'na čekanju' && !isWorker && (
                        <div style={{ display: 'flex', gap: 12, marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                            <button onClick={() => { approveInvoice(detailInv); setDetailId(null); }} style={{ ...styles.btn, background: C.green, flex: 1, justifyContent: 'center' }}><Icon name="check" size={16} /> Prihvati</button>
                            <button onClick={() => { rejectInvoice(detailInv); setDetailId(null); }} style={{ ...styles.btn, background: C.red, flex: 1, justifyContent: 'center' }}><Icon name="close" size={16} /> Odbij</button>
                        </div>
                    )}
                </Modal>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <Modal title={editId ? 'Uredi račun' : (isWorker ? 'Pošalji račun' : 'Novi račun')} onClose={() => setShowForm(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }} className="u-gap-16">
                        <Field label="Broj računa"><Input value={form.invoiceNumber} onChange={e => update('invoiceNumber', e.target.value)} placeholder="R1-001" /></Field>
                        <Field label="Datum"><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
                        <Field label="Dobavljač"><Input value={form.supplier} onChange={e => update('supplier', e.target.value)} placeholder="Ime dobavljača" /></Field>
                        <Field label="Kategorija">
                            <Select value={form.category} onChange={e => update('category', e.target.value)}>
                                <option value="materijal">Materijal</option><option value="usluga">Usluga</option><option value="gorivo">Gorivo</option><option value="oprema">Oprema</option><option value="ostalo">Ostalo</option>
                            </Select>
                        </Field>
                        <Field label="Iznos"><Input type="number" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="0.00" /></Field>
                        <Field label="Valuta">
                            <Select value={form.currency} onChange={e => update('currency', e.target.value)}>
                                <option value="EUR">EUR €</option><option value="HRK">HRK kn</option>
                            </Select>
                        </Field>
                        <Field label="Projekt">
                            <Select value={form.projectId} onChange={e => update('projectId', e.target.value)}>
                                <option value="">— Bez projekta —</option>
                                {projects.filter(p => p.status === 'aktivan').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </Field>
                        {!isWorker && <Field label="Radnik">
                            <Select value={form.workerId} onChange={e => update('workerId', e.target.value)}>
                                <option value="">— Bez radnika —</option>
                                {workers.filter(w => w.active !== false).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </Select>
                        </Field>}
                    </div>
                    <Field label="Opis"><Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Opis stavki računa..." /></Field>
                    <Field label="Napomene"><Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Interne napomene..." /></Field>
                    <Field label="Priloži fotografiju/PDF računa">
                        <div className="u-flex-center u-gap-12">
                            <label style={{ ...styles.btnSmall, cursor: 'pointer' }}><Icon name="upload" size={14} /> {fileData ? fileData.name : 'Odaberi datoteku'}<input type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} /></label>
                            {fileData && <button onClick={() => setFileData(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>✕ Ukloni</button>}
                        </div>
                        {fileData && fileData.type?.startsWith('image/') && <img loading="lazy" src={fileData.data} alt="Preview" style={{ marginTop: 8, maxWidth: 200, maxHeight: 150, borderRadius: 8, border: `1px solid ${C.border}` }} />}
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
