import { useState, useMemo } from 'react';
import { useApp, add as addDoc, update as updateDoc } from '../context/AppContext';
import { Icon, Modal, Field, Input, Select, useIsMobile } from './ui/SharedComponents';
import { C, styles, genId, today, fmtDate } from '../utils/helpers';

// ── Leave/Absence Types ──────────────────────────────────────────────────
const LEAVE_TYPES = [
    { id: 'godisnji', label: 'Godišnji odmor', emoji: '🏖️', color: '#1D4ED8', maxDays: 20 },
    { id: 'bolovanje', label: 'Bolovanje', emoji: '🤒', color: '#B91C1C', maxDays: null },
    { id: 'slobodan', label: 'Slobodan dan', emoji: '', color: '#7C3AED', maxDays: null },
    { id: 'placeni', label: 'Plaćeni dopust', emoji: '💼', color: '#047857', maxDays: 7 },
    { id: 'neplaceni', label: 'Neplaćeni dopust', emoji: '📝', color: '#B45309', maxDays: null },
];

export function LeaveTracker() {
    const { currentUser, workers, timesheets } = useApp();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ workerId: '', type: 'godisnji', dateFrom: today(), dateTo: today(), note: '' });
    const [saving, setSaving] = useState(false);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterWorker, setFilterWorker] = useState('sve');
    const isMobile = useIsMobile();
    const isAdmin = currentUser?.role === 'admin';

    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Get leave records from timesheets with type matching leave types
    const leaveRecords = useMemo(() => {
        const leaveTypeIds = LEAVE_TYPES.map(t => t.id);
        return timesheets.filter(t =>
            t.status !== 'obrisan' &&
            t.source === 'leave-tracker' &&
            leaveTypeIds.includes(t.type) &&
            t.date?.startsWith(String(filterYear))
        ).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }, [timesheets, filterYear]);

    // Days used per worker per type
    const summary = useMemo(() => {
        const map = {};
        leaveRecords.forEach(r => {
            const key = r.workerId;
            if (!map[key]) map[key] = {};
            if (!map[key][r.type]) map[key][r.type] = 0;
            // Count calendar days between dateFrom and dateTo
            const days = r.leaveDays || 1;
            map[key][r.type] += days;
        });
        return map;
    }, [leaveRecords]);

    // Calculate leave days between two dates
    const calcDays = (from, to) => {
        if (!from || !to) return 1;
        const d1 = new Date(from), d2 = new Date(to);
        let count = 0;
        for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++; // Skip weekends
        }
        return Math.max(count, 1);
    };

    const submit = async () => {
        if (!form.workerId && !isAdmin) {
            form.workerId = currentUser?.workerId || currentUser?.id;
        }
        if (!form.workerId) return alert('Odaberite radnika');
        setSaving(true);

        const leaveDays = calcDays(form.dateFrom, form.dateTo);

        // Create one record per leave day (easier to track)
        const d1 = new Date(form.dateFrom), d2 = new Date(form.dateTo);
        for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day === 0 || day === 6) continue; // Skip weekends
            const dateStr = d.toISOString().slice(0, 10);
            await addDoc('timesheets', {
                id: genId(),
                workerId: form.workerId,
                projectId: '',
                date: dateStr,
                startTime: '',
                endTime: '',
                breakMins: 0,
                description: form.note || LEAVE_TYPES.find(t => t.id === form.type)?.label,
                type: form.type,
                source: 'leave-tracker',
                status: 'na čekanju',
                leaveDays: 1,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.name,
                editLog: [],
            });
        }

        setSaving(false);
        setShowAdd(false);
        setForm({ workerId: '', type: 'godisnji', dateFrom: today(), dateTo: today(), note: '' });
    };

    const filteredRecords = filterWorker === 'sve'
        ? leaveRecords
        : leaveRecords.filter(r => r.workerId === filterWorker);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div className="u-fs-22 u-fw-800 u-color-text">🏖️ Godišnji odmori & odsutnosti</div>
                <button onClick={() => setShowAdd(true)} style={styles.btn}><Icon name="plus" size={16} /> Novi zahtjev</button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <Select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ width: 100 }}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
                {isAdmin && (
                    <Select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ width: 200 }}>
                        <option value="sve">Svi radnici</option>
                        {workers.filter(w => w.role !== 'admin').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </Select>
                )}
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${LEAVE_TYPES.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
                {LEAVE_TYPES.map(lt => {
                    const totalDays = Object.values(summary).reduce((s, ws) => s + (ws[lt.id] || 0), 0);
                    return (
                        <div key={lt.id} style={{ ...styles.card, textAlign: 'center', padding: '14px 8px' }}>
                            <div style={{ fontSize: 24, marginBottom: 4 }}>{lt.emoji}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: lt.color }}>{totalDays}</div>
                            <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase' }}>{lt.label}</div>
                            {lt.maxDays && <div className="u-stat-label">max {lt.maxDays} dana</div>}
                        </div>
                    );
                })}
            </div>

            {/* Worker breakdown (admin) */}
            {isAdmin && (
                <div style={{ ...styles.card, marginBottom: 20, overflowX: 'auto' }}>
                    <div className="u-section-title u-mb-12">👷 Po radnicima ({filterYear})</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                                <th style={{ textAlign: 'left', padding: '8px 10px', color: C.textDim }}>Radnik</th>
                                {LEAVE_TYPES.map(lt => (
                                    <th key={lt.id} style={{ textAlign: 'center', padding: '8px 6px', color: lt.color }}>{lt.emoji}</th>
                                ))}
                                <th style={{ textAlign: 'center', padding: '8px 10px', color: C.textDim }}>Ukupno</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workers.filter(w => w.role !== 'admin' && summary[w.id]).map(w => {
                                const ws = summary[w.id] || {};
                                const total = Object.values(ws).reduce((s, v) => s + v, 0);
                                return (
                                    <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}30` }}>
                                        <td style={{ padding: '8px 10px', fontWeight: 600, color: C.text }}>{w.name}</td>
                                        {LEAVE_TYPES.map(lt => (
                                            <td key={lt.id} style={{ textAlign: 'center', padding: '8px 6px', color: ws[lt.id] ? lt.color : C.textMuted }}>
                                                {ws[lt.id] || '—'}
                                            </td>
                                        ))}
                                        <td style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 800, color: C.accent }}>{total}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Recent records */}
            <div style={styles.card}>
                <div className="u-section-title u-mb-12">📋 Zapisi ({filterYear})</div>
                {filteredRecords.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, padding: 12 }}>Nema zapisa za {filterYear}.</div>}
                {filteredRecords.slice(0, 50).map(r => {
                    const w = workers.find(x => x.id === r.workerId);
                    const lt = LEAVE_TYPES.find(t => t.id === r.type) || LEAVE_TYPES[0];
                    return (
                        <div key={r.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: 14 }}>{lt.emoji}</span>{' '}
                                <span style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{w?.name || '—'}</span>{' '}
                                <span style={{ color: C.textMuted, fontSize: 12 }}>— {fmtDate(r.date)}</span>
                            </div>
                            <div className="u-flex-center u-gap-8">
                                <span style={{ fontSize: 11, color: lt.color, fontWeight: 600 }}>{lt.label}</span>
                                <span style={{ ...styles.badge(r.status === 'odobren' ? '34,197,94' : r.status === 'odbijen' ? '239,68,68' : '234,179,8'), fontSize: 10 }}>
                                    {r.status === 'odobren' ? 'ODOBREN' : r.status === 'odbijen' ? 'ODBIJEN' : 'ČEKA'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add modal */}
            {showAdd && (
                <Modal title="Novi zahtjev za odsutnost" onClose={() => setShowAdd(false)}>
                    {isAdmin && (
                        <Field label="Radnik" required>
                            <Select value={form.workerId} onChange={e => update('workerId', e.target.value)}>
                                <option value="">— Odaberi —</option>
                                {workers.filter(w => w.role !== 'admin').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </Select>
                        </Field>
                    )}
                    <Field label="Tip odsutnosti">
                        <Select value={form.type} onChange={e => update('type', e.target.value)}>
                            {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.emoji} {lt.label}</option>)}
                        </Select>
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="Od"><Input type="date" value={form.dateFrom} onChange={e => update('dateFrom', e.target.value)} /></Field>
                        <Field label="Do"><Input type="date" value={form.dateTo} onChange={e => update('dateTo', e.target.value)} /></Field>
                    </div>
                    <div style={{ background: C.accentLight, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                        Radnih dana: <strong style={{ color: C.accent }}>{calcDays(form.dateFrom, form.dateTo)}</strong>
                    </div>
                    <Field label="Napomena"><Input value={form.note} onChange={e => update('note', e.target.value)} placeholder="Opcionalna napomena..." /></Field>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={() => setShowAdd(false)} style={styles.btnSecondary}>Odustani</button>
                        <button onClick={submit} disabled={saving} style={styles.btn}>
                            {saving ? 'Spremam...' : '✅ Pošalji zahtjev'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
