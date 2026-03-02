import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { genId, hashPin } from '../utils/helpers';
import { validateOrThrow } from '../utils/validate';
import { writeAuthMapping } from './firebaseCore';
import { useAuth, getDb, getAuth, initFirebase, loadFirebaseConfig, getBuiltInConfig as _noop } from './AuthContext';

// ── Types ────────────────────────────────────────────────────────────────
export interface DataContextValue {
    users: any[]; setUsers: React.Dispatch<React.SetStateAction<any[]>>;
    projects: any[]; setProjects: React.Dispatch<React.SetStateAction<any[]>>;
    workers: any[]; setWorkers: React.Dispatch<React.SetStateAction<any[]>>;
    timesheets: any[]; setTimesheets: React.Dispatch<React.SetStateAction<any[]>>;
    invoices: any[]; setInvoices: React.Dispatch<React.SetStateAction<any[]>>;
    vehicles: any[]; setVehicles: React.Dispatch<React.SetStateAction<any[]>>;
    smjestaj: any[]; setSmjestaj: React.Dispatch<React.SetStateAction<any[]>>;
    obaveze: any[]; setObaveze: React.Dispatch<React.SetStateAction<any[]>>;
    otpremnice: any[]; setOtpremnice: React.Dispatch<React.SetStateAction<any[]>>;
    production: any[]; setProduction: React.Dispatch<React.SetStateAction<any[]>>;
    prodAlerts: any[]; setProdAlerts: React.Dispatch<React.SetStateAction<any[]>>;
    auditLog: any[]; setAuditLog: React.Dispatch<React.SetStateAction<any[]>>;
    companyProfile: any; setCompanyProfile: (cp: any) => void;
    dailyLogs: any[]; setDailyLogs: React.Dispatch<React.SetStateAction<any[]>>;
    weatherRules: any[]; setWeatherRules: React.Dispatch<React.SetStateAction<any[]>>;
    safetyTemplates: any[]; setSafetyTemplates: React.Dispatch<React.SetStateAction<any[]>>;
    safetyChecklists: any[]; setSafetyChecklists: React.Dispatch<React.SetStateAction<any[]>>;
    workerMap: Map<string, any>;
    projectMap: Map<string, any>;
    getWorkerName: (id: string) => string;
    getProjectName: (id: string) => string;
    isLeader: boolean;
    leaderProjectIds: string[];
    leaderWorkerIds: string[];
    // CRUD
    add: (collection: string, data: any) => Promise<any>;
    update: (collection: string, id: string, updates: any) => Promise<void>;
    remove: (collection: string, id: string) => Promise<void>;
    setDoc: (collection: string, docId: string, data: any) => Promise<void>;
    // Lazy loaders
    addAuditLog: (action: string, details: any) => Promise<void>;
    loadAuditLog: () => Promise<void>;
    allTimesheetsLoaded: boolean;
    loadAllTimesheets: () => Promise<void>;
    loadDailyLogs: () => Promise<void>;
    loadWeatherRules: () => Promise<void>;
    loadSafetyData: () => Promise<void>;
    loadProduction: () => Promise<void>;
    loadDeletedItems: () => Promise<any[]>;
    cleanupOldDeleted: () => Promise<number>;
    // Refresh
    refreshInvoices: () => Promise<void>;
    refreshVehicles: () => Promise<void>;
    refreshSmjestaj: () => Promise<void>;
    refreshOtpremnice: () => Promise<void>;
    refreshProduction: () => Promise<void>;
}

// ── Error handler ────────────────────────────────────────────────────────
function handleError(e: any, op: string) {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permissions'))) {
        throw new Error('Nemate dozvolu za ovu operaciju. Kontaktirajte administratora.');
    }
    console.error(`Firestore ${op} error:`, e);
}

// ── Global setter registry ───────────────────────────────────────────────
const _setterMap: Record<string, any> = {};

// ── Snap to array helper ─────────────────────────────────────────────────
function snapToArray(snap: any): any[] {
    const items: any[] = [];
    snap.forEach((doc: any) => {
        const d = { ...doc.data(), id: doc.id };
        if (!d.deletedAt) items.push(d);
    });
    return items;
}

