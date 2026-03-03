import { describe, it, expect } from 'vitest';

describe('SyncQueue module', () => {
    it('exports enqueue function', async () => {
        const mod = await import('./SyncQueue');
        expect(typeof mod.enqueue).toBe('function');
    });
    it('exports getPendingCount function', async () => {
        const mod = await import('./SyncQueue');
        expect(typeof mod.getPendingCount).toBe('function');
    });
    it('exports flush function', async () => {
        const mod = await import('./SyncQueue');
        expect(typeof mod.flush).toBe('function');
    });
    it('exports startAutoFlush function', async () => {
        const mod = await import('./SyncQueue');
        expect(typeof mod.startAutoFlush).toBe('function');
    });
    it('flush returns 0 when offline', async () => {
        const mod = await import('./SyncQueue');
        const origOnline = navigator.onLine;
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
        const result = await mod.flush(() => Promise.resolve());
        expect(result).toBe(0);
        Object.defineProperty(navigator, 'onLine', { value: origOnline, writable: true, configurable: true });
    });
});
