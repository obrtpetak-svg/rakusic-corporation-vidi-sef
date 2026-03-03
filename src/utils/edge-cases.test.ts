import { describe, it, expect } from 'vitest';
import { validate, validateOrThrow } from './validate';
import { genId, fmtDate, diffMins, hexToRgb, today } from './helpers';

// ── Edge cases for validate ──
describe('validate edge cases', () => {
    it('smjestaj passes with name', () => {
        expect(validate('smjestaj', { name: 'Hotel' }).valid).toBe(true);
    });
    it('smjestaj passes with address', () => {
        expect(validate('smjestaj', { address: 'Zagreb 10000' }).valid).toBe(true);
    });
    it('smjestaj fails without name or address', () => {
        expect(validate('smjestaj', {}).valid).toBe(false);
    });
    it('obaveze passes with title', () => {
        expect(validate('obaveze', { title: 'Task' }).valid).toBe(true);
    });
    it('obaveze passes with name', () => {
        expect(validate('obaveze', { name: 'Obaveza' }).valid).toBe(true);
    });
    it('obaveze fails without title or name', () => {
        expect(validate('obaveze', {}).valid).toBe(false);
    });
    it('otpremnice passes with projectId', () => {
        expect(validate('otpremnice', { projectId: 'p1' }).valid).toBe(true);
    });
    it('otpremnice fails without projectId', () => {
        expect(validate('otpremnice', {}).valid).toBe(false);
    });
    it('workers with empty string name fails', () => {
        expect(validate('workers', { name: '' }).valid).toBe(false);
    });
    it('users with empty pin fails', () => {
        expect(validate('users', { name: 'A', username: 'a', pin: '' }).valid).toBe(false);
    });
    it('validate returns errors array', () => {
        const r = validate('users', {});
        expect(Array.isArray(r.errors)).toBe(true);
        expect(r.errors.length).toBeGreaterThan(0);
    });
    it('validateOrThrow error message is Croatian', () => {
        try {
            validateOrThrow('workers', {});
        } catch (e) {
            expect((e as Error).message).toContain('Validacija');
        }
    });
});

// ── More helpers edge cases ──
describe('helpers edge cases', () => {
    it('genId returns unique values', () => {
        const ids = new Set(Array.from({ length: 10 }, () => genId()));
        expect(ids.size).toBe(10);
    });
    it('fmtDate handles partial date', () => {
        const r = fmtDate('2026');
        expect(r.length).toBeGreaterThan(0);
    });
    it('diffMins returns 0 for equal times', () => {
        expect(diffMins('08:00', '08:00')).toBe(0);
    });
    it('diffMins handles overnight (end < start)', () => {
        const d = diffMins('23:00', '01:00');
        expect(typeof d).toBe('number');
    });
    it('hexToRgb handles 6-char hex', () => {
        const r = hexToRgb('#ffffff');
        expect(r).toContain('255');
    });
    it('today returns YYYY-MM-DD format', () => {
        expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
