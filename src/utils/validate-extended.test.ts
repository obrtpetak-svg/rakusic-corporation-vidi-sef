import { describe, it, expect } from 'vitest';
import { validate, validateOrThrow } from './validate';

// ═══════════════════════════════════════════════════
// Validate — Extended Unit Tests
// Edge cases for all collection schemas
// ═══════════════════════════════════════════════════

describe('validate', () => {
    // ── Workers ──
    describe('workers schema', () => {
        it('should pass with valid name', () => {
            const r = validate('workers', { name: 'Marko' });
            expect(r.valid).toBe(true);
            expect(r.errors).toHaveLength(0);
        });

        it('should fail with empty name', () => {
            const r = validate('workers', { name: '' });
            expect(r.valid).toBe(false);
            expect(r.errors.length).toBeGreaterThan(0);
        });

        it('should fail with single-char name', () => {
            const r = validate('workers', { name: 'M' });
            expect(r.valid).toBe(false);
            expect(r.errors.some(e => e.includes('najmanje'))).toBe(true);
        });

        it('should fail with null name', () => {
            const r = validate('workers', { name: null });
            expect(r.valid).toBe(false);
        });

        it('should fail with missing name', () => {
            const r = validate('workers', {});
            expect(r.valid).toBe(false);
        });
    });

    // ── Projects ──
    describe('projects schema', () => {
        it('should pass with valid name', () => {
            const r = validate('projects', { name: 'Most Drava' });
            expect(r.valid).toBe(true);
        });

        it('should fail with empty name', () => {
            const r = validate('projects', { name: '' });
            expect(r.valid).toBe(false);
        });
    });

    // ── Users ──
    describe('users schema', () => {
        it('should pass with all required fields', () => {
            const r = validate('users', { name: 'Admin', username: 'admin', pin: '1234' });
            expect(r.valid).toBe(true);
        });

        it('should fail with short PIN', () => {
            const r = validate('users', { name: 'Admin', username: 'admin', pin: '12' });
            expect(r.valid).toBe(false);
            expect(r.errors.some(e => e.includes('PIN'))).toBe(true);
        });

        it('should fail without username', () => {
            const r = validate('users', { name: 'Admin', pin: '1234' });
            expect(r.valid).toBe(false);
        });

        it('should fail without PIN', () => {
            const r = validate('users', { name: 'Admin', username: 'admin' });
            expect(r.valid).toBe(false);
        });
    });

    // ── Timesheets ──
    describe('timesheets schema', () => {
        it('should pass with date and workerId', () => {
            const r = validate('timesheets', { date: '2025-03-01', workerId: 'w1' });
            expect(r.valid).toBe(true);
        });

        it('should fail without date', () => {
            const r = validate('timesheets', { workerId: 'w1' });
            expect(r.valid).toBe(false);
        });

        it('should fail without workerId', () => {
            const r = validate('timesheets', { date: '2025-03-01' });
            expect(r.valid).toBe(false);
        });
    });

    // ── Invoices ──
    describe('invoices schema', () => {
        it('should pass with description', () => {
            const r = validate('invoices', { description: 'Materijal' });
            expect(r.valid).toBe(true);
        });

        it('should pass with title (alternative)', () => {
            const r = validate('invoices', { title: 'Čelik S355' });
            expect(r.valid).toBe(true);
        });

        it('should fail with neither', () => {
            const r = validate('invoices', {});
            expect(r.valid).toBe(false);
        });
    });

    // ── Vehicles ──
    describe('vehicles schema', () => {
        it('should pass with name', () => {
            expect(validate('vehicles', { name: 'Ducato' }).valid).toBe(true);
        });

        it('should pass with plate', () => {
            expect(validate('vehicles', { plate: 'OS-123-AB' }).valid).toBe(true);
        });

        it('should fail with neither', () => {
            expect(validate('vehicles', {}).valid).toBe(false);
        });
    });

    // ── Unknown collection ──
    describe('unknown collection', () => {
        it('should pass validation (no schema = no rules)', () => {
            const r = validate('nonexistent', { anything: 'goes' });
            expect(r.valid).toBe(true);
        });
    });
});

describe('validateOrThrow', () => {
    it('should not throw for valid data', () => {
        expect(() => validateOrThrow('workers', { name: 'Marko' })).not.toThrow();
    });

    it('should throw for invalid data', () => {
        expect(() => validateOrThrow('workers', { name: '' })).toThrow();
    });

    it('should include field name in error message', () => {
        expect(() => validateOrThrow('workers', {})).toThrow(/Ime/);
    });

    it('should not throw for unknown collection', () => {
        expect(() => validateOrThrow('foo', {})).not.toThrow();
    });
});
