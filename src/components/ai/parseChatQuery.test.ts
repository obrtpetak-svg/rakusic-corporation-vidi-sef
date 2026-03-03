import { describe, it, expect } from 'vitest';
import { parseChatQuery } from './parseChatQuery';

const mockData = {
    workers: [
        { id: 'w1', name: 'Ivan Horvat', active: true },
        { id: 'w2', name: 'Ana Kovačević', active: true },
        { id: 'w3', name: 'Marko Jurić', active: false },
    ],
    projects: [
        { id: 'p1', name: 'Projekt Alpha', status: 'aktivan', location: 'Zagreb' },
        { id: 'p2', name: 'Projekt Beta', status: 'završen', location: 'Split' },
    ],
    timesheets: [
        { id: 't1', workerId: 'w1', projectId: 'p1', date: new Date().toISOString().slice(0, 10), startTime: '08:00', endTime: '16:00', status: 'odobren', type: 'normalan' },
        { id: 't2', workerId: 'w2', projectId: 'p1', date: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '17:00', status: 'na čekanju', type: 'normalan' },
    ],
    dailyLogs: [],
    invoices: [
        { id: 'i1', projectId: 'p1', amount: '1500', status: 'na čekanju', category: 'materijal', supplier: 'Firma A', date: new Date().toISOString().slice(0, 10) },
    ],
    otpremnice: [],
    vehicles: [
        { id: 'v1', name: 'Kamion 1', regNumber: 'ZG-1234-AA', fuelLogs: [] },
    ],
    smjestaj: [],
    obaveze: [
        { id: 'o1', title: 'Nabavka materijala', active: true, priority: 'hitno' },
    ],
    safetyChecklists: [],
};

describe('parseChatQuery', () => {
    it('is a function', () => {
        expect(typeof parseChatQuery).toBe('function');
    });

    it('returns an object with answer and type', () => {
        const result = parseChatQuery('test', mockData);
        expect(result).toHaveProperty('answer');
        expect(result).toHaveProperty('type');
    });

    it('answer is always a string', () => {
        const result = parseChatQuery('Koliko radnika?', mockData);
        expect(typeof result.answer).toBe('string');
    });

    it('type is one of success/info/warn', () => {
        const result = parseChatQuery('Koliko radnika?', mockData);
        expect(['success', 'info', 'warn', 'error']).toContain(result.type);
    });

    it('answers koliko radnika', () => {
        const result = parseChatQuery('Koliko imam radnika?', mockData);
        expect(result.answer).toContain('2');
    });

    it('answers aktivni projekti', () => {
        const result = parseChatQuery('Koji su aktivni projekti?', mockData);
        expect(result.answer.length).toBeGreaterThan(0);
    });

    it('answers sati rada danas', () => {
        const result = parseChatQuery('Koliko sati je odrađeno danas?', mockData);
        expect(result.answer.length).toBeGreaterThan(0);
    });

    it('answers about specific worker Ivan Horvat', () => {
        const result = parseChatQuery('Koliko sati je radio Ivan Horvat danas?', mockData);
        expect(result.answer).toContain('Ivan');
    });

    it('handles empty data gracefully', () => {
        const emptyData = {
            workers: [], projects: [], timesheets: [],
            dailyLogs: [], invoices: [], otpremnice: [],
            vehicles: [], smjestaj: [], obaveze: [], safetyChecklists: []
        };
        const result = parseChatQuery('Koliko radnika?', emptyData);
        expect(result).toHaveProperty('answer');
        expect(typeof result.answer).toBe('string');
    });

    it('handles unknown queries', () => {
        const result = parseChatQuery('abcxyz123nonsense', mockData);
        expect(result).toHaveProperty('answer');
        expect(result.answer.length).toBeGreaterThan(0);
    });

    it('handles mixed case', () => {
        const result = parseChatQuery('KOLIKO RADNIKA IMAM?', mockData);
        expect(result).toHaveProperty('answer');
    });

    it('handles Croatian diacritics', () => {
        const result = parseChatQuery('Što čeka odobrenje?', mockData);
        expect(result).toHaveProperty('answer');
    });

    it('answers tko radi danas', () => {
        const result = parseChatQuery('Tko radi danas?', mockData);
        expect(result).toHaveProperty('answer');
    });

    it('answers o vozilima', () => {
        const result = parseChatQuery('Koliko imam vozila?', mockData);
        expect(result.answer).toContain('1');
    });

    it('answers o obavezama', () => {
        const result = parseChatQuery('Koje su obaveze?', mockData);
        expect(result).toHaveProperty('answer');
    });

    it('answers o troškovima', () => {
        const result = parseChatQuery('Koliki su troškovi?', mockData);
        expect(result).toHaveProperty('answer');
    });

    it('answers o računima', () => {
        const result = parseChatQuery('Koliko računa?', mockData);
        expect(result).toHaveProperty('answer');
    });
});
