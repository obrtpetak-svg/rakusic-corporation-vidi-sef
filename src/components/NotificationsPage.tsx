import React, { useState, useMemo } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { useApp, update as updateDoc } from '../context/AppContext';
import { Icon, StatusBadge, Pagination, usePagination, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, fmtDate, fmtDateTime, diffMins } from '../utils/helpers';

// ── Notification Item Card ───────────────────────────────────────────────
const NotifItem = React.memo(({ icon, iconColor, iconBg, title, subtitle, detail, attachment, onApprove, onReject, approveLabel = 'Odobri', rejectLabel = 'Odbij', selected, onToggle }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', borderBottom: '1px solid var(--divider)',
        gap: 12, flexWrap: 'wrap',
        background: selected ? 'rgba(217,93,8,0.04)' : 'transparent',
        animation: 'cardEntry 0.4s cubic-bezier(0.16,1,0.3,1) both'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={selected} onChange={onToggle} style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 200 }}>
            <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: iconBg, color: iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <Icon name={icon} size={16} />
            </div>
            <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
                {detail && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>{detail}</div>}
                {attachment && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>📎 {attachment}</div>}
            </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onApprove} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--green-light)', color: 'var(--green)',
                border: 'none', borderRadius: 10, padding: '8px 14px',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                transition: 'all 0.15s'
            }}>
                <Icon name="check" size={14} /> {approveLabel}
            </button>
            <button onClick={onReject} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--red-light)', color: 'var(--red)',
                border: 'none', borderRadius: 10, padding: '8px 14px',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                transition: 'all 0.15s'
            }}>
                <Icon name="close" size={14} /> {rejectLabel}
            </button>
        </div>
    </div>
));

// ── Section Header ───────────────────────────────────────────────────────
const SectionHeader = React.memo(({ icon, iconColor, iconBg, title, count }) => (
    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: iconBg, color: iconColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <Icon name={icon} size={14} />
        </div>
        {title}
        <span style={{
            background: 'var(--red-light)', color: 'var(--red)',
            borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '2px 8px',
            fontVariantNumeric: 'tabular-nums'
        }}>{count}</span>
    </div>
));

