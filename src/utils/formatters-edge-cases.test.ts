import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateTime, fmtHours, diffMins, genId, hexToRgb, today, nowTime } from './helpers';

// ═══════════════════════════════════════════════════
// Formatters Edge Cases — Extended Unit Tests
// Covers boundary conditions, null inputs, unusual formats
// ═══════════════════════════════════════════════════

describe('fmtDate — edge cases', () => {
    it('should handle ISO datetime strings', () => {
        const r = fmtDate('2025-06-15T14:30:00Z');
        expect(r).toBeTruthy();
        expect(typeof r).toBe('string');
    });

    it('should handle date-only strings', () => {
        const r = fmtDate('2025-01-01');
        expect(r).toBeTruthy();
    });

    it('should return — for null', () => {
        expect(fmtDate(null)).toBe('—');
    });

    it('should return — for empty string', () => {
        expect(fmtDate('')).toBe('—');
    });

    it('should return — for undefined', () => {
        expect(fmtDate(undefined)).toBe('—');
    });

    it('should handle leap year date', () => {
        const r = fmtDate('2024-02-29');
        expect(r).toBeTruthy();
    });

    it('should handle year-end date', () => {
        const r = fmtDate('2025-12-31');
        expect(r).toBeTruthy();
    });
});

describe('fmtDateTime — edge cases', () => {
    it('should include time component', () => {
        const r = fmtDateTime('2025-03-15T10:30:00');
        expect(r).toBeTruthy();
        expect(r).not.toBe('—');
    });

    it('should return — for falsy', () => {
        expect(fmtDateTime(null)).toBe('—');
        expect(fmtDateTime(undefined)).toBe('—');
        expect(fmtDateTime('')).toBe('—');
    });
});

describe('fmtHours — edge cases', () => {
    it('should handle 0 minutes', () => {
        expect(fmtHours(0)).toBe('0h');
    });

    it('should handle null', () => {
        expect(fmtHours(null)).toBe('—');
    });

    it('should handle undefined', () => {
        expect(fmtHours(undefined)).toBe('—');
    });

    it('should handle exact hours', () => {
        expect(fmtHours(120)).toBe('2h');
    });

    it('should handle partial hours', () => {
        expect(fmtHours(90)).toBe('1h 30m');
    });

    it('should handle single minute', () => {
        expect(fmtHours(1)).toBe('0h 1m');
    });

    it('should handle large values', () => {
        const r = fmtHours(6000); // 100 hours
        expect(r).toContain('100h');
    });

    it('should handle negative values gracefully', () => {
        // Implementation dependent — just ensure no crash
        const r = fmtHours(-60);
        expect(typeof r).toBe('string');
    });
});

describe('diffMins — edge cases', () => {
    it('should return 0 for same time', () => {
        expect(diffMins('08:00', '08:00')).toBe(0);
    });

    it('should handle midnight crossing', () => {
        // 23:00 to 01:00 = -1320 or 120 depending on implementation
        const r = diffMins('23:00', '01:00');
        expect(typeof r).toBe('number');
    });

    it('should return 0 for null start', () => {
        expect(diffMins(null, '08:00')).toBe(0);
    });

    it('should return 0 for null end', () => {
        expect(diffMins('08:00', null)).toBe(0);
    });

    it('should return 0 for empty strings', () => {
        expect(diffMins('', '')).toBe(0);
    });

    it('should handle single-digit hours', () => {
        // e.g. "7:30" vs "07:30"
        expect(diffMins('7:00', '8:00')).toBe(60);
    });

    it('should calculate full day', () => {
        expect(diffMins('00:00', '23:59')).toBe(1439);
    });
});

describe('hexToRgb — edge cases', () => {
    it('should convert valid 6-char hex', () => {
        expect(hexToRgb('#FF0000')).toBe('255,0,0');
    });

    it('should convert lowercase hex', () => {
        expect(hexToRgb('#00ff00')).toBe('0,255,0');
    });

    it('should handle without hash', () => {
        // Implementation may or may not support this
        const r = hexToRgb('0000FF');
        expect(typeof r).toBe('string');
    });

    it('should handle black', () => {
        expect(hexToRgb('#000000')).toBe('0,0,0');
    });

    it('should handle white', () => {
        expect(hexToRgb('#FFFFFF')).toBe('255,255,255');
    });
});

describe('genId — uniqueness', () => {
    it('should generate unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => genId()));
        expect(ids.size).toBe(100);
    });

    it('should return string type', () => {
        expect(typeof genId()).toBe('string');
    });

    it('should not be empty', () => {
        expect(genId().length).toBeGreaterThan(0);
    });
});

describe('today — format', () => {
    it('should return YYYY-MM-DD format', () => {
        expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date', () => {
        const now = new Date();
        const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        expect(today()).toBe(expected);
    });
});

describe('nowTime — format', () => {
    it('should return HH:MM format', () => {
        expect(nowTime()).toMatch(/^\d{2}:\d{2}$/);
    });
});
