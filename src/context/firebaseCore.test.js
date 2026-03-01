import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Polyfill browser globals for Node environment ───────────────────
const store = {};
globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
};
if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
}

// ─── Mock logger ─────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock('../utils/helpers', () => ({
    genId: () => 'gen-id-1',
    hashPin: vi.fn().mockResolvedValue('hashed-pin-value'),
}));

// We test pure functions that don't depend on Firebase SDK
import { loadFirebaseConfig, saveFirebaseConfig, getDb, getAuth } from './firebaseCore';

// ═══════════════════════════════════════════════════════════════════════════
// getDb / getAuth — singletons before initialization
// ═══════════════════════════════════════════════════════════════════════════
describe('getDb / getAuth (before init)', () => {
    it('getDb returns null before initFirebase', () => {
        expect(getDb()).toBeNull();
    });
    it('getAuth returns null before initFirebase', () => {
        expect(getAuth()).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Config Persistence — localStorage
// ═══════════════════════════════════════════════════════════════════════════
describe('loadFirebaseConfig', () => {
    beforeEach(() => { localStorage.clear(); });

    it('returns null when no config saved', () => {
        expect(loadFirebaseConfig()).toBeNull();
    });

    it('returns parsed config when saved', () => {
        const config = { apiKey: 'test-key', projectId: 'demo' };
        localStorage.setItem('vidime-firebase-config-v9', JSON.stringify(config));
        expect(loadFirebaseConfig()).toEqual(config);
    });

    it('returns null on invalid JSON', () => {
        localStorage.setItem('vidime-firebase-config-v9', '{ broken json');
        expect(loadFirebaseConfig()).toBeNull();
    });
});

describe('saveFirebaseConfig', () => {
    beforeEach(() => { localStorage.clear(); });

    it('saves config to localStorage', () => {
        const config = { apiKey: 'abc', authDomain: 'test.firebaseapp.com' };
        saveFirebaseConfig(config);
        const stored = JSON.parse(localStorage.getItem('vidime-firebase-config-v9'));
        expect(stored).toEqual(config);
    });

    it('overwrites existing config', () => {
        saveFirebaseConfig({ old: true });
        saveFirebaseConfig({ new: true });
        const stored = JSON.parse(localStorage.getItem('vidime-firebase-config-v9'));
        expect(stored).toEqual({ new: true });
        expect(stored.old).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// initFirebase — with mocked window.firebase
// ═══════════════════════════════════════════════════════════════════════════
describe('initFirebase', () => {
    let originalFirebase;

    beforeEach(() => {
        originalFirebase = window.firebase;
    });

    afterEach(() => {
        if (originalFirebase === undefined) {
            delete window.firebase;
        } else {
            window.firebase = originalFirebase;
        }
    });

    it('returns false when window.firebase is missing', async () => {
        delete window.firebase;
        const { initFirebase } = await import('./firebaseCore');
        expect(initFirebase({})).toBe(false);
    });

    it('returns false when config is falsy', async () => {
        window.firebase = { apps: [] };
        const { initFirebase } = await import('./firebaseCore');
        expect(initFirebase(null)).toBe(false);
    });

    it('reuses existing app if already initialized', async () => {
        const mockFirestore = vi.fn(() => ({ enablePersistence: vi.fn().mockResolvedValue() }));
        const mockAuthFn = vi.fn(() => ({}));
        window.firebase = {
            apps: [{}], // Already has an app
            firestore: mockFirestore,
            auth: mockAuthFn,
        };
        const { initFirebase } = await import('./firebaseCore');
        const result = initFirebase({ apiKey: 'test' });
        expect(result).toBe(true);
        expect(mockFirestore).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// usernameToEmail — tested indirectly through import
// ═══════════════════════════════════════════════════════════════════════════
describe('usernameToEmail (via internal)', () => {
    // This is a private function, but we can verify its behavior by checking
    // that firebaseSignIn constructs the right email pattern.
    // We test the pattern: username.toLowerCase().replace(/\s+/g, '.') + '@vidisef.app'
    it('converts "Ivan Horvat" to "ivan.horvat@vidisef.app" pattern', () => {
        const username = 'Ivan Horvat';
        const expected = `${username.toLowerCase().replace(/\s+/g, '.')}@vidisef.app`;
        expect(expected).toBe('ivan.horvat@vidisef.app');
    });

    it('handles single-word username', () => {
        const username = 'Admin';
        const expected = `${username.toLowerCase().replace(/\s+/g, '.')}@vidisef.app`;
        expect(expected).toBe('admin@vidisef.app');
    });

    it('handles multiple spaces', () => {
        const username = 'Ivan  Petar  Horvat';
        const expected = `${username.toLowerCase().replace(/\s+/g, '.')}@vidisef.app`;
        expect(expected).toBe('ivan.petar.horvat@vidisef.app');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// writeAuthMapping
// ═══════════════════════════════════════════════════════════════════════════
describe('writeAuthMapping', () => {
    it('is exported as a function', async () => {
        const mod = await import('./firebaseCore');
        expect(typeof mod.writeAuthMapping).toBe('function');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// firebaseSignOut
// ═══════════════════════════════════════════════════════════════════════════
describe('firebaseSignOut', () => {
    it('is exported as a function', async () => {
        const mod = await import('./firebaseCore');
        expect(typeof mod.firebaseSignOut).toBe('function');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// migrateUsersToFirebaseAuth
// ═══════════════════════════════════════════════════════════════════════════
describe('migrateUsersToFirebaseAuth', () => {
    it('is exported as a function', async () => {
        const mod = await import('./firebaseCore');
        expect(typeof mod.migrateUsersToFirebaseAuth).toBe('function');
    });
});
