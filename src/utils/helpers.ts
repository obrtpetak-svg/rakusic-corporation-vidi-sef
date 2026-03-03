// ── Vi-Di-Sef Utility Functions ──────────────────────────────────────────

import type { CSSProperties } from 'react';

// ── Types ────────────────────────────────────────────────────────────────

export interface CompressedImage {
    name: string;
    type: string;
    data: string;
    size: number;
}

export interface ThemeColors {
    bg: string; sidebar: string; card: string; cardSolid: string;
    cardHover: string; border: string; borderStrong: string;
    divider: string; glassBorder: string;
    accent: string; accentHover: string; accentLight: string; accentGlow: string;
    blue: string; blueLight: string;
    green: string; greenLight: string;
    red: string; redLight: string;
    yellow: string; yellowLight: string;
    purple: string; purpleLight: string;
    text: string; textSecondary: string; textMuted: string; textOnAccent: string;
    inputBg: string; inputBorder: string;
    textDim: string; bgElevated: string;
}

export interface AppStyles {
    page: CSSProperties;
    card: CSSProperties;
    input: CSSProperties;
    btn: CSSProperties;
    btnSecondary: CSSProperties;
    btnDanger: CSSProperties;
    btnSmall: CSSProperties;
    label: CSSProperties;
    badge: (rgb: string) => CSSProperties;
    th: CSSProperties;
    td: CSSProperties;
}

// ── Core Utilities ───────────────────────────────────────────────────────

export const genId = (): string => crypto.randomUUID();

// SHA-256 PIN hashing (Web Crypto API)
export const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode('vidise-salt-' + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const today = (): string => new Date().toISOString().slice(0, 10);
export const nowTime = (): string => new Date().toTimeString().slice(0, 5);

export const fmtDate = (d: string | null | undefined): string =>
    d ? new Date(d).toLocaleDateString('hr-HR') : '—';

export const fmtDateTime = (d: string | null | undefined): string =>
    d ? new Date(d).toLocaleString('hr-HR') : '—';

export const fmtHours = (mins: number | null | undefined): string => {
    if (!mins && mins !== 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
};

export const diffMins = (start: string | null | undefined, end: string | null | undefined): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
};

export function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '249,115,22';
}

// ── Image Compression ────────────────────────────────────────────────────

export function compressImage(file: File, maxSize = 1200, quality = 0.75): Promise<CompressedImage> {
    return new Promise((resolve) => {
        if (file.type === 'application/pdf' || !file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
            reader.readAsDataURL(file);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                // Use WebP for much better compression (~60% smaller than JPEG)
                const useWebP = canvas.toDataURL('image/webp', 0.1).startsWith('data:image/webp');
                const format = useWebP ? 'image/webp' : 'image/jpeg';
                const ext = useWebP ? '.webp' : '.jpg';
                const dataUrl = canvas.toDataURL(format, quality);
                resolve({ name: file.name.replace(/\.[^.]+$/, ext), type: format, data: dataUrl, size: dataUrl.length });
            };
            img.src = (e.target as FileReader).result as string;
        };
        reader.readAsDataURL(file);
    });
}

export async function uploadToStorage(dataUrl: string, storagePath: string): Promise<string> {
    try {
        const win = window as unknown as Record<string, unknown>;
        const fb = win.firebase as { storage?: () => { ref: (p: string) => { put: (b: Blob) => Promise<void>; getDownloadURL: () => Promise<string> } } } | undefined;
        if (!fb?.storage) {
            console.warn('[uploadToStorage] Firebase Storage not available, using base64 fallback');
            return dataUrl;
        }
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const ref = fb.storage().ref(storagePath);
        await ref.put(blob);
        const url = await ref.getDownloadURL();
        return url;
    } catch (err) {
        console.warn('[uploadToStorage] Upload failed, using base64 fallback:', (err as Error).message);
        return dataUrl;
    }
}

// ── Theme System (reads CSS custom properties for dark mode reactivity) ───

function getCSSVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getThemeColors(): Omit<ThemeColors, 'textDim' | 'bgElevated'> {
    return {
        bg: getCSSVar('--bg'),
        sidebar: getCSSVar('--sidebar-bg'),
        card: getCSSVar('--card'),
        cardSolid: getCSSVar('--card-solid'),
        cardHover: getCSSVar('--card-hover'),
        border: getCSSVar('--border'),
        borderStrong: getCSSVar('--border-strong'),
        divider: getCSSVar('--divider'),
        glassBorder: getCSSVar('--glass-border'),
        accent: getCSSVar('--accent'),
        accentHover: getCSSVar('--accent-hover'),
        accentLight: getCSSVar('--accent-light'),
        accentGlow: getCSSVar('--accent-glow'),
        blue: getCSSVar('--blue'),
        blueLight: getCSSVar('--blue-light'),
        green: getCSSVar('--green'),
        greenLight: getCSSVar('--green-light'),
        red: getCSSVar('--red'),
        redLight: getCSSVar('--red-light'),
        yellow: getCSSVar('--yellow'),
        yellowLight: getCSSVar('--yellow-light'),
        purple: getCSSVar('--purple'),
        purpleLight: getCSSVar('--purple-light'),
        text: getCSSVar('--text'),
        textSecondary: getCSSVar('--text-secondary'),
        textMuted: getCSSVar('--text-muted'),
        textOnAccent: getCSSVar('--text-on-accent'),
        inputBg: getCSSVar('--input-bg'),
        inputBorder: getCSSVar('--input-border'),
    };
}

// C object uses CSS var() references — automatically responds to dark mode!
export const C: ThemeColors = {
    bg: 'var(--bg)', sidebar: 'var(--sidebar-bg)', card: 'var(--card)',
    cardSolid: 'var(--card-solid)', cardHover: 'var(--card-hover)',
    border: 'var(--border)', borderStrong: 'var(--border-strong)',
    divider: 'var(--divider)', glassBorder: 'var(--glass-border)',
    accent: 'var(--accent)', accentHover: 'var(--accent-hover)',
    accentLight: 'var(--accent-light)', accentGlow: 'var(--accent-glow)',
    blue: 'var(--blue)', blueLight: 'var(--blue-light)',
    green: 'var(--green)', greenLight: 'var(--green-light)',
    red: 'var(--red)', redLight: 'var(--red-light)',
    yellow: 'var(--yellow)', yellowLight: 'var(--yellow-light)',
    purple: 'var(--purple)', purpleLight: 'var(--purple-light)',
    text: 'var(--text)', textSecondary: 'var(--text-secondary)', textMuted: 'var(--text-muted)',
    textDim: 'var(--text)', textOnAccent: 'var(--text-on-accent)',
    inputBg: 'var(--input-bg)', inputBorder: 'var(--input-border)',
    bgElevated: 'var(--bg-elevated)'
};

export function refreshThemeColors(): void {
    try {
        const live = getThemeColors();
        Object.assign(C, live);
        C.textDim = C.text;
        C.bgElevated = getCSSVar('--bg-elevated');
    } catch { /* SSR or no DOM */ }
}

export function toggleTheme(): string {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme-transitioning', '');
    html.setAttribute('data-theme', next);
    localStorage.setItem('vidisef-theme', next);

    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) meta.content = next === 'dark' ? '#0B0F17' : '#D95D08';

    requestAnimationFrame(() => {
        setTimeout(() => html.removeAttribute('data-theme-transitioning'), 400);
    });

    return next;
}

export function initTheme(): string {
    const saved = localStorage.getItem('vidisef-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) meta.content = theme === 'dark' ? '#0B0F17' : '#D95D08';

    return theme;
}

export function isDarkTheme(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Shared inline styles (using C values)
export const styles: AppStyles = {
    page: { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'background 0.4s ease, color 0.4s ease' },
    card: { background: 'var(--card)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-sm)', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)' },
    input: { background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text)', padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' },
    btn: { background: 'var(--accent)', color: 'var(--text-on-accent)', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)' },
    btnSecondary: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' },
    btnDanger: { background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' },
    btnSmall: { background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(217,93,8,0.15)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
    label: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' },
    badge: (rgb: string): CSSProperties => ({ background: `rgba(${rgb},0.12)`, color: `rgb(${rgb})`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }),
    th: { color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' },
    td: { padding: '12px 16px', borderBottom: '1px solid var(--divider)', fontSize: 14, color: 'var(--text)' }
};
