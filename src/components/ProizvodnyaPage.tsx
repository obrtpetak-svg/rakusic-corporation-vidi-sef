import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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

const QC_CHECKLISTS = {
    priprema: ['📌 Nacrti pregledani', '🧱 Materijal naručen', '📝 Radni nalog izdan', '👷 Radnici dodijeljeni'],
    proizvodnja: ['✂️ Rezanje završeno', '🔩 Bušenje', '🔥 Zavarivanje', '✨ Brušenje i čišćenje', '📏 Dimenzijska kontrola'],
    kontrola: ['📐 Dimenzije usklađene', '🔍 Zavareni spojevi OK', '🧴 Antikorozivna zaštita', '📄 Certifikat izdan', '📸 Foto dokumentacija'],
    isporuka: ['📦 Pakiranje', '🚚 Transport organiziran', '📂 Dokumentacija klijentu', '✍️ Potpis primljeno'],
};

const fmtDuration = (start, end) => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
};

const COST_CATEGORIES = [
    { value: 'materijal', label: '🧱 Materijal' },
    { value: 'rad', label: '👷 Rad' },
    { value: 'transport', label: '🚚 Transport' },
    { value: 'ostalo', label: '📦 Ostalo' },
];

const STEEL_GRADES = ['S235', 'S275', 'S355', 'S460', 'Inox 304', 'Inox 316', 'Al 6060', 'Ostalo'];
const SPEC_UNITS = ['kg', 't', 'm', 'm²', 'm³', 'kom', 'set', 'l'];

// Profile weights in kg/m for auto-calculation
const PROFILE_WEIGHTS = {
    'HEA 100': 21.2, 'HEA 200': 42.3, 'HEA 300': 88.3, 'HEA 400': 125,
    'HEB 100': 20.4, 'HEB 200': 61.3, 'HEB 300': 117, 'HEB 400': 155,
    'IPE 100': 8.1, 'IPE 200': 22.4, 'IPE 300': 42.2, 'IPE 400': 66.3,
    'UPN 100': 10.6, 'UPN 200': 25.3, 'UPN 300': 46.2,
    'L 50x5': 3.77, 'L 60x6': 5.42, 'L 80x8': 9.63, 'L 100x10': 15.0,
    'Cijev Ø42': 3.56, 'Cijev 40x40': 4.39, 'Cijev Ø16': 0.99,
    'PL 10mm': 78.5, 'PL 15mm': 117.8, 'PL 20mm': 157.0,
};

