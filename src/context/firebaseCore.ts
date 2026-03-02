import { log, warn } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE CORE — module-level singletons shared across all contexts
// ═══════════════════════════════════════════════════════════════════════════

// TODO: Replace with typed Firestore SDK imports when migrating off compat
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirestoreDb = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirebaseAuth = any;

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

let _db: FirestoreDb = null;
let _auth: FirebaseAuth = null;
export function getDb(): FirestoreDb { return _db; }
export function getAuth(): FirebaseAuth { return _auth; }

export function initFirebase(config: FirebaseConfig | null): boolean {
    try {
        const win = window as Record<string, unknown>;
        const fb = win.firebase as { apps: unknown[]; initializeApp: (c: FirebaseConfig) => void; firestore: () => FirestoreDb; auth: () => FirebaseAuth } | undefined;
        if (!fb || !config) return false;
        if (fb.apps.length > 0) {
            _db = fb.firestore();
            _auth = fb.auth();
            return true;
        }
        fb.initializeApp(config);
        _db = fb.firestore();
        _auth = fb.auth();
        _db.enablePersistence({ synchronizeTabs: true }).catch(() => { });
        return true;
    } catch (e) { console.error('Firebase init error:', e); return false; }
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
// AUTH HELPERS — Firebase Auth sign-in/sign-out/mapping
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
    const win = window as Record<string, unknown>;
    const fb = win.firebase as { auth: { EmailAuthProvider: { credential: (e: string, p: string) => unknown } } };
    const credential = fb.auth.EmailAuthProvider.credential(email, password);

    const currentUser = auth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
        try {
            const result = await currentUser.linkWithCredential(credential);
            log('[Auth] Upgraded anonymous → email for', email);
            return result.user;
        } catch (linkErr) {
            log('[Auth] Link failed:', (linkErr as { code: string }).code, '— falling back to sign-in/create...');
        }
    }

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        log('[Auth] Sign-in success for', email);
        return cred.user;
    } catch (signInErr) {
        log('[Auth] Sign-in failed:', (signInErr as { code: string }).code, '— trying create...');
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            log('[Auth] Auto-created user:', email);
            return cred.user;
        } catch (createErr) {
            if ((createErr as { code: string }).code === 'auth/email-already-in-use') {
                try {
                    const cred = await auth.signInWithEmailAndPassword(email, pin);
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
        try { await auth.signOut(); }
        catch (e) { warn('[Auth] Sign-out error:', e); }
    }
}

export async function writeAuthMapping(firebaseUid: string, user: AppUser): Promise<void> {
    const db = getDb();
    if (!db || !firebaseUid) return;
    try {
        await db.collection('authMapping').doc(firebaseUid).set({
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
            const cred = await auth.signInWithEmailAndPassword(email, password);
            fbUid = cred.user.uid;
            success++;
        } catch (signInErr) {
            if ((signInErr as { code: string }).code === 'auth/user-not-found') {
                try {
                    const cred = await auth.createUserWithEmailAndPassword(email, password);
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
