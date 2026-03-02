import { getDb } from '../context/firebaseCore';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { Project, Worker, Timesheet, Invoice, Otpremnica, Obaveza, Vehicle, Smjestaj } from '../types';

/**
 * Dashboard Stats — pre-computed aggregate document
 * 
 * Written to: config/dashboardStats
 * Read by: Dashboard.tsx on mount (1 read instead of ~100 filter ops)
 * Updated by: CRUD operations via refreshDashboardStats()
 */

export interface DashboardStats {
    activeProjects: number;
    totalProjects: number;
    activeWorkers: number;
    totalWorkers: number;
    pendingTimesheets: number;
    pendingInvoices: number;
    pendingOtpremnice: number;
    pendingTotal: number;
    totalVehicles: number;
    totalSmjestaj: number;
    activeObaveze: number;
    updatedAt: string;
}

/**
 * Recompute dashboard stats from current local state and write to Firestore.
 * Called after every CRUD operation on relevant collections.
 * 
 * @param localState - current app state arrays
 */
export async function refreshDashboardStats(localState: {
    projects: Project[];
    workers: Worker[];
    timesheets: Timesheet[];
    invoices: Invoice[];
    otpremnice: Otpremnica[];
    obaveze: Obaveza[];
    vehicles: Vehicle[];
    smjestaj: Smjestaj[];
}): Promise<DashboardStats | null> {
    const db = getDb();
    if (!db) return null;

    const stats: DashboardStats = {
        activeProjects: localState.projects.filter(p => p.status === 'aktivan').length,
        totalProjects: localState.projects.length,
        activeWorkers: localState.workers.filter(w => (w as Worker & { active?: boolean }).active !== false).length,
        totalWorkers: localState.workers.length,
        pendingTimesheets: localState.timesheets.filter(t => t.status === 'na čekanju').length,
        pendingInvoices: localState.invoices.filter(i => i.status === 'na čekanju' && i.source === 'radnik').length,
        pendingOtpremnice: localState.otpremnice.filter(o => o.status === 'na čekanju').length,
        pendingTotal: 0,
        totalVehicles: localState.vehicles.length,
        totalSmjestaj: localState.smjestaj.length,
        activeObaveze: localState.obaveze.filter(o => (o as Obaveza & { active?: boolean }).active !== false).length,
        updatedAt: new Date().toISOString(),
    };
    stats.pendingTotal = stats.pendingTimesheets + stats.pendingInvoices + stats.pendingOtpremnice;

    try {
        await setDoc(doc(db, 'config', 'dashboardStats'), stats, { merge: true });
        if (import.meta.env.DEV) console.log('[READS] dashboardStats written:', stats.pendingTotal, 'pending');
    } catch (e) {
        console.warn('[DashboardStats] Write failed:', (e as Error).message);
    }

    return stats;
}

/**
 * Read dashboard stats from config/dashboardStats.
 * Returns null if not found (Dashboard falls back to local computation).
 */
export async function readDashboardStats(): Promise<DashboardStats | null> {
    const db = getDb();
    if (!db) return null;

    try {
        const snap = await getDoc(doc(db, 'config', 'dashboardStats'));
        if (snap.exists()) {
            if (import.meta.env.DEV) console.log('[READS] dashboardStats read (1 read)');
            return snap.data() as DashboardStats;
        }
    } catch (e) {
        console.warn('[DashboardStats] Read failed:', (e as Error).message);
    }
    return null;
}
