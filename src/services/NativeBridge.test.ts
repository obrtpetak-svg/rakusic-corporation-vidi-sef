import { describe, it, expect } from 'vitest';
import { isCapacitorNative } from './NativeBridge';

describe('NativeBridge', () => {
    describe('isCapacitorNative', () => {
        it('returns false in test environment (no Capacitor)', () => {
            expect(isCapacitorNative()).toBe(false);
        });
        it('returns boolean type', () => {
            expect(typeof isCapacitorNative()).toBe('boolean');
        });
    });

    describe('module exports', () => {
        it('exports NativeGps', async () => {
            const mod = await import('./NativeBridge');
            expect(mod.NativeGps).toBeDefined();
            expect(typeof mod.NativeGps.watchPosition).toBe('function');
            expect(typeof mod.NativeGps.clearWatch).toBe('function');
            expect(typeof mod.NativeGps.getCurrentPosition).toBe('function');
            expect(typeof mod.NativeGps.checkPermissions).toBe('function');
            expect(typeof mod.NativeGps.requestPermissions).toBe('function');
        });
        it('exports NativeNetwork', async () => {
            const mod = await import('./NativeBridge');
            expect(mod.NativeNetwork).toBeDefined();
            expect(typeof mod.NativeNetwork.getStatus).toBe('function');
            expect(typeof mod.NativeNetwork.onStatusChange).toBe('function');
        });
        it('exports NativeApp', async () => {
            const mod = await import('./NativeBridge');
            expect(mod.NativeApp).toBeDefined();
            expect(typeof mod.NativeApp.onStateChange).toBe('function');
        });
    });
});
