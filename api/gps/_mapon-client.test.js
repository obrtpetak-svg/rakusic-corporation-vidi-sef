import { describe, it, expect } from 'vitest';
import { normalizeVehicle, corsHeaders } from './_mapon-client.js';

// ─── normalizeVehicle ───────────────────────────────────────
describe('normalizeVehicle', () => {
    it('extracts basic fields from FMLC format', () => {
        const v = normalizeVehicle({
            unit_id: 42,
            label: 'Kamion 1',
            lat: 45.815,
            lng: 15.982,
            speed: 60,
            direction: 180,
        });
        expect(v.id).toBe('42');
        expect(v.name).toBe('Kamion 1');
        expect(v.lat).toBe(45.815);
        expect(v.lng).toBe(15.982);
        expect(v.speed).toBe(60);
        expect(v.heading).toBe(180);
    });

    it('extracts plate from number field', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            number: 'DJ-708-CT Živić Antun',
        });
        expect(v.plate).toBe('DJ-708-CT');
    });

    it('falls back to vehicle_registration for plate', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            number: 'No plate here',
            vehicle_registration: 'ZG-123-AB',
        });
        expect(v.plate).toBe('ZG-123-AB');
    });

    it('detects moving status when speed > 3', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            lat: 45.8,
            lng: 15.9,
            speed: 50,
            last_update: new Date().toISOString(),
        });
        expect(v.status).toBe('moving');
    });

    it('detects idle status from state name', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            lat: 45.8,
            lng: 15.9,
            speed: 0,
            state: { name: 'idling' },
            last_update: new Date().toISOString(),
        });
        expect(v.status).toBe('idle');
    });

    it('detects stopped status from state name', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            lat: 45.8,
            lng: 15.9,
            speed: 0,
            state: { name: 'standing' },
            last_update: new Date().toISOString(),
        });
        expect(v.status).toBe('stopped');
    });

    it('returns offline when lat/lng are 0', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            lat: 0,
            lng: 0,
            speed: 50,
            last_update: new Date().toISOString(),
        });
        expect(v.status).toBe('offline');
    });

    it('converts mileage from meters to km', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            mileage: 150000,
        });
        expect(v.mileage).toBe(150);
    });

    it('handles missing optional fields gracefully', () => {
        const v = normalizeVehicle({ unit_id: 99 });
        expect(v.id).toBe('99');
        expect(v.address).toBeNull();
        expect(v.driverName).toBeNull();
        expect(v.group).toBeNull();
        expect(v.vin).toBeNull();
        expect(v.fuelType).toBeNull();
    });

    it('extracts driver name from number field', () => {
        const v = normalizeVehicle({
            unit_id: 1,
            number: 'DJ-708-CT Živić Antun',
        });
        expect(v.driverName).toBe('Živić Antun');
    });
});

// ─── corsHeaders ────────────────────────────────────────────
describe('corsHeaders', () => {
    it('returns production origin for matching request', () => {
        const h = corsHeaders({ headers: { origin: 'https://rakusic-corporation.live' } });
        expect(h['Access-Control-Allow-Origin']).toBe('https://rakusic-corporation.live');
    });

    it('returns localhost origin for dev request', () => {
        const h = corsHeaders({ headers: { origin: 'http://localhost:5173' } });
        expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('falls back to production origin for unknown origin', () => {
        const h = corsHeaders({ headers: { origin: 'https://evil.com' } });
        expect(h['Access-Control-Allow-Origin']).toBe('https://rakusic-corporation.live');
    });

    it('handles missing headers gracefully', () => {
        const h = corsHeaders({});
        expect(h['Access-Control-Allow-Origin']).toBe('https://rakusic-corporation.live');
    });

    it('includes required CORS methods', () => {
        const h = corsHeaders({ headers: {} });
        expect(h['Access-Control-Allow-Methods']).toContain('POST');
        expect(h['Access-Control-Allow-Methods']).toContain('GET');
    });
});
