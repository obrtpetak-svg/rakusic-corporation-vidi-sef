import React, { useState, useEffect, useRef } from 'react';
import { C, styles, hexToRgb } from '../../utils/helpers';

// Re-exports from submodules for Layout compatibility
export { useDarkMode, DarkModeToggle } from './Hooks';
export { GlobalSearch, PageErrorBoundary, useToast, ToastProvider } from './Feedback';

// ── Icon Component ───────────────────────────────────────────────────────
const iconPaths = {
    dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    project: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    workers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    invoice: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    report: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    plus: 'M12 4v16m8-8H4',
    edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    close: 'M6 18L18 6M6 6l12 12',
    check: 'M5 13l4 4L19 7',
    upload: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
    back: 'M10 19l-7-7m0 0l7-7m-7 7h18',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    location: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
    misc: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    file: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    history: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z M7 10l-3 2 3 2',
    approve: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    reject: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    car: 'M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-4h10l3 4h1a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0a2 2 0 11-4 0 2 2 0 014 0z M5 10h14',
    fuel: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
    gauge: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 0v4m0 14v-2M4.93 4.93l2.83 2.83m8.48 8.48l1.41 1.41M2 12h4m14 0h-4M4.93 19.07l2.83-2.83m8.48-8.48l1.41-1.41M12 8l2 4h-4l2-4z'
};

export const Icon = ({ name, size = 20, ariaLabel = undefined }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={!ariaLabel} aria-label={ariaLabel} role={ariaLabel ? 'img' : undefined}>
        <path d={iconPaths[name] || iconPaths.file} />
    </svg>
);

// ── Modal ────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children, wide }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: wide ? 820 : 560, position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{title}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer' }} aria-label="Zatvori"><Icon name="close" size={20} /></button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>{children}</div>
        </div>
    </div>
);

// ── Form Components ──────────────────────────────────────────────────────
export const Field = ({ label, children, required }) => (
    <div className="u-mb-16">
        <label style={styles.label}>{label}{required && <span style={{ color: C.accent }} aria-hidden="true"> *</span>}{required && <span className="sr-only"> (obavezno)</span>}</label>
        {children}
    </div>
);

export const Input = (props) => <input {...props} style={{ ...styles.input, ...props.style || {} }} />;
export const Textarea = (props) => <textarea {...props} rows={props.rows || 3} style={{ ...styles.input, resize: 'vertical', ...props.style || {} }} />;
export const Select = ({ children, ...rest }) => <select {...rest} style={{ ...styles.input, cursor: 'pointer' }}>{children}</select>;

// ── StatusBadge ──────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
    const map = {
        aktivan: ['34,197,94', 'AKTIVAN'], pausa: ['234,179,8', 'PAUZA'],
        'završen': ['100,116,139', 'ZAVRŠEN'], planiran: ['59,130,246', 'PLANIRAN'],
        odobren: ['34,197,94', 'ODOBREN'], 'prihvaćen': ['34,197,94', 'PRIHVAĆEN'],
        'prihvaćena': ['34,197,94', 'PRIHVAĆENA'],
        'na čekanju': ['234,179,8', 'NA ČEKANJU'], odbijen: ['239,68,68', 'ODBIJEN'],
        odbijena: ['239,68,68', 'ODBIJENA'],
    };
    const [rgb, label] = map[status] || ['100,116,139', status?.toUpperCase() || '—'];
    return <span style={styles.badge(rgb)}>{label}</span>;
};

// ── StatCard ─────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, icon, color = C.accent, sub }) => (
    <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 16 }} role="group" aria-label={label}>
        <div style={{ background: `rgba(${hexToRgb(color)},0.15)`, borderRadius: 12, padding: 14, color }} aria-hidden="true">
            <Icon name={icon} size={24} />
        </div>
        <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
    </div>
);

