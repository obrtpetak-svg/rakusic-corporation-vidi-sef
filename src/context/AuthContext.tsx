import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { genId } from '../utils/helpers';
import { firebaseSignIn, firebaseSignOut, writeAuthMapping, clearFirestoreCache } from './firebaseCore';

// ── Types ────────────────────────────────────────────────────────────────
export interface SessionConfig {
    sessionDuration: number;
    sessionVersion: number | null;
    syncMode: number;
}

export interface AuthContextValue {
    step: string;
    setStep: (s: string) => void;
    currentUser: any;
    setCurrentUser: (u: any) => void;
    firebaseReady: boolean;
    setFirebaseReady: (b: boolean) => void;
    loadError: string | null;
    setLoadError: (e: string | null) => void;
    sessionConfig: SessionConfig;
    setSessionConfig: React.Dispatch<React.SetStateAction<SessionConfig>>;
    lastSync: Date | null;
    setLastSync: (d: Date | null) => void;
    // Session helpers
    saveSession: (user: any, version?: number | null) => void;
    loadSession: () => any;
    clearSession: () => void;
    clearStaleCache: () => void;
    // Handlers
    handleAppLogin: () => void;
    handleFirebaseLogin: (username: string, password: string) => Promise<any>;
    handleFirebaseConfig: (config: any) => void;
    handleCompanySetup: (profile: any) => Promise<void>;
    handleAdminCreate: (admin: any) => Promise<void>;
    handleUserLogin: (user: any) => void;
    handleLogout: () => void;
    handleResetFirebase: () => void;
    // Session admin
    forceLogoutAll: () => Promise<void>;
    updateSessionDuration: (minutes: number) => Promise<void>;
    updateSyncMode: (mode: number) => Promise<void>;
    // Password & export
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    exportUserData: () => Promise<void>;
    // Refs for cleanup
    unsubsRef: React.MutableRefObject<Array<() => void>>;
    sessionCheckRef: React.MutableRefObject<any>;
    // Trigger data load
    triggerDataLoad: (config: any) => void;
    setTriggerDataLoad: (fn: (config: any) => void) => void;
}

// ── Firebase core (shared singletons) ────────────────────────────────────
let _db: any = null;
let _auth: any = null;
export function getDb() { return _db; }
export function getAuth() { return _auth; }

export function initFirebase(config: any): boolean {
    try {
        const w = window as any;
        if (!w.firebase) return false;
        if (!w.firebase.apps?.length) {
            w.firebase.initializeApp(config);
        }
        _db = w.firebase.firestore();
        _auth = w.firebase.auth();
        return true;
    } catch (e) {
        console.error('[initFirebase]', e);
        return false;
    }
}

// Config persistence
export function loadFirebaseConfig(): any {
    try { const c = localStorage.getItem('vidime-firebase-config-v9'); return c ? JSON.parse(c) : null; }
    catch { return null; }
}
export function saveFirebaseConfig(config: any) {
    localStorage.setItem('vidime-firebase-config-v9', JSON.stringify(config));
}

// Built-in Firebase config (production)
function getBuiltInConfig() {
    return {
        apiKey: 'AIzaSyDVcFE2dlnOyv8s12rKjp3IvJh1LUGZKOs',
        authDomain: 'rakusic-corporation-vidi-sef.firebaseapp.com',
        projectId: 'rakusic-corporation-vidi-sef',
        storageBucket: 'rakusic-corporation-vidi-sef.firebasestorage.app',
        messagingSenderId: '862008523269',
        appId: '1:862008523269:web:32252db876f5faa000ba6c',
    };
}

// ── Clear stale cache ────────────────────────────────────────────────────
function clearStaleCache() {
    try {
        localStorage.removeItem('vidime-app-login');
        localStorage.removeItem('vidime-session');
        sessionStorage.clear();
        if (window.indexedDB) {
            if (typeof indexedDB.databases === 'function') {
                indexedDB.databases().then(dbs => dbs.forEach(db => {
                    // PRESERVE firebaseLocalStorageDb — it stores Firebase Auth tokens!
                    if (db.name && db.name !== 'firebaseLocalStorageDb') {
                        indexedDB.deleteDatabase(db.name);
                    }
                }));
            }
            ['firebase-heartbeat-database', 'firebase-installations-database',
                'firestore/[DEFAULT]/rakusic-corporation-vidi-sef/main'].forEach(name => {
                    try { indexedDB.deleteDatabase(name); } catch { }
                });
        }
        if ('caches' in window) {
            caches.keys().then(names => names.forEach(n => caches.delete(n)));
        }
        console.log('[ClearCache] Stale cache cleared');
    } catch (e) { console.warn('[ClearCache] Error:', e); }
}

