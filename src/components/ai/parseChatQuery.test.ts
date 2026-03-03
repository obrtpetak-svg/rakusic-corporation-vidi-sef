import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseChatQuery } from './parseChatQuery';

// ═══════════════════════════════════════════════════
// parseChatQuery — NLP Engine Unit Tests
// ═══════════════════════════════════════════════════

// Mock data matching ViDiSef production data shape
const mockWorkers = [
    { id: 'w1', name: 'Marko Rakušić', active: true, role: 'worker' },
    { id: 'w2', name: 'Ivan Petrović', active: true, role: 'worker' },
    { id: 'w3', name: 'Ana Kovačević', active: true, role: 'worker' },
    { id: 'w4', name: 'Pero Perić', active: false, role: 'worker' },
];

const mockProjects = [
    { id: 'p1', name: 'Most Drava', status: 'aktivan', workers: ['w1', 'w2'], siteLat: 45.5, siteLng: 18.7, location: 'Osijek' },
    { id: 'p2', name: 'Hala Vukovar', status: 'aktivan', workers: ['w3'], siteLat: null, siteLng: null },
    { id: 'p3', name: 'Stari projekt', status: 'završen', workers: [] },
];

const todayStr = new Date().toISOString().slice(0, 10);
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const mockTimesheets = [
    { id: 't1', workerId: 'w1', projectId: 'p1', date: todayStr, startTime: '07:00', endTime: '15:00', status: 'odobren' },
    { id: 't2', workerId: 'w2', projectId: 'p1', date: todayStr, startTime: '08:00', endTime: '16:30', status: 'odobren' },
    { id: 't3', workerId: 'w1', projectId: 'p1', date: yesterdayStr, startTime: '06:00', endTime: '18:00', status: 'odobren' },
    { id: 't4', workerId: 'w3', projectId: 'p2', date: todayStr, startTime: '07:00', endTime: '15:00', status: 'na čekanju' },
];

const mockInvoices = [
    { id: 'i1', projectId: 'p1', amount: '5000', status: 'prihvaćena' },
    { id: 'i2', projectId: 'p2', amount: '3000', status: 'na čekanju' },
];

const mockData = {
    workers: mockWorkers,
    projects: mockProjects,
    timesheets: mockTimesheets,
    dailyLogs: [],
    invoices: mockInvoices,
    otpremnice: [],
    vehicles: [{ id: 'v1', name: 'Fiat Ducato', plates: 'OS-123-AB', year: 2020 }],
    smjestaj: [{ id: 's1', name: 'Hotel Osijek', city: 'Osijek', maxCapacity: 10, workerIds: ['w1', 'w2'] }],
    obaveze: [
        { id: 'o1', title: 'Naručiti čelik', active: true, dueDate: '2024-01-01', priority: 'visok', workerIds: ['w1'] },
        { id: 'o2', title: 'Prijaviti nesreću', active: true, dueDate: '2030-12-31', priority: 'normalan', workerIds: [] },
    ],
    safetyChecklists: [],
};

