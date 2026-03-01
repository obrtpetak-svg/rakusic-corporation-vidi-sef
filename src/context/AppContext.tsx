import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { genId, hashPin } from '../utils/helpers';
import { validateOrThrow } from '../utils/validate';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

// ── Domain-specific selector hooks (prevents cascading re-renders) ──────
// Components should prefer these over useApp() when they only need a subset.
// useApp() still works identically for backward compatibility.

export function useAuthState() {
    const ctx = useContext(AppContext);
    return useMemo(() => ({
        step: ctx.step, setStep: ctx.setStep,
        currentUser: ctx.currentUser, setCurrentUser: ctx.setCurrentUser,
        firebaseReady: ctx.firebaseReady, loadError: ctx.loadError,
        handleAppLogin: ctx.handleAppLogin, handleFirebaseConfig: ctx.handleFirebaseConfig,
        handleCompanySetup: ctx.handleCompanySetup, handleAdminCreate: ctx.handleAdminCreate,
        handleUserLogin: ctx.handleUserLogin, handleLogout: ctx.handleLogout,
        handleResetFirebase: ctx.handleResetFirebase,
    }), [ctx.step, ctx.currentUser, ctx.firebaseReady, ctx.loadError]);
}

export function useDataState() {
    const ctx = useContext(AppContext);
    return useMemo(() => ({
        users: ctx.users, projects: ctx.projects, workers: ctx.workers,
        timesheets: ctx.timesheets, invoices: ctx.invoices,
        vehicles: ctx.vehicles, smjestaj: ctx.smjestaj,
        obaveze: ctx.obaveze, otpremnice: ctx.otpremnice,
        auditLog: ctx.auditLog, dailyLogs: ctx.dailyLogs,
        companyProfile: ctx.companyProfile,
        workerMap: ctx.workerMap, projectMap: ctx.projectMap,
        getWorkerName: ctx.getWorkerName, getProjectName: ctx.getProjectName,
        isLeader: ctx.isLeader, leaderProjectIds: ctx.leaderProjectIds, leaderWorkerIds: ctx.leaderWorkerIds,
        add: ctx.add, update: ctx.update, remove: ctx.remove, setDoc: ctx.setDoc,
        addAuditLog: ctx.addAuditLog, loadAuditLog: ctx.loadAuditLog,
        allTimesheetsLoaded: ctx.allTimesheetsLoaded, loadAllTimesheets: ctx.loadAllTimesheets,
        loadDailyLogs: ctx.loadDailyLogs,
    }), [ctx.users, ctx.projects, ctx.workers, ctx.timesheets, ctx.invoices,
    ctx.vehicles, ctx.smjestaj, ctx.obaveze, ctx.otpremnice,
    ctx.auditLog, ctx.dailyLogs, ctx.companyProfile,
    ctx.workerMap, ctx.projectMap, ctx.isLeader, ctx.leaderProjectIds, ctx.leaderWorkerIds,
    ctx.allTimesheetsLoaded]);
}

export function useConfigState() {
    const ctx = useContext(AppContext);
    return useMemo(() => ({
        sessionConfig: ctx.sessionConfig, lastSync: ctx.lastSync,
        forceLogoutAll: ctx.forceLogoutAll,
        updateSessionDuration: ctx.updateSessionDuration,
        updateSyncMode: ctx.updateSyncMode,
        loadDeletedItems: ctx.loadDeletedItems,
        cleanupOldDeleted: ctx.cleanupOldDeleted,
        weatherRules: ctx.weatherRules, loadWeatherRules: ctx.loadWeatherRules,
        safetyTemplates: ctx.safetyTemplates, safetyChecklists: ctx.safetyChecklists,
        loadSafetyData: ctx.loadSafetyData,
    }), [ctx.sessionConfig, ctx.lastSync, ctx.weatherRules,
    ctx.safetyTemplates, ctx.safetyChecklists]);
}

// ── Firebase core ────────────────────────────────────────────────────────
let _db = null;
let _auth = null;
function getDb() { return _db; }
function getAuth() { return _auth; }

