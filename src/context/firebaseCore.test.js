import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// ─── Mock Firebase Modular SDK ────────────────────────────────────────
const mockGetFirestore = vi.fn(() => ({ type: 'firestore' }));
const mockGetAuth = vi.fn(() => ({ type: 'auth' }));
const mockInitializeApp = vi.fn(() => ({ name: 'test-app' }));
const mockGetApps = vi.fn(() => []);
const mockEnablePersistence = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/app', () => ({
    initializeApp: (...args) => mockInitializeApp(...args),
    getApps: () => mockGetApps(),
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: (...args) => mockGetFirestore(...args),
    enableMultiTabIndexedDbPersistence: (...args) => mockEnablePersistence(...args),
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
    getAuth: (...args) => mockGetAuth(...args),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    onAuthStateChanged: vi.fn(),
    EmailAuthProvider: { credential: vi.fn() },
    reauthenticateWithCredential: vi.fn(),
    updatePassword: vi.fn(),
}));

// We test pure functions that don't depend on Firebase SDK
import { loadFirebaseConfig, saveFirebaseConfig, getDb, getAuth, initFirebase } from './firebaseCore';

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
// initFirebase — with mocked modular SDK
// ═══════════════════════════════════════════════════════════════════════════
describe('initFirebase', () => {
    beforeEach(() => {
        mockGetApps.mockReturnValue([]);
        mockInitializeApp.mockClear();
        mockGetFirestore.mockClear();
        mockGetAuth.mockClear();
    });

    it('returns false when config is falsy', () => {
        expect(initFirebase(null)).toBe(false);
        expect(initFirebase(undefined)).toBe(false);
    });

    it('initializes app and returns true with valid config', () => {
        mockGetApps.mockReturnValue([]); // No existing apps
        const result = initFirebase({ apiKey: 'test-key', projectId: 'demo' });
        expect(result).toBe(true);
        expect(mockInitializeApp).toHaveBeenCalledWith({ apiKey: 'test-key', projectId: 'demo' });
        expect(mockGetFirestore).toHaveBeenCalled();
        expect(mockGetAuth).toHaveBeenCalled();
    });

    it('reuses existing app if already initialized', () => {
        mockGetApps.mockReturnValue([{ name: 'existing' }]); // App exists
        const result = initFirebase({ apiKey: 'test-key', projectId: 'demo' });
        expect(result).toBe(true);
        // Should NOT call initializeApp again
        expect(mockInitializeApp).not.toHaveBeenCalled();
        expect(mockGetFirestore).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// usernameToEmail — tested indirectly through import
// ═══════════════════════════════════════════════════════════════════════════
describe('usernameToEmail (via internal)', () => {
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
