import { describe, it, expect } from 'vitest';
import { CATEGORY_PRESETS } from './SignatureCanvas';

describe('CATEGORY_PRESETS', () => {
    it('has 6 safety categories', () => {
        expect(Object.keys(CATEGORY_PRESETS)).toHaveLength(6);
    });

    it('includes PPE category', () => {
        expect(CATEGORY_PRESETS.ppe).toBeDefined();
        expect(CATEGORY_PRESETS.ppe.label).toContain('zaštitna oprema');
    });

    it('includes site safety category', () => {
        expect(CATEGORY_PRESETS.site).toBeDefined();
        expect(CATEGORY_PRESETS.site.label).toContain('gradilišta');
    });

    it('includes equipment category', () => {
        expect(CATEGORY_PRESETS.equipment).toBeDefined();
    });

    it('includes excavation category', () => {
        expect(CATEGORY_PRESETS.excavation).toBeDefined();
    });

    it('includes electrical category', () => {
        expect(CATEGORY_PRESETS.electrical).toBeDefined();
    });

    it('includes heights category', () => {
        expect(CATEGORY_PRESETS.heights).toBeDefined();
    });

    it('each category has a label', () => {
        Object.values(CATEGORY_PRESETS).forEach(preset => {
            expect(typeof preset.label).toBe('string');
            expect(preset.label.length).toBeGreaterThan(0);
        });
    });

    it('each category has items array', () => {
        Object.values(CATEGORY_PRESETS).forEach(preset => {
            expect(Array.isArray(preset.items)).toBe(true);
            expect(preset.items.length).toBeGreaterThan(0);
        });
    });

    it('PPE has kaciga and cipele', () => {
        expect(CATEGORY_PRESETS.ppe.items).toContain('Kaciga');
        expect(CATEGORY_PRESETS.ppe.items).toContain('Sigurnosne cipele');
    });

    it('electrical has uzemljenje and FID', () => {
        expect(CATEGORY_PRESETS.electrical.items).toContain('Uzemljenje ispravno');
        expect(CATEGORY_PRESETS.electrical.items).toContain('FID sklopka testirana');
    });

    it('all items are non-empty strings', () => {
        Object.values(CATEGORY_PRESETS).forEach(preset => {
            preset.items.forEach(item => {
                expect(typeof item).toBe('string');
                expect(item.trim().length).toBeGreaterThan(0);
            });
        });
    });

    it('has at least 5 items per category except excavation', () => {
        const keys = Object.keys(CATEGORY_PRESETS);
        keys.forEach(key => {
            expect(CATEGORY_PRESETS[key].items.length).toBeGreaterThanOrEqual(5);
        });
    });
});
