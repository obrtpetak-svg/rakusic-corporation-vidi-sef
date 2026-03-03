import React, { useState } from 'react';
import { C } from '../../utils/helpers';

export const SvgBarChart = ({ data = [], dataKey, color = '#1D4ED8', height = 220, label }) => {
    const [hover, setHover] = useState(null);
    if (!data.length) return null;
    const vals = data.map(d => d[dataKey] || 0);
    const max = Math.max(...vals, 0.1);
    const w = 600, h2 = height - 30, pad = 40, gap = 8;
    const barW = Math.max(10, Math.floor((w - pad * 2 - gap * (data.length - 1)) / data.length));
    const totalW = data.length * barW + (data.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const gridLines = [0, .25, .5, .75, 1].map(p => ({ y: h2 - h2 * p + 10, val: +(max * p).toFixed(1) }));
    return (
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${height / w * 100}%`, overflow: 'visible' }}>
            <svg viewBox={`0 0 ${w} ${height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                {gridLines.map((g, i) => <g key={i}><line x1={pad} y1={g.y} x2={w - pad} y2={g.y} stroke="var(--border)" strokeDasharray="4 4" /><text x={pad - 6} y={g.y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{g.val}</text></g>)}
                {data.map((d, i) => {
                    const v = d[dataKey] || 0, barH = Math.max(2, v / max * (h2 - 10));
                    const x = startX + i * (barW + gap), y = h2 - barH + 10;
                    return <g key={i}><rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} opacity={0.9}
                        onMouseEnter={() => setHover({ x: x + barW / 2, y, val: v })} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
                        <text x={x + barW / 2} y={h2 + 24} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{(d[label] || d.name || d.day || d.dan || '').slice(0, 8)}</text></g>;
                })}
                {hover && <g><rect x={hover.x - 32} y={hover.y - 32} width={64} height={26} rx={6} fill="var(--card)" stroke="var(--border)" /><text x={hover.x} y={hover.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">{hover.val}h</text></g>}
            </svg>
        </div>
    );
};

export const SvgHBarChart = ({ data = [], dataKey, color = '#1D4ED8', height = 280 }) => {
    const [hover, setHover] = useState(null);
    if (!data.length) return null;
    const vals = data.map(d => d[dataKey] || 0), max = Math.max(...vals, 0.1);
    const w = 600, barH = Math.floor((height - 20) / data.length), labelW = 110, pad = 40;
    return (
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${height / w * 100}%` }}>
            <svg viewBox={`0 0 ${w} ${height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                {data.map((d, i) => {
                    const v = d[dataKey] || 0, bw = Math.max(4, v / max * (w - labelW - pad)), y = i * barH + 4;
                    return <g key={i}><text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{(d.name || '').slice(0, 14)}</text>
                        <rect x={labelW} y={y + 4} width={bw} height={barH - 8} rx={4} fill={color} opacity={0.85}
                            onMouseEnter={() => setHover({ x: labelW + bw, y: y + barH / 2, val: v })} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
                        <text x={labelW + bw + 6} y={y + barH / 2 + 4} fontSize="11" fill="var(--text)" fontWeight="600">{v}h</text></g>;
                })}
                {hover && <g><rect x={hover.x - 36} y={hover.y - 14} width={60} height={22} rx={5} fill="var(--card)" stroke="var(--border)" /><text x={hover.x - 6} y={hover.y + 2} fontSize="12" fontWeight="700" fill="var(--text)">{hover.val}h</text></g>}
            </svg>
        </div>
    );
};

export const SvgLineChart = ({ data = [], dataKey, color = '#1D4ED8', height = 260 }) => {
    const [hover, setHover] = useState(null);
    if (!data.length) return null;
    const vals = data.map(d => d[dataKey] || 0), max = Math.max(...vals, 0.1);
    const w = 600, ch = height - 30, pad = 44;
    const points = data.map((d, i) => ({ x: pad + i / (data.length - 1 || 1) * (w - pad * 2), y: ch - (d[dataKey] || 0) / max * (ch - 20) + 10, val: d[dataKey] || 0, lbl: d.dan || d.day || d.name || '' }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = points.length > 1 ? `${pathD} L${points[points.length - 1].x},${ch + 10} L${points[0].x},${ch + 10} Z` : '';
    const gridLines = [0, .25, .5, .75, 1].map(p => ({ y: ch - (ch - 20) * p + 10, val: +(max * p).toFixed(1) }));
    return (
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${height / w * 100}%`, overflow: 'visible' }}>
            <svg viewBox={`0 0 ${w} ${height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                <defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0.02" /></linearGradient></defs>
                {gridLines.map((g, i) => <g key={i}><line x1={pad} y1={g.y} x2={w - pad} y2={g.y} stroke="var(--border)" strokeDasharray="4 4" /><text x={pad - 6} y={g.y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{g.val}</text></g>)}
                {areaD && <path d={areaD} fill="url(#lineGrad)" />}
                <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={5} fill={color} stroke="var(--card)" strokeWidth="2" onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
                    {data.length <= 14 && <text x={p.x} y={ch + 24} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{p.lbl.slice(0, 6)}</text>}</g>)}
                {hover && <g><rect x={hover.x - 32} y={hover.y - 34} width={64} height={24} rx={6} fill="var(--card)" stroke="var(--border)" /><text x={hover.x} y={hover.y - 17} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">{hover.val}h</text></g>}
            </svg>
        </div>
    );
};

export const SvgDonutChart = ({ data = [], height = 200 }) => {
    if (!data.length) return null;
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    if (total === 0) return null;
    const cx = 100, cy = 100, R = 70, innerR = 44;
    let angle = -Math.PI / 2;
    const slices = data.map(d => { const sweep = (d.value / total) * Math.PI * 2; const s = { ...d, startAngle: angle, endAngle: angle + sweep }; angle += sweep; return s; });
    const arc = (cx, cy, r, s, e) => { const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s), x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e); return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${e - s > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`; };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <svg viewBox="0 0 200 200" width={height} height={height} style={{ flexShrink: 0 }}>
                {slices.map((s, i) => <path key={i} d={arc(cx, cy, R, s.startAngle, s.endAngle)} fill={s.color || '#F97316'} stroke="var(--card)" strokeWidth="2" />)}
                <circle cx={cx} cy={cy} r={innerR} fill="var(--card)" />
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">{total}</text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--text-muted)">UKUPNO</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slices.map((s, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: s.color || '#F97316', flexShrink: 0 }} /><span className="u-text-muted">{s.name}</span><span style={{ color: C.text, fontWeight: 700, marginLeft: 4 }}>{s.value}</span></div>))}
            </div>
        </div>
    );
};
