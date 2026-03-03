import { useState } from 'react';
import { update as updateDoc } from '../../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select } from '../ui/SharedComponents';
import { C, styles, genId, fmtDate } from '../../utils/helpers';
import { STAGES, QC_CHECKLISTS, COST_CATEGORIES, STEEL_GRADES, SPEC_UNITS, PROFILE_WEIGHTS, fmtDuration } from './proizvodnja-constants';

export function ProizvodnyaDetailView({ detailOrder, actions, canManage, projects, activeWorkers, isMobile, currentUser, setDetailId }) {
    const {
        requestAdvance, openEdit, archiveOrder,
        signOffOrder, setSignOffOrder, signOffNote, setSignOffNote, signOffConfirmed, setSignOffConfirmed,
        confirmSignOff, initSigCanvas, clearSigCanvas,
        showCostForm, setShowCostForm, costForm, setCostForm, addCostItem, removeCostItem,
        handleFileUpload, removeFile,
        commentText, setCommentText, addComment, removeComment,
        handleStagePhoto, setShowForm,
    } = actions;

    const doDelete = actions.doDelete;
    const openEditWrapped = (o) => { openEdit(o); setDetailId(null); };

    const [detailTab, setDetailTab] = useState('info');
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
        <>
            <div>
                <button onClick={() => { setDetailId(null); setDetailTab('info'); setSignOffOrder(null); setShowForm(false); }} style={{ ...styles.btnSecondary, marginBottom: 20, display: 'inline-flex' }}><Icon name="back" size={16} /> Natrag</button>

                {/* Header card */}
                <div style={styles.card} className="u-mb-20">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 4 }}>{detailOrder.orderNumber}</div>
                            <div className="u-fs-22 u-fw-800 u-color-text">{detailOrder.name}</div>
                            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>🏢 {detailOrder.client || '—'} {detailOrder.quantity && `• ${detailOrder.quantity} ${detailOrder.unit}`}</div>
                            {detailOrder.projectId && (() => { const proj = projects.find(p => p.id === detailOrder.projectId); return proj ? <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>📁 Projekt: {proj.name}</div> : null; })()}
                        </div>
                        <div className="u-flex-center u-gap-8">
                            {detailOrder.priority === 'hitno' && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 6 }}>🔴 HITNO</span>}
                            {detailOrder.priority === 'visok' && <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 6 }}>🟡 Visok</span>}
                            <span style={{ fontSize: 12, fontWeight: 700, color: STAGES[stageIdx]?.color, background: `${STAGES[stageIdx]?.color}18`, padding: '4px 12px', borderRadius: 8 }}>
                                {STAGES[stageIdx]?.emoji} {STAGES[stageIdx]?.label}
                            </span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="u-mb-16">
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
                            <div className="u-stat-label">Količina</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{detailOrder.quantity} {detailOrder.unit}</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)' }}>
                            <div className="u-stat-label">Ukupni trošak</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{(detailOrder.totalCost || 0).toFixed(2)}€</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: daysLeft !== null && daysLeft < 0 ? 'rgba(239,68,68,0.08)' : daysLeft !== null && daysLeft <= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)' }}>
                            <div className="u-stat-label">Rok isporuke</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: daysLeft !== null && daysLeft < 0 ? '#EF4444' : daysLeft !== null && daysLeft <= 3 ? '#F59E0B' : C.green }}>
                                {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d kasni` : daysLeft === 0 ? 'DANAS' : `${daysLeft}d`) : '—'}
                            </div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(29,78,216,0.08)' }}>
                            <div className="u-stat-label">Stavke troška</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{costItems.length}</div>
                        </div>
                    </div>

                    {/* Actions */}
                    {canManage && detailOrder.stage !== 'zavrseno' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                            <button onClick={() => requestAdvance(detailOrder)} style={{ ...styles.btn, fontSize: 13 }}>
                                ⏭️ {STAGES[stageIdx + 1] ? `Pomakni u: ${STAGES[stageIdx + 1].label}` : 'Završi'}
                            </button>
                            <button onClick={() => openEditWrapped(detailOrder)} style={styles.btnSecondary}><Icon name="edit" size={14} /> Uredi</button>
                            <button onClick={() => doDelete(detailOrder.id)} style={{ ...styles.btnDanger, fontSize: 13 }}><Icon name="trash" size={14} /> Obriši</button>
                        </div>
                    )}
                    {canManage && detailOrder.stage === 'zavrseno' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                            <button onClick={() => archiveOrder(detailOrder)} style={{ ...styles.btnSecondary, fontSize: 13 }}>📦 Arhiviraj</button>
                            <button onClick={() => openEditWrapped(detailOrder)} style={styles.btnSecondary}><Icon name="edit" size={14} /> Uredi</button>
                            <button onClick={() => doDelete(detailOrder.id)} style={{ ...styles.btnDanger, fontSize: 13 }}><Icon name="trash" size={14} /> Obriši</button>
                        </div>
                    )}
                    {/* Export buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: canManage ? 8 : 16, flexWrap: 'wrap' }}>
                        <button onClick={() => {
                            const o = detailOrder;
                            const specs = o.specifications || { materials: [] };
                            const stg = STAGES.find(s => s.id === o.stage);
                            const proj = o.projectId ? projects.find(p => p.id === o.projectId)?.name : null;
                            let matRows = (specs.materials || []).map(m => {
                                const autoW = m.profile && m.length && PROFILE_WEIGHTS[m.profile] ? ` (≈${(PROFILE_WEIGHTS[m.profile] * (parseFloat(m.length) / 1000)).toFixed(1)}kg)` : '';
                                return `<tr><td>${m.name}</td><td>${m.profile}</td><td>${m.quantity} ${m.unit}</td><td>${m.length || '—'}mm</td><td>${m.thickness || '—'}mm</td><td>${m.steelGrade}${autoW}</td></tr>`;
                            }).join('');
                            let costRows = (o.costItems || []).map(c => `<tr><td>${c.description}</td><td style="text-align:right">${(c.total || 0).toFixed(2)}€</td></tr>`).join('');
                            let taskRows = (o.subtasks || []).map(t => `<tr><td>${t.status === 'gotovo' ? '✅' : '⬜'}</td><td>${t.title}</td><td>${t.assignedTo || '—'}</td></tr>`).join('');
                            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${o.orderNumber}</title>
                            <style>body{font-family:system-ui,sans-serif;padding:30px;color:#1a1a1a;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd}.meta{color:#666;font-size:12px;margin:4px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:6px 10px;border:1px solid #ddd;text-align:left;font-size:11px}th{background:#f5f5f5;font-weight:700}.total{font-size:16px;font-weight:800;text-align:right;margin:8px 0}@media print{body{padding:15px}}</style></head><body>
                            <h1>${o.orderNumber} — ${o.name}</h1>
                            <div class="meta">🏢 Klijent: ${o.client || '—'} | Faza: ${stg?.emoji || ''} ${stg?.label || o.stage} | Prioritet: ${o.priority}</div>
                            <div class="meta">📦 Količina: ${o.quantity} ${o.unit} | 📅 Rok: ${o.deadline || '—'}${proj ? ` | 📁 Projekt: ${proj}` : ''}</div>
                            ${o.notes ? `<div class="meta">📝 ${o.notes}</div>` : ''}
                            <h2>🧱 Materijali</h2>
                            ${matRows ? `<table><thead><tr><th>Naziv</th><th>Profil</th><th>Kol.</th><th>Dimenzije</th><th>Debljina</th><th>Čelik</th></tr></thead><tbody>${matRows}</tbody></table>` : '<div>Nema materijala</div>'}
                            <h2>🧾 Troškovnik</h2>
                            ${costRows ? `<table><thead><tr><th>Opis</th><th style="text-align:right">Iznos</th></tr></thead><tbody>${costRows}</tbody></table>` : '<div>Nema troškova</div>'}
                            <div class="total">UKUPNO: ${(o.totalCost || 0).toFixed(2)}€</div>
                            ${taskRows ? `<h2>☑️ Zadaci</h2><table><thead><tr><th>✔</th><th>Zadatak</th><th>Radnik</th></tr></thead><tbody>${taskRows}</tbody></table>` : ''}
                            <div style="margin-top:30px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:8px">Generirano: ${new Date().toLocaleString('hr')} | ViDiSef Proizvodnja</div>
                            </body></html>`;
                            const w = window.open('', '_blank'); w?.document.write(html); w?.document.close(); setTimeout(() => w?.print(), 300);
                        }} style={{ ...styles.btnSecondary, fontSize: 12 }}>📄 PDF</button>
                        <button onClick={() => {
                            const o = detailOrder;
                            const specs = o.specifications || { materials: [] };
                            let csv = 'Tip,Naziv,Profil,Količina,Jedinica,Dimenzije(mm),Debljina(mm),Čelik,Cijena(€)\n';
                            (specs.materials || []).forEach(m => csv += `Materijal,"${m.name}","${m.profile}",${m.quantity},${m.unit},${m.length || ''},${m.thickness || ''},${m.steelGrade},\n`);
                            (o.costItems || []).forEach(c => csv += `Trošak,"${c.description}",,${c.quantity || 1},,,,,${c.total || 0}\n`);
                            (o.subtasks || []).forEach(t => csv += `Zadatak,"${t.title}",${t.status},,,,,,,${t.assignedTo || ''}\n`);
                            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${o.orderNumber}.csv`; a.click();
                        }} style={{ ...styles.btnSecondary, fontSize: 12 }}>📊 CSV</button>
                    </div>
                </div>

                {/* Detail tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
                    {[{ id: 'info', label: '📋 Info' }, { id: 'aktivnost', label: `💬 Aktivnost${(detailOrder.comments || []).length > 0 ? ` (${(detailOrder.comments || []).length})` : ''}` }, { id: 'zadaci', label: `☑️ Zadaci${(detailOrder.subtasks || []).length > 0 ? ` (${(detailOrder.subtasks || []).filter(t => t.status === 'gotovo').length}/${(detailOrder.subtasks || []).length})` : ''}` }, { id: 'specifikacije', label: '📐 Specifikacije' }, { id: 'troskovnik', label: '🧾 Troškovnik' }, { id: 'dokumenti', label: '📎 Dokumenti' }, { id: 'povijest', label: '🕐 Povijest' }].map(t => (
                        <button key={t.id} onClick={() => setDetailTab(t.id)} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${detailTab === t.id ? C.accent : C.border}`, background: detailTab === t.id ? C.accentLight : 'transparent', color: detailTab === t.id ? C.accent : C.textMuted, fontWeight: detailTab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Info tab */}
                {detailTab === 'info' && (
                    <div style={styles.card} className="u-mb-20">
                        {detailOrder.description && <div style={{ padding: '12px 16px', borderRadius: 8, background: C.bgElevated, fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 12 }}>{detailOrder.description}</div>}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                            <div><span className="u-text-muted">📅 Kreiran:</span> <strong>{fmtDate(detailOrder.createdAt)}</strong></div>
                            <div><span className="u-text-muted">📅 Rok:</span> <strong>{fmtDate(detailOrder.deadline) || '—'}</strong></div>
                            <div><span className="u-text-muted">👤 Kreirao:</span> <strong>{detailOrder.createdBy || '—'}</strong></div>
                            <div><span className="u-text-muted">📋 Broj:</span> <strong>{detailOrder.orderNumber}</strong></div>
                        </div>
                        {detailOrder.notes && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', fontSize: 13, color: '#D97706' }}>📝 {detailOrder.notes}</div>}

                        {/* Stage timeline */}
                        <div className="u-mt-20">
                            <div className="u-section-title u-mb-12">Tok narudžbe</div>
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
                                            {record && <div className="u-fs-11 u-text-muted">
                                                {record.enteredAt && `Započeto: ${fmtDate(record.enteredAt)}`}
                                                {record.completedAt && ` → Završeno: ${fmtDate(record.completedAt)}`}
                                                {record.signedBy && <span style={{ color: '#10B981', fontWeight: 600 }}>{' '}✍️ {record.signedBy}</span>}
                                            </div>}
                                            {record?.signNote && <div style={{ fontSize: 11, color: C.accent, fontStyle: 'italic', marginTop: 2 }}>📝 {record.signNote}</div>}
                                            {/* Time tracking */}
                                            {record?.enteredAt && record?.completedAt && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>⏱️ {fmtDuration(record.enteredAt, record.completedAt)}</div>}
                                            {/* QC Checklist */}
                                            {canManage && isCurrent && QC_CHECKLISTS[s.id] && (() => {
                                                const cl = record?.checklist || QC_CHECKLISTS[s.id].map((item, idx) => ({ id: idx, label: item, checked: false }));
                                                const done = cl.filter(c => c.checked).length;
                                                const toggleCheck = async (checkIdx) => {
                                                    const stages = [...(detailOrder.stages || [])];
                                                    const stg = stages.find(st => st.stage === s.id && !st.completedAt) || stages.findLast(st => st.stage === s.id);
                                                    if (!stg) return;
                                                    const newCl = (stg.checklist || QC_CHECKLISTS[s.id].map((item, i) => ({ id: i, label: item, checked: false }))).map(c => c.id === checkIdx ? { ...c, checked: !c.checked } : c);
                                                    stg.checklist = newCl;
                                                    await updateDoc('production', detailOrder.id, { stages });
                                                };
                                                return (
                                                    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.04)', border: `1px solid rgba(16,185,129,0.12)` }}>
                                                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Kontrolna lista</span>
                                                            <span style={{ color: done === cl.length ? '#10B981' : C.accent }}>{done}/{cl.length}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--border)', marginBottom: 6 }}><div style={{ width: `${(done / cl.length) * 100}%`, height: 3, borderRadius: 2, background: '#10B981', transition: 'width 0.3s' }} /></div>
                                                        {cl.map(c => (
                                                            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: c.checked ? '#10B981' : C.textDim, cursor: 'pointer', padding: '2px 0', textDecoration: c.checked ? 'line-through' : 'none' }}>
                                                                <input type="checkbox" checked={c.checked} onChange={() => toggleCheck(c.id)} style={{ width: 14, height: 14, accentColor: '#10B981' }} />
                                                                {c.label}
                                                            </label>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                            {/* Completed stage checklist (read-only) */}
                                            {!isCurrent && record?.checklist && (() => {
                                                const done = record.checklist.filter(c => c.checked).length;
                                                return <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>✅ {done}/{record.checklist.length} kontrolnih točaka</div>;
                                            })()}
                                            {/* Stage photos */}
                                            {(record?.photos || []).length > 0 && (
                                                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                                    {record.photos.map(p => (
                                                        <img loading="lazy" key={p.id} src={p.data} alt="" onClick={() => { const w = window.open(); w?.document.write(`<img loading="lazy" src="${p.data}" style="max-width:100%;height:auto">`); }} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${C.border}` }} />
                                                    ))}
                                                </div>
                                            )}
                                            {/* Add photo button for current stage */}
                                            {canManage && isCurrent && <button onClick={() => handleStagePhoto(detailOrder.id, s.id)} style={{ ...styles.btnSmall, marginTop: 6, fontSize: 10 }}>📸 Dodaj foto</button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Zadaci (Sub-tasks) tab */}
                {detailTab === 'zadaci' && (() => {
                    const subtasks = detailOrder.subtasks || [];
                    const addSubtask = async () => {
                        const title = prompt('Naziv zadatka:');
                        if (!title?.trim()) return;
                        const newTask = { id: genId(), title: title.trim(), status: 'otvoreno', assignedTo: '', dueDate: '', createdAt: new Date().toISOString(), createdBy: currentUser?.name };
                        await updateDoc('production', detailOrder.id, { subtasks: [...subtasks, newTask] });
                    };
                    const toggleSubtask = async (taskId) => {
                        const updated = subtasks.map(t => t.id === taskId ? { ...t, status: t.status === 'gotovo' ? 'otvoreno' : 'gotovo', completedAt: t.status !== 'gotovo' ? new Date().toISOString() : null } : t);
                        await updateDoc('production', detailOrder.id, { subtasks: updated });
                    };
                    const removeSubtask = async (taskId) => {
                        await updateDoc('production', detailOrder.id, { subtasks: subtasks.filter(t => t.id !== taskId) });
                    };
                    const updateSubtask = async (taskId, key, val) => {
                        const updated = subtasks.map(t => t.id === taskId ? { ...t, [key]: val } : t);
                        await updateDoc('production', detailOrder.id, { subtasks: updated });
                    };
                    const done = subtasks.filter(t => t.status === 'gotovo').length;
                    return (
                        <div style={styles.card} className="u-mb-20">
                            <div className="u-flex-between u-mb-16">
                                <div className="u-section-title">☑️ Radni zadaci ({done}/{subtasks.length})</div>
                                {canManage && <button onClick={addSubtask} style={styles.btnSmall}><Icon name="plus" size={12} /> Novi zadatak</button>}
                            </div>
                            {subtasks.length > 0 && <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 16 }}><div style={{ width: `${subtasks.length > 0 ? (done / subtasks.length) * 100 : 0}%`, height: 4, borderRadius: 2, background: '#10B981', transition: 'width 0.3s' }} /></div>}
                            {subtasks.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Nema zadataka — dodajte radne naloge</div> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {subtasks.map(t => (
                                        <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: t.status === 'gotovo' ? 'rgba(16,185,129,0.04)' : 'var(--bg)', border: `1px solid ${t.status === 'gotovo' ? 'rgba(16,185,129,0.2)' : C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input type="checkbox" checked={t.status === 'gotovo'} onChange={() => toggleSubtask(t.id)} style={{ width: 18, height: 18, accentColor: '#10B981', flexShrink: 0 }} />
                                            <div className="u-flex-1">
                                                <div style={{ fontSize: 13, fontWeight: 600, color: t.status === 'gotovo' ? '#10B981' : C.text, textDecoration: t.status === 'gotovo' ? 'line-through' : 'none' }}>{t.title}</div>
                                                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: C.textMuted, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {canManage ? (
                                                        <>
                                                            <Select value={t.assignedTo || ''} onChange={e => updateSubtask(t.id, 'assignedTo', e.target.value)} style={{ fontSize: 10, padding: '2px 4px', width: 100 }}>
                                                                <option value="">— Radnik</option>
                                                                {activeWorkers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                                            </Select>
                                                            <Input type="date" value={t.dueDate || ''} onChange={e => updateSubtask(t.id, 'dueDate', e.target.value)} style={{ fontSize: 10, padding: '2px 4px', width: 110 }} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            {t.assignedTo && <span>👤 {t.assignedTo}</span>}
                                                            {t.dueDate && <span>📅 {fmtDate(t.dueDate)}</span>}
                                                        </>
                                                    )}
                                                    <span>🕒 {fmtDate(t.createdAt)}</span>
                                                </div>
                                            </div>
                                            {canManage && <button onClick={() => removeSubtask(t.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>✕</button>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Specifikacije tab */}
                {detailTab === 'specifikacije' && (() => {
                    const specs = detailOrder.specifications || { materials: [], technicalNotes: '' };
                    const addSpecMaterial = async () => {
                        const newMat = { id: genId(), name: '', profile: '', quantity: 0, unit: 'kg', steelGrade: 'S235', length: '', thickness: '', notes: '' };
                        const updated = { ...specs, materials: [...specs.materials, newMat] };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const removeSpecMaterial = async (matId) => {
                        const updated = { ...specs, materials: specs.materials.filter(m => m.id !== matId) };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const updateSpecMaterial = async (matId, key, val) => {
                        const updated = { ...specs, materials: specs.materials.map(m => m.id === matId ? { ...m, [key]: val } : m) };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const addSpecDim = async () => {
                        const newDim = { id: genId(), label: '', value: '', unit: 'm' };
                        const updated = { ...specs, dimensions: [...specs.dimensions, newDim] };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const removeSpecDim = async (dimId) => {
                        const updated = { ...specs, dimensions: specs.dimensions.filter(d => d.id !== dimId) };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const updateSpecDim = async (dimId, key, val) => {
                        const updated = { ...specs, dimensions: specs.dimensions.map(d => d.id === dimId ? { ...d, [key]: val } : d) };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const updateTechNotes = async (val) => {
                        const updated = { ...specs, technicalNotes: val };
                        await updateDoc('production', detailOrder.id, { specifications: updated });
                    };
                    const totalWeight = specs.materials.reduce((s, m) => s + ((['kg', 't'].includes(m.unit)) ? (m.unit === 't' ? m.quantity * 1000 : m.quantity) : 0), 0);

                    return (
                        <div style={styles.card} className="u-mb-20">
                            {/* Summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', textAlign: 'center' }}>
                                    <div className="u-stat-label">Materijali</div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{specs.materials.length}</div>
                                </div>
                                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', textAlign: 'center' }}>
                                    <div className="u-stat-label">Ukupna težina</div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)}t` : `${totalWeight}kg`}</div>
                                </div>
                            </div>

                            {/* Materials */}
                            <div className="u-card-header">
                                <div className="u-section-title">🧱 Materijali</div>
                                {canManage && <button onClick={addSpecMaterial} style={styles.btnSmall}><Icon name="plus" size={12} /> Dodaj</button>}
                            </div>
                            {specs.materials.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Nema materijala — dodajte stavke</div> : (
                                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                                    <table aria-label="Pregled" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr><th style={styles.th}>Naziv</th><th style={styles.th}>Profil</th><th style={styles.th}>Kol.</th><th style={styles.th}>Jed.</th><th style={styles.th}>Dimenzije (mm)</th><th style={styles.th}>Debljina (mm)</th><th style={styles.th}>Čelik</th>{canManage && <th style={styles.th}></th>}</tr></thead>
                                        <tbody>
                                            {specs.materials.map(m => (
                                                <tr key={m.id}>
                                                    <td style={styles.td}>{canManage ? <Input value={m.name} onChange={e => updateSpecMaterial(m.id, 'name', e.target.value)} placeholder="Stup, Nosač..." style={{ fontSize: 12, padding: '4px 8px' }} /> : <span className="u-fw-600">{m.name}</span>}</td>
                                                    <td style={styles.td}>{canManage ? <Input value={m.profile} onChange={e => updateSpecMaterial(m.id, 'profile', e.target.value)} placeholder="HEB 300" style={{ fontSize: 12, padding: '4px 8px' }} /> : m.profile}</td>
                                                    <td style={styles.td}>{canManage ? <Input type="number" value={m.quantity} onChange={e => updateSpecMaterial(m.id, 'quantity', parseFloat(e.target.value) || 0)} style={{ fontSize: 12, padding: '4px 8px', width: 65 }} /> : m.quantity}</td>
                                                    <td style={styles.td}>{canManage ? <Select value={m.unit} onChange={e => updateSpecMaterial(m.id, 'unit', e.target.value)} style={{ fontSize: 11, padding: '4px' }}>{SPEC_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</Select> : m.unit}</td>
                                                    <td style={styles.td}>
                                                        {canManage ? <Input value={m.length || ''} onChange={e => updateSpecMaterial(m.id, 'length', e.target.value)} placeholder="6000" style={{ fontSize: 12, padding: '4px 8px', width: 70 }} /> : (m.length || '—')}
                                                        {m.profile && m.length && PROFILE_WEIGHTS[m.profile] && <div style={{ fontSize: 9, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>≈ {(PROFILE_WEIGHTS[m.profile] * (parseFloat(m.length) / 1000)).toFixed(1)} kg</div>}
                                                    </td>
                                                    <td style={styles.td}>{canManage ? <Input value={m.thickness || ''} onChange={e => updateSpecMaterial(m.id, 'thickness', e.target.value)} placeholder="10" style={{ fontSize: 12, padding: '4px 8px', width: 60 }} /> : (m.thickness || '—')}</td>
                                                    <td style={styles.td}>{canManage ? <Select value={m.steelGrade} onChange={e => updateSpecMaterial(m.id, 'steelGrade', e.target.value)} style={{ fontSize: 11, padding: '4px' }}>{STEEL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}</Select> : <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>{m.steelGrade}</span>}</td>
                                                    {canManage && <td style={styles.td}><button onClick={() => removeSpecMaterial(m.id)} style={{ ...styles.btnDanger, padding: '4px 8px' }}><Icon name="trash" size={10} /></button></td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Weight Summary */}
                            {(() => {
                                const weightItems = (specs.materials || []).filter(m => m.profile && m.length && PROFILE_WEIGHTS[m.profile]).map(m => ({
                                    name: m.name, profile: m.profile, length: parseFloat(m.length),
                                    weight: PROFILE_WEIGHTS[m.profile] * (parseFloat(m.length) / 1000) * (m.quantity || 1),
                                    qty: m.quantity || 1
                                }));
                                const totalKg = weightItems.reduce((s, w) => s + w.weight, 0);
                                if (weightItems.length === 0) return null;
                                return (
                                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>⚖️ Ukupna težina</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED' }}>{totalKg >= 1000 ? `${(totalKg / 1000).toFixed(2)} t` : `${totalKg.toFixed(1)} kg`}</div>
                                        </div>
                                        {weightItems.map((w, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textDim, padding: '2px 0' }}>
                                                <span>{w.name} ({w.profile} × {w.length}mm{w.qty > 1 ? ` × ${w.qty}` : ''})</span>
                                                <span style={{ fontWeight: 600, color: '#7C3AED' }}>{w.weight.toFixed(1)} kg</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Technical Notes */}
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>📝 Tehničke napomene</div>
                            {canManage ? (
                                <Textarea value={specs.technicalNotes || ''} onChange={e => updateTechNotes(e.target.value)} placeholder="Tehničke specifikacije, napomene, zahtjevi kvalitete, norma..." rows={4} />
                            ) : (
                                <div style={{ padding: '12px 16px', borderRadius: 8, background: C.bgElevated, fontSize: 13, color: C.textDim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{specs.technicalNotes || 'Nema napomena'}</div>
                            )}
                        </div>
                    );
                })()}

                {/* Troškovnik tab */}
                {detailTab === 'troskovnik' && (
                    <div style={styles.card} className="u-mb-20">
                        <div className="u-flex-between u-mb-16">
                            <div className="u-section-title">🧾 Troškovnik ({costItems.length} stavki)</div>
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
                        {/* Auto material weights from specs */}
                        {(() => {
                            const specs = detailOrder.specifications || { materials: [] };
                            const autoItems = (specs.materials || []).filter(m => m.profile && m.length && PROFILE_WEIGHTS[m.profile]).map(m => ({
                                name: m.name, profile: m.profile,
                                weight: PROFILE_WEIGHTS[m.profile] * (parseFloat(m.length) / 1000) * (m.quantity || 1),
                                qty: m.quantity || 1, unit: m.unit
                            }));
                            if (autoItems.length === 0) return null;
                            return (
                                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.04)', border: '1px dashed rgba(124,58,237,0.2)', marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 8 }}>📐 Materijali iz specifikacija (auto-izračun)</div>
                                    {autoItems.map((a, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textDim, padding: '3px 0', borderBottom: i < autoItems.length - 1 ? `1px solid ${C.border}44` : 'none' }}>
                                            <span>{a.name} — {a.profile}{a.qty > 1 ? ` × ${a.qty}` : ''}</span>
                                            <span style={{ fontWeight: 700, color: '#7C3AED' }}>{a.weight.toFixed(1)} kg</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: '#7C3AED', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(124,58,237,0.2)' }}>
                                        <span>Ukupno materijal</span>
                                        <span>{autoItems.reduce((s, a) => s + a.weight, 0).toFixed(1)} kg</span>
                                    </div>
                                </div>
                            );
                        })()}
                        {costItems.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Nema stavki troškova</div> : (
                            <div className="u-overflow-x">
                                <table aria-label="Pregled" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr><th style={styles.th}>Stavka</th><th style={styles.th}>Kat.</th><th style={styles.th}>Kol.</th><th style={styles.th}>Cijena</th><th style={styles.th}>Ukupno</th>{canManage && <th style={styles.th}></th>}</tr></thead>
                                    <tbody>
                                        {costItems.map(c => (
                                            <tr key={c.id}>
                                                <td style={styles.td}><span className="u-fw-600">{c.name}</span>{c.notes && <div className="u-stat-label">{c.notes}</div>}</td>
                                                <td style={styles.td}>{COST_CATEGORIES.find(cat => cat.value === c.category)?.label || c.category}</td>
                                                <td style={styles.td}>{c.quantity}</td>
                                                <td style={styles.td}>{(c.unitPrice || 0).toFixed(2)}€</td>
                                                <td style={{ ...styles.td, fontWeight: 700, color: C.accent }}>{(c.total || 0).toFixed(2)}€</td>
                                                {canManage && <td style={styles.td}><button onClick={() => removeCostItem(detailOrder, c.id)} style={{ ...styles.btnDanger, padding: '4px 8px' }}><Icon name="trash" size={10} /></button></td>}
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
                                <div className="u-flex-end u-mt-16">
                                    <button onClick={() => setShowCostForm(false)} style={styles.btnSecondary}>Odustani</button>
                                    <button onClick={() => addCostItem(detailOrder)} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                                </div>
                            </Modal>
                        )}
                    </div>
                )}

                {/* Dokumenti tab */}
                {detailTab === 'dokumenti' && (
                    <div style={styles.card} className="u-mb-20">
                        <div className="u-flex-between u-mb-16">
                            <div className="u-section-title">📎 Dokumenti ({files.length})</div>
                            {canManage && (
                                <label style={{ ...styles.btnSmall, cursor: 'pointer', display: 'inline-flex' }}>
                                    <Icon name="upload" size={12} /> Upload
                                    <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={e => handleFileUpload(e, detailOrder)} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>
                        {files.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 30 }}>Nema dokumenata</div> : (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                                {files.map(f => (
                                    <div key={f.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                                        {f.type?.startsWith('image/') ? (
                                            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(128,128,128,0.06)' }} onClick={() => { const w = window.open(); w.document.write(`<img loading="lazy" src="${f.data}" style="max-width:100%;height:auto">`); }}>
                                                <img loading="lazy" src={f.data} alt={f.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                                            </div>
                                        ) : (
                                            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.06)' }}>
                                                <div className="u-text-center"><Icon name="file" size={28} /><div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{f.type || 'File'}</div></div>
                                            </div>
                                        )}
                                        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div><div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{f.name}</div><div style={{ fontSize: 9, color: C.textMuted }}>{f.uploadedBy}</div></div>
                                            {canManage && <button onClick={() => removeFile(detailOrder, f.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>✕</button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Povijest tab */}
                {detailTab === 'povijest' && (
                    <div style={styles.card} className="u-mb-20">
                        <div className="u-section-title u-mb-12">🕐 Povijest promjena</div>
                        {stageHistory.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13 }}>Nema zapisa</div> : (
                            <div>
                                {[...stageHistory].reverse().map((h, i) => {
                                    const stage = STAGES.find(s => s.id === h.stage);
                                    return (
                                        <div key={i} style={{ padding: '10px 0', borderBottom: i < stageHistory.length - 1 ? `1px solid ${C.border}7A` : 'none', display: 'flex', gap: 12 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage?.color || C.accent, marginTop: 6, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{stage?.emoji} {stage?.label}</div>
                                                <div className="u-fs-11 u-text-muted">
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

            {/* Potpis faze modal — MUST be inside detail return block */}
            {signOffOrder && (() => {
                const nextIdx = STAGES.findIndex(s => s.id === signOffOrder.stage) + 1;
                const nextStage = STAGES[nextIdx];
                return (
                    <Modal title={`Potpis faze: ${STAGES.find(s => s.id === signOffOrder.stage)?.label || ''}`} onClose={() => setSignOffOrder(null)}>
                        <div style={{ padding: 16, borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Narudžba</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{signOffOrder.orderNumber} — {signOffOrder.name}</div>
                            {nextStage && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Sljedeća faza: <strong style={{ color: nextStage.color }}>{nextStage.emoji} {nextStage.label}</strong></div>}
                        </div>
                        <div className="u-mb-12">
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Potpisuje</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, padding: '10px 14px', borderRadius: 8, background: C.bgElevated }}>{currentUser?.name || 'Nepoznat'}</div>
                        </div>
                        <Field label="Kontrolna bilješka (opcionalno)"><Textarea value={signOffNote} onChange={e => setSignOffNote(e.target.value)} placeholder="Napomena o fazi, kvaliteta, status kontrole..." rows={2} /></Field>
                        <div className="u-mb-12">
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>✍️ Potpis</div>
                            <div style={{ position: 'relative', borderRadius: 10, border: `1.5px solid ${C.border}`, overflow: 'hidden', background: '#fff' }}>
                                <canvas ref={initSigCanvas} width={380} height={120} style={{ width: '100%', height: 120, touchAction: 'none', cursor: 'crosshair' }} />
                                <button onClick={clearSigCanvas} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: C.textMuted, cursor: 'pointer' }}>Očisti</button>
                            </div>
                            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Potpišite se prstom ili mišem</div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${signOffConfirmed ? '#10B981' : C.border}`, background: signOffConfirmed ? 'rgba(16,185,129,0.06)' : 'transparent', transition: 'all 0.2s' }}>
                            <input type="checkbox" checked={signOffConfirmed} onChange={e => setSignOffConfirmed(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#10B981' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: signOffConfirmed ? '#10B981' : C.text }}>Potvrđujem da je faza završena i kontrolirana</span>
                        </label>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                            <button onClick={() => setSignOffOrder(null)} style={styles.btnSecondary}>Odustani</button>
                            <button onClick={confirmSignOff} disabled={!signOffConfirmed} style={{ ...styles.btn, opacity: signOffConfirmed ? 1 : 0.4, fontSize: 14, padding: '10px 24px' }}>✅ Potpiši i pomakni</button>
                        </div>
                    </Modal>
                );
            })()}
        </>
    );
}
