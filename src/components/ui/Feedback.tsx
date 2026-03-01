import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { C, styles } from '../../utils/helpers';
import { Icon } from './CoreUI';

// ═══════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY — prevents full-app crashes
// ═══════════════════════════════════════════════════════════════════════════
export class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="error-panel">
                    <div className="error-panel-card">
                        <div className="error-panel-icon">⚠️</div>
                        <div className="error-panel-title">Nešto je pošlo po krivu</div>
                        <div className="error-panel-desc">Došlo je do neočekivane greške. Pokušajte osvježiti stranicu.</div>
                        <div className="error-panel-msg">{this.state.error?.message || 'Nepoznata greška'}</div>
                        <button onClick={() => window.location.reload()} className="btn btn-primary">🔄 Osvježi stranicu</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE ERROR BOUNDARY — per-page crash isolation (H-4)
// ═══════════════════════════════════════════════════════════════════════════
export class PageErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('[PageErrorBoundary] caught:', error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="error-panel error-panel-page">
                    <div className="error-panel-card error-panel-card-sm">
                        <div className="error-panel-icon error-panel-icon-sm">⚠️</div>
                        <div className="error-panel-title error-panel-title-sm">Greška na ovoj stranici</div>
                        <div className="error-panel-desc error-panel-desc-sm">Ova stranica je naišla na problem. Ostale stranice rade normalno.</div>
                        <div className="error-panel-msg error-panel-msg-sm">{this.state.error?.message || 'Nepoznata greška'}</div>
                        <div className="error-panel-actions">
                            <button onClick={() => this.setState({ hasError: false, error: null })} className="btn btn-secondary btn-sm">🔄 Pokušaj ponovo</button>
                            {this.props.onGoHome && (<button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onGoHome(); }} className="btn btn-primary btn-sm">🏠 Dashboard</button>)}
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);
    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);
        setTimeout(() => { setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t)); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300); }, duration);
    }, []);
    const toast = useMemo(() => ({ success: (msg) => addToast(msg, 'success'), error: (msg) => addToast(msg, 'error'), warning: (msg) => addToast(msg, 'warning'), info: (msg) => addToast(msg, 'info') }), [addToast]);
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (<div key={t.id} className={`toast toast-${t.type} ${t.exiting ? 'toast-exit' : ''}`}><span className="toast-icon">{icons[t.type]}</span><span>{t.message}</span></div>))}
            </div>
        </ToastContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════════════════