// ── WorkerCheckboxList ───────────────────────────────────────────────────
export const WorkerCheckboxList = ({ allWorkers, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef();
    const searchRef = useRef();
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    useEffect(() => { if (open && searchRef.current) searchRef.current.focus(); }, [open]);
    const toggle = (id) => selected.includes(id) ? onChange(selected.filter(x => x !== id)) : onChange([...selected, id]);
    const names = allWorkers.filter(w => selected.includes(w.id)).map(w => w.name);
    const filtered = search.trim()
        ? allWorkers.filter(w => w.name?.toLowerCase().includes(search.toLowerCase()))
        : allWorkers;
    return (
        <div ref={ref} className="u-relative">
            <button type="button" onClick={() => { setOpen(v => !v); setSearch(''); }} style={{ ...styles.input, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} aria-haspopup="listbox" aria-expanded={open}>
                <span style={{ color: names.length > 0 ? C.text : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                    {names.length > 0 ? names.join(', ') : '— Odaberite radnike —'}
                </span>
                <span style={{ color: C.textMuted, fontSize: 12, marginLeft: 8 }}>▾</span>
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 8, maxHeight: 300, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                    {/* Search input */}
                    <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Pretraži radnike..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ ...styles.input, marginBottom: 0, padding: '8px 12px', fontSize: 13, background: 'var(--bg)' }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: 220, flex: 1 }}>
                        {filtered.length === 0 && <div style={{ padding: '12px 16px', color: C.textMuted, fontSize: 13 }}>Nema rezultata za "{search}"</div>}
                        {filtered.map(w => {
                            const checked = selected.includes(w.id);
                            return (
                                <div key={w.id} onClick={() => toggle(w.id)} role="option" aria-selected={checked} tabIndex={0} onKeyDown={e => e.key === 'Enter' && toggle(w.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: checked ? C.accentLight : 'transparent' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? C.accent : C.border}`, background: checked ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {checked && <Icon name="check" size={12} />}
                                    </div>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                                        {w.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{w.name}</div>
                                        {w.position && <div style={{ color: C.textMuted, fontSize: 11 }}>{w.position}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {selected.length > 0 && (
                        <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                            <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{selected.length} odabrano</span>
                            <button onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>Poništi sve</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── SVG Charts ───────────────────────────────────────────────────────────
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
                    const v = d[dataKey] || 0;
                    const barH = Math.max(2, v / max * (h2 - 10));
                    const x = startX + i * (barW + gap);
                    const y = h2 - barH + 10;
                    return <g key={i}>
                        <rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} opacity={0.9}
                            onMouseEnter={() => setHover({ x: x + barW / 2, y, val: v, lbl: d[label] || d.name || d.day || d.dan })}
                            onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
                        <text x={x + barW / 2} y={h2 + 24} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{(d[label] || d.name || d.day || d.dan || '').slice(0, 8)}</text>
                    </g>;
                })}
                {hover && <g><rect x={hover.x - 32} y={hover.y - 32} width={64} height={26} rx={6} fill="var(--card)" stroke="var(--border)" /><text x={hover.x} y={hover.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">{hover.val}h</text></g>}
            </svg>
        </div>
    );
};

export const SvgHBarChart = ({ data = [], dataKey, color = '#1D4ED8', height = 280 }) => {
    const [hover, setHover] = useState(null);
    if (!data.length) return null;
    const vals = data.map(d => d[dataKey] || 0);
    const max = Math.max(...vals, 0.1);
    const w = 600, barH = Math.floor((height - 20) / data.length), labelW = 110, pad = 40;
    return (
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${height / w * 100}%` }}>
            <svg viewBox={`0 0 ${w} ${height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                {data.map((d, i) => {
                    const v = d[dataKey] || 0;
                    const bw = Math.max(4, v / max * (w - labelW - pad));
                    const y = i * barH + 4;
                    return <g key={i}>
                        <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{(d.name || '').slice(0, 14)}</text>
                        <rect x={labelW} y={y + 4} width={bw} height={barH - 8} rx={4} fill={color} opacity={0.85}
                            onMouseEnter={() => setHover({ x: labelW + bw, y: y + barH / 2, val: v })}
                            onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
                        <text x={labelW + bw + 6} y={y + barH / 2 + 4} fontSize="11" fill="var(--text)" fontWeight="600">{v}h</text>
                    </g>;
                })}
                {hover && <g><rect x={hover.x - 36} y={hover.y - 14} width={60} height={22} rx={5} fill="var(--card)" stroke="var(--border)" /><text x={hover.x - 6} y={hover.y + 2} fontSize="12" fontWeight="700" fill="var(--text)">{hover.val}h</text></g>}
            </svg>
        </div>
    );
};

export const SvgLineChart = ({ data = [], dataKey, color = '#1D4ED8', height = 260 }) => {
    const [hover, setHover] = useState(null);
    if (!data.length) return null;
    const vals = data.map(d => d[dataKey] || 0);
    const max = Math.max(...vals, 0.1);
    const w = 600, ch = height - 30, pad = 44;
    const points = data.map((d, i) => ({
        x: pad + i / (data.length - 1 || 1) * (w - pad * 2),
        y: ch - (d[dataKey] || 0) / max * (ch - 20) + 10,
        val: d[dataKey] || 0,
        lbl: d.dan || d.day || d.name || ''
    }));
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
                {points.map((p, i) => <g key={i}>
                    <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="var(--card)" strokeWidth="2" onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />
                    {data.length <= 14 && <text x={p.x} y={ch + 24} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{p.lbl.slice(0, 6)}</text>}
                </g>)}
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
    const slices = data.map(d => {
        const sweep = (d.value / total) * Math.PI * 2;
        const s = { ...d, startAngle: angle, endAngle: angle + sweep };
        angle += sweep;
        return s;
    });
    const arc = (cx, cy, r, s, e) => {
        const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
        const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
        const large = e - s > Math.PI ? 1 : 0;
        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <svg viewBox="0 0 200 200" width={height} height={height} style={{ flexShrink: 0 }}>
                {slices.map((s, i) => <path key={i} d={arc(cx, cy, R, s.startAngle, s.endAngle)} fill={s.color || '#F97316'} stroke="var(--card)" strokeWidth="2" />)}
                <circle cx={cx} cy={cy} r={innerR} fill="var(--card)" />
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">{total}</text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--text-muted)">UKUPNO</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slices.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color || '#F97316', flexShrink: 0 }} />
                        <span style={{ color: C.textMuted }}>{s.name}</span>
                        <span style={{ color: C.text, fontWeight: 700, marginLeft: 4 }}>{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Pagination ───────────────────────────────────────────────────────────
export const usePagination = (totalItems, deps = [], defaultPageSize = 50) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    // Reset to page 1 when filters/data change
    const depsKey = JSON.stringify(deps);
    useEffect(() => { setCurrentPage(1); }, [depsKey]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    return {
        currentPage: safeCurrentPage,
        pageSize,
        totalPages,
        startIndex,
        endIndex,
        setCurrentPage,
        setPageSize: (size) => { setPageSize(size); setCurrentPage(1); },
        paginate: (items) => items.slice(startIndex, endIndex),
    };
};

export const Pagination = ({ currentPage, totalPages, pageSize, setCurrentPage, setPageSize, startIndex, endIndex, totalItems, label = 'stavki' }) => {
    if (totalItems <= 0) return null;
    const showingFrom = startIndex + 1;
    const showingTo = Math.min(endIndex, totalItems);

    // Generate page numbers to show
    const pageNumbers = [];
    const maxButtons = 5;
    let startP = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endP = Math.min(totalPages, startP + maxButtons - 1);
    if (endP - startP < maxButtons - 1) startP = Math.max(1, endP - maxButtons + 1);
    for (let i = startP; i <= endP; i++) pageNumbers.push(i);

    const btnBase = {
        background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
        padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: C.textDim,
        fontWeight: 600, transition: 'all 0.15s',
    };
    const btnActive = { ...btnBase, background: C.accent, color: '#fff', borderColor: C.accent };
    const btnDisabled = { ...btnBase, opacity: 0.4, cursor: 'default' };

    return (
        <nav aria-label="Straničenje" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8 }}>
            <div className="u-fs-12" style={{ color: C.textMuted }}>
                Prikazano <b style={{ color: C.text }}>{showingFrom}–{showingTo}</b> od <b style={{ color: C.text }}>{totalItems}</b> {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setCurrentPage(1)} disabled={currentPage <= 1} style={currentPage <= 1 ? btnDisabled : btnBase} title="Prva">«</button>
                <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1} style={currentPage <= 1 ? btnDisabled : btnBase} title="Prethodna">‹</button>
                {startP > 1 && <span style={{ fontSize: 12, color: C.textMuted, padding: '0 4px' }}>…</span>}
                {pageNumbers.map(p => (
                    <button key={p} onClick={() => setCurrentPage(p)} style={p === currentPage ? btnActive : btnBase}>{p}</button>
                ))}
                {endP < totalPages && <span style={{ fontSize: 12, color: C.textMuted, padding: '0 4px' }}>…</span>}
                <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages} style={currentPage >= totalPages ? btnDisabled : btnBase} title="Sljedeća">›</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} style={currentPage >= totalPages ? btnDisabled : btnBase} title="Zadnja">»</button>
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ ...btnBase, marginLeft: 8, padding: '5px 8px', cursor: 'pointer' }}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                </select>
            </div>
        </nav>
    );
};

// ── useIsMobile hook ─────────────────────────────────────────────────────
export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
};
