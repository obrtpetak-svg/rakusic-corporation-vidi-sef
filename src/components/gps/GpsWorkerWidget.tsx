// ═══════════════════════════════════════════════════════
// GPS Worker Widget — Floating GPS status for worker panel
// Shows distance from site, time on site, GPS status
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { C, styles } from '../../utils/helpers';
import { formatDistance, timeAgo } from '../../services/GpsSettingsManager';
import { haversine } from '../../services/GeofenceEngine';

export default function GpsWorkerWidget({ currentUser, projects, timesheets, isMobile }) {
    const [expanded, setExpanded] = useState(false);
    const [currentPos, setCurrentPos] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const userId = currentUser?.workerId || currentUser?.id;

    // ── Worker's active project ──
    const activeProject = useMemo(() => {
        if (!userId) return null;
        return projects.find(p =>
            (p.workers || []).includes(userId) && p.status === 'aktivan' && p.siteLat && p.siteLng
        );
    }, [projects, userId]);

    // ── Today's time on site ──
    const todaysStats = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        const todayTs = timesheets.filter(t => t.workerId === userId && t.date === today);
        if (todayTs.length === 0) return null;
        let totalMins = 0;
        let gpsCount = 0;
        todayTs.forEach(t => {
            const [sh, sm] = (t.startTime || '07:00').split(':').map(Number);
            const [eh, em] = (t.endTime || '15:00').split(':').map(Number);
            totalMins += (eh * 60 + em) - (sh * 60 + sm) - (t.breakMins || 0);
            if (t.gpsLocation) gpsCount++;
        });
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return { hours: h, mins: m, formatted: `${h}h ${m}min`, entries: todayTs.length, gpsCount };
    }, [timesheets, userId]);

    // ── Distance from project site ──
    const distanceInfo = useMemo(() => {
        if (!currentPos || !activeProject?.siteLat || !activeProject?.siteLng) return null;
        const dist = haversine(currentPos.lat, currentPos.lng, activeProject.siteLat, activeProject.siteLng);
        return {
            distance: Math.round(dist),
            inZone: dist <= 300,
            formatted: formatDistance(dist),
        };
    }, [currentPos, activeProject]);

    // ── Manual GPS refresh ──
    const refreshGps = useCallback(() => {
        if (!navigator.geolocation) {
            setError('GPS nije podržan');
            return;
        }
        setLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCurrentPos({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: Math.round(pos.coords.accuracy),
                });
                setLastUpdate(new Date().toISOString());
                setLoading(false);
            },
            (err) => {
                setError(err.code === 1 ? 'Dozvola odbijena' : 'GPS nije dostupan');
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }, []);

    // Auto-refresh on mount
    useEffect(() => {
        refreshGps();
    }, [refreshGps]);

    // ── Status indicator ──
    const status = loading ? 'loading' : error ? 'error' : distanceInfo?.inZone ? 'inZone' : currentPos ? 'outZone' : 'unknown';
    const statusConfig = {
        loading: { color: '#F59E0B', icon: '⏳', text: 'Dohvaćam lokaciju...' },
        error: { color: '#EF4444', icon: '⚠️', text: error || 'GPS greška' },
        inZone: { color: '#10B981', icon: '✅', text: 'U zoni gradilišta' },
        outZone: { color: '#F59E0B', icon: '📍', text: `${distanceInfo?.formatted || '?'} od gradilišta` },
        unknown: { color: '#94A3B8', icon: '📍', text: 'GPS neaktivan' },
    }[status];

    if (!userId) return null;

    // ── Collapsed widget ──
    if (!expanded) {
        return (
            <div
                onClick={() => setExpanded(true)}
                style={{
                    position: 'fixed', bottom: isMobile ? 80 : 24, right: 24,
                    zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 40,
                    background: C.card,
                    border: `2px solid ${statusConfig.color}40`,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px ${statusConfig.color}20`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                {/* Pulse dot */}
                <div className="u-relative">
                    <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: statusConfig.color,
                        ...(status === 'inZone' ? { animation: 'pulse-dot 2s infinite' } : {}),
                    }} />
                    {status === 'inZone' && (
                        <div style={{
                            position: 'absolute', top: -4, left: -4,
                            width: 20, height: 20, borderRadius: '50%',
                            border: `2px solid ${statusConfig.color}`,
                            animation: 'pulse-ring 2s infinite',
                        }} />
                    )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    {statusConfig.icon} {statusConfig.text}
                </span>
            </div>
        );
    }

    // ── Expanded widget ──
    return (
        <div style={{
            position: 'fixed', bottom: isMobile ? 80 : 24, right: 24,
            zIndex: 1000,
            width: isMobile ? 'calc(100vw - 48px)' : 320,
            borderRadius: 16,
            background: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'slideUp 0.2s ease',
            backdropFilter: 'blur(10px)',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                background: `linear-gradient(135deg, ${statusConfig.color}10, ${statusConfig.color}05)`,
                borderBottom: `1px solid ${C.border}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div className="u-flex-center u-gap-8">
                    <div style={{
                        width: 10, height: 10, borderRadius: '50%', background: statusConfig.color,
                        ...(status === 'inZone' ? { animation: 'pulse-dot 2s infinite' } : {}),
                    }} />
                    <span className="u-section-title">📍 GPS Status</span>
                </div>
                <button onClick={() => setExpanded(false)} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 16, color: C.textMuted, padding: 4,
                }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: 16 }}>
                {/* Status */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                    padding: '10px 14px', borderRadius: 10,
                    background: `${statusConfig.color}08`,
                    border: `1px solid ${statusConfig.color}20`,
                }}>
                    <span style={{ fontSize: 24 }}>{statusConfig.icon}</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: statusConfig.color }}>{statusConfig.text}</div>
                        {activeProject && <div className="u-fs-11" className="u-text-muted">Projekt: {activeProject.name}</div>}
                    </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <DetailBox label="Udaljenost" value={distanceInfo?.formatted || '—'} icon="📏"
                        accent={distanceInfo?.inZone ? '#10B981' : '#F59E0B'} />
                    <DetailBox label="Preciznost" value={currentPos?.accuracy ? `±${currentPos.accuracy}m` : '—'} icon="🎯" />
                    <DetailBox label="Danas sati" value={todaysStats?.formatted || '—'} icon="⏱️" />
                    <DetailBox label="GPS unosa" value={todaysStats?.gpsCount?.toString() || '0'} icon="📡" />
                </div>

                {/* Privacy notice */}
                <div style={{
                    fontSize: 11, color: C.textMuted, textAlign: 'center',
                    padding: '8px 10px', borderRadius: 8, background: C.bg,
                    marginBottom: 12,
                }}>
                    🔒 GPS se šalje samo za vrijeme radnog vremena
                </div>

                {/* Refresh button */}
                <button onClick={refreshGps} disabled={loading} style={{
                    width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: loading ? C.bg : 'linear-gradient(135deg, #D95D08, #F97316)',
                    color: loading ? C.textMuted : 'white',
                    fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                    {loading ? '⏳ Dohvaćam...' : '🔄 Osvježi lokaciju'}
                </button>

                {/* Last update */}
                {lastUpdate && (
                    <div style={{ textAlign: 'center', fontSize: 10, color: C.textMuted, marginTop: 8 }}>
                        Zadnje ažuriranje: {timeAgo(lastUpdate)}
                    </div>
                )}
            </div>

            {/* CSS animations */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes pulse-ring {
                    0% { transform: scale(1); opacity: 0.4; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

function DetailBox({ label, value, icon, accent }) {
    return (
        <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: C.bg, border: `1px solid ${C.border}30`,
        }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {icon} {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: accent || C.text }}>{value}</div>
        </div>
    );
}
