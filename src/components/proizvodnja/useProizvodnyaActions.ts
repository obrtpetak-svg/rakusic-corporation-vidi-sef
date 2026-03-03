/**
 * useProizvodnyaActions — Custom hook extracting all production CRUD and detail-view actions
 * from ProizvodnyaPage. Keeps UI component thin.
 */
import { useState, useRef, useCallback } from 'react';
import { useApp, add as addDoc, update as updateDoc, remove as removeDoc } from '../../context/AppContext';
import { genId, today, fmtDate, compressImage } from '../../utils/helpers';
import { STAGES, COST_CATEGORIES, TEMPLATES, QC_CHECKLISTS, PROFILE_WEIGHTS } from './proizvodnja-constants';
import { useConfirm } from '../ui/ConfirmModal';

export function useProizvodnyaActions(allOrders: any[]) {
    const confirm = useConfirm();
    const { workers, projects, currentUser, addAuditLog } = useApp();

    // ── Form State ──
    const blankForm = () => ({
        orderNumber: '', name: '', client: '', description: '',
        deadline: '', priority: 'normalan', quantity: 1, unit: 'kom',
        stage: 'narudzba', assignedWorkers: [], projectId: '', notes: '',
        stages: [{ stage: 'narudzba', enteredAt: new Date().toISOString() }],
        costItems: [], totalCost: 0, files: [], status: 'aktivan',
    });
    const [form, setForm] = useState<any>(blankForm());
    const [editId, setEditId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showTemplateChooser, setShowTemplateChooser] = useState(false);
    const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    // ── Sign-off State ──
    const [signOffOrder, setSignOffOrder] = useState<any>(null);
    const [signOffNote, setSignOffNote] = useState('');
    const [signOffConfirmed, setSignOffConfirmed] = useState(false);
    const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const sigDrawing = useRef(false);

    // ── Cost State ──
    const [showCostForm, setShowCostForm] = useState(false);
    const [costForm, setCostForm] = useState({ name: '', category: 'materijal', quantity: 1, unitPrice: 0, notes: '' });
    const [commentText, setCommentText] = useState('');

    // ── Form Actions ──
    const openAdd = () => { setShowTemplateChooser(true); };

    const openFromTemplate = (tpl: any) => {
        const f: any = blankForm();
        if (tpl) {
            f.name = tpl.id !== 'custom' ? tpl.name.replace(/^[^\s]+\s/, '') : '';
            if (tpl.defaults) Object.assign(f, tpl.defaults);
            if (tpl.specDefaults) {
                f.specifications = { materials: (tpl.specDefaults.materials || []).map((m: any) => ({ id: genId(), ...m, quantity: 0 })), dimensions: (tpl.specDefaults.dimensions || []).map((d: any) => ({ id: genId(), ...d, value: '' })), technicalNotes: '' };
            }
        }
        setForm(f); setEditId(null); setShowTemplateChooser(false); setShowForm(true);
    };

    const openEdit = (o: any) => {
        setForm({ ...o, assignedWorkers: o.assignedWorkers || [], costItems: o.costItems || [], files: o.files || [], stages: o.stages || [], specifications: o.specifications || { materials: [], dimensions: [], technicalNotes: '' } });
        setEditId(o.id); setShowForm(true);
    };

    const doSave = async () => {
        if (!form.name.trim()) return alert('Naziv je obavezan');
        const data = { ...form, totalCost: (form.costItems || []).reduce((s: number, c: any) => s + (c.total || 0), 0) };
        if (editId) {
            await updateDoc('production', editId, { ...data, updatedAt: new Date().toISOString() });
        } else {
            const newId = genId();
            await addDoc('production', { id: newId, ...data, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
            await addDoc('prodAlerts', { id: genId(), type: 'new_order', orderNumber: data.orderNumber, orderName: data.name, createdBy: currentUser?.name, createdAt: new Date().toISOString(), status: 'unread', targetRole: 'admin' });
        }
        setShowForm(false);
    };

    const doDelete = async (id: string) => {
        if (!(await confirm('Obrisati ovu narudžbu?'))) return;
        const order = allOrders.find((o: any) => o.id === id);
        if (addAuditLog) await addAuditLog('PRODUCTION_DELETED', `🗑️ ${currentUser?.name} obrisao narudžbu: ${order?.orderNumber || ''} "${order?.name || ''}"`);
        await removeDoc('production', id);
    };

    // ── Stage Advancement ──
    const requestAdvance = (order: any) => {
        setSignOffOrder(order);
        setSignOffNote('');
        setSignOffConfirmed(false);
    };

    const getSigData = () => { const c = sigCanvasRef.current; return c ? c.toDataURL('image/png') : null; };
    const clearSigCanvas = () => { const c = sigCanvasRef.current; if (c) { const ctx = c.getContext('2d'); ctx?.clearRect(0, 0, c.width, c.height); } };

    const initSigCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        sigCanvasRef.current = canvas;
        const ctx = canvas.getContext('2d')!;
        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1a';
        const getPos = (e: any) => { const rect = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - rect.left, y: t.clientY - rect.top }; };
        const start = (e: any) => { e.preventDefault(); sigDrawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const move = (e: any) => { if (!sigDrawing.current) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        const end = () => { sigDrawing.current = false; };
        canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
        canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
    }, []);

    const confirmSignOff = async () => {
        if (!signOffConfirmed) return alert('Morate potvrditi da je faza završena');
        const order = signOffOrder;
        if (!order) return;
        const idx = STAGES.findIndex(s => s.id === order.stage);
        if (idx >= STAGES.length - 1) return;
        const nextStage = STAGES[idx + 1].id;
        const updatedStages = [...(order.stages || [])];
        const current = updatedStages.find((s: any) => s.stage === order.stage && !s.completedAt);
        if (current) {
            current.completedAt = new Date().toISOString();
            current.completedBy = currentUser?.name;
            current.signedBy = currentUser?.name;
            current.signNote = signOffNote || '';
            current.signedAt = new Date().toISOString();
            current.signature = getSigData() || null;
        }
        updatedStages.push({ stage: nextStage, enteredAt: new Date().toISOString() });
        await updateDoc('production', order.id, { stage: nextStage, stages: updatedStages });
        if (addAuditLog) await addAuditLog('PRODUCTION_STAGE_CHANGE', `${currentUser?.name} pomaknuo ${order.orderNumber} "${order.name}" u: ${STAGES[idx + 1]?.label}${signOffNote ? ' | ' + signOffNote : ''}`);
        const autoComment = { id: genId(), text: `⏭️ Faza pomaknuta u: ${STAGES[idx + 1]?.label}${signOffNote ? ' — ' + signOffNote : ''}`, author: currentUser?.name || 'Sustav', createdAt: new Date().toISOString(), isSystem: true };
        await updateDoc('production', order.id, { comments: [...(order.comments || []), autoComment] });
        const alertBase = { type: 'stage_change', orderNumber: order.orderNumber, orderName: order.name, fromStage: STAGES[idx]?.label, toStage: STAGES[idx + 1]?.label, changedBy: currentUser?.name, createdAt: new Date().toISOString(), status: 'unread' };
        await addDoc('prodAlerts', { id: genId(), ...alertBase, targetRole: 'admin' });
        if (order.createdBy && order.createdBy !== currentUser?.name) {
            await addDoc('prodAlerts', { id: genId(), ...alertBase, targetUser: order.createdBy });
        }
        setSignOffOrder(null);
    };

    // ── Archive ──
    const archiveOrder = async (order: any) => { await updateDoc('production', order.id, { status: 'arhiviran' }); };
    const unarchiveOrder = async (order: any) => { await updateDoc('production', order.id, { status: 'aktivan' }); };

    // ── Cost Management ──
    const addCostItem = async (detailOrder: any) => {
        if (!costForm.name.trim()) return;
        const item = { id: genId(), ...costForm, total: costForm.quantity * costForm.unitPrice };
        const newItems = [...(detailOrder?.costItems || []), item];
        const newTotal = newItems.reduce((s: number, c: any) => s + (c.total || 0), 0);
        await updateDoc('production', detailOrder.id, { costItems: newItems, totalCost: newTotal });
        setShowCostForm(false);
        setCostForm({ name: '', category: 'materijal', quantity: 1, unitPrice: 0, notes: '' });
    };
    const removeCostItem = async (detailOrder: any, itemId: string) => {
        const newItems = (detailOrder?.costItems || []).filter((c: any) => c.id !== itemId);
        const newTotal = newItems.reduce((s: number, c: any) => s + (c.total || 0), 0);
        await updateDoc('production', detailOrder.id, { costItems: newItems, totalCost: newTotal });
    };

    // ── File Management ──
    const handleFileUpload = async (e: any, detailOrder: any) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert('Max 10MB');
        const compressed = await compressImage(file);
        const newFiles = [...(detailOrder?.files || []), { id: genId(), ...compressed, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.name }];
        await updateDoc('production', detailOrder.id, { files: newFiles });
    };
    const removeFile = async (detailOrder: any, fileId: string) => {
        const newFiles = (detailOrder?.files || []).filter((f: any) => f.id !== fileId);
        await updateDoc('production', detailOrder.id, { files: newFiles });
    };

    // ── Comments ──
    const addComment = async (orderId: string) => {
        if (!commentText.trim()) return;
        const order = allOrders.find((o: any) => o.id === orderId);
        if (!order) return;
        const comment = { id: genId(), text: commentText.trim(), author: currentUser?.name || 'Nepoznat', createdAt: new Date().toISOString(), isSystem: false };
        await updateDoc('production', orderId, { comments: [...(order.comments || []), comment] });
        setCommentText('');
    };
    const removeComment = async (orderId: string, commentId: string) => {
        const order = allOrders.find((o: any) => o.id === orderId);
        if (!order) return;
        await updateDoc('production', orderId, { comments: (order.comments || []).filter((c: any) => c.id !== commentId) });
    };

    // ── Stage Photos ──
    const handleStagePhoto = async (orderId: string, stageId: string) => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
        input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const compressed = await compressImage(file);
            const order = allOrders.find((o: any) => o.id === orderId);
            if (!order) return;
            const stages = [...(order.stages || [])];
            const stage = stages.find((s: any) => s.stage === stageId && !s.completedAt) || stages.findLast((s: any) => s.stage === stageId);
            if (stage) {
                stage.photos = [...(stage.photos || []), { id: genId(), ...compressed, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.name }];
                await updateDoc('production', orderId, { stages });
            }
        };
        input.click();
    };

    // ── Exports ──
    const exportCSV = (data: any[]) => {
        const headers = ['Broj', 'Naziv', 'Naručitelj', 'Faza', 'Prioritet', 'Količina', 'Rok', 'Trošak (€)', 'Status'];
        const rows = data.map((o: any) => [o.orderNumber, o.name, o.client, STAGES.find(s => s.id === o.stage)?.label, o.priority, `${o.quantity} ${o.unit}`, o.deadline, (o.totalCost || 0).toFixed(2), o.status]);
        const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `proizvodnja-${today()}.csv`; a.click();
    };

    const exportPDF = (data: any[]) => {
        const rows = data.map((o: any) => `<tr><td>${o.orderNumber}</td><td>${o.name}</td><td>${o.client || '—'}</td><td>${STAGES.find(s => s.id === o.stage)?.label || '—'}</td><td>${o.priority}</td><td>${o.quantity} ${o.unit}</td><td>${o.deadline || '—'}</td><td>${(o.totalCost || 0).toFixed(2)}€</td></tr>`).join('');
        const html = `<!DOCTYPE html><html><head><title>Proizvodnja - ${today()}</title><style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:700}tr:nth-child(even){background:#fafafa}.footer{margin-top:20px;font-size:10px;color:#999}</style></head><body><h1>Proizvodnja — Izvještaj</h1><p>Datum: ${fmtDate(new Date().toISOString())} • Ukupno: ${data.length} narudžbi</p><table><thead><tr><th>Broj</th><th>Naziv</th><th>Naručitelj</th><th>Faza</th><th>Prioritet</th><th>Količina</th><th>Rok</th><th>Trošak</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Generirano iz Vi-Di-Sef • ${new Date().toLocaleString('hr-HR')}</div></body></html>`;
        const w = window.open('', '_blank');
        w?.document.write(html);
        w?.document.close();
        setTimeout(() => { w?.print(); }, 500);
    };

    return {
        // Form
        form, setForm, editId, setEditId, showForm, setShowForm, showTemplateChooser, setShowTemplateChooser, upd,
        openAdd, openFromTemplate, openEdit, doSave, doDelete,
        // Stage
        signOffOrder, setSignOffOrder, signOffNote, setSignOffNote, signOffConfirmed, setSignOffConfirmed,
        requestAdvance, confirmSignOff, initSigCanvas, clearSigCanvas,
        // Archive
        archiveOrder, unarchiveOrder,
        // Cost
        showCostForm, setShowCostForm, costForm, setCostForm, addCostItem, removeCostItem,
        // Files
        handleFileUpload, removeFile,
        // Comments
        commentText, setCommentText, addComment, removeComment,
        // Stage photos
        handleStagePhoto,
        // Exports
        exportCSV, exportPDF,
    };
}
