// ═══════════════════════════════════════════════════════
// Dashboard UI Widgets — Self-contained presentational components
// Extracted from Dashboard.tsx for maintainability
// ═══════════════════════════════════════════════════════
import { useState, useEffect, memo } from 'react';
import { Icon } from '../ui/SharedComponents';

// ── Animated CountUp ─────────────────────────────────────────────────────
export const CountUp = memo(function CountUp({ end, duration = 800, suffix = '' }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (typeof end !== 'number' || end === 0) { setCount(end); return; }
        let start = 0;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.round(start));
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration]);
    return <>{count}{suffix}</>;
});

// ── SVG Sparkline ────────────────────────────────────────────────────────
export const Sparkline = memo(function Sparkline({ data = [], color = 'var(--accent)', width = 64, height = 28 }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pad = 2;
    const points = data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = pad + ((max - v) / range) * (height - pad * 2);
        return `${x},${y}`;
    }).join(' ');
    const pathLength = data.length * 20; // approximate

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', flexShrink: 0 }}>
            {/* Gradient fill under line */}
            <defs>
                <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Area fill */}
            <polygon
                points={`${pad},${height} ${points} ${width - pad},${height}`}
                fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`}
                style={{ animation: 'fadeIn 0.8s ease 0.3s both' }}
            />
            {/* Sparkline */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    strokeDasharray: pathLength,
                    strokeDashoffset: pathLength,
                    animation: `sparkDraw 1s cubic-bezier(0.16,1,0.3,1) 0.2s forwards`
                }}
            />
            {/* End dot */}
            {data.length > 0 && (() => {
                const lastX = pad + ((data.length - 1) / (data.length - 1)) * (width - pad * 2);
                const lastY = pad + ((max - data[data.length - 1]) / range) * (height - pad * 2);
                return <circle cx={lastX} cy={lastY} r="2.5" fill={color} style={{ animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) 1s both' }} />;
            })()}
        </svg>
    );
});

// ── BentoCard wrapper ────────────────────────────────────────────────────
export const BentoCard = memo(({ children, gridArea, style = {}, className = '' }) => (
    <div className={className} style={{
        background: 'var(--card)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
        gridArea,
        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        animation: 'cardEntry 0.5s cubic-bezier(0.16,1,0.3,1) both',
        ...style
    }}>
        {children}
    </div>
));

// ── Enhanced StatCard with Sparkline ─────────────────────────────────────
export const EnhancedStat = memo(({ label, value, icon, color, sub, suffix = '', delay = 0, sparkData, onClick }) => (
    <div style={{
        background: 'var(--card)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        padding: '20px 18px',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        animation: `cardEntry 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
        cursor: onClick ? 'pointer' : 'default'
    }}
        onClick={onClick} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
    >
        <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: `${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color, flexShrink: 0
        }}>
            <Icon name={icon} size={22} />
        </div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {typeof value === 'number' ? <CountUp end={value} suffix={suffix} /> : value}
            </div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
    </div>
));

// ── QuickAction button ───────────────────────────────────────────────────
export const QuickAction = memo(({ icon, label, color, onClick }) => (
    <button onClick={onClick} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 10px', borderRadius: 14,
        background: `${color}10`, border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)',
        fontFamily: 'inherit', width: '100%'
    }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}20`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            <Icon name={icon} size={18} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
    </button>
));

// ── Inline Stat Row ──────────────────────────────────────────────────────
export const StatRow = memo(({ label, value, color, bg }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: bg || 'var(--divider)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 800, color, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
));

// ── HeatMap (GitHub-style activity) ──────────────────────────────────────
export const HeatMap = memo(({ data = {}, weeks = 5 }) => {
    const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
    const cells = [];
    const now = new Date();
    const maxVal = Math.max(...Object.values(data), 1);
    for (let w = weeks - 1; w >= 0; w--) {
        for (let d = 0; d < 7; d++) {
            const dt = new Date(now);
            dt.setDate(dt.getDate() - (w * 7 + (6 - d)));
            const key = dt.toISOString().slice(0, 10);
            const val = data[key] || 0;
            const intensity = val / maxVal;
            cells.push({ key, val, intensity, day: d, week: weeks - 1 - w });
        }
    }
    return (
        <div>
            <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {days.map((d, i) => <div key={i} style={{ height: 16, lineHeight: '16px' }}>{i % 2 === 0 ? d : ''}</div>)}
                </div>
                {Array.from({ length: weeks }, (_, w) => (
                    <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {cells.filter(c => c.week === w).map(c => (
                            <div key={c.key} title={`${c.key}: ${Math.round(c.val / 60)}h`} style={{
                                width: 16, height: 16, borderRadius: 3,
                                background: c.val === 0 ? 'var(--divider)' : `rgba(5, 150, 105, ${0.2 + c.intensity * 0.8})`,
                                transition: 'all 0.15s ease',
                                cursor: 'default'
                            }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
});
