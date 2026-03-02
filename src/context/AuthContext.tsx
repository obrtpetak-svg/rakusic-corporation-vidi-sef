import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { genId } from '../utils/helpers';
import { firebaseSignIn, firebaseSignOut, writeAuthMapping, clearFirestoreCache } from './firebaseCore';
import {
    initFirebase, getDb, getAuth,
    loadFirebaseConfig, saveFirebaseConfig,
    type FirebaseConfig as FBConfig,
} from './firebaseCore';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    reauthenticateWithCredential,
    updatePassword,
    EmailAuthProvider,
} from 'firebase/auth';
import {
    doc, setDoc, getDocs, collection, addDoc,
} from 'firebase/firestore';
import type { User, CompanyProfile, AppStep } from '../types';

// ── Types ────────────────────────────────────────────────────────────────
export interface SessionConfig {
    sessionDuration: number;
    sessionVersion: number | null;
    syncMode: number;
}

export type { FBConfig as FirebaseConfig };

export interface SavedSession {
    userId: string;
    userName: string;
    userRole: string;
    loginAt: string;
    sessionVersion: number;
}

export interface AuthContextValue {
    step: AppStep;
    setStep: (s: AppStep) => void;
    currentUser: User | null;
    setCurrentUser: (u: User | null) => void;
    firebaseReady: boolean;
    setFirebaseReady: (b: boolean) => void;
    loadError: string | null;
    setLoadError: (e: string | null) => void;
    sessionConfig: SessionConfig;
    setSessionConfig: React.Dispatch<React.SetStateAction<SessionConfig>>;
    lastSync: Date | null;
    setLastSync: (d: Date | null) => void;
    // Session helpers
    saveSession: (user: User, version?: number | null) => void;
    loadSession: () => SavedSession | null;
    clearSession: () => void;
    clearStaleCache: () => void;
    // Handlers
    handleAppLogin: () => void;
    handleFirebaseLogin: (username: string, password: string) => Promise<unknown>;
    handleFirebaseConfig: (config: FBConfig) => void;
    handleCompanySetup: (profile: CompanyProfile) => Promise<void>;
    handleAdminCreate: (admin: Partial<User>) => Promise<void>;
    handleUserLogin: (user: User) => void;
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
    sessionCheckRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
    // Trigger data load
    triggerDataLoad: (config: FBConfig) => void;
    setTriggerDataLoad: (fn: (config: FBConfig) => void) => void;
}