export function initFirebase(config) {
    try {
        if (!window.firebase || !config) return false;
        if (window.firebase.apps.length > 0) {
            _db = window.firebase.firestore();
            _auth = window.firebase.auth();
            return true;
        }
        window.firebase.initializeApp(config);
        _db = window.firebase.firestore();
        _auth = window.firebase.auth();
        _db.enablePersistence({ synchronizeTabs: true }).catch(() => { });
        return true;
    } catch (e) { console.error('Firebase init error:', e); return false; }
}

// ── Firestore CRUD (proper collections) ──────────────────────────────────
function handleError(e, op) {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permissions'))) {
        throw new Error('Nemate dozvolu za ovu operaciju. Kontaktirajte administratora.');
    }
    console.error(`Firestore ${op} error:`, e);
}

// Global setter registry for optimistic updates (avoids needing realtime listeners)
const _setterMap = {};
export function _registerSetters(map) { Object.assign(_setterMap, map); }

export async function add(collection, data) {
    const db = getDb(); if (!db) return null;
    const id = data.id || genId();
    const doc = { ...data, id };
    try {
        validateOrThrow(collection, doc);
        await db.collection(collection).doc(id).set(doc);
        // Optimistic local update
        if (_setterMap[collection]) _setterMap[collection](prev => [...prev, doc]);
        return doc;
    }
    catch (e) { handleError(e, 'add'); throw e; }
}

export async function update(collection, id, updates) {
    const db = getDb(); if (!db) return;
    try {
        const stamped = { ...updates, updatedAt: new Date().toISOString() };
        await db.collection(collection).doc(id).update(stamped);
        // Optimistic local update
        if (_setterMap[collection]) _setterMap[collection](prev => prev.map(d => d.id === id ? { ...d, ...stamped } : d));
    }
    catch (e) { handleError(e, 'update'); throw e; }
}

export async function remove(collection, id) {
    // Guard: prevent deleting audit log entries
    if (collection === 'auditLog') {
        console.warn('Audit log entries cannot be deleted');
        return;
    }
    const db = getDb(); if (!db) return;
    try {
        // Soft delete: mark with deletedAt instead of removing
        const deletedAt = new Date().toISOString();
        await db.collection(collection).doc(id).update({ deletedAt });
        // Optimistic: hide from local state
        if (_setterMap[collection]) _setterMap[collection](prev => prev.filter(d => d.id !== id));
        // Store deleted item info for undo
        _lastDeleted = { collection, id, deletedAt };
    }
    catch (e) { handleError(e, 'remove'); throw e; }
}

// Undo last soft delete
let _lastDeleted = null;
export function getLastDeleted() { return _lastDeleted; }

export async function restoreItem(collection, id) {
    const db = getDb(); if (!db) return;
    try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        delete data.deletedAt;
        await db.collection(collection).doc(id).set(data);
        // Optimistic: re-add to local state
        if (_setterMap[collection]) _setterMap[collection](prev => [...prev, { ...data, id }]);
        _lastDeleted = null;
    }
    catch (e) { handleError(e, 'restore'); throw e; }
}

export async function permanentDelete(collection, id) {
    const db = getDb(); if (!db) return;
    try {
        await db.collection(collection).doc(id).delete();
    }
    catch (e) { handleError(e, 'permanentDelete'); throw e; }
}

export async function setDoc(collection, docId, data) {
    const db = getDb(); if (!db) return;
    try { await db.collection(collection).doc(docId).set(data); }
    catch (e) { handleError(e, 'setDoc'); throw e; }
}

// Batch operations for backup/restore
export async function batchSet(collection, items) {
    const db = getDb(); if (!db) return;
    for (let i = 0; i < items.length; i += 450) {
        const batch = db.batch();
        items.slice(i, i + 450).forEach(item => {
            const id = item.id || genId();
            batch.set(db.collection(collection).doc(id), { ...item, id });
        });
        await batch.commit();
    }
}

