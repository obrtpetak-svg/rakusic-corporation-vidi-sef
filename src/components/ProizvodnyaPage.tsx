import { useState, useMemo, useEffect } from 'react';
import { useApp, update as updateDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Textarea, Select, StatusBadge, WorkerCheckboxList, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate, diffMins } from '../utils/helpers';
import { STAGES, QC_CHECKLISTS, COST_CATEGORIES, STEEL_GRADES, SPEC_UNITS, PROFILE_WEIGHTS, TEMPLATES, fmtDuration, genOrderNumber } from './proizvodnja/proizvodnja-constants';
import { useProizvodnyaActions } from './proizvodnja/useProizvodnyaActions';
import { ProizvodnyaDetailView } from './proizvodnja/ProizvodnyaDetailView';

export function ProizvodnyaPage({ leaderProjectIds }) {
    const { production, workers, projects, currentUser, loadProduction } = useApp();
    useEffect(() => { loadProduction?.(); }, [loadProduction]);

    const [activeTab, setActiveTab] = useState('pipeline');
    const [detailId, setDetailId] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStage, setFilterStage] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterDeadline, setFilterDeadline] = useState('all');
    const isMobile = useIsMobile();
    const isAdmin = currentUser?.role === 'admin';
    const isLeader = currentUser?.role === 'leader';
    const canManage = isAdmin || isLeader;

    const allOrders = production || [];
    const activeOrders = allOrders.filter(o => o.status !== 'arhiviran');
    const archivedOrders = allOrders.filter(o => o.status === 'arhiviran');
    const activeWorkers = workers.filter(w => w.active !== false && w.role !== 'admin');

    // Extract all actions from custom hook
    const actions = useProizvodnyaActions(allOrders);
    const {
        form, editId, showForm, setShowForm, showTemplateChooser, setShowTemplateChooser, upd,
        openAdd, openFromTemplate, openEdit, doSave, doDelete: doDeleteRaw,
        signOffOrder, setSignOffOrder, signOffNote, setSignOffNote, signOffConfirmed, setSignOffConfirmed,
        requestAdvance, confirmSignOff, initSigCanvas, clearSigCanvas,
        archiveOrder, unarchiveOrder,
        showCostForm, setShowCostForm, costForm, setCostForm, addCostItem, removeCostItem,
        handleFileUpload, removeFile,
        commentText, setCommentText, addComment, removeComment,
        handleStagePhoto,
        exportCSV, exportPDF,
    } = actions;

    // Wrap doDelete to also clear detailId
    const doDelete = async (id) => {
        await doDeleteRaw(id);
        if (detailId === id) setDetailId(null);
    };

    // Wrap openEdit to also clear detailId
    const openEditWrapped = (o) => {
        openEdit(o);
        setDetailId(null);
    };

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
        const allDone = allOrders.filter(o => o.stage === 'zavrseno');
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

    // ── Detail View ──
    const detailOrder = detailId ? allOrders.find(o => o.id === detailId) : null;

    if (detailOrder) {
        return (
            <ProizvodnyaDetailView
                detailOrder={detailOrder}
                actions={actions}
                canManage={canManage}
                projects={projects}
                activeWorkers={activeWorkers}
                isMobile={isMobile}
                currentUser={currentUser}
                setDetailId={setDetailId}
            />
        );
    }
    // ── Main View ──
    const stageColor = (stage) => STAGES.find(s => s.id === stage)?.color || C.textMuted;
    const stageLabel = (stage) => STAGES.find(s => s.id === stage);
    
    // Pipeline card component
    const OrderCard = ({ order }) => {
        const daysLeft = order.deadline ? Math.ceil((new Date(order.deadline).getTime() - Date.now()) / 86400000) : null;
        return (
            <div role="button" tabIndex={0} aria-label={`Narudžba ${order.orderNumber || order.clientName || ''}`} onClick={() => setDetailId(order.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setDetailId(order.id)} style={{ padding: '12px 14px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, cursor: 'pointer', marginBottom: 8, borderLeft: `4px solid ${stageColor(order.stage)}`, transition: 'all 0.2s' }}
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
                    <button onClick={() => exportCSV(activeTab === 'archive' ? archivedOrders : filtered)} style={styles.btnSecondary}>📊 CSV</button>
                    <button onClick={() => exportPDF(activeTab === 'archive' ? archivedOrders : filtered)} style={styles.btnSecondary}>📄 PDF</button>
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
                                                            <button onClick={() => openEditWrapped(o)} style={styles.btnSmall}><Icon name="edit" size={10} /></button>
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