// ── Context ──────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [step, setStep] = useState('loading');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ sessionDuration: 60, sessionVersion: null, syncMode: 0 });
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const unsubsRef = useRef<Array<() => void>>([]);
    const sessionCheckRef = useRef<any>(null);

    // DataContext will register its load function here
    const _triggerDataLoadRef = useRef<((config: any) => void) | null>(null);
    const triggerDataLoad = (config: any) => {
        if (_triggerDataLoadRef.current) _triggerDataLoadRef.current(config);
    };
    const setTriggerDataLoad = (fn: (config: any) => void) => {
        _triggerDataLoadRef.current = fn;
    };

    // ── Session persistence helpers ──
    const SESSION_KEY = 'vidime-session';
    const saveSession = useCallback((user: any, version?: number | null) => {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id, userName: user.name, userRole: user.role,
            loginAt: new Date().toISOString(), sessionVersion: version || 1,
        }));
    }, []);
    const loadSession = useCallback(() => {
        try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
        catch { return null; }
    }, []);
    const clearSession = useCallback(() => localStorage.removeItem(SESSION_KEY), []);

    // ── Boot app ──
    useEffect(() => {
        const bootApp = async () => {
            const builtIn = getBuiltInConfig();
            const config = builtIn || loadFirebaseConfig();

            if (config) {
                saveFirebaseConfig(config);
                let tries = 0;
                while (!(window as any).firebase && tries < 50) { await new Promise(r => setTimeout(r, 100)); tries++; }
                if (!(window as any).firebase) { setLoadError('Firebase library not loaded'); setStep('appLogin'); return; }
                if (!initFirebase(config)) { setLoadError('Firebase init failed'); setStep('appLogin'); return; }

                const auth = getAuth();
                if (auth) {
                    const firebaseUser: any = await new Promise((resolve) => {
                        const unsub = auth.onAuthStateChanged((user: any) => {
                            unsub();
                            resolve(user);
                        });
                        setTimeout(() => resolve(null), 8000);
                    });

                    if (firebaseUser && !firebaseUser.isAnonymous) {
                        console.log('[Boot] Firebase Auth session restored:', firebaseUser.email);
                        try {
                            await Promise.race([
                                new Promise<void>((resolve, reject) => {
                                    // Wait for DataContext to be ready, then trigger load
                                    const waitForDataCtx = setInterval(() => {
                                        if (_triggerDataLoadRef.current) {
                                            clearInterval(waitForDataCtx);
                                            _triggerDataLoadRef.current(config);
                                            resolve();
                                        }
                                    }, 50);
                                    setTimeout(() => { clearInterval(waitForDataCtx); reject(new Error('Boot timeout')); }, 15000);
                                }),
                            ]);
                        } catch (bootErr: any) {
                            console.error('[Boot] Session restore failed:', bootErr.message);
                            clearSession();
                            try { auth.signOut(); } catch { }
                            setStep('appLogin');
                        }
                        return;
                    }

                    const savedSession = loadSession();
                    if (savedSession) {
                        console.log('[Boot] No Firebase Auth but localStorage session exists, trying to load...');
                        try {
                            await Promise.race([
                                new Promise<void>((resolve, reject) => {
                                    const waitForDataCtx = setInterval(() => {
                                        if (_triggerDataLoadRef.current) {
                                            clearInterval(waitForDataCtx);
                                            _triggerDataLoadRef.current(config);
                                            resolve();
                                        }
                                    }, 50);
                                    setTimeout(() => { clearInterval(waitForDataCtx); reject(new Error('Boot timeout')); }, 10000);
                                }),
                            ]);
                            return;
                        } catch (e) {
                            console.warn('[Boot] localStorage session fallback failed:', e);
                            clearSession();
                        }
                    }
                }

                console.log('[Boot] No Firebase Auth session, showing login...');
                setStep('appLogin');
            } else {
                setStep('appLogin');
            }
        };
        bootApp();
        return () => { unsubsRef.current.forEach(fn => fn()); if (sessionCheckRef.current) clearInterval(sessionCheckRef.current); };
    }, []);

    const handleAppLogin = useCallback(() => {
        localStorage.setItem('vidime-app-login', 'true');
        sessionStorage.setItem('vidime-app-login', 'true');
        const config = loadFirebaseConfig();
        if (config) triggerDataLoad(config);
        else setStep('firebaseConfig');
    }, []);

    const handleFirebaseLogin = useCallback(async (username: string, password: string) => {
        let config = loadFirebaseConfig();
        if (!config) config = getBuiltInConfig();
        if (config && !firebaseReady) {
            saveFirebaseConfig(config);
            let tries = 0;
            while (!(window as any).firebase && tries < 50) { await new Promise(r => setTimeout(r, 100)); tries++; }
            if (!(window as any).firebase) throw new Error('Firebase library not loaded');
            initFirebase(config);
        }

        const auth = getAuth();
        if (!auth) throw new Error('Auth not available');

        const cleanUser = username.toLowerCase().replace(/\s+/g, '.');
        const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@rakusic-corporation.live`;
        console.log('[Auth] Attempting login for:', email);

        let firebaseUser: any = null;
        try {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            console.log('[Auth] Sign-in OK:', email);
            firebaseUser = cred.user;
        } catch (signInErr: any) {
            console.error('[Auth] Sign-in failed:', signInErr.code);
            throw signInErr;
        }

        if (!firebaseUser) return null;

        localStorage.setItem('vidime-app-login', 'true');
        triggerDataLoad(config);

        return firebaseUser;
    }, [firebaseReady]);

    const handleFirebaseConfig = useCallback((config: any) => {
        saveFirebaseConfig(config);
        triggerDataLoad(config);
    }, []);

    const handleCompanySetup = useCallback(async (profile: any) => {
        const db = getDb();
        if (!db) return;
        await db.collection('config').doc('companyProfile').set(profile);
        const snap = await db.collection('users').get();
        const u: any[] = [];
        snap.forEach((doc: any) => { const d = { ...doc.data(), id: doc.id }; if (!d.deletedAt) u.push(d); });
        if (!u.length) setStep('adminCreate');
        else setStep('appLogin');
    }, []);

    const handleAdminCreate = useCallback(async (admin: any) => {
        const db = getDb();
        if (!db) return;
        const id = admin.id || genId();
        const doc = { ...admin, id };
        await db.collection('users').doc(id).set(doc);
        await db.collection('workers').doc(id).set({ ...doc, role: 'admin' });
        setCurrentUser(doc);
        setStep('app');
    }, []);

    const handleUserLogin = useCallback((user: any) => {
        setCurrentUser(user);
        saveSession(user, sessionConfig.sessionVersion);
        setStep('app');
        if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
        sessionCheckRef.current = setInterval(() => {
            const s = loadSession();
            if (!s) return;
            const age = (Date.now() - new Date(s.loginAt).getTime()) / 60000;
            if (age >= (sessionConfig.sessionDuration || 60)) {
                clearSession(); setCurrentUser(null);
                const a = getAuth(); if (a) a.signOut();
                setStep('appLogin');
            }
        }, 30000);
    }, [sessionConfig, saveSession, loadSession, clearSession]);

    const handleLogout = useCallback(() => {
        try {
            const db = getDb();
            if (db && currentUser) {
                db.collection('auditLog').add({
                    id: genId(), action: 'LOGOUT', user: currentUser.name || 'unknown',
                    userId: currentUser.id, timestamp: new Date().toISOString(),
                });
            }
        } catch { /* ignore */ }
        clearSession();
        if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
        setCurrentUser(null);
        const a = getAuth(); if (a) a.signOut();
        setStep('appLogin');
    }, [currentUser, clearSession]);

    const handleResetFirebase = useCallback(() => {
        localStorage.removeItem('vidime-firebase-config-v9');
        localStorage.removeItem('vidime-app-login');
        sessionStorage.removeItem('vidime-app-login');
        clearSession();
        window.location.reload();
    }, [clearSession]);

    // Admin: force logout all
    const forceLogoutAll = useCallback(async () => {
        const db = getDb();
        if (!db) return;
        const newVersion = (sessionConfig.sessionVersion || 1) + 1;
        await db.collection('config').doc('session').set({ ...sessionConfig, sessionVersion: newVersion }, { merge: true });
        setSessionConfig(prev => ({ ...prev, sessionVersion: newVersion }));
    }, [sessionConfig]);

    const updateSessionDuration = useCallback(async (minutes: number) => {
        const db = getDb();
        if (!db) return;
        await db.collection('config').doc('session').set({ ...sessionConfig, sessionDuration: minutes }, { merge: true });
        setSessionConfig(prev => ({ ...prev, sessionDuration: minutes }));
    }, [sessionConfig]);

    const updateSyncMode = useCallback(async (mode: number) => {
        const db = getDb();
        if (!db) return;
        await db.collection('config').doc('session').set({ ...sessionConfig, syncMode: mode }, { merge: true });
        setSessionConfig(prev => ({ ...prev, syncMode: mode }));
    }, [sessionConfig]);

    // Password change
    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        const auth = getAuth();
        if (!auth || !auth.currentUser) throw new Error('Not authenticated');
        if (newPassword.length < 8) throw new Error('Lozinka mora imati barem 8 znakova');
        if (!/[A-Z]/.test(newPassword)) throw new Error('Lozinka mora imati barem 1 veliko slovo');
        if (!/[0-9]/.test(newPassword)) throw new Error('Lozinka mora imati barem 1 broj');
        const email = auth.currentUser.email;
        const fb = (window as any).firebase;
        const credential = fb.auth.EmailAuthProvider.credential(email, currentPassword);
        await auth.currentUser.reauthenticateWithCredential(credential);
        await auth.currentUser.updatePassword(newPassword);
        try {
            const db = getDb();
            if (db) await db.collection('auditLog').add({
                id: genId(), action: 'PASSWORD_CHANGED', user: currentUser?.name || 'unknown',
                userId: currentUser?.id, timestamp: new Date().toISOString(),
            });
        } catch { /* ignore */ }
    }, [currentUser]);

    // GDPR export
    const exportUserData = useCallback(async () => {
        if (!currentUser) throw new Error('Not logged in');
        const db = getDb();
        if (!db) throw new Error('Database not available');
        const data: any = {
            exportDate: new Date().toISOString(),
            user: currentUser,
            timesheets: [],
            dailyLogs: [],
            leaveRequests: [],
        };
        try {
            const snap = await db.collection('leaveRequests').where('workerId', '==', currentUser.id).get();
            snap.forEach((doc: any) => data.leaveRequests.push({ ...doc.data(), id: doc.id }));
        } catch { /* ignore */ }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vidisef-export-${currentUser.id}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        try {
            await db.collection('auditLog').add({
                id: genId(), action: 'DATA_EXPORT', user: currentUser.name,
                userId: currentUser.id, timestamp: new Date().toISOString(),
            });
        } catch { /* ignore */ }
    }, [currentUser]);

    const value = useMemo<AuthContextValue>(() => ({
        step, setStep, currentUser, setCurrentUser, firebaseReady, setFirebaseReady,
        loadError, setLoadError,
        sessionConfig, setSessionConfig, lastSync, setLastSync,
        saveSession, loadSession, clearSession, clearStaleCache,
        handleAppLogin, handleFirebaseLogin, handleFirebaseConfig,
        handleCompanySetup, handleAdminCreate, handleUserLogin, handleLogout, handleResetFirebase,
        forceLogoutAll, updateSessionDuration, updateSyncMode,
        changePassword, exportUserData,
        unsubsRef, sessionCheckRef,
        triggerDataLoad, setTriggerDataLoad,
    }), [step, currentUser, firebaseReady, loadError, sessionConfig, lastSync,
        saveSession, loadSession, clearSession,
        handleAppLogin, handleFirebaseLogin, handleFirebaseConfig,
        handleCompanySetup, handleAdminCreate, handleUserLogin, handleLogout, handleResetFirebase,
        forceLogoutAll, updateSessionDuration, updateSyncMode,
        changePassword, exportUserData]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
