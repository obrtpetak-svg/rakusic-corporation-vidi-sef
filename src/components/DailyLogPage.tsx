import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, add as addDoc, update as updateDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, Pagination, usePagination, useIsMobile, useToast } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, compressImage, uploadToStorage } from '../utils/helpers';

// WMO Weather Code → Croatian weather name mapping
const WMO_TO_WEATHER = {
    0: 'sunčano', 1: 'sunčano', 2: 'oblačno', 3: 'oblačno',
    45: 'magla', 48: 'magla',
    51: 'kiša', 53: 'kiša', 55: 'kiša', 56: 'kiša', 57: 'kiša',
    61: 'kiša', 63: 'kiša', 65: 'kiša', 66: 'kiša', 67: 'kiša',
    71: 'snijeg', 73: 'snijeg', 75: 'snijeg', 77: 'snijeg',
    80: 'kiša', 81: 'kiša', 82: 'kiša', 85: 'snijeg', 86: 'snijeg',
    95: 'kiša', 96: 'kiša', 99: 'kiša',
};
const WMO_ICONS = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️', 80: '🌧️', 81: '🌧️', 82: '⛈️', 95: '⛈️', 96: '⛈️', 99: '⛈️' };

export function DailyLogPage({ workerFilterId, leaderProjectIds }) {
    const confirm = useConfirm();
    const { dailyLogs, projects, workers, currentUser, companyProfile, addAuditLog, loadDailyLogs } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [filters, setFilters] = useState({ project: '', dateFrom: '', dateTo: '', search: '', weather: 'all', status: 'all' });
    const isMobile = useIsMobile();
    const toast = useToast();
    const [compressProgress, setCompressProgress] = useState(null); // M-3

    // C-4: Load dailyLogs on mount (lazy)
    useEffect(() => { loadDailyLogs(); }, [loadDailyLogs]);
    const isWorker = !!workerFilterId;
    const isLeaderView = !!leaderProjectIds?.length;
    const isAdmin = currentUser?.role === 'admin';

    const blankForm = () => ({
        date: today(),
        projectId: '',
        weather: 'sunčano',
        temperature: '',
        workersPresent: '',
        workDescription: '',
        materialsUsed: '',
        equipmentUsed: '',
        issues: '',
        safetyNotes: '',
        notes: '',
        photos: [],
    });
    const [form, setForm] = useState(blankForm());
    const [photoQueue, setPhotoQueue] = useState([]);
    const [weatherSuggestion, setWeatherSuggestion] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Auto-fetch weather when project is selected
    const fetchWeatherForProject = useCallback(async (projectId) => {
        const proj = projects.find(p => p.id === projectId);
        if (!proj?.siteLat || !proj?.siteLng) { setWeatherSuggestion(null); return; }
        setWeatherLoading(true);
        try {
            const params = new URLSearchParams({
                latitude: proj.siteLat, longitude: proj.siteLng,
                current: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
                timezone: 'auto',
            });
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            if (data?.current) {
                const code = data.current.weather_code;
                setWeatherSuggestion({
                    weather: WMO_TO_WEATHER[code] || 'oblačno',
                    temperature: Math.round(data.current.temperature_2m),
                    icon: WMO_ICONS[code] || '🌡️',
                    wind: data.current.wind_speed_10m,
                    humidity: data.current.relative_humidity_2m,
                    code,
                });
            }
        } catch (e) { console.error('Weather suggest error:', e); setWeatherSuggestion(null); }
        setWeatherLoading(false);
    }, [projects]);

    const handleProjectChange = (projectId) => {
        update('projectId', projectId);
        if (projectId) fetchWeatherForProject(projectId);
        else setWeatherSuggestion(null);
    };

    const applyWeatherSuggestion = () => {
        if (!weatherSuggestion) return;
        setForm(f => ({ ...f, weather: weatherSuggestion.weather, temperature: String(weatherSuggestion.temperature) }));
        setWeatherSuggestion(null);
    };

    // Active projects for current user
    const activeProjects = useMemo(() => {
        if (isLeaderView) return projects.filter(p => leaderProjectIds.includes(p.id));
        if (isWorker) return projects.filter(p => (p.workers || []).includes(workerFilterId) && p.status === 'aktivan');
        return projects.filter(p => p.status === 'aktivan');
    }, [projects, isLeaderView, leaderProjectIds, isWorker, workerFilterId]);

    // Filtered logs
    const filtered = useMemo(() => {
        let list = (dailyLogs || []).filter(l => l.status !== 'obrisan');
        if (isWorker) list = list.filter(l => l.createdById === workerFilterId);
        if (isLeaderView) list = list.filter(l => leaderProjectIds.includes(l.projectId));
        if (filters.project) list = list.filter(l => l.projectId === filters.project);
        if (filters.weather !== 'all') list = list.filter(l => l.weather === filters.weather);
        if (filters.status !== 'all') list = list.filter(l => (l.status || 'odobreno') === filters.status);
        if (filters.dateFrom) list = list.filter(l => l.date >= filters.dateFrom);
        if (filters.dateTo) list = list.filter(l => l.date <= filters.dateTo);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            list = list.filter(l =>
                (l.workDescription || '').toLowerCase().includes(s) ||
                (l.issues || '').toLowerCase().includes(s) ||
                (l.notes || '').toLowerCase().includes(s)
            );
        }
        return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [dailyLogs, filters, workerFilterId, leaderProjectIds]);

    const pg = usePagination(filtered.length, [filters, workerFilterId]);

    // Photo handling
    const handlePhotos = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        const maxPhotos = 5;
        const currentCount = (form.photos || []).length + photoQueue.length;
        if (currentCount + files.length > maxPhotos) {
            alert(`Maksimalno ${maxPhotos} fotografija po unosu`);
            return;
        }
        const compressed = [];
        const total = Math.min(files.length, maxPhotos - currentCount);
        setCompressProgress({ current: 0, total });
        for (let i = 0; i < total; i++) {
            const file = files[i];
            if (file.size > 10 * 1024 * 1024) { toast.warning(`${file.name} je prevelika (max 10MB)`); continue; }
            setCompressProgress({ current: i + 1, total });
            const c = await compressImage(file);
            compressed.push(c);
        }
        setCompressProgress(null);
        setPhotoQueue(prev => [...prev, ...compressed]);
    };

    const removePhoto = (idx) => setPhotoQueue(prev => prev.filter((_, i) => i !== idx));
    const removeExistingPhoto = (idx) => setForm(f => ({ ...f, photos: (f.photos || []).filter((_, i) => i !== idx) }));

    const openAdd = () => { setForm(blankForm()); setPhotoQueue([]); setEditId(null); setShowForm(true); };
    const openEdit = (log) => {
        setForm({
            date: log.date || today(),
            projectId: log.projectId || '',
            weather: log.weather || 'sunčano',
            temperature: log.temperature || '',
            workersPresent: log.workersPresent || '',
            workDescription: log.workDescription || '',
            materialsUsed: log.materialsUsed || '',
            equipmentUsed: log.equipmentUsed || '',
            issues: log.issues || '',
            safetyNotes: log.safetyNotes || '',
            notes: log.notes || '',
            photos: log.photos || [],
        });
        setPhotoQueue([]);
        setEditId(log.id);
        setShowForm(true);
    };

    const doSave = async () => {
        if (!form.projectId) return alert('Odaberite projekt');
        if (!form.workDescription && !form.notes) return alert('Unesite opis rada ili napomene');

        // M-7: Upload new photos to Firebase Storage
        const logId = editId || genId();
        const uploadedPhotos = [];
        for (const ph of photoQueue) {
            if (ph.data && ph.data.startsWith('data:')) {
                const storagePath = `photos/dailyLogs/${logId}/${Date.now()}_${ph.name}`;
                const url = await uploadToStorage(ph.data, storagePath);
                uploadedPhotos.push({ name: ph.name, type: ph.type, data: url, size: ph.size });
            } else {
                uploadedPhotos.push(ph);
            }
        }
        const allPhotos = [...(form.photos || []), ...uploadedPhotos];

        if (editId) {
            await updateDoc('dailyLogs', editId, { ...form, photos: allPhotos, updatedAt: new Date().toISOString() });
            await addAuditLog('DAILY_LOG_UPDATED', `Dnevnik za ${fmtDate(form.date)} ažuriran`);
        } else {
            // Determine initial status based on who creates it
            let initialStatus = 'odobreno'; // admin creates → auto-approved
            if (isWorker) initialStatus = 'na čekanju'; // worker → needs leader approval
            else if (isLeaderView) initialStatus = 'odobreno voditeljem'; // leader → needs admin approval

            const newLog = {
                id: logId,
                ...form,
                photos: allPhotos,
                status: initialStatus,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.name,
                createdById: workerFilterId || currentUser?.id,
                source: isWorker ? 'radnik' : isLeaderView ? 'voditelj' : 'admin',
            };
            await addDoc('dailyLogs', newLog);
            await addAuditLog('DAILY_LOG_CREATED', `Novi dnevnik za ${fmtDate(form.date)} — ${projects.find(p => p.id === form.projectId)?.name || '?'}`);
        }
        setShowForm(false);
        setPhotoQueue([]);
    };

    // Approval actions
    const approveLog = async (log) => {
        if (isLeaderView) {
            await updateDoc('dailyLogs', log.id, { status: 'odobreno voditeljem', approvedByLeader: currentUser?.name, leaderApprovedAt: new Date().toISOString() });
            await addAuditLog('DAILY_LOG_LEADER_APPROVED', `Voditelj odobrio dnevnik: ${fmtDate(log.date)} — ${projects.find(p => p.id === log.projectId)?.name}`);
        } else if (isAdmin) {
            await updateDoc('dailyLogs', log.id, { status: 'odobreno', approvedBy: currentUser?.name, approvedAt: new Date().toISOString() });
            await addAuditLog('DAILY_LOG_APPROVED', `Admin odobrio dnevnik: ${fmtDate(log.date)}`);
        }
    };
    const rejectLog = async (log) => {
        const reason = prompt('Razlog odbijanja:');
        if (reason === null) return;
        await updateDoc('dailyLogs', log.id, { status: 'odbijen', rejectReason: reason, rejectedBy: currentUser?.name });
        await addAuditLog('DAILY_LOG_REJECTED', `Dnevnik odbijen: ${fmtDate(log.date)} — ${reason}`);
    };

    const statusInfo = (s) => ({
        'na čekanju': { bg: 'rgba(234,179,8,0.1)', color: C.yellow, label: '⏳ Na čekanju' },
        'odobreno voditeljem': { bg: 'rgba(59,130,246,0.1)', color: '#2563EB', label: '✓ Voditelj odobrio' },
        'odobreno': { bg: 'rgba(16,185,129,0.1)', color: '#10B981', label: '✅ Odobreno' },
        'odbijen': { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', label: '❌ Odbijeno' },
    }[s] || { bg: 'rgba(16,185,129,0.1)', color: '#10B981', label: '✅ Odobreno' });

    const canApprove = (log) => {
        if (isLeaderView && log.status === 'na čekanju') return true; // leader approves worker logs
        if (isAdmin && (log.status === 'na čekanju' || log.status === 'odobreno voditeljem')) return true; // admin approves all
        return false;
    };

    const doDelete = async (id) => {
        if (!(await confirm('Arhivirati ovaj dnevnik? Podaci ostaju sačuvani.'))) return;
        await updateDoc('dailyLogs', id, { status: 'obrisan', deletedAt: new Date().toISOString() });
        await addAuditLog('DAILY_LOG_ARCHIVED', `Dnevnik arhiviran`);
    };

    const detailLog = detailId ? (dailyLogs || []).find(l => l.id === detailId) : null;

    // Weather icons
    const weatherIcons = { 'sunčano': '☀️', 'oblačno': '⛅', 'kiša': '🌧️', 'snijeg': '❄️', 'vjetar': '💨', 'magla': '🌫️' };
    const weatherOptions = ['sunčano', 'oblačno', 'kiša', 'snijeg', 'vjetar', 'magla'];

    // Stats
    const totalLogs = filtered.length;
    const logsThisWeek = filtered.filter(l => {
        const d = new Date(l.date);
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
    }).length;
    const logsByWeather = weatherOptions.reduce((acc, w) => { acc[w] = filtered.filter(l => l.weather === w).length; return acc; }, {});
    const logsWithPhotos = filtered.filter(l => (l.photos || []).length > 0).length;

    // PDF Export
    const exportPDF = () => {
        toast.info('Generiram PDF...');
        if (!filtered.length) return alert('Nema podataka za export');
        const company = companyProfile?.companyName || 'Vi-Di-Sef';
        const html = `
            <html><head><title>Dnevnik gradilišta - ${company}</title>
            <style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#333;border-bottom:2px solid #F97316;padding-bottom:10px}
            .log{margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:8px;page-break-inside:avoid}
            .log-header{display:flex;justify-content:space-between;font-weight:700;margin-bottom:10px}
            .field{margin:6px 0}.field-label{font-weight:700;color:#666;font-size:12px;text-transform:uppercase}
            .photos{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
            .photos img{width:120px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd}
            @media print{.no-print{display:none}}</style></head><body>
            <h1> ${company} — Dnevnik gradilišta</h1>
            <p>Izvoz: ${fmtDate(today())} | ${filtered.length} unosa</p>
            ${filtered.map(l => {
            const p = projects.find(x => x.id === l.projectId);
            return `<div class="log">
                    <div class="log-header"><span>${fmtDate(l.date)} — ${p?.name || '?'}</span><span>${weatherIcons[l.weather] || ''} ${l.weather || ''} ${l.temperature ? l.temperature + '°C' : ''}</span></div>
                    ${l.workersPresent ? `<div class="field"><div class="field-label">Prisutni radnici</div>${l.workersPresent}</div>` : ''}
                    ${l.workDescription ? `<div class="field"><div class="field-label">Opis radova</div>${l.workDescription}</div>` : ''}
                    ${l.materialsUsed ? `<div class="field"><div class="field-label">Materijali</div>${l.materialsUsed}</div>` : ''}
                    ${l.equipmentUsed ? `<div class="field"><div class="field-label">Oprema</div>${l.equipmentUsed}</div>` : ''}
                    ${l.issues ? `<div class="field"><div class="field-label">⚠️ Problemi</div>${l.issues}</div>` : ''}
                    ${l.safetyNotes ? `<div class="field"><div class="field-label">🛡️ Sigurnost</div>${l.safetyNotes}</div>` : ''}
                    ${l.notes ? `<div class="field"><div class="field-label">Napomene</div>${l.notes}</div>` : ''}
                    ${(l.photos || []).length > 0 ? `<div class="photos">${l.photos.map(ph => `<img src="${ph.data}" />`).join('')}</div>` : ''}
                    <div style="font-size:11px;color:#999;margin-top:8px">Autor: ${l.createdBy || '?'}</div>
                </div>`;
        }).join('')}
            </body></html>`;
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
                         Dnevnik gradilišta
                    </div>
                    <div style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>
                        Dnevni izvještaji, vremenske prilike, foto dokumentacija
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={exportPDF} style={{ ...styles.btnSecondary, fontSize: 13, padding: '8px 14px' }}>📄 PDF</button>
                    <button onClick={openAdd} style={styles.btn}><Icon name="plus" size={16} /> Novi unos</button>
                </div>
            </div>

            {/* Stats */}
            {!isWorker && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: `${C.accent}18`, borderRadius: 12, padding: 12, color: C.accent }}><Icon name="file" size={22} /></div>
                        <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ukupno</div><div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{totalLogs}</div></div>
                    </div>
                    <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'rgba(59,130,246,0.12)', borderRadius: 12, padding: 12, color: '#2563EB' }}><Icon name="calendar" size={22} /></div>
                        <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Ovaj tjedan</div><div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{logsThisWeek}</div></div>
                    </div>
                    <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'rgba(34,197,94,0.12)', borderRadius: 12, padding: 12, color: C.green }}><Icon name="eye" size={22} /></div>
                        <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>S fotografijama</div><div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{logsWithPhotos}</div></div>
                    </div>
                    <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'rgba(234,179,8,0.12)', borderRadius: 12, padding: 12, color: C.yellow }}>☀️</div>
                        <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Najčešće vrijeme</div><div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{weatherOptions.reduce((a, b) => (logsByWeather[a] || 0) >= (logsByWeather[b] || 0) ? a : b, 'sunčano')}</div></div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ ...styles.card, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
                    <div><label style={styles.label}>Pretraži</label><Input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Opis, problemi..." /></div>
                    <div><label style={styles.label}>Projekt</label><Select value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}><option value="">Svi</option>{activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
                    <div><label style={styles.label}>Vrijeme</label><Select value={filters.weather} onChange={e => setFilters(f => ({ ...f, weather: e.target.value }))}><option value="all">Sve</option>{weatherOptions.map(w => <option key={w} value={w}>{weatherIcons[w]} {w}</option>)}</Select></div>
                    <div><label style={styles.label}>Status</label><Select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><option value="all">Svi</option><option value="na čekanju">⏳ Na čekanju</option><option value="odobreno voditeljem">✓ Voditelj</option><option value="odobreno">✅ Odobreno</option><option value="odbijen">❌ Odbijeno</option></Select></div>
                    <div><label style={styles.label}>Od</label><Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
                    <div><label style={styles.label}>Do</label><Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
                </div>
            </div>

            {/* Log list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pg.paginate(filtered).map(log => {
                    const p = projects.find(x => x.id === log.projectId);
                    const photoCount = (log.photos || []).length;
                    return (
                        <div key={log.id} style={{ ...styles.card, cursor: 'pointer', transition: 'box-shadow 0.2s' }} onClick={() => setDetailId(log.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{fmtDate(log.date)}</span>
                                        <span style={{ fontSize: 12, color: C.textMuted }}>•</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{p?.name || '—'}</span>
                                        {(() => { const si = statusInfo(log.status); return <span style={{ padding: '2px 8px', borderRadius: 6, background: si.bg, fontSize: 11, fontWeight: 700, color: si.color }}>{si.label}</span>; })()}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.08)', fontSize: 12, fontWeight: 600 }}>
                                            {weatherIcons[log.weather]} {log.weather} {log.temperature ? `${log.temperature}°C` : ''}
                                        </span>
                                        {log.workersPresent && <span style={{ fontSize: 12, color: C.textMuted }}>👷 {log.workersPresent} radnika</span>}
                                        {photoCount > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>📷 {photoCount} foto</span>}
                                        {log.issues && <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', fontSize: 11, fontWeight: 600, color: C.red }}>⚠️ Problem</span>}
                                    </div>
                                    {log.workDescription && (
                                        <div style={{ fontSize: 13, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                                            {log.workDescription}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: C.textMuted }}>{log.createdBy}</span>
                                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                        {canApprove(log) && <>
                                            <button onClick={() => approveLog(log)} style={{ ...styles.btnSmall, background: C.green, color: '#fff', borderColor: C.green }}>✓ Odobri</button>
                                            <button onClick={() => rejectLog(log)} style={{ ...styles.btnSmall, background: C.red, color: '#fff', borderColor: C.red }}>✕ Odbij</button>
                                        </>}
                                        {(!isWorker || log.createdById === workerFilterId) && <>
                                            <button onClick={() => openEdit(log)} style={styles.btnSmall}><Icon name="edit" size={12} /></button>
                                            <button onClick={() => doDelete(log.id)} style={styles.btnDanger}><Icon name="trash" size={12} /></button>
                                        </>}
                                    </div>
                                </div>
                            </div>
                            {/* Photo thumbnails */}
                            {photoCount > 0 && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }}>
                                    {(log.photos || []).slice(0, 4).map((ph, i) => (
                                        <img key={i} src={ph.data} alt={`Foto ${i + 1}`} style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                                    ))}
                                    {photoCount > 4 && <div style={{ width: 60, height: 45, borderRadius: 6, background: C.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.textMuted, fontWeight: 700, flexShrink: 0 }}>+{photoCount - 4}</div>}
                                </div>
                            )}
                        </div>
                    );
                })}
                {filtered.length === 0 && <div style={{ ...styles.card, textAlign: 'center', color: C.textMuted, padding: 40 }}>Nema dnevničkih unosa. Kliknite "Novi unos" za početak.</div>}
                {filtered.length > 0 && <Pagination {...pg} totalItems={filtered.length} label="unosa" />}
            </div>

            {/* Detail Modal */}
            {detailLog && (
                <Modal title={` Dnevnik: ${fmtDate(detailLog.date)}`} onClose={() => setDetailId(null)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div><span style={styles.label}>Datum</span><div style={{ fontWeight: 600 }}>{fmtDate(detailLog.date)}</div></div>
                        <div><span style={styles.label}>Projekt</span><div style={{ fontWeight: 600, color: C.accent }}>{projects.find(p => p.id === detailLog.projectId)?.name || '—'}</div></div>
                        <div><span style={styles.label}>Vrijeme</span><div>{weatherIcons[detailLog.weather]} {detailLog.weather} {detailLog.temperature ? `${detailLog.temperature}°C` : ''}</div></div>
                        <div><span style={styles.label}>Prisutni radnici</span><div>{detailLog.workersPresent || '—'}</div></div>
                    </div>

                    {detailLog.workDescription && <div style={{ marginBottom: 12 }}><span style={styles.label}>Opis radova</span><div style={{ padding: '10px 14px', borderRadius: 8, background: C.bgElevated, fontSize: 13, whiteSpace: 'pre-wrap' }}>{detailLog.workDescription}</div></div>}
                    {detailLog.materialsUsed && <div style={{ marginBottom: 12 }}><span style={styles.label}>Korišteni materijali</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', fontSize: 13 }}>{detailLog.materialsUsed}</div></div>}
                    {detailLog.equipmentUsed && <div style={{ marginBottom: 12 }}><span style={styles.label}>Korištena oprema</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', fontSize: 13 }}>{detailLog.equipmentUsed}</div></div>}
                    {detailLog.issues && <div style={{ marginBottom: 12 }}><span style={styles.label}>⚠️ Problemi / Zastoji</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', fontSize: 13, color: C.red }}>{detailLog.issues}</div></div>}
                    {detailLog.safetyNotes && <div style={{ marginBottom: 12 }}><span style={styles.label}>🛡️ Sigurnosne napomene</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(234,179,8,0.08)', fontSize: 13, color: C.yellow }}>{detailLog.safetyNotes}</div></div>}
                    {detailLog.notes && <div style={{ marginBottom: 12 }}><span style={styles.label}>Napomene</span><div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', fontSize: 13 }}>{detailLog.notes}</div></div>}

                    {/* Photos gallery */}
                    {(detailLog.photos || []).length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <span style={styles.label}>📷 Fotografije ({detailLog.photos.length})</span>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                                {detailLog.photos.map((ph, i) => (
                                    <a key={i} href={ph.data} target="_blank" rel="noopener noreferrer">
                                        <img src={ph.data} alt={ph.name || `Foto ${i + 1}`} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer' }} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                        Autor: {detailLog.createdBy || '?'} {detailLog.createdAt && `• ${new Date(detailLog.createdAt).toLocaleString('hr')}`}
                    </div>
                </Modal>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <Modal title={editId ? 'Uredi dnevnik' : 'Novi dnevnik gradilišta'} onClose={() => setShowForm(false)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        <Field label="Datum" required><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></Field>
                        <Field label="Projekt" required>
                            <Select value={form.projectId} onChange={e => handleProjectChange(e.target.value)}>
                                <option value="">— Odaberi projekt —</option>
                                {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </Field>
                        <Field label="Vremenske prilike">
                            <Select value={form.weather} onChange={e => update('weather', e.target.value)}>
                                {weatherOptions.map(w => <option key={w} value={w}>{weatherIcons[w]} {w}</option>)}
                            </Select>
                        </Field>
                        <Field label="Temperatura (°C)"><Input type="number" value={form.temperature} onChange={e => update('temperature', e.target.value)} placeholder="npr. 22" /></Field>
                        <Field label="Br. prisutnih radnika"><Input value={form.workersPresent} onChange={e => update('workersPresent', e.target.value)} placeholder="npr. 8" /></Field>
                    </div>

                    {/* Auto-weather suggestion */}
                    {(weatherSuggestion || weatherLoading) && (
                        <div style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(249,115,22,0.06))', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            {weatherLoading ? (
                                <span style={{ fontSize: 13, color: C.textMuted }}>⏳ Učitavam vremenske uvjete...</span>
                            ) : weatherSuggestion && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 28 }}>{weatherSuggestion.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                                                {weatherSuggestion.temperature}°C — {weatherSuggestion.weather}
                                            </div>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>
                                                💨 {weatherSuggestion.wind} km/h &nbsp; 💧 {weatherSuggestion.humidity}%
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={applyWeatherSuggestion} style={{ ...styles.btn, fontSize: 12, padding: '6px 14px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                                        ✓ Primijeni
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                        <Field label="Opis izvršenih radova *">
                            <Textarea value={form.workDescription} onChange={e => update('workDescription', e.target.value)} placeholder="Što je danas napravljeno na gradilištu..." rows={3} />
                        </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 12 }}>
                        <Field label="Korišteni materijali">
                            <Textarea value={form.materialsUsed} onChange={e => update('materialsUsed', e.target.value)} placeholder="Beton, armatura, cigle..." rows={2} />
                        </Field>
                        <Field label="Korištena oprema">
                            <Textarea value={form.equipmentUsed} onChange={e => update('equipmentUsed', e.target.value)} placeholder="Dizalica, mješalica..." rows={2} />
                        </Field>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <Field label="⚠️ Problemi / Zastoji">
                            <Textarea value={form.issues} onChange={e => update('issues', e.target.value)} placeholder="Kašnjenje materijala, loše vrijeme..." rows={2} />
                        </Field>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <Field label="🛡️ Sigurnosne napomene">
                            <Textarea value={form.safetyNotes} onChange={e => update('safetyNotes', e.target.value)} placeholder="Incidenti, zaštitna oprema..." rows={2} />
                        </Field>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <Field label="Napomene">
                            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Dodatne napomene..." rows={2} />
                        </Field>
                    </div>

                    {/* Photo upload */}
                    <div style={{ marginTop: 16 }}>
                        <span style={styles.label}>📷 Fotografije (max 5)</span>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                            {/* Existing photos */}
                            {(form.photos || []).map((ph, i) => (
                                <div key={`ex-${i}`} style={{ position: 'relative' }}>
                                    <img src={ph.data} alt={`Foto ${i + 1}`} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
                                    <button onClick={() => removeExistingPhoto(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                </div>
                            ))}
                            {/* New photos */}
                            {photoQueue.map((ph, i) => (
                                <div key={`new-${i}`} style={{ position: 'relative' }}>
                                    <img src={ph.data} alt={`Nova ${i + 1}`} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: `2px solid ${C.green}` }} />
                                    <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                </div>
                            ))}
                            {/* Upload button */}
                            {(form.photos || []).length + photoQueue.length < 5 && (
                                <label aria-label="Dodaj fotografiju" style={{ width: 80, height: 60, borderRadius: 8, border: `2px dashed ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, color: C.textMuted, gap: 2 }}>
                                    <Icon name="plus" size={16} />
                                    <span>Dodaj</span>
                                    <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: 'none' }} aria-label="Upload fotografija" />
                                </label>
                            )}
                            {compressProgress && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.accent, fontWeight: 600 }}>
                                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                                    Kompresija {compressProgress.current}/{compressProgress.total}...
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                        <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={doSave} style={styles.btn}><Icon name="check" size={16} /> Spremi</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
