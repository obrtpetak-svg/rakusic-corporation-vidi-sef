// ═══════════════════════════════════════════════════════
// GPS Alert Dashboard — Real-time geofence alerts
// Alert history, acknowledge, severity indicators
// Admin can enable/disable alerts
// ═══════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, styles } from '../../utils/helpers';
import { formatDistance, timeAgo, EVENT_LABELS, GPS_COL } from '../../services/GpsSettingsManager';
import { getDb } from '../../context/firebaseCore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ALERT_TYPES = ['LEFT_SITE', 'RETURNED_TO_SITE', 'PERMISSION_DENIED', 'ACCURACY_TOO_HIGH'];

export default function GpsAlertTab({
    gpsEvents, workers, projects, liveLocations,
    getWorkerName, getProjectName, isMobile
}) {
    const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());
    const [filter, setFilter] = useState('all'); // all | active | acknowledged
    const [typeFilter, setTypeFilter] = useState('all');
    const [alertsEnabled, setAlertsEnabled] = useState(true);
    const [loadingToggle, setLoadingToggle] = useState(true);

    // ── Load alerts enabled from Firestore ──
    useEffect(() => {
        const db = getDb();
        if (!db) { setLoadingToggle(false); return; }
        getDoc(doc(db, GPS_COL.settings, 'company')).then(snap => {
            if (snap.exists() && snap.data().alertsEnabled !== undefined) {
                setAlertsEnabled(snap.data().alertsEnabled);
            }
            setLoadingToggle(false);
        }).catch(() => setLoadingToggle(false));
    }, []);

    // ── Toggle alerts on/off (persists to Firestore) ──
    const toggleAlerts = useCallback(() => {
        const newVal = !alertsEnabled;
        setAlertsEnabled(newVal);
        const db = getDb();
        if (db) {
            setDoc(doc(db, GPS_COL.settings, 'company'), { alertsEnabled: newVal }, { merge: true })
                .catch(err => console.warn('[GpsAlerts] Toggle save failed:', err));
        }
    }, [alertsEnabled]);

    // ── Alert events (only alarm types) ──
    const alerts = useMemo(() => {
        return gpsEvents
            .filter(e => ALERT_TYPES.includes(e.type))
            .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
            .map(e => ({
                ...e,
                workerName: e.workerName || getWorkerName(e.workerId),
                projectName: e.projectName || getProjectName(e.projectId),
                acknowledged: acknowledgedIds.has(e.id),
            }));
    }, [gpsEvents, getWorkerName, getProjectName, acknowledgedIds]);

    // ── Filtered alerts ──
    const filteredAlerts = useMemo(() => {
        let list = alerts;
        if (filter === 'active') list = list.filter(a => !a.acknowledged);
        if (filter === 'acknowledged') list = list.filter(a => a.acknowledged);
        if (typeFilter !== 'all') list = list.filter(a => a.type === typeFilter);
        return list;
    }, [alerts, filter, typeFilter]);

    // ── Currently out-of-zone workers ──
    const outOfZoneWorkers = useMemo(() => {
        return liveLocations.filter(l => l.inGeofence === false).map(l => ({
            ...l,
            workerName: l.workerName || getWorkerName(l.id),
        }));
    }, [liveLocations, getWorkerName]);

    // ── Stats ──
    const stats = useMemo(() => ({
        total: alerts.length,
        active: alerts.filter(a => !a.acknowledged).length,
        leftSite: alerts.filter(a => a.type === 'LEFT_SITE').length,
        returned: alerts.filter(a => a.type === 'RETURNED_TO_SITE').length,
    }), [alerts]);

    const acknowledge = useCallback((id) => {
        setAcknowledgedIds(prev => new Set([...prev, id]));
    }, []);

    const acknowledgeAll = useCallback(() => {
        setAcknowledgedIds(new Set(alerts.map(a => a.id)));
    }, [alerts]);

    // severity indicators
    const severity = !alertsEnabled ? 'disabled' : stats.active === 0 ? 'ok' : outOfZoneWorkers.length > 0 ? 'critical' : 'warning';
    const severityConfig = {
        disabled: { bg: `${C.border}10`, border: C.border, color: C.textMuted, icon: '⏸️', text: 'Alarmi isključeni' },
        ok: { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', color: '#059669', icon: '🟢', text: 'Sve u redu' },
        warning: { bg: 'rgba(234,179,8,0.06)', border: 'rgba(234,179,8,0.2)', color: C.yellow, icon: '🟡', text: 'Upozorenja' },
        critical: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', color: '#DC2626', icon: '🔴', text: 'Alarm aktivan!' },
    }[severity];

    return (
        <div>
            {/* Enable/Disable Toggle + Severity Banner */}
            <div style={{
                ...styles.card, marginBottom: 16,
                background: severityConfig.bg,
                borderColor: severityConfig.border,
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                ...(severity === 'critical' ? { animation: 'pulse-alert 2s infinite' } : {}),
            }}>
                <div style={{ fontSize: 36 }}>{severityConfig.icon}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: severityConfig.color }}>
                        {severityConfig.text}
                    </div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>
                        {!alertsEnabled
                            ? 'Sustav alarma je isključen. Uključite ga za praćenje geofence alarma.'
                            : outOfZoneWorkers.length > 0
                                ? `${outOfZoneWorkers.length} radnik(a) trenutno izvan zone`
                                : stats.active > 0
                                    ? `${stats.active} nepotvrđenih alarma`
                                    : 'Nema aktivnih alarma'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {alertsEnabled && stats.active > 0 && (
                        <button onClick={acknowledgeAll} style={{
                            ...styles.btn, background: severityConfig.color, fontSize: 13,
                        }}>
                            ✅ Potvrdi sve ({stats.active})
                        </button>
                    )}
                    {/* ON/OFF Toggle */}
                    <button onClick={toggleAlerts} disabled={loadingToggle} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10,
                        border: `1px solid ${alertsEnabled ? '#10B981' : C.border}`,
                        background: alertsEnabled ? 'rgba(16,185,129,0.08)' : C.bg,
                        color: alertsEnabled ? '#059669' : C.textMuted,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>
                        <div style={{
                            width: 32, height: 18, borderRadius: 9, padding: 2,
                            background: alertsEnabled ? '#10B981' : '#94A3B8',
                            display: 'flex', alignItems: alertsEnabled ? 'center' : 'center',
                            justifyContent: alertsEnabled ? 'flex-end' : 'flex-start',
                            transition: 'all 0.2s',
                        }}>
                            <div style={{
                                width: 14, height: 14, borderRadius: '50%', background: 'white',
                                transition: 'all 0.2s',
                            }} />
                        </div>
                        {alertsEnabled ? 'Uključeno' : 'Isključeno'}
                    </button>
                </div>
            </div>

            {/* If alerts disabled, show notice and stop */}
            {!alertsEnabled ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: 48, color: C.textMuted }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⏸️</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Alarmi su isključeni</div>
                    <div style={{ fontSize: 13, marginBottom: 16 }}>
                        Uključite alarme da pratite geofence napuštanja, povratke i upozorenja.
                    </div>
                    <button onClick={toggleAlerts} style={{
                        ...styles.btn, fontSize: 14,
                    }}>
                        🔔 Uključi alarme
                    </button>
                </div>
            ) : (
                <>

                    {/* Currently out-of-zone workers */}
                    {outOfZoneWorkers.length > 0 && (
                        <div style={{ ...styles.card, marginBottom: 16, borderLeft: '4px solid #EF4444' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#DC2626', marginBottom: 12 }}>
                                🚨 Radnici izvan zone — TRENUTNO
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: 10,
                            }}>
                                {outOfZoneWorkers.map(w => (
                                    <div key={w.id} style={{
                                        padding: '10px 14px', borderRadius: 10,
                                        background: 'rgba(239,68,68,0.04)',
                                        border: '1px solid rgba(239,68,68,0.12)',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                    }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: '#EF444420', border: '2px solid #EF4444',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 14, fontWeight: 800, color: '#EF4444',
                                        }}>
                                            {(w.workerName || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{w.workerName}</div>
                                            <div style={{ fontSize: 11, color: '#EF4444' }}>
                                                {w.distanceFromSite != null ? formatDistance(w.distanceFromSite) : '?'} od gradilišta
                                            </div>
                                            <div style={{ fontSize: 10, color: C.textMuted }}>{timeAgo(w.timestamp)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: 10, marginBottom: 16,
                    }}>
                        <StatCard label="Ukupno alarma" value={stats.total} icon="🔔" color="#3B82F6" />
                        <StatCard label="Nepotvrđenih" value={stats.active} icon="⚠️" color={stats.active > 0 ? '#EF4444' : '#10B981'} />
                        <StatCard label="Napustio zone" value={stats.leftSite} icon="🚨" color="#DC2626" />
                        <StatCard label="Vratio se" value={stats.returned} icon="✅" color="#059669" />
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[
                                { id: 'all', label: 'Svi' },
                                { id: 'active', label: '🔴 Aktivni' },
                                { id: 'acknowledged', label: '✅ Potvrđeni' },
                            ].map(f => (
                                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                                    padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                                    background: filter === f.id ? C.accentLight : 'transparent',
                                    color: filter === f.id ? C.accent : C.textMuted,
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                }}>{f.label}</button>
                            ))}
                        </div>
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                            style={{ ...styles.input, maxWidth: 200, fontSize: 12 }}>
                            <option value="all">Svi tipovi</option>
                            {ALERT_TYPES.map(t => (
                                <option key={t} value={t}>{EVENT_LABELS[t]?.label || t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Alert Timeline */}
                    <div style={styles.card}>
                        {filteredAlerts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
                                <div style={{ fontSize: 36, marginBottom: 8 }}>🔔</div>
                                Nema alarma za prikaz
                            </div>
                        ) : (
                            <div>
                                {filteredAlerts.slice(0, 50).map((alert, i) => {
                                    const meta = EVENT_LABELS[alert.type] || { label: alert.type, icon: '📍', color: '#6B7280' };
                                    const isAlarm = alert.type === 'LEFT_SITE';
                                    return (
                                        <div key={alert.id || i} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 12,
                                            padding: '14px 0',
                                            borderBottom: i < filteredAlerts.length - 1 ? `1px solid ${C.border}30` : 'none',
                                            opacity: alert.acknowledged ? 0.6 : 1,
                                        }}>
                                            <div style={{
                                                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                                background: isAlarm && !alert.acknowledged ? `${meta.color}15` : `${meta.color}08`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 20,
                                                ...(isAlarm && !alert.acknowledged ? { animation: 'pulse-alert 2s infinite' } : {}),
                                            }}>
                                                {meta.icon}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontWeight: 700, fontSize: 14,
                                                    color: isAlarm && !alert.acknowledged ? '#DC2626' : C.text,
                                                }}>
                                                    {alert.workerName}
                                                </div>
                                                <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>
                                                    {meta.label}
                                                    {alert.projectName && ` • ${alert.projectName}`}
                                                </div>
                                                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                                                    {alert.distanceFromSite != null && `📏 ${formatDistance(alert.distanceFromSite)} • `}
                                                    {alert.accuracy && `🎯 ±${alert.accuracy}m • `}
                                                    {timeAgo(alert.timestamp)}
                                                </div>
                                            </div>
                                            {!alert.acknowledged ? (
                                                <button onClick={() => acknowledge(alert.id)} style={{
                                                    padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                                                    background: 'transparent', cursor: 'pointer',
                                                    fontSize: 12, fontWeight: 600, color: C.accent,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    ✅ Potvrdi
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    ✅ Potvrđeno
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, color }) {
    return (
        <div style={{ ...styles.card, position: 'relative', overflow: 'hidden' }}>
            <div style={{
                position: 'absolute', top: -15, right: -15,
                width: 60, height: 60, borderRadius: '50%', background: `${color}10`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 10, background: `${color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{icon}</div>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{value}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
            </div>
        </div>
    );
}
