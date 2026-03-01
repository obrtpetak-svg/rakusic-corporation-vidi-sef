// ═══════════════════════════════════════════════════════
// Native Bridge — Capacitor Integration Layer
// Detects Capacitor runtime and provides native APIs
// for GPS, network, app lifecycle, and notifications.
// Falls back to web APIs when running in browser.
// ═══════════════════════════════════════════════════════

const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// ── Geolocation ──────────────────────────────────────────
export const NativeGps = {
    /**
     * Watch position using native GPS (Capacitor) or web fallback.
     * Returns a watchId that can be used to clear the watch.
     */
    async watchPosition(callback, errorCallback, options = {}) {
        if (isNative()) {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const id = await Geolocation.watchPosition(
                    {
                        enableHighAccuracy: true,
                        timeout: options.timeout || 30000,
                        maximumAge: options.maximumAge || 5000,
                    },
                    (pos, err) => {
                        if (err) {
                            errorCallback?.({ code: 2, message: err.message || 'Native GPS error' });
                        } else if (pos) {
                            callback({
                                coords: {
                                    latitude: pos.coords.latitude,
                                    longitude: pos.coords.longitude,
                                    accuracy: pos.coords.accuracy,
                                    altitude: pos.coords.altitude,
                                    speed: pos.coords.speed,
                                },
                                timestamp: pos.timestamp,
                            });
                        }
                    }
                );
                return { type: 'native', id };
            } catch (e) {
                console.warn('[NativeBridge] Capacitor Geolocation not available, falling back to web');
            }
        }

        // Web fallback
        const id = navigator.geolocation.watchPosition(callback, errorCallback, {
            enableHighAccuracy: true,
            timeout: options.timeout || 30000,
            maximumAge: options.maximumAge || 5000,
        });
        return { type: 'web', id };
    },

    async clearWatch(watch) {
        if (!watch) return;
        if (watch.type === 'native') {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                await Geolocation.clearWatch({ id: watch.id });
            } catch { /* ignore */ }
        } else {
            navigator.geolocation.clearWatch(watch.id);
        }
    },

    async getCurrentPosition() {
        if (isNative()) {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const pos = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 15000,
                });
                return {
                    coords: {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                    },
                    timestamp: pos.timestamp,
                };
            } catch (e) {
                console.warn('[NativeBridge] Native getCurrentPosition failed:', e);
            }
        }
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            });
        });
    },

    async checkPermissions() {
        if (isNative()) {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                return await Geolocation.checkPermissions();
            } catch { /* fallback */ }
        }
        // Web: check via permissions API
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return { location: result.state };
        } catch {
            return { location: 'prompt' };
        }
    },

    async requestPermissions() {
        if (isNative()) {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                return await Geolocation.requestPermissions();
            } catch { /* fallback */ }
        }
        // Web: trigger permission via getCurrentPosition
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => resolve({ location: 'granted' }),
                () => resolve({ location: 'denied' }),
                { timeout: 5000 }
            );
        });
    },
};

// ── Network ──────────────────────────────────────────────
export const NativeNetwork = {
    async getStatus() {
        if (isNative()) {
            try {
                const { Network } = await import('@capacitor/network');
                return await Network.getStatus();
            } catch { /* fallback */ }
        }
        return { connected: navigator.onLine, connectionType: 'unknown' };
    },

    onStatusChange(callback) {
        if (isNative()) {
            import('@capacitor/network').then(({ Network }) => {
                Network.addListener('networkStatusChange', callback);
            }).catch(() => {
                // Fallback
                window.addEventListener('online', () => callback({ connected: true }));
                window.addEventListener('offline', () => callback({ connected: false }));
            });
        } else {
            window.addEventListener('online', () => callback({ connected: true }));
            window.addEventListener('offline', () => callback({ connected: false }));
        }
    },
};

// ── App Lifecycle ────────────────────────────────────────
export const NativeApp = {
    onStateChange(callback) {
        if (isNative()) {
            import('@capacitor/app').then(({ App }) => {
                App.addListener('appStateChange', ({ isActive }) => {
                    callback(isActive ? 'active' : 'background');
                });
            }).catch(() => {
                // Fallback
                document.addEventListener('visibilitychange', () => {
                    callback(document.visibilityState === 'visible' ? 'active' : 'background');
                });
            });
        } else {
            document.addEventListener('visibilitychange', () => {
                callback(document.visibilityState === 'visible' ? 'active' : 'background');
            });
        }
    },
};

// ── Utility ──────────────────────────────────────────────
export function isCapacitorNative() {
    return isNative();
}
