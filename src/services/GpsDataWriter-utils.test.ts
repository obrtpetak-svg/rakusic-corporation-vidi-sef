import { describe, it, expect } from 'vitest';
import { validateCoords, normalizeCoord, parseGpsString, distanceMetres } from './GpsDataWriter';

describe('validateCoords', () => {
    it('accepts valid Zagreb coords', () => {
        expect(validateCoords(45.815, 15.982)).toBe(true);
    });
    it('accepts equator 0,0', () => {
        expect(validateCoords(0, 0)).toBe(true);
    });
    it('accepts boundary -90, -180', () => {
        expect(validateCoords(-90, -180)).toBe(true);
    });
    it('accepts boundary 90, 180', () => {
        expect(validateCoords(90, 180)).toBe(true);
    });
    it('rejects lat out of range', () => {
        expect(validateCoords(91, 15)).toBe(false);
    });
    it('rejects lng out of range', () => {
        expect(validateCoords(45, 181)).toBe(false);
    });
    it('rejects null', () => {
        expect(validateCoords(null, null)).toBe(false);
    });
    it('rejects undefined', () => {
        expect(validateCoords(undefined, undefined)).toBe(false);
    });
    it('rejects NaN string', () => {
        expect(validateCoords('abc', 'xyz')).toBe(false);
    });
    it('accepts string numbers', () => {
        expect(validateCoords('45.815', '15.982')).toBe(true);
    });
});

describe('normalizeCoord', () => {
    it('rounds to 6 decimal places', () => {
        expect(normalizeCoord(45.8150001234)).toBe(45.815);
    });
    it('handles string input', () => {
        expect(normalizeCoord('15.9820005')).toBe(15.982001);
    });
    it('preserves exact values', () => {
        expect(normalizeCoord(45)).toBe(45);
    });
    it('handles negative values', () => {
        expect(normalizeCoord(-33.868820)).toBe(-33.86882);
    });
});

describe('parseGpsString', () => {
    it('parses valid "lat, lng" string', () => {
        const result = parseGpsString('45.815, 15.982');
        expect(result).not.toBeNull();
        expect(result!.lat).toBe(45.815);
        expect(result!.lng).toBe(15.982);
    });
    it('parses without spaces', () => {
        const result = parseGpsString('45.815,15.982');
        expect(result).not.toBeNull();
    });
    it('returns null for empty string', () => {
        expect(parseGpsString('')).toBeNull();
    });
    it('returns null for null', () => {
        expect(parseGpsString(null)).toBeNull();
    });
    it('returns null for non-string', () => {
        expect(parseGpsString(12345)).toBeNull();
    });
    it('returns null for invalid coords in string', () => {
        expect(parseGpsString('999, 999')).toBeNull();
    });
    it('returns null for single value', () => {
        expect(parseGpsString('45.815')).toBeNull();
    });
});

describe('distanceMetres', () => {
    it('returns 0 for same point', () => {
        expect(distanceMetres(45.815, 15.982, 45.815, 15.982)).toBe(0);
    });
    it('calculates short distance', () => {
        const d = distanceMetres(45.815, 15.982, 45.816, 15.982);
        expect(d).toBeGreaterThan(100);
        expect(d).toBeLessThan(120);
    });
    it('returns null for invalid coords', () => {
        expect(distanceMetres(999, 999, 45.815, 15.982)).toBeNull();
    });
    it('returns integer (rounded)', () => {
        const d = distanceMetres(45.815, 15.982, 45.816, 15.983);
        expect(Number.isInteger(d)).toBe(true);
    });
});
