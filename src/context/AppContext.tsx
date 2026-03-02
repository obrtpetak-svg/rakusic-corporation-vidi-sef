/**
 * AppContext — Backward-compatible wrapper
 * 
 * Combines AuthContext + DataContext into a single context that
 * all 33 existing components can use via useApp() without changes.
 * 
 * New components should prefer useAuth() or useData() for better
 * render performance (only re-renders when relevant state changes).
 */
import { createContext, useContext, useMemo } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData } from './DataContext';

// Re-export everything from sub-contexts for external use
export { useAuth } from './AuthContext';
export { useData } from './DataContext';
export { getDb, getAuth, initFirebase, loadFirebaseConfig, saveFirebaseConfig } from './firebaseCore';

// Also re-export CRUD functions that were previously exported from here
// Components like ArhivaPage import add/update/remove/setDoc directly
export { add, update, remove, setDocument as setDoc, batchSet, clearCollection, restoreItem, permanentDelete, getLastDeleted } from './crud';

// ── Legacy context ──────────────────────────────────────────────────────
const AppContext = createContext<any>(null);

/**
 * useApp() — backward-compatible hook.
 * Returns the combined auth + data context.
 * Prefer useAuth() or useData() in new code.
 */
export const useApp = () => useContext(AppContext);

// ── Domain-specific selector hooks ──────────────────────────────────────
export function useAuthState() {
    const auth = useAuth();
    return useMemo(() => ({
        step: auth.step, setStep: auth.setStep,
        currentUser: auth.currentUser, setCurrentUser: auth.setCurrentUser,
        firebaseReady: auth.firebaseReady, loadError: auth.loadError,
        handleAppLogin: auth.handleAppLogin, handleFirebaseLogin: auth.handleFirebaseLogin,
        handleFirebaseConfig: auth.handleFirebaseConfig,
        handleCompanySetup: auth.handleCompanySetup, handleAdminCreate: auth.handleAdminCreate,
        handleUserLogin: auth.handleUserLogin, handleLogout: auth.handleLogout,
        handleResetFirebase: auth.handleResetFirebase,
    }), [auth.step, auth.currentUser, auth.firebaseReady, auth.loadError]);
}

export function useDataState() {
    const data = useData();
    return useMemo(() => ({
        users: data.users, projects: data.projects, workers: data.workers,
        timesheets: data.timesheets, invoices: data.invoices,
        vehicles: data.vehicles, smjestaj: data.smjestaj,
        obaveze: data.obaveze, otpremnice: data.otpremnice,
        auditLog: data.auditLog, dailyLogs: data.dailyLogs,
        companyProfile: data.companyProfile,
        workerMap: data.workerMap, projectMap: data.projectMap,
        getWorkerName: data.getWorkerName, getProjectName: data.getProjectName,
        isLeader: data.isLeader, leaderProjectIds: data.leaderProjectIds, leaderWorkerIds: data.leaderWorkerIds,
        add: data.add, update: data.update, remove: data.remove, setDoc: data.setDoc,
        addAuditLog: data.addAuditLog, loadAuditLog: data.loadAuditLog,
        allTimesheetsLoaded: data.allTimesheetsLoaded, loadAllTimesheets: data.loadAllTimesheets,
        loadDailyLogs: data.loadDailyLogs,
    }), [data.users, data.projects, data.workers, data.timesheets, data.invoices,
    data.vehicles, data.smjestaj, data.obaveze, data.otpremnice,
    data.auditLog, data.dailyLogs, data.companyProfile,
    data.workerMap, data.projectMap, data.isLeader, data.leaderProjectIds, data.leaderWorkerIds,
    data.allTimesheetsLoaded]);
}

export function useConfigState() {
    const auth = useAuth();
    const data = useData();
    return useMemo(() => ({
        sessionConfig: auth.sessionConfig, lastSync: auth.lastSync,
        forceLogoutAll: auth.forceLogoutAll,
        updateSessionDuration: auth.updateSessionDuration,
        updateSyncMode: auth.updateSyncMode,
        loadDeletedItems: data.loadDeletedItems,
        cleanupOldDeleted: data.cleanupOldDeleted,
        weatherRules: data.weatherRules, loadWeatherRules: data.loadWeatherRules,
        safetyTemplates: data.safetyTemplates, safetyChecklists: data.safetyChecklists,
        loadSafetyData: data.loadSafetyData,
    }), [auth.sessionConfig, auth.lastSync, data.weatherRules,
    data.safetyTemplates, data.safetyChecklists]);
}