// Built-in Firebase config (production)
function getBuiltInConfig(): FBConfig {
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
    const [step, setStep] = useState<AppStep>('loading');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ sessionDuration: 60, sessionVersion: null, syncMode: 0 });
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const unsubsRef = useRef<Array<() => void>>([]);
    const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // DataContext will register its load function here
    const _triggerDataLoadRef = useRef<((config: FBConfig) => void) | null>(null);
    const triggerDataLoad = (config: FBConfig) => {
        if (_triggerDataLoadRef.current) _triggerDataLoadRef.current(config);
    };
    const setTriggerDataLoad = (fn: (config: FBConfig) => void) => {
        _triggerDataLoadRef.current = fn;
    };

    // ── Session persistence helpers ──
    const SESSION_KEY = 'vidime-session';
    const saveSession = useCallback((user: User, version?: number | null) => {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id, userName: user.name, userRole: user.role,
            loginAt: new Date().toISOString(), sessionVersion: version || 1,
        }));
    }, []);
    const loadSession = useCallback((): SavedSession | null => {
        try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
        catch { return null; }
    }, []);
    const clearSession = useCallback(() => localStorage.removeItem(SESSION_KEY), []);

    // ── Boot app (MODULAR — no CDN wait needed) ──
    useEffect(() => {
        const bootApp = async () => {
            const builtIn = getBuiltInConfig();
            const config = builtIn || loadFirebaseConfig();

            if (config) {
                saveFirebaseConfig(config);
                if (!initFirebase(config)) { setLoadError('Firebase init failed'); setStep('appLogin'); return; }

                const auth = getAuth();
                if (auth) {
                    const firebaseUser = await new Promise<unknown>((resolve) => {
                        const unsub = onAuthStateChanged(auth, (user) => {
                            unsub();
                            resolve(user);
                        });
                        setTimeout(() => resolve(null), 8000);
                    });

                    if (firebaseUser && !(firebaseUser as { isAnonymous: boolean }).isAnonymous) {
                        console.log('[Boot] Firebase Auth session restored');
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
                                    setTimeout(() => { clearInterval(waitForDataCtx); reject(new Error('Boot timeout')); }, 15000);
                                }),
                            ]);
                        } catch (bootErr: unknown) {
                            console.error('[Boot] Session restore failed:', (bootErr as Error).message);
                            clearSession();
                            try { const a = getAuth(); if (a) { const { signOut: so } = await import('firebase/auth'); await so(a); } } catch { }
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
            initFirebase(config);
        }

        const auth = getAuth();
        if (!auth) throw new Error('Auth not available');

        const cleanUser = username.toLowerCase().replace(/\s+/g, '.');
        const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@rakusic-corporation.live`;
        console.log('[Auth] Attempting login for:', email);

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            console.log('[Auth] Sign-in OK:', email);

            localStorage.setItem('vidime-app-login', 'true');
            triggerDataLoad(config);

            return cred.user;
        } catch (signInErr: unknown) {
            console.error('[Auth] Sign-in failed:', (signInErr as { code: string }).code);
            throw signInErr;
        }
    }, [firebaseReady]);

    const handleFirebaseConfig = useCallback((config: FBConfig) => {
        saveFirebaseConfig(config);
        triggerDataLoad(config);
    }, []);

    const handleCompanySetup = useCallback(async (profile: CompanyProfile) => {
        const db = getDb();
        if (!db) return;
        await setDoc(doc(db, 'config', 'companyProfile'), profile as Record<string, unknown>);
        const snap = await getDocs(collection(db, 'users'));
        const u: Array<Record<string, unknown>> = [];
        snap.forEach((d) => { const data = { ...d.data(), id: d.id }; if (!(data as { deletedAt?: string }).deletedAt) u.push(data); });
        if (!u.length) setStep('adminCreate');
        else setStep('appLogin');
    }, []);

    const handleAdminCreate = useCallback(async (admin: Partial<User>) => {
        const db = getDb();
        if (!db) return;
        const id = admin.id || genId();
        const adminDoc = { ...admin, id };
        await setDoc(doc(db, 'users', id), adminDoc);
        await setDoc(doc(db, 'workers', id), { ...adminDoc, role: 'admin' });
        setCurrentUser(adminDoc as User);
        setStep('app');
    }, []);

    const handleUserLogin = useCallback((user: User) => {
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
                firebaseSignOut();
                setStep('appLogin');
            }
        }, 30000);
    }, [sessionConfig, saveSession, loadSession, clearSession]);

    const handleLogout = useCallback(() => {
        try {
            const db = getDb();
            if (db && currentUser) {
                addDoc(collection(db, 'auditLog'), {
                    id: genId(), action: 'LOGOUT', user: currentUser.name || 'unknown',
                    userId: currentUser.id, timestamp: new Date().toISOString(),
                });
            }
        } catch { /* ignore */ }
        clearSession();
        if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
        setCurrentUser(null);
        firebaseSignOut();
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
        await setDoc(doc(db, 'config', 'session'), { ...sessionConfig, sessionVersion: newVersion }, { merge: true });
        setSessionConfig(prev => ({ ...prev, sessionVersion: newVersion }));
    }, [sessionConfig]);

    const updateSessionDuration = useCallback(async (minutes: number) => {
        const db = getDb();
        if (!db) return;
        await setDoc(doc(db, 'config', 'session'), { ...sessionConfig, sessionDuration: minutes }, { merge: true });
        setSessionConfig(prev => ({ ...prev, sessionDuration: minutes }));
    }, [sessionConfig]);

    const updateSyncMode = useCallback(async (mode: number) => {
        const db = getDb();
        if (!db) return;
        await setDoc(doc(db, 'config', 'session'), { ...sessionConfig, syncMode: mode }, { merge: true });
        setSessionConfig(prev => ({ ...prev, syncMode: mode }));
    }, [sessionConfig]);

    // Password change (MODULAR)
    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        const auth = getAuth();
        if (!auth || !auth.currentUser) throw new Error('Not authenticated');
        if (newPassword.length < 8) throw new Error('Lozinka mora imati barem 8 znakova');
        if (!/[A-Z]/.test(newPassword)) throw new Error('Lozinka mora imati barem 1 veliko slovo');
        if (!/[0-9]/.test(newPassword)) throw new Error('Lozinka mora imati barem 1 broj');
        const email = auth.currentUser.email;
        if (!email) throw new Error('No email on current user');
        const credential = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        try {
            const db = getDb();
            if (db) await addDoc(collection(db, 'auditLog'), {
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
        const data: Record<string, unknown> = {
            exportDate: new Date().toISOString(),
            user: currentUser,
            timesheets: [],
            dailyLogs: [],
            leaveRequests: [],
        };
        try {
            const { query, where, getDocs: gd } = await import('firebase/firestore');
            const snap = await gd(query(collection(db, 'leaveRequests'), where('workerId', '==', currentUser.id)));
            const leaves: Array<Record<string, unknown>> = [];
            snap.forEach((d) => leaves.push({ ...d.data(), id: d.id }));
            data.leaveRequests = leaves;
        } catch { /* ignore */ }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vidisef-export-${currentUser.id}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        try {
            await addDoc(collection(db, 'auditLog'), {
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