const TEMPLATES = [
    {
        id: 'hala', name: '🏗️ Čelična hala', desc: 'Industrijska/skladišna hala', defaults: { quantity: 1, unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Raspon', unit: 'm' }, { label: 'Visina', unit: 'm' }, { label: 'Dužina', unit: 'm' }], materials: [{ name: 'Stupovi HEA/HEB', profile: 'HEA 300', unit: 'kg', steelGrade: 'S355' }, { name: 'Krovni nosači IPE', profile: 'IPE 400', unit: 'kg', steelGrade: 'S355' }, { name: 'Sekundarni nosači', profile: 'IPE 200', unit: 'kg', steelGrade: 'S235' }, { name: 'Spregovi/Ukrute', profile: 'L 80x8', unit: 'kg', steelGrade: 'S235' }] }
    },
    {
        id: 'stupovi', name: '🏛️ Stupovi', desc: 'HEA/HEB/Okrugli stupovi', defaults: { unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Visina', unit: 'm' }, { label: 'Bazna ploča', unit: 'mm' }], materials: [{ name: 'Stup', profile: 'HEB 300', unit: 'kg', steelGrade: 'S355' }, { name: 'Bazna ploča', profile: 'PL 20mm', unit: 'kg', steelGrade: 'S355' }, { name: 'Ankeri', profile: 'M24', unit: 'kom', steelGrade: 'S235' }] }
    },
    {
        id: 'nosaci', name: '🔩 Nosači', desc: 'IPE/HEA/UPN nosači', defaults: { unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Raspon', unit: 'm' }, { label: 'Opterećenje', unit: 'kN/m' }], materials: [{ name: 'Nosač', profile: 'IPE 300', unit: 'kg', steelGrade: 'S355' }, { name: 'Spojna ploča', profile: 'PL 15mm', unit: 'kg', steelGrade: 'S235' }, { name: 'Vijci', profile: 'M20 10.9', unit: 'kom', steelGrade: 'S235' }] }
    },
    {
        id: 'stepeniste', name: '🪜 Stepenište', desc: 'Čelično stepenište/rampa', defaults: { quantity: 1, unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Visina', unit: 'm' }, { label: 'Širina', unit: 'mm' }, { label: 'Broj stepenica', unit: 'kom' }], materials: [{ name: 'Gaziša', profile: 'Rešetkasto', unit: 'kom', steelGrade: 'S235' }, { name: 'Podnica', profile: 'UPN 200', unit: 'kg', steelGrade: 'S235' }, { name: 'Ograda', profile: 'Cijev Ø42', unit: 'm', steelGrade: 'S235' }] }
    },
    {
        id: 'ograda', name: '🛡️ Ograde / Railing', desc: 'Zaštitne ograde, rukohvati', defaults: { unit: 'm', priority: 'normalan' },
        specDefaults: { dimensions: [{ label: 'Dužina', unit: 'm' }, { label: 'Visina', unit: 'mm' }], materials: [{ name: 'Stupići', profile: 'Cijev 40x40', unit: 'kom', steelGrade: 'S235' }, { name: 'Rukohvat', profile: 'Cijev Ø42', unit: 'm', steelGrade: 'Inox 304' }, { name: 'Ispuna', profile: 'Cijev Ø16', unit: 'm', steelGrade: 'S235' }] }
    },
    {
        id: 'custom', name: '⚡ Proizvoljno', desc: 'Konstrukcija po mjeri', defaults: { quantity: 1, unit: 'kom', priority: 'normalan' },
        specDefaults: { dimensions: [], materials: [] }
    },
];

const genOrderNumber = () => {
    const year = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 9000) + 1000);
    return `PRO-${year}-${num}`;
};

export function ProizvodnyaPage({ leaderProjectIds }) {
    const confirm = useConfirm();
    const { production, workers, projects, currentUser, addAuditLog, loadProduction } = useApp();

    // Lazy load production data on mount
    useEffect(() => { loadProduction?.(); }, [loadProduction]);

    const [activeTab, setActiveTab] = useState('pipeline');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStage, setFilterStage] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterDeadline, setFilterDeadline] = useState('all');
    const [showTemplateChooser, setShowTemplateChooser] = useState(false);
    const [signOffOrder, setSignOffOrder] = useState(null);
    const [signOffNote, setSignOffNote] = useState('');
    const [signOffConfirmed, setSignOffConfirmed] = useState(false);
    const sigCanvasRef = useRef(null);
    const sigDrawing = useRef(false);
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
        if (filterDeadline === 'kasni') list = list.filter(o => o.deadline && new Date(o.deadline) < new Date());
        if (filterDeadline === 'uskoro') list = list.filter(o => { const d = o.deadline ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86400000) : null; return d !== null && d >= 0 && d <= 3; });
        return list;
    }, [activeOrders, filterStage, filterPriority, filterDeadline, search, leaderProjectIds]);

    // Stats
    const stats = useMemo(() => {
        const orders = leaderProjectIds?.length > 0
            ? activeOrders.filter(o => !o.projectId || leaderProjectIds.includes(o.projectId))
            : activeOrders;
        const totalCost = orders.reduce((s, o) => s + (o.totalCost || 0), 0);
        const thisMonth = new Date().toISOString().slice(0, 7);
        // Count all orders currently at 'zavrseno' stage (regardless of month)
        const allDone = allOrders.filter(o => o.stage === 'zavrseno');
        // Count orders that entered 'zavrseno' this month
        const doneThisMonth = allDone.filter(o => {
            const entry = (o.stages || []).find(s => s.stage === 'zavrseno');
            return entry && (entry.enteredAt || '').startsWith(thisMonth);
        });
        return {
            total: orders.length,
            inProgress: orders.filter(o => ['proizvodnja', 'kontrola', 'isporuka'].includes(o.stage)).length,
            waiting: orders.filter(o => o.stage === 'narudzba' || o.stage === 'priprema').length,
            doneTotal: allDone.length,
            doneMonth: doneThisMonth.length,
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

    const openAdd = () => { setShowTemplateChooser(true); };
    const openFromTemplate = (tpl) => {
        const f = blankForm();
        if (tpl) {
            f.name = tpl.id !== 'custom' ? tpl.name.replace(/^[^\s]+\s/, '') : '';
            if (tpl.defaults) Object.assign(f, tpl.defaults);
            if (tpl.specDefaults) {
                f.specifications = { materials: (tpl.specDefaults.materials || []).map(m => ({ id: genId(), ...m, quantity: 0 })), dimensions: (tpl.specDefaults.dimensions || []).map(d => ({ id: genId(), ...d, value: '' })), technicalNotes: '' };
            }
        }
        setForm(f); setEditId(null); setShowTemplateChooser(false); setShowForm(true);
    };
    const openEdit = (o) => {
        setForm({ ...o, assignedWorkers: o.assignedWorkers || [], costItems: o.costItems || [], files: o.files || [], stages: o.stages || [], specifications: o.specifications || { materials: [], dimensions: [], technicalNotes: '' } });
        setEditId(o.id); setDetailId(null); setShowForm(true);
    };

    const doSave = async () => {
        if (!form.name.trim()) return alert('Naziv je obavezan');
        const data = { ...form, totalCost: (form.costItems || []).reduce((s, c) => s + (c.total || 0), 0) };
        if (editId) {
            await updateDoc('production', editId, { ...data, updatedAt: new Date().toISOString() });
        } else {
            const newId = genId();
            await addDoc('production', { id: newId, ...data, createdAt: new Date().toISOString(), createdBy: currentUser?.name });
            // Notify admin about new order
            await addDoc('prodAlerts', { id: genId(), type: 'new_order', orderNumber: data.orderNumber, orderName: data.name, createdBy: currentUser?.name, createdAt: new Date().toISOString(), status: 'unread', targetRole: 'admin' });
        }
        setShowForm(false);
    };

    const doDelete = async (id) => {
        if (!(await confirm('Obrisati ovu narudžbu?'))) return;
        const order = allOrders.find(o => o.id === id);
        if (addAuditLog) await addAuditLog('PRODUCTION_DELETED', `🗑️ ${currentUser?.name} obrisao narudžbu: ${order?.orderNumber || ''} "${order?.name || ''}"`);
        await removeDoc('production', id);
        if (detailId === id) setDetailId(null);
    };

    const requestAdvance = (order) => {
        setSignOffOrder(order);
        setSignOffNote('');
        setSignOffConfirmed(false);
    };
    const confirmSignOff = async () => {
        if (!signOffConfirmed) return alert('Morate potvrditi da je faza završena');
        const order = signOffOrder;
        if (!order) return;
        const idx = STAGES.findIndex(s => s.id === order.stage);
        if (idx >= STAGES.length - 1) return;
        const nextStage = STAGES[idx + 1].id;
        const updatedStages = [...(order.stages || [])];
        const current = updatedStages.find(s => s.stage === order.stage && !s.completedAt);
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
        // Auto-comment on stage change
        const autoComment = { id: genId(), text: `⏭️ Faza pomaknuta u: ${STAGES[idx + 1]?.label}${signOffNote ? ' — ' + signOffNote : ''}`, author: currentUser?.name || 'Sustav', createdAt: new Date().toISOString(), isSystem: true };
        const existingComments = order.comments || [];
        await updateDoc('production', order.id, { comments: [...existingComments, autoComment] });
        // Notify admin + creator about stage change
        const alertBase = { type: 'stage_change', orderNumber: order.orderNumber, orderName: order.name, fromStage: STAGES[idx]?.label, toStage: STAGES[idx + 1]?.label, changedBy: currentUser?.name, createdAt: new Date().toISOString(), status: 'unread' };
        await addDoc('prodAlerts', { id: genId(), ...alertBase, targetRole: 'admin' });
        if (order.createdBy && order.createdBy !== currentUser?.name) {
            await addDoc('prodAlerts', { id: genId(), ...alertBase, targetUser: order.createdBy });
        }
        setSignOffOrder(null);
    };

    // Canvas signature helpers
    const initSigCanvas = useCallback((canvas) => {
        if (!canvas) return;
        sigCanvasRef.current = canvas;
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1a1a1a';
        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const t = e.touches ? e.touches[0] : e;
            return { x: t.clientX - rect.left, y: t.clientY - rect.top };
        };
        const start = (e) => { e.preventDefault(); sigDrawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const move = (e) => { if (!sigDrawing.current) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        const end = () => { sigDrawing.current = false; };
        canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
        canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
    }, []);
    const clearSigCanvas = () => { const c = sigCanvasRef.current; if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); } };
    const getSigData = () => { const c = sigCanvasRef.current; return c ? c.toDataURL('image/png') : null; };

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

    // Comments
    const [commentText, setCommentText] = useState('');
    const addComment = async (orderId) => {
        if (!commentText.trim()) return;
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;
        const comment = { id: genId(), text: commentText.trim(), author: currentUser?.name || 'Nepoznat', createdAt: new Date().toISOString(), isSystem: false };
        await updateDoc('production', orderId, { comments: [...(order.comments || []), comment] });
        setCommentText('');
    };
    const removeComment = async (orderId, commentId) => {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;
        await updateDoc('production', orderId, { comments: (order.comments || []).filter(c => c.id !== commentId) });
    };

    // Stage photo upload
    const handleStagePhoto = async (orderId, stageId) => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const compressed = await compressImage(file);
            const order = allOrders.find(o => o.id === orderId);
            if (!order) return;
            const stages = [...(order.stages || [])];
            const stage = stages.find(s => s.stage === stageId && !s.completedAt) || stages.findLast(s => s.stage === stageId);
            if (stage) {
                stage.photos = [...(stage.photos || []), { id: genId(), ...compressed, uploadedAt: new Date().toISOString(), uploadedBy: currentUser?.name }];
                await updateDoc('production', orderId, { stages });
            }
        };
        input.click();
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

    // Export PDF (browser print)
    const exportPDF = () => {
        const data = (activeTab === 'archive' ? archivedOrders : filtered);
        const rows = data.map(o => `<tr><td>${o.orderNumber}</td><td>${o.name}</td><td>${o.client || '—'}</td><td>${STAGES.find(s => s.id === o.stage)?.label || '—'}</td><td>${o.priority}</td><td>${o.quantity} ${o.unit}</td><td>${o.deadline || '—'}</td><td>${(o.totalCost || 0).toFixed(2)}€</td></tr>`).join('');
        const html = `<!DOCTYPE html><html><head><title>Proizvodnja - ${today()}</title><style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:700}tr:nth-child(even){background:#fafafa}.footer{margin-top:20px;font-size:10px;color:#999}</style></head><body><h1>Proizvodnja — Izvještaj</h1><p>Datum: ${fmtDate(new Date().toISOString())} • Ukupno: ${data.length} narudžbi</p><table><thead><tr><th>Broj</th><th>Naziv</th><th>Naručitelj</th><th>Faza</th><th>Prioritet</th><th>Količina</th><th>Rok</th><th>Trošak</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Generirano iz Vi-Di-Sef • ${new Date().toLocaleString('hr-HR')}</div></body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        setTimeout(() => { w.print(); }, 500);
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
            <>
                <div>
                    <button onClick={() => { setDetailId(null); setDetailTab('info'); setSignOffOrder(null); setShowForm(false); }} style={{ ...styles.btnSecondary, marginBottom: 20, display: 'inline-flex' }}><Icon name="back" size={16} /> Natrag</button>

                    {/* Header card */}
                    <div style={{ ...styles.card, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 4 }}>{detailOrder.orderNumber}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{detailOrder.name}</div>
                                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>🏢 {detailOrder.client || '—'} {detailOrder.quantity && `• ${detailOrder.quantity} ${detailOrder.unit}`}</div>
                                {detailOrder.projectId && (() => { const proj = projects.find(p => p.id === detailOrder.projectId); return proj ? <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>📁 Projekt: {proj.name}</div> : null; })()}
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
                            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                                <button onClick={() => requestAdvance(detailOrder)} style={{ ...styles.btn, fontSize: 13 }}>
                                    ⏭️ {STAGES[stageIdx + 1] ? `Pomakni u: ${STAGES[stageIdx + 1].label}` : 'Završi'}
                                </button>
                                <button onClick={() => openEdit(detailOrder)} style={styles.btnSecondary}><Icon name="edit" size={14} /> Uredi</button>
                                <button onClick={() => doDelete(detailOrder.id)} style={{ ...styles.btnDanger, fontSize: 13 }}><Icon name="trash" size={14} /> Obriši</button>
                            </div>
                        )}
                        {canManage && detailOrder.stage === 'zavrseno' && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                                <button onClick={() => archiveOrder(detailOrder)} style={{ ...styles.btnSecondary, fontSize: 13 }}>📦 Arhiviraj</button>
                                <button onClick={() => openEdit(detailOrder)} style={styles.btnSecondary}><Icon name="edit" size={14} /> Uredi</button>
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
                                                            <img key={p.id} src={p.data} alt="" onClick={() => { const w = window.open(); w?.document.write(`<img src="${p.data}" style="max-width:100%;height:auto">`); }} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${C.border}` }} />
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
                            <div style={{ ...styles.card, marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>☑️ Radni zadaci ({done}/{subtasks.length})</div>
                                    {canManage && <button onClick={addSubtask} style={styles.btnSmall}><Icon name="plus" size={12} /> Novi zadatak</button>}
                                </div>
                                {subtasks.length > 0 && <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 16 }}><div style={{ width: `${subtasks.length > 0 ? (done / subtasks.length) * 100 : 0}%`, height: 4, borderRadius: 2, background: '#10B981', transition: 'width 0.3s' }} /></div>}
                                {subtasks.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Nema zadataka — dodajte radne naloge</div> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {subtasks.map(t => (
                                            <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: t.status === 'gotovo' ? 'rgba(16,185,129,0.04)' : 'var(--bg)', border: `1px solid ${t.status === 'gotovo' ? 'rgba(16,185,129,0.2)' : C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <input type="checkbox" checked={t.status === 'gotovo'} onChange={() => toggleSubtask(t.id)} style={{ width: 18, height: 18, accentColor: '#10B981', flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}>
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
                            <div style={{ ...styles.card, marginBottom: 20 }}>
                                {/* Summary */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                                    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Materijali</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{specs.materials.length}</div>
                                    </div>
                                    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ukupna težina</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)}t` : `${totalWeight}kg`}</div>
                                    </div>
                                </div>

                                {/* Materials */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🧱 Materijali</div>
                                    {canManage && <button onClick={addSpecMaterial} style={styles.btnSmall}><Icon name="plus" size={12} /> Dodaj</button>}
                                </div>
                                {specs.materials.length === 0 ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Nema materijala — dodajte stavke</div> : (
                                    <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr><th style={styles.th}>Naziv</th><th style={styles.th}>Profil</th><th style={styles.th}>Kol.</th><th style={styles.th}>Jed.</th><th style={styles.th}>Dimenzije (mm)</th><th style={styles.th}>Debljina (mm)</th><th style={styles.th}>Čelik</th>{canManage && <th style={styles.th}></th>}</tr></thead>
                                            <tbody>
                                                {specs.materials.map(m => (
                                                    <tr key={m.id}>
                                                        <td style={styles.td}>{canManage ? <Input value={m.name} onChange={e => updateSpecMaterial(m.id, 'name', e.target.value)} placeholder="Stup, Nosač..." style={{ fontSize: 12, padding: '4px 8px' }} /> : <span style={{ fontWeight: 600 }}>{m.name}</span>}</td>
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
                        <div style={{ ...styles.card, marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🧾 Troškovnik ({costItems.length} stavki)</div>
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
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Potpisuje</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, padding: '10px 14px', borderRadius: 8, background: C.bgElevated }}>{currentUser?.name || 'Nepoznat'}</div>
                            </div>
                            <Field label="Kontrolna bilješka (opcionalno)"><Textarea value={signOffNote} onChange={e => setSignOffNote(e.target.value)} placeholder="Napomena o fazi, kvaliteta, status kontrole..." rows={2} /></Field>
                            <div style={{ marginBottom: 12 }}>
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
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Proizvodnja</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{activeOrders.length} narudžbi • Praćenje proizvodnog procesa</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {canManage && <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Nova narudžba</button>}
                    <button onClick={exportCSV} style={styles.btnSecondary}>📊 CSV</button>
                    <button onClick={exportPDF} style={styles.btnSecondary}>📄 PDF</button>
                </div>
            </div>

            {/* Stats + Mini Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ukupno</div><div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{stats.total}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>U tijeku</div><div style={{ fontSize: 22, fontWeight: 800, color: '#3B82F6' }}>{stats.inProgress}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Na čekanju</div><div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>{stats.waiting}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Završeno</div><div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{stats.doneTotal}</div><div style={{ fontSize: 10, color: C.textMuted }}>{stats.doneMonth > 0 ? `+${stats.doneMonth} ovaj mj.` : ''}</div></div>
                <div style={{ ...styles.card, textAlign: 'center', padding: '14px 10px' }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Troškovi</div><div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444' }}>{stats.totalCost > 0 ? `${stats.totalCost.toFixed(0)}€` : '0€'}</div></div>
                {/* Mini pie chart */}
                <div style={{ ...styles.card, textAlign: 'center', padding: '10px' }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Faze</div>
                    {activeOrders.length > 0 ? (() => {
                        const counts = STAGES.map(s => ({ ...s, count: activeOrders.filter(o => o.stage === s.id).length })).filter(s => s.count > 0);
                        let offset = 0;
                        return (
                            <svg viewBox="0 0 36 36" style={{ width: 44, height: 44, display: 'block', margin: '0 auto' }}>
                                {counts.map((s, i) => {
                                    const pct = (s.count / activeOrders.length) * 100;
                                    const dash = `${pct} ${100 - pct}`;
                                    const el = <circle key={s.id} cx="18" cy="18" r="15.9" fill="none" stroke={s.color} strokeWidth="3" strokeDasharray={dash} strokeDashoffset={-offset} />;
                                    offset += pct;
                                    return el;
                                })}
                            </svg>
                        );
                    })() : <div style={{ fontSize: 20, color: C.textMuted }}>—</div>}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
                {[{ id: 'pipeline', label: '🔄 Pipeline' }, { id: 'lista', label: '📋 Lista' }, { id: 'gantt', label: '📊 Gantt' }, { id: 'calendar', label: '📅 Kalendar' }, { id: 'archive', label: '📦 Arhiva' }].map(t => (
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
                        <Select value={filterDeadline} onChange={e => setFilterDeadline(e.target.value)} style={{ width: 130 }}>
                            <option value="all">Svi rokovi</option>
                            <option value="kasni">🔴 Kasni</option>
                            <option value="uskoro">⚠️ Uskoro (≤3d)</option>
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

            {/* Gantt Chart View */}
            {activeTab === 'gantt' && (() => {
                const ordersWithDates = filtered.filter(o => o.createdAt && o.deadline);
                if (ordersWithDates.length === 0) return <div style={{ ...styles.card, textAlign: 'center', padding: 50, color: C.textMuted }}><div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>Nema narudžbi s rokovima za Gantt prikaz</div>;
                const allDates = ordersWithDates.flatMap(o => [new Date(o.createdAt).getTime(), new Date(o.deadline).getTime()]);
                const minDate = Math.min(...allDates);
                const maxDate = Math.max(...allDates);
                const range = maxDate - minDate || 1;
                return (
                    <div style={{ ...styles.card, overflowX: 'auto' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>📊 Gantt Chart — Vremenski raspored</div>
                        <div style={{ minWidth: 600 }}>
                            {ordersWithDates.map(o => {
                                const start = new Date(o.createdAt).getTime();
                                const end = new Date(o.deadline).getTime();
                                const left = ((start - minDate) / range) * 100;
                                const width = Math.max(((end - start) / range) * 100, 2);
                                const stg = STAGES.find(s => s.id === o.stage);
                                const isLate = end < Date.now();
                                return (
                                    <div key={o.id} onClick={() => setDetailId(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, cursor: 'pointer', padding: '4px 0' }}>
                                        <div style={{ width: 140, fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{o.orderNumber}</div>
                                        <div style={{ flex: 1, position: 'relative', height: 22, background: 'var(--bg)', borderRadius: 4 }}>
                                            <div style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', borderRadius: 4, background: isLate ? '#EF4444' : stg?.color || C.accent, opacity: 0.85, display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden' }}>
                                                <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{o.name}</span>
                                            </div>
                                        </div>
                                        <div style={{ width: 60, fontSize: 10, color: C.textMuted, flexShrink: 0 }}>{fmtDate(o.deadline)}</div>
                                    </div>
                                );
                            })}
                            {/* Timeline axis */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingLeft: 150, fontSize: 9, color: C.textMuted }}>
                                <span>{new Date(minDate).toLocaleDateString('hr')}</span>
                                <span>{new Date((minDate + maxDate) / 2).toLocaleDateString('hr')}</span>
                                <span>{new Date(maxDate).toLocaleDateString('hr')}</span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Calendar View */}
            {activeTab === 'calendar' && (() => {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth();
                const firstDay = new Date(year, month, 1).getDay() || 7;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const deadlineMap = {};
                filtered.forEach(o => {
                    if (!o.deadline) return;
                    const d = new Date(o.deadline);
                    if (d.getFullYear() === year && d.getMonth() === month) {
                        const day = d.getDate();
                        if (!deadlineMap[day]) deadlineMap[day] = [];
                        deadlineMap[day].push(o);
                    }
                });
                const cells = [];
                for (let i = 1; i < firstDay; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                return (
                    <div style={{ ...styles.card }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>📅 Kalendar — {now.toLocaleDateString('hr', { month: 'long', year: 'numeric' })}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                            {['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map(d => <div key={d} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textAlign: 'center', padding: '4px 0' }}>{d}</div>)}
                            {cells.map((day, i) => (
                                <div key={i} style={{ minHeight: 60, padding: 4, borderRadius: 6, border: `1px solid ${day === now.getDate() ? C.accent : C.border}22`, background: day ? (deadlineMap[day] ? 'rgba(59,130,246,0.04)' : 'var(--bg)') : 'transparent' }}>
                                    {day && <>
                                        <div style={{ fontSize: 11, fontWeight: day === now.getDate() ? 800 : 500, color: day === now.getDate() ? C.accent : C.textMuted, marginBottom: 2 }}>{day}</div>
                                        {(deadlineMap[day] || []).slice(0, 3).map(o => {
                                            const stg = STAGES.find(s => s.id === o.stage);
                                            return <div key={o.id} onClick={() => setDetailId(o.id)} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: stg?.color || C.accent, color: '#fff', marginBottom: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{o.name}</div>;
                                        })}
                                        {(deadlineMap[day] || []).length > 3 && <div style={{ fontSize: 8, color: C.textMuted }}>+{deadlineMap[day].length - 3}</div>}
                                    </>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

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

            {/* Template Chooser Modal */}
            {showTemplateChooser && (
                <Modal title="Odaberi predložak proizvoda" onClose={() => setShowTemplateChooser(false)} wide>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>Odaberi tip čeličnog proizvoda za brzi početak, ili kreiraj prazan projekt.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                        {TEMPLATES.map(tpl => (
                            <div key={tpl.id} onClick={() => openFromTemplate(tpl)}
                                style={{ padding: '20px 16px', borderRadius: 12, border: `1.5px solid ${C.border}`, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', background: 'var(--bg)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>{tpl.name.split(' ')[0]}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{tpl.name.replace(/^[^\s]+\s/, '')}</div>
                                <div style={{ fontSize: 11, color: C.textMuted }}>{tpl.desc}</div>
                                {tpl.specDefaults?.materials?.length > 0 && (
                                    <div style={{ marginTop: 8, fontSize: 10, color: C.accent, fontWeight: 600 }}>{tpl.specDefaults.materials.length} materijala • {tpl.specDefaults.dimensions?.length || 0} dimenzija</div>
                                )}
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

        </div>
    );
}
