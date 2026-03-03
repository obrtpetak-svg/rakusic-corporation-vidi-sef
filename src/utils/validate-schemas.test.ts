import { describe, it, expect } from 'vitest';
import { validate, validateOrThrow } from './validate';

describe('validate', () => {
    // ── workers ──
    describe('workers schema', () => {
        it('passes with valid name', () => {
            expect(validate('workers', { name: 'Ivan Horvat' }).valid).toBe(true);
        });
        it('fails without name', () => {
            const r = validate('workers', {});
            expect(r.valid).toBe(false);
            expect(r.errors.length).toBeGreaterThan(0);
        });
        it('fails with 1-char name', () => {
            expect(validate('workers', { name: 'A' }).valid).toBe(false);
        });
        it('passes with 2-char name', () => {
            expect(validate('workers', { name: 'AB' }).valid).toBe(true);
        });
    });

    // ── projects ──
    describe('projects schema', () => {
        it('passes with name', () => {
            expect(validate('projects', { name: 'Gradilište A' }).valid).toBe(true);
        });
        it('fails without name', () => {
            expect(validate('projects', {}).valid).toBe(false);
        });
    });

    // ── users ──
    describe('users schema', () => {
        it('passes with all required fields', () => {
            expect(validate('users', { name: 'Admin', username: 'admin', pin: '1234' }).valid).toBe(true);
        });
        it('fails without name', () => {
            expect(validate('users', { username: 'admin', pin: '1234' }).valid).toBe(false);
        });
        it('fails without username', () => {
            expect(validate('users', { name: 'Admin', pin: '1234' }).valid).toBe(false);
        });
        it('fails with short pin', () => {
            expect(validate('users', { name: 'Admin', username: 'admin', pin: '12' }).valid).toBe(false);
        });
        it('passes with exactly 4-char pin', () => {
            expect(validate('users', { name: 'Admin', username: 'admin', pin: '1234' }).valid).toBe(true);
        });
    });

    // ── timesheets ──
    describe('timesheets schema', () => {
        it('passes with date and workerId', () => {
            expect(validate('timesheets', { date: '2026-03-03', workerId: 'w1' }).valid).toBe(true);
        });
        it('fails without date', () => {
            expect(validate('timesheets', { workerId: 'w1' }).valid).toBe(false);
        });
        it('fails without workerId', () => {
            expect(validate('timesheets', { date: '2026-03-03' }).valid).toBe(false);
        });
    });

    // ── invoices ──
    describe('invoices schema', () => {
        it('passes with description', () => {
            expect(validate('invoices', { description: 'Materijal' }).valid).toBe(true);
        });
        it('passes with title', () => {
            expect(validate('invoices', { title: 'Račun' }).valid).toBe(true);
        });
        it('fails without description or title', () => {
            expect(validate('invoices', {}).valid).toBe(false);
        });
    });

    // ── vehicles ──
    describe('vehicles schema', () => {
        it('passes with name', () => {
            expect(validate('vehicles', { name: 'Kamion' }).valid).toBe(true);
        });
        it('passes with plate', () => {
            expect(validate('vehicles', { plate: 'ZG-1234' }).valid).toBe(true);
        });
        it('fails without name or plate', () => {
            expect(validate('vehicles', {}).valid).toBe(false);
        });
    });

    // ── unknown collection ──
    describe('unknown collection', () => {
        it('passes any data (no schema)', () => {
            expect(validate('nonexistent', {}).valid).toBe(true);
        });
        it('returns empty errors', () => {
            expect(validate('nonexistent', {}).errors).toHaveLength(0);
        });
    });
});

describe('validateOrThrow', () => {
    it('does not throw for valid data', () => {
        expect(() => validateOrThrow('workers', { name: 'Ivan' })).not.toThrow();
    });
    it('throws for invalid data', () => {
        expect(() => validateOrThrow('workers', {})).toThrow('Validacija');
    });
    it('includes error details in message', () => {
        expect(() => validateOrThrow('workers', {})).toThrow('Ime');
    });
    it('does not throw for unknown collections', () => {
        expect(() => validateOrThrow('xyz', {})).not.toThrow();
    });
});
