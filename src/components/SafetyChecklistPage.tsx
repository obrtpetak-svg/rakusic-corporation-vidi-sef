import { useState, useMemo, useRef, useEffect } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, Pagination, usePagination, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate } from '../utils/helpers';

// ── Signature Canvas Component ──
function SignatureCanvas({ onSave, existingSignature }) {
    const canvasRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [hasContent, setHasContent] = useState(!!existingSignature);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2); ctx.lineWidth = 2; ctx.strokeStyle = '#1E293B'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (existingSignature) {
            const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
            img.src = existingSignature;
        }
    }, []);

    const getPos = (e) => {
        const canvas = canvasRef.current, rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const start = (e) => { e.preventDefault(); setDrawing(true); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const draw = (e) => { if (!drawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasContent(true); };
    const stop = () => setDrawing(false);
    const clear = () => {
        const canvas = canvasRef.current, ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); setHasContent(false);
    };
    const save = () => { if (!hasContent) return; onSave(canvasRef.current.toDataURL('image/png', 0.5)); };

    return (
        <div>
            <canvas ref={canvasRef} onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
                onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
                style={{ width: '100%', height: 120, border: `2px dashed ${C.border}`, borderRadius: 12, cursor: 'crosshair', touchAction: 'none', background: C.bgElevated }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={clear} style={{ ...styles.btnSmall, fontSize: 11 }}>🗑️ Obriši</button>
                <button onClick={save} disabled={!hasContent} style={{ ...styles.btnSmall, fontSize: 11, background: hasContent ? C.accent : C.border, color: '#fff' }}>✓ Potvrdi potpis</button>
            </div>
        </div>
    );
}

// ── Category presets ──
const CATEGORY_PRESETS = {
    ppe: { label: '🦺 Osobna zaštitna oprema', items: ['Kaciga', 'Zaštitne naočale', 'Zaštitne rukavice', 'Sigurnosne cipele', 'Reflektirajući prsluk', 'Zaštita za sluh'] },
    site: { label: '🏗️ Sigurnost gradilišta', items: ['Ograda postavljena', 'Putevi označeni', 'Rasvjeta adekvatna', 'Znakovi upozorenja', 'Prva pomoć dostupna', 'Protupožarni aparat'] },
    equipment: { label: '🔧 Oprema i alati', items: ['Alati ispravni', 'Električni kablovi neoštećeni', 'Ljestve sigurne', 'Skela stabilna', 'Dizalica pregledana', 'Strojevi servisirani'] },
    excavation: { label: '⛏️ Iskop i temeljenje', items: ['Bočne strane osigurane', 'Pristupne ljestve', 'Podzemne instalacije označene', 'Odvodnja vode', 'Provjera tla'] },
    electrical: { label: '⚡ Električna sigurnost', items: ['Isključeno napajanje', 'Zaštita od udara', 'Kablovi neprekinuti', 'Uzemljenje ispravno', 'FID sklopka testirana'] },
    heights: { label: '🧗 Rad na visini', items: ['Zaštitni pojas', 'Sidra provjerena', 'Podna zaštita', 'Ljestve učvršćene', 'Vjetar prihvatljiv', 'Pristup siguran'] },
};

export function SafetyChecklistPage({ workerFilterId, leaderProjectIds }) {
    const confirm = useConfirm();
    const { safetyTemplates, safetyChecklists, projects, workers, currentUser, addAuditLog, loadSafetyData } = useApp();
    const isMobile = useIsMobile();
    const isWorker = !!workerFilterId;
    const isLeaderView = !!leaderProjectIds?.length;
    const isAdmin = currentUser?.role === 'admin';

    // C-4: Load safety data on mount (lazy)
    useEffect(() => { loadSafetyData(); }, [loadSafetyData]);

    const [tab, setTab] = useState(isAdmin ? 'templates' : 'fill');
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editTemplateId, setEditTemplateId] = useState(null);
    const [showFillModal, setShowFillModal] = useState(false);
    const [fillTemplateId, setFillTemplateId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [filters, setFilters] = useState({ project: '', dateFrom: '', dateTo: '', status: 'all', search: '' });

    // ── Template form ──
    const blankTemplate = () => ({ name: '', description: '', category: '', projectId: '', items: [{ text: '', category: 'general' }], requireSignature: true, requireProject: true });
    const [tplForm, setTplForm] = useState(blankTemplate());

    // ── Fill form ──
    const [fillForm, setFillForm] = useState({ projectId: '', answers: {}, notes: '', signature: null });

    const activeProjects = useMemo(() => {
        if (isLeaderView) return projects.filter(p => leaderProjectIds.includes(p.id));
        if (isWorker) return projects.filter(p => (p.workers || []).includes(workerFilterId) && p.status === 'aktivan');
        return projects.filter(p => p.status === 'aktivan');
    }, [projects, isLeaderView, leaderProjectIds, isWorker, workerFilterId]);

    // ── Filtered checklists ──
    const filtered = useMemo(() => {
        let list = safetyChecklists || [];
        if (isWorker) list = list.filter(c => c.filledById === workerFilterId);
        if (isLeaderView) list = list.filter(c => leaderProjectIds.includes(c.projectId));
        if (filters.project) list = list.filter(c => c.projectId === filters.project);
        if (filters.status !== 'all') list = list.filter(c => c.status === filters.status);
        if (filters.dateFrom) list = list.filter(c => c.date >= filters.dateFrom);
        if (filters.dateTo) list = list.filter(c => c.date <= filters.dateTo);
        if (filters.search) { const s = filters.search.toLowerCase(); list = list.filter(c => (c.templateName || '').toLowerCase().includes(s) || (c.notes || '').toLowerCase().includes(s)); }
        return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [safetyChecklists, filters, workerFilterId, leaderProjectIds]);

    const pg = usePagination(filtered.length, [filters]);

    // ── Template CRUD ──
    const openAddTemplate = () => { setTplForm(blankTemplate()); setEditTemplateId(null); setShowTemplateModal(true); };
    const openEditTemplate = (tpl) => { setTplForm({ name: tpl.name, description: tpl.description || '', category: tpl.category || '', projectId: tpl.projectId || '', items: tpl.items || [{ text: '', category: 'general' }], requireSignature: tpl.requireSignature !== false, requireProject: tpl.requireProject !== false }); setEditTemplateId(tpl.id); setShowTemplateModal(true); };

    const addTemplateItem = () => setTplForm(f => ({ ...f, items: [...f.items, { text: '', category: 'general' }] }));
    const removeTemplateItem = (idx) => setTplForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    const updateTemplateItem = (idx, field, val) => setTplForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: val } : item) }));
    const loadPreset = (key) => { const preset = CATEGORY_PRESETS[key]; if (!preset) return; setTplForm(f => ({ ...f, items: [...f.items.filter(i => i.text), ...preset.items.map(text => ({ text, category: key }))] })); };

    const saveTemplate = async () => {
        if (!tplForm.name) return alert('Unesite naziv predloška');
        const validItems = tplForm.items.filter(i => i.text.trim());
        if (!validItems.length) return alert('Dodajte barem jednu stavku');
        if (editTemplateId) {
            await updateDoc('safetyTemplates', editTemplateId, { ...tplForm, items: validItems, updatedAt: new Date().toISOString() });
            await addAuditLog('SAFETY_TEMPLATE_UPDATED', `Predložak "${tplForm.name}" ažuriran`);
        } else {
            await addDoc('safetyTemplates', { id: genId(), ...tplForm, items: validItems, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
            await addAuditLog('SAFETY_TEMPLATE_CREATED', `Novi predložak "${tplForm.name}"`);
        }
        setShowTemplateModal(false);
    };
    const deleteTemplate = async (id) => { if (!(await confirm('Obrisati predložak?'))) return; await removeDoc('safetyTemplates', id); };

    // ── Fill Checklist ──
    const openFill = (tpl) => {
        const answers = {};
        tpl.items.forEach((item, i) => { answers[i] = { checked: null, note: '' }; }); // null = unanswered, true = OK, false = NOT OK
        setFillForm({ projectId: '', answers, notes: '', signature: null });
        setFillTemplateId(tpl.id);
        setShowFillModal(true);
    };
    const toggleAnswer = (idx, val) => setFillForm(f => ({ ...f, answers: { ...f.answers, [idx]: { ...f.answers[idx], checked: f.answers[idx]?.checked === val ? null : val } } }));
    const setAnswerNote = (idx, note) => setFillForm(f => ({ ...f, answers: { ...f.answers, [idx]: { ...f.answers[idx], note } } }));

    const saveFill = async () => {
        const tpl = (safetyTemplates || []).find(t => t.id === fillTemplateId);
        if (!tpl) return;
        if (tpl.requireProject && !fillForm.projectId) return alert('Odaberite projekt');
        const totalItems = tpl.items.length;
        const answered = Object.values(fillForm.answers).filter(a => a.checked !== null).length;
        if (answered < totalItems) return alert(`Odgovorite na sve stavke (${answered}/${totalItems})`);
        if (tpl.requireSignature && !fillForm.signature) return alert('Potpis je obvezan');

        const okCount = Object.values(fillForm.answers).filter(a => a.checked === true).length;
        const failCount = Object.values(fillForm.answers).filter(a => a.checked === false).length;
        const status = failCount === 0 ? 'passed' : failCount <= 2 ? 'warning' : 'failed';

        const doc = {
            id: genId(), templateId: tpl.id, templateName: tpl.name,
            projectId: fillForm.projectId, date: today(),
            answers: fillForm.answers, notes: fillForm.notes, signature: fillForm.signature,
            okCount, failCount, totalItems,
            status, score: Math.round((okCount / totalItems) * 100),
            filledBy: currentUser?.name, filledById: workerFilterId || currentUser?.id,
            createdAt: new Date().toISOString(),
        };
        await addDoc('safetyChecklists', doc);
        await addAuditLog('SAFETY_CHECKLIST_FILLED', `Kontrolna lista "${tpl.name}" — ${status === 'passed' ? '✅ Prošla' : status === 'warning' ? '⚠️ Upozorenje' : '❌ Pala'}`);
        setShowFillModal(false);
    };

    const detail = detailId ? (safetyChecklists || []).find(c => c.id === detailId) : null;
    const detailTpl = detail ? (safetyTemplates || []).find(t => t.id === detail.templateId) : null;

    // ── Stats ──
    const totalChecklists = filtered.length;
    const passedCount = filtered.filter(c => c.status === 'passed').length;
    const failedCount = filtered.filter(c => c.status === 'failed').length;
    const avgScore = filtered.length ? Math.round(filtered.reduce((s, c) => s + (c.score || 0), 0) / filtered.length) : 0;

    const statusBadge = (s) => ({ passed: { bg: 'rgba(16,185,129,0.1)', c: '#10B981', t: '✅ Prošla' }, warning: { bg: 'rgba(245,158,11,0.1)', c: '#F59E0B', t: '⚠️ Upozorenje' }, failed: { bg: 'rgba(239,68,68,0.1)', c: '#EF4444', t: '❌ Pala' } }[s] || { bg: '#F1F5F9', c: C.textMuted, t: s });

    // ── PDF Export ──
    const exportPDF = (checklist) => {
        const tpl = (safetyTemplates || []).find(t => t.id === checklist.templateId);
        const proj = projects.find(p => p.id === checklist.projectId);
        const html = `<html><head><title>Kontrolna lista - ${checklist.templateName}</title>
            <style>body{font-family:Arial,sans-serif;padding:20px;max-width:700px;margin:0 auto}h1{color:#1E293B;font-size:20px;border-bottom:3px solid #F97316;padding-bottom:8px}
            .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;font-size:13px}.meta-item{padding:8px 12px;background:var(--bg);border-radius:8px}
            .item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #E2E8F0}.item-status{font-size:18px;width:28px;text-align:center}
            .item-text{flex:1;font-size:13px}.score{text-align:center;margin:20px 0;font-size:48px;font-weight:800}
            .sig{border:1px solid #ddd;border-radius:8px;margin-top:16px}@media print{.no-print{display:none}}</style></head>
            <body><h1> ${checklist.templateName}</h1>
            <div class="meta"><div class="meta-item"><strong>Projekt:</strong> ${proj?.name || '—'}</div>
            <div class="meta-item"><strong>Datum:</strong> ${fmtDate(checklist.date)}</div>
            <div class="meta-item"><strong>Ispunio:</strong> ${checklist.filledBy}</div>
            <div class="meta-item"><strong>Rezultat:</strong> ${checklist.score}% (${checklist.okCount}/${checklist.totalItems})</div></div>
            <div class="score" style="color:${checklist.status === 'passed' ? '#10B981' : checklist.status === 'warning' ? '#F59E0B' : '#EF4444'}">${checklist.score}%</div>
            ${tpl ? tpl.items.map((item, i) => {
            const a = checklist.answers?.[i];
            return `<div class="item"><div class="item-status">${a?.checked === true ? '✅' : a?.checked === false ? '❌' : '➖'}</div>
                <div class="item-text">${item.text}${a?.note ? `<br><small style="color:#F59E0B">📝 ${a.note}</small>` : ''}</div></div>`;
        }).join('') : ''}
            ${checklist.notes ? `<div style="margin-top:16px;padding:10px;background:#FFF7ED;border-radius:8px"><strong>Napomene:</strong><br>${checklist.notes}</div>` : ''}
            ${checklist.signature ? `<div style="margin-top:16px"><strong>Potpis:</strong><br><img src="${checklist.signature}" class="sig" style="max-width:300px;height:auto"/></div>` : ''}
            </body></html>`;
        const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.print();
    };

    const tabs = isAdmin
        ? [{ id: 'templates', l: '📋 Predlošci' }, { id: 'fill', l: '✍️ Ispuni' }, { id: 'history', l: '📊 Povijest' }]
        : [{ id: 'fill', l: '✍️ Ispuni' }, { id: 'history', l: '📊 Povijest' }];

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}> Kontrolne liste sigurnosti</div>
                    <div style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>Predlošci, inspekcije, digitalni potpisi</div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ background: `${C.accent}18`, borderRadius: 12, padding: 12, color: C.accent }}></div>
                    <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ukupno</div><div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{totalChecklists}</div></div>
                </div>
                <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ background: 'rgba(16,185,129,0.12)', borderRadius: 12, padding: 12, color: '#10B981' }}>✅</div>
                    <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Prošle</div><div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{passedCount}</div></div>
                </div>
                <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 12, padding: 12, color: C.red }}>❌</div>
                    <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Pale</div><div style={{ fontSize: 24, fontWeight: 800, color: C.red }}>{failedCount}</div></div>
                </div>
                <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ background: 'rgba(59,130,246,0.12)', borderRadius: 12, padding: 12, color: '#3B82F6' }}>📊</div>
                    <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Prosječni skor</div><div style={{ fontSize: 24, fontWeight: 800, color: avgScore >= 80 ? '#10B981' : avgScore >= 50 ? '#F59E0B' : C.red }}>{avgScore}%</div></div>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: C.bgElevated, borderRadius: 12, padding: 4 }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                        background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? C.text : C.textMuted,
                        boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s'
                    }}>
                        {t.l}
                    </button>
                ))}
            </div>

            {/* ══════ TAB: TEMPLATES (Admin only) ══════ */}
            {tab === 'templates' && isAdmin && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={openAddTemplate} style={styles.btn}><Icon name="plus" size={14} /> Novi predložak</button>
                    </div>
                    {(safetyTemplates || []).length === 0 ? (
                        <div style={{ ...styles.card, textAlign: 'center', padding: 40, color: C.textMuted }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Nema predložaka</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Kreirajte prvi predložak kontrolne liste.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                            {(safetyTemplates || []).map(tpl => (
                                <div key={tpl.id} style={{ ...styles.card, position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tpl.name}</div>
                                            {tpl.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tpl.description}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => openEditTemplate(tpl)} style={styles.btnSmall}><Icon name="edit" size={12} /></button>
                                            <button onClick={() => deleteTemplate(tpl.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                        {tpl.projectId && <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', fontSize: 11, fontWeight: 600, color: C.accent }}>📍 {projects.find(p => p.id === tpl.projectId)?.name || '—'}</span>}
                                        <span style={{ padding: '3px 8px', borderRadius: 6, background: C.bgElevated, fontSize: 11, fontWeight: 600 }}>📝 {tpl.items?.length || 0} stavki</span>
                                        {tpl.requireSignature && <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', fontSize: 11, fontWeight: 600, color: '#6366F1' }}>✍️ Potpis</span>}
                                    </div>
                                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {(tpl.items || []).slice(0, 4).map((item, i) => (
                                            <span key={i} style={{ padding: '2px 8px', borderRadius: 4, background: C.bgElevated, fontSize: 10, color: C.textDim }}>☐ {item.text}</span>
                                        ))}
                                        {(tpl.items || []).length > 4 && <span style={{ fontSize: 10, color: C.textMuted }}>+{tpl.items.length - 4} više</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════ TAB: FILL ══════ */}
            {tab === 'fill' && (
                <div>
                    {(() => {
                        // Filter templates by project for workers/leaders
                        let visibleTemplates = safetyTemplates || [];
                        if (isWorker) {
                            const myProjectIds = projects.filter(p => (p.workers || []).includes(workerFilterId) && p.status === 'aktivan').map(p => p.id);
                            visibleTemplates = visibleTemplates.filter(t => !t.projectId || myProjectIds.includes(t.projectId));
                        } else if (isLeaderView) {
                            visibleTemplates = visibleTemplates.filter(t => !t.projectId || leaderProjectIds.includes(t.projectId));
                        }
                        return visibleTemplates.length === 0 ? (
                            <div style={{ ...styles.card, textAlign: 'center', padding: 40, color: C.textMuted }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Nema dostupnih predložaka</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>{isAdmin ? 'Kreirajte predložak u tabu "Predlošci".' : 'Nema predložaka za vaše projekte.'}</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {visibleTemplates.map(tpl => (
                                    <div key={tpl.id} onClick={() => openFill(tpl)} style={{ ...styles.card, cursor: 'pointer', transition: 'all 0.2s', border: `2px solid transparent` }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${C.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}></div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{tpl.name}</div>
                                                <div style={{ fontSize: 11, color: C.textMuted }}>
                                                    {tpl.projectId && <span style={{ color: C.accent }}>📍 {projects.find(p => p.id === tpl.projectId)?.name || '—'} • </span>}
                                                    {tpl.items?.length || 0} stavki {tpl.requireSignature ? '• ✍️ Potpis' : ''}
                                                </div>
                                            </div>
                                            <div style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>Ispuni →</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ══════ TAB: HISTORY ══════ */}
            {tab === 'history' && (
                <div>
                    {/* Filters */}
                    <div style={{ ...styles.card, marginBottom: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
                            <div><label style={styles.label}>Pretraži</label><Input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Naziv, napomene..." /></div>
                            <div><label style={styles.label}>Projekt</label><Select value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}><option value="">Svi</option>{activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
                            <div><label style={styles.label}>Status</label><Select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><option value="all">Svi</option><option value="passed">✅ Prošla</option><option value="warning">⚠️ Upozorenje</option><option value="failed">❌ Pala</option></Select></div>
                            <div><label style={styles.label}>Od</label><Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
                            <div><label style={styles.label}>Do</label><Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pg.paginate(filtered).map(cl => {
                            const proj = projects.find(p => p.id === cl.projectId);
                            const sb = statusBadge(cl.status);
                            return (
                                <div key={cl.id} style={{ ...styles.card, cursor: 'pointer', transition: 'box-shadow 0.2s' }} onClick={() => setDetailId(cl.id)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 200 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{ fontWeight: 700, fontSize: 14 }}>{cl.templateName}</span>
                                                <span style={{ padding: '2px 8px', borderRadius: 6, background: sb.bg, fontSize: 11, fontWeight: 700, color: sb.c }}>{sb.t}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, fontSize: 12, color: C.textMuted }}>
                                                <span>📅 {fmtDate(cl.date)}</span>
                                                <span>📍 {proj?.name || '—'}</span>
                                                <span>👤 {cl.filledBy}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: '50%', border: `3px solid ${cl.score >= 80 ? '#10B981' : cl.score >= 50 ? '#F59E0B' : C.red}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
                                                color: cl.score >= 80 ? '#10B981' : cl.score >= 50 ? '#F59E0B' : C.red
                                            }}>{cl.score}%</div>
                                            <button onClick={e => { e.stopPropagation(); exportPDF(cl); }} style={{ ...styles.btnSmall, fontSize: 11 }}>📄</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && <div style={{ ...styles.card, textAlign: 'center', color: C.textMuted, padding: 40 }}>Nema ispunjenih kontrolnih lista.</div>}
                        {filtered.length > 0 && <Pagination {...pg} totalItems={filtered.length} label="lista" />}
                    </div>
                </div>
            )}

            {/* ── Detail Modal ── */}
            {detail && detailTpl && (
                <Modal title={` ${detail.templateName}`} onClose={() => setDetailId(null)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div><span style={styles.label}>Datum</span><div style={{ fontWeight: 600 }}>{fmtDate(detail.date)}</div></div>
                        <div><span style={styles.label}>Projekt</span><div style={{ fontWeight: 600, color: C.accent }}>{projects.find(p => p.id === detail.projectId)?.name || '—'}</div></div>
                        <div><span style={styles.label}>Ispunio</span><div style={{ fontWeight: 600 }}>{detail.filledBy}</div></div>
                        <div><span style={styles.label}>Rezultat</span>
                            <div style={{ fontWeight: 800, fontSize: 24, color: detail.score >= 80 ? '#10B981' : detail.score >= 50 ? '#F59E0B' : C.red }}>
                                {detail.score}% <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>({detail.okCount}/{detail.totalItems})</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        {detailTpl.items.map((item, i) => {
                            const a = detail.answers?.[i];
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}7A` }}>
                                    <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{a?.checked === true ? '✅' : a?.checked === false ? '❌' : '➖'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: C.text }}>{item.text}</div>
                                        {a?.note && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>📝 {a.note}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {detail.notes && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', fontSize: 13, marginBottom: 12 }}><strong>Napomene:</strong> {detail.notes}</div>}
                    {detail.signature && <div style={{ marginBottom: 12 }}><span style={styles.label}>✍️ Potpis</span><img src={detail.signature} alt="Potpis" style={{ maxWidth: 300, height: 'auto', border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 4 }} /></div>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => exportPDF(detail)} style={styles.btnSecondary}>📄 PDF</button>
                    </div>
                </Modal>
            )}

            {/* ── Template Modal ── */}
            {showTemplateModal && (
                <Modal title={editTemplateId ? 'Uredi predložak' : 'Novi predložak'} onClose={() => setShowTemplateModal(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Field label="Naziv predloška" required><Input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Dnevna kontrola sigurnosti" /></Field>
                        <Field label="Za koji projekt" required>
                            <Select value={tplForm.projectId} onChange={e => setTplForm(f => ({ ...f, projectId: e.target.value }))}>
                                <option value="">— Svi projekti (globalno) —</option>
                                {projects.filter(p => p.status === 'aktivan').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </Field>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <Field label="Opis"><Input value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} placeholder="Kratki opis..." /></Field>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.textDim }}>
                            <input type="checkbox" checked={tplForm.requireSignature} onChange={e => setTplForm(f => ({ ...f, requireSignature: e.target.checked }))} /> ✍️ Zahtijeva potpis
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.textDim }}>
                            <input type="checkbox" checked={tplForm.requireProject} onChange={e => setTplForm(f => ({ ...f, requireProject: e.target.checked }))} /> 📍 Zahtijeva projekt
                        </label>
                    </div>

                    {/* Quick presets */}
                    <div style={{ marginTop: 16 }}>
                        <span style={styles.label}>Brzi predlošci — klikni za dodavanje stavki</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {Object.entries(CATEGORY_PRESETS).map(([key, preset]) => (
                                <button key={key} onClick={() => loadPreset(key)} style={{ ...styles.btnSmall, fontSize: 11 }}>{preset.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Items */}
                    <div style={{ marginTop: 16 }}>
                        <span style={styles.label}>Stavke kontrolne liste</span>
                        {tplForm.items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                                <span style={{ fontSize: 12, color: C.textMuted, width: 20, textAlign: 'center' }}>{i + 1}</span>
                                <Input value={item.text} onChange={e => updateTemplateItem(i, 'text', e.target.value)} placeholder={`Stavka ${i + 1}...`} style={{ flex: 1 }} />
                                <button onClick={() => removeTemplateItem(i)} style={{ ...styles.btnSmall, color: C.red, padding: '4px 8px' }}>✕</button>
                            </div>
                        ))}
                        <button onClick={addTemplateItem} style={{ ...styles.btnSmall, marginTop: 8, fontSize: 11 }}><Icon name="plus" size={12} /> Dodaj stavku</button>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => setShowTemplateModal(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={saveTemplate} style={styles.btn}><Icon name="check" size={14} /> Spremi</button>
                    </div>
                </Modal>
            )}

            {/* ── Fill Modal ── */}
            {showFillModal && fillTemplateId && (() => {
                const tpl = (safetyTemplates || []).find(t => t.id === fillTemplateId);
                if (!tpl) return null;
                const answeredCount = Object.values(fillForm.answers).filter(a => a.checked !== null).length;
                const progress = Math.round((answeredCount / tpl.items.length) * 100);
                return (
                    <Modal title={`✍️ ${tpl.name}`} onClose={() => setShowFillModal(false)} wide>
                        {/* Progress bar */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                                <span>Napredak</span><span>{answeredCount}/{tpl.items.length} ({progress}%)</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: C.bgElevated, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: progress === 100 ? '#10B981' : C.accent, transition: 'width 0.3s' }} />
                            </div>
                        </div>

                        {tpl.requireProject && (
                            <Field label="Projekt" required>
                                <Select value={fillForm.projectId} onChange={e => setFillForm(f => ({ ...f, projectId: e.target.value }))}>
                                    <option value="">— Odaberi —</option>
                                    {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </Select>
                            </Field>
                        )}

                        {/* Checklist items */}
                        <div style={{ marginTop: 12 }}>
                            {tpl.items.map((item, i) => {
                                const a = fillForm.answers[i] || {};
                                return (
                                    <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}7A` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 12, color: C.textMuted, width: 22, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                                            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.text}</div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => toggleAnswer(i, true)} style={{
                                                    width: 36, height: 36, borderRadius: 8, border: `2px solid ${a.checked === true ? '#10B981' : C.border}`,
                                                    background: a.checked === true ? 'rgba(16,185,129,0.1)' : '#fff', cursor: 'pointer', fontSize: 16,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                                }}>✓</button>
                                                <button onClick={() => toggleAnswer(i, false)} style={{
                                                    width: 36, height: 36, borderRadius: 8, border: `2px solid ${a.checked === false ? '#EF4444' : C.border}`,
                                                    background: a.checked === false ? 'rgba(239,68,68,0.1)' : '#fff', cursor: 'pointer', fontSize: 16,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                                }}>✕</button>
                                            </div>
                                        </div>
                                        {a.checked === false && (
                                            <div style={{ marginTop: 6, marginLeft: 32 }}>
                                                <Input value={a.note || ''} onChange={e => setAnswerNote(i, e.target.value)} placeholder="Napomena za nesukladnost..." style={{ fontSize: 12 }} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <Field label="Dodatne napomene">
                                <Textarea value={fillForm.notes} onChange={e => setFillForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opažanja, upute..." rows={2} />
                            </Field>
                        </div>

                        {/* Signature */}
                        {tpl.requireSignature && (
                            <div style={{ marginTop: 12 }}>
                                <span style={styles.label}>✍️ Digitalni potpis {fillForm.signature ? '✅' : '(obvezan)'}</span>
                                {fillForm.signature ? (
                                    <div style={{ marginTop: 6 }}>
                                        <img src={fillForm.signature} alt="Potpis" style={{ maxWidth: 250, height: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }} />
                                        <button onClick={() => setFillForm(f => ({ ...f, signature: null }))} style={{ ...styles.btnSmall, marginTop: 4, fontSize: 11 }}>🗑️ Ponovi potpis</button>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: 6 }}>
                                        <SignatureCanvas onSave={(sig) => setFillForm(f => ({ ...f, signature: sig }))} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button onClick={() => setShowFillModal(false)} style={styles.btnSecondary}>Odustani</button>
                            <button onClick={saveFill} style={styles.btn}><Icon name="check" size={14} /> Spremi kontrolnu listu</button>
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
}