export async function clearCollection(collection) {
    const db = getDb(); if (!db) return;
    const snap = await db.collection(collection).get();
    for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = db.batch();
        snap.docs.slice(i, i + 450).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

// Config persistence
export function loadFirebaseConfig() {
    try { const c = localStorage.getItem('vidime-firebase-config-v9'); return c ? JSON.parse(c) : null; }
    catch { return null; }
}
export function saveFirebaseConfig(config) {
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

// ── Collection names ─────────────────────────────────────────────────────
const COL = {
    users: 'users', workers: 'workers', projects: 'projects',
    timesheets: 'timesheets', invoices: 'invoices', vehicles: 'vehicles',
    smjestaj: 'smjestaj', obaveze: 'obaveze', otpremnice: 'otpremnice',
    auditLog: 'auditLog',
};

// ── AppProvider ──────────────────────────────────────────────────────────
export function AppProvider({ children }) {
    const [step, setStep] = useState('loading');
    const [currentUser, setCurrentUser] = useState(null);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [loadError, setLoadError] = useState(null);

    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [timesheets, setTimesheets] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [smjestaj, setSmjestaj] = useState([]);
    const [obaveze, setObaveze] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    const [companyProfile, setCompanyProfile] = useState(null);

    // Register setters for optimistic updates (used by add/update/remove)
    useEffect(() => {
        _registerSetters({
            users: setUsers, projects: setProjects, workers: setWorkers,
            timesheets: setTimesheets, invoices: setInvoices, vehicles: setVehicles,
            smjestaj: setSmjestaj, obaveze: setObaveze, otpremnice: setOtpremnice,
            auditLog: setAuditLog,
        });
    }, []);
    const [allTimesheetsLoaded, setAllTimesheetsLoaded] = useState(false);
    const [dailyLogs, setDailyLogs] = useState([]);
    const [dailyLogsLoaded, setDailyLogsLoaded] = useState(false);
    const [weatherRules, setWeatherRules] = useState([]);
    const [weatherRulesLoaded, setWeatherRulesLoaded] = useState(false);
    const [safetyTemplates, setSafetyTemplates] = useState([]);
    const [safetyChecklists, setSafetyChecklists] = useState([]);
    const [safetyLoaded, setSafetyLoaded] = useState(false);
    const [sessionConfig, setSessionConfig] = useState({ sessionDuration: 60, sessionVersion: 1, syncMode: 0 });
    const [lastSync, setLastSync] = useState(null);

    const unsubsRef = useRef([]);
    const sessionCheckRef = useRef(null);

    // ── Session persistence helpers ──
    const SESSION_KEY = 'vidime-session';
    const saveSession = (user, version) => {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id, userName: user.name, userRole: user.role,
            loginAt: new Date().toISOString(), sessionVersion: version || 1,
        }));
    };
    const loadSession = () => {
        try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
        catch { return null; }
    };
    const clearSession = () => localStorage.removeItem(SESSION_KEY);

    // ── Map lookups (O(1) instead of O(n) array.find) ──
    const workerMap = useMemo(() => {
        const m = new Map();
        workers.forEach(w => m.set(w.id, w));
        return m;
    }, [workers]);

    const projectMap = useMemo(() => {
        const m = new Map();
        projects.forEach(p => m.set(p.id, p));
        return m;
    }, [projects]);

    const getWorkerName = useCallback((id) => workerMap.get(id)?.name || '—', [workerMap]);
    const getProjectName = useCallback((id) => projectMap.get(id)?.name || '—', [projectMap]);

    useEffect(() => {
        // Check for built-in config (production build with env vars)
        const builtIn = getBuiltInConfig();
        if (builtIn) {
            saveFirebaseConfig(builtIn);
            localStorage.setItem('vidime-app-login', 'true');
            initFirebaseAndLoad(builtIn);
            return () => unsubsRef.current.forEach(fn => fn());
        }

        // Clean build: normal flow with manual config entry
        const appLoggedIn = localStorage.getItem('vidime-app-login') || sessionStorage.getItem('vidime-app-login');
        if (appLoggedIn === 'true') {
            // Migrate from sessionStorage to localStorage
            if (!localStorage.getItem('vidime-app-login')) localStorage.setItem('vidime-app-login', 'true');
            const config = loadFirebaseConfig();
            if (config) initFirebaseAndLoad(config);
            else setStep('firebaseConfig');
        } else {
            setStep('appLogin');
        }
        return () => { unsubsRef.current.forEach(fn => fn()); if (sessionCheckRef.current) clearInterval(sessionCheckRef.current); };
    }, []);

    const snapToArray = (snap) => {
        const items = [];
        snap.forEach(doc => {
            const d = { ...doc.data(), id: doc.id };
            if (!d.deletedAt) items.push(d); // Skip soft-deleted
        });
        return items;
    };

    // ── Reads telemetry (dev only) ──────────────────────────────────────────
    const logReads = (source, collection, count, type = 'get') => {
        if (import.meta.env.DEV) {
            console.log(`[READS] ${type.toUpperCase()} ${collection}: ${count} docs (${source})`);
        }
    };

    // ── Refresh functions for non-realtime collections ─────────────────────
    const refreshCollection = useCallback(async (name, setter) => {
        const db = getDb(); if (!db) return;
        const snap = await db.collection(name).get();
        const items = snapToArray(snap);
        logReads('refresh', name, items.length);
        setter(items);
    }, []);

    const initFirebaseAndLoad = async (config) => {
        setLoadError(null);
        try {
            console.log('[AppContext] Starting Firebase init...');
            let tries = 0;
            while (!window.firebase && tries < 50) { await new Promise(r => setTimeout(r, 100)); tries++; }
            if (!window.firebase) { setLoadError('Firebase library not loaded'); setStep('firebaseConfig'); return; }
            if (!initFirebase(config)) { setLoadError('Firebase init failed — check config'); setStep('firebaseConfig'); return; }
            console.log('[AppContext] Firebase initialized. Auth:', !!getAuth());

            // Sign in anonymously so Firestore security rules allow reads
            const auth = getAuth();
            if (auth) {
                if (auth.currentUser) {
                    console.log('[AppContext] Already signed in:', auth.currentUser.uid);
                } else {
                    try {
                        console.log('[AppContext] Attempting anonymous sign-in...');
                        const cred = await auth.signInAnonymously();
                        console.log('[AppContext] Anonymous sign-in OK:', cred.user.uid);
                    } catch (authErr) {
                        console.error('[AppContext] Anonymous sign-in FAILED:', authErr.code, authErr.message);
                    }
                }
            } else {
                console.warn('[AppContext] No auth instance available');
            }

            setFirebaseReady(true);

            const db = getDb();

            // ── Helper: one-time fetch (NO listener) ──
            const loadCol = async (name) => {
                const snap = await db.collection(name).get();
                const items = snapToArray(snap);
                logReads('boot', name, items.length);
                return items;
            };
            const loadDoc = async (col, id) => {
                const d = await db.collection(col).doc(id).get();
                logReads('boot', `${col}/${id}`, d.exists ? 1 : 0);
                return d.exists ? d.data() : null;
            };

            // ── Cutoff dates ──
            const cutoff30 = new Date();
            cutoff30.setDate(cutoff30.getDate() - 30);
            const cutoff30Str = cutoff30.toISOString().slice(0, 10);

            // ══════════════════════════════════════════════════════════════════
            // BOOT STRATEGY (optimized):
            //   - Tier 1 (REALTIME): users, projects, workers, timesheets, obaveze
            //     → NO initial get() — onSnapshot handles both initial + realtime
            //   - Tier 2 (STATIC): vehicles, smjestaj, otpremnice, invoices
            //     → One-time get() only, NO listener
            //   - Tier 4 (ON-DEMAND): auditLog, dailyLogs, safety, weather
            //     → NOT loaded on boot at all
            // ══════════════════════════════════════════════════════════════════

            // Load users first (needed for PIN migration + step flow decisions)
            // The realtime listener will take over right after for live updates.
            const [u, inv, veh, smj, otp, cp] = await Promise.all([
                loadCol('users'),
                loadCol('invoices'), loadCol('vehicles'),
                loadCol('smjestaj'), loadCol('otpremnice'),
                loadDoc('config', 'companyProfile'),
            ]);

            // Set initial data
            setUsers(u);
            setInvoices(inv); setVehicles(veh);
            setSmjestaj(smj); setOtpremnice(otp);
            setCompanyProfile(cp);

            // One-time PIN migration: hash any plain-text PINs to hash('1234')
            const isHashed = (pin) => /^[a-f0-9]{64}$/.test(pin);
            const usersToMigrate = u.filter(user => user.pin && !isHashed(user.pin));
            if (usersToMigrate.length > 0) {
                const defaultHashedPin = await hashPin('1234');
                for (const user of usersToMigrate) {
                    await db.collection('users').doc(user.id).update({ pin: defaultHashedPin });
                }
                console.log(`Migrated ${usersToMigrate.length} user PINs to hashed default.`);
            }

            // ── Realtime listeners (Tier 1 — single source of truth) ─────────
            // These replace BOTH initial load AND ongoing updates.
            // onSnapshot fires immediately with cached/server data.
            const listenWithLog = (col, setter, query) => {
                const src = query || db.collection(col);
                return src.onSnapshot(snap => {
                    const items = snapToArray(snap);
                    logReads('listener', col, items.length, 'onSnapshot');
                    setter(items);
                });
            };

            // Timesheets: last 30 days, limit 200, ordered by date
            const tsQuery = db.collection('timesheets')
                .where('date', '>=', cutoff30Str)
                .orderBy('date', 'desc')
                .limit(200);

            const tsUnsub = tsQuery.onSnapshot(snap => {
                const recentDocs = snapToArray(snap);
                logReads('listener', 'timesheets', recentDocs.length, 'onSnapshot');
                setTimesheets(prev => {
                    const oldDocs = prev.filter(d => (d.date || '') < cutoff30Str);
                    return [...oldDocs, ...recentDocs];
                });
            });

            // Determine sync mode (0 = realtime, >0 = polling interval in minutes)
            const syncMode = sessionConfig.syncMode || 0;

            if (syncMode === 0) {
                // REALTIME MODE — listeners ONLY for Tier 1 (operational data)
                unsubsRef.current = [
                    listenWithLog('users', setUsers),
                    listenWithLog('projects', setProjects),
                    listenWithLog('workers', setWorkers),
                    tsUnsub,
                    listenWithLog('obaveze', setObaveze),
                    // Config docs (1 doc each — cheap)
                    db.collection('config').doc('companyProfile').onSnapshot(doc => setCompanyProfile(doc.exists ? doc.data() : null)),
                ];
                // NOTE: invoices, vehicles, smjestaj, otpremnice — NO listeners.
                // They were loaded via get() above. Use refreshCollection() to update.
            } else {
                // POLLING MODE — no realtime listeners, data already loaded above
                unsubsRef.current = [
                    db.collection('config').doc('companyProfile').onSnapshot(doc => setCompanyProfile(doc.exists ? doc.data() : null)),
                ];
                setLastSync(new Date());
            }

            if (!cp) { setStep('companySetup'); return; }
            if (!u.length) { setStep('adminCreate'); return; }

            // ── Session config listener ──
            unsubsRef.current.push(
                db.collection('config').doc('session').onSnapshot(doc => {
                    if (doc.exists) {
                        const sc = doc.data();
                        setSessionConfig(prev => {
                            // Force logout if remote version changed
                            if (prev.sessionVersion && sc.sessionVersion && sc.sessionVersion > prev.sessionVersion) {
                                clearSession();
                                setCurrentUser(null);
                                setStep('userLogin');
                            }
                            return { sessionDuration: sc.sessionDuration || 60, sessionVersion: sc.sessionVersion || 1, syncMode: sc.syncMode || 0 };
                        });
                    }
                })
            );

            // ── Try to restore session from localStorage ──
            const saved = loadSession();
            if (saved) {
                const elapsed = (Date.now() - new Date(saved.loginAt).getTime()) / 60000;
                const maxDuration = sessionConfig.sessionDuration || 60;
                if (elapsed < maxDuration) {
                    const restoredUser = u.find(usr => usr.id === saved.userId);
                    if (restoredUser) {
                        console.log('[Session] Restored:', restoredUser.name, `(${Math.round(elapsed)}min ago)`);
                        setCurrentUser(restoredUser);
                        setStep('app');
                        // Start periodic session check
                        sessionCheckRef.current = setInterval(() => {
                            const s = loadSession();
                            if (!s) return;
                            const age = (Date.now() - new Date(s.loginAt).getTime()) / 60000;
                            if (age >= maxDuration) { clearSession(); setCurrentUser(null); setStep('userLogin'); }
                        }, 30000); // check every 30s
                        return;
                    }
                }
                clearSession(); // expired or user not found
            }
            setStep('userLogin');
        } catch (err) {
            console.error('[AppContext] Firebase load error:', err);
            setLoadError(err.message);
            setStep('firebaseConfig');
        }
    };

    const handleAppLogin = () => {
        localStorage.setItem('vidime-app-login', 'true');
        sessionStorage.setItem('vidime-app-login', 'true');
        const config = loadFirebaseConfig();
        if (config) initFirebaseAndLoad(config);
        else setStep('firebaseConfig');
    };

    const handleFirebaseConfig = (config) => {
        saveFirebaseConfig(config);
        initFirebaseAndLoad(config);
    };

    const handleCompanySetup = async (profile) => {
        await setDoc('config', 'companyProfile', profile);
        const u = snapToArray(await getDb().collection('users').get());
        if (!u.length) setStep('adminCreate');
        else setStep('userLogin');
    };

    const handleAdminCreate = async (admin) => {
        await add('users', admin);
        await add('workers', { ...admin, role: 'admin' });
        setCurrentUser(admin);
        setStep('app');
    };

    const handleUserLogin = (user) => {
        setCurrentUser(user);
        saveSession(user, sessionConfig.sessionVersion);
        setStep('app');
        // Start periodic session check
        if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
        sessionCheckRef.current = setInterval(() => {
            const s = loadSession();
            if (!s) return;
            const age = (Date.now() - new Date(s.loginAt).getTime()) / 60000;
            if (age >= (sessionConfig.sessionDuration || 60)) { clearSession(); setCurrentUser(null); setStep('userLogin'); }
        }, 30000);
    };
    const handleLogout = () => { clearSession(); if (sessionCheckRef.current) clearInterval(sessionCheckRef.current); setCurrentUser(null); setStep('userLogin'); };
    const handleResetFirebase = () => {
        localStorage.removeItem('vidime-firebase-config-v9');
        localStorage.removeItem('vidime-app-login');
        sessionStorage.removeItem('vidime-app-login');
        clearSession();
        window.location.reload();
    };

    // Admin: force logout all users by incrementing sessionVersion
    const forceLogoutAll = useCallback(async () => {
        const db = getDb();
        if (!db) return;
        const newVersion = (sessionConfig.sessionVersion || 1) + 1;
        await db.collection('config').doc('session').set({ ...sessionConfig, sessionVersion: newVersion }, { merge: true });
        setSessionConfig(prev => ({ ...prev, sessionVersion: newVersion }));
    }, [sessionConfig]);

    // Admin: update session duration
    const updateSessionDuration = useCallback(async (minutes) => {
        const db = getDb();
        if (!db) return;
        await db.collection('config').doc('session').set({ ...sessionConfig, sessionDuration: minutes }, { merge: true });
        setSessionConfig(prev => ({ ...prev, sessionDuration: minutes }));
    }, [sessionConfig]);

    // Admin: update sync mode (0 = realtime, 5/30/60 = polling minutes)
    const updateSyncMode = useCallback(async (mode) => {
        const db = getDb();
        if (!db) return;
        await db.collection('config').doc('session').set({ ...sessionConfig, syncMode: mode }, { merge: true });
        setSessionConfig(prev => ({ ...prev, syncMode: mode }));
        // No reload — useEffect reacts to syncMode change automatically
    }, [sessionConfig]);

    // Polling interval effect
    useEffect(() => {
        const syncMode = sessionConfig.syncMode || 0;
        if (syncMode === 0 || step !== 'app') return; // realtime mode or not logged in

        const intervalMs = syncMode * 60 * 1000;
        const doRefresh = async () => {
            const db = getDb();
            if (!db) return;
            try {
                const loadCol = async (name) => {
                    const snap = await db.collection(name).get();
                    const items = snapToArray(snap);
                    if (import.meta.env.DEV) console.log(`[READS] POLL ${name}: ${items.length} docs`);
                    return items;
                };
                const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
                const cutStr = cutoff.toISOString().slice(0, 10);
                const [u, p, w, inv, veh, smj, ob, otp] = await Promise.all([
                    loadCol('users'), loadCol('projects'), loadCol('workers'),
                    loadCol('invoices'), loadCol('vehicles'), loadCol('smjestaj'),
                    loadCol('obaveze'), loadCol('otpremnice'),
                ]);
                const tsSnap = await db.collection('timesheets').where('date', '>=', cutStr).limit(200).get();
                const ts = snapToArray(tsSnap);
                if (import.meta.env.DEV) console.log(`[READS] POLL timesheets: ${ts.length} docs (30-day)`);
                setUsers(u); setProjects(p); setWorkers(w);
                setTimesheets(prev => {
                    const oldDocs = prev.filter(d => (d.date || '') < cutStr);
                    return [...oldDocs, ...ts];
                });
                setInvoices(inv); setVehicles(veh); setSmjestaj(smj); setObaveze(ob); setOtpremnice(otp);
                setLastSync(new Date());
                console.log(`[Polling] Data refreshed at ${new Date().toLocaleTimeString()}`);
            } catch (e) { console.error('[Polling] Refresh failed:', e); }
        };

        const timer = setInterval(doRefresh, intervalMs);
        return () => clearInterval(timer);
    }, [sessionConfig.syncMode, step]);

    // Audit log helper
    const addAuditLog = useCallback(async (action, details) => {
        const entry = { id: genId(), action, user: currentUser?.name || 'System', timestamp: new Date().toISOString(), details };
        await add('auditLog', entry);
        setAuditLog(prev => [...prev, entry]);
    }, [currentUser]);

    // Lazy load auditLog (for SettingsPage)
    const [auditLogLoaded, setAuditLogLoaded] = useState(false);
    const loadAuditLog = useCallback(async () => {
        if (auditLogLoaded) return;
        const db = getDb();
        if (!db) return;
        try {
            const snap = await db.collection('auditLog').get();
            setAuditLog(snapToArray(snap));
            setAuditLogLoaded(true);
        } catch (e) { console.error('Failed to load auditLog:', e); }
    }, [auditLogLoaded]);

    // Trash: load soft-deleted items across collections
    const TRASH_COLLECTIONS = ['workers', 'projects', 'timesheets', 'invoices', 'vehicles', 'smjestaj', 'obaveze', 'otpremnice'];
    const loadDeletedItems = useCallback(async () => {
        const db = getDb(); if (!db) return [];
        const results = [];
        for (const col of TRASH_COLLECTIONS) {
            try {
                const snap = await db.collection(col).where('deletedAt', '!=', null).get();
                snap.forEach(doc => results.push({ ...doc.data(), id: doc.id, _collection: col }));
            } catch { /* collection may not have deletedAt field yet */ }
        }
        return results.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    }, []);

    // Trash: permanently delete items older than 30 days
    const cleanupOldDeleted = useCallback(async () => {
        const db = getDb(); if (!db) return 0;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const cutStr = cutoff.toISOString();
        let count = 0;
        for (const col of TRASH_COLLECTIONS) {
            try {
                const snap = await db.collection(col).where('deletedAt', '!=', null).get();
                for (const doc of snap.docs) {
                    if (doc.data().deletedAt < cutStr) {
                        await db.collection(col).doc(doc.id).delete();
                        count++;
                    }
                }
            } catch { /* skip */ }
        }
        return count;
    }, []);

    // Lazy load ALL timesheets (for archive/reports)
    const loadAllTimesheets = useCallback(async () => {
        if (allTimesheetsLoaded) return;
        const db = getDb();
        if (!db) return;
        try {
            const snap = await db.collection('timesheets').get();
            setTimesheets(snapToArray(snap));
            setAllTimesheetsLoaded(true);
        } catch (e) { console.error('Failed to load all timesheets:', e); }
    }, [allTimesheetsLoaded]);

    // Lazy load dailyLogs
    const loadDailyLogs = useCallback(async () => {
        if (dailyLogsLoaded) return;
        const db = getDb();
        if (!db) return;
        try {
            const snap = await db.collection('dailyLogs').get();
            setDailyLogs(snapToArray(snap));
            setDailyLogsLoaded(true);
        } catch (e) { console.error('Failed to load dailyLogs:', e); }
    }, [dailyLogsLoaded]);

    // Lazy load weatherRules
    const loadWeatherRules = useCallback(async () => {
        if (weatherRulesLoaded) return;
        const db = getDb();
        if (!db) return;
        try {
            const snap = await db.collection('weatherRules').get();
            setWeatherRules(snapToArray(snap));
            setWeatherRulesLoaded(true);
        } catch (e) { console.error('Failed to load weatherRules:', e); }
    }, [weatherRulesLoaded]);

    // Lazy load safety data
    const loadSafetyData = useCallback(async () => {
        if (safetyLoaded) return;
        const db = getDb();
        if (!db) return;
        try {
            const [tSnap, cSnap] = await Promise.all([
                db.collection('safetyTemplates').get(),
                db.collection('safetyChecklists').get(),
            ]);
            setSafetyTemplates(snapToArray(tSnap));
            setSafetyChecklists(snapToArray(cSnap));
            setSafetyLoaded(true);
        } catch (e) { console.error('Failed to load safety data:', e); }
    }, [safetyLoaded]);

    // Leader role support
    const isLeader = currentUser?.role === 'leader';
    const leaderProjectIds = useMemo(() => currentUser?.assignedProjects || [], [currentUser]);
    const leaderWorkerIds = useMemo(() => {
        if (!isLeader || !leaderProjectIds.length) return [];
        const ids = new Set();
        projects.filter(p => leaderProjectIds.includes(p.id)).forEach(p => (p.workers || []).forEach(wId => ids.add(wId)));
        return [...ids];
    }, [isLeader, leaderProjectIds, projects]);

    // ── Refresh shortcuts for non-realtime (Tier 2) collections ──
    const refreshInvoices = useCallback(() => refreshCollection('invoices', setInvoices), [refreshCollection]);
    const refreshVehicles = useCallback(() => refreshCollection('vehicles', setVehicles), [refreshCollection]);
    const refreshSmjestaj = useCallback(() => refreshCollection('smjestaj', setSmjestaj), [refreshCollection]);
    const refreshOtpremnice = useCallback(() => refreshCollection('otpremnice', setOtpremnice), [refreshCollection]);

    const value = useMemo(() => ({
        step, setStep, currentUser, setCurrentUser, firebaseReady, loadError,
        users, setUsers, projects, setProjects, workers, setWorkers,
        timesheets, setTimesheets, invoices, setInvoices,
        vehicles, setVehicles, smjestaj, setSmjestaj,
        obaveze, setObaveze, otpremnice, setOtpremnice,
        auditLog, setAuditLog, companyProfile, setCompanyProfile,
        dailyLogs, setDailyLogs,
        weatherRules, setWeatherRules,
        safetyTemplates, setSafetyTemplates,
        safetyChecklists, setSafetyChecklists,
        workerMap, projectMap, getWorkerName, getProjectName,
        add, update, remove, setDoc,
        addAuditLog, loadAuditLog, allTimesheetsLoaded, loadAllTimesheets,
        loadDailyLogs, loadWeatherRules, loadSafetyData,
        isLeader, leaderProjectIds, leaderWorkerIds,
        handleAppLogin, handleFirebaseConfig, handleCompanySetup,
        handleAdminCreate, handleUserLogin, handleLogout, handleResetFirebase,
        sessionConfig, forceLogoutAll, updateSessionDuration, updateSyncMode, lastSync,
        loadDeletedItems, cleanupOldDeleted,
        refreshInvoices, refreshVehicles, refreshSmjestaj, refreshOtpremnice,
    }), [step, currentUser, firebaseReady, loadError,
        users, projects, workers, timesheets, invoices,
        vehicles, smjestaj, obaveze, otpremnice,
        auditLog, companyProfile, dailyLogs, weatherRules,
        safetyTemplates, safetyChecklists,
        workerMap, projectMap, getWorkerName, getProjectName,
        allTimesheetsLoaded, isLeader, leaderProjectIds, leaderWorkerIds,
        sessionConfig, lastSync,
        addAuditLog, loadAuditLog, loadAllTimesheets, loadDailyLogs,
        loadWeatherRules, loadSafetyData, forceLogoutAll,
        updateSessionDuration, updateSyncMode,
        handleAppLogin, handleFirebaseConfig, handleCompanySetup,
        handleAdminCreate, handleUserLogin, handleLogout, handleResetFirebase,
        loadDeletedItems, cleanupOldDeleted,
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

