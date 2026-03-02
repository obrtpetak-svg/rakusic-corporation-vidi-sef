import { log, warn } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE CORE — Modular SDK (v9+) with typed singletons
// ═══════════════════════════════════════════════════════════════════════════
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
    getFirestore, type Firestore,
    doc, setDoc as firestoreSetDoc,
} from 'firebase/firestore';
import {
    getAuth as firebaseGetAuth, type Auth,
    setPersistence, browserLocalPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    linkWithCredential,
    EmailAuthProvider,
    signOut,
} from 'firebase/auth';

// ── Types ────────────────────────────────────────────────────────────────
export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    [key: string]: unknown;
}

export interface AuthMigrationResult {
    success: number;
    failed: number;
    errors: Array<{ username: string; error: string }>;
}

export interface AppUser {
    id: string;
    username: string;
    role?: string;
    [key: string]: unknown;
}

// ── Singletons ───────────────────────────────────────────────────────────
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _app: FirebaseApp | null = null;

export function getDb(): Firestore | null { return _db; }
export function getAuth(): Auth | null { return _auth; }

export function initFirebase(config: FirebaseConfig | null): boolean {
    try {
        if (!config) return false;
        if (getApps().length > 0) {
            _app = getApps()[0];
        } else {
            _app = initializeApp(config);
        }
        _db = getFirestore(_app);
        _auth = firebaseGetAuth(_app);
        // Ensure auth session persists across refreshes
        try { setPersistence(_auth, browserLocalPersistence); } catch (e) { console.warn('[Firebase] setPersistence error:', e); }
        return true;
    } catch (e) { console.error('Firebase init error:', e); return false; }
}

// Clear all Firestore/Firebase IndexedDB caches (call before login)
export function clearFirestoreCache(): void {
    try {
        if (!window.indexedDB) return;
        if (typeof indexedDB.databases === 'function') {
            indexedDB.databases().then(dbs => dbs.forEach(db => {
                if (db.name && db.name !== 'firebaseLocalStorageDb') {
                    indexedDB.deleteDatabase(db.name);
                }
            }));
        }
        // Known Firestore cache DBs
        ['firestore/[DEFAULT]/rakusic-corporation-vidi-sef/main',
            'firebase-heartbeat-database', 'firebase-installations-database'].forEach(name => {
                try { indexedDB.deleteDatabase(name); } catch { }
            });
        console.log('[Firebase] Firestore cache cleared');
    } catch (e) { console.warn('[Firebase] Cache clear error:', e); }
}

// Config persistence
export function loadFirebaseConfig(): FirebaseConfig | null {
    try { const c = localStorage.getItem('vidime-firebase-config-v9'); return c ? JSON.parse(c) as FirebaseConfig : null; }
    catch { return null; }
}
export function saveFirebaseConfig(config: FirebaseConfig): void {
    localStorage.setItem('vidime-firebase-config-v9', JSON.stringify(config));
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH HELPERS — Firebase Auth sign-in/sign-out/mapping (modular)
// ═══════════════════════════════════════════════════════════════════════════
const AUTH_DOMAIN = 'rakusic-corporation.live';

function usernameToEmail(username: string): string {
    return `${username.toLowerCase().replace(/\s+/g, '.')}@${AUTH_DOMAIN}`;
}

export async function firebaseSignIn(username: string, pin: string): Promise<unknown> {
    const auth = getAuth();
    if (!auth) return null;
    const email = usernameToEmail(username);
    const password = pin;

    const currentUser = auth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
        try {
            const credential = EmailAuthProvider.credential(email, password);
            const result = await linkWithCredential(currentUser, credential);
            log('[Auth] Upgraded anonymous → email for', email);
            return result.user;
        } catch (linkErr) {
            log('[Auth] Link failed:', (linkErr as { code: string }).code, '— falling back to sign-in/create...');
        }
    }

    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        log('[Auth] Sign-in success for', email);
        return cred.user;
    } catch (signInErr) {
        log('[Auth] Sign-in failed:', (signInErr as { code: string }).code, '— trying create...');
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            log('[Auth] Auto-created user:', email);
            return cred.user;
        } catch (createErr) {
            if ((createErr as { code: string }).code === 'auth/email-already-in-use') {
                try {
                    const cred = await signInWithEmailAndPassword(auth, email, pin);
                    log('[Auth] Sign-in with raw PIN succeeded for', email);
                    return cred.user;
                } catch (rawPinErr) {
                    warn('[Auth] All auth attempts failed for', email, ':', (rawPinErr as { code: string }).code);
                    return null;
                }
            }
            warn('[Auth] Create failed:', (createErr as { code: string }).code, (createErr as Error).message);
            return null;
        }
    }
}

export async function firebaseSignOut(): Promise<void> {
    const auth = getAuth();
    if (auth) {
        try { await signOut(auth); }
        catch (e) { warn('[Auth] Sign-out error:', e); }
    }
}

export async function writeAuthMapping(firebaseUid: string, user: AppUser): Promise<void> {
    const db = getDb();
    if (!db || !firebaseUid) return;
    try {
        await firestoreSetDoc(doc(db, 'authMapping', firebaseUid), {
            role: user.role || 'radnik',
            userId: user.id,
            username: user.username,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        log('[AuthMapping] Written for', firebaseUid, '→', user.role);
    } catch (e) {
        warn('[AuthMapping] Write failed:', (e as Error).message);
    }
}

export async function migrateUsersToFirebaseAuth(users: AppUser[], rawPin?: string): Promise<AuthMigrationResult> {
    const auth = getAuth();
    const db = getDb();
    if (!auth || !db) return { success: 0, failed: 0, errors: [] };
    let success = 0, failed = 0;
    const errors: Array<{ username: string; error: string }> = [];
    const defaultPin = rawPin || '1234';
    const password = defaultPin;

    for (const user of users) {
        if (!user.username) continue;
        const email = usernameToEmail(user.username);
        let fbUid: string | null = null;
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            fbUid = cred.user.uid;
            success++;
        } catch (signInErr) {
            if ((signInErr as { code: string }).code === 'auth/user-not-found') {
                try {
                    const cred = await createUserWithEmailAndPassword(auth, email, password);
                    fbUid = cred.user.uid;
                    success++;
                } catch (createErr) {
                    failed++;
                    errors.push({ username: user.username, error: (createErr as Error).message });
                }
            } else if ((signInErr as { code: string }).code === 'auth/wrong-password' || (signInErr as { code: string }).code === 'auth/invalid-credential') {
                failed++;
                errors.push({ username: user.username, error: 'Lozinka se ne poklapa — korisnik mora resetirati PIN' });
            } else {
                failed++;
                errors.push({ username: user.username, error: (signInErr as Error).message });
            }
        }
        if (fbUid) {
            await writeAuthMapping(fbUid, user);
        }
    }
    await firebaseSignOut();
    return { success, failed, errors };
}