export const ConfirmDialog = ({ title, message, onConfirm, onCancel, confirmText = 'Da, obriši', cancelText = 'Odustani', icon = '🗑️', danger = true }) => (
    <div className="confirm-overlay">
        <div className="confirm-card">
            <div className="confirm-dialog">
                <div className="confirm-icon">{icon}</div>
                <div className="confirm-title">{title || 'Jeste li sigurni?'}</div>
                <div className="confirm-message">{message || 'Ova radnja se ne može poništiti.'}</div>
                <div className="confirm-actions">
                    <button onClick={onCancel} className="btn btn-secondary">{cancelText}</button>
                    <button onClick={onConfirm} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND PALETTE — ⌘K / Ctrl+K (Premium)
// ═══════════════════════════════════════════════════════════════════════════
export const GlobalSearch = ({ navItems, onNavigate, onClose, workers = [], projects = [] }) => {
    const [query, setQuery] = useState('');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef();
    const resultsRef = useRef();

    useEffect(() => { inputRef.current?.focus(); }, []);

    // Quick actions
    const quickActions = useMemo(() => [
        { id: 'action-radni-sat', label: '➕ Novi radni sat', action: () => onNavigate('radni-sati'), category: 'Brze akcije' },
        { id: 'action-novi-projekt', label: '📁 Novi projekt', action: () => onNavigate('projekti'), category: 'Brze akcije' },
        { id: 'action-izvjestaj', label: '📊 Izvještaj za mjesec', action: () => onNavigate('izvjestaji'), category: 'Brze akcije' },
        { id: 'action-obavijesti', label: '🔔 Pregledaj obavijesti', action: () => onNavigate('obavijesti'), category: 'Brze akcije' },
    ], [onNavigate]);

    // Fuzzy search
    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        const navResults = navItems.map(item => {
            if (!q) return { ...item, score: 0, category: 'Navigacija' };
            const label = item.label.toLowerCase();
            const id = item.id.toLowerCase();
            // Exact match → highest score
            if (label.includes(q)) return { ...item, score: 3, category: 'Navigacija' };
            if (id.includes(q)) return { ...item, score: 2, category: 'Navigacija' };
            // Fuzzy: check if all query chars appear in order
            let fi = 0;
            for (let c of label) { if (c === q[fi]) fi++; if (fi === q.length) break; }
            if (fi === q.length) return { ...item, score: 1, category: 'Navigacija' };
            return null;
        }).filter(Boolean);

        const actionResults = quickActions.filter(a => {
            if (!q) return true;
            return a.label.toLowerCase().includes(q);
        }).map(a => ({ ...a, score: q ? 2 : 0 }));

        // Worker results (only when query exists)
        const workerResults = q ? workers.filter(w => w.active !== false && w.role !== 'admin').filter(w => {
            return (w.name || '').toLowerCase().includes(q) || (w.position || '').toLowerCase().includes(q);
        }).slice(0, 5).map(w => ({
            id: `worker-${w.id}`,
            label: `👤 ${w.name}${w.position ? ` · ${w.position}` : ''}`,
            icon: 'workers',
            score: (w.name || '').toLowerCase().startsWith(q) ? 4 : 2,
            category: 'Radnici',
            action: () => onNavigate('radnici')
        })) : [];

        // Project results (only when query exists)
        const projectResults = q ? projects.filter(p => {
            return (p.name || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
        }).slice(0, 5).map(p => ({
            id: `project-${p.id}`,
            label: `📂 ${p.name}${p.location ? ` · ${p.location}` : ''}`,
            icon: 'project',
            score: (p.name || '').toLowerCase().startsWith(q) ? 4 : 2,
            category: 'Projekti',
            action: () => onNavigate('projekti')
        })) : [];

        const all = [...navResults, ...workerResults, ...projectResults, ...actionResults].sort((a, b) => b.score - a.score);
        return q ? all.filter(x => x.score > 0) : all;
    }, [query, navItems, quickActions, workers, projects]);

    // Reset selection when results change
    useEffect(() => { setSelectedIdx(0); }, [filtered.length]);

    // Scroll selected into view
    useEffect(() => {
        const el = resultsRef.current?.children[selectedIdx];
        el?.scrollIntoView?.({ block: 'nearest' });
    }, [selectedIdx]);

    const handleSelect = (item) => {
        if (item.action) { item.action(); onClose(); }
        else { onNavigate(item.id); onClose(); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); handleSelect(filtered[selectedIdx]); }
    };

    // Group by category
    const grouped = useMemo(() => {
        const groups = {};
        filtered.forEach((item, i) => {
            const cat = item.category || 'Navigacija';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push({ ...item, globalIdx: i });
        });
        return groups;
    }, [filtered]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh', animation: 'fadeIn 0.15s ease' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--card-solid)', borderRadius: 16, border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', animation: 'modalEntry 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
                {/* Search input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <Icon name="search" size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        placeholder="Pretraži ili upiši naredbu..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font)' }}
                    />
                    <kbd style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--divider)', borderRadius: 6, padding: '3px 8px', fontFamily: 'var(--font-mono)' }}>ESC</kbd>
                </div>

                {/* Results */}
                <div ref={resultsRef} style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 0' }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                            🔍 Nema rezultata za "{query}"
                        </div>
                    )}
                    {Object.entries(grouped).map(([category, items]) => (
                        <div key={category}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', padding: '8px 18px 4px' }}>{category}</div>
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIdx(item.globalIdx)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 18px', cursor: 'pointer',
                                        background: item.globalIdx === selectedIdx ? 'var(--accent-light)' : 'transparent',
                                        borderLeft: item.globalIdx === selectedIdx ? '3px solid var(--accent)' : '3px solid transparent',
                                        transition: 'all 0.1s ease'
                                    }}
                                >
                                    {item.icon ? <Icon name={item.icon} size={18} style={{ color: item.globalIdx === selectedIdx ? 'var(--accent)' : 'var(--text-muted)' }} /> : <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.label?.split(' ')[0]}</span>}
                                    <span style={{ flex: 1, fontSize: 14, fontWeight: item.globalIdx === selectedIdx ? 600 : 400, color: item.globalIdx === selectedIdx ? 'var(--accent)' : 'var(--text)' }}>
                                        {item.label}
                                    </span>
                                    {item.globalIdx === selectedIdx && <kbd style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--divider)', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>↵</kbd>}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 18px', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span><kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--divider)', borderRadius: 3, padding: '1px 5px', marginRight: 4 }}>↑↓</kbd> navigacija</span>
                    <span><kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--divider)', borderRadius: 3, padding: '1px 5px', marginRight: 4 }}>↵</kbd> odaberi</span>
                    <span><kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--divider)', borderRadius: 3, padding: '1px 5px', marginRight: 4 }}>esc</kbd> zatvori</span>
                </div>
            </div>
        </div>
    );
};
