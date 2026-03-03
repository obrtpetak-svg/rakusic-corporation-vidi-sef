import { describe, it, expect, vi } from 'vitest';
import { genId, today, nowTime, fmtDate, fmtDateTime, fmtHours, diffMins, hexToRgb, C, styles } from './helpers';

describe('genId', () => {
    it('returns a string', () => {
        expect(typeof genId()).toBe('string');
    });
    it('returns unique values', () => {
        const ids = new Set(Array.from({ length: 10 }, genId));
        expect(ids.size).toBe(10);
    });
    it('returns UUID format', () => {
        expect(genId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
});

describe('today', () => {
    it('returns YYYY-MM-DD format', () => {
        expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    it('returns current date', () => {
        const now = new Date();
        expect(today()).toBe(now.toISOString().slice(0, 10));
    });
});

describe('nowTime', () => {
    it('returns HH:MM format', () => {
        expect(nowTime()).toMatch(/^\d{2}:\d{2}$/);
    });
});

describe('fmtDate', () => {
    it('formats valid date string', () => {
        const result = fmtDate('2024-03-15');
        expect(result).toContain('15');
        expect(result).toContain('3');
    });
    it('returns — for null', () => {
        expect(fmtDate(null)).toBe('—');
    });
    it('returns — for undefined', () => {
        expect(fmtDate(undefined)).toBe('—');
    });
    it('returns — for empty string', () => {
        expect(fmtDate('')).toBe('—');
    });
});

describe('fmtDateTime', () => {
    it('formats valid datetime', () => {
        const result = fmtDateTime('2024-03-15T10:30:00');
        expect(result).toContain('15');
    });
    it('returns — for null', () => {
        expect(fmtDateTime(null)).toBe('—');
    });
});

describe('fmtHours', () => {
    it('formats 0 minutes', () => {
        expect(fmtHours(0)).toBe('0h');
    });
    it('formats 60 minutes as 1h', () => {
        expect(fmtHours(60)).toBe('1h');
    });
    it('formats 90 minutes as 1h 30m', () => {
        expect(fmtHours(90)).toBe('1h 30m');
    });
    it('formats 30 minutes as 0h 30m', () => {
        expect(fmtHours(30)).toBe('0h 30m');
    });
    it('returns — for null', () => {
        expect(fmtHours(null)).toBe('—');
    });
    it('returns — for undefined', () => {
        expect(fmtHours(undefined)).toBe('—');
    });
});

describe('diffMins', () => {
    it('calculates difference between times', () => {
        expect(diffMins('08:00', '16:00')).toBe(480);
    });
    it('calculates 1 hour', () => {
        expect(diffMins('09:00', '10:00')).toBe(60);
    });
    it('calculates partial hours', () => {
        expect(diffMins('09:00', '09:30')).toBe(30);
    });
    it('returns 0 for same time', () => {
        expect(diffMins('10:00', '10:00')).toBe(0);
    });
    it('returns 0 for null start', () => {
        expect(diffMins(null, '10:00')).toBe(0);
    });
    it('returns 0 for null end', () => {
        expect(diffMins('08:00', null)).toBe(0);
    });
    it('returns 0 for both null', () => {
        expect(diffMins(null, null)).toBe(0);
    });
    it('returns 0 if end is before start', () => {
        expect(diffMins('16:00', '08:00')).toBe(0);
    });
    it('handles HH:MM format with leading zeros', () => {
        expect(diffMins('07:05', '07:35')).toBe(30);
    });
});

describe('hexToRgb', () => {
    it('converts #000000 to 0,0,0', () => {
        expect(hexToRgb('#000000')).toBe('0,0,0');
    });
    it('converts #FFFFFF to 255,255,255', () => {
        expect(hexToRgb('#FFFFFF')).toBe('255,255,255');
    });
    it('converts #FF0000 to 255,0,0', () => {
        expect(hexToRgb('#FF0000')).toBe('255,0,0');
    });
    it('converts without # prefix', () => {
        expect(hexToRgb('00FF00')).toBe('0,255,0');
    });
    it('returns default for invalid hex', () => {
        expect(hexToRgb('invalid')).toBe('249,115,22');
    });
    it('handles lowercase hex', () => {
        expect(hexToRgb('#ff00ff')).toBe('255,0,255');
    });
});

describe('C (theme colors)', () => {
    it('has text property', () => {
        expect(C.text).toBe('var(--text)');
    });
    it('has accent property', () => {
        expect(C.accent).toBe('var(--accent)');
    });
    it('has textMuted property', () => {
        expect(C.textMuted).toBe('var(--text-muted)');
    });
    it('has all required color keys', () => {
        const keys = ['bg', 'card', 'border', 'accent', 'text', 'red', 'green', 'blue', 'yellow', 'purple'];
        keys.forEach(k => expect(C).toHaveProperty(k));
    });
});

describe('styles', () => {
    it('exports card style', () => {
        expect(styles.card).toHaveProperty('borderRadius');
        expect(styles.card).toHaveProperty('padding');
    });
    it('exports btn style', () => {
        expect(styles.btn).toHaveProperty('cursor', 'pointer');
    });
    it('badge returns style object', () => {
        const badge = styles.badge('100,200,50');
        expect(badge).toHaveProperty('background');
        expect(badge).toHaveProperty('color');
        expect(badge.color).toBe('rgb(100,200,50)');
    });
    it('th has text-transform uppercase', () => {
        expect(styles.th).toHaveProperty('textTransform', 'uppercase');
    });
    it('input has width 100%', () => {
        expect(styles.input).toHaveProperty('width', '100%');
    });
});
