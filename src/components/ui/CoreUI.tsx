import { memo } from "react";
import { C, styles, hexToRgb } from '../../utils/helpers';

// ── Icon Paths ───────────────────────────────────────────────────────────
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

export const Icon = ({ name, size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPaths[name] || iconPaths.file} />
    </svg>
);

// ── Modal ────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children, wide }) => (
    <div className="modal-overlay">
        <div className={`modal${wide ? ' modal-wide' : ''}`}>
            <div className="modal-header">
                <div className="modal-title">{title}</div>
                <button onClick={onClose} className="modal-close"><Icon name="close" size={20} /></button>
            </div>
            <div className="modal-body">{children}</div>
        </div>
    </div>
);

// ── Form Components ──────────────────────────────────────────────────────
export const Field = ({ label, children, required }) => (
    <div className="form-group">
        <label className="form-label">{label}{required && <span style={{ color: 'var(--accent)' }}> *</span>}</label>
        {children}
    </div>
);

export const Input = (props) => <input {...props} className={`form-input ${props.className || ''}`} style={props.style} />;
export const Textarea = (props) => <textarea {...props} rows={props.rows || 3} className={`form-textarea ${props.className || ''}`} style={props.style} />;
export const Select = ({ children, ...rest }) => <select {...rest} className={`form-select ${rest.className || ''}`}>{children}</select>;

// ── StatusBadge (dynamic RGB — stays inline) ─────────────────────────────
export const StatusBadge = memo(({ status }) => {
    const map = {
        aktivan: ['34,197,94', 'AKTIVAN'], pausa: ['234,179,8', 'PAUZA'],
        'završen': ['100,116,139', 'ZAVRŠEN'], planiran: ['59,130,246', 'PLANIRAN'],
        arhiviran: ['148,103,189', 'ARHIVIRAN'],
        odobren: ['34,197,94', 'ODOBREN'], 'prihvaćen': ['34,197,94', 'PRIHVAĆEN'],
        'prihvaćena': ['34,197,94', 'PRIHVAĆENA'],
        'na čekanju': ['234,179,8', 'NA ČEKANJU'], odbijen: ['239,68,68', 'ODBIJEN'],
        odbijena: ['239,68,68', 'ODBIJENA'],
        'odobreno-voditelj': ['59,130,246', 'ODOBRENO ▸ VOD.'],
    };
    const [rgb, label] = map[status] || ['100,116,139', status?.toUpperCase() || '—'];
    return <span style={styles.badge(rgb)}>{label}</span>;
});

// ── StatCard ─────────────────────────────────────────────────────────────
export const StatCard = memo(({ label, value, icon, color = C.accent, sub }) => (
    <div className="stat-card">
        <div className="stat-icon" style={{ background: `rgba(${hexToRgb(color)},0.15)`, color }}>
            <Icon name={icon} size={24} />
        </div>
        <div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    </div>
));
