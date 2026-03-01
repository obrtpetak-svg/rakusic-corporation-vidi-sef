import { useState, useEffect, useCallback } from 'react';

// ── useIsMobile ──────────────────────────────────────────────────────────
export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
};

// ── useDarkMode ──────────────────────────────────────────────────────────
export const useDarkMode = () => {
    const [dark, setDark] = useState(() => localStorage.getItem('vidime-theme') === 'dark');
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('vidime-theme', dark ? 'dark' : 'light');
    }, [dark]);
    return [dark, setDark];
};

// ── DarkModeToggle ───────────────────────────────────────────────────────
export const DarkModeToggle = ({ dark, onToggle }) => (
    <button onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', justifyContent: 'center', transition: 'all 0.2s' }}
        title={dark ? 'Prebaci na svjetlu temu' : 'Prebaci na tamnu temu'}>
        <span style={{ fontSize: 16 }}>{dark ? '☀️' : '🌙'}</span>
        <span>{dark ? 'Svjetla tema' : 'Tamna tema'}</span>
    </button>
);

// ── useAutoSaveDraft ─────────────────────────────────────────────────────
export const useAutoSaveDraft = (key, form, setForm, isOpen) => {
    useEffect(() => {
        if (!isOpen || !key) return;
        const timeout = setTimeout(() => { localStorage.setItem(`draft-${key}`, JSON.stringify(form)); }, 1000);
        return () => clearTimeout(timeout);
    }, [form, isOpen, key]);

    useEffect(() => {
        if (!isOpen || !key) return;
        const saved = localStorage.getItem(`draft-${key}`);
        if (saved) { try { const draft = JSON.parse(saved); if (Object.keys(draft).length > 0) setForm(draft); } catch { /* ignore */ } }
    }, [isOpen, key]);

    const clearDraft = useCallback(() => { localStorage.removeItem(`draft-${key}`); }, [key]);
    return { clearDraft };
};
