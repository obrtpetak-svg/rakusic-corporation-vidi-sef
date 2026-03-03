// ═══════════════════════════════════════════════════════
// Worker Location Card — Individual worker GPS info card
// ═══════════════════════════════════════════════════════
import { C, styles } from '../../utils/helpers';
import { formatDistance, timeAgo } from '../../services/GpsSettingsManager';

export default function WorkerLocationCard({ worker: w, getProjectName }) {
    const loc = w.location;
    const hasLoc = !!loc?.lat;
    const isRecent = loc?.timestamp && (Date.now() - new Date(loc.timestamp).getTime()) < 30 * 60 * 1000;
    const inZone = loc?.inGeofence;

    const statusColor = !hasLoc ? '#94A3B8' : !isRecent ? '#94A3B8' : inZone ? '#10B981' : '#EF4444';
    const statusText = !hasLoc ? 'Nema podataka' : !isRecent ? 'Neaktivan' : inZone ? 'U zoni' : 'Izvan zone';
    const statusEmoji = !hasLoc ? '⚫' : !isRecent ? '💤' : inZone ? '✅' : '🚨';

    const presence = loc?.sitePresenceToday || 0;

    return (
        <div style={{
            ...styles.card,
            transition: 'all 0.2s',
            borderLeft: `4px solid ${statusColor}`,
            cursor: 'default',
        }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {/* Avatar with status ring */}
                <div className="u-relative">
                    <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: `${statusColor}20`,
                        border: `2px solid ${statusColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 800, color: statusColor,
                    }}>
                        {(w.name || '?')[0].toUpperCase()}
                    </div>
                    {isRecent && hasLoc && (
                        <div style={{
                            position: 'absolute', bottom: -1, right: -1,
                            width: 14, height: 14, borderRadius: '50%',
                            background: statusColor,
                            border: '2px solid white',
                            animation: inZone ? 'none' : 'pulse-alert 1.5s infinite',
                        }} />
                    )}
                </div>

                <div className="u-flex-1">
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{w.name}</div>
                    <div className="u-fs-12" style={{ color: C.textMuted }}>{w.position || w.role || 'Radnik'}</div>
                </div>

                <div style={{
                    padding: '4px 10px', borderRadius: 20,
                    background: `${statusColor}15`, color: statusColor,
                    fontSize: 11, fontWeight: 700,
                }}>
                    {statusEmoji} {statusText}
                </div>
            </div>

            {/* Location details */}
            {hasLoc && (
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                    padding: '10px 0', borderTop: `1px solid ${C.border}60`,
                }}>
                    <div>
                        <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Udaljenost</div>
                        <div className="u-section-title">{formatDistance(loc.distanceFromSite)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zadnje viđeno</div>
                        <div className="u-section-title">{timeAgo(loc.timestamp)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preciznost</div>
                        <div className="u-section-title">±{loc.accuracy}m</div>
                    </div>
                </div>
            )}

            {/* Site presence bar */}
            {hasLoc && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                        <span>Prisutnost danas</span>
                        <span style={{ fontWeight: 700, color: presence >= 80 ? '#10B981' : presence >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {presence}%
                        </span>
                    </div>
                    <div style={{
                        height: 6, borderRadius: 3, background: `${C.border}40`,
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(100, presence)}%`,
                            background: presence >= 80 ? 'linear-gradient(90deg, #10B981, #34D399)'
                                : presence >= 50 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                    : 'linear-gradient(90deg, #EF4444, #F87171)',
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                </div>
            )}

            {/* Battery indicator */}
            {loc?.batteryLevel != null && (
                <div style={{ marginTop: 6, fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                    🔋 {loc.batteryLevel}%
                    {loc.batteryLevel < 20 && <span style={{ color: '#EF4444', fontWeight: 600 }}>&nbsp;⚠️ Niska baterija</span>}
                </div>
            )}
        </div>
    );
}
