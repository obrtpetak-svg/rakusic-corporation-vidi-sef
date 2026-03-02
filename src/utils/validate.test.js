import { describe, it, expect } from 'vitest';
import { validate, validateOrThrow } from './validate';

// ═══════════════════════════════════════════════════════════════════════════
// validate — collection schema validation
// ═══════════════════════════════════════════════════════════════════════════
describe('validate', () => {
    it('returns valid for unknown collection (no schema)', () => {
        const r = validate('nonexistent', { foo: 'bar' });
        expect(r.valid).toBe(true);
        expect(r.errors).toEqual([]);
    });

    describe('workers', () => {
        it('valid with name', () => {
            expect(validate('workers', { name: 'Marko' }).valid).toBe(true);
        });
        it('invalid without name', () => {
            const r = validate('workers', {});
            expect(r.valid).toBe(false);
            expect(r.errors.length).toBeGreaterThan(0);
        });
        it('invalid with short name', () => {
            const r = validate('workers', { name: 'M' });
            expect(r.valid).toBe(false);
        });
    });

    describe('projects', () => {
        it('valid with name', () => {
            expect(validate('projects', { name: 'Projekt A' }).valid).toBe(true);
        });
        it('invalid without name', () => {
            expect(validate('projects', {}).valid).toBe(false);
        });
    });

    describe('users', () => {
        it('valid with all fields', () => {
            expect(validate('users', { name: 'Admin', username: 'admin', pin: '1234' }).valid).toBe(true);
        });
        it('invalid without pin', () => {
            expect(validate('users', { name: 'Admin', username: 'admin' }).valid).toBe(false);
        });
        it('invalid with short pin', () => {
            expect(validate('users', { name: 'Admin', username: 'admin', pin: '12' }).valid).toBe(false);
        });
    });

    describe('timesheets', () => {
        it('valid with date and workerId', () => {
            expect(validate('timesheets', { date: '2025-03-01', workerId: 'w1' }).valid).toBe(true);
        });
        it('invalid without date', () => {
            expect(validate('timesheets', { workerId: 'w1' }).valid).toBe(false);
        });
    });

    describe('invoices', () => {
        it('valid with description', () => {
            expect(validate('invoices', { description: 'Materijal' }).valid).toBe(true);
        });
        it('valid with title', () => {
            expect(validate('invoices', { title: 'Račun' }).valid).toBe(true);
        });
        it('invalid without description or title', () => {
            expect(validate('invoices', {}).valid).toBe(false);
        });
    });

    describe('vehicles', () => {
        it('valid with name', () => {
            expect(validate('vehicles', { name: 'Kamion' }).valid).toBe(true);
        });
        it('valid with plate', () => {
            expect(validate('vehicles', { plate: 'OS-123-AB' }).valid).toBe(true);
        });
    });

    describe('otpremnice', () => {
        it('valid with projectId', () => {
            expect(validate('otpremnice', { projectId: 'p1' }).valid).toBe(true);
        });
        it('invalid without projectId', () => {
            expect(validate('otpremnice', {}).valid).toBe(false);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateOrThrow
// ═══════════════════════════════════════════════════════════════════════════
describe('validateOrThrow', () => {
    it('does not throw for valid data', () => {
        expect(() => validateOrThrow('workers', { name: 'Marko' })).not.toThrow();
    });

    it('throws for invalid data', () => {
        expect(() => validateOrThrow('workers', {})).toThrow('Validacija');
    });

    it('includes error details in message', () => {
        expect(() => validateOrThrow('users', {})).toThrow(/Ime/);
    });
});