// ── Combined context value (for useApp backward compat) ─────────────────
function AppContextBridge({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const data = useData();

    const combined = useMemo(() => ({
        // Auth
        step: auth.step, setStep: auth.setStep,
        currentUser: auth.currentUser, setCurrentUser: auth.setCurrentUser,
        firebaseReady: auth.firebaseReady, loadError: auth.loadError,
        sessionConfig: auth.sessionConfig, lastSync: auth.lastSync,
        handleAppLogin: auth.handleAppLogin, handleFirebaseLogin: auth.handleFirebaseLogin,
        handleFirebaseConfig: auth.handleFirebaseConfig,
        handleCompanySetup: auth.handleCompanySetup, handleAdminCreate: auth.handleAdminCreate,
        handleUserLogin: auth.handleUserLogin, handleLogout: auth.handleLogout,
        handleResetFirebase: auth.handleResetFirebase,
        forceLogoutAll: auth.forceLogoutAll, updateSessionDuration: auth.updateSessionDuration,
        updateSyncMode: auth.updateSyncMode,
        changePassword: auth.changePassword, exportUserData: auth.exportUserData,
        // Data
        users: data.users, setUsers: data.setUsers,
        projects: data.projects, setProjects: data.setProjects,
        workers: data.workers, setWorkers: data.setWorkers,
        timesheets: data.timesheets, setTimesheets: data.setTimesheets,
        invoices: data.invoices, setInvoices: data.setInvoices,
        vehicles: data.vehicles, setVehicles: data.setVehicles,
        smjestaj: data.smjestaj, setSmjestaj: data.setSmjestaj,
        obaveze: data.obaveze, setObaveze: data.setObaveze,
        otpremnice: data.otpremnice, setOtpremnice: data.setOtpremnice,
        production: data.production, setProduction: data.setProduction,
        prodAlerts: data.prodAlerts, setProdAlerts: data.setProdAlerts,
        auditLog: data.auditLog, setAuditLog: data.setAuditLog,
        companyProfile: data.companyProfile, setCompanyProfile: data.setCompanyProfile,
        dailyLogs: data.dailyLogs, setDailyLogs: data.setDailyLogs,
        weatherRules: data.weatherRules, setWeatherRules: data.setWeatherRules,
        safetyTemplates: data.safetyTemplates, setSafetyTemplates: data.setSafetyTemplates,
        safetyChecklists: data.safetyChecklists, setSafetyChecklists: data.setSafetyChecklists,
        workerMap: data.workerMap, projectMap: data.projectMap,
        getWorkerName: data.getWorkerName, getProjectName: data.getProjectName,
        isLeader: data.isLeader, leaderProjectIds: data.leaderProjectIds, leaderWorkerIds: data.leaderWorkerIds,
        add: data.add, update: data.update, remove: data.remove, setDoc: data.setDoc,
        addAuditLog: data.addAuditLog, loadAuditLog: data.loadAuditLog,
        allTimesheetsLoaded: data.allTimesheetsLoaded, loadAllTimesheets: data.loadAllTimesheets,
        loadDailyLogs: data.loadDailyLogs, loadWeatherRules: data.loadWeatherRules,
        loadSafetyData: data.loadSafetyData, loadProduction: data.loadProduction,
        loadDeletedItems: data.loadDeletedItems, cleanupOldDeleted: data.cleanupOldDeleted,
        refreshInvoices: data.refreshInvoices, refreshVehicles: data.refreshVehicles,
        refreshSmjestaj: data.refreshSmjestaj, refreshOtpremnice: data.refreshOtpremnice,
        refreshProduction: data.refreshProduction,
    }), [auth, data]);

    return <AppContext.Provider value={combined}>{children}</AppContext.Provider>;
}

// ── AppProvider ──────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <DataProvider>
                <AppContextBridge>
                    {children}
                </AppContextBridge>
            </DataProvider>
        </AuthProvider>
    );
}
