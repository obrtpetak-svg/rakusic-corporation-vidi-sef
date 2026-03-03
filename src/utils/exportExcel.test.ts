import { describe, it, expect, vi } from 'vitest';

// Mock XLSX at module level
vi.mock('xlsx', () => ({
    utils: {
        json_to_sheet: vi.fn(() => ({})),
        book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
        book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
}));

describe('exportExcel module', () => {
    it('exports exportToExcel', async () => {
        const mod = await import('./exportExcel');
        expect(typeof mod.exportToExcel).toBe('function');
    });
    it('exports exportTimesheets', async () => {
        const mod = await import('./exportExcel');
        expect(typeof mod.exportTimesheets).toBe('function');
    });
    it('exports exportWorkersSummary', async () => {
        const mod = await import('./exportExcel');
        expect(typeof mod.exportWorkersSummary).toBe('function');
    });
    it('exports exportInvoices', async () => {
        const mod = await import('./exportExcel');
        expect(typeof mod.exportInvoices).toBe('function');
    });
    it('exports exportProjects', async () => {
        const mod = await import('./exportExcel');
        expect(typeof mod.exportProjects).toBe('function');
    });
    it('exportToExcel accepts column definitions parameter', async () => {
        const mod = await import('./exportExcel');
        expect(mod.exportToExcel.length).toBeGreaterThanOrEqual(1);
    });
    it('exportTimesheets accepts 5 parameters', async () => {
        const mod = await import('./exportExcel');
        expect(mod.exportTimesheets.length).toBe(5);
    });
    it('exportWorkersSummary accepts 3 parameters', async () => {
        const mod = await import('./exportExcel');
        expect(mod.exportWorkersSummary.length).toBe(3);
    });
    it('exportInvoices accepts 3 parameters', async () => {
        const mod = await import('./exportExcel');
        expect(mod.exportInvoices.length).toBe(3);
    });
    it('exportProjects accepts 2 parameters', async () => {
        const mod = await import('./exportExcel');
        expect(mod.exportProjects.length).toBe(2);
    });
});