// ── Reads telemetry ──────────────────────────────────────────────────────
function logReads(source: string, collection: string, count: number, type = 'get') {
    if ((import.meta as any).env?.DEV) {
        console.log(`[READS] ${type.toUpperCase()} ${collection}: ${count} docs (${source})`);
    }
}

// ── Context ──────────────────────────────────────────────────────────────
const DataContext = createContext<DataContextValue | null>(null);
export function useData(): DataContextValue {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used within DataProvider');
    return ctx;
}

// ── TRASH collections ────────────────────────────────────────────────────
const TRASH_COLLECTIONS = ['workers', 'projects', 'timesheets', 'invoices', 'vehicles', 'smjestaj', 'obaveze', 'otpremnice', 'production'];

// ── Provider ─────────────────────────────────────────────────────────────
export function DataProvider({ children }: { children: React.ReactNode }) {
    const auth = useAuth();

    const [users, setUsers] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);
    const [timesheets, setTimesheets] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [smjestaj, setSmjestaj] = useState<any[]>([]);
    const [obaveze, setObaveze] = useState<any[]>([]);
    const [otpremnice, setOtpremnice] = useState<any[]>([]);
    const [production, setProduction] = useState<any[]>([]);
    const [prodAlerts, setProdAlerts] = useState<any[]>([]);
    const [auditLog, setAuditLog] = useState<any[]>([]);
    const [companyProfile, setCompanyProfile] = useState<any>(null);
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);
    const [weatherRules, setWeatherRules] = useState<any[]>([]);
    const [safetyTemplates, setSafetyTemplates] = useState<any[]>([]);
    const [safetyChecklists, setSafetyChecklists] = useState<any[]>([]);

    const [allTimesheetsLoaded, setAllTimesheetsLoaded] = useState(false);
    const [dailyLogsLoaded, setDailyLogsLoaded] = useState(false);
    const [weatherRulesLoaded, setWeatherRulesLoaded] = useState(false);
    const [safetyLoaded, setSafetyLoaded] = useState(false);
    const [productionLoaded, setProductionLoaded] = useState(false);
    const [auditLogLoaded, setAuditLogLoaded] = useState(false);

    // Register setters for optimistic CRUD updates
    useEffect(() => {
        Object.assign(_setterMap, {
            users: setUsers, projects: setProjects, workers: setWorkers,
            timesheets: setTimesheets, invoices: setInvoices, vehicles: setVehicles,
            smjestaj: setSmjestaj, obaveze: setObaveze, otpremnice: setOtpremnice,
            production: setProduction, prodAlerts: setProdAlerts, auditLog: setAuditLog,
        });
    }, []);

    // ── Map lookups ──
    const workerMap = useMemo(() => { const m = new Map(); workers.forEach(w => m.set(w.id, w)); return m; }, [workers]);
    const projectMap = useMemo(() => { const m = new Map(); projects.forEach(p => m.set(p.id, p)); return m; }, [projects]);
    const getWorkerName = useCallback((id: string) => workerMap.get(id)?.name || '—', [workerMap]);
    const getProjectName = useCallback((id: string) => projectMap.get(id)?.name || '—', [projectMap]);

    // Leader role
    const isLeader = auth.currentUser?.role === 'leader';
    const leaderProjectIds = useMemo(() => auth.currentUser?.assignedProjects || [], [auth.currentUser]);
    const leaderWorkerIds = useMemo(() => {
        if (!isLeader || !leaderProjectIds.length) return [];
        const ids = new Set<string>();
        projects.filter(p => leaderProjectIds.includes(p.id)).forEach(p => (p.workers || []).forEach((wId: string) => ids.add(wId)));
        return [...ids];
    }, [isLeader, leaderProjectIds, projects]);

    // ── CRUD ──
    const add = useCallback(async (collection: string, data: any) => {
        const db = getDb(); if (!db) return null;
        const id = data.id || genId();
        const doc = { ...data, id };
        try {
            validateOrThrow(collection, doc);
            await db.collection(collection).doc(id).set(doc);
            if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => [...prev, doc]);
            return doc;
        } catch (e) { handleError(e, 'add'); throw e; }
    }, []);

    const update = useCallback(async (collection: string, id: string, updates: any) => {
        const db = getDb(); if (!db) return;
        try {
            const stamped = { ...updates, updatedAt: new Date().toISOString() };
            await db.collection(collection).doc(id).update(stamped);
            if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => prev.map(d => d.id === id ? { ...d, ...stamped } : d));
        } catch (e) { handleError(e, 'update'); throw e; }
    }, []);

    const remove = useCallback(async (collection: string, id: string) => {
        if (collection === 'auditLog') { console.warn('Audit log entries cannot be deleted'); return; }
        const db = getDb(); if (!db) return;
        try {
            const deletedAt = new Date().toISOString();
            await db.collection(collection).doc(id).update({ deletedAt });
            if (_setterMap[collection]) _setterMap[collection]((prev: any[]) => prev.filter(d => d.id !== id));
        } catch (e) { handleError(e, 'remove'); throw e; }
    }, []);

    const setDocFn = useCallback(async (collection: string, docId: string, data: any) => {
        const db = getDb(); if (!db) return;
        try { await db.collection(collection).doc(docId).set(data); }
        catch (e) { handleError(e, 'setDoc'); throw e; }
    }, []);

    // ── Refresh helper ──
    const refreshCollection = useCallback(async (name: string, setter: any) => {
        const db = getDb(); if (!db) return;
        const snap = await db.collection(name).get();
        const items = snapToArray(snap);
        logReads('refresh', name, items.length);
        setter(items);
    }, []);

    // ── Data load function (called from AuthContext via triggerDataLoad) ──
    const initFirebaseAndLoad = useCallback(async (config: any) => {
        auth.setLoadError(null);
        try {
            console.log('[DataContext] Starting data load...');
            let tries = 0;
            while (!(window as any).firebase && tries < 50) { await new Promise(r => setTimeout(r, 100)); tries++; }
            if (!(window as any).firebase) { auth.setLoadError('Firebase library not loaded'); auth.setStep('appLogin'); return; }
            if (!initFirebase(config)) { auth.setLoadError('Firebase init failed — check config'); auth.setStep('appLogin'); return; }

            const fbAuth = getAuth();
            if (fbAuth && fbAuth.currentUser) {
                console.log('[DataContext] Using authenticated user:', fbAuth.currentUser.email || fbAuth.currentUser.uid);
            } else {
                console.warn('[DataContext] No authenticated user — redirecting to login');
                auth.setStep('appLogin');
                return;
            }

            auth.setFirebaseReady(true);
            const db = getDb();

            const loadCol = async (name: string) => {
                const snap = await db.collection(name).get();
                const items = snapToArray(snap);
                logReads('boot', name, items.length);
                return items;
            };
            const loadDoc = async (col: string, id: string) => {
                const d = await db.collection(col).doc(id).get();
                logReads('boot', `${col}/${id}`, d.exists ? 1 : 0);
                return d.exists ? d.data() : null;
            };

            const cutoff30 = new Date();
            cutoff30.setDate(cutoff30.getDate() - 30);
            const cutoff30Str = cutoff30.toISOString().slice(0, 10);

            // Batch 1: Critical
            const [u, cp] = await Promise.all([loadCol('users'), loadDoc('config', 'companyProfile')]);
            setUsers(u);
            setCompanyProfile(cp);

            // Batch 2: Resilient
            await Promise.allSettled([
                loadCol('invoices').then(d => { setInvoices(d); return d; }),
                loadCol('vehicles').then(d => { setVehicles(d); return d; }),
                loadCol('smjestaj').then(d => { setSmjestaj(d); return d; }),
                loadCol('otpremnice').then(d => { setOtpremnice(d); return d; }),
            ]);

            // PIN migration
            const isHashed = (pin: string) => /^[a-f0-9]{64}$/.test(pin);
            const usersToMigrate = u.filter((user: any) => user.pin && !isHashed(user.pin));
            if (usersToMigrate.length > 0) {
                const defaultHashedPin = await hashPin('1234');
                for (const user of usersToMigrate) {
                    await db.collection('users').doc(user.id).update({ pin: defaultHashedPin });
                }
                console.log(`Migrated ${usersToMigrate.length} user PINs to hashed default.`);
            }

            // Realtime listeners
            const listenWithLog = (col: string, setter: any, query?: any) => {
                const src = query || db.collection(col);
                return src.onSnapshot((snap: any) => {
                    const items = snapToArray(snap);
                    logReads('listener', col, items.length, 'onSnapshot');
                    setter(items);
                });
            };

            const tsQuery = db.collection('timesheets')
                .where('date', '>=', cutoff30Str)
                .orderBy('date', 'desc')
                .limit(200);

            const tsUnsub = tsQuery.onSnapshot((snap: any) => {
                const recentDocs = snapToArray(snap);
                logReads('listener', 'timesheets', recentDocs.length, 'onSnapshot');
                setTimesheets(prev => {
                    const oldDocs = prev.filter((d: any) => (d.date || '') < cutoff30Str);
                    return [...oldDocs, ...recentDocs];
                });
            });

            const syncMode = auth.sessionConfig.syncMode || 0;
            if (syncMode === 0) {
                auth.unsubsRef.current = [
                    listenWithLog('users', setUsers),
                    listenWithLog('projects', setProjects),
                    listenWithLog('workers', setWorkers),
                    tsUnsub,
                    listenWithLog('obaveze', setObaveze),
                    db.collection('config').doc('companyProfile').onSnapshot((doc: any) => setCompanyProfile(doc.exists ? doc.data() : null)),
                ];
            } else {
                auth.unsubsRef.current = [
                    db.collection('config').doc('companyProfile').onSnapshot((doc: any) => setCompanyProfile(doc.exists ? doc.data() : null)),
                ];
                auth.setLastSync(new Date());
            }

            if (!cp) { auth.setStep('companySetup'); return; }
            if (!u.length) { auth.setStep('adminCreate'); return; }

            // Session config listener
            auth.unsubsRef.current.push(
                db.collection('config').doc('session').onSnapshot((doc: any) => {
                    if (doc.exists) {
                        const sc = doc.data();
                        auth.setSessionConfig(prev => {
                            if (prev.sessionVersion !== null && sc.sessionVersion && sc.sessionVersion > prev.sessionVersion) {
                                auth.clearSession();
                                auth.setCurrentUser(null);
                                const a = getAuth(); if (a) a.signOut();
                                auth.setStep('appLogin');
                            }
                            return { sessionDuration: sc.sessionDuration || 60, sessionVersion: sc.sessionVersion || 1, syncMode: sc.syncMode || 0 };
                        });
                    }
                })
            );

            // Session restore from localStorage
            const saved = auth.loadSession();
            if (saved) {
                const elapsed = (Date.now() - new Date(saved.loginAt).getTime()) / 60000;
                const maxDuration = auth.sessionConfig.sessionDuration || 60;
                if (elapsed < maxDuration) {
                    const restoredUser = u.find((usr: any) => usr.id === saved.userId);
                    if (restoredUser) {
                        console.log('[Session] Restored:', restoredUser.name, `(${Math.round(elapsed)}min ago)`);
                        auth.handleUserLogin(restoredUser);
                        return;
                    }
                }
                auth.clearSession();
            }

            // After login match
            const fbAuth2 = getAuth();
            if (fbAuth2 && fbAuth2.currentUser) {
                const email = fbAuth2.currentUser.email || '';
                const matchName = email.split('@')[0];
                const matchedUser = u.find((usr: any) => usr.username === matchName);
                if (matchedUser) {
                    await writeAuthMapping(fbAuth2.currentUser.uid, matchedUser);
                    auth.handleUserLogin(matchedUser);
                    try {
                        await db.collection('auditLog').add({
                            id: genId(), action: 'LOGIN_SUCCESS', user: matchedUser.name || matchName,
                            userId: matchedUser.id, email, timestamp: new Date().toISOString(),
                            userAgent: navigator.userAgent.slice(0, 200),
                        });
                    } catch { /* ignore */ }
                } else {
                    try {
                        await db.collection('auditLog').add({
                            id: genId(), action: 'LOGIN_NO_MATCH', user: matchName,
                            email, timestamp: new Date().toISOString(),
                        });
                    } catch { /* ignore */ }
                    auth.setStep('appLogin');
                }
            } else {
                auth.setStep('appLogin');
            }
        } catch (err: any) {
            console.error('[DataContext] Firebase load error:', err);
            if (err.code === 'permission-denied' || err.message?.includes('permission') || err.message?.includes('offline')) {
                auth.clearStaleCache();
                try { const a = getAuth(); if (a) a.signOut(); } catch { }
            }
            auth.setLoadError(err.message);
            auth.setStep('appLogin');
        }
    }, [auth]);

    // Register data load function with AuthContext
    useEffect(() => {
        auth.setTriggerDataLoad(initFirebaseAndLoad);
    }, [initFirebaseAndLoad]);

    // Polling interval effect
    useEffect(() => {
        const syncMode = auth.sessionConfig.syncMode || 0;
        if (syncMode === 0 || auth.step !== 'app') return;
        const intervalMs = syncMode * 60 * 1000;
        const doRefresh = async () => {
            const db = getDb(); if (!db) return;
            try {
                const loadCol = async (name: string) => {
                    const snap = await db.collection(name).get();
                    return snapToArray(snap);
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
                setUsers(u); setProjects(p); setWorkers(w);
                setTimesheets(prev => {
                    const oldDocs = prev.filter((d: any) => (d.date || '') < cutStr);
                    return [...oldDocs, ...ts];
                });
                setInvoices(inv); setVehicles(veh); setSmjestaj(smj); setObaveze(ob); setOtpremnice(otp);
                auth.setLastSync(new Date());
            } catch (e) { console.error('[Polling] Refresh failed:', e); }
        };
        const timer = setInterval(doRefresh, intervalMs);
        return () => clearInterval(timer);
    }, [auth.sessionConfig.syncMode, auth.step]);

    // ── Audit log helper ──
    const addAuditLog = useCallback(async (action: string, details: any) => {
        const entry = { id: genId(), action, user: auth.currentUser?.name || 'System', timestamp: new Date().toISOString(), details };
        await add('auditLog', entry);
        setAuditLog(prev => [...prev, entry]);
    }, [auth.currentUser, add]);

    // ── Lazy loaders ──
    const loadAuditLog = useCallback(async () => {
        if (auditLogLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await db.collection('auditLog').get(); setAuditLog(snapToArray(snap)); setAuditLogLoaded(true); }
        catch (e) { console.error('Failed to load auditLog:', e); }
    }, [auditLogLoaded]);

    const loadAllTimesheets = useCallback(async () => {
        if (allTimesheetsLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await db.collection('timesheets').get(); setTimesheets(snapToArray(snap)); setAllTimesheetsLoaded(true); }
        catch (e) { console.error('Failed to load all timesheets:', e); }
    }, [allTimesheetsLoaded]);

    const loadDailyLogs = useCallback(async () => {
        if (dailyLogsLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await db.collection('dailyLogs').get(); setDailyLogs(snapToArray(snap)); setDailyLogsLoaded(true); }
        catch (e) { console.error('Failed to load dailyLogs:', e); }
    }, [dailyLogsLoaded]);

    const loadWeatherRules = useCallback(async () => {
        if (weatherRulesLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await db.collection('weatherRules').get(); setWeatherRules(snapToArray(snap)); setWeatherRulesLoaded(true); }
        catch (e) { console.error('Failed to load weatherRules:', e); }
    }, [weatherRulesLoaded]);

    const loadSafetyData = useCallback(async () => {
        if (safetyLoaded) return;
        const db = getDb(); if (!db) return;
        try {
            const [tSnap, cSnap] = await Promise.all([db.collection('safetyTemplates').get(), db.collection('safetyChecklists').get()]);
            setSafetyTemplates(snapToArray(tSnap)); setSafetyChecklists(snapToArray(cSnap)); setSafetyLoaded(true);
        } catch (e) { console.error('Failed to load safety data:', e); }
    }, [safetyLoaded]);

    const loadProduction = useCallback(async () => {
        if (productionLoaded) return;
        const db = getDb(); if (!db) return;
        try {
            const [prodSnap, alertSnap] = await Promise.all([db.collection('production').get(), db.collection('prodAlerts').get()]);
            setProduction(snapToArray(prodSnap)); setProdAlerts(snapToArray(alertSnap)); setProductionLoaded(true);
        } catch (e) { console.error('Failed to load production:', e); }
    }, [productionLoaded]);

    const loadDeletedItems = useCallback(async () => {
        const db = getDb(); if (!db) return [];
        const results: any[] = [];
        for (const col of TRASH_COLLECTIONS) {
            try {
                const snap = await db.collection(col).where('deletedAt', '!=', null).get();
                snap.forEach((doc: any) => results.push({ ...doc.data(), id: doc.id, _collection: col }));
            } catch { /* skip */ }
        }
        return results.sort((a: any, b: any) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    }, []);

    const cleanupOldDeleted = useCallback(async () => {
        const db = getDb(); if (!db) return 0;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const cutStr = cutoff.toISOString();
        let count = 0;
        for (const col of TRASH_COLLECTIONS) {
            try {
                const snap = await db.collection(col).where('deletedAt', '!=', null).get();
                for (const doc of snap.docs) {
                    if (doc.data().deletedAt < cutStr) { await db.collection(col).doc(doc.id).delete(); count++; }
                }
            } catch { /* skip */ }
        }
        return count;
    }, []);

    // Refresh shortcuts
    const refreshInvoices = useCallback(() => refreshCollection('invoices', setInvoices), [refreshCollection]);
    const refreshVehicles = useCallback(() => refreshCollection('vehicles', setVehicles), [refreshCollection]);
    const refreshSmjestaj = useCallback(() => refreshCollection('smjestaj', setSmjestaj), [refreshCollection]);
    const refreshOtpremnice = useCallback(() => refreshCollection('otpremnice', setOtpremnice), [refreshCollection]);
    const refreshProduction = useCallback(() => refreshCollection('production', setProduction), [refreshCollection]);

    const value = useMemo<DataContextValue>(() => ({
        users, setUsers, projects, setProjects, workers, setWorkers,
        timesheets, setTimesheets, invoices, setInvoices,
        vehicles, setVehicles, smjestaj, setSmjestaj,
        obaveze, setObaveze, otpremnice, setOtpremnice,
        production, setProduction, prodAlerts, setProdAlerts,
        auditLog, setAuditLog, companyProfile, setCompanyProfile,
        dailyLogs, setDailyLogs, weatherRules, setWeatherRules,
        safetyTemplates, setSafetyTemplates, safetyChecklists, setSafetyChecklists,
        workerMap, projectMap, getWorkerName, getProjectName,
        isLeader, leaderProjectIds, leaderWorkerIds,
        add, update, remove, setDoc: setDocFn,
        addAuditLog, loadAuditLog, allTimesheetsLoaded, loadAllTimesheets,
        loadDailyLogs, loadWeatherRules, loadSafetyData, loadProduction,
        loadDeletedItems, cleanupOldDeleted,
        refreshInvoices, refreshVehicles, refreshSmjestaj, refreshOtpremnice, refreshProduction,
    }), [users, projects, workers, timesheets, invoices, vehicles, smjestaj, obaveze, otpremnice,
        production, auditLog, companyProfile, dailyLogs, weatherRules,
        safetyTemplates, safetyChecklists,
        workerMap, projectMap, getWorkerName, getProjectName,
        isLeader, leaderProjectIds, leaderWorkerIds,
        allTimesheetsLoaded,
        add, update, remove, setDocFn,
        addAuditLog, loadAuditLog, loadAllTimesheets, loadDailyLogs,
        loadWeatherRules, loadSafetyData, loadProduction,
        loadDeletedItems, cleanupOldDeleted,
        refreshInvoices, refreshVehicles, refreshSmjestaj, refreshOtpremnice, refreshProduction,
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
