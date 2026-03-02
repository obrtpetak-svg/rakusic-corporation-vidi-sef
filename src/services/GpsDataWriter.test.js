import { describe, it, expect } from 'vitest';
import { validateCoords, normalizeCoord, parseGpsString } from './GpsDataWriter';

// ═══════════════════════════════════════════════════════════════════════════
// validateCoords — GPS coordinate validation
// ═══════════════════════════════════════════════════════════════════════════
describe('validateCoords', () => {
    it('accepts valid Zagreb coordinates', () => {
        expect(validateCoords(45.815, 15.982)).toBe(true);
    });

    it('accepts valid Đakovo coordinates', () => {
        expect(validateCoords(45.308, 18.410)).toBe(true);
    });

    it('accepts boundary values (0, 0)', () => {
        expect(validateCoords(0, 0)).toBe(true);
    });

    it('accepts edge case: -90, -180', () => {
        expect(validateCoords(-90, -180)).toBe(true);
    });

    it('accepts edge case: 90, 180', () => {
        expect(validateCoords(90, 180)).toBe(true);
    });

    it('rejects null lat', () => {
        expect(validateCoords(null, 15)).toBe(false);
    });

    it('rejects null lng', () => {
        expect(validateCoords(45, null)).toBe(false);
    });

    it('rejects undefined', () => {
        expect(validateCoords(undefined, undefined)).toBe(false);
    });

    it('rejects out-of-range lat > 90', () => {
        expect(validateCoords(91, 15)).toBe(false);
    });

    it('rejects out-of-range lat < -90', () => {
        expect(validateCoords(-91, 15)).toBe(false);
    });

    it('rejects out-of-range lng > 180', () => {
        expect(validateCoords(45, 181)).toBe(false);
    });

    it('rejects out-of-range lng < -180', () => {
        expect(validateCoords(45, -181)).toBe(false);
    });

    it('rejects NaN', () => {
        expect(validateCoords(NaN, 15)).toBe(false);
    });

    it('accepts string numbers', () => {
        expect(validateCoords('45.815', '15.982')).toBe(true);
    });

    it('rejects non-numeric strings', () => {
        expect(validateCoords('abc', 'xyz')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// normalizeCoord — round to 6 decimal places (~11cm precision)
// ═══════════════════════════════════════════════════════════════════════════
describe('normalizeCoord', () => {
    it('rounds to 6 decimal places', () => {
        expect(normalizeCoord(45.81511111111)).toBe(45.815111);
    });

    it('preserves exact values', () => {
        expect(normalizeCoord(45.815)).toBe(45.815);
    });

    it('handles integer input', () => {
        expect(normalizeCoord(45)).toBe(45);
    });

    it('handles string input', () => {
        expect(normalizeCoord('15.982')).toBe(15.982);
    });

    it('handles zero', () => {
        expect(normalizeCoord(0)).toBe(0);
    });

    it('handles negative coordinates', () => {
        expect(normalizeCoord(-33.8688)).toBe(-33.8688);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// parseGpsString — "lat, lng" string to Coords object
// ═══════════════════════════════════════════════════════════════════════════
describe('parseGpsString', () => {
    it('parses valid GPS string', () => {
        const result = parseGpsString('45.815, 15.982');
        expect(result).toEqual({ lat: 45.815, lng: 15.982 });
    });

    it('parses GPS string without space', () => {
        const result = parseGpsString('45.815,15.982');
        expect(result).toEqual({ lat: 45.815, lng: 15.982 });
    });

    it('normalizes coordinates', () => {
        const result = parseGpsString('45.81511111, 15.98222222');
        expect(result).toEqual({ lat: 45.815111, lng: 15.982222 });
    });

    it('returns null for null input', () => {
        expect(parseGpsString(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(parseGpsString(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseGpsString('')).toBeNull();
    });

    it('returns null for non-string input', () => {
        expect(parseGpsString(42)).toBeNull();
    });

    it('returns null for invalid format (no comma)', () => {
        expect(parseGpsString('45.815')).toBeNull();
    });

    it('returns null for invalid coordinates', () => {
        expect(parseGpsString('91.0, 15.0')).toBeNull();
    });

    it('returns null for three-part string', () => {
        expect(parseGpsString('45.815, 15.982, 100')).toBeNull();
    });
});
