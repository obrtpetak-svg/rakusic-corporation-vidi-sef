import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Firebase ──────────────────────────────────────────────────────
vi.mock('../context/firebaseCore', () => ({
    getDb: vi.fn(() => ({ type: 'firestore' })),
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'dashboardStats' })),
    setDoc: (...args) => mockSetDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
}));

// ─── Import after mocks ───────────────────────────────────────────────
import { refreshDashboardStats } from './DashboardStats';

describe('DashboardStats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const baseState = {
        projects: [
            { id: 'p1', name: 'Hala A', status: 'aktivan' },
            { id: 'p2', name: 'Hala B', status: 'završen' },
        ],
        workers: [
            { id: 'w1', name: 'Ivo', active: true },
            { id: 'w2', name: 'Ana', active: false },
            { id: 'w3', name: 'Pero', active: true },
        ],
        timesheets: [
            { id: 't1', status: 'na čekanju', date: '2025-01-15' },
            { id: 't2', status: 'odobreno', date: '2025-01-16' },
            { id: 't3', status: 'na čekanju', date: '2025-01-17' },
        ],
        invoices: [
            { id: 'i1', status: 'na čekanju', source: 'radnik' },
            { id: 'i2', status: 'na čekanju', source: 'admin' },
            { id: 'i3', status: 'odobreno', source: 'radnik' },
        ],
        otpremnice: [
            { id: 'o1', status: 'na čekanju' },
            { id: 'o2', status: 'isporučeno' },
        ],
        obaveze: [
            { id: 'ob1', active: true },
            { id: 'ob2', active: false },
        ],
        vehicles: [{ id: 'v1' }, { id: 'v2' }],
        smjestaj: [{ id: 's1' }],
    };

    it('should compute activeProjects correctly', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats).not.toBeNull();
        expect(stats.activeProjects).toBe(1); // only 'aktivan'
        expect(stats.totalProjects).toBe(2);
    });

    it('should compute activeWorkers correctly', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.activeWorkers).toBe(2); // w1 + w3
        expect(stats.totalWorkers).toBe(3);
    });

    it('should count pendingTimesheets correctly', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.pendingTimesheets).toBe(2); // t1 + t3
    });

    it('should count pendingInvoices (only from radnik source)', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.pendingInvoices).toBe(1); // only i1 (radnik + na čekanju)
    });

    it('should count pendingOtpremnice correctly', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.pendingOtpremnice).toBe(1);
    });

    it('should compute pendingTotal as sum of all pending', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.pendingTotal).toBe(2 + 1 + 1); // timesheets + invoices + otpremnice = 4
    });

    it('should count vehicles and smjestaj', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.totalVehicles).toBe(2);
        expect(stats.totalSmjestaj).toBe(1);
    });

    it('should count active obaveze', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.activeObaveze).toBe(1);
    });

    it('should include updatedAt timestamp', async () => {
        const stats = await refreshDashboardStats(baseState);
        expect(stats.updatedAt).toBeDefined();
        expect(new Date(stats.updatedAt).getTime()).toBeGreaterThan(0);
    });

    it('should write stats to Firestore', async () => {
        await refreshDashboardStats(baseState);
        expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle empty arrays', async () => {
        const emptyState = {
            projects: [], workers: [], timesheets: [],
            invoices: [], otpremnice: [], obaveze: [],
            vehicles: [], smjestaj: [],
        };
        const stats = await refreshDashboardStats(emptyState);
        expect(stats.activeProjects).toBe(0);
        expect(stats.totalProjects).toBe(0);
        expect(stats.activeWorkers).toBe(0);
        expect(stats.pendingTotal).toBe(0);
    });
});
