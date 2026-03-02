import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { genId, hashPin } from '../utils/helpers';
import { log } from '../utils/logger';
import { validateOrThrow } from '../utils/validate';
import { writeAuthMapping, getDb, getAuth, initFirebase, loadFirebaseConfig, type FirebaseConfig } from './firebaseCore';
import { useAuth } from './AuthContext';
import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    getDocs, getDoc, addDoc, onSnapshot, writeBatch,
    query, where, orderBy, limit,
    type QuerySnapshot, type DocumentSnapshot,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import type {
    User, Worker, Project, Timesheet, Invoice, Vehicle,
    Smjestaj, Obaveza, Otpremnica, ProductionEntry, ProductionAlert,
    AuditEntry, DailyLog, WeatherRule, SafetyTemplate, SafetyChecklist,
    CompanyProfile, BaseDoc,
} from '../types';

// ── Types ────────────────────────────────────────────────────────────────
export interface DataContextValue {
    users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    workers: Worker[]; setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
    timesheets: Timesheet[]; setTimesheets: React.Dispatch<React.SetStateAction<Timesheet[]>>;
    invoices: Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    vehicles: Vehicle[]; setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
    smjestaj: Smjestaj[]; setSmjestaj: React.Dispatch<React.SetStateAction<Smjestaj[]>>;
    obaveze: Obaveza[]; setObaveze: React.Dispatch<React.SetStateAction<Obaveza[]>>;
    otpremnice: Otpremnica[]; setOtpremnice: React.Dispatch<React.SetStateAction<Otpremnica[]>>;
    production: ProductionEntry[]; setProduction: React.Dispatch<React.SetStateAction<ProductionEntry[]>>;
    prodAlerts: ProductionAlert[]; setProdAlerts: React.Dispatch<React.SetStateAction<ProductionAlert[]>>;
    auditLog: AuditEntry[]; setAuditLog: React.Dispatch<React.SetStateAction<AuditEntry[]>>;
    companyProfile: CompanyProfile | null; setCompanyProfile: (cp: CompanyProfile | null) => void;
    dailyLogs: DailyLog[]; setDailyLogs: React.Dispatch<React.SetStateAction<DailyLog[]>>;
    weatherRules: WeatherRule[]; setWeatherRules: React.Dispatch<React.SetStateAction<WeatherRule[]>>;
    safetyTemplates: SafetyTemplate[]; setSafetyTemplates: React.Dispatch<React.SetStateAction<SafetyTemplate[]>>;
    safetyChecklists: SafetyChecklist[]; setSafetyChecklists: React.Dispatch<React.SetStateAction<SafetyChecklist[]>>;
    workerMap: Map<string, Worker>;
    projectMap: Map<string, Project>;
    getWorkerName: (id: string) => string;
    getProjectName: (id: string) => string;
    isLeader: boolean;
    leaderProjectIds: string[];
    leaderWorkerIds: string[];
    // CRUD
    add: (collection: string, data: Record<string, unknown>) => Promise<BaseDoc | null>;
    update: (collection: string, id: string, updates: Record<string, unknown>) => Promise<void>;
    remove: (collection: string, id: string) => Promise<void>;
    setDoc: (collection: string, docId: string, data: Record<string, unknown>) => Promise<void>;
    // Lazy loaders
    addAuditLog: (action: string, details: Record<string, unknown>) => Promise<void>;
    loadAuditLog: () => Promise<void>;
    allTimesheetsLoaded: boolean;
    loadAllTimesheets: () => Promise<void>;
    loadDailyLogs: () => Promise<void>;
    loadWeatherRules: () => Promise<void>;
    loadSafetyData: () => Promise<void>;
    loadProduction: () => Promise<void>;
    loadDeletedItems: () => Promise<BaseDoc[]>;
    cleanupOldDeleted: () => Promise<number>;
    // Refresh
    refreshInvoices: () => Promise<void>;
    refreshVehicles: () => Promise<void>;
    refreshSmjestaj: () => Promise<void>;
    refreshOtpremnice: () => Promise<void>;
    refreshProduction: () => Promise<void>;
}

