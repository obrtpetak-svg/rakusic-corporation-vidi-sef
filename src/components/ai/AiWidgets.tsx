import React from 'react';
import { C, styles } from '../../utils/helpers';

/** Card wrapper with optional title, icon, and accent color */
export const Card = ({ title, icon, children, accent, style: s }: { title?: string; icon?: string; children: React.ReactNode; accent?: string; style?: React.CSSProperties }) => (
    <div style={{ ...styles.card, ...s }}>
        {title && <div style={{ fontSize: 14, fontWeight: 700, color: accent || C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</div>}
        {children}
    </div>
);

/** Colored badge for insight messages (info/warn/danger/success) */
export const InsightBadge = ({ type = 'info', children }: { type?: 'info' | 'warn' | 'danger' | 'success'; children: React.ReactNode }) => {
    const colors: Record<string, [string, string]> = { info: ['#3B82F6', 'rgba(59,130,246,0.08)'], warn: ['#F59E0B', 'rgba(245,158,11,0.08)'], danger: ['#EF4444', 'rgba(239,68,68,0.08)'], success: ['#10B981', 'rgba(16,185,129,0.08)'] };
    const [c, bg] = colors[type] || colors.info;
    return <div style={{ padding: '10px 14px', borderRadius: 10, background: bg, border: `1px solid ${c}20`, fontSize: 13, color: c, fontWeight: 600, marginBottom: 8 }}>{children}</div>;
};

/** Simple horizontal progress bar with label */
export const ProgressBar = ({ value, max, color = C.accent, label }: { value: number; max: number; color?: string; label?: string }) => (
    <div style={{ marginBottom: 8 }}>
        {label && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, marginBottom: 4 }}><span>{label}</span><span>{Math.round(value / max * 100)}%</span></div>}
        <div style={{ height: 8, borderRadius: 4, background: C.bgElevated }}><div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.min(100, value / max * 100)}%`, transition: 'width 0.5s' }} /></div>
    </div>
);
