import { getDb } from '../context/firebaseCore';

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
    projects: any[];
    workers: any[];
    timesheets: any[];
    invoices: any[];
    otpremnice: any[];
    obaveze: any[];
    vehicles: any[];
    smjestaj: any[];
}): Promise<DashboardStats | null> {
    const db = getDb();
    if (!db) return null;

    const stats: DashboardStats = {
        activeProjects: localState.projects.filter((p: any) => p.status === 'aktivan').length,
        totalProjects: localState.projects.length,
        activeWorkers: localState.workers.filter((w: any) => w.active !== false).length,
        totalWorkers: localState.workers.length,
        pendingTimesheets: localState.timesheets.filter((t: any) => t.status === 'na čekanju').length,
        pendingInvoices: localState.invoices.filter((i: any) => i.status === 'na čekanju' && i.source === 'radnik').length,
        pendingOtpremnice: localState.otpremnice.filter((o: any) => o.status === 'na čekanju').length,
        pendingTotal: 0,
        totalVehicles: localState.vehicles.length,
        totalSmjestaj: localState.smjestaj.length,
        activeObaveze: localState.obaveze.filter((o: any) => o.active !== false).length,
        updatedAt: new Date().toISOString(),
    };
    stats.pendingTotal = stats.pendingTimesheets + stats.pendingInvoices + stats.pendingOtpremnice;

    try {
        await db.collection('config').doc('dashboardStats').set(stats, { merge: true });
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
        const doc = await db.collection('config').doc('dashboardStats').get();
        if (doc.exists) {
            if (import.meta.env.DEV) console.log('[READS] dashboardStats read (1 read)');
            return doc.data() as DashboardStats;
        }
    } catch (e) {
        console.warn('[DashboardStats] Read failed:', (e as Error).message);
    }
    return null;
}