// ── Error handler ────────────────────────────────────────────────────────
function handleError(e: unknown, op: string) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'permission-denied' || (err.message && err.message.includes('permissions'))) {
        throw new Error('Nemate dozvolu za ovu operaciju. Kontaktirajte administratora.');
    }
    console.error(`Firestore ${op} error:`, e);
}

// ── Global setter registry ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetterFn = (updater: any) => void;
const _setterMap: Record<string, SetterFn> = {};

// ── Snap to array helper ─────────────────────────────────────────────────
function snapToArray<T extends BaseDoc = BaseDoc>(snap: QuerySnapshot): T[] {
    const items: T[] = [];
    snap.forEach((docSnap) => {
        const d = { ...docSnap.data(), id: docSnap.id } as T;
        if (!(d as BaseDoc).deletedAt) items.push(d);
    });
    return items;
}

// ── Reads telemetry ──────────────────────────────────────────────────────
function logReads(source: string, collection: string, count: number, type = 'get') {
    if (import.meta.env?.DEV) {
        log(`[READS] ${type.toUpperCase()} ${collection}: ${count} docs (${source})`);
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

    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [smjestaj, setSmjestaj] = useState<Smjestaj[]>([]);
    const [obaveze, setObaveze] = useState<Obaveza[]>([]);
    const [otpremnice, setOtpremnice] = useState<Otpremnica[]>([]);
    const [production, setProduction] = useState<ProductionEntry[]>([]);
    const [prodAlerts, setProdAlerts] = useState<ProductionAlert[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
    const [weatherRules, setWeatherRules] = useState<WeatherRule[]>([]);
    const [safetyTemplates, setSafetyTemplates] = useState<SafetyTemplate[]>([]);
    const [safetyChecklists, setSafetyChecklists] = useState<SafetyChecklist[]>([]);

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
    const addFn = useCallback(async (col: string, data: Record<string, unknown> & { id?: string }) => {
        const db = getDb(); if (!db) return null;
        const id = data.id || genId();
        const docData = { ...data, id };
        try {
            validateOrThrow(col, docData);
            await setDoc(doc(db, col, id), docData);
            if (_setterMap[col]) _setterMap[col]((prev: BaseDoc[]) => [...prev, docData as BaseDoc]);
            return docData;
        } catch (e) { handleError(e, 'add'); throw e; }
    }, []);

    const updateFn = useCallback(async (col: string, id: string, updates: Record<string, unknown>) => {
        const db = getDb(); if (!db) return;
        try {
            const stamped = { ...updates, updatedAt: new Date().toISOString() };
            await updateDoc(doc(db, col, id), stamped);
            if (_setterMap[col]) _setterMap[col]((prev: BaseDoc[]) => prev.map((d: BaseDoc) => d.id === id ? { ...d, ...stamped } : d));
        } catch (e) { handleError(e, 'update'); throw e; }
    }, []);

    const removeFn = useCallback(async (col: string, id: string) => {
        if (col === 'auditLog') { console.warn('Audit log entries cannot be deleted'); return; }
        const db = getDb(); if (!db) return;
        try {
            const deletedAt = new Date().toISOString();
            await updateDoc(doc(db, col, id), { deletedAt });
            if (_setterMap[col]) _setterMap[col]((prev: BaseDoc[]) => prev.filter((d: BaseDoc) => d.id !== id));
        } catch (e) { handleError(e, 'remove'); throw e; }
    }, []);

    const setDocFn = useCallback(async (col: string, docId: string, data: Record<string, unknown>) => {
        const db = getDb(); if (!db) return;
        try { await setDoc(doc(db, col, docId), data); }
        catch (e) { handleError(e, 'setDoc'); throw e; }
    }, []);

    // ── Refresh helper ──
    const refreshCollection = useCallback(async (name: string, setter: SetterFn | React.Dispatch<React.SetStateAction<BaseDoc[]>>) => {
        const db = getDb(); if (!db) return;
        const snap = await getDocs(collection(db, name));
        const items = snapToArray(snap);
        logReads('refresh', name, items.length);
        setter(items);
    }, []);

    // ── Data load function (called from AuthContext via triggerDataLoad) ──
    const initFirebaseAndLoad = useCallback(async (config: Record<string, string> | FirebaseConfig) => {
        auth.setLoadError(null);
        try {
            log('[DataContext] Starting data load...');
            if (!initFirebase(config as FirebaseConfig)) { auth.setLoadError('Firebase init failed — check config'); auth.setStep('appLogin'); return; }

            const fbAuth = getAuth();
            if (fbAuth && fbAuth.currentUser) {
                log('[DataContext] Using authenticated user:', fbAuth.currentUser.email || fbAuth.currentUser.uid);
            } else {
                console.warn('[DataContext] No authenticated user — redirecting to login');
                auth.setStep('appLogin');
                return;
            }

            auth.setFirebaseReady(true);
            const db = getDb();
            if (!db) { auth.setLoadError('Database not available'); auth.setStep('appLogin'); return; }

            const loadCol = async (name: string) => {
                const snap = await getDocs(collection(db, name));
                const items = snapToArray(snap);
                logReads('boot', name, items.length);
                return items;
            };
            const loadSingleDoc = async (col: string, id: string) => {
                const d = await getDoc(doc(db, col, id));
                logReads('boot', `${col}/${id}`, d.exists() ? 1 : 0);
                return d.exists() ? d.data() : null;
            };

            const cutoff30 = new Date();
            cutoff30.setDate(cutoff30.getDate() - 30);
            const cutoff30Str = cutoff30.toISOString().slice(0, 10);

            // Batch 1: Critical
            const [u, cp] = await Promise.all([loadCol('users'), loadSingleDoc('config', 'companyProfile')]);
            setUsers(u as User[]);
            setCompanyProfile(cp as CompanyProfile | null);

            // Batch 2: Resilient
            await Promise.allSettled([
                loadCol('invoices').then(d => { setInvoices(d as Invoice[]); return d; }),
                loadCol('vehicles').then(d => { setVehicles(d as Vehicle[]); return d; }),
                loadCol('smjestaj').then(d => { setSmjestaj(d as Smjestaj[]); return d; }),
                loadCol('otpremnice').then(d => { setOtpremnice(d as Otpremnica[]); return d; }),
            ]);

            // PIN migration
            const isHashed = (pin: string) => /^[a-f0-9]{64}$/.test(pin);
            const usersToMigrate = u.filter((user) => (user as User).pin && !isHashed((user as User).pin));
            if (usersToMigrate.length > 0) {
                const defaultHashedPin = await hashPin('1234');
                for (const user of usersToMigrate) {
                    await updateDoc(doc(db, 'users', user.id), { pin: defaultHashedPin });
                }
                log(`Migrated ${usersToMigrate.length} user PINs to hashed default.`);
            }

            // Realtime listeners (MODULAR)
            const listenWithLog = (col: string, setter: SetterFn, q?: ReturnType<typeof query>) => {
                const src = q || collection(db, col);
                return onSnapshot(src as ReturnType<typeof collection>, (snap: QuerySnapshot) => {
                    const items = snapToArray(snap);
                    logReads('listener', col, items.length, 'onSnapshot');
                    setter(items);
                });
            };

            const tsQuery = query(
                collection(db, 'timesheets'),
                where('date', '>=', cutoff30Str),
                orderBy('date', 'desc'),
                limit(200)
            );

            const tsUnsub = onSnapshot(tsQuery as ReturnType<typeof collection>, (snap: QuerySnapshot) => {
                const recentDocs = snapToArray<Timesheet>(snap);
                logReads('listener', 'timesheets', recentDocs.length, 'onSnapshot');
                setTimesheets(prev => {
                    const oldDocs = prev.filter((d) => ((d as Timesheet & { date?: string }).date || '') < cutoff30Str);
                    return [...oldDocs, ...recentDocs];
                });
            });

            const syncMode = auth.sessionConfig.syncMode || 0;
            if (syncMode === 0) {
                auth.unsubsRef.current = [
                    listenWithLog('users', setUsers as SetterFn),
                    listenWithLog('projects', setProjects as SetterFn),
                    listenWithLog('workers', setWorkers as SetterFn),
                    tsUnsub,
                    listenWithLog('obaveze', setObaveze as SetterFn),
                    onSnapshot(doc(db, 'config', 'companyProfile'), (snap: DocumentSnapshot) => setCompanyProfile(snap.exists() ? snap.data() as CompanyProfile : null)),
                ];
            } else {
                auth.unsubsRef.current = [
                    onSnapshot(doc(db, 'config', 'companyProfile'), (snap: DocumentSnapshot) => setCompanyProfile(snap.exists() ? snap.data() as CompanyProfile : null)),
                ];
                auth.setLastSync(new Date());
            }

            if (!cp) { auth.setStep('companySetup'); return; }
            if (!u.length) { auth.setStep('adminCreate'); return; }

            // Session config listener (MODULAR)
            auth.unsubsRef.current.push(
                onSnapshot(doc(db, 'config', 'session'), (snap: DocumentSnapshot) => {
                    if (snap.exists()) {
                        const sc = snap.data() as any;
                        auth.setSessionConfig(prev => {
                            if (prev.sessionVersion !== null && sc.sessionVersion && sc.sessionVersion > prev.sessionVersion) {
                                auth.clearSession();
                                auth.setCurrentUser(null);
                                const a = getAuth(); if (a) signOut(a);
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
                    const restoredUser = u.find((usr) => (usr as User).id === saved.userId);
                    if (restoredUser) {
                        log('[Session] Restored:', (restoredUser as User).name, `(${Math.round(elapsed)}min ago)`);
                        auth.handleUserLogin(restoredUser as User);
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
                const matchedUser = u.find((usr) => (usr as User).username === matchName);
                if (matchedUser) {
                    await writeAuthMapping(fbAuth2.currentUser.uid, matchedUser as User);
                    auth.handleUserLogin(matchedUser as User);
                    try {
                        await addDoc(collection(db, 'auditLog'), {
                            id: genId(), action: 'LOGIN_SUCCESS', user: (matchedUser as User).name || matchName,
                            userId: matchedUser.id, email, timestamp: new Date().toISOString(),
                            userAgent: navigator.userAgent.slice(0, 200),
                        });
                    } catch { /* ignore */ }
                } else {
                    try {
                        await addDoc(collection(db, 'auditLog'), {
                            id: genId(), action: 'LOGIN_NO_MATCH', user: matchName,
                            email, timestamp: new Date().toISOString(),
                        });
                    } catch { /* ignore */ }
                    auth.setStep('appLogin');
                }
            } else {
                auth.setStep('appLogin');
            }
        } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            console.error('[DataContext] Firebase load error:', err);
            if (e.code === 'permission-denied' || e.message?.includes('permission') || e.message?.includes('offline')) {
                auth.clearStaleCache();
                try { const a = getAuth(); if (a) signOut(a); } catch { }
            }
            auth.setLoadError(e.message || 'Unknown error');
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
                    const snap = await getDocs(collection(db, name));
                    return snapToArray(snap);
                };
                const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
                const cutStr = cutoff.toISOString().slice(0, 10);
                const [u, p, w, inv, veh, smj, ob, otp] = await Promise.all([
                    loadCol('users'), loadCol('projects'), loadCol('workers'),
                    loadCol('invoices'), loadCol('vehicles'), loadCol('smjestaj'),
                    loadCol('obaveze'), loadCol('otpremnice'),
                ]);
                const tsSnap = await getDocs(query(collection(db, 'timesheets'), where('date', '>=', cutStr), limit(200)));
                const ts = snapToArray<Timesheet>(tsSnap);
                setUsers(u as User[]); setProjects(p as Project[]); setWorkers(w as Worker[]);
                setTimesheets(prev => {
                    const oldDocs = prev.filter((d) => ((d as Timesheet & { date?: string }).date || '') < cutStr);
                    return [...oldDocs, ...ts];
                });
                setInvoices(inv as Invoice[]); setVehicles(veh as Vehicle[]); setSmjestaj(smj as Smjestaj[]); setObaveze(ob as Obaveza[]); setOtpremnice(otp as Otpremnica[]);
                auth.setLastSync(new Date());
            } catch (e) { console.error('[Polling] Refresh failed:', e); }
        };
        const timer = setInterval(doRefresh, intervalMs);
        return () => clearInterval(timer);
    }, [auth.sessionConfig.syncMode, auth.step]);

    // ── Audit log helper ──
    const addAuditLog = useCallback(async (action: string, details: Record<string, unknown>) => {
        const entry = { id: genId(), action, user: auth.currentUser?.name || 'System', timestamp: new Date().toISOString(), details };
        await addFn('auditLog', entry);
        setAuditLog(prev => [...prev, entry]);
    }, [auth.currentUser, addFn]);

    // ── Lazy loaders ──
    const loadAuditLog = useCallback(async () => {
        if (auditLogLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await getDocs(collection(db, 'auditLog')); setAuditLog(snapToArray<AuditEntry>(snap)); setAuditLogLoaded(true); }
        catch (e) { console.error('Failed to load auditLog:', e); }
    }, [auditLogLoaded]);

    const loadAllTimesheets = useCallback(async () => {
        if (allTimesheetsLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await getDocs(collection(db, 'timesheets')); setTimesheets(snapToArray<Timesheet>(snap)); setAllTimesheetsLoaded(true); }
        catch (e) { console.error('Failed to load all timesheets:', e); }
    }, [allTimesheetsLoaded]);

    const loadDailyLogs = useCallback(async () => {
        if (dailyLogsLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await getDocs(collection(db, 'dailyLogs')); setDailyLogs(snapToArray<DailyLog>(snap)); setDailyLogsLoaded(true); }
        catch (e) { console.error('Failed to load dailyLogs:', e); }
    }, [dailyLogsLoaded]);

    const loadWeatherRules = useCallback(async () => {
        if (weatherRulesLoaded) return;
        const db = getDb(); if (!db) return;
        try { const snap = await getDocs(collection(db, 'weatherRules')); setWeatherRules(snapToArray<WeatherRule>(snap)); setWeatherRulesLoaded(true); }
        catch (e) { console.error('Failed to load weatherRules:', e); }
    }, [weatherRulesLoaded]);

    const loadSafetyData = useCallback(async () => {
        if (safetyLoaded) return;
        const db = getDb(); if (!db) return;
        try {
            const [tSnap, cSnap] = await Promise.all([getDocs(collection(db, 'safetyTemplates')), getDocs(collection(db, 'safetyChecklists'))]);
            setSafetyTemplates(snapToArray<SafetyTemplate>(tSnap)); setSafetyChecklists(snapToArray<SafetyChecklist>(cSnap)); setSafetyLoaded(true);
        } catch (e) { console.error('Failed to load safety data:', e); }
    }, [safetyLoaded]);

    const loadProduction = useCallback(async () => {
        if (productionLoaded) return;
        const db = getDb(); if (!db) return;
        try {
            const [prodSnap, alertSnap] = await Promise.all([getDocs(collection(db, 'production')), getDocs(collection(db, 'prodAlerts'))]);
            setProduction(snapToArray<ProductionEntry>(prodSnap)); setProdAlerts(snapToArray<ProductionAlert>(alertSnap)); setProductionLoaded(true);
        } catch (e) { console.error('Failed to load production:', e); }
    }, [productionLoaded]);

    const loadDeletedItems = useCallback(async () => {
        const db = getDb(); if (!db) return [];
        const results: (BaseDoc & { _collection: string })[] = [];
        for (const col of TRASH_COLLECTIONS) {
            try {
                const snap = await getDocs(query(collection(db, col), where('deletedAt', '!=', null)));
                snap.forEach((d) => results.push({ ...d.data(), id: d.id, _collection: col }));
            } catch { /* skip */ }
        }
        return results.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    }, []);

    const cleanupOldDeleted = useCallback(async () => {
        const db = getDb(); if (!db) return 0;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const cutStr = cutoff.toISOString();
        let count = 0;
        for (const col of TRASH_COLLECTIONS) {
            try {
                const snap = await getDocs(query(collection(db, col), where('deletedAt', '!=', null)));
                for (const d of snap.docs) {
                    if (d.data().deletedAt < cutStr) { await deleteDoc(doc(db, col, d.id)); count++; }
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
        add: addFn, update: updateFn, remove: removeFn, setDoc: setDocFn,
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
        addFn, updateFn, removeFn, setDocFn,
        addAuditLog, loadAuditLog, loadAllTimesheets, loadDailyLogs,
        loadWeatherRules, loadSafetyData, loadProduction,
        loadDeletedItems, cleanupOldDeleted,
        refreshInvoices, refreshVehicles, refreshSmjestaj, refreshOtpremnice, refreshProduction,
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
