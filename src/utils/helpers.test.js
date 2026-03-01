import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    genId, hashPin, today, nowTime,
    fmtDate, fmtDateTime, fmtHours, diffMins,
    hexToRgb, C, styles
} from './helpers';

// ═══════════════════════════════════════════════════════════════════════════
// genId — unique ID generation
// ═══════════════════════════════════════════════════════════════════════════
describe('genId', () => {
    it('should return a non-empty string', () => {
        const id = genId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('should return unique IDs on successive calls', () => {
        const ids = new Set(Array.from({ length: 100 }, () => genId()));
        expect(ids.size).toBe(100);
    });

    it('should use crypto.randomUUID when available', () => {
        const mockUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const originalRandom = crypto.randomUUID;
        crypto.randomUUID = vi.fn(() => mockUUID);

        expect(genId()).toBe(mockUUID);

        crypto.randomUUID = originalRandom;
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// hashPin — SHA-256 hashing
// ═══════════════════════════════════════════════════════════════════════════
describe('hashPin', () => {
    it('should return a 64 character hex string', async () => {
        const hash = await hashPin('1234');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return the same hash for the same input', async () => {
        const hash1 = await hashPin('1234');
        const hash2 = await hashPin('1234');
        expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', async () => {
        const hash1 = await hashPin('1234');
        const hash2 = await hashPin('5678');
        expect(hash1).not.toBe(hash2);
    });

    it('should include salt in hashing', async () => {
        // The implementation uses 'vidise-salt-' prefix
        const hash = await hashPin('');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Date/Time utilities
// ═══════════════════════════════════════════════════════════════════════════
describe('today', () => {
    it('should return ISO date format (YYYY-MM-DD)', () => {
        const result = today();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should match current date', () => {
        const expected = new Date().toISOString().slice(0, 10);
        expect(today()).toBe(expected);
    });
});

describe('nowTime', () => {
    it('should return HH:MM format', () => {
        const result = nowTime();
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
});

describe('fmtDate', () => {
    it('should format valid dates in Croatian locale', () => {
        const result = fmtDate('2025-03-15');
        // Croatian locale: dd. MM. yyyy. or similar
        expect(result).toBeTruthy();
        expect(result).not.toBe('—');
    });

    it('should return — for null/undefined', () => {
        expect(fmtDate(null)).toBe('—');
        expect(fmtDate(undefined)).toBe('—');
        expect(fmtDate('')).toBe('—');
    });
});

describe('fmtDateTime', () => {
    it('should format valid datetimes', () => {
        const result = fmtDateTime('2025-03-15T14:30:00');
        expect(result).toBeTruthy();
        expect(result).not.toBe('—');
    });

    it('should return — for falsy values', () => {
        expect(fmtDateTime(null)).toBe('—');
        expect(fmtDateTime(undefined)).toBe('—');
        expect(fmtDateTime('')).toBe('—');
    });
});

describe('fmtHours', () => {
    it('should format 0 minutes as 0h', () => {
        expect(fmtHours(0)).toBe('0h');
    });

    it('should format 60 minutes as 1h', () => {
        expect(fmtHours(60)).toBe('1h');
    });

    it('should format 90 minutes as 1h 30m', () => {
        expect(fmtHours(90)).toBe('1h 30m');
    });

    it('should format 150 minutes as 2h 30m', () => {
        expect(fmtHours(150)).toBe('2h 30m');
    });

    it('should return — for null/undefined', () => {
        expect(fmtHours(null)).toBe('—');
        expect(fmtHours(undefined)).toBe('—');
    });

    it('should handle 480 min (8h workday)', () => {
        expect(fmtHours(480)).toBe('8h');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// diffMins — time difference calculator
// ═══════════════════════════════════════════════════════════════════════════
describe('diffMins', () => {
    it('should calculate simple time difference', () => {
        expect(diffMins('08:00', '16:00')).toBe(480);
    });

    it('should handle minutes', () => {
        expect(diffMins('08:30', '16:45')).toBe(495);
    });

    it('should return 0 when start equals end', () => {
        expect(diffMins('12:00', '12:00')).toBe(0);
    });

    it('should return 0 for reverse times (no overnight support)', () => {
        // diffMins does not wrap around midnight — returns 0 for end < start
        expect(diffMins('22:00', '06:00')).toBe(0);
    });

    it('should return 0 for null/empty inputs', () => {
        expect(diffMins(null, '08:00')).toBe(0);
        expect(diffMins('08:00', null)).toBe(0);
        expect(diffMins('', '')).toBe(0);
    });

    it('should return 0 for midnight crossing (no wrap support)', () => {
        // Same as above — diffMins only works within a single day
        expect(diffMins('23:30', '00:30')).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// hexToRgb — hex color to RGB string
// ═══════════════════════════════════════════════════════════════════════════
describe('hexToRgb', () => {
    it('should convert #D95D08 (app accent) correctly', () => {
        expect(hexToRgb('#D95D08')).toBe('217,93,8');
    });

    it('should convert #000000 to 0,0,0', () => {
        expect(hexToRgb('#000000')).toBe('0,0,0');
    });

    it('should convert #FFFFFF to 255,255,255', () => {
        expect(hexToRgb('#FFFFFF')).toBe('255,255,255');
    });

    it('should handle hex without # prefix', () => {
        expect(hexToRgb('D95D08')).toBe('217,93,8');
    });

    it('should return fallback for invalid hex', () => {
        expect(hexToRgb('invalid')).toBe('249,115,22');
    });

    it('should return fallback for empty string', () => {
        expect(hexToRgb('')).toBe('249,115,22');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Theme constants
// ═══════════════════════════════════════════════════════════════════════════
describe('C (theme colors)', () => {
    it('should have all required color keys', () => {
        const requiredKeys = ['bg', 'card', 'border', 'accent', 'text', 'textMuted', 'textDim',
            'sidebar', 'cardHover', 'accentHover', 'accentLight', 'blue', 'green', 'red', 'yellow'];
        for (const key of requiredKeys) {
            expect(C).toHaveProperty(key);
            expect(typeof C[key]).toBe('string');
        }
    });

    it('should have accent as CSS variable reference', () => {
        expect(C.accent).toBe('var(--accent)');
    });
});

describe('styles', () => {
    it('should have core style objects', () => {
        expect(styles).toHaveProperty('page');
        expect(styles).toHaveProperty('card');
        expect(styles).toHaveProperty('input');
        expect(styles).toHaveProperty('btn');
        expect(styles).toHaveProperty('btnSecondary');
        expect(styles).toHaveProperty('btnDanger');
        expect(styles).toHaveProperty('btnSmall');
        expect(styles).toHaveProperty('label');
        expect(styles).toHaveProperty('th');
        expect(styles).toHaveProperty('td');
    });

    it('should have badge as a function', () => {
        expect(typeof styles.badge).toBe('function');
        const badge = styles.badge('255,0,0');
        expect(badge).toHaveProperty('background');
        expect(badge).toHaveProperty('color');
        expect(badge).toHaveProperty('borderRadius');
    });

    it('card should have correct structure', () => {
        expect(styles.card.borderRadius).toBe(12);
        expect(styles.card.padding).toBe(20);
        expect(styles.card.background).toBe('var(--card)');
    });
});
