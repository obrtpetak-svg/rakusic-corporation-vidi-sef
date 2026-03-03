import { describe, it, expect } from 'vitest';
import { C, styles, genId, fmtDate, fmtDateTime, fmtHours, diffMins, hexToRgb, nowTime } from './helpers';

describe('C (theme colors object)', () => {
    it('has accent', () => expect(typeof C.accent).toBe('string'));
    it('has text', () => expect(typeof C.text).toBe('string'));
    it('has bg', () => expect(typeof C.bg).toBe('string'));
    it('has card', () => expect(typeof C.card).toBe('string'));
    it('has border', () => expect(typeof C.border).toBe('string'));
    it('has textMuted', () => expect(typeof C.textMuted).toBe('string'));
    it('has red', () => expect(typeof C.red).toBe('string'));
    it('has green', () => expect(typeof C.green).toBe('string'));
    it('has blue', () => expect(typeof C.blue).toBe('string'));
});

describe('styles object completeness', () => {
    it('card has background', () => expect(styles.card).toHaveProperty('background'));
    it('card has borderRadius', () => expect(styles.card).toHaveProperty('borderRadius'));
    it('btn has cursor pointer', () => expect(styles.btn.cursor).toBe('pointer'));
    it('btnSmall has fontSize 12', () => expect(styles.btnSmall.fontSize).toBe(12));
    it('label has textTransform', () => expect(styles.label.textTransform).toBe('uppercase'));
    it('th has letterSpacing', () => expect(styles.th).toHaveProperty('letterSpacing'));
    it('td has padding', () => expect(styles.td).toHaveProperty('padding'));
    it('input has width 100%', () => expect(styles.input.width).toBe('100%'));
    it('badge is a function', () => expect(typeof styles.badge).toBe('function'));
    it('badge returns style object', () => {
        const b = styles.badge('0,128,0');
        expect(b).toHaveProperty('borderRadius');
    });
});

describe('nowTime format', () => {
    it('returns HH:MM format', () => expect(nowTime()).toMatch(/^\d{2}:\d{2}$/));
    it('returns 5-char string', () => expect(nowTime().length).toBe(5));
});

describe('genId uniqueness', () => {
    it('generates 50 unique IDs', () => {
        const ids = new Set(Array.from({ length: 50 }, () => genId()));
        expect(ids.size).toBe(50);
    });
    it('generates string IDs', () => expect(typeof genId()).toBe('string'));
});

describe('fmtDate edge cases', () => {
    it('handles null', () => expect(fmtDate(null)).toBe('—'));
    it('handles undefined', () => expect(fmtDate(undefined)).toBe('—'));
    it('handles empty string', () => expect(fmtDate('')).toBe('—'));
});

describe('fmtDateTime edge cases', () => {
    it('handles null', () => expect(fmtDateTime(null)).toBe('—'));
    it('handles undefined', () => expect(fmtDateTime(undefined)).toBe('—'));
});

describe('fmtHours edge cases', () => {
    it('handles null', () => expect(fmtHours(null)).toBe('—'));
    it('handles undefined', () => expect(fmtHours(undefined)).toBe('—'));
    it('handles large value', () => expect(fmtHours(100000)).toContain('h'));
});

describe('diffMins edge cases', () => {
    it('handles null start', () => expect(diffMins(null, '17:00')).toBe(0));
    it('handles null end', () => expect(diffMins('09:00', null)).toBe(0));
    it('handles both null', () => expect(diffMins(null, null)).toBe(0));
    it('handles same time', () => expect(diffMins('09:00', '09:00')).toBe(0));
});

describe('hexToRgb edge cases', () => {
    it('handles lowercase', () => expect(hexToRgb('#ff0000')).toBe('255,0,0'));
    it('handles no hash', () => expect(hexToRgb('00FF00')).toBe('0,255,0'));
    it('returns 3 parts', () => expect(hexToRgb('#123456').split(',').length).toBe(3));
});