// ══════════════════════════════════════════════════════════════════════════
export function NotificationsPage() {
    const confirm = useConfirm();
    const { timesheets, invoices, otpremnice, workers, projects, currentUser, addAuditLog } = useApp();
    const [selectedIds, setSelectedIds] = useState(new Set());

    const pendingTs = timesheets.filter(t => t.status === 'na čekanju');
    const pendingInv = invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik');
    const pendingOtp = otpremnice.filter(o => o.status === 'na čekanju');

    // All items combined for pagination
    const allItems = useMemo(() => [
        ...pendingTs.map(t => ({ ...t, _type: 'ts' })),
        ...pendingInv.map(i => ({ ...i, _type: 'inv' })),
        ...pendingOtp.map(o => ({ ...o, _type: 'otp' })),
    ], [pendingTs, pendingInv, pendingOtp]);

    const pg = usePagination(allItems.length, [allItems.length], 50);
    const pageItems = allItems.slice(pg.startIndex, pg.endIndex + 1);

    const approveTs = async (t) => {
        await updateDoc('timesheets', t.id, { status: 'odobren', approvedAt: new Date().toISOString(), approvedBy: currentUser?.name });
        await addAuditLog('TS_APPROVED', `${workers.find(w => w.id === t.workerId)?.name}: ${t.date}`);
    };
    const rejectTs = async (t) => { const r = prompt('Razlog:'); if (r === null) return; await updateDoc('timesheets', t.id, { status: 'odbijen', rejectReason: r, rejectedBy: currentUser?.name }); };
    const approveInv = async (i) => { await updateDoc('invoices', i.id, { status: 'prihvaćena', approvedBy: currentUser?.name }); };
    const rejectInv = async (i) => { const r = prompt('Razlog:'); if (r === null) return; await updateDoc('invoices', i.id, { status: 'odbijena', rejectReason: r }); };
    const approveOtp = async (o) => { await updateDoc('otpremnice', o.id, { status: 'prihvaćena', approvedBy: currentUser?.name }); };
    const rejectOtp = async (o) => { const r = prompt('Razlog:'); if (r === null) return; await updateDoc('otpremnice', o.id, { status: 'odbijena', rejectReason: r }); };

    const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectAll = () => setSelectedIds(new Set(pageItems.map(i => i.id)));
    const deselectAll = () => setSelectedIds(new Set());
    const isAllSelected = pageItems.length > 0 && pageItems.every(i => selectedIds.has(i.id));

    const bulkApprove = async () => {
        if (!selectedIds.size) return;
        if (!(await confirm(`Odobri ${selectedIds.size} stavki?`))) return;
        for (const item of allItems.filter(i => selectedIds.has(i.id))) {
            if (item._type === 'ts') await approveTs(item);
            else if (item._type === 'inv') await approveInv(item);
            else if (item._type === 'otp') await approveOtp(item);
        }
        setSelectedIds(new Set());
    };

    const bulkReject = async () => {
        if (!selectedIds.size) return;
        const r = prompt(`Odbij ${selectedIds.size} stavki — razlog:`);
        if (r === null) return;
        for (const item of allItems.filter(i => selectedIds.has(i.id))) {
            if (item._type === 'ts') await updateDoc('timesheets', item.id, { status: 'odbijen', rejectReason: r, rejectedBy: currentUser?.name });
            else if (item._type === 'inv') await updateDoc('invoices', item.id, { status: 'odbijena', rejectReason: r });
            else if (item._type === 'otp') await updateDoc('otpremnice', item.id, { status: 'odbijena', rejectReason: r });
        }
        setSelectedIds(new Set());
    };

    const total = allItems.length;

    const renderItem = (item) => {
        if (item._type === 'ts') {
            const w = workers.find(x => x.id === item.workerId);
            const p = projects.find(x => x.id === item.projectId);
            const mins = diffMins(item.startTime, item.endTime) - (item.breakMins || 0);
            return <NotifItem key={item.id} icon="clock" iconColor="var(--accent)" iconBg="var(--accent-light)" title={`${w?.name || '—'} → ${p?.name || '—'}`} subtitle={`${fmtDate(item.date)} · ${item.startTime}–${item.endTime} · ${(mins / 60).toFixed(1)}h${item.gpsLocation ? ' · 📍 GPS' : ''}`} detail={item.description} attachment={item.invoiceFile ? 'Priložen račun' : null} onApprove={() => approveTs(item)} onReject={() => rejectTs(item)} selected={selectedIds.has(item.id)} onToggle={() => toggleSelect(item.id)} />;
        }
        if (item._type === 'inv') {
            const w = workers.find(x => x.id === item.workerId);
            return <NotifItem key={item.id} icon="invoice" iconColor="var(--blue)" iconBg="var(--blue-light)" title={`${item.invoiceNumber || '—'} — ${w?.name || item.supplier || '—'}`} subtitle={`${fmtDate(item.date)}${item.amount ? ` · ${item.amount}€` : ''}${item.description ? ` · ${item.description}` : ''}`} attachment={item.file?.name} onApprove={() => approveInv(item)} onReject={() => rejectInv(item)} approveLabel="Prihvati" selected={selectedIds.has(item.id)} onToggle={() => toggleSelect(item.id)} />;
        }
        if (item._type === 'otp') {
            return <NotifItem key={item.id} icon="file" iconColor="var(--purple)" iconBg="var(--purple-light)" title={item.otpremnicaNumber || '—'} subtitle={`${fmtDate(item.date)} · ${item.sender} → ${item.receiver}`} onApprove={() => approveOtp(item)} onReject={() => rejectOtp(item)} approveLabel="Prihvati" selected={selectedIds.has(item.id)} onToggle={() => toggleSelect(item.id)} />;
        }
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                     Obavijesti
                </div>
                {total > 0 && (
                    <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 13, fontWeight: 800, padding: '3px 10px', fontVariantNumeric: 'tabular-nums', animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
                        {total}
                    </span>
                )}
            </div>

            {/* Bulk actions toolbar */}
            {total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: selectedIds.size > 0 ? 'rgba(217,93,8,0.06)' : 'var(--bg-elevated)', border: `1px solid ${selectedIds.size > 0 ? 'rgba(217,93,8,0.2)' : 'var(--border)'}`, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>
                        <input type="checkbox" checked={isAllSelected} onChange={() => isAllSelected ? deselectAll() : selectAll()} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                        {isAllSelected ? 'Odznači sve' : 'Označi sve'}
                    </label>
                    {selectedIds.size > 0 && (
                        <>
                            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(217,93,8,0.08)' }}>
                                {selectedIds.size} odabrano
                            </span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                <button onClick={bulkApprove} style={{ ...styles.btn, background: 'var(--green)', fontSize: 13, padding: '8px 16px' }}>
                                    ✅ Odobri ({selectedIds.size})
                                </button>
                                <button onClick={bulkReject} style={{ ...styles.btn, background: 'var(--red)', fontSize: 13, padding: '8px 16px' }}>
                                    ❌ Odbij ({selectedIds.size})
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Empty state */}
            {total === 0 && (
                <div style={{ ...styles.card, textAlign: 'center', padding: 60, animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Sve čisto!</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Nema ničega na čekanju</div>
                </div>
            )}

            {/* Items */}
            {total > 0 && (
                <div style={{ ...styles.card, marginBottom: 20 }}>
                    {pendingTs.length > 0 && pageItems.some(i => i._type === 'ts') && (
                        <SectionHeader icon="clock" iconColor="var(--accent)" iconBg="var(--accent-light)" title="Radni sati" count={pendingTs.length} />
                    )}
                    {pageItems.filter(i => i._type === 'ts').map(renderItem)}

                    {pendingInv.length > 0 && pageItems.some(i => i._type === 'inv') && (
                        <SectionHeader icon="invoice" iconColor="var(--blue)" iconBg="var(--blue-light)" title="Računi" count={pendingInv.length} />
                    )}
                    {pageItems.filter(i => i._type === 'inv').map(renderItem)}

                    {pendingOtp.length > 0 && pageItems.some(i => i._type === 'otp') && (
                        <SectionHeader icon="file" iconColor="var(--purple)" iconBg="var(--purple-light)" title="Otpremnice" count={pendingOtp.length} />
                    )}
                    {pageItems.filter(i => i._type === 'otp').map(renderItem)}
                </div>
            )}

            {/* Pagination */}
            {total > pg.pageSize && (
                <Pagination {...pg} totalItems={total} label="stavki" />
            )}
        </div>
    );
}