describe('parseChatQuery', () => {
    // ── HOURS QUERIES ──
    describe('Hours queries', () => {
        it('should answer "koliko sati radio" with hours', () => {
            const r = parseChatQuery('Koliko sati je radio Marko Rakušić danas?', mockData);
            expect(r.type).toBe('success');
            expect(r.answer).toContain('Marko');
            expect(r.answer).toContain('sati');
        });

        it('should answer "top radnici" with ranking', () => {
            const r = parseChatQuery('Tko je najviše radio ovaj tjedan?', mockData);
            expect(r.type).toMatch(/success|info/);
            expect(r.answer).toContain('Top');
        });

        it('should answer "prosječni sati"', () => {
            const r = parseChatQuery('Koliki je prosječni sat po radniku ovaj tjedan?', mockData);
            expect(r.type).toBe('info');
            expect(r.answer).toContain('Prosječno');
        });

        it('should answer "ukupno sati"', () => {
            const r = parseChatQuery('Ukupno sati ovaj tjedan', mockData);
            expect(r.type).toBe('success');
            expect(r.answer).toContain('Ukupno');
            expect(r.answer).toContain('sati');
        });
    });

    // ── WORKERS NOT WORKING ──
    describe('Attendance queries', () => {
        it('should report workers who did not work today', () => {
            const r = parseChatQuery('Tko nije radio danas?', mockData);
            // w3 has an entry but is "na čekanju", w4 is inactive so shouldn't show
            expect(r.answer).toBeTruthy();
        });

        it('should report completion percentage', () => {
            const r = parseChatQuery('Koliki je postotak ispunjenosti unosa danas?', mockData);
            expect(r.type).toMatch(/success|warn|danger/);
            expect(r.answer).toContain('%');
        });
    });

    // ── PROJECTS ──
    describe('Project queries', () => {
        it('should count active projects', () => {
            const r = parseChatQuery('Koliko imamo aktivnih projekata?', mockData);
            expect(r.type).toBe('info');
            expect(r.answer).toContain('2 aktivnih');
        });

        it('should find projects without GPS', () => {
            const r = parseChatQuery('Koji projekti nemaju GPS koordinate?', mockData);
            expect(r.answer).toContain('Hala Vukovar');
        });

        it('should find workers on a project', () => {
            const r = parseChatQuery('Tko radi na Most Drava?', mockData);
            expect(r.answer).toContain('Marko');
            expect(r.answer).toContain('Ivan');
        });

        it('should count workers per project', () => {
            const r = parseChatQuery('Koliko radnika ima na projektu Most Drava?', mockData);
            expect(r.type).toBe('info');
            expect(r.answer).toContain('2 radnika');
        });

        it('should find projects without workers', () => {
            const r = parseChatQuery('Koji projekti nemaju radnika?', mockData);
            // Only active projects — Stari projekt is finished, so none qualify (no active project without workers)
            // Hala Vukovar has w3
            expect(r.answer).toBeTruthy();
        });
    });

    // ── PENDING APPROVALS ──
    describe('Approval queries', () => {
        it('should report pending items', () => {
            const r = parseChatQuery('Što je na čekanju?', mockData);
            expect(r.answer).toContain('Radni sati');
        });

        it('should count approved/rejected stats', () => {
            const r = parseChatQuery('Koliko odobren i odbijenih unosa ima?', mockData);
            expect(r.answer).toContain('Odobreno');
        });
    });

    // ── COMPARISONS ──
    describe('Comparison queries', () => {
        it('should compare weeks', () => {
            const r = parseChatQuery('Usporedi zadnja 2 tjedna', mockData);
            expect(r.answer).toContain('tjedan');
            expect(r.answer).toContain('%');
        });

        it('should show productivity trend', () => {
            const r = parseChatQuery('Raste li produktivnost?', mockData);
            expect(r.answer).toMatch(/RASTE|PADA|STABILNA/);
        });
    });

    // ── VEHICLES ──
    describe('Vehicle queries', () => {
        it('should count vehicles', () => {
            const r = parseChatQuery('Koliko imamo vozila?', mockData);
            expect(r.answer).toContain('1');
        });

        it('should list vehicles', () => {
            const r = parseChatQuery('Koja vozila imamo?', mockData);
            expect(r.answer).toContain('Fiat Ducato');
        });
    });

    // ── ACCOMMODATION ──
    describe('Accommodation queries', () => {
        it('should count smjestaj', () => {
            const r = parseChatQuery('Koliko smještaja imamo?', mockData);
            expect(r.answer).toContain('1');
        });

        it('should find worker accommodation', () => {
            const r = parseChatQuery('U kojem je smještaju Marko Rakušić?', mockData);
            expect(r.answer).toContain('Hotel Osijek');
        });
    });

    // ── OBLIGATIONS ──
    describe('Obligation queries', () => {
        it('should count obligations', () => {
            const r = parseChatQuery('Koliko imamo obaveza?', mockData);
            expect(r.answer).toContain('Aktivne');
        });

        it('should find overdue obligations', () => {
            const r = parseChatQuery('Koje obaveze su istekle?', mockData);
            expect(r.answer).toContain('Naručiti čelik');
        });
    });

    // ── HELP ──
    describe('Help & fallback', () => {
        it('should return help text', () => {
            const r = parseChatQuery('Pomoć', mockData);
            expect(r.answer).toContain('Pitajte me');
        });

        it('should handle unknown queries gracefully', () => {
            const r = parseChatQuery('nešto potpuno nepoznato xyz123', mockData);
            expect(r.type).toBe('info');
            expect(r.answer).toContain('Nisam razumio');
        });
    });

    // ── SUMMARY ──
    describe('Summary queries', () => {
        it('should return daily summary', () => {
            const r = parseChatQuery('Daj mi sažetak dana', mockData);
            expect(r.answer).toContain('Sažetak dana');
            expect(r.answer).toContain('Aktivnih projekata');
        });
    });

    // ── WORKER INFO ──
    describe('Worker info queries', () => {
        it('should return worker profile', () => {
            const r = parseChatQuery('Info o Marko Rakušić', mockData);
            expect(r.answer).toContain('Marko');
            expect(r.answer).toContain('Sati ovaj mjesec');
        });

        it('should count workers', () => {
            const r = parseChatQuery('Koliko radnika imamo?', mockData);
            expect(r.answer).toContain('4');
            expect(r.answer).toContain('3'); // 3 active
        });
    });
});
