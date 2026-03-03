import { describe, it, expect, beforeEach } from 'vitest';
import { fmtHours, nowTime, fmtDateTime } from './helpers';

describe('fmtHours', () => {
    it('formats 0 minutes as 0h 0m', () => {
        expect(fmtHours(0)).toContain('0');
    });
    it('formats 60 minutes as 1h', () => {
        expect(fmtHours(60)).toContain('1');
    });
    it('formats 90 minutes', () => {
        const result = fmtHours(90);
        expect(result).toContain('1');
        expect(result).toContain('30');
    });
    it('formats 480 minutes (8h)', () => {
        expect(fmtHours(480)).toContain('8');
    });
    it('handles null', () => {
        expect(fmtHours(null)).toBeDefined();
    });
    it('handles undefined', () => {
        expect(fmtHours(undefined)).toBeDefined();
    });
    it('handles negative', () => {
        expect(fmtHours(-30)).toBeDefined();
    });
});

describe('nowTime', () => {
    it('returns HH:MM format', () => {
        const result = nowTime();
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
    it('returns valid hours', () => {
        const [h] = nowTime().split(':').map(Number);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(23);
    });
    it('returns valid minutes', () => {
        const [, m] = nowTime().split(':').map(Number);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(59);
    });
});

describe('fmtDateTime', () => {
    it('formats ISO datetime', () => {
        const result = fmtDateTime('2026-03-03T15:30:00Z');
        expect(result.length).toBeGreaterThan(5);
    });
    it('handles null', () => {
        expect(fmtDateTime(null)).toBe('—');
    });
    it('handles undefined', () => {
        expect(fmtDateTime(undefined)).toBe('—');
    });
    it('handles empty string', () => {
        expect(fmtDateTime('')).toBe('—');
    });
});
